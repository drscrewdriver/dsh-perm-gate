/**
 * PermGateRuntime: the host-facing gate. Holds a compiled ruleset, a
 * session-scoped grant registry, an audit mirror, the verdict-learning store,
 * and the event feed. `apply` (index.ts) wires it onto the `tools/pre-execute`
 * waterfall and settles learning on `tools/result`.
 *
 * It is constructed either by the cordis `apply` (from config) or directly in
 * tests with a plain ruleset, so the whole decision path is exercised without a
 * live harness.
 */
import { readFileSync } from 'node:fs'
import { makeEntry, MemoryAuditMirror, type AuditEntry, type AuditOutcome, type DecisionSource } from './audit.js'
import { resolvePermissiveStrategies, type PermGateConfig, type PermissiveStrategies } from './config.js'
import type { ClassifierConfig } from './classifier.js'
import { appendAllowCommand, listAllowCommands, replaceAllowCommands } from './allowlist.js'
import { decide, CONTENT_ARG_KEYS, type FinalDecision, type GrantResolver } from './engine.js'
import { EventLog, type GateEvent, saveEventSnapshots } from './events.js'
import { decideRules, type ToolCallContext } from './evaluate.js'
import { canonicalizeCall, GrantRegistry } from './grant.js'
import { learnKey, operationFingerprint, RiskLearning } from './learning.js'
import { ArtifactRegistry } from './path.js'
import { classifyRisk, classifyRiskWith, type RiskRequest, type RiskVerdict } from './risk.js'
import { completeViaHost, DEFAULT_HOST_MODEL, type HostLlmLike, type HostModelSelection } from './host-llm.js'
import { chatCompletion } from './classifier.js'
import { compileDocument, documentHash, extractPathCandidates, parsePermissionsDocument, type CompiledRuleset } from './rule.js'
import { DEFAULT_DENY_KEYWORDS } from './deny-defaults.js'
import { permissionPresetOf, presetInScope, type SessionEventLike } from './preset.js'
import { resolveGatePresets } from './config.js'

export interface PreToolDecisionLike {
  kind: 'deny' | 'ask'
  reason: string
}

export interface ToolExecutionLike {
  readonly name: string
  readonly arguments: Record<string, unknown>
  readonly commandText?: string
  readonly cwd?: string
  readonly sessionId?: string
  readonly parentAuthorized?: boolean
  readonly signal?: AbortSignal
  /** Host-minted execution id; the correlation key for an ask's terminal answer. */
  readonly callId?: string
  /**
   * The host agent face. DSH carries the session here — `exec.sessionId` and
   * `exec.cwd` are usually absent — so the session id and workspace cwd must be
   * read from `agent.session.id` / `agent.session.header.cwd`.
   */
  readonly agent?: {
    readonly session?: {
      readonly id?: string
      readonly header?: { readonly cwd?: string }
      /** The durable event log; the permission-preset fold reads it. */
      readonly events?: readonly SessionEventLike[]
    }
  }
}

/** The session id of one execution (direct field, else the agent's session). */
function sessionIdOf(exec: ToolExecutionLike): string {
  if (typeof exec.sessionId === 'string' && exec.sessionId !== '') return exec.sessionId
  const id = exec.agent?.session?.id
  return typeof id === 'string' ? id : ''
}

/** The workspace cwd of one execution (direct field, else the session header). */
function cwdOf(exec: ToolExecutionLike): string | undefined {
  if (typeof exec.cwd === 'string' && exec.cwd !== '') return exec.cwd
  const cwd = exec.agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd !== '' ? cwd : undefined
}

/**
 * The face of a `tools/result` payload this plugin inspects: a human rejection
 * surfaces as `isError` plus the approval seam's reason message (see findings E3).
 */
export interface ToolResultLike {
  readonly isError?: boolean
  readonly error?: { readonly message?: string }
}

/**
 * One ask awaiting the human's answer. The event context is snapshotted when
 * the ask is recorded, because the `approval/request` observer has no execution
 * object of its own — the terminal event must still carry the right session and
 * file chips.
 */
interface PendingAsk {
  readonly reason: string
  readonly tool: string
  readonly sessionId: string
  readonly files: readonly string[]
  readonly baseDir?: string
  /** Snapshot file key: used to load pre-change snapshots for review. */
  readonly snapshotId: number
  /** Set when this ask also registered a learning candidate (drives the progress chip). */
  readonly learningKey?: string
}

export interface PermGateRuntimeOptions extends PermGateConfig {
  readonly onRulesChanged?: (ruleset: CompiledRuleset) => void
  readonly now?: () => number
  /**
   * Test/direct-use injection replacing the HTTP risk grader. Return
   * `unresolved` (or omit this hook) to stay on the human seam — fail-closed.
   */
  readonly riskHook?: (req: RiskRequest) => Promise<RiskVerdict>
  /** Optional live source of the Permissive tier (e.g. a DSH settings namespace). */
  readonly readPermissive?: () => PermissiveState
  /** Optional live source of the llmAssist classifier setup. */
  readonly readClassifyConfig?: () => ClassifierConfig
  /**
   * Optional live receiver source: `'custom'` (an OpenAI-compatible endpoint,
   * default) or `'host'` (the DSH host `llm` service — the model-group setup
   * the user already configured, via {@link hostLlm}).
   */
  readonly readClassifySource?: () => 'custom' | 'host'
  /** The host `llm` service (typed minimally); `undefined` disables the host receiver. */
  readonly hostLlm?: HostLlmLike
  /**
   * Live model-group selection for the host receiver (e.g. DSH's
   * agentDefaultModel.currentSelection, possibly overridden from settings).
   */
  readonly readHostModel?: () => HostModelSelection | undefined
  /**
   * Optional live source of the verdict-learning state. When unset, the static
   * `riskLearning` / `riskThreshold` options apply.
   */
  readonly readRiskLearning?: () => RiskLearningState
  /**
   * Optional live switch for learning sedimentation (default on while verdict
   * learning is enabled): a threshold-reached key's confirmed fingerprint
   * becomes a deterministic auto-allow — no LLM round-trip, and it survives
   * the llmAssist switch because the human confirmations already happened.
   */
  readonly readRiskSediment?: () => boolean
  /**
   * Optional live source of the deny-keyword blacklist. `undefined` or an
   * empty array applies the preset `DEFAULT_DENY_KEYWORDS` (the blacklist is
   * protective and never silently off); a non-empty array replaces the preset.
   */
  readonly readDenyKeywords?: () => readonly string[] | undefined
  /**
   * Optional live source of the session's effective approval policy (`'ask'` /
   * `'never'`), normally `approval.effectivePolicy(agent.session)`. Under
   * `'never'` the DSH approval seam rejects every request before any answerer
   * runs, so an ask the gate cannot answer degrades to passthrough instead of
   * becoming a denial that reads as "the user rejected tool ...".
   */
  readonly readApprovalPolicy?: (exec: ToolExecutionLike) => string | undefined
  /** Persistence path for verdict learning; `undefined` keeps it in memory. */
  readonly learningFile?: string
  /** Persistence path for the decision-event feed; `undefined` disables it. */
  readonly eventsFile?: string
  /**
   * Directory for per-event pre-change file snapshots; `undefined` disables the
   * review page's diff/revert data plane (events are still recorded).
   */
  readonly snapshotsDir?: string
}

export type CallDecision = 'allow' | 'deny' | 'ask'

/** The effective Permissive tier state read per tool call. */
export interface PermissiveState {
  readonly enabled: boolean
  readonly strategies: PermissiveStrategies
}

/** The effective verdict-learning state read per decision. */
export interface RiskLearningState {
  readonly enabled: boolean
  readonly threshold: number
}

/** Upper bound on in-flight learning candidates awaiting `tools/result`. */
const PENDING_CAP = 100

export class PermGateRuntime {
  private ruleset: CompiledRuleset
  private readonly grants: GrantRegistry
  private readonly artifacts = new ArtifactRegistry()
  private readonly audit = new MemoryAuditMirror()
  private readonly cache = new Map<string, CompiledRuleset>() // hash -> compiled
  private readonly permissiveEnabled: boolean
  private readonly strategies: PermissiveStrategies
  /** Presets in which this gate is active at all; outside them it stands down. */
  private readonly gatePresets: readonly string[]
  /** Extra tool names the user classified as safe (config `autoAllowTools`). */
  private readonly autoAllowExtra: ReadonlySet<string>
  /** Cache of the permission-preset fold, keyed by log identity + length. */
  private presetCache: { events: readonly SessionEventLike[] | undefined; length: number; preset: string | undefined } | undefined
  private readonly learning: RiskLearning
  private readonly events?: EventLog
  /** Learning candidates awaiting human approval + execution (call fingerprint → candidate). */
  private readonly pending = new Map<string, { key: string; fp: string; ctx: string }>()
  /**
   * Asks awaiting the human's terminal answer, keyed by {@link askKey}. Both the
   * approval observer (primary) and `tools/result` (fallback) settle an entry by
   * deleting it — "delete on settle" is the whole de-duplication rule, so a
   * missing `callId` or an untriggered observer can never lose a record.
   */
  private readonly pendingAsks = new Map<string, PendingAsk>()

  constructor(private readonly options: PermGateRuntimeOptions = {}) {
    this.grants = new GrantRegistry('__session__', options.now)
    this.permissiveEnabled = options.permissive ?? false
    // An embedding that never states a scope keeps the historical behaviour
    // (the gate acts in every preset); the plugin always passes the resolved
    // scope from `resolveConfig`, whose product default is `['permissive']`.
    this.gatePresets = options.gatePresets === undefined ? ['*'] : resolveGatePresets(options.gatePresets)
    this.autoAllowExtra = new Set(
      (options.autoAllowTools ?? []).filter((name) => typeof name === 'string' && name !== ''),
    )
    this.strategies = resolvePermissiveStrategies(options.permissiveStrategies)
    this.learning = new RiskLearning(options.learningFile, {
      threshold: () => this.liveRiskLearning().threshold,
      now: options.now,
    })
    this.events = options.eventsFile !== undefined
      ? new EventLog(options.eventsFile, options.now, options.snapshotsDir)
      : undefined
    this.ruleset = this.compileInline(options)
  }

  private compileInline(options: PermGateRuntimeOptions): CompiledRuleset {
    const text = options.rulesFile !== undefined ? readFileSafe(options.rulesFile) : ''
    const empty: CompiledRuleset = {
      defaultAction: options.defaultAction ?? 'ask',
      deny: [], allow: [], ask: [],
      caseInsensitivePaths: options.caseInsensitivePaths ?? true,
    }
    if (text === '') return empty
    const hash = documentHash(text)
    const hit = this.cache.get(hash)
    if (hit !== undefined) return hit
    const doc = parsePermissionsDocument(text)
    const compiled = compileDocument(doc, {
      maxGlobStars: 2,
      caseInsensitivePaths: options.caseInsensitivePaths ?? true,
    })
    this.cache.set(hash, compiled)
    return compiled
  }

  /** Reload rules from disk (HMR); on failure keeps the previous rules. */
  reload(): boolean {
    try {
      const next = this.compileInline(this.options)
      this.ruleset = next
      this.options.onRulesChanged?.(next)
      return true
    } catch {
      return false // keep previous rules; never crash the host
    }
  }

  get auditEntries(): readonly AuditEntry[] {
    return this.audit.entries
  }

  grantCount(): number {
    return this.grants.size
  }

  get defaultAction(): string {
    return this.ruleset.defaultAction
  }

  ruleCount(): number {
    return this.ruleset.deny.length + this.ruleset.allow.length + this.ruleset.ask.length
  }

  /** Whether the independent Permissive tier is active (single front switch). */
  get permissive(): boolean {
    return this.permissiveEnabled
  }

  /** Backend approval strategy booleans active when Permissive is on. */
  get permissiveStrategies(): Readonly<PermissiveStrategies> {
    return this.strategies
  }

  artifactCount(): number {
    return this.artifacts.snapshot()
  }

  /** The decision-event feed (undefined when event recording is disabled). */
  get eventLog(): EventLog | undefined {
    return this.events
  }

  /** The snapshot directory backing diff/revert (undefined when disabled). */
  get snapshotDir(): string | undefined {
    return this.options.snapshotsDir
  }

  /** Learning candidates currently awaiting settlement (diagnostics/tests). */
  pendingCount(): number {
    return this.pending.size
  }

  /** Deep read-only view of the learning state (diagnostics/tests). */
  learningSnapshot(): ReturnType<RiskLearning['snapshot']> {
    return this.learning.snapshot()
  }

  private ctxFor(exec: ToolExecutionLike): ToolCallContext {
    const cwd = cwdOf(exec) ?? process.cwd()
    return {
      tool: exec.name,
      args: exec.arguments ?? {},
      commandText:
        exec.commandText ?? (typeof exec.arguments.command === 'string' ? exec.arguments.command : undefined),
      cwd,
      // The workspace root (the session's cwd). The write-path override in
      // `decideRules` uses this to determine whether a write/edit target is
      // inside the workspace or outside it.
      home: cwdOf(exec),
      caseInsensitive: this.options.caseInsensitivePaths ?? true,
      dshHome: this.options.dshHome,
    }
  }

  private liveRiskLearning(): RiskLearningState {
    const read = this.options.readRiskLearning
    if (read !== undefined) return read()
    return { enabled: this.options.riskLearning ?? false, threshold: this.options.riskThreshold ?? 3 }
  }

  private liveRiskSediment(): boolean {
    const read = this.options.readRiskSediment
    return read !== undefined ? read() : (this.options.riskSediment ?? true)
  }

  private liveClassifySource(): 'custom' | 'host' {
    const read = this.options.readClassifySource
    return read !== undefined ? read() : 'custom'
  }

  /** The host model-group selection, or undefined when unusable. */
  private hostModel(): HostModelSelection | undefined {
    const sel = this.options.readHostModel?.()
    return sel !== undefined && sel.provider !== '' && sel.model !== '' ? sel : undefined
  }

  private livePermissive(): PermissiveState {
    return this.options.readPermissive !== undefined
      ? this.options.readPermissive()
      : { enabled: this.permissiveEnabled, strategies: this.strategies }
  }

  /**
   * The session's selected permission preset, folded from its event log. The
   * fold is cached by the log array identity plus its length: a session's log
   * is a stable, append-only array, so a changed reference or a grown log
   * invalidates the cache while repeated calls on the same log stay cheap.
   */
  private presetOf(exec: ToolExecutionLike): string | undefined {
    const events = exec.agent?.session?.events
    const length = events?.length ?? -1
    const cached = this.presetCache
    if (cached !== undefined && cached.events === events && cached.length === length) return cached.preset
    const preset = permissionPresetOf(events)
    this.presetCache = { events, length, preset }
    return preset
  }

  /**
   * Whether this gate is active for one call at all.
   *
   * The gate owns an independent permission tier, so it only acts while that
   * tier (or another preset the user listed in `gatePresets`) is selected.
   * Outside it the gate stands down completely — no allow, no ask, no deny, no
   * P0 hard-deny — because the selected tier's own policy governs the session:
   * `danger-full-access` means "full access without approval prompts", where a
   * forwarded ask can only fail (the approval seam rejects before any answerer
   * runs) and a hard-deny would silently overrule the tier the user chose.
   */
  private gateActive(exec: ToolExecutionLike): boolean {
    return presetInScope(this.presetOf(exec), this.gatePresets)
  }

  /**
   * Whether an `ask` produced while the gate is active can actually reach a
   * human. Under `approval: never` the DSH approval seam returns `rejected`
   * before any answerer runs, so such an ask degrades to passthrough.
   *
   * The reader is an optional duck-typed seam (the host half probes a PRIVATE
   * approval-service method, identical in DSH 0.1.1-rc.2 and 0.1.2-rc.1). A
   * throwing reader must not kill the decision path: "unknown" is treated as
   * answerable, so the ask stands and the approval seam decides.
   */
  private askAnswerable(exec: ToolExecutionLike): boolean {
    try {
      return this.options.readApprovalPolicy?.(exec) !== 'never'
    } catch {
      return true
    }
  }

  /** Effective deny-keyword blacklist: the live namespace override or the preset.
   * An empty override is treated as "no meaningful override" (the blacklist is
   * protective and stays on); schemastery materializes unset arrays as `[]`. */
  private liveDenyKeywords(): readonly string[] {
    const read = this.options.readDenyKeywords
    const override = read !== undefined ? read() : undefined
    return Array.isArray(override) && override.length > 0 ? override : DEFAULT_DENY_KEYWORDS
  }

  /**
   * The preset deny-keyword layer (inherited from dsh-approval-gate): a keyword
   * hit over the call's command/argument text vetoes it with `deny` before any
   * allow path (deny wins over allow). Purely additive to P0 — it can only ever
   * deny, never widen. Matching is boundary-aware and skips document bodies, so
   * a keyword can no longer veto an unrelated identifier or a file's text.
   */
  private denyKeywordHit(exec: ToolExecutionLike): string | undefined {
    const keywords = this.liveDenyKeywords()
    if (keywords.length === 0) return undefined
    const text = denyScanText(exec)
    if (text === '') return undefined
    for (const keyword of keywords) {
      if (String(keyword).trim() === '') continue
      if (keywordMatcher(String(keyword)).test(text)) return keyword
    }
    return undefined
  }

  /**
   * Record one decision event on the feed. `verdict` labels the decision path
   * for the history view; `files` (defaulted from the call itself) drives the
   * snapshot/diff/revert chain, and `baseDir` resolves relative paths.
   */
  private recordEvent(
    exec: ToolExecutionLike,
    kind: GateEvent['kind'],
    reason: string,
    extra: {
      risk?: string
      verdict?: string
      justification?: string
      category?: string
      files?: readonly string[]
      learningCount?: number
      threshold?: number
    } = {},
  ): void {
    this.events?.append({
      sessionId: sessionIdOf(exec),
      tool: exec.name,
      kind,
      risk: extra.risk,
      reason,
      verdict: extra.verdict,
      justification: extra.justification ?? reason,
      category: extra.category,
      files: extra.files ?? eventFiles(exec),
      learningCount: extra.learningCount,
      threshold: extra.threshold,
      baseDir: cwdOf(exec),
    })
  }

  /** The correlation key of one ask: its call id, or a canonical call fingerprint. */
  private askKey(exec: ToolExecutionLike): string {
    return typeof exec.callId === 'string' && exec.callId !== ''
      ? `id:${exec.callId}`
      : `fp:${canonicalizeCall(exec.name, exec.arguments ?? {})}`
  }

  /** Remember one ask so either settlement channel can record its terminal answer. */
  private trackAsk(exec: ToolExecutionLike, reason: string, learningKey?: string): void {
    if (this.pendingAsks.size >= PENDING_CAP) {
      const oldest = this.pendingAsks.keys().next()
      if (!oldest.done) this.pendingAsks.delete(oldest.value)
    }
    // Generate a synthetic snapshot ID since we no longer record 'ask' events
    // (they'd pollute the approval record). Snapshots are keyed by this ID.
    const now = typeof this.options.now === 'function' ? this.options.now : Date.now
    const snapshotId = now()
    const pending: PendingAsk = {
      reason,
      tool: exec.name,
      sessionId: sessionIdOf(exec),
      files: eventFiles(exec),
      baseDir: cwdOf(exec),
      snapshotId,
      learningKey,
    }
    this.pendingAsks.set(this.askKey(exec), pending)
    // Save pre-change snapshots so the review page can diff/revert later.
    if (pending.files.length > 0 && this.snapshotDir) {
      try {
        saveEventSnapshots(this.snapshotDir, snapshotId, pending.files, pending.baseDir, pending.sessionId, now)
      } catch { /* best-effort */ }
    }
  }

  /** Drop one tracked ask without recording it (the call never needed a human). */
  private untrackAsk(exec: ToolExecutionLike): void {
    this.pendingAsks.delete(this.askKey(exec))
  }

  /** Asks currently awaiting a terminal answer (diagnostics/tests). */
  pendingAskCount(): number {
    return this.pendingAsks.size
  }

  /** Get one pending ask by its key (diagnostics/tests only). */
  getPendingAsk(key: string): PendingAsk | undefined {
    return this.pendingAsks.get(key)
  }

  /**
   * Decide one tool call. Returns a decision to veto (`deny`/`ask`) or
   * undefined to delegate via `next()` (allow / passthrough). Always records an
   * audit entry and a decision event. Grant consumption happens inside
   * {@link decide}; a call that targets a different fingerprint than any minted
   * grant no-ops. An `ask` verdict may afterwards be refined by
   * {@link refineAsk} (LLM risk grading + verdict learning) before it reaches
   * the human seam.
   */
  decideExecution(exec: ToolExecutionLike): PreToolDecisionLike | undefined {
    // The gate is scoped to its own tier(s): anywhere else it stands down
    // entirely and records nothing (the session's selected tier owns the call).
    if (!this.gateActive(exec)) return undefined

    const ctx = this.ctxFor(exec)
    const callId = randomId()

    // Preset deny-keyword layer (deny wins over allow): a dangerous-keyword hit
    // vetoes before grants / rules / LLM. Additive deny only — P0 semantics are
    // untouched and every later stage stays behind this veto.
    const keyword = this.denyKeywordHit(exec)
    if (keyword !== undefined) {
      const reason = `deny-keyword: matches preset blacklist entry "${keyword}"`
      this.audit.append(makeEntry({ callId, tool: exec.name, outcome: 'deny', source: 'deny-keyword', reason, at: Date.now() }))
      this.recordEvent(exec, 'deny', reason, { verdict: 'deny-keyword' })
      return { kind: 'deny', reason }
    }

    const grantResolver: GrantResolver = (tool, args) => {
      if (exec.parentAuthorized === false) return 'no-match'
      return this.grants.decide(tool, args)
    }

    const raw = decide(ctx, { decide: (c) => decideRules(this.ruleset, c) }, grantResolver, this.autoAllowExtra)
    const decision = this.applyPermissive(raw)

    let outcome: AuditOutcome
    let source: DecisionSource
    switch (decision.stage) {
      case 'hard-deny':
        outcome = 'deny'
        source = 'hard-deny'
        break
      case 'grant':
        outcome = 'allow'
        source = 'grant'
        break
      case 'rule':
        outcome = decision.action === 'ask' ? 'ask' : decision.action
        source = 'rule'
        break
      case 'classifier':
        outcome = decision.action
        source = 'classifier'
        break
      case 'default':
      case 'ask':
        outcome = decision.action
        source = decision.reason.startsWith('permissive') ? 'permissive' : 'default'
        break
    }
    // An ask the gate cannot deliver: under `approval: never` the DSH approval
    // seam rejects before any answerer runs, so forwarding it would only ever
    // produce `the user rejected tool "..."`. Degrade to passthrough instead.
    if (decision.action === 'ask' && !this.askAnswerable(exec)) {
      const reason = `passthrough: approval policy "never" cannot answer an ask — ${decision.reason}`
      this.audit.append(makeEntry({ callId, tool: exec.name, outcome: 'allow', source, reason, at: Date.now() }))
      this.recordEvent(exec, 'auto', reason, { verdict: 'preset-passthrough' })
      return undefined
    }

    // Only log terminal outcomes; 'ask' is intermediate and must not pollute
    // the audit or the event feed — recording it would be recursive since the
    // user's terminal answer comes back through tools/result anyway.
    if (outcome !== 'ask') {
      this.audit.append(makeEntry({ callId, tool: exec.name, outcome, source, reason: decision.reason, at: Date.now() }))
      this.recordEvent(exec, outcome === 'allow' ? 'auto' : outcome === 'deny' ? 'deny' : 'ask', decision.reason, { verdict: source })
    }

    if (decision.action === 'deny') return { kind: 'deny', reason: decision.reason }
    if (decision.action === 'ask') {
      // Track before returning: the approval observer can settle this ask
      // before the call ever reaches `tools/result`.
      this.trackAsk(exec, decision.reason)
      return { kind: 'ask', reason: decision.reason }
    }
    return undefined
  }

  /**
   * Apply the Permissive tier to a raw decision. Hard-deny and minted-grant
   * outcomes are never touched (fail-closed). `alwaysConfirm` escalates a
   * rule-allow to `ask` — which the caller may then refine via
   * {@link refineAsk}. `trustAutoAllow` is the baseline middle-tier auto-allow
   * and needs no modulation here; llmAssist refinement lives in
   * {@link refineAsk} because it is asynchronous.
   */
  private applyPermissive(raw: FinalDecision): FinalDecision {
    const permissive = this.livePermissive()
    if (!permissive.enabled) return raw
    const { strategies: str } = permissive
    if (str.alwaysConfirm && raw.action === 'allow' && raw.stage === 'rule') {
      return { action: 'ask', reason: 'permissive always-confirm escalated rule-allow to ask', stage: 'default', ruleIndex: raw.ruleIndex }
    }
    return raw
  }

  /**
   * Refine an `ask` decision with the configured LLM risk grader
   * (`llmAssist` strategy). Returns `undefined` to allow (delegate via
   * `next()`), or the decision to keep vetoing with. Every uncertainty path —
   * strategy off, no classifier setup, transport failure, off-protocol output —
   * keeps the original ask (fail-closed). Only a `neutral` risk under an
   * enabled learning store registers a pending candidate; its confirmation is
   * settled by {@link settleExecution} when the call actually executes.
   */
  async refineAsk(exec: ToolExecutionLike, decision: PreToolDecisionLike): Promise<PreToolDecisionLike | undefined> {
    const permissive = this.livePermissive()
    if (!permissive.enabled) return decision
    if (decision.kind !== 'ask') return decision

    // Sedimented learning rules (checked before any LLM work): a confirmed
    // sample of a threshold-reached key auto-allows deterministically. This is
    // the "沉淀" of verdict learning — it keeps working even with llmAssist
    // off, because the human confirmations already happened. Deny-first and
    // P0 are untouched: this only ever converts an `ask` into an allow.
    const learning = this.liveRiskLearning()
    if (learning.enabled && this.liveRiskSediment()) {
      const fp = operationFingerprint(exec.name, exec.arguments ?? {}, exec.commandText)
      const key = learnKey(exec.name, 'neutral', fp)
      if (this.learning.shouldAutoAllow(key, fp)) {
        const reason = `learned sediment allow (${key}, ${fp})`
        this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }))
        this.recordEvent(exec, 'learned', reason, { risk: 'neutral', verdict: 'learned-sediment', category: 'neutral' })
        this.untrackAsk(exec) // auto-allowed: no human answer is coming
        return undefined
      }
    }

    if (!permissive.strategies.llmAssist) return decision

    // One live read of the classifier setup. Without a usable receiver (a
    // configured custom endpoint, or the host llm service in host mode) the
    // ask goes straight to the human seam (fail-closed) — unless a risk hook
    // is injected (tests / direct embedding replace the grader entirely).
    const cfg = this.options.readClassifyConfig?.()
    const useHost = this.liveClassifySource() === 'host' && this.options.hostLlm !== undefined
    if (this.options.riskHook === undefined && !useHost
      && (cfg?.endpoint === undefined || cfg?.endpoint === '' || cfg?.model === undefined || cfg?.model === '')) {
      return decision
    }

    const req: RiskRequest = { tool: exec.name, args: exec.arguments ?? {}, reason: decision.reason }
    let risk: RiskVerdict
    if (this.options.riskHook !== undefined) {
      risk = await this.options.riskHook(req)
    } else if (useHost) {
      const selection = this.hostModel() ?? DEFAULT_HOST_MODEL
      risk = await classifyRiskWith(
        (system, user) => completeViaHost(this.options.hostLlm as HostLlmLike, selection, system, user, cfg?.timeoutMs ?? 20_000),
        req,
      )
    } else {
      risk = await classifyRisk(cfg ?? {}, req)
    }

    if (risk.kind === 'safe') {
      const reason = `llm-assist risk: safe${risk.reason === undefined ? '' : ` (${risk.reason})`}`
      this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }))
      this.recordEvent(exec, 'auto', reason, { risk: 'safe', verdict: 'llm-safe' })
      this.untrackAsk(exec) // auto-allowed: no human answer is coming
      return undefined
    }

    if (risk.kind === 'risky') {
      if (risk.category !== 'neutral') {
        // Hard category (deletion / credential / remote / system / bulk) or an
        // off-protocol output graded hard: auto-deny. The operation is clearly
        // dangerous or sensitive — no popup, no learning, just block.
        const reason = `${decision.reason} [llm-assist risky:${risk.category} → auto-deny]`
        this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'deny', source: 'classifier', reason, at: Date.now() }))
        this.recordEvent(exec, 'deny', reason, { risk: risk.category, verdict: 'llm-deny', category: risk.category })
        this.untrackAsk(exec)
        return { kind: 'deny', reason }
      }

      const learning = this.liveRiskLearning()
      const fp = operationFingerprint(exec.name, exec.arguments ?? {}, exec.commandText)
      const key = learnKey(exec.name, risk.category, fp)
      if (learning.enabled && this.learning.shouldAutoAllow(key, fp)) {
        const reason = `llm-assist learned allow (${key}, ${fp})`
        this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }))
        this.recordEvent(exec, 'auto', reason, { risk: risk.category, verdict: 'llm-learned', category: risk.category })
        this.untrackAsk(exec) // auto-allowed: no human answer is coming
        return undefined
      }
      if (learning.enabled) {
        if (this.pending.size >= PENDING_CAP) {
          const oldest = this.pending.keys().next()
          if (!oldest.done) this.pending.delete(oldest.value)
        }
        this.pending.set(canonicalizeCall(exec.name, exec.arguments ?? {}), { key, fp, ctx: decision.reason })
      }
      const neutralReason = `${decision.reason} [llm-assist risky:neutral]`
      // The refined reason supersedes the raw ask, and the candidate key lets the
      // terminal event report the post-approval learning progress.
      this.trackAsk(exec, neutralReason, learning.enabled ? key : undefined)
      return { kind: 'ask', reason: neutralReason }
    }

    // unresolved: keep the ask, learn nothing.
    return decision
  }

  /**
   * Record the human's terminal answer for one tracked ask. This is the primary
   * channel, driven by the `approval/request` observer, which sees the closed
   * outcome (`allowed-once` / `rejected` / `cancelled` / `unavailable`) without
   * having to parse any reason text.
   *
   * Consuming the entry is the entire de-duplication rule: a second call for the
   * same ask — or a later `tools/result` — finds nothing and records nothing.
   * @returns whether an ask was settled.
   */
  settleAskOutcome(callId: string, outcome: string): boolean {
    if (callId === '') return false
    const key = `id:${callId}`
    const ask = this.pendingAsks.get(key)
    if (ask === undefined) return false
    this.pendingAsks.delete(key)
    this.recordAskOutcome(ask, outcome)
    return true
  }

  /**
   * Settle after the call finished (`tools/result`): the fallback channel for an
   * ask whose approval never surfaced to the observer (no approval service, a
   * missing `callId`, or an earlier listener short-circuiting the waterfall).
   * Also settles a pending learning candidate: a result for one means the human
   * approved it and it actually executed — one confirmation.
   */
  settleExecution(exec: ToolExecutionLike, result?: ToolResultLike): void {
    this.settleAskFromResult(exec, result)

    const callKey = canonicalizeCall(exec.name, exec.arguments ?? {})
    const candidate = this.pending.get(callKey)
    if (candidate === undefined) return
    this.pending.delete(callKey)
    if (!this.liveRiskLearning().enabled) return
    this.learning.confirm(candidate.key, candidate.fp, candidate.ctx)
    this.recordEvent(exec, 'learned', `confirmed ${candidate.key} (${candidate.fp})`, { risk: 'neutral', verdict: 'learned-confirm', category: 'neutral' })
  }

  /**
   * Promote a pending learning candidate to a session-level grant: the same
   * operation auto-passes for the rest of the session (bounded by TTL and
   * max-uses) without waiting for human confirmations. This is the "one-click
   * allow in session" shortcut the settings card can expose.
   *
   * @returns `true` when a pending candidate was promoted.
   */
  approveSessionGrant(exec: ToolExecutionLike): boolean {
    const callKey = canonicalizeCall(exec.name, exec.arguments ?? {})
    const candidate = this.pending.get(callKey)
    if (candidate === undefined) return false
    this.pending.delete(callKey)
    // Record the learning confirmation so sediment also benefits.
    if (this.liveRiskLearning().enabled) {
      this.learning.confirm(candidate.key, candidate.fp, candidate.ctx)
    }
    this.grants.mint({
      tool: exec.name,
      fingerprint: callKey,
      decidedBy: 'human',
      parentAuthorized: exec.parentAuthorized !== false,
      ttlMs: this.options.grantTtlMs ?? 5 * 60_000,
      maxUses: this.options.grantMaxUses ?? 1,
    })
    this.untrackAsk(exec)
    this.recordEvent(exec, 'learned', `approved session grant (${candidate.key}, ${candidate.fp})`, { risk: 'neutral', verdict: 'learned-granted', category: 'neutral' })
    return true
  }

  /** Classify one `tools/result` payload into the ask's terminal outcome. */
  private settleAskFromResult(exec: ToolExecutionLike, result: ToolResultLike | undefined): void {
    const key = this.askKey(exec)
    const ask = this.pendingAsks.get(key)
    if (ask === undefined) return
    const message = typeof result?.error?.message === 'string' ? result.error.message : ''
    const failed = result?.isError === true
    let outcome: string
    if (!failed) outcome = 'allowed-once'
    else if (/rejected tool/i.test(message)) outcome = 'rejected'
    else if (/was cancelled/i.test(message)) outcome = 'cancelled'
    else if (/approval/i.test(message)) outcome = 'unavailable'
    // The human allowed it and the tool failed on its own afterwards.
    else outcome = 'allowed-once'
    this.pendingAsks.delete(key)
    this.recordAskOutcome(ask, outcome)
  }

  /**
   * Write one terminal event from the ask's snapshotted context. The observer
   * has no execution object of its own, so everything here comes from what
   * {@link trackAsk} captured when the ask was recorded.
   */
  private recordAskOutcome(ask: PendingAsk, outcome: string): void {
    const exec: ToolExecutionLike = {
      name: ask.tool,
      arguments: {},
      sessionId: ask.sessionId,
      cwd: ask.baseDir,
    }
    if (outcome === 'allowed-once') {
      const learning = this.liveRiskLearning()
      // Report the post-approval progress: a registered candidate is confirmed
      // by `tools/result` right after this, so it counts as this approval.
      const key = ask.learningKey ?? learnKey(ask.tool, 'neutral')
      const learningCount = learning.enabled
        ? this.learning.count(key) + (ask.learningKey === undefined ? 0 : 1)
        : undefined
      this.recordEvent(exec, 'manual-approved', ask.reason, {
        verdict: 'human-approved',
        files: ask.files,
        learningCount,
        threshold: learning.enabled ? learning.threshold : undefined,
      })
      return
    }
    if (outcome === 'rejected') {
      this.recordEvent(exec, 'manual-rejected', ask.reason, { verdict: 'human-rejected', files: ask.files })
      return
    }
    if (outcome === 'cancelled') {
      this.recordEvent(exec, 'manual-cancelled', ask.reason, { verdict: 'human-cancelled', files: ask.files })
      return
    }
    // `unavailable`: no human was involved — the ask degraded to a denial.
    this.recordEvent(exec, 'deny', ask.reason, { verdict: 'no-approval-channel', files: ask.files })
  }

  // ---- Learning-store management (the settings UI's sediment view) ----

  /** The live confirmation threshold the sediment view compares counts against. */
  learningThreshold(): number {
    return this.liveRiskLearning().threshold
  }

  /** Terminate one key's learning, or drop a single sedimented sample. */
  learningReset(key: string, fp?: string): void {
    if (fp !== undefined) this.learning.dropSample(key, fp)
    else this.learning.resetKey(key)
  }

  /**
   * One minimal completion through the currently configured receiver (host
   * model group or custom endpoint) with latency — the settings card's
   * "health test". Never throws; failures come back as `ok: false` + detail.
   */
  async healthCheck(): Promise<{ ok: boolean; ms: number; detail: string }> {
    const now = this.options.now ?? Date.now
    const start = now()
    const done = (ok: boolean, detail: string): { ok: boolean; ms: number; detail: string } => ({ ok, ms: now() - start, detail })
    try {
      const cfg = this.options.readClassifyConfig?.()
      if (this.liveClassifySource() === 'host') {
        if (this.options.hostLlm === undefined) return done(false, 'host llm service unavailable')
        const selection = this.hostModel() ?? DEFAULT_HOST_MODEL
        const r = await completeViaHost(this.options.hostLlm, selection, 'Reply with exactly: OK', 'ping', cfg?.timeoutMs ?? 20_000)
        return r.ok ? done(true, `${selection.provider}/${selection.model} → ${r.content.trim().slice(0, 60) || 'ok'}`) : done(false, r.error ?? 'host llm call failed')
      }
      if (cfg?.endpoint === undefined || cfg.endpoint === '' || cfg?.model === undefined || cfg.model === '') {
        return done(false, 'custom endpoint/model not configured')
      }
      const r = await chatCompletion(cfg, 'Reply with exactly: OK', 'ping')
      if (r.ok) return done(true, `${cfg.model} → ${r.content.trim().slice(0, 60) || 'ok'}`)
      // Name the failing leg of the endpoint/model/key triple when possible.
      const why = r.error === 'timeout'
        ? `timeout after ${cfg.timeoutMs ?? 20_000} ms`
        : r.status === 401 || r.status === 403
          ? `HTTP ${r.status} — API key rejected`
          : r.status === 404
            ? 'HTTP 404 — endpoint path or model id not found'
            : r.status !== undefined
              ? `HTTP ${r.status} — request rejected (check model id / endpoint shape)`
              : 'network error (endpoint unreachable)'
      return done(false, why)
    } catch (e) {
      return done(false, String((e as Error)?.message ?? e))
    }
  }

  /** Mint a precise session grant bound to a canonical call fingerprint. */
  grant(exec: ToolExecutionLike, maxUses: number, ttlMs: number): void {
    const args = exec.arguments ?? {}
    this.grants.mint({
      tool: exec.name,
      fingerprint: canonicalizeCall(exec.name, args),
      decidedBy: 'human',
      parentAuthorized: exec.parentAuthorized !== false,
      ttlMs,
      maxUses,
    })
  }

  /**
   * Grant "repeat this call for the current session" (the always-confirm panel's
   * first extended allow button): mint a bounded session grant for the exact
   * call so an identical re-run this session passes without asking again.
   */
  approveRepeat(exec: ToolExecutionLike, maxUses = this.options.grantMaxUses ?? 3, ttlMs = this.options.grantTtlMs ?? 5 * 60_000): void {
    this.grant(exec, maxUses, ttlMs)
  }

  /**
   * Grant "allow every occurrence of this command" (the always-confirm panel's
   * second extended allow button): persist the command into the rules file's
   * `allow` whitelist and reload. Returns the reload result.
   */
  approveAllowEverywhere(commandWord: string, reason = 'permissive allow-everywhere'): boolean {
    if (!this.options.rulesFile) return false
    if (!appendAllowCommand(this.options.rulesFile, commandWord, reason)) return false
    return this.reload()
  }

  /** Read-only view of the current allow-list command patterns (whitelist). */
  allowlist(): readonly string[] {
    if (!this.options.rulesFile) return []
    return listAllowCommands(this.options.rulesFile)
  }

  /**
   * Replace the whitelist with exactly the given command patterns and reload.
   * Returns the reload result (false when no rulesFile or the write failed).
   */
  setAllowlist(patterns: readonly string[]): boolean {
    if (!this.options.rulesFile) return false
    if (!replaceAllowCommands(this.options.rulesFile, patterns)) return false
    return this.reload()
  }
}

function readFileSafe(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

/** Path-ish tokens and bare filenames lifted out of a command string. */
const COMMAND_PATH_RE = /(?:~\/|\/|\.\/)?[\w@.-]+[\\/][\w@.\\/-]+/g
const COMMAND_FILE_RE = /[\w@.-]+\.(?:md|js|json|ya?ml|env|txt|py|ts|tsx|css|html|log|mjs|cjs|sh|ps1|toml|ini|cfg|conf)/gi
/** A bare filename (no separator) still names a real target. */
const BARE_FILE_RE = /^[\w@.-]+\.(?:md|js|json|ya?ml|env|txt|py|ts|tsx|css|html|log|mjs|cjs|sh|ps1|toml|ini|cfg|conf)$/i

/**
 * Paths one decision concerns, for the review page's file chips and snapshots.
 * Explicit argument candidates win (edit/write/read style tools); otherwise the
 * paths are lifted from a write-shaped shell command only — a read command
 * (cat/tail/grep) changes nothing, so its paths would be false positives.
 */
function eventFiles(exec: ToolExecutionLike): readonly string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (value: unknown): void => {
    if (typeof value !== 'string') return
    const seg = value.trim()
    if (seg.length < 3 || seg.length > 1024) return
    if (/^(https?:|data:|blob:)/i.test(seg)) return
    if (!seg.includes('/') && !seg.includes('\\') && !BARE_FILE_RE.test(seg)) return
    if (seen.has(seg)) return
    seen.add(seg)
    out.push(seg)
  }

  for (const candidate of extractPathCandidates(exec.arguments ?? {})) add(candidate)

  if (out.length === 0) {
    const raw = typeof exec.arguments?.command === 'string'
      ? exec.arguments.command
      : (exec.commandText ?? '')
    if (raw !== '') {
      // Strip stderr suppression (2>/dev/null, 2>&1) — a read command's idiom,
      // never a write target.
      const clean = raw.replace(/2>>?\/dev\/null/g, ' ').replace(/2>&1/g, ' ')
      const hasWrite = /(^|[;&|]\s*)(touch|cp|mv|rm|tee|mkdir|rmdir|install|dd|truncate|shred|chmod|chown|chgrp)\b/i.test(clean)
        || /(^|[;&|]\s*)(sed|perl|python|node|ruby)\b[^;|]*\s-i\b/i.test(clean)
        || /(^|[;&|]\s*)(curl|wget)\b[^;|]*\s(-o|--output|-O)\b/i.test(clean)
        || /(^|[;&|]\s*)(npm|pnpm|yarn|pip|pip3|gem|go|brew)\b[^;|]*\s(install|add|update|remove|uninstall)\b/i.test(clean)
        || />>?|&>/.test(clean.replace(/[^<>=]/g, '').replace(/<<+/g, ''))
      if (hasWrite) {
        for (const m of clean.matchAll(COMMAND_PATH_RE)) add(m[0])
        for (const m of clean.matchAll(COMMAND_FILE_RE)) add(m[0])
      }
    }
  }
  return out.slice(0, 8)
}

/** Keyword → matcher cache (the blacklist is editable at runtime). */
const keywordMatchers = new Map<string, RegExp>()

/**
 * Build the matcher for one blacklist keyword. An ASCII-edged keyword is matched
 * against identifier characters — letters, digits, `_` and `-` — so it can no
 * longer veto a longer identifier that merely contains it: `format` no longer
 * matches the PowerShell cmdlet `Format-Table`, while `mkfs` still matches
 * `mkfs.ext4` (`.` ends the identifier). A keyword ending in punctuation keeps
 * its literal edge (a device target keyword still matches its argument), and CJK
 * keywords (no `\w` edges) stay plain substrings.
 */
function keywordMatcher(keyword: string): RegExp {
  const cached = keywordMatchers.get(keyword)
  if (cached !== undefined) return cached
  const needle = keyword.trim().replace(/\s+/g, ' ')
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lead = /^\w/.test(needle) ? '(?<![A-Za-z0-9_-])' : ''
  const trail = /\w$/.test(needle) ? '(?![A-Za-z0-9_-])' : ''
  const re = new RegExp(`${lead}${escaped}${trail}`, 'i')
  keywordMatchers.set(keyword, re)
  return re
}

/**
 * The text a blacklist keyword may match: the shell command plus the call's
 * scalar arguments, excluding document-body fields. Whitespace is collapsed so
 * a command written with extra spaces still reads as the command it is.
 */
function denyScanText(exec: ToolExecutionLike): string {
  const parts: string[] = []
  const walk = (node: unknown, depth: number): void => {
    if (depth > 6) return
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === 'string') parts.push(item)
        else walk(item, depth + 1)
      }
      return
    }
    if (typeof node !== 'object' || node === null) return
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        if (!CONTENT_ARG_KEYS.has(key)) parts.push(value)
      } else {
        walk(value, depth + 1)
      }
    }
  }
  walk(exec.arguments ?? {}, 0)
  if (typeof exec.commandText === 'string' && exec.commandText !== '') parts.unshift(exec.commandText)
  return parts.join(' ').replace(/\s+/g, ' ')
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
