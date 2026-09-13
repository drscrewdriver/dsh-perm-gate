/**
 * Session-lifecycle sweep for dsh-perm-gate: DSH's workspace store
 * (`<dshHome>/storages/workspace.json`) is the authority on which sessions are
 * live and which were archived. On plugin start and hourly, the gate classifies
 * every session id it holds gate data for — live (in a workspace), archived
 * (in `global.archivedSessionIds`), or gone (neither) — and drops the
 * authorization-chain data of archived/gone sessions: their decision events in
 * `events.jsonl` and their pre-change snapshots in `snapshots/`.
 *
 * Fail-open like every other side effect in this plugin: any I/O or parse
 * error is swallowed with a single warn and the round is skipped — the sweep
 * must never influence gating. The workspace store is read-only here (DSH owns
 * it and rewrites it continuously); a torn read simply defers to the next round.
 */
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Session ids grouped by their lifecycle class, all prefix-stripped (see {@link normalizeSessionId}). */
export interface SessionClassification {
  /** Sessions referenced by some workspace's `sessionIds`. */
  readonly live: ReadonlySet<string>
  /** Sessions listed in the store's `global.archivedSessionIds`. */
  readonly archived: ReadonlySet<string>
}

/** A session id whose gate data is stale and can be swept. */
export interface SweepReport {
  /** Decision-event lines removed from events.jsonl. */
  readonly eventsRemoved: number
  /** Snapshot files deleted from the snapshots directory. */
  readonly snapshotsRemoved: number
}

/** Strip the `session-` prefix so ids from different sources compare equal. */
export function normalizeSessionId(id: unknown): string {
  const s = String(id ?? '')
  return s.startsWith('session-') ? s.slice('session-'.length) : s
}

/**
 * Classify sessions from the raw text of the workspace store. Returns `null`
 * on unparsable or structurally unexpected content (torn write, format bump) —
 * the caller skips the round. Missing `global`/`tables` sections degrade to
 * empty sets rather than failing: a fresh install has neither.
 */
export function classifySessions(raw: string): SessionClassification | null {
  let doc: unknown
  try {
    doc = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return null
  const root = doc as { global?: { archivedSessionIds?: unknown }; tables?: { workspaces?: unknown } }
  const live = new Set<string>()
  const workspaces = root.tables?.workspaces
  if (typeof workspaces === 'object' && workspaces !== null) {
    for (const record of Object.values(workspaces as Record<string, unknown>)) {
      const ids = (record as { sessionIds?: unknown } | null)?.sessionIds
      if (!Array.isArray(ids)) continue
      for (const id of ids) live.add(normalizeSessionId(id))
    }
  }
  const archived = new Set<string>()
  if (Array.isArray(root.global?.archivedSessionIds)) {
    for (const id of root.global.archivedSessionIds) archived.add(normalizeSessionId(id))
  }
  return { live, archived }
}

/**
 * Whether a gate-side session id belongs to an archived or deleted session.
 * An empty id (unattributable legacy row) never matches — the same semantics
 * `snapshotMatchesSession` uses for snapshots, so unattributable data is kept.
 */
export function isStaleSession(id: string, cls: SessionClassification): boolean {
  const norm = normalizeSessionId(id)
  return norm !== '' && !cls.live.has(norm)
}

/** Options for {@link sweepSessionData}; all paths are plugin-owned except the store. */
export interface SweepOptions {
  readonly classification: SessionClassification
  /** The decision-event JSONL feed (plugin data dir). */
  readonly eventsFile: string
  /** The per-event pre-change snapshot directory (plugin data dir). */
  readonly snapshotsDir: string
}

/**
 * Drop archived/dead sessions' rows from `events.jsonl` (atomic tmp+rename
 * rewrite, only when something is actually removed) and delete their snapshot
 * files. Both halves are independent: a failure in one still lets the other
 * run. I/O errors are swallowed with a warn — best-effort cleanup, never a
 * gating concern.
 */
export function sweepSessionData(opts: SweepOptions): SweepReport {
  const eventsRemoved = sweepEvents(opts)
  const snapshotsRemoved = sweepSnapshots(opts)
  return { eventsRemoved, snapshotsRemoved }
}

function sweepEvents({ classification, eventsFile }: SweepOptions): number {
  let raw: string
  try {
    raw = readFileSync(eventsFile, 'utf8')
  } catch {
    return 0 // no feed yet (or unreadable) — nothing to sweep
  }
  const lines = raw.split('\n')
  const kept: string[] = []
  let removed = 0
  for (const line of lines) {
    if (line.trim() === '') continue
    let stale = false
    try {
      const ev = JSON.parse(line) as { sessionId?: unknown }
      stale = isStaleSession(String(ev.sessionId ?? ''), classification)
    } catch {
      // An unparsable line is unattributable — keep it (never destroy evidence).
    }
    if (stale) removed += 1
    else kept.push(line)
  }
  if (removed === 0) return 0
  try {
    const tmp = `${eventsFile}.sweep-tmp`
    writeFileSync(tmp, kept.length > 0 ? kept.join('\n') + '\n' : '', 'utf8')
    renameSync(tmp, eventsFile)
    return removed
  } catch (e) {
    warn('events rewrite failed', e)
    return 0
  }
}

function sweepSnapshots({ classification, snapshotsDir }: SweepOptions): number {
  let entries: string[]
  try {
    entries = readdirSync(snapshotsDir)
  } catch {
    return 0 // no snapshot dir yet
  }
  let removed = 0
  for (const name of entries) {
    if (!/^\d+\.json$/.test(name)) continue
    const abs = join(snapshotsDir, name)
    let stale = false
    try {
      const doc = JSON.parse(readFileSync(abs, 'utf8')) as { sessionId?: unknown }
      stale = isStaleSession(String(doc.sessionId ?? ''), classification)
    } catch {
      // Unparsable snapshot (torn write) has no attributable session — keep it.
    }
    if (!stale) continue
    try {
      rmSync(abs)
      removed += 1
    } catch (e) {
      warn(`snapshot ${name} delete failed`, e)
    }
  }
  return removed
}

function warn(what: string, e: unknown): void {
  console.warn(`[dsh-perm-gate] session sweep: ${what}:`, e instanceof Error ? e.message : e)
}
