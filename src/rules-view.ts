/**
 * Reading the permissions YAML, for the panel that shows it.
 *
 * The card could already WRITE the rules file — the allowlist section appends
 * and replaces patterns, and `index.ts` mirrors those edits back into the
 * document. Nothing could read it back, so an operator editing patterns through
 * the panel had no way to see the document they were editing: the file the gate
 * actually loads was invisible from the UI.
 *
 * This is the missing read half. It is deliberately **read-only** — a view must
 * never be able to change the ruleset it is describing, or "let me look at the
 * rules" becomes a risky action. Writing stays where it already lives
 * (`allowlist.ts`, the settings namespace).
 */
import { readFileSync, statSync } from 'node:fs'
import { RuleError, compileDocument, documentHash, parsePermissionsDocument, type RuleAction } from './rule.js'

/** Rules per action, so the panel can say "3 deny / 7 allow / 1 ask" at a glance. */
export interface RulesViewCounts {
  readonly allow: number
  readonly deny: number
  readonly ask: number
}

/** The whole read-only face of one permissions document. */
export interface RulesView {
  /** Absolute path, or `''` when the gate has no rules file configured. */
  readonly path: string
  readonly exists: boolean
  /** File size on disk, not the length of `raw` — a truncated view still reports the truth. */
  readonly bytes: number
  /** Content hash of the text the gate would load, for correlating with a reload. */
  readonly hash: string
  readonly lines: number
  /** The document itself. Empty when absent, unreadable, or truncated away. */
  readonly raw: string
  readonly truncated: boolean
  /** Parsed only when the document compiled; absent when it did not. */
  readonly defaultAction?: RuleAction
  readonly counts: RulesViewCounts
  /** Why the document could not be shown or parsed. Absent when all is well. */
  readonly error?: string
}

/** Beyond this the panel would be rendering a log, not a rules file. */
const MAX_VIEW_BYTES = 512 * 1024

const NO_COUNTS: RulesViewCounts = { allow: 0, deny: 0, ask: 0 }

/**
 * Read one permissions document for display.
 *
 * Never throws: a missing, unreadable or malformed file is a state the panel has
 * to render, not an error that should blank the section. Every failure mode is
 * reported in the returned value instead.
 */
export function readRulesView(rulesFile: string): RulesView {
  if (rulesFile === '') {
    return {
      path: '', exists: false, bytes: 0, hash: '', lines: 0, raw: '', truncated: false,
      counts: NO_COUNTS, error: 'no rules file is configured',
    }
  }

  let bytes = 0
  let exists = true
  try {
    bytes = statSync(rulesFile).size
  } catch {
    exists = false
  }

  let raw = ''
  try {
    raw = readFileSync(rulesFile, 'utf8')
  } catch (e: unknown) {
    return {
      path: rulesFile, exists, bytes, hash: '', lines: 0, raw: '', truncated: false,
      counts: NO_COUNTS,
      error: exists ? `unreadable: ${String((e as Error)?.message ?? e)}` : 'file does not exist',
    }
  }

  const lines = raw === '' ? 0 : raw.split('\n').length
  const truncated = raw.length > MAX_VIEW_BYTES
  const shown = truncated ? raw.slice(0, MAX_VIEW_BYTES) : raw

  // Parsing is what makes the view worth having: a YAML file that loads as text
  // but not as rules is exactly the failure the panel exists to expose.
  try {
    const doc = parsePermissionsDocument(raw)
    const ruleset = compileDocument(doc)
    return {
      path: rulesFile, exists: true, bytes, hash: documentHash(raw), lines,
      raw: shown, truncated,
      defaultAction: ruleset.defaultAction,
      counts: { allow: ruleset.allow.length, deny: ruleset.deny.length, ask: ruleset.ask.length },
    }
  } catch (e: unknown) {
    const detail = e instanceof RuleError ? e.message : String((e as Error)?.message ?? e)
    return {
      path: rulesFile, exists: true, bytes, hash: documentHash(raw), lines,
      raw: shown, truncated,
      counts: NO_COUNTS,
      error: `does not compile: ${detail}`,
    }
  }
}
