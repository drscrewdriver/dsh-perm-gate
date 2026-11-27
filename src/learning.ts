/**
 * Verdict learning for dsh-perm-gate's `llmAssist` strategy.
 *
 * When the risk grader reports a `neutral` risk and the call goes to the human
 * seam, a confirmation is learned once the call actually executes (observed via
 * the host's `tools/result` settlement). After `threshold` confirmations of the
 * same `tool|category` key AND a fingerprint match against a previously
 * confirmed sample, the gate may auto-allow the same operation — and only that
 * operation, never a wider class.
 *
 * State persists as a plugin-owned JSON file. The user's YAML rules file is the
 * deterministic, human-owned layer and is never written here; all I/O errors
 * degrade to in-memory state so learning can never break gating (worst case
 * the gate simply keeps asking — still fail-closed).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
// Single source of truth for the shell-tool roster: `evaluate.ts` owns it, so a
// newly supported tool name cannot drift between the decision path and the
// learning fingerprint (which is what hid the missing `shell` entry).
import { SHELL_TOOLS } from './evaluate.js'

/** One confirmed operation sample: fingerprint plus a short human-readable context. */
export interface LearningSample {
  readonly fp: string
  readonly ctx: string
  readonly at: number
}

/** The persisted document shape (version 1). */
export interface LearningDoc {
  version: 1
  /** key (`tool|category`) → human confirmation count. */
  confirmed: Record<string, number>
  /** key → the most recent confirmed samples (bounded). */
  samples: Record<string, LearningSample[]>
}

/** One sedimented rule view: a threshold-reached key's confirmed sample. */
export interface SedimentEntry {
  /** The stored key, namespace included. */
  readonly key: string
  readonly fp: string
  readonly ctx: string
  readonly at: number
  /** Which namespace the rule lives in. */
  readonly scope: LearningScope
  /** The session that farmed it, for a `session` entry. */
  readonly sessionId?: string
  /**
   * In `session` scope a `global|` rule is NOT in force (that is the whole
   * point of isolation). It is reported here with `promoted: false` so the
   * settings face can offer the explicit promotion instead of silently
   * dropping a rule the user once confirmed.
   */
  readonly promoted: boolean
}

/** Which namespace a confirmation lands in. */
export type LearningScope = 'global' | 'session'

/**
 * The namespaced key shapes. The single-file store never mattered as much as
 * the KEY SPACE did: every session wrote the same `tool|fp` key, so a session
 * that confirmed an operation twice lowered the bar for every other session -
 * a rule could be "farmed" into existence for sessions that never saw it.
 *
 * The fix is key-level, not file-level: the file stays one `version: 1` doc and
 * needs no migration, because a key with no prefix is read as `global|`
 * (see {@link normalizeKey}). `global|` keeps today's meaning and stays the
 * default; `session:<id>|` is the isolated form.
 */
export const GLOBAL_PREFIX = 'global|'
export const SESSION_PREFIX = 'session:'

/** Prefix a bare `tool|fp` key with the global namespace (idempotent). */
export function normalizeKey(key: string): string {
  return key.startsWith(GLOBAL_PREFIX) || key.startsWith(SESSION_PREFIX) ? key : GLOBAL_PREFIX + key
}

/** Build the session-scoped key for one call. */
export function sessionKey(sessionId: string, key: string): string {
  const bare = normalizeKey(key).slice(GLOBAL_PREFIX.length)
  return `${SESSION_PREFIX}${sessionId}|${bare}`
}

/** Split a stored key back into its namespace and the bare `tool|fp` part. */
export function parseKey(key: string): { scope: LearningScope; sessionId?: string; bare: string } {
  if (key.startsWith(SESSION_PREFIX)) {
    const rest = key.slice(SESSION_PREFIX.length)
    const cut = rest.indexOf('|')
    if (cut === -1) return { scope: 'session', sessionId: rest, bare: '' }
    return { scope: 'session', sessionId: rest.slice(0, cut), bare: rest.slice(cut + 1) }
  }
  if (key.startsWith(GLOBAL_PREFIX)) return { scope: 'global', bare: key.slice(GLOBAL_PREFIX.length) }
  return { scope: 'global', bare: key }
}

export interface RiskLearningOptions {
  /** Confirmations required before an exact-sample re-run may auto-allow. A getter reads the live setting. Default 3. */
  readonly threshold?: number | (() => number)
  /**
   * Where confirmations land. `global` (default) keeps the historical
   * cross-session behaviour; `session` isolates every session and stops a
   * `global|` entry from auto-allowing anything until it is promoted on
   * purpose. A getter keeps the setting hot, like `threshold`.
   */
  readonly scope?: LearningScope | (() => LearningScope)
  /** The session the caller acts for (required for `session` scope to do anything). */
  readonly sessionId?: string | (() => string | undefined)
  /** Samples retained per key (oldest evicted). Default 10. */
  readonly maxSamples?: number
  readonly now?: () => number
}

const DEFAULT_THRESHOLD = 3
const DEFAULT_MAX_SAMPLES = 10

/** Structured arg keys carrying the operation target. */
const TARGET_KEYS = ['file_path', 'filePath', 'path', 'file', 'filename', 'target', 'url']

function basename(p: string): string {
  const s = p.replaceAll('\\', '/')
  const base = s.slice(s.lastIndexOf('/') + 1).trim()
  return base
}

/**
 * Derive a stable, precise operation fingerprint from structured arguments:
 * shell calls → `word|target-basename`; file-arg tools → the target basename;
 * everything else → the tool name alone. Two calls share a fingerprint only
 * when they perform the same kind of write against the same-named target.
 */
export function operationFingerprint(tool: string, args: Record<string, unknown>, commandText?: string): string {
  const command = typeof args.command === 'string'
    ? args.command
    : (SHELL_TOOLS.has(tool) && typeof commandText === 'string' ? commandText : undefined)
  if (command !== undefined) {
    const word = command.trim().split(/\s+/)[0] ?? ''
    // Target position convention: the last non-flag token (`npm install foo`,
    // `rm -rf dist`, `git push origin main` → main). Nothing target-like → word only.
    let target = ''
    const tokens = command.split(/\s+/)
    for (let i = tokens.length - 1; i >= 1; i -= 1) {
      const token = tokens[i]
      if (token.startsWith('-') || token.length < 2) continue
      target = basename(token)
      if (target !== '') break
    }
    return target !== '' ? `${word}|${target}` : word
  }
  for (const key of TARGET_KEYS) {
    const v = args[key]
    if (typeof v === 'string' && v.trim() !== '') {
      const base = basename(v)
      if (base !== '') return base
    }
  }
  return tool
}

/** The learning key for one call: `tool|fingerprint` (fingerprint-level learning). */
export function learnKey(tool: string, _category: string, fp?: string): string {
  return fp !== undefined ? `${tool}|${fp}` : `${tool}|${_category}`
}

function emptyDoc(): LearningDoc {
  return { version: 1, confirmed: {}, samples: {} }
}

function sanitizeDoc(raw: unknown): LearningDoc {
  if (typeof raw !== 'object' || raw === null) return emptyDoc()
  const doc = emptyDoc()
  const confirmed = (raw as Record<string, unknown>)['confirmed']
  if (typeof confirmed === 'object' && confirmed !== null) {
    for (const [k, v] of Object.entries(confirmed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) doc.confirmed[k] = Math.floor(v)
    }
  }
  const samples = (raw as Record<string, unknown>)['samples']
  if (typeof samples === 'object' && samples !== null) {
    for (const [k, v] of Object.entries(samples)) {
      if (!Array.isArray(v)) continue
      const list: LearningSample[] = []
      for (const s of v) {
        if (typeof s !== 'object' || s === null) continue
        const fp = (s as Record<string, unknown>)['fp']
        if (typeof fp !== 'string' || fp === '') continue
        const ctx = typeof (s as Record<string, unknown>)['ctx'] === 'string' ? (s as Record<string, unknown>)['ctx'] as string : ''
        const at = typeof (s as Record<string, unknown>)['at'] === 'number' ? (s as Record<string, unknown>)['at'] as number : 0
        list.push({ fp, ctx: ctx.slice(0, 200), at })
      }
      if (list.length > 0) doc.samples[k] = list
    }
  }
  return doc
}

export class RiskLearning {
  private doc: LearningDoc = emptyDoc()
  private loaded = false

  constructor(
    /** Persistence path; `undefined` keeps state in memory only. */
    private readonly filePath: string | undefined,
    private readonly options: RiskLearningOptions = {},
  ) {}

  private get threshold(): number {
    const t = this.options.threshold
    return (typeof t === 'function' ? t() : t) ?? DEFAULT_THRESHOLD
  }

  /** The scope in force right now (a getter keeps the setting hot). */
  get scope(): LearningScope {
    const s = this.options.scope
    return (typeof s === 'function' ? s() : s) ?? 'global'
  }

  /** The session this instance acts for, if it knows one. */
  get sessionId(): string | undefined {
    const s = this.options.sessionId
    const id = typeof s === 'function' ? s() : s
    return id === undefined || id === '' ? undefined : id
  }

  /**
   * The key a confirmation is WRITTEN to under the current scope. With no
   * session id the scoped form is impossible, so it stays global — writing a
   * `session:|…` key with an empty id would create a shared bucket that looks
   * isolated, which is worse than the global default.
   */
  private writeKey(key: string): string {
    const id = this.sessionId
    if (this.scope === 'session' && id !== undefined) return sessionKey(id, key)
    // Global writes keep the historical BARE spelling on purpose: the on-disk
    // document stays byte-identical for every existing user, so enabling the
    // scope switch needs no migration and disabling it loses nothing.
    return key.startsWith(GLOBAL_PREFIX) || key.startsWith(SESSION_PREFIX) ? key : key
  }

  /**
   * The keys a decision READS. In `session` scope the session's own namespace
   * is the only one consulted: a `global|` entry that some other session
   * farmed must not auto-allow here. In `global` scope the historical
   * behaviour is preserved (global first, then this session's own entries).
   */
  private readKeys(key: string): string[] {
    const bare = key.startsWith(GLOBAL_PREFIX) ? key.slice(GLOBAL_PREFIX.length) : key
    const global = [bare, normalizeKey(bare)]
    if (this.scope === 'session') {
      const id = this.sessionId
      // Isolation: ONLY this session's namespace is consulted, so a global rule
      // another session farmed cannot auto-allow here.
      return id === undefined ? [bare] : [sessionKey(id, bare)]
    }
    const id = this.sessionId
    return id === undefined ? global : [...global, sessionKey(id, bare)]
  }

  private load(): LearningDoc {
    if (!this.loaded) {
      this.loaded = true
      if (this.filePath !== undefined) {
        try {
          this.doc = sanitizeDoc(JSON.parse(readFileSync(this.filePath, 'utf8')))
        } catch {
          this.doc = emptyDoc() // missing/corrupt file: start clean, never throw
        }
      }
    }
    return this.doc
  }

  private persist(): void {
    if (this.filePath === undefined) return
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.doc, null, 2) + '\n', 'utf8')
    } catch {
      // Unwritable location: keep the in-memory state; learning silently degrades.
    }
  }

  /** Human confirmations recorded so far for one key (scope-aware). */
  count(key: string): number {
    const doc = this.load()
    return this.readKeys(key).reduce((sum, k) => sum + (doc.confirmed[k] ?? 0), 0)
  }

  /** Whether one key already holds a confirmed sample with this fingerprint. */
  hasSample(key: string, fp: string): boolean {
    const doc = this.load()
    return this.readKeys(key).some((k) => doc.samples[k]?.some((s) => s.fp === fp) ?? false)
  }

  /**
   * The learning gate: auto-allow only when the key reached the threshold AND
   * this exact fingerprint was among the human-confirmed samples.
   */
  shouldAutoAllow(key: string, fp: string): boolean {
    return this.count(key) >= this.threshold && this.hasSample(key, fp)
  }

  /** Record one human confirmation: bump the count and store the sample (bounded). */
  confirm(key: string, fp: string, ctx: string): void {
    const doc = this.load()
    const target = this.writeKey(key)
    doc.confirmed[target] = (doc.confirmed[target] ?? 0) + 1
    const max = this.options.maxSamples ?? DEFAULT_MAX_SAMPLES
    const list = (doc.samples[target] ?? []).filter((s) => s.fp !== fp)
    list.push({ fp, ctx: ctx.slice(0, 200), at: (this.options.now ?? Date.now)() })
    doc.samples[target] = list.slice(-max)
    this.persist()
  }

  /** Drop all learning state (counts and samples) and persist the empty doc. */
  reset(): void {
    this.doc = emptyDoc()
    this.loaded = true
    this.persist()
  }

  /**
   * The sedimented-rule view: every confirmed sample of a key whose count
   * reached the threshold. These are the deterministic auto-allow rules —
   * derived from the store, so no extra persistence is needed.
   */
  sedimented(): SedimentEntry[] {
    const doc = this.load()
    const isolated = this.scope === 'session'
    const out: SedimentEntry[] = []
    for (const [key, count] of Object.entries(doc.confirmed)) {
      if (count < this.threshold) continue
      const parsed = parseKey(key)
      const inForce = !isolated || parsed.scope === 'session'
      for (const s of doc.samples[key] ?? []) {
        out.push({
          key,
          fp: s.fp,
          ctx: s.ctx,
          at: s.at,
          scope: parsed.scope,
          ...(parsed.sessionId !== undefined ? { sessionId: parsed.sessionId } : {}),
          promoted: inForce,
        })
      }
    }
    return out
  }

  /**
   * Promote one session-scoped rule into the global namespace. Explicit only:
   * promotion is a human decision, and doing it automatically is exactly the
   * "farm a rule across sessions" behaviour this store was fixed to stop.
   * The original entry is kept, so the session keeps its own record.
   */
  promoteToGlobal(key: string, fp: string): void {
    const doc = this.load()
    const parsed = parseKey(key)
    const sourceKey = parsed.scope === 'session' ? key : normalizeKey(key)
    const sample = doc.samples[sourceKey]?.find((s) => s.fp === fp)
    if (sample === undefined) return
    const target = GLOBAL_PREFIX + parsed.bare
    doc.confirmed[target] = Math.max(doc.confirmed[target] ?? 0, doc.confirmed[sourceKey] ?? 0)
    const max = this.options.maxSamples ?? DEFAULT_MAX_SAMPLES
    const list = (doc.samples[target] ?? []).filter((s) => s.fp !== fp)
    list.push(sample)
    doc.samples[target] = list.slice(-max)
    this.persist()
  }

  /** Session-scoped rules that are waiting for an explicit promotion. */
  pendingPromotions(): SedimentEntry[] {
    if (this.scope !== 'session') return []
    return this.sedimented().filter((e) => e.scope === 'session' && e.promoted)
  }

  /** Remove one sedimented sample (its fingerprint no longer auto-allows). */
  dropSample(key: string, fp: string): void {
    const doc = this.load()
    // Accept a bare key (what the UI holds) and a namespaced one alike.
    const candidates = key.startsWith(GLOBAL_PREFIX) || key.startsWith(SESSION_PREFIX)
      ? [key]
      : [key, normalizeKey(key), ...(this.sessionId !== undefined ? [sessionKey(this.sessionId, key)] : [])]
    for (const candidate of candidates) {
      const list = doc.samples[candidate]
      if (list === undefined) continue
      const next = list.filter((s) => s.fp !== fp)
      if (next.length === 0) delete doc.samples[candidate]
      else doc.samples[candidate] = next
    }
    this.persist()
  }

  /** Terminate learning for one key: drop its confirmation count and samples. */
  resetKey(key: string): void {
    const doc = this.load()
    // The store holds namespaced keys, while callers may hold either the bare
    // key or the exact stored one; clear every spelling of this rule.
    const candidates = key.startsWith(GLOBAL_PREFIX) || key.startsWith(SESSION_PREFIX)
      ? [key]
      : [key, normalizeKey(key), ...Object.keys(doc.confirmed).filter((k) => parseKey(k).bare === key)]
    let touched = false
    for (const candidate of candidates) {
      if (doc.confirmed[candidate] === undefined && doc.samples[candidate] === undefined) continue
      delete doc.confirmed[candidate]
      delete doc.samples[candidate]
      touched = true
    }
    if (touched) this.persist()
  }

  /** Read-only deep view (for tests and diagnostics). */
  snapshot(): LearningDoc {
    const doc = this.load()
    return JSON.parse(JSON.stringify(doc)) as LearningDoc
  }
}
