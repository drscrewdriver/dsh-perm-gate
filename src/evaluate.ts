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

export interface ToolCallContext {
  readonly tool: string
  readonly args: Record<string, unknown>
  readonly commandText?: string
  readonly cwd: string
  /** Workspace root; used by the write-path override to decide inside vs outside. */
  readonly home?: string
  readonly dshHome?: string
  readonly caseInsensitive?: boolean
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