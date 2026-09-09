/**
 * Gate decision events for dsh-perm-gate: a JSONL audit feed the browser half
 * polls so every automatic allow / ask / deny is visible in the conversation UI.
 *
 * This module also owns the review-page data plane demonstrated by
 * dsh-approval-gate: a per-event snapshot of the files a decision touched (the
 * pre-change content), a line-level diff against the current content, and the
 * revert / snapshot-management routes the approval-history view drives.
 *
 * Pure append-only logging: every I/O error is swallowed (events are best-effort
 * and must never influence gating), and the id sequence resumes from the file on
 * first use so restarts never reuse an id the client has already seen.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** One gate decision event. `kind` drives the client notice strip styling. */
export interface GateEvent {
  /** Monotonic id (resumed from the file across restarts). */
  readonly id: number
  readonly ts: string
  readonly sessionId: string
  readonly tool: string
  /**
   * auto = allowed (rule/grant/llm), ask = routed to the human, deny = vetoed,
   * learned = confirmation settled, manual-* = the human's terminal answer to an
   * ask (approved / rejected / cancelled).
   */
  readonly kind: 'auto' | 'ask' | 'deny' | 'learned' | 'manual-approved' | 'manual-rejected' | 'manual-cancelled'
  /** Risk category when an LLM verdict contributed to the decision. */
  readonly risk?: string
  /** Truncated decision reason. */
  readonly reason: string
  /** Decision path label (rule / grant / learned / llm-assist …) — the history tag. */
  readonly verdict?: string
  /** The model's stated intent (justification) when one was available. */
  readonly justification?: string
  /** Sandbox mode involved in the decision, when known. */
  readonly mode?: string
  /** Risk category name (deletion / credential / neutral …) when classified. */
  readonly category?: string
  /** Files the decision concerns (absolute, workspace-relative, or bare names). */
  readonly files?: readonly string[]
  /** Human confirmations so far for the learned key (manual-approve events). */
  readonly learningCount?: number
  /** Confirmations required before that key auto-allows (manual-approve events). */
  readonly threshold?: number
}

export interface GateEventInput {
  readonly sessionId?: string
  readonly tool: string
  readonly kind: GateEvent['kind']
  readonly risk?: string
  readonly reason: string
  readonly verdict?: string
  readonly justification?: string
  readonly mode?: string
  readonly category?: string
  readonly files?: readonly string[]
  readonly learningCount?: number
  readonly threshold?: number
  /** Session working directory, used to resolve relative snapshot paths. */
  readonly baseDir?: string
}

const REASON_MAX = 200
const JUSTIFICATION_MAX = 400
const FILES_MAX = 8

// Snapshot bounds: one file ≤256KB, ≤5 files per event.
const SNAPSHOT_MAX_BYTES = 256 * 1024
const SNAPSHOT_MAX_FILES = 5

/** Text-file probe: binary payloads and oversized files are not snapshotted. */
const SNAPSHOT_BINARY_RE = /[\x00-\x08\x0e-\x1f]/

function isSnapshotText(buf: Buffer): boolean {
  if (buf.length > SNAPSHOT_MAX_BYTES) return false
  const head = buf.subarray(0, Math.min(buf.length, 8192))
  return !SNAPSHOT_BINARY_RE.test(head.toString('latin1'))
}

/** Read one file as snapshot text; null when unreadable, binary, or oversized. */
export function readSnapshotFile(absPath: string): string | null {
  try {
    const buf = readFileSync(absPath)
    return isSnapshotText(buf) ? buf.toString('utf8') : null
  } catch {
    return null
  }
}

/** Device/pseudo files carry no reviewable content — never snapshotted. */
function isDevicePath(absPath: string): boolean {
  return /^(\/dev\/|\/proc\/|\/sys\/)/.test(absPath)
    || /^[A-Za-z]:[\\/](?:nul|con|prn|aux|com\d|lpt\d)$/i.test(absPath)
}

/**
 * Resolve a path from a decision into an absolute path: `~` expands to home,
 * absolute paths pass through, relative paths try the session cwd, the process
 * cwd, then home (first existing wins; otherwise the first candidate).
 */
export function resolveAbsPath(p: string, baseDir?: string): string {
  const raw = String(p ?? '')
  if (raw === '') return raw
  if (raw.startsWith('~')) return join(homedir(), raw.slice(1))
  if (raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('\\\\')) return raw
  const candidates = [baseDir, process.cwd(), homedir()].filter((b): b is string => typeof b === 'string' && b !== '')
  const seen = new Set<string>()
  for (const b of candidates) {
    const abs = join(b, raw)
    if (seen.has(abs)) continue
    seen.add(abs)
    if (existsSync(abs)) return abs
  }
  return join(candidates[0] ?? process.cwd(), raw)
}

export interface EventSnapshot {
  readonly path: string
  readonly content: string
  readonly ts: string
}

interface SnapshotFile {
  readonly eventId: number
  readonly sessionId: string
  readonly cwd: string
  readonly snapshots: readonly EventSnapshot[]
}

/** Write the pre-change snapshot of every file one event touched. */
export function saveEventSnapshots(
  dir: string,
  eventId: number,
  files: readonly string[],
  baseDir: string | undefined,
  sessionId: string,
  now: () => number = Date.now,
): void {
  if (files.length === 0) return
  const snapshots: EventSnapshot[] = []
  const seen = new Set<string>()
  for (const f of files) {
    if (snapshots.length >= SNAPSHOT_MAX_FILES) break
    const abs = resolveAbsPath(f, baseDir)
    if (abs === '' || seen.has(abs) || isDevicePath(abs)) continue
    seen.add(abs)
    const content = readSnapshotFile(abs)
    // Missing, binary, oversized, or empty content has no diff meaning.
    if (content === null || content === '') continue
    snapshots.push({ path: abs, content, ts: new Date(now()).toISOString() })
  }
  if (snapshots.length === 0) return
  try {
    mkdirSync(dir, { recursive: true })
    const body: SnapshotFile = {
      eventId,
      sessionId: String(sessionId ?? ''),
      cwd: baseDir ?? process.cwd(),
      snapshots,
    }
    writeFileSync(join(dir, `${eventId}.json`), JSON.stringify(body, null, 2), 'utf8')
  } catch {
    // snapshot persistence is best-effort; the event itself is already logged
  }
}

/** Load one event's snapshots ([] when absent or corrupt). */
export function loadEventSnapshots(dir: string, eventId: number): EventSnapshot[] {
  try {
    const data = JSON.parse(readFileSync(join(dir, `${eventId}.json`), 'utf8')) as { snapshots?: unknown }
    return Array.isArray(data.snapshots) ? (data.snapshots as EventSnapshot[]) : []
  } catch {
    return []
  }
}

/** Whether one snapshot file belongs to a session (no sessionId = legacy, never matches a filter). */
function snapshotMatchesSession(absPath: string, sessionId: string): boolean {
  if (sessionId === '') return true
  try {
    const data = JSON.parse(readFileSync(absPath, 'utf8')) as { sessionId?: unknown }
    return String(data.sessionId ?? '') === String(sessionId)
  } catch {
    return false
  }
}

export interface DiffLine {
  readonly type: 'same' | 'add' | 'del'
  readonly aNo?: number
  readonly bNo?: number
  readonly text: string
}

export interface DiffHunk {
  readonly hiddenBefore: number
  readonly lines: readonly DiffLine[]
}

export interface DiffStats {
  readonly added: number
  readonly removed: number
  readonly contextLines: number
}

export interface DiffResult {
  readonly hunks: readonly DiffHunk[]
  readonly stats: DiffStats
  readonly changedLines: readonly DiffLine[]
}

/**
 * Line-level diff with context: a greedy in-order LCS approximation (each `a`
 * line matches the next unused equal `b` line), then change windows of ±`CTX`
 * context lines clustered into hunks. Ported from dsh-approval-gate so both
 * review pages render identical diffs.
 */
export function diffLines(before: string | null | undefined, after: string | null | undefined, contextLines = 5): DiffResult {
  const CTX = Number.isInteger(contextLines) && contextLines >= 0 ? contextLines : 5
  const a = String(before ?? '').split('\n')
  const b = String(after ?? '').split('\n')

  const bPos = new Map<string, number[]>()
  for (let j = 0; j < b.length; j += 1) {
    const list = bPos.get(b[j])
    if (list === undefined) bPos.set(b[j], [j])
    else list.push(j)
  }
  const aMatch = new Array<number>(a.length).fill(-1)
  const bUsed = new Array<boolean>(b.length).fill(false)
  let limit = 0
  for (let i = 0; i < a.length; i += 1) {
    const q = bPos.get(a[i])
    if (q === undefined) continue
    for (const pos of q) {
      if (pos >= limit && !bUsed[pos]) {
        aMatch[i] = pos
        bUsed[pos] = true
        limit = pos + 1
        break
      }
    }
  }

  const ops: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && aMatch[i] >= 0) {
      const target = aMatch[i]
      while (j < target) {
        ops.push({ type: 'add', bNo: j + 1, text: b[j] })
        j += 1
      }
      ops.push({ type: 'same', aNo: i + 1, bNo: target + 1, text: a[i] })
      j = target + 1
      i += 1
    } else if (i < a.length) {
      ops.push({ type: 'del', aNo: i + 1, text: a[i] })
      i += 1
    } else {
      ops.push({ type: 'add', bNo: j + 1, text: b[j] })
      j += 1
    }
  }

  const show = new Array<boolean>(ops.length).fill(false)
  for (let idx = 0; idx < ops.length; idx += 1) {
    if (ops[idx].type === 'same') continue
    for (let k = Math.max(0, idx - CTX); k <= Math.min(ops.length - 1, idx + CTX); k += 1) show[k] = true
  }

  const hunks: DiffHunk[] = []
  let hiddenBefore = 0
  let pending: DiffLine[] = []
  let started = false
  for (let idx = 0; idx < ops.length; idx += 1) {
    if (show[idx]) {
      started = true
      pending.push(ops[idx])
    } else {
      if (started && pending.length > 0) {
        hunks.push({ hiddenBefore, lines: pending })
        pending = []
        started = false
      }
      hiddenBefore += 1
    }
  }
  if (pending.length > 0 && started) hunks.push({ hiddenBefore, lines: pending })
  if (hunks.length > 0) hunks[0] = { hiddenBefore: 0, lines: hunks[0].lines }

  const added = ops.filter((o) => o.type === 'add').length
  const removed = ops.filter((o) => o.type === 'del').length
  return {
    hunks,
    stats: { added, removed, contextLines: Math.max(a.length, b.length) - (added + removed) },
    changedLines: ops.filter((o) => o.type !== 'same').slice(0, 500),
  }
}

export class EventLog {
  private seq = -1 // lazily restored from the file on first append

  constructor(
    /** JSONL path; `undefined` disables event recording entirely. */
    private readonly filePath: string | undefined,
    private readonly now: () => number = Date.now,
    /** Snapshot directory; `undefined` disables diff/revert support. */
    private readonly snapshotsDir: string | undefined = undefined,
  ) {}

  /** Append one event; returns it, or undefined when recording is disabled/failed. */
  append(input: GateEventInput): GateEvent | undefined {
    if (this.filePath === undefined) return undefined
    try {
      const id = this.nextId()
      const files = input.files === undefined || input.files.length === 0
        ? undefined
        : input.files.slice(0, FILES_MAX)
      const ev: GateEvent = {
        id,
        ts: new Date(this.now()).toISOString(),
        sessionId: input.sessionId ?? '',
        tool: input.tool,
        kind: input.kind,
        ...(input.risk === undefined ? {} : { risk: input.risk }),
        reason: String(input.reason).slice(0, REASON_MAX),
        ...(input.verdict === undefined ? {} : { verdict: input.verdict }),
        ...(input.justification === undefined ? {} : { justification: String(input.justification).slice(0, JUSTIFICATION_MAX) }),
        ...(input.mode === undefined ? {} : { mode: input.mode }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(files === undefined ? {} : { files }),
        ...(input.learningCount === undefined ? {} : { learningCount: input.learningCount }),
        ...(input.threshold === undefined ? {} : { threshold: input.threshold }),
      }
      mkdirSync(dirname(this.filePath), { recursive: true })
      appendFileSync(this.filePath, JSON.stringify(ev) + '\n', 'utf8')
      // `auto`/`ask` are both "before the change lands" moments (an approved ask
      // executes right after): snapshot the files so the review page can diff
      // and revert them later.
      if ((ev.kind === 'auto' || ev.kind === 'ask') && this.snapshotsDir !== undefined && files !== undefined) {
        saveEventSnapshots(this.snapshotsDir, ev.id, files, input.baseDir, ev.sessionId, this.now)
      }
      return ev
    } catch {
      return undefined // best-effort only
    }
  }

  /** Events with `id > since`, optionally filtered to one session. */
  query({ sessionId, since }: { sessionId?: string; since?: number } = {}): GateEvent[] {
    if (this.filePath === undefined) return []
    let text: string
    try {
      text = readFileSync(this.filePath, 'utf8')
    } catch {
      return [] // no events yet
    }
    const out: GateEvent[] = []
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      try {
        const ev = JSON.parse(line) as GateEvent
        if (typeof ev.id !== 'number') continue
        if (since !== undefined && ev.id <= since) continue
        if (sessionId !== undefined && sessionId !== '' && ev.sessionId !== sessionId) continue
        out.push(ev)
      } catch {
        // corrupted line: skip
      }
    }
    return out
  }

  /** One event by id (undefined when absent). */
  byId(id: number): GateEvent | undefined {
    return this.query().find((ev) => ev.id === id)
  }

  private nextId(): number {
    if (this.seq < 0) {
      this.seq = 0
      for (const ev of this.query()) {
        if (ev.id > this.seq) this.seq = ev.id
      }
    }
    this.seq += 1
    return this.seq
  }
}

/**
 * The minimal face of the DSH `webServer` service this plugin uses
 * (typed locally — never value-imported; provided by the dsh runtime).
 */
export interface WebServerLike {
  register(route: { kind: 'exact'; path: string; handler: (req: unknown, res: unknown) => unknown }): () => void
}

/** Minimal request/response faces for the route handlers. */
interface RouteReq {
  method?: string
  url?: string
  on?: (event: string, cb: (chunk?: unknown) => void) => unknown
}
interface RouteRes {
  writeHead: (code: number, headers?: Record<string, string>) => unknown
  end: (body?: string) => unknown
}

function routeServer(server: unknown): WebServerLike | undefined {
  if (typeof server !== 'object' || server === null) return undefined
  const candidate = server as { register?: WebServerLike['register'] }
  return typeof candidate.register === 'function' ? (server as WebServerLike) : undefined
}

function json(res: RouteRes, code: number, body: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
  res.end(JSON.stringify(body))
}

function readBody(req: RouteReq, limit = 1024 * 1024): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on?.('data', (chunk) => {
      body += String(chunk)
      if (body.length > limit) reject(new Error('payload too large'))
    })
    req.on?.('error', (err) => reject(err instanceof Error ? err : new Error(String(err))))
    req.on?.('end', () => {
      try {
        resolve(body === '' ? {} : (JSON.parse(body) as Record<string, unknown>))
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  })
}

export const EVENTS_ROUTE = '/api/dsh-perm-gate/events'
export const LEARNING_ROUTE = '/api/dsh-perm-gate/learning'
export const HEALTH_ROUTE = '/api/dsh-perm-gate/health'
export const RECEIVER_ROUTE = '/api/dsh-perm-gate/receiver'
export const DIFF_ROUTE = '/api/dsh-perm-gate/diff'
export const REVERT_ROUTE = '/api/dsh-perm-gate/revert'
export const SNAPSHOTS_STATS_ROUTE = '/api/dsh-perm-gate/snapshots-stats'
export const SNAPSHOTS_CLEAR_ROUTE = '/api/dsh-perm-gate/snapshots-clear'

/**
 * Register `GET /api/dsh-perm-gate/events?sessionId=&since=` on the webServer
 * service. Returns whether the route was registered (false when the service is
 * unavailable — the host keeps running, only the HTTP API is missing).
 */
export function registerEventsRoute(server: unknown, log: EventLog): (() => void) | undefined {
  const ws = routeServer(server)
  if (ws === undefined) return undefined
  return ws.register({
    kind: 'exact',
    path: EVENTS_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      let sessionId: string | undefined
      let since: number | undefined
      try {
        const url = new URL(req.url ?? '/', 'http://localhost')
        sessionId = url.searchParams.get('sessionId') ?? undefined
        const raw = url.searchParams.get('since')
        if (raw !== null && raw !== '') since = Number.parseInt(raw, 10) || 0
      } catch {
        // unparseable URL: answer with the unfiltered tail
      }
      json(res, 200, { events: log.query({ sessionId, since }) })
    },
  })
}

/** Delivers a revert instruction into the conversation (see index.ts wiring). */
export type SessionSender = (sessionId: string, content: string) => Promise<{ ok: boolean; via?: string; error?: string }>

/**
 * Register the review-page routes:
 * `GET  /diff?eventId=&path=`        → before/after line diff for one file
 * `POST /revert`                     → deliver a revert instruction into the session
 * `GET  /snapshots-stats?sessionId=` → snapshot count/bytes/ids/file map
 * `POST /snapshots-clear`            → drop snapshots (session-scoped or all)
 */
export function registerReviewRoutes(
  server: unknown,
  deps: { log: EventLog; snapshotsDir: string | undefined; send: SessionSender; audit?: (line: string) => void },
): (() => void)[] {
  const ws = routeServer(server)
  if (ws === undefined) return []
  const { log, snapshotsDir, send, audit } = deps
  const offs: (() => void)[] = []

  offs.push(ws.register({
    kind: 'exact',
    path: DIFF_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      try {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          json(res, 405, { ok: false, error: 'method not allowed' })
          return
        }
        if (snapshotsDir === undefined) {
          json(res, 404, { ok: false, error: '快照目录未配置' })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const eventId = Number.parseInt(url.searchParams.get('eventId') ?? '', 10)
        const path = url.searchParams.get('path') ?? ''
        if (!Number.isInteger(eventId) || path === '') {
          json(res, 400, { ok: false, error: 'eventId/path 必填' })
          return
        }
        const snaps = loadEventSnapshots(snapshotsDir, eventId)
        // The client sends the raw path recorded on the event (absolute,
        // relative, or a bare name): align it against the snapshot's absolute
        // path, falling back to a suffix/basename match.
        const base = resolveAbsPath(path)
        const baseName = path.split(/[\\/]/).pop() ?? ''
        const snap = snaps.find((s) => s.path === base || s.path === path)
          ?? snaps.find((s) => s.path.endsWith('/' + path)
            || (baseName !== '' && (s.path.endsWith('/' + baseName) || s.path.endsWith('\\' + baseName))))
        if (snap === undefined) {
          json(res, 404, { ok: false, error: '该事件没有此文件的快照' })
          return
        }
        const after = readSnapshotFile(snap.path)
        const result = diffLines(snap.content, after)
        json(res, 200, {
          ok: true,
          path,
          eventId,
          beforeExists: true,
          afterExists: after !== null,
          changedLines: result.changedLines,
          hunks: result.hunks,
          stats: result.stats,
        })
      } catch (e) {
        json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) })
      }
    },
  }))

  offs.push(ws.register({
    kind: 'exact',
    path: REVERT_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      void (async () => {
        try {
          const body = await readBody(req)
          const sessionId = String(body.sessionId ?? '')
          const eventId = Number.parseInt(String(body.eventId ?? ''), 10)
          if (sessionId === '' || !Number.isInteger(eventId)) {
            json(res, 400, { ok: false, error: 'sessionId/eventId 必填' })
            return
          }
          const event = log.byId(eventId)
          if (event === undefined) {
            json(res, 404, { ok: false, error: '未找到该事件' })
            return
          }
          const files = (event.files ?? []).map((f) => '`' + f + '`').join('、')
          const snaps = snapshotsDir === undefined ? [] : loadEventSnapshots(snapshotsDir, eventId)
          const snapHint = snaps.length > 0
            ? '改动前的文件内容快照保存在 ' + snapshotsDir + '（按事件 ID 命名），可参考恢复；请确认改动内容后执行撤销。'
            : '注意：该事件已无可用快照（可能已被清除），请基于当前文件内容判断如何恢复原状；无法确定时请先说明再操作。'
          const content = '请撤销以下自动放行操作带来的文件改动（恢复为审批前的状态）：\n'
            + '- 操作：' + (event.justification ?? event.reason ?? '(无说明)') + '\n'
            + '- 涉及文件：' + (files !== '' ? files : '(未知)') + '\n'
            + '- 判定：' + (event.verdict ?? event.kind) + '（自动放行）\n'
            + '- 事件时间：' + event.ts + '\n'
            + snapHint
          const result = await send(sessionId, content)
          audit?.(`REVERT  event=${eventId} session=${sessionId} via=${result.via ?? 'none'}`)
          json(res, result.ok ? 200 : 500, result)
        } catch (e) {
          json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) })
        }
      })()
    },
  }))

  offs.push(ws.register({
    kind: 'exact',
    path: SNAPSHOTS_STATS_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      try {
        if (snapshotsDir === undefined) {
          json(res, 200, { ok: true, count: 0, bytes: 0, ids: [], files: {}, sessionId: null })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        const filterSession = url.searchParams.get('sessionId') ?? ''
        let count = 0
        let bytes = 0
        const ids: string[] = []
        const files: Record<string, string[]> = {}
        for (const name of readdirSafe(snapshotsDir)) {
          if (!name.endsWith('.json')) continue
          const abs = join(snapshotsDir, name)
          if (filterSession !== '' && !snapshotMatchesSession(abs, filterSession)) continue
          const id = name.slice(0, -'.json'.length)
          count += 1
          ids.push(id)
          bytes += statSize(abs)
          try {
            const data = JSON.parse(readFileSync(abs, 'utf8')) as { snapshots?: { path?: unknown }[] }
            if (Array.isArray(data.snapshots)) {
              files[id] = data.snapshots.map((s) => String(s?.path ?? '')).filter((p) => p !== '')
            }
          } catch {
            // corrupt snapshot file: still counted, no file map
          }
        }
        json(res, 200, { ok: true, count, bytes, ids, files, sessionId: filterSession !== '' ? filterSession : null })
      } catch (e) {
        json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) })
      }
    },
  }))

  offs.push(ws.register({
    kind: 'exact',
    path: SNAPSHOTS_CLEAR_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      void (async () => {
        try {
          const body = await readBody(req)
          const filterSession = String(body.sessionId ?? '')
          let removed = 0
          if (snapshotsDir !== undefined) {
            for (const name of readdirSafe(snapshotsDir)) {
              if (!name.endsWith('.json')) continue
              const abs = join(snapshotsDir, name)
              if (filterSession !== '' && !snapshotMatchesSession(abs, filterSession)) continue
              try {
                rmSync(abs, { force: true })
                removed += 1
              } catch {
                // skip unremovable entry
              }
            }
          }
          audit?.(`CONFIG  snapshots-clear session=${filterSession !== '' ? filterSession : '*'} removed=${removed}`)
          json(res, 200, { ok: true, removed, sessionId: filterSession !== '' ? filterSession : null })
        } catch (e) {
          json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) })
        }
      })()
    },
  }))

  return offs
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function statSize(absPath: string): number {
  try {
    return statSync(absPath).size
  } catch {
    return 0
  }
}

/**
 * Register `GET /api/dsh-perm-gate/receiver` — the receiver projection for the
 * settings card: the effective provider/model plus (host mode) the live
 * provider/model-group catalog from the DSH `llm` service.
 */
export function registerReceiverRoute(server: unknown, provider: { info(): Promise<unknown> }): (() => void) | undefined {
  const ws = routeServer(server)
  if (ws === undefined) return undefined
  return ws.register({
    kind: 'exact',
    path: RECEIVER_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      provider.info().then(
        (info) => json(res, 200, { ok: true, ...(info as object) }),
        (e: unknown) => json(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }),
      )
    },
  })
}

/**
 * Register `POST /api/dsh-perm-gate/health` — runs one minimal completion
 * through the currently configured llmAssist receiver and returns
 * `{ ok, ms, detail }` (the settings card's health test).
 */
export function registerHealthRoute(server: unknown, provider: { check(): Promise<{ ok: boolean; ms: number; detail: string }> }): (() => void) | undefined {
  const ws = routeServer(server)
  if (ws === undefined) return undefined
  return ws.register({
    kind: 'exact',
    path: HEALTH_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      provider.check().then(
        (result) => json(res, 200, { ...result, ok: true }),
        (e: unknown) => json(res, 500, { ok: false, error: String((e as Error)?.message ?? e) }),
      )
    },
  })
}

/** The learning-store face the settings UI's sediment view needs. */
export interface LearningRouteProvider {
  snapshot(): unknown
  threshold(): number
  reset(key: string, fp?: string): void
}

/**
 * Register the learning-store routes on the webServer service:
 * `GET  /api/dsh-perm-gate/learning` → the store snapshot + live threshold,
 * `POST /api/dsh-perm-gate/learning` → `{ key, fp? }` terminates one key's
 * learning or drops one sedimented sample. Returns whether registered.
 */
export function registerLearningRoute(server: unknown, provider: LearningRouteProvider): (() => void) | undefined {
  const ws = routeServer(server)
  if (ws === undefined) return undefined
  return ws.register({
    kind: 'exact',
    path: LEARNING_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method === 'GET' || req.method === 'HEAD') {
        json(res, 200, { ok: true, threshold: provider.threshold(), ...(provider.snapshot() as object) })
        return
      }
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      void (async () => {
        try {
          const parsed = await readBody(req)
          if (typeof parsed.key !== 'string' || parsed.key === '') {
            json(res, 400, { ok: false, error: 'missing key' })
            return
          }
          provider.reset(parsed.key, typeof parsed.fp === 'string' && parsed.fp !== '' ? parsed.fp : undefined)
          json(res, 200, { ok: true })
        } catch (e) {
          json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) })
        }
      })()
    },
  })
}
