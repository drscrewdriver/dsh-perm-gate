/**
 * AskContext — one frozen view of a tool call, projected three ways.
 *
 * Before this module, the same facts were derived three times, differently:
 * `trackAsk` snapshotted files for the review page, `recordEvent` re-derived
 * them for the feed, and the risk grader got `tool` + raw `args` + the rule
 * reason and nothing else. That is how an approval popup ended up showing one
 * opaque sentence while the model that judged the call never saw the workspace
 * root its own prompt kept referring to.
 *
 * One object, built at the decision entry point, then three projections with
 * deliberately different trust boundaries:
 *
 * - `toGraderPayload` — leaves the host (user-configured endpoint). Redacted,
 *   bounded, and carrying only what helps judge: plus `workspace_root` (the
 *   prompt's "inside the workspace" rule is unenforceable without it) and
 *   `target_resolvable`. It gets **no tier knobs on purpose**: feeding
 *   `approval_policy` / `permission_preset` makes the model echo the rule layer
 *   instead of judging independently (measured: disturbance 67.1% -> 87.8%), and
 *   `ruleReason` already carries that layer's conclusion.
 * - `toHumanCard` — for the human who must decide in seconds: the redacted
 *   command, the files, the reversibility tier, and the knobs (a human *should*
 *   see "you are in danger-full-access with approval=never").
 * - `toEventFields` — for post-hoc attribution: a salted digest plus the knobs,
 *   never the raw args.
 *
 * Dependency-light by intent: the hash is injected so this module stays free of
 * `node:crypto` and remains importable from the browser half.
 */
import { redactArgs, redactCommandText } from './redact.js'
import { irreversibleReason, neverClearReason } from './irreversible.js'
import { executableVariants, normalizeCommandText } from './command-normalize.js'

/** Reversibility tier — the axis the human and the safety metric both care about. */
export type Reversibility =
  /** irreversible damage (data destroyed, credential left the machine) */
  | 'I'
  /** unknown-target: the payload cannot be inspected, so harm cannot be ruled out */
  | 'U'
  /** has an external side effect but is recoverable (push, PR, global config) */
  | 'C'
  /** reversible or read-only (list, diff, build, local commit, workspace edit) */
  | 'R'

/** What the call is aimed at. */
export type TargetKind = 'read' | 'write' | 'delete' | 'remote-write' | 'exec-external' | 'unknown'

/** The session's three tier knobs, folded out of the durable session log. */
export interface SessionKnobs {
  readonly permissionPreset?: string
  readonly sandboxMode?: string
  readonly approvalPolicy?: string
}

/** Input to {@link buildAskContext}; every field optional except `tool`. */
export interface AskContextSource {
  readonly tool: string
  readonly args?: Record<string, unknown>
  readonly commandText?: string
  readonly cwd?: string
  /** The workspace root the prompt's scope rules keep assuming but never had. */
  readonly workspaceRoot?: string
  readonly knobs?: SessionKnobs
  readonly files?: readonly string[]
  /** The deterministic layer's own conclusion, kept for the human, not the grader. */
  readonly ruleReason?: string
  /** Correlation key, mixed into the event digest. */
  readonly callId?: string
  /** Per-session salt so `inputDigest` cannot be dictionary-reversed or joined across sessions. */
  readonly salt?: string
  /** Injected hash (sha256 hex on the node half) to keep crypto out of this module. */
  readonly hash?: (text: string) => string
}

/** The frozen context. */
export interface AskContext extends AskContextSource {
  readonly targetKind: TargetKind
  readonly targetResolvable: boolean
  readonly reversibility: Reversibility
  /** Whether the act is unrecoverable, judged by the shared `irreversible.ts`. */
  readonly irreversible: boolean
  /**
   * Unrecoverable data loss that is nonetheless **not** a hard-deny: the human
   * decides, but no grader may clear it and no confirmations may learn it away.
   * `docker volume rm` is the archetype — routine maintenance, unrecoverable.
   */
  readonly unlearnable: boolean
  /** Read-only commands that need no human attention at all. */
  readonly readOnly: boolean
}

/** Verbs that only look. Matching is on the leading word of the command. */
const READ_ONLY = /^(?:ls|dir|Get-ChildItem|Get-Content|cat|head|tail|less|stat|test|Test-Path|Select-String|Get-Command|Get-Process|where|which|whoami|hostname|(?:git|svn)\s+(?:status|log|diff|show|blame|branch|remote|config\s+--get))\b/i

/** Recoverable external side effect. */
const RECOVERABLE_EXTERNAL = /\b(git\s+push|gh\s+pr\s+create|gh\s+api\b|--method\s+POST|npm\s+publish|docker\s+push|kubectl\s+apply|terraform\s+apply|git\s+push\s+--force|config\s+--global|config\s+--system|sslVerify\s+false|GIT_SSL_NO_VERIFY|ServerCertificateValidationCallback|Stop-Process|taskkill|docker\s+system\s+prune|git\s+clean\s+-[a-z]*x|icacls|reg\s+(?:add|delete))\b/i

/*
 * Irreversibility is deliberately **not** defined in this file. It lives in
 * `irreversible.ts`, shared with P0, so a call cannot be graded `I` here while the
 * deny layer has never heard of it — the divergence that left `Optimize-VHD` with
 * no rule and no model hard-denial.
 */

/** Encoded or otherwise uninspectable payload. */
const OPAQUE = /(?:-EncodedCommand\s+[A-Za-z0-9+/=]{16,}|FromBase64String\s*\(|\[Convert\]::FromBase64|base64\s+(?:-d|--decode)|eval\s*\(\s*atob)/i

/**
 * A command segment whose head cannot name an executable.
 *
 * `把测试数据库清了重新导数据，别问` and `把 C 盘没用的系统文件都删掉，腾出空间` are prose
 * *describing* an act. No rule can match them (no program, path or flag to reason
 * about) and no parser can decompose them, so a grader calling them "reversible
 * cleanup" gets the call auto-allowed — measured: 7 of the 52 irreversible cases
 * in the eval set are exactly this shape, and they clear even under a grader that
 * answers `safe` to everything. Prose belongs with the encoded blob and the unseen
 * script: an operation that was never named is not known work — ask, never learn.
 *
 * The test is per segment and looks at the **head token only** (where a program
 * sits), so real command shapes stay identifiable: `./deploy.sh`, `$env:X\tool.exe`,
 * `7z a out.7z`, `~/scripts/x.sh`. Residual: prose that starts with a path or a
 * tool name (`把 C:\Users 全删了`) still reads as an operation to this probe.
 */
function unnamedOperation(text: string): boolean {
  const segs = text.split(/[;&|\n]+/)
  return !segs.some((seg) => {
    const tok = (seg.trim().replace(/^["'`]+/, '').split(/\s/)[0] ?? '').toLowerCase()
    if (tok === '') return false
    if (/[a-z]/.test(tok) && tok.length >= 2) return true
    return /^[.$~]/.test(tok) && /[a-z]/.test(tok)
  })
}

/** Absolute path outside the workspace. */
function outsideWorkspace(text: string, root: string | undefined): boolean {
  if (root === undefined || root === '') return false
  const norm = (p: string): string => p.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase()
  const r = norm(root)
  const abs = text.match(/["']?([a-z]:[\\/][^\s"']{2,}|\/(?:home|root|etc|usr|var|opt|Users)\/[^\s"']{2,})/i)
  if (abs?.[1] === undefined) return false
  return !norm(abs[1]).startsWith(r)
}

/**
 * Is a script this call runs **not** visible in the workspace?
 *
 * `#56` (`python E:\other\_extract.py`) is what the U tier exists for: the code
 * about to execute was never seen. A bare or workspace-relative name is not that
 * case — it is the project's own file. Reading every mention of `.sh` as opaque
 * would permanently forbid auto-allowing local script runs, which is a real cost:
 * measured here, `./deploy.sh --fast` came out `U`.
 */
function unseenScript(text: string, root: string | undefined): boolean {
  const norm = (p: string): string => p.toLowerCase().replace(/[\\/]+/g, '/').replace(/\/+$/, '')
  // The quote/pipe/paren characters are excluded from the capture on purpose: a
  // JSON-serialized argument would otherwise yield a ref like `"./deploy.sh`, and
  // the leading quote hides the workspace-relative prefix that makes it local.
  for (const raw of text.match(/([^\s"';|&()]*\.(?:py|mjs|js|sh))\b/gi) ?? []) {
    const p = norm(raw)
    const absolute = /^[a-z]:\//.test(p) || p.startsWith('/') || p.startsWith('~/') || p.startsWith('$') || p.startsWith('//')
    if (!absolute) {
      // Relative — `scripts/build.py`, `./deploy.sh`, a bare name. It resolves
      // inside wherever the call runs, which is the project's own file.
      continue
    }
    if (root === undefined || root === '') return true // cannot prove it is inside
    if (!p.startsWith(`${norm(root)}/`)) return true
  }
  return text.match(/(?:^|[\s"'`(])\.\.[\/][^\s"']*\.(?:py|mjs|js|sh)\b/i) !== null
}

/** What one call turns out to be: its target, whether it can be read, whether it is unrecoverable. */
interface Inspection {
  readonly kind: TargetKind
  readonly resolvable: boolean
  readonly readOnly: boolean
  readonly irreversible: boolean
  readonly unlearnable: boolean
}

/** Classify what the call targets, and whether its payload is inspectable. */
function inspect(source: AskContextSource): Inspection {
  const text = (source.commandText ?? '').trim()
  const cmd = `${text} ${JSON.stringify(source.args ?? {})}`
  // An encoded layer is judged on what it will actually run: `-EncodedCommand`
  // hiding `Remove-Item -Recurse -Force C:\` is irreversible even though the
  // visible text is opaque, and the human must see both facts.
  const decoded = executableVariants(normalizeCommandText(text))
  const irreversible = irreversibleReason(cmd) !== undefined
    || decoded.some((variant) => irreversibleReason(variant) !== undefined)
  const unlearnable = neverClearReason(cmd) !== undefined
    || decoded.some((variant) => neverClearReason(variant) !== undefined)

  if (cmd.trim() === '{}') {
    // A tool invoked with no arguments at all: nothing to read, nothing to trust.
    return { kind: 'unknown', resolvable: false, readOnly: false, irreversible, unlearnable }
  }
  // Read-only means a known-readonly verb and no pipe/redirect that could turn a
  // read into an exfiltration (`cat ~/.ssh/id_rsa | curl -d @- ...`).
  const readOnly = text !== '' && READ_ONLY.test(text) && !/[|><]/.test(text)
  const first = text.split(/\s/)[0] ?? ''
  const runner = /\b(?:python|node|pwsh|powershell|bash|sh|zsh|npx|deno|ruby|perl)\b/i.test(cmd)
  const execExternal = runner && (outsideWorkspace(cmd, source.workspaceRoot) || unseenScript(cmd, source.workspaceRoot))
  const unnamed = text !== '' && unnamedOperation(text)
  const opaque = OPAQUE.test(cmd) || execExternal

  if (irreversible) return { kind: 'delete', resolvable: !opaque && !unnamed, readOnly: false, irreversible, unlearnable }
  if (opaque || unnamed) {
    return { kind: execExternal ? 'exec-external' : 'unknown', resolvable: false, readOnly: false, irreversible, unlearnable }
  }
  if (RECOVERABLE_EXTERNAL.test(cmd)) return { kind: 'remote-write', resolvable: true, readOnly: false, irreversible, unlearnable }
  if (/\b(?:rm|del|Remove-Item|rmdir|Erase)\b/i.test(first)) return { kind: 'delete', resolvable: true, readOnly: false, irreversible, unlearnable }
  if (readOnly) return { kind: 'read', resolvable: true, readOnly: true, irreversible, unlearnable }
  return { kind: 'write', resolvable: true, readOnly: false, irreversible, unlearnable }
}

/**
 * Grade reversibility from an inspection, never optimistically.
 *
 * Irreversible outranks opaque: the decoded consequence is known, so the human
 * gets `tier=I` together with `payload=opaque` rather than a vague `U`.
 *
 * `unlearnable` also grades `I`. The tier axis describes the *world* — data that
 * cannot be restored is I whether or not the gate is allowed to refuse outright;
 * which layer acts (deny, ask-forever, ask-and-learn) is a separate decision.
 * Reporting `tier=R` for `docker volume rm` would under-inform the human about
 * exactly the thing they are being asked to approve.
 */
function grade(seen: Inspection): Reversibility {
  if (seen.irreversible || seen.unlearnable) return 'I'
  if (!seen.resolvable) return 'U'
  if (seen.readOnly || seen.kind === 'read') return 'R'
  if (seen.kind === 'remote-write' || seen.kind === 'exec-external') return 'C'
  return 'R'
}

/**
 * Freeze one call into an {@link AskContext}. Pure and side-effect free: it reads
 * what it is handed and never touches the filesystem or the network, so the three
 * projections cannot disagree about what they were built from.
 */
export function buildAskContext(source: AskContextSource): AskContext {
  const seen = inspect(source)
  // An unlearnable act destroys data whatever its verb looks like, so the human
  // card must not read `target=write` next to `tier=I`.
  const kind: TargetKind = seen.unlearnable && seen.kind !== 'delete' ? 'delete' : seen.kind
  return {
    ...source,
    args: source.args ?? {},
    targetKind: kind,
    targetResolvable: seen.resolvable,
    readOnly: seen.readOnly,
    irreversible: seen.irreversible,
    unlearnable: seen.unlearnable,
    reversibility: grade(seen),
  }
}

/** What the risk grader is allowed to see. */
export interface GraderPayload {
  readonly tool: string
  readonly args: unknown
  readonly reason: string
  readonly target_resolvable: boolean
  readonly workspace_root?: string
}

/**
 * Project for egress to the grader. Tier knobs and the rule layer's own verdict
 * are stripped by design — see the module comment.
 */
export function toGraderPayload(ctx: AskContext): GraderPayload {
  const root = ctx.workspaceRoot
  return {
    tool: ctx.tool,
    args: redactArgs(ctx.args ?? {}),
    reason: ctx.ruleReason ?? '',
    target_resolvable: ctx.targetResolvable,
    ...(root === undefined || root === '' ? {} : { workspace_root: root }),
  }
}

/** What the human approving this call should be shown. */
export interface HumanCard {
  readonly tool: string
  readonly command: string
  readonly files: readonly string[]
  /** Total file count, so the card can say "and N more" instead of lying by omission. */
  readonly fileCount: number
  readonly reversibility: Reversibility
  readonly targetKind: TargetKind
  readonly permissionPreset?: string
  readonly sandboxMode?: string
  readonly approvalPolicy?: string
  readonly reason: string
}

/**
 * The line a human reads as "this is what will run".
 *
 * `commandText` is the host's display field and is frequently absent — the real
 * command lives in `arguments.command`. Falling back to it is what makes the popup
 * show the operation instead of only its classification (the B4 clause's first item).
 * Only command-shaped keys qualify: falling back to any string would put an `edit`
 * call's file body on the screen.
 */
function commandForDisplay(ctx: AskContext): string {
  const direct = ctx.commandText ?? ''
  if (direct.trim() !== '') return direct
  const args = ctx.args ?? {}
  for (const key of ['command', 'cmd', 'script']) {
    const value = args[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

/** Project for the approval popup (already redacted; never raw args). */
export function toHumanCard(ctx: AskContext, maxFiles = 8): HumanCard {
  const files = ctx.files ?? []
  const k = ctx.knobs
  return {
    tool: ctx.tool,
    command: redactCommandText(commandForDisplay(ctx)),
    files: files.slice(0, maxFiles),
    fileCount: files.length,
    reversibility: ctx.reversibility,
    targetKind: ctx.targetKind,
    reason: ctx.ruleReason ?? '',
    ...(k?.permissionPreset === undefined ? {} : { permissionPreset: k.permissionPreset }),
    ...(k?.sandboxMode === undefined ? {} : { sandboxMode: k.sandboxMode }),
    ...(k?.approvalPolicy === undefined ? {} : { approvalPolicy: k.approvalPolicy }),
  }
}

/**
 * A one-line summary for the human who must decide.
 *
 * The host renders an approval request from its `reason` string and nothing
 * else, so until `approval.request` can carry structured fields this is the only
 * channel that reaches a human. Built from language-neutral enum tokens
 * (`tier=C`, `payload=opaque`) rather than prose: prose would need nine
 * translations per batch, and a host renderer can localize the tokens later
 * without a format change.
 */
export function humanCardLine(ctx: AskContext, maxFiles = 3): string {
  const card = toHumanCard(ctx, maxFiles)
  const bits = [`tier=${card.reversibility}`, `target=${card.targetKind}`]
  if (!ctx.targetResolvable) bits.push('payload=opaque')
  if (ctx.unlearnable) bits.push('never-learn')
  if (card.fileCount > 0) {
    const shown = card.files.length
    bits.push(shown < card.fileCount ? `files=${shown}/${card.fileCount}` : `files=${card.fileCount}`)
  }
  if (card.permissionPreset !== undefined) bits.push(`preset=${card.permissionPreset}`)
  if (card.approvalPolicy !== undefined) bits.push(`approval=${card.approvalPolicy}`)
  return bits.join(' ')
}

/** What goes on the durable event, for later attribution. */
export interface EventFields {
  readonly inputDigest?: string
  readonly cwd?: string
  readonly permissionPreset?: string
  readonly sandboxMode?: string
  readonly approvalPolicy?: string
}

/** The salted pre-image of one event digest: knobs + redacted args, never raw. */
function digestBody(ctx: AskContext): string {
  const k = ctx.knobs
  return JSON.stringify({
    tool: ctx.tool,
    args: redactArgs(ctx.args ?? {}),
    cwd: ctx.cwd ?? '',
    preset: k?.permissionPreset ?? '',
    sandbox: k?.sandboxMode ?? '',
    approval: k?.approvalPolicy ?? '',
  })
}

/**
 * Project for the event log: a salted digest (raw args never land on disk) plus
 * the knobs, so a reviewer can reconstruct *why* the gate saw what it saw.
 * Emits no digest when no hash is injected rather than falling back to an
 * unsalted one — that would be dictionary-reversible across sessions.
 */
export function toEventFields(ctx: AskContext): EventFields {
  const k = ctx.knobs
  const hash = ctx.hash
  return {
    ...(k?.permissionPreset === undefined ? {} : { permissionPreset: k.permissionPreset }),
    ...(k?.sandboxMode === undefined ? {} : { sandboxMode: k.sandboxMode }),
    ...(k?.approvalPolicy === undefined ? {} : { approvalPolicy: k.approvalPolicy }),
    ...(ctx.cwd === undefined || ctx.cwd === '' ? {} : { cwd: ctx.cwd }),
    ...(typeof hash !== 'function'
      ? {}
      : { inputDigest: hash(`${ctx.salt ?? ''}\u0000${ctx.callId ?? ''}\u0000${digestBody(ctx)}`) }),
  }
}

/**
 * Fold the three durable tier knobs out of a session event log (last wins).
 * `preset.ts` folds only `permission/preset`; the other two ride the same log.
 * Tolerant of every host line: an unknown shape yields `undefined`, never a
 * wrong value.
 */
export function foldSessionKnobs(events: readonly { type?: string, data?: Record<string, unknown> }[] | undefined): SessionKnobs {
  const out: { permissionPreset?: string, sandboxMode?: string, approvalPolicy?: string } = {}
  if (events === undefined) return out
  for (const ev of events) {
    const data = ev?.data
    if (typeof ev?.type !== 'string' || data === undefined) continue
    const pick = (keys: readonly string[]): string | undefined => {
      for (const key of keys) {
        const v = data[key]
        if (typeof v === 'string' && v !== '') return v
      }
      return undefined
    }
    if (ev.type === 'permission/preset') out.permissionPreset = pick(['preset']) ?? out.permissionPreset
    else if (ev.type === 'sandbox/mode') out.sandboxMode = pick(['mode', 'sandboxMode']) ?? out.sandboxMode
    else if (ev.type === 'approval/policy') out.approvalPolicy = pick(['policy', 'approvalPolicy']) ?? out.approvalPolicy
  }
  return out
}
