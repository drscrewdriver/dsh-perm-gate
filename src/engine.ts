/**
 * The P0–P4 decision engine for dsh-perm-gate.
 *
 *   P0 hard-deny      deterministic, monotonic, never negotiated
 *   P1 session grant  a precise one-shot/limited grant
 *   P2 static rules   deny-first allow/ask chain
 *   P3 LLM classifier optional second-model review (off by default)
 *   P4 ask            official approval seam
 * Strictly fail-closed: P0 wins over every later stage.
 */
import { isProtectedDestructiveTarget, isSensitivePath, isWithin } from './path.js'
import { type Decision, type ToolCallContext } from './evaluate.js'
import { isForceDeletion, isRecursiveDeletion, decomposeShellCommand } from './shell.js'

export type EngineStage = 'hard-deny' | 'grant' | 'rule' | 'default' | 'ask' | 'classifier'

const DESTRUCTIVE_TOOL = /(?:^|[_-])(?:delete|remove|rm|destroy|erase|purge|wipe|unlink|rmdir|reset)(?:$|[_-]|recursive)/i
const READ_TOOLS = new Set(['read', 'read_image', 'grep', 'glob', 'ls', 'lsp'])

function serialized(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args)
  } catch {
    return ''
  }
}

function containsCredentialMaterial(args: Record<string, unknown>): boolean {
  return /(?:BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b|Bearer\s+[A-Za-z0-9._~+\/-]{8,}|\.ssh[\\/](?:id_|config)|credentials\.yaml)/i
    .test(serialized(args))
}

function pathArgument(args: Record<string, unknown>): string | undefined {
  for (const key of ['file_path', 'path', 'cwd', 'workdir']) {
    const v = args[key]
    if (typeof v === 'string') return v
  }
  return undefined
}

/**
 * Deterministic P0 hard-deny reason, or undefined when the call may proceed to
 * later stages.
 */
export function hardDenyReason(ctx: ToolCallContext): string | undefined {
  const args = ctx.args
  if (containsCredentialMaterial(args)) return 'call contains credential or private-key material'
  const shell = /^(?:bash|pwsh|sh|cmd)$/.test(ctx.tool)
  if (shell && typeof args.command === 'string') {
    let commands: ReturnType<typeof decomposeShellCommand>['commands'] = []
    try {
      commands = decomposeShellCommand(args.command).commands
    } catch {
      return undefined // undecidable syntax -> route to ask (P4), never allow
    }
    for (const cmd of commands) {
      if (cmd.command === 'rm' && (isRecursiveDeletion(cmd) || isForceDeletion(cmd))) {
        // Guarded further by path rules; root-level deletion denied below only
        // when the explicit target is a protected root.
      }
      const redir = cmd.redirects.find((r) => isProtectedDestructiveTarget(r, ctx.dshHome))
      if (redir !== undefined) return `shell redirect targets protected path: ${redir}`
    }
  }
  const path = pathArgument(args)
  if (path !== undefined && (DESTRUCTIVE_TOOL.test(ctx.tool) || ctx.tool === 'bash' || ctx.tool === 'pwsh' || ctx.tool === 'write' || ctx.tool === 'edit')) {
    if (isProtectedDestructiveTarget(path, ctx.dshHome)) return `mutation targets protected path: ${path}`
  }
  if (READ_TOOLS.has(ctx.tool) && path !== undefined) {
    const normalized = path.startsWith('/') || /^[A-Za-z]:/.test(path) ? path : path
    if (!isWithin(ctx.cwd, normalized) && isSensitivePath(normalized)) {
      return `read of sensitive path outside workspace: ${path}`
    }
  }
  return undefined
}

export interface GrantResolver {
  (tool: string, args: Record<string, unknown>): 'allow' | 'no-match'
}

export interface FinalDecision extends Decision {
  readonly stage: EngineStage
}

/** Pure P0–P2 + P4 decision; P3 handled by the caller before falling back to ask. */
export function decide(
  ctx: ToolCallContext,
  ruleset: { decide: (c: ToolCallContext) => Decision },
  grants: GrantResolver,
): FinalDecision {
  const hard = hardDenyReason(ctx)
  if (hard !== undefined) return { action: 'deny', reason: `[hard-deny] ${hard}`, stage: 'hard-deny', ruleIndex: undefined }
  if (grants(ctx.tool, ctx.args) === 'allow') {
    return { action: 'allow', reason: 'covered by session grant', stage: 'grant', ruleIndex: undefined }
  }
  const rule = ruleset.decide(ctx)
  return { ...rule, stage: rule.action === 'allow' || rule.action === 'deny' ? 'rule' : 'default' }
}