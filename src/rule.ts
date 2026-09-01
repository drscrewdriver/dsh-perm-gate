/**
 * Rule vocabulary for dsh-perm-gate: parsing a `permissions` YAML document into
 * a validated config, compiling globs, and first-match evaluation. Every
 * function is pure — no filesystem/clock/process state — so parsing, matching
 * and the failure modes are unit-testable and replayable.
 *
 * The chain is split into `deny` / `allow` / `ask` lists. deny is evaluated
 * first (blacklist priority); within each action list, first match wins. When
 * nothing matches, `defaultAction` applies.
 */
import { parse } from 'yaml'
import { compileGlob, hashText, type CompiledPattern } from './compiler.js'

export type RuleAction = 'allow' | 'ask' | 'deny'

/** A parsed, shape-validated permissions document (patterns not yet compiled). */
export interface PermissionsDoc {
  readonly defaultAction: RuleAction
  readonly deny: RuleEntryDoc[]
  readonly allow: RuleEntryDoc[]
  readonly ask: RuleEntryDoc[]
}

/** One parsed rule: match dimensions plus the action, reason, and metadata. */
export interface RuleEntryDoc {
  /** Tool-name globs; empty = every tool. */
  readonly tools: string[]
  /**
   * Shell command-word patterns. An entry `word` or `word#flag` where flag is
   * `recursive`/`force`. Empty = this rule does not constrain on command.
   */
  readonly command: string[]
  /** Argument/value token globs (file paths, urls, command args); empty = no constraint. */
  readonly args: string[]
  /** Workspace-relative path globs; empty = no constraint. */
  readonly paths: string[]
  readonly action: RuleAction
  readonly reason: string
  readonly enabled: boolean
}

export interface CompiledRuleEntry {
  readonly index: number
  readonly action: RuleAction
  readonly reason: string
  readonly enabled: boolean
  readonly tools: readonly CompiledPattern[]
  /** Command specs: { word glob, flag? }. */
  readonly command: readonly CommandSpec[]
  readonly args: readonly CompiledPattern[]
  readonly paths: readonly CompiledPattern[]
  readonly source: RuleEntryDoc
}

export interface CommandSpec {
  readonly word: CompiledPattern
  readonly flag?: 'recursive' | 'force'
}

export interface CompiledRuleset {
  readonly defaultAction: RuleAction
  readonly deny: readonly CompiledRuleEntry[]
  readonly allow: readonly CompiledRuleEntry[]
  readonly ask: readonly CompiledRuleEntry[]
  readonly caseInsensitivePaths: boolean
}

export interface CompileOptions {
  readonly maxGlobStars?: number
  readonly caseInsensitivePaths?: boolean
}

const VALID_ACTIONS: readonly RuleAction[] = ['allow', 'ask', 'deny']
const PATH_CANDIDATE_KEYS: readonly string[] = [
  'path', 'paths', 'file', 'files', 'file_path', 'dir', 'directory', 'directories',
  'cwd', 'workspace', 'root', 'target', 'targets', 'output',
]
const URL_CANDIDATE_KEYS: readonly string[] = ['url', 'urls', 'uri', 'endpoint', 'remote', 'repo', 'repository']
const COMMAND_CANDIDATE_KEYS: readonly string[] = ['command', 'cmd', 'script', 'command_line', 'commandLine']

export class RuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleError'
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function stringList(v: unknown, at: string): string[] {
  if (v === undefined) return []
  const list = typeof v === 'string' ? [v] : v
  if (!Array.isArray(list)) throw new RuleError(`${at} must be a string or list of strings`)
  return list.map((item, i) => {
    if (typeof item !== 'string' || item.length === 0) throw new RuleError(`${at}[${i}] must be a non-empty string`)
    return item
  })
}

function actionOf(v: unknown, at: string): RuleAction {
  if (typeof v !== 'string' || !(VALID_ACTIONS as string[]).includes(v)) {
    throw new RuleError(`${at} action must be one of ${VALID_ACTIONS.join('|')}`)
  }
  return v as RuleAction
}

/** Parse a raw YAML permissions document; malformed files fail loud at load. */
export function parsePermissionsDocument(text: string): PermissionsDoc {
  let raw: unknown
  try {
    raw = parse(text)
  } catch (error) {
    throw new RuleError(`invalid YAML: ${String(error)}`)
  }
  if (raw === null || raw === undefined) {
    return { defaultAction: 'ask', deny: [], allow: [], ask: [] }
  }
  if (!isRecord(raw)) throw new RuleError('permissions document must be a mapping')
  const root = isRecord(raw.permissions) ? raw.permissions : raw
  const unknown = Object.keys(root).filter((k) => !(VALID_ACTIONS as string[]).includes(k) && k !== 'defaultAction')
  if (unknown.length > 0) {
    throw new RuleError(`unknown permissions field${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => JSON.stringify(k)).join(', ')}`)
  }
  const defaultAction = root.defaultAction === undefined ? 'ask' : actionOf(root.defaultAction, 'defaultAction')
  const parseList = (key: RuleAction, at: string): RuleEntryDoc[] => {
    const arr = root[key]
    if (arr === undefined) return []
    if (!Array.isArray(arr)) throw new RuleError(`${at}.${key} must be a list`)
    return arr.map((item, i) => parseRuleEntry(item, key, `${at}.${key}[${i}]`))
  }
  return {
    defaultAction,
    deny: parseList('deny', 'permissions'),
    allow: parseList('allow', 'permissions'),
    ask: parseList('ask', 'permissions'),
  }
}

function parseRuleEntry(raw: unknown, action: RuleAction, at: string): RuleEntryDoc {
  if (!isRecord(raw)) throw new RuleError(`${at} must be a mapping`)
  const unknown = Object.keys(raw).filter((k) => !['tools', 'command', 'args', 'paths', 'action', 'reason', 'enabled'].includes(k))
  if (unknown.length > 0) {
    throw new RuleError(`${at} unknown field${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => JSON.stringify(k)).join(', ')}`)
  }
  if (raw.action !== undefined && actionOf(raw.action, `${at}.action`) !== action) {
    throw new RuleError(`${at} action conflicts with its list`)
  }
  const reason = raw.reason
  if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length === 0)) {
    throw new RuleError(`${at}.reason must be a non-empty string`)
  }
  return {
    tools: stringList(raw.tools, `${at}.tools`),
    command: stringList(raw.command, `${at}.command`),
    args: stringList(raw.args, `${at}.args`),
    paths: stringList(raw.paths, `${at}.paths`),
    action,
    reason: reason === undefined ? `${action}` : reason,
    enabled: raw.enabled === undefined ? true : typeof raw.enabled === 'boolean' ? raw.enabled : (() => { throw new RuleError(`${at}.enabled must be a boolean`) })(),
  }
}

function compilePatternList(patterns: string[], at: string, opts: CompileOptions): readonly CompiledPattern[] {
  const stars = opts.maxGlobStars ?? 2
  const ci = opts.caseInsensitivePaths ?? false
  const desc = at.includes('paths')
  const list: CompiledPattern[] = []
  for (const p of patterns) {
    list.push(compileGlob(p, { segments: desc, maxStars: stars }))
  }
  // Case-insensitive path patterns: recompile with `i`.
  if (ci && desc) {
    return list.map((c) => ({ source: c.source, re: new RegExp(c.re.source, 'ui') }))
  }
  return list
}

/** Compile one command entry (`word` or `word#flag`). */
function compileCommand(entry: string, opts: CompileOptions): CommandSpec {
  const hash = entry.lastIndexOf('#')
  let word: string
  let flag: 'recursive' | 'force' | undefined
  if (hash > 0 && hash < entry.length - 1) {
    word = entry.slice(0, hash)
    const f = entry.slice(hash + 1)
    if (f === 'recursive' || f === 'force') flag = f
  } else {
    word = entry
  }
  return { word: compileGlob(word, { segments: false, maxStars: opts.maxGlobStars ?? 2 }), flag }
}

/** Compile a validated document into hot-path rules. */
export function compileDocument(doc: PermissionsDoc, opts: CompileOptions = {}): CompiledRuleset {
  const comp = (list: RuleEntryDoc[], action: RuleAction, offset: number): readonly CompiledRuleEntry[] =>
    list.map((entry, i) => ({
      index: offset + i,
      action,
      reason: entry.reason,
      enabled: entry.enabled,
      tools: compilePatternList(entry.tools, 'tools', opts),
      command: entry.command.map((c) => compileCommand(c, opts)),
      args: compilePatternList(entry.args, 'args', opts),
      paths: compilePatternList(entry.paths, 'paths', opts),
      source: entry,
    }))
  return {
    defaultAction: doc.defaultAction,
    deny: comp(doc.deny, 'deny', 0),
    allow: comp(doc.allow, 'allow', doc.deny.length),
    ask: comp(doc.ask, 'ask', doc.deny.length + doc.allow.length),
    caseInsensitivePaths: opts.caseInsensitivePaths ?? false,
  }
}

/** SHA-256 hash of the raw document (compile-cache key without recompiling). */
export function documentHash(text: string): string {
  return hashText(text)
}

// Candidate extraction (shared by evaluate + path rules).
export function extractPathCandidates(args: Record<string, unknown>): string[] {
  const out: string[] = []
  const walk = (node: unknown, depth: number): void => {
    if (depth > 8) return
    if (Array.isArray(node)) {
      for (const e of node) walk(e, depth + 1)
      return
    }
    if (!isRecord(node)) return
    for (const [k, v] of Object.entries(node)) {
      if (PATH_CANDIDATE_KEYS.includes(k)) {
        if (typeof v === 'string') out.push(v)
        else if (Array.isArray(v)) for (const e of v) if (typeof e === 'string') out.push(e)
      }
      walk(v, depth + 1)
    }
  }
  walk(args, 0)
  return out
}

export function extractUrlCandidates(args: Record<string, unknown>): string[] {
  const out: string[] = []
  const urlRe = /https?:\/\/[^\s"'<>)\]\\]+/g
  const walk = (node: unknown, depth: number): void => {
    if (depth > 8) return
    if (Array.isArray(node)) {
      for (const e of node) walk(e, depth + 1)
      return
    }
    if (!isRecord(node)) return
    for (const [k, v] of Object.entries(node)) {
      if (URL_CANDIDATE_KEYS.includes(k)) {
        if (typeof v === 'string') out.push(v)
        else if (Array.isArray(v)) for (const e of v) if (typeof e === 'string') out.push(e)
      }
      if (COMMAND_CANDIDATE_KEYS.includes(k) && typeof v === 'string') {
        for (const m of v.matchAll(urlRe)) out.push(m[0])
      }
      walk(v, depth + 1)
    }
  }
  walk(args, 0)
  return out
}