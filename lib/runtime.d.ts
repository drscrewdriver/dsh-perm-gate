import { type AuditEntry } from './audit.js';
import { type PermGateConfig, type PermissiveStrategies } from './config.js';
import type { ClassifierConfig } from './classifier.js';
import { EventLog } from './events.js';
import { RiskLearning } from './learning.js';
import { type RiskRequest, type RiskVerdict } from './risk.js';
import { type HostLlmLike, type HostModelSelection } from './host-llm.js';
import { type CompiledRuleEntry, type CompiledRuleset, type RuleAction } from './rule.js';
import type { NetworkTarget } from './network.js';
import { type SessionEventLike } from './preset.js';
export interface PreToolDecisionLike {
    kind: 'deny' | 'ask';
    reason: string;
}
/**
 * The P2 rule chain's own verdict for one call, as reported by
 * {@link PermGateRuntime.explainRules}. Distinct from the gate's effective
 * verdict: a P0 hard-deny or a preset deny-keyword fires *before* this layer and
 * never leaves a rule index behind, so a differing pair is information rather
 * than a contradiction.
 */
export interface RuleExplanation {
    readonly action: RuleAction;
    readonly reason: string;
    readonly ruleIndex: number | undefined;
    readonly rule: CompiledRuleEntry | undefined;
    readonly defaultAction: RuleAction;
}
export interface ToolExecutionLike {
    readonly name: string;
    readonly arguments: Record<string, unknown>;
    readonly commandText?: string;
    readonly cwd?: string;
    readonly sessionId?: string;
    readonly parentAuthorized?: boolean;
    readonly signal?: AbortSignal;
    /** Host-minted execution id; the correlation key for an ask's terminal answer. */
    readonly callId?: string;
    /**
     * The host agent face. DSH carries the session here — `exec.sessionId` and
     * `exec.cwd` are usually absent — so the session id and workspace cwd must be
     * read from `agent.session.id` / `agent.session.header.cwd`.
     */
    readonly agent?: {
        /** The agent's own session id (DSH ≥ 0.1.2 exposes it beside `session`). */
        readonly sessionId?: string;
        readonly session?: {
            readonly id?: string;
            readonly header?: {
                readonly cwd?: string;
            };
            /**
             * The durable event log, behind whichever accessor this DSH line ships:
             * a plain `events` array (0.1.1), or the `snapshotEvents()` / `ownEvents()`
             * readers 0.1.2 replaced it with. See {@link sessionEventsOf}.
             */
            readonly events?: readonly SessionEventLike[];
            readonly snapshotEvents?: () => readonly SessionEventLike[];
            readonly ownEvents?: () => readonly SessionEventLike[];
        };
    };
}
/**
 * The face of a `tools/result` payload this plugin inspects: a human rejection
 * surfaces as `isError` plus the approval seam's reason message (see findings E3).
 */
export interface ToolResultLike {
    readonly isError?: boolean;
    readonly error?: {
        readonly message?: string;
    };
}
/**
 * One ask awaiting the human's answer. The event context is snapshotted when
 * the ask is recorded, because the `approval/request` observer has no execution
 * object of its own — the terminal event must still carry the right session and
 * file chips.
 */
interface PendingAsk {
    readonly reason: string;
    readonly tool: string;
    readonly sessionId: string;
    readonly files: readonly string[];
    readonly baseDir?: string;
    /** Snapshot file key: used to load pre-change snapshots for review. */
    readonly snapshotId: number;
    /** Set when this ask also registered a learning candidate (drives the progress chip). */
    readonly learningKey?: string;
}
export interface PermGateRuntimeOptions extends PermGateConfig {
    /** Workspace root for chain resolution. Defaults to process.cwd(). */
    readonly cwd?: string;
    readonly onRulesChanged?: (ruleset: CompiledRuleset) => void;
    readonly now?: () => number;
    /**
     * Test/direct-use injection replacing the HTTP risk grader. Return
     * `unresolved` (or omit this hook) to stay on the human seam — fail-closed.
     */
    readonly riskHook?: (req: RiskRequest) => Promise<RiskVerdict>;
    /** Optional live source of the Permissive tier (e.g. a DSH settings namespace). */
    readonly readPermissive?: () => PermissiveState;
    /** Optional live source of the llmAssist classifier setup. */
    readonly readClassifyConfig?: () => ClassifierConfig;
    /**
     * Optional live receiver source: `'custom'` (an OpenAI-compatible endpoint,
     * default) or `'host'` (the DSH host `llm` service — the model-group setup
     * the user already configured, via {@link hostLlm}).
     */
    readonly readClassifySource?: () => 'custom' | 'host';
    /** The host `llm` service (typed minimally); `undefined` disables the host receiver. */
    readonly hostLlm?: HostLlmLike;
    /**
     * Live model-group selection for the host receiver (e.g. DSH's
     * agentDefaultModel.currentSelection, possibly overridden from settings).
     */
    readonly readHostModel?: () => HostModelSelection | undefined;
    /**
     * Optional live source of the verdict-learning state. When unset, the static
     * `riskLearning` / `riskThreshold` options apply.
     */
    readonly readRiskLearning?: () => RiskLearningState;
    /**
     * Optional live switch for learning sedimentation (default on while verdict
     * learning is enabled): a threshold-reached key's confirmed fingerprint
     * becomes a deterministic auto-allow — no LLM round-trip, and it survives
     * the llmAssist switch because the human confirmations already happened.
     */
    readonly readRiskSediment?: () => boolean;
    /**
     * Optional live source of the deny-keyword blacklist. `undefined` or an
     * empty array applies the preset `DEFAULT_DENY_KEYWORDS` (the blacklist is
     * protective and never silently off); a non-empty array replaces the preset.
     */
    readonly readDenyKeywords?: () => readonly string[] | undefined;
    /**
     * Optional live source of the session's effective approval policy (`'ask'` /
     * `'never'`), normally `approval.effectivePolicy(agent.session)`. Under
     * `'never'` the DSH approval seam rejects every request before any answerer
     * runs, so an ask the gate cannot answer degrades to passthrough instead of
     * becoming a denial that reads as "the user rejected tool ...".
     */
    readonly readApprovalPolicy?: (exec: ToolExecutionLike) => string | undefined;
    /** Persistence path for verdict learning; `undefined` keeps it in memory. */
    readonly learningFile?: string;
    /** Persistence path for the decision-event feed; `undefined` disables it. */
    readonly eventsFile?: string;
    /**
     * Directory for per-event pre-change file snapshots; `undefined` disables the
     * review page's diff/revert data plane (events are still recorded).
     */
    readonly snapshotsDir?: string;
    /**
     * Raise one interactive approval request on behalf of a subprocess network
     * connection. Wired by `apply` to the DSH `approval` service
     * (`approval.request`), which routes the prompt to the agent, appends the
     * `approval/asked` + `approval/decided` audit pair, and applies the session
     * policy before any answerer runs.
     *
     * Absent (or throwing) means the connection cannot ride the seam and the
     * gate fails closed to `deny`. Only `'allowed-once'` is treated as an allow.
     */
    readonly requestApproval?: (req: NetworkApprovalRequest) => Promise<ApprovalOutcomeLike>;
    /**
     * How long one approved network target stays approved for the session (ms).
     * A single shell command routinely opens many connections to the same host;
     * without this the human would be prompted once per connection.
     * Default 30 minutes.
     */
    readonly networkGrantTtlMs?: number;
}
export type CallDecision = 'allow' | 'deny' | 'ask';
/** The effective Permissive tier state read per tool call. */
export interface PermissiveState {
    readonly enabled: boolean;
    readonly strategies: PermissiveStrategies;
}
/** The effective verdict-learning state read per decision. */
export interface RiskLearningState {
    readonly enabled: boolean;
    readonly threshold: number;
}
/** The minimal approval-request face the answering gate inspects. */
export interface ApprovalRequestLike {
    readonly toolName?: string;
    readonly callId?: string;
    readonly reason?: string;
}
/** A closed approval outcome, structurally the DSH seam's `ApprovalOutcome`. */
export type ApprovalOutcomeLike = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';
/**
 * One approval ask the gate raises on behalf of a subprocess network
 * connection. Structurally the subset of the DSH `ApprovalRequest` the gate
 * supplies — the host service adds the borrowed session/log handling.
 */
export interface NetworkApprovalRequest {
    /** The host agent the question is asked on behalf of (routes the prompt). */
    readonly agent: unknown;
    /** The tool whose subprocess opened the connection. */
    readonly toolName: string;
    /** The exact tool call, when the host gave one — lets the UI attach the prompt. */
    readonly callId?: string;
    readonly reason: string;
    readonly signal?: AbortSignal;
}
/** The attribution the proxy layer receives for one connection. */
export interface ShellAttribution {
    readonly tool: string;
    readonly callId?: string;
    /** The host agent, needed to route an approval request. */
    readonly agent?: unknown;
    readonly sessionId: string;
    readonly signal?: AbortSignal;
}
export declare class PermGateRuntime {
    private readonly options;
    private ruleset;
    private readonly grants;
    private readonly artifacts;
    private readonly audit;
    private readonly cache;
    private readonly permissiveEnabled;
    private readonly strategies;
    /** Presets in which this gate is active at all; outside them it stands down. */
    private readonly gatePresets;
    /** Extra tool names the user classified as safe (config `autoAllowTools`). */
    private readonly autoAllowExtra;
    /** In-flight shell executions, for proxy-layer network attribution. */
    private readonly inFlightShells;
    /** Stable key per execution object (the host call id is not always present). */
    private readonly shellKeys;
    private shellSeq;
    /** Session-scoped network grants: grantKey -> expiry epoch ms. */
    private readonly networkGrants;
    private readonly networkGrantTtlMs;
    /**
     * Cache of the permission-preset fold. The key is the log's length plus the
     * identity of its LAST event: a session's log only appends, so "same length
     * and same last event" means the last `permission/preset` event is unchanged.
     * Identity of the tail — not of the array — is the key because DSH 0.1.2's
     * `snapshotEvents()` answers every read with a fresh array over the same
     * frozen events, which would otherwise re-fold on every tool call.
     */
    private presetCache;
    /**
     * Last stand-down announced per session (sessionId → the out-of-scope preset
     * name, `''` when the session records none). Bounded by the session count and
     * only read on the stand-down path — the in-scope path never touches it.
     */
    private readonly standDownAnnounced;
    private readonly learning;
    private readonly events?;
    /** Learning candidates awaiting human approval + execution (call fingerprint → candidate). */
    private readonly pending;
    /**
     * Asks awaiting the human's terminal answer, keyed by {@link askKey}. Both the
     * approval observer (primary) and `tools/result` (fallback) settle an entry by
     * deleting it — "delete on settle" is the whole de-duplication rule, so a
     * missing `callId` or an untriggered observer can never lose a record.
     */
    private readonly pendingAsks;
    /**
     * Calls the gate positively allowed, keyed by the host execution id. An approval
     * raised from *inside* such a call (the sandbox escalation) is answered here
     * instead of prompting the human — see {@link answerEscalation}.
     */
    private readonly cleared;
    constructor(options?: PermGateRuntimeOptions);
    private compileInline;
    /** Reload rules from disk (HMR); on failure keeps the previous rules. */
    reload(): boolean;
    get auditEntries(): readonly AuditEntry[];
    grantCount(): number;
    get defaultAction(): string;
    ruleCount(): number;
    /** Whether the independent Permissive tier is active (single front switch). */
    get permissive(): boolean;
    /** Backend approval strategy booleans active when Permissive is on. */
    get permissiveStrategies(): Readonly<PermissiveStrategies>;
    artifactCount(): number;
    /** The decision-event feed (undefined when event recording is disabled). */
    get eventLog(): EventLog | undefined;
    /** The snapshot directory backing diff/revert (undefined when disabled). */
    get snapshotDir(): string | undefined;
    /** Learning candidates currently awaiting settlement (diagnostics/tests). */
    pendingCount(): number;
    /** Deep read-only view of the learning state (diagnostics/tests). */
    learningSnapshot(): ReturnType<RiskLearning['snapshot']>;
    private ctxFor;
    /**
     * Register a shell execution as in-flight so a proxy-layer block made by its
     * child process can be attributed back to the session — and therefore ride
     * the interactive approval seam. Called when the gate lets a shell call run;
     * {@link endShellExecution} removes it.
     */
    beginShellExecution(exec: ToolExecutionLike): void;
    /** Remove a shell execution from the in-flight table (its tool call settled). */
    endShellExecution(exec: ToolExecutionLike): void;
    /** Drop every in-flight entry (dispose / session teardown). */
    clearShellExecutions(): void;
    /**
     * The newest live in-flight shell execution, for proxy-layer attribution.
     * Stale entries (a shell that never reported a result) are expired here so a
     * long-dead call can never authorize a later connection.
     */
    currentAttribution(): ShellAttribution | undefined;
    /** A stable per-execution key: the host call id, else an object-keyed fallback. */
    private shellKeyOf;
    /**
     * Ask the human to allow one network target, on behalf of the attributed
     * shell execution. Returns `'allow'` only for an explicit `allowed-once`;
     * every other outcome (rejection, cancellation, timeout, no answerer)
     * fails closed to `'deny'`.
     *
     * The approval seam requires an open turn — the durable audit pair must be
     * enclosed by the log's commit boundary — which holds here because the ask
     * happens *while* the shell tool call is executing.
     */
    askNetwork(target: NetworkTarget, reason: string, timeoutMs: number): Promise<'allow' | 'deny'>;
    /** Record one network escalation outcome in the audit mirror + event feed. */
    private auditNetworkAsk;
    /** The compiled ruleset (read-only view for network module). */
    get compiledRuleset(): CompiledRuleset;
    private liveRiskLearning;
    private liveRiskSediment;
    private liveClassifySource;
    /** The host model-group selection, or undefined when unusable. */
    private hostModel;
    private livePermissive;
    /**
     * The session's selected permission preset, folded from its event log. The
     * fold is cached on the log's length plus the identity of its last event: a
     * session's log only appends, so an unchanged tail means the last
     * `permission/preset` event is unchanged too. Tail identity — rather than the
     * array's — is the key because DSH 0.1.2's snapshot accessor returns a fresh
     * array over the same frozen events on every read.
     */
    private presetOf;
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
     *
     * P0 is therefore monotonic only WITHIN the gate's scope, not across every
     * preset. {@link announceStandDown} makes that visible instead of silent.
     */
    private gateActive;
    /**
     * Record one `stand-down` event the first time a session is observed with a
     * preset outside {@link gatePresets}, and again whenever that preset changes.
     *
     * Per-call silence is what makes a stand-down dangerous: the tool call looks
     * exactly like a call the gate inspected and allowed. One event per
     * transition is enough to say otherwise, and keeps the feed (and the
     * `events.jsonl` append) proportional to preset changes rather than to call
     * volume.
     *
     * The event is a NOTICE, not a decision: it carries no allow/deny meaning,
     * and the call it was observed on is still settled entirely by the selected
     * tier. `verdict: 'stand-down'` labels it for the history view.
     */
    private announceStandDown;
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
    private askAnswerable;
    /** Effective deny-keyword blacklist: the live namespace override or the preset.
     * An empty override is treated as "no meaningful override" (the blacklist is
     * protective and stays on); schemastery materializes unset arrays as `[]`. */
    private liveDenyKeywords;
    /**
     * The preset deny-keyword layer (inherited from dsh-approval-gate): a keyword
     * hit over the call's command/argument text vetoes it with `deny` before any
     * allow path (deny wins over allow). Purely additive to P0 — it can only ever
     * deny, never widen. Matching is boundary-aware and skips document bodies, so
     * a keyword can no longer veto an unrelated identifier or a file's text.
     */
    private denyKeywordHit;
    /**
     * Record one decision event on the feed. `verdict` labels the decision path
     * for the history view; `files` (defaulted from the call itself) drives the
     * snapshot/diff/revert chain, and `baseDir` resolves relative paths.
     */
    private recordEvent;
    /** The correlation key of one ask: its call id, or a canonical call fingerprint. */
    private askKey;
    /** Remember one ask so either settlement channel can record its terminal answer. */
    private trackAsk;
    /** Drop one tracked ask without recording it (the call never needed a human). */
    private untrackAsk;
    /** Asks currently awaiting a terminal answer (diagnostics/tests). */
    pendingAskCount(): number;
    /**
     * Remember that the gate positively allowed one call, so an approval raised from
     * inside that same call can be answered from this verdict.
     *
     * Only real allow decisions reach here: a `gateActive` stand-down returns before
     * any decision, and the `approval: never` passthrough is a degradation rather
     * than an approval, so neither may widen the call's privilege.
     */
    private clearCall;
    /** Drop one clearance (the call settled; nothing more can be asked from it). */
    private forgetCleared;
    /** Clearances retained right now (diagnostics/tests). */
    clearedCallCount(): number;
    /**
     * Answer an in-call approval from the verdict that already cleared the call.
     *
     * The sandbox escalation is raised by `approveEscalation` from *inside* a shell
     * or filesystem tool body — after `tools/pre-execute` settled — so the gate's
     * allow never reaches it and a call the gate auto-allowed would still prompt the
     * human for the privilege widening. Answering it here keeps the tier's contract:
     * one decision per call.
     *
     * Returns `undefined` for every request that is not an escalation of a call this
     * gate positively cleared, which delegates to the human unchanged (fail-closed).
     *
     * @param req - the `approval/request` payload (tool name, call id, reason).
     * @returns `allowed-once` when the gate owns the answer, else `undefined`.
     */
    answerEscalation(req: ApprovalRequestLike | null | undefined): ApprovalOutcomeLike | undefined;
    /** Get one pending ask by its key (diagnostics/tests only). */
    getPendingAsk(key: string): PendingAsk | undefined;
    /**
     * Decide one tool call. Returns a decision to veto (`deny`/`ask`) or
     * undefined to delegate via `next()` (allow / passthrough). Always records an
     * audit entry and a decision event. Grant consumption happens inside
     * {@link decide}; a call that targets a different fingerprint than any minted
     * grant no-ops. An `ask` verdict may afterwards be refined by
     * {@link refineAsk} (LLM risk grading + verdict learning) before it reaches
     * the human seam.
     */
    decideExecution(exec: ToolExecutionLike): PreToolDecisionLike | undefined;
    /**
     * Rule-layer explanation for one would-be call: what the `permissions` chain
     * decides on its own, before P0 hard-deny, P1 session grants, the P3
     * classifier and the P4 ask ever get a say.
     *
     * This is the read-only half of a dry-run. It appends nothing to the audit
     * mirror, records no event, mints no grant and touches no learning store, so a
     * "rule test" panel may call it on every keystroke without leaving a trace in
     * the decision feed. It answers a narrower question than
     * {@link decideExecution} and says so: `ruleIndex` identifies a rule in the
     * chain, which only this layer can attribute.
     */
    explainRules(exec: ToolExecutionLike): RuleExplanation;
    /**
     * Apply the Permissive tier to a raw decision. Hard-deny and minted-grant
     * outcomes are never touched (fail-closed). `alwaysConfirm` escalates a
     * rule-allow to `ask` — which the caller may then refine via
     * {@link refineAsk}. `trustAutoAllow` is the baseline middle-tier auto-allow
     * and needs no modulation here; llmAssist refinement lives in
     * {@link refineAsk} because it is asynchronous.
     */
    private applyPermissive;
    /**
     * Refine an `ask` decision with the configured LLM risk grader
     * (`llmAssist` strategy). Returns `undefined` to allow (delegate via
     * `next()`), or the decision to keep vetoing with. Every uncertainty path —
     * strategy off, no classifier setup, transport failure, off-protocol output —
     * keeps the original ask (fail-closed). Only a `neutral` risk under an
     * enabled learning store registers a pending candidate; its confirmation is
     * settled by {@link settleExecution} when the call actually executes.
     */
    refineAsk(exec: ToolExecutionLike, decision: PreToolDecisionLike): Promise<PreToolDecisionLike | undefined>;
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
    settleAskOutcome(callId: string, outcome: string): boolean;
    /**
     * Settle after the call finished (`tools/result`): the fallback channel for an
     * ask whose approval never surfaced to the observer (no approval service, a
     * missing `callId`, or an earlier listener short-circuiting the waterfall).
     * Also settles a pending learning candidate: a result for one means the human
     * approved it and it actually executed — one confirmation.
     */
    settleExecution(exec: ToolExecutionLike, result?: ToolResultLike): void;
    /**
     * Promote a pending learning candidate to a session-level grant: the same
     * operation auto-passes for the rest of the session (bounded by TTL and
     * max-uses) without waiting for human confirmations. This is the "one-click
     * allow in session" shortcut the settings card can expose.
     *
     * @returns `true` when a pending candidate was promoted.
     */
    approveSessionGrant(exec: ToolExecutionLike): boolean;
    /** Classify one `tools/result` payload into the ask's terminal outcome. */
    private settleAskFromResult;
    /**
     * Write one terminal event from the ask's snapshotted context. The observer
     * has no execution object of its own, so everything here comes from what
     * {@link trackAsk} captured when the ask was recorded.
     */
    private recordAskOutcome;
    /** The live confirmation threshold the sediment view compares counts against. */
    learningThreshold(): number;
    /** Terminate one key's learning, or drop a single sedimented sample. */
    learningReset(key: string, fp?: string): void;
    /**
     * One minimal completion through the currently configured receiver (host
     * model group or custom endpoint) with latency — the settings card's
     * "health test". Never throws; failures come back as `ok: false` + detail.
     */
    healthCheck(): Promise<{
        ok: boolean;
        ms: number;
        detail: string;
    }>;
    /** Mint a precise session grant bound to a canonical call fingerprint. */
    grant(exec: ToolExecutionLike, maxUses: number, ttlMs: number): void;
    /**
     * Grant "repeat this call for the current session" (the always-confirm panel's
     * first extended allow button): mint a bounded session grant for the exact
     * call so an identical re-run this session passes without asking again.
     */
    approveRepeat(exec: ToolExecutionLike, maxUses?: number, ttlMs?: number): void;
    /**
     * Grant "allow every occurrence of this command" (the always-confirm panel's
     * second extended allow button): persist the command into the rules file's
     * `allow` whitelist and reload. Returns the reload result.
     */
    approveAllowEverywhere(commandWord: string, reason?: string): boolean;
    /** Read-only view of the current allow-list command patterns (whitelist). */
    allowlist(): readonly string[];
    /**
     * Replace the whitelist with exactly the given command patterns and reload.
     * Returns the reload result (false when no rulesFile or the write failed).
     */
    setAllowlist(patterns: readonly string[]): boolean;
}
export {};
