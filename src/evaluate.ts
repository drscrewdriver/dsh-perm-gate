/**
 * First-match decision for dsh-perm-gate. Given a tool call + its command/path
 * candidate strings, evaluate the deny-first rule chain and return the first
 * matching action (or `defaultAction`). Pure — no I/O.
 */
import { normalizeWorkspacePath } from './path.js'
import {
  extractPathCandidates,
  extractUrlCandidates,
  type CompiledRuleEntry,
  type CompiledRuleset,
  type RuleAction,
} from './rule.js'
import { decomposeShellCommand, isForceDeletion, isRecursiveDeletion, type SimpleCommand } from './shell.js'
import { compileParamPatterns, compileCidr, compilePortSpec, compileDomainPattern } from './compiler.js'
import type { ParamCondition, NetworkDimension, WhenDimension } from './rule-dims.js'

export interface ToolCallContext {
  readonly tool: string
  readonly args: Record<string, unknown>
  readonly commandText?: string
  readonly cwd: string
  /** Workspace root; used by the write-path override to decide inside vs outside. */
  readonly home?: string
  readonly dshHome?: string
  readonly caseInsensitive?: boolean
  /** Agent identity candidates from session context. */
  readonly agentCandidates?: readonly string[]
  /** Network request info (for network dimension matching). */
  readonly network?: {
    readonly domain?: string
    readonly ip?: string
    readonly port?: number
    readonly scheme?: string
  }
}

export interface Decision {
  readonly action: RuleAction
  readonly reason: string
  readonly ruleIndex: number | undefined
}

/**
 * Tool names that execute a shell command string. `shell` and `terminal` are
 * DSH's own names (the shipped tool roster uses `shell`; `terminal` is the
 * interactive variant), and `pwsh` / `bash` / `sh` / `cmd` / `powershell` cover
 * the platform-specific aliases. Missing `shell` here silently disables the
 * command-content inspection below for the primary tool — every `git push`,
 * `chmod`, redirect and `tee` would fall through to `defaultAction`.
 */
export const SHELL_TOOLS = new Set(['shell', 'terminal', 'bash', 'pwsh', 'sh', 'cmd', 'powershell'])

/** Whether one compiled rule matches the given call context. */
export function ruleMatches(rule: CompiledRuleEntry, ctx: ToolCallContext, commands: readonly SimpleCommand[], pathCands: readonly string[], urlCands: readonly string[]): boolean {
  if (!rule.enabled) return false
  // tools dimension: any glob matches.
  if (rule.tools.length > 0 && !rule.tools.some((t) => t.re.test(ctx.tool))) return false
  const ci = ctx.caseInsensitive ?? false
  // command dimension: at least one decomposed simple command satisfies some command spec.
  if (rule.command.length > 0) {
    if (commands.length === 0) return false
    let ok = false
    for (const spec of rule.command) {
      for (const cmd of commands) {
        if (!spec.word.re.test(cmd.command)) continue
        if (spec.flag === 'recursive' && !isRecursiveDeletion(cmd)) continue
        if (spec.flag === 'force' && !isForceDeletion(cmd)) continue
        ok = true
        break
      }
      if (ok) break
    }
    if (!ok) return false
  }
  // args dimension: any token matches any args glob.
  if (rule.args.length > 0) {
    const tokens: string[] = []
    for (const cmd of commands) tokens.push(...cmd.args, ...cmd.redirects)
    tokens.push(...pathCands, ...urlCands)
    if (!tokens.some((tok) => rule.args.some((g) => g.re.test(tok)))) return false
  }
  // paths dimension: any workspace-relative path candidate matches any path glob.
  if (rule.paths.length > 0) {
    const rel = pathCands
      .map((p) => normalizeWorkspacePath(ctx.cwd, p, ci))
      .filter((p) => p.length > 0)
    if (rel.length === 0) return false
    if (!rel.some((p) => rule.paths.some((g) => g.re.test(p)))) return false
  }
  // ─── New dimensions ────────────────────────────────────────────────────
  // params dimension: AND over keys; each key's value must match at least one pattern (OR).
  if (rule.params.length > 0) {
    if (!matchParams(rule.params, ctx.args)) return false
  }
  // absent dimension: all listed keys must be absent from args.
  if (rule.absent.length > 0) {
    for (const key of rule.absent) {
      if (key in ctx.args) return false
    }
  }
  // agents dimension: at least one candidate must match an entry.
  if (rule.agents.length > 0) {
    const candidates = ctx.agentCandidates ?? []
    if (candidates.length === 0) return false // fail-closed
    if (!candidates.some((c) => rule.agents.some((a) => a === c || matchAgentPattern(a, c)))) return false
  }
  // when dimension: all conditions must be satisfied.
  if (rule.when !== undefined) {
    if (!matchWhen(rule.when)) return false
  }
  // argv dimension: pipeline patterns.
  if (rule.argv?.pipeline !== undefined && rule.argv.pipeline.length > 0) {
    if (commands.length === 0) return false
    const pipelineText = commands.map((c) => c.command).join('|')
    const compiled = rule.argv.pipeline.map((p) => compileGlobForMatch(p))
    if (!compiled.some((g) => g.test(pipelineText))) return false
  }
  // network dimension: all present sub-dimensions must match.
  if (rule.network !== undefined) {
    if (!matchNetwork(rule.network, ctx.network)) return false
  }
  return true
}

const WRITE_TOOLS = new Set(['write', 'edit'])

/**
 * Shell write/execution patterns. When NONE of these match, the command is
 * treated as read-only and follows the defaultAction (typically `allow`).
 *
 * The deny-keyword layer catches dangerous phrases (rm -rf, dd, mkfs …) before
 * this function runs, so this list only covers "mildly suspicious" writes that
 * aren't dangerous enough for the preset blacklist.
 */
const SHELL_WRITE_PATTERNS: readonly (string | RegExp)[] = [
  /(?:^|\s)(?:mv|cp|install|mkdir|touch|chmod|chown)\b/i,
  // Redirect into a file: `> f`, `>> f`, `>f`. The leading character class
  // excludes the stderr idioms a read-only command uses (`2>&1`, `>&2`,
  // `2>/dev/null`, `1>&2`), and the trailing class requires an actual target.
  /(?:^|[^0-9&])>>?\s*[^\s&|]/,
  // `tee` always writes its target; `curl`/`wget` only when they write a file.
  /(?:^|\s)tee\b/i,
  /(?:^|\s)(?:curl|wget)\b.*?(?:\s-[oO]\b|>)/i,
  /(?:^|\s)(?:git|npm|pnpm|yarn|bun)\s+(?:add|commit|push|rebase|reset|rm|stash|checkout|tag)\b/i,
  /(?:^|\s)(?:docker|podman|kubectl)\s+(?:rm|stop|kill|exec|cp)\b/i,
  /(?:^|\s)(?:gh)\s+(?:pr\s+create|issue\s+create|repo\s+create)\b/i,
  /(?:^|\s)(?:terraform|ansible)\s+(?:apply|destroy|provision)\b/i,
  /(?:^|\s)(?:sed|awk)\s+['"]?-[is]/,
]

/** Whether a shell command text contains a write or destructive pattern. */
function isWriteCommand(commandText: string): boolean {
  return SHELL_WRITE_PATTERNS.some((p) =>
    typeof p === 'string' ? commandText.includes(p) : p.test(commandText),
  )
}

/**
 * Default decision for write/edit and shell tools when no rule matches.
 *
 * - `write` / `edit`: workspace-internal paths follow `defaultAction`
 *   (typically `allow`); any target outside the workspace escalates to `ask`
 *   for content review. This is a hard safety rule that cannot be overridden
 *   by an explicit allow rule.
 * - `shell` / `pwsh` / `terminal`: read-only commands (git status, python -c
 *   fetch, curl without redirect, etc.) follow `defaultAction`; commands that
 *   contain a write/execution pattern escalate to `ask` for review.
 */
function pathAndCommandDefault(
  ctx: ToolCallContext,
  pathCandidates: readonly string[],
  defaultAction: RuleAction,
): RuleAction {
  if (defaultAction !== 'allow') return defaultAction

  // write/edit: path-aware (outside workspace → ask)
  if (WRITE_TOOLS.has(ctx.tool)) {
    const home = ctx.home
    if (home !== undefined && home !== '') {
      for (const candidate of pathCandidates) {
        if (normalizeWorkspacePath(home, candidate, ctx.caseInsensitive) === '') return 'ask'
      }
    }
    return defaultAction
  }

  // shell/pwsh/terminal: command-content-aware (write pattern → ask)
  if (SHELL_TOOLS.has(ctx.tool)) {
    const commandText = commandTextOf(ctx)
    if (commandText !== undefined && isWriteCommand(commandText)) return 'ask'
  }

  return defaultAction
}

/**
 * Command text of a shell call: the explicit `commandText` field when set,
 * otherwise `args.command`. The runtime populates `commandText` in
 * `PermGateRuntime.ctxFor`, but `decideRules` is exported and also called with
 * a hand-built context (tests, embedders); deriving here keeps every caller on
 * the same contract instead of silently treating a write command as read-only.
 */
function commandTextOf(ctx: ToolCallContext): string | undefined {
  if (typeof ctx.commandText === 'string') return ctx.commandText
  const raw = ctx.args?.['command']
  return typeof raw === 'string' ? raw : undefined
}

/** Compute the deterministic first-match decision (P2 chain). */
export function decideRules(ruleset: CompiledRuleset, ctx: ToolCallContext): Decision {
  const shellText = SHELL_TOOLS.has(ctx.tool) ? commandTextOf(ctx) : undefined
  const commands = shellText !== undefined ? decomposeSafe(shellText) : []
  const pathCands = extractPathCandidates(ctx.args)
  const urlCands = extractUrlCandidates(ctx.args)

  const scan = (list: readonly CompiledRuleEntry[], _action: RuleAction): Decision | undefined => {
    for (const rule of list) {
      if (ruleMatches(rule, ctx, commands, pathCands, urlCands)) {
        return { action: rule.action, reason: rule.reason, ruleIndex: rule.index }
      }
    }
    return undefined
  }

  const deny = scan(ruleset.deny, 'deny')
  if (deny !== undefined) return deny
  // Path/command-aware default: write/edit tools check the target path,
  // shell/pwsh/terminal tools check the command for write patterns.
  // Outside safety checks → ask; inside or read-only → defaultAction.
  let action = ruleset.defaultAction
  if (WRITE_TOOLS.has(ctx.tool) || SHELL_TOOLS.has(ctx.tool)) {
    action = pathAndCommandDefault(ctx, pathCands, action)
  }
  if (action === 'allow' || action === 'ask') {
    const allow = scan(ruleset.allow, 'allow')
    if (allow !== undefined) return allow
    const ask = scan(ruleset.ask, 'ask')
    if (ask !== undefined) return ask
  }
  return { action, reason: `no rule matched; default action`, ruleIndex: undefined }
}

function decomposeSafe(text: string): readonly SimpleCommand[] {
  try {
    return decomposeShellCommand(text).commands
  } catch {
    return []
  }
}

// ─── New dimension matchers ────────────────────────────────────────────────

/** Import compileGlob locally to avoid circular dependency with compiler.ts. */
import { compileGlob } from './compiler.js'

/** Compile a glob pattern to a RegExp for ad-hoc matching. */
function compileGlobForMatch(pattern: string): RegExp {
  return compileGlob(pattern, { segments: false }).re
}

/**
 * Match the params dimension: AND over keys, OR within each key's patterns.
 * A negated pattern means the value must NOT match.
 */
function matchParams(params: readonly ParamCondition[], args: Record<string, unknown>): boolean {
  for (const cond of params) {
    const value = resolveNestedKey(args, cond.key)
    if (cond.patterns.length === 0) {
      // No patterns → key must exist (any value).
      if (value === undefined) return false
      continue
    }
    if (value === undefined) return false
    const strValue = typeof value === 'string' ? value : JSON.stringify(value)
    const compiled = cond.patterns.map((p) => {
      if (p.startsWith('!') && p.length > 1) {
        return { negated: true, re: compileGlobForMatch(p.slice(1)) }
      }
      return { negated: false, re: compileGlobForMatch(p) }
    })
    if (cond.negated) {
      // Negated: value must NOT match the sole pattern.
      if (compiled[0].re.test(strValue)) return false
    } else {
      // Normal: value must match at least one pattern (OR).
      if (!compiled.some((c) => !c.negated && c.re.test(strValue))) return false
    }
  }
  return true
}

/**
 * Resolve a dotted key path from a nested object.
 * e.g. `resolveNestedKey({flags: {mode: 'prod'}}, 'flags.mode')` → `'prod'`
 */
function resolveNestedKey(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Match an agent pattern against an identity candidate.
 * Supports exact match and glob patterns.
 */
function matchAgentPattern(pattern: string, candidate: string): boolean {
  if (pattern === candidate) return true
  // Glob patterns: compile and test.
  if (/[*?[\]]/.test(pattern)) {
    return compileGlobForMatch(pattern).test(candidate)
  }
  return false
}

/**
 * Match the when dimension: all conditions must be satisfied.
 */
function matchWhen(when: WhenDimension): boolean {
  // Platform check.
  if (when.platform !== undefined && when.platform.length > 0) {
    if (!when.platform.includes(process.platform)) return false
  }
  // Env var checks.
  if (when.env !== undefined) {
    for (const [varName, allowed] of Object.entries(when.env)) {
      const actual = process.env[varName]
      if (actual === undefined) return false
      if (!allowed.includes(actual)) return false
    }
  }
  // Node version (reserved — skip for now).
  return true
}

/**
 * Match the network dimension: all present sub-dimensions must match.
 * Within a sub-dimension, entries are OR.
 */
function matchNetwork(network: NetworkDimension, ctx?: { domain?: string; ip?: string; port?: number; scheme?: string }): boolean {
  if (ctx === undefined) return false
  // domains
  if (network.domains !== undefined && network.domains.length > 0) {
    if (ctx.domain === undefined) return false
    const matchers = network.domains.map((d) => compileDomainPattern(d))
    if (!matchers.some((m) => m.re.test(ctx.domain!))) return false
  }
  // ips
  if (network.ips !== undefined && network.ips.length > 0) {
    if (ctx.ip === undefined) return false
    const isCidr = (s: string) => s.includes('/')
    const cidrs = network.ips.filter(isCidr)
    const literals = network.ips.filter((s) => !isCidr(s))
    const ipMatch = literals.includes(ctx.ip) || cidrs.some((c) => {
      try { return compileCidr(c)(ctx.ip!) } catch { return false }
    })
    if (!ipMatch) return false
  }
  // ports
  if (network.ports !== undefined && network.ports.length > 0) {
    if (ctx.port === undefined) return false
    const matchers = network.ports.map((p) => {
      try { return compilePortSpec(p) } catch { return (_: number) => false }
    })
    if (!matchers.some((m) => m(ctx.port!))) return false
  }
  // schemes
  if (network.schemes !== undefined && network.schemes.length > 0) {
    if (ctx.scheme === undefined) return false
    if (!network.schemes.includes(ctx.scheme)) return false
  }
  return true
}