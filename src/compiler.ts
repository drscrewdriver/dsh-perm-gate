/**
 * Pattern compilation for dsh-perm-gate.
 *
 * Turns glob (and literal) patterns into anchored RegExps with a hard bound
 * on the number of unbounded `*` quantifiers (ReDoS degree). Every function
 * here is pure — no filesystem/clock/process state — so the compiler and its
 * failure modes are unit-testable and replayable.
 */
import { createHash } from 'node:crypto'

/** A checkable pattern already compiled to a RegExp. */
export interface CompiledPattern {
  readonly source: string
  readonly re: RegExp
}

/** Raised at load time when a pattern cannot be compiled safely. */
export class PatternError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatternError'
  }
}

/** No-reconstruction bound: at most one unbounded `*` run per pattern. */
export const DEFAULT_MAX_STARS = 2

/**
 * Compile a simple glob into an anchored RegExp.
 *
 * - `*` matches any characters; when `segments` is true it stops at a path
 *   separator `/`.
 * - `?` matches one char (not a separator when `segments`).
 * - `[...]` char classes are preserved.
 * - Consecutive unbounded `*` are collapsed into one; a pattern whose star-run
 *   count exceeds `maxStars` is rejected (ReDoS degree bound), never silently
 *   bounded to a partial match.
 */
export function compileGlob(pattern: string, options: { segments?: boolean; maxStars?: number } = {}): CompiledPattern {
  const { segments = false, maxStars = DEFAULT_MAX_STARS } = options
  if (pattern === '') return { source: pattern, re: /^$/u }

  // Collapse: keep each star (so run length survives), counting star-RUNS and
  // rejecting patterns whose unbounded-run count exceeds maxStars.
  const tokens: string[] = []
  let starRuns = 0
  let inClass = false
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]
    if (ch === '[' && !inClass) {
      inClass = true
      tokens.push(ch)
      continue
    }
    if (inClass) {
      tokens.push(ch)
      if (ch === ']') inClass = false
      continue
    }
    if (ch === '*') {
      if (tokens.length === 0 || tokens[tokens.length - 1] !== '*') {
        starRuns += 1
        if (starRuns > maxStars) {
          throw new PatternError(`pattern "${pattern}" exceeds maxStars=${maxStars} unbounded glob stars`)
        }
      }
      tokens.push('*')
    } else {
      tokens.push(ch)
    }
  }

  let out = ''
  let i = 0
  const n = tokens.length
  while (i < n) {
    const ch = tokens[i]
    if (ch === '*') {
      let run = 1
      while (tokens[i + run] === '*') run += 1
      if (segments) out += run >= 2 ? '.*' : '[^/]*'
      else out += '.*'
      i += run
    } else if (ch === '?') {
      out += segments ? '[^/]' : '.'
      i += 1
    } else if (ch === '[') {
      let j = i + 1
      let body = ''
      if (tokens[j] === '!' || tokens[j] === '^') {
        body += '^'
        j += 1
      }
      let closed = false
      while (j < n) {
        const c = tokens[j]
        if (c === ']') {
          closed = true
          j += 1
          break
        }
        body += c === '\\' ? '\\\\' : c
        j += 1
      }
      if (!closed) throw new PatternError(`pattern "${pattern}" has an unterminated character class`)
      out += `[${body}]`
      i = j
    } else {
      out += escapeRegexChar(ch)
      i += 1
    }
  }
  return { source: pattern, re: new RegExp(`^${out}$`, 'u') }
}

/** Compile a literal (fully escaped), never a glob. */
export function compileLiteral(pattern: string): CompiledPattern {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { source: pattern, re: new RegExp(`^${escaped}$`, 'u') }
}

/** Escape one character for safe inclusion in a RegExp literal. */
function escapeRegexChar(ch: string): string {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch
}

/** Stable SHA-256 content hash (used for rule-file compile caching). */
export function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}