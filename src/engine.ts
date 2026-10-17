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
import { isProtectedCredentialPath, isProtectedDestructiveTarget, isSensitivePath, isWithin } from './path.js'
import { compileCredentialPaths } from './credential-paths.js'
import { commandIrreversibleReason, irreversibleReason } from './irreversible.js'
import { executableVariants, normalizeCommandText } from './command-normalize.js'
// 工具名名单归 `tool-names.ts` 所有（不得在此处再抄一份）。P0 **不看工具名白名单**：
// 它看 `executableCommandOf`——已知非执行器（read/write/内部工具）的 `command` 参数是数据，
// 其余任何带命令串的调用都按命令对待，所以工具叫什么（包括模型打错的 `pash`）都不是绕过面。
import { INTERNAL_TOOLS, READ_TOOLS, executableCommandOf } from './tool-names.js'
import { type Decision, type ToolCallContext } from './evaluate.js'
import { decomposeShellCommand, type SimpleCommand } from './shell.js'
import { dispatchCommand } from './command-dispatcher.js'

export type EngineStage = 'hard-deny' | 'grant' | 'rule' | 'default' | 'ask' | 'classifier'

const DESTRUCTIVE_TOOL = /(?:^|[_-])(?:delete|remove|rm|destroy|erase|purge|wipe|unlink|rmdir|reset)(?:$|[_-]|recursive)/i


/** No user-configured extra auto-allow names. */
const NO_EXTRA_AUTO_ALLOW: ReadonlySet<string> = new Set()

/** The built-in read-only / internal classification, for diagnostics and docs. */
export const AUTO_ALLOW_TOOLS: ReadonlySet<string> = new Set([...READ_TOOLS, ...INTERNAL_TOOLS])

/**
 * The document-body keys the screens skip live in `scan-text.ts`, shared with the
 * deny-keyword layer so the two cannot drift. Re-exported here because this was their
 * published home.
 */
export { CONTENT_ARG_KEYS } from './scan-text.js'
import { operationText } from './scan-text.js'

/**
 * Credential or private-key material a call carries.
 *
 * Read through `scan-text.operationText`, so a document tool's prose is no longer fed
 * to this screen at all (issue #2): refusing `exit_plan_mode` because the plan *names*
 * a step it intends to ask about is a self-contradiction — `decide()` classifies the
 * same call as needing no approval one layer later.
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
 *
 * `id_` keeps its `.pub` half out: a public key is the artifact you hand *other*
 * people, so writing `~/.ssh/id_ed25519.pub` (registering a key, restoring a pair by
 * hand) was refused at the one layer nobody can appeal for no protective reason. The
 * private halves stay in, as does `config` — an ssh config's `ProxyCommand` /
 * `LocalCommand` is code that runs on the next connection, which is an execution
 * plant, not a preference file.
 */
const CREDENTIAL_MATERIAL = /(?:BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|\b(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b|\.ssh[\\/]id_(?![^\\/]*\.pub(?:$|[\\/]))|\.ssh[\\/]config|credentials\.yaml)/i

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

/**
 * Credential or private-key material a call carries, read out of the *operation* text
 * only — which is `scan-text`'s job, and why the key lists are a caller input: a document
 * body is somebody's prose, not a theft in progress.
 */
function containsCredentialMaterial(ctx: ToolCallContext): boolean {
  const text = operationText(ctx.args, ctx.tool, ctx.scanKeys)
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
  if (containsCredentialMaterial(ctx)) return 'call contains credential or private-key material'
  // **Shape, not a name whitelist** (see tool-names.ts): a call that carries a
  // command string and is not a known non-executor is a command call whatever the
  // tool is called, or an unfamiliar name would skip P0 with `diskpart /s x.txt`
  // sitting right there in `args`.
  const commandText = executableCommandOf(ctx.tool, args)
  if (commandText !== undefined) {
    // Encoded layers are resolved **first**: `-EncodedCommand` hides the act from
    // every word-boundary rule below, and the visible shell form can itself be
    // undecodable to the parser (unbalanced quotes), whose early exit must not
    // also skip this check. Only variants the original hands to an execution
    // primitive are trusted, and they can only ever add a deny — nothing here
    // widens, and no decoded text is written back to the call or the log.
    let decodedReason: string | undefined
    for (const variant of executableVariants(normalizeCommandText(commandText))) {
      const hidden = irreversibleReason(variant)
      if (hidden !== undefined) {
        decodedReason = `${hidden} (decoded from an encoded layer)`
        break
      }
    }
    let commands: ReturnType<typeof decomposeShellCommand>['commands'] = []
    try {
      commands = decomposeShellCommand(commandText).commands
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
  // Credential-store mutation via a file tool is an access backdoor: dropping an
  // `authorized_keys` line, `git config credential.helper store`, or rewriting
  // `.git-credentials`/`.npmrc`/cloud creds grants or leaks authority. The shell
  // layer already denies deletion of these stores and asks on reading them, but
  // write/edit reached past the P0 guard because it only screened system roots, so
  // `write ~/.ssh/authorized_keys` was auto-allowed. Scoped to file-mutation tools
  // (not bash/pwsh, whose real target is the command string, judged above), and
  // `.env` is excluded (project-local dev config).
  //
  // `credentialPaths` (a setting) is consulted here and in the read branch below: the
  // long tail of secrets — a company vault file, a deploy key nobody shipped in a
  // preset — has to be extendable, and this is the only layer that a *read* call cannot
  // skip past. The tier is not configurable on purpose: a declared path gets exactly
  // what `.ssh` gets, never a downgradable `ask`.
  const declared = compileCredentialPaths(ctx.credentialPaths, {
    caseInsensitive: ctx.caseInsensitive ?? false,
    // `userHome`, not `home`: the latter is the workspace root. A caller that does not
    // supply it gets the tail-match fallback in `compileCredentialPaths`, which is
    // stricter, never looser.
    ...(ctx.userHome === undefined ? {} : { home: ctx.userHome }),
  })
  if (path !== undefined && (ctx.tool === 'write' || ctx.tool === 'edit' || DESTRUCTIVE_TOOL.test(ctx.tool)) && isProtectedCredentialPath(path, declared)) {
    return `mutation targets a credential store: ${path}`
  }
  if (READ_TOOLS.has(ctx.tool) && path !== undefined) {
    const normalized = path.startsWith('/') || /^[A-Za-z]:/.test(path) ? path : path
    if (!isWithin(ctx.cwd, normalized) && (isSensitivePath(normalized) || declared(path))) {
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