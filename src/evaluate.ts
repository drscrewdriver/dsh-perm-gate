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
  readonly home?: string
  readonly dshHome?: string
  readonly caseInsensitive?: boolean
}

export interface Decision {
  readonly action: RuleAction
  readonly reason: string
  readonly ruleIndex: number | undefined
}

const SHELL_TOOLS = new Set(['bash', 'pwsh', 'sh', 'cmd', 'powershell'])

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

/** Compute the deterministic first-match decision (P2 chain). */
export function decideRules(ruleset: CompiledRuleset, ctx: ToolCallContext): Decision {
  const commands = ctx.commandText !== undefined && SHELL_TOOLS.has(ctx.tool)
    ? decomposeSafe(ctx.commandText)
    : []
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
  const allow = scan(ruleset.allow, 'allow')
  if (allow !== undefined) return allow
  const ask = scan(ruleset.ask, 'ask')
  if (ask !== undefined) return ask
  return { action: ruleset.defaultAction, reason: `no rule matched; default action`, ruleIndex: undefined }
}

function decomposeSafe(text: string): readonly SimpleCommand[] {
  try {
    return decomposeShellCommand(text).commands
  } catch {
    return []
  }
}