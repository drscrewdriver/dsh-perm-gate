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
import { commandIrreversibleReason, irreversibleReason } from './irreversible.js'
import { executableVariants, normalizeCommandText } from './command-normalize.js'
// SHELL_TOOLS 是**值的导入**：这份名单必须与 evaluate.ts / runtime.ts 共用同一个
// 事实源。此处曾经自带一份 `/(?:bash|pwsh|sh|cmd)$/` 正则，漏掉了 `shell` /
// `terminal` / `powershell`——于是 P0 的 shell 检查对 DSH 的**主 shell 工具**
// 完全失效（实测：同一句 `echo x > /etc/passwd`，bash 被拦截，shell 放行）。
// 同名事实的第二份副本必然腐烂，这里不再保留副本。
import { SHELL_TOOLS, type Decision, type ToolCallContext } from './evaluate.js'
import { decomposeShellCommand, type SimpleCommand } from './shell.js'
import { dispatchCommand } from './command-dispatcher.js'

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
  // Search / lookup: every one of these only READS. `web_search` and
  // `modlens_read_image` also reach the network, but through DSH's own client
  // rather than a subprocess — see the network note below.
  'web_search', 'modlens_read_image',
  'advanced_search', 'platform_search', 'free_search_test',
  // Session-scoped reads: they disclose already-recorded state, never mutate.
  'context_compression_retrieve', 'memory_search_graph', 'memory_expand_graph_node',
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
  // DSH session/memory/goal/taskboard management. The memory store is the
  // agent's own state, not the workspace: writing it is not a workspace write.
  'conversation_search',
  'memory_add', 'memory_delete', 'memory_read_scene', 'memory_search',
  'memory_import', 'memory_ruminate', 'memory_ruminate_cancel', 'memory_ruminate_status',
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

/**
 * Credential or private-key material a call carries.
 *
 * Two clauses were removed on purpose, both because this predicate reads one flat
 * string and therefore cannot tell *using* a secret from *moving* one — and P0 is
 * the layer nobody can appeal:
 *
 * - `Bearer <token>`: putting a token in its own `Authorization` header is how every
 *   API is called. The benign-encoding corpus measured it as a false hard-deny
 *   (`curl -H "Authorization: Bearer …" https://api.internal/v1/me`); a command that
 *   cannot be shown to anyone is also a command that never reaches the popup.
 * - a read-only look at a key file: `Test-Path ~/.ssh/id_rsa` moves nothing. The
 *   plan's own grading rule says so ("reading a local credential is not itself the
 *   act"), and the deny layer must not contradict the prompt it hands the model.
 *
 * What is left is the theft shape: a secret *artifact* plus a channel out, or any
 * non-readonly verb touching one. That pairing lives in `irreversible.ts`, so both
 * layers agree.
 */
const CREDENTIAL_MATERIAL = /(?:BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b|\.ssh[\\/](?:id_|config)|credentials\.yaml)/i

/** Verbs that only look. A call made of nothing else cannot have leaked anything. */
const READ_ONLY_HEAD = /^(?:test-path|test|ls|dir|get-childitem|get-content|get-item|cat|type|more|head|tail|stat|file|select-string|where|which|exists)$/i

/** Whether every segment of this command text is a read-only look. */
function readonlyProbe(text: string): boolean {
  const segments = text.split(/[;&|\n]+/).map((s) => s.trim()).filter((s) => s !== '')
  if (segments.length === 0) return false
  return segments.every((seg) => {
    const head = (seg.replace(/^["'`]+/, '').split(/[\s/]+/)[0] ?? '').toLowerCase()
    return READ_ONLY_HEAD.test(head)
  })
}

function containsCredentialMaterial(args: Record<string, unknown>): boolean {
  const text = operationText(args)
  return CREDENTIAL_MATERIAL.test(text) && !readonlyProbe(text)
}

function pathArgument(args: Record<string, unknown>): string | undefined {
  for (const key of ['file_path', 'path', 'cwd', 'workdir']) {
    const v = args[key]
    if (typeof v === 'string') return v
  }
  return undefined
}

/** 廉价前缀过滤：绝大多数 shell 调用不是 push，先过一遍正则再动用解析器。 */
const GIT_PUSH_TEXT = /\bgit\s+push\b/

/**
 * Irreversibility itself is **not** defined here: it lives in `irreversible.ts`,
 * shared with the tier grading in `ask-context.ts`. Two copies of that fact drift,
 * and the drift was observed — `Optimize-VHD` was known to no rule while no graded
 * model hard-denied it either. P0 consumes the shared judgement, and only ever
 * turns it into a deny for the command as received plus the decoded variants the
 * original will actually execute.
 */

/**
 * 远端历史改写：`git push` 强制覆盖或删除**保护分支**。
 *
 * **「只升不降」是形状约束，不是口头约定**：返回值只有 `string | undefined`，
 * 调用方把 `string` 读作 deny、`undefined` 读作「继续走后面的阶段」。本函数
 * 结构上**无法**产生 allow，所以挂在 P0 上永远不会放宽门的判定。
 *
 * 刻意**不**覆盖（仍交给关键词层 / 规则层 / LLM 层）：
 * - 非保护分支上的 force push（如 `origin feat/x`）——P0 不可撤销，得给工作流留口子；
 * - 没写分支名的 `git push --force`——解析不出目标就不做断言；
 * - 普通 push。
 *
 * 这正是本插件补不上的那一段：`DEFAULT_DENY_KEYWORDS` 里的 `'push --force'` 是
 * **扁平的、可被命名空间覆盖掉**的，且完全不看分支；P0 这一层则是不可协商的底。
 */
function gitRemoteRewriteReason(segments: readonly SimpleCommand[]): string | undefined {
  for (const seg of segments) {
    const text = [seg.command, ...seg.args].join(' ')
    if (!GIT_PUSH_TEXT.test(text)) continue
    const result = dispatchCommand(text)
    if (result === null) continue
    const s = result.semantics
    if (s.operation !== 'force-push' && s.operation !== 'push-delete') continue
    if (!s.targetsSharedBranch) continue
    const what = s.operation === 'push-delete' ? 'delete' : 'force-overwrite'
    const remote = s.remote === undefined ? '' : ` (remote ${s.remote})`
    return `git push would ${what} protected branch: ${s.branch}${remote}`
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
  if (SHELL_TOOLS.has(ctx.tool) && typeof args.command === 'string') {
    // Encoded layers are resolved **first**: `-EncodedCommand` hides the act from
    // every word-boundary rule below, and the visible shell form can itself be
    // undecodable to the parser (unbalanced quotes), whose early exit must not
    // also skip this check. Only variants the original hands to an execution
    // primitive are trusted, and they can only ever add a deny — nothing here
    // widens, and no decoded text is written back to the call or the log.
    let decodedReason: string | undefined
    for (const variant of executableVariants(normalizeCommandText(args.command))) {
      const hidden = irreversibleReason(variant)
      if (hidden !== undefined) {
        decodedReason = `${hidden} (decoded from an encoded layer)`
        break
      }
    }
    let commands: ReturnType<typeof decomposeShellCommand>['commands'] = []
    try {
      commands = decomposeShellCommand(args.command).commands
    } catch {
      // Undecidable syntax routes to ask (P4), never allow — unless a decode
      // already proved an irreversible act.
      return decodedReason
    }
    for (const cmd of commands) {
      const redir = cmd.redirects.find((r) => isProtectedDestructiveTarget(r, ctx.dshHome))
      if (redir !== undefined) return `shell redirect targets protected path: ${redir}`
      const wipe = commandIrreversibleReason(cmd)
      if (wipe !== undefined) return wipe
    }
    if (decodedReason !== undefined) return decodedReason
    const rewrite = gitRemoteRewriteReason(commands)
    if (rewrite !== undefined) return rewrite
  }
  const path = pathArgument(args)
  // 注意：这里**刻意不**用 SHELL_TOOLS。本判据读的是 `pathArgument`（file_path /
  // path / cwd / **workdir**），它是"被改写的路径"而不是"要执行的命令"。shell 工具的
  // 真目标在 command 里，由上面的命令级检查负责；若把 shell 工具也塞进来，
  // `shell({ command: 'ls', workdir: '/etc' })` 这种纯读操作会因为 workdir 落在受保护
  // 前缀而被 P0 永久挡住——那是过度拦截，而且 P0 撤销不了。
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