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
  readonly key: string
  readonly fp: string
  readonly ctx: string
  readonly at: number
}

export interface RiskLearningOptions {
  /** Confirmations required before an exact-sample re-run may auto-allow. A getter reads the live setting. Default 3. */
  readonly threshold?: number | (() => number)
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

  /** Human confirmations recorded so far for one key. */
  count(key: string): number {
    return this.load().confirmed[key] ?? 0
  }

  /** Whether one key already holds a confirmed sample with this fingerprint. */
  hasSample(key: string, fp: string): boolean {
    return this.load().samples[key]?.some((s) => s.fp === fp) ?? false
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
    doc.confirmed[key] = (doc.confirmed[key] ?? 0) + 1
    const max = this.options.maxSamples ?? DEFAULT_MAX_SAMPLES
    const list = (doc.samples[key] ?? []).filter((s) => s.fp !== fp)
    list.push({ fp, ctx: ctx.slice(0, 200), at: (this.options.now ?? Date.now)() })
    doc.samples[key] = list.slice(-max)
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
    const out: SedimentEntry[] = []
    for (const [key, count] of Object.entries(doc.confirmed)) {
      if (count < this.threshold) continue
      for (const s of doc.samples[key] ?? []) out.push({ key, fp: s.fp, ctx: s.ctx, at: s.at })
    }
    return out
  }

  /** Remove one sedimented sample (its fingerprint no longer auto-allows). */
  dropSample(key: string, fp: string): void {
    const doc = this.load()
    const list = doc.samples[key]
    if (list === undefined) return
    const next = list.filter((s) => s.fp !== fp)
    if (next.length === list.length) return
    if (next.length === 0) delete doc.samples[key]
    else doc.samples[key] = next
    this.persist()
  }

  /** Terminate learning for one key: drop its confirmation count and samples. */
  resetKey(key: string): void {
    const doc = this.load()
    if (doc.confirmed[key] === undefined && doc.samples[key] === undefined) return
    delete doc.confirmed[key]
    delete doc.samples[key]
    this.persist()
  }

  /** Read-only deep view (for tests and diagnostics). */
  snapshot(): LearningDoc {
    const doc = this.load()
    return JSON.parse(JSON.stringify(doc)) as LearningDoc
  }
}
