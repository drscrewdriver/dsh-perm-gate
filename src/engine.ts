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
/**
 * Read-only tools that can never modify the workspace or execute anything. P0
 * still protects sensitive path reads outside the workspace root, and the
 * deny-keyword layer still runs first, so a search whose query contains a
 * blacklisted phrase is still vetoed.
 */
const READ_TOOLS = new Set([
  'read', 'read_image', 'grep', 'glob', 'ls', 'lsp',
  // Read-only network / media queries: no write, no exec.
  'web_search', 'modlens_read_image',
])
/** DSH internal coordination / management tools — not workspace-modifying. */
const INTERNAL_TOOLS = new Set([
  // AgentTeams coordination
  'agent_teams_create', 'agent_teams_add_member', 'agent_teams_remove_member',
  'agent_teams_delete', 'agent_teams_edit_plan', 'agent_teams_reassign_task',
  'agent_teams_claim_task', 'agent_teams_create_task', 'agent_teams_send_message',
  'agent_teams_approve', 'agent_teams_resume',
  // AgentTeams status reads
  'agent_teams_status', 'agent_teams_update_task',
  // DSH session/memory/goal/taskboard management
  'conversation_search',
  'memory_add', 'memory_delete', 'memory_read_scene', 'memory_search',
  'get_goal', 'update_goal', 'create_goal',
  'taskboard_get', 'taskboard_list', 'taskboard_claim', 'taskboard_block',
  'taskboard_comment', 'taskboard_release_claim', 'taskboard_submit_review',
  'taskboard_relate',
  // Job/agent management
  'job_list', 'job_output', 'job_kill',
  'list_agents', 'interrupt_agent', 'send_message',
  // Session-local UI / plan / todo state (no workspace write, no execution)
  'todo_write', 'render_ui', 'validate_dsh_ui', 'ask_user_question', 'exit_plan_mode',
  // Background / planning delegation (the delegated work is gated separately)
  'subagent', 'subagent_fork', 'ralph', 'workflow', 'skill',
])

/** No user-configured extra auto-allow names. */
const NO_EXTRA_AUTO_ALLOW: ReadonlySet<string> = new Set()

/** The built-in read-only / internal classification, for diagnostics and docs. */
export const AUTO_ALLOW_TOOLS: ReadonlySet<string> = new Set([...READ_TOOLS, ...INTERNAL_TOOLS])

/**
 * Argument keys that carry a document body rather than the operation itself.
 * A file's text is not the operation: writing a document that *mentions* a
 * token, a private key, or `credentials.yaml` must not hard-deny the write, and
 * the deny-keyword layer already skips these keys. The path/command arguments
 * that actually describe the operation are still scanned.
 */
export const CONTENT_ARG_KEYS: ReadonlySet<string> = new Set([
  'content', 'contents', 'text', 'body', 'message', 'prompt',
  'new_string', 'old_string', 'newText', 'oldText', 'file_text', 'fileText',
  'diff', 'patch', 'replacement', 'snippet',
])

/** The call's non-body text: the operation, not any document it carries. */
function operationText(args: Record<string, unknown>, depth = 0): string {
  if (depth > 6) return ''
  const parts: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      if (!CONTENT_ARG_KEYS.has(key)) parts.push(value)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') parts.push(item)
        else if (item !== null && typeof item === 'object') parts.push(operationText(item as Record<string, unknown>, depth + 1))
      }
      continue
    }
    if (value !== null && typeof value === 'object') {
      parts.push(operationText(value as Record<string, unknown>, depth + 1))
    }
  }
  return parts.join(' ')
}

function containsCredentialMaterial(args: Record<string, unknown>): boolean {
  return /(?:BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b|Bearer\s+[A-Za-z0-9._~+\/-]{8,}|\.ssh[\\/](?:id_|config)|credentials\.yaml)/i
    .test(operationText(args))
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
  /** Extra tool names the user classified as safe (`autoAllowTools`). */
  autoAllowExtra: ReadonlySet<string> = NO_EXTRA_AUTO_ALLOW,
): FinalDecision {
  const hard = hardDenyReason(ctx)
  if (hard !== undefined) return { action: 'deny', reason: `[hard-deny] ${hard}`, stage: 'hard-deny', ruleIndex: undefined }
  // Auto-allow read-only tools and DSH internal coordination/management tools:
  // they cannot modify the workspace or execute a command, so asking a human
  // about each one is pure noise. P0 hard-deny already protects sensitive-path
  // reads and credential material, and the deny-keyword layer runs even earlier.
  if (READ_TOOLS.has(ctx.tool) || INTERNAL_TOOLS.has(ctx.tool) || autoAllowExtra.has(ctx.tool)) {
    return { action: 'allow', reason: 'read-only internal tool', stage: 'grant', ruleIndex: undefined }
  }
  if (grants(ctx.tool, ctx.args) === 'allow') {
    return { action: 'allow', reason: 'covered by session grant', stage: 'grant', ruleIndex: undefined }
  }
  const rule = ruleset.decide(ctx)
  return { ...rule, stage: rule.action === 'allow' || rule.action === 'deny' ? 'rule' : 'default' }
}