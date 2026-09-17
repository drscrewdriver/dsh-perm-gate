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
import { readFileSync } from 'node:fs';
import { makeEntry, MemoryAuditMirror } from './audit.js';
import { resolvePermissiveStrategies } from './config.js';
import { appendAllowCommand, listAllowCommands, listAllowFromRulesDoc, replaceAllowCommands } from './allowlist.js';
import { decide, CONTENT_ARG_KEYS } from './engine.js';
import { EventLog, saveEventSnapshots } from './events.js';
import { decideRules } from './evaluate.js';
import { canonicalizeCall, GrantRegistry } from './grant.js';
import { learnKey, operationFingerprint, RiskLearning } from './learning.js';
import { ArtifactRegistry } from './path.js';
import { classifyRisk, classifyRiskWith } from './risk.js';
import { completeViaHost, DEFAULT_HOST_MODEL } from './host-llm.js';
import { chatCompletion } from './classifier.js';
import { compileDocument, compileRulesObject, documentHash, extractPathCandidates, parsePermissionsDocument, } from './rule.js';
import { decomposeShellCommand } from './shell.js';
import { extractAgentCandidates } from './agent-identity.js';
import { resolveRuleChain } from './rule-chain.js';
import { DEFAULT_DENY_KEYWORDS } from './deny-defaults.js';
import { permissionPresetOf, presetInScope } from './preset.js';
import { resolveGatePresets } from './config.js';
/** Locate a rule by its chain-wide index (deny entries first, then allow, then ask). */
function findRuleByIndex(ruleset, index) {
    return (ruleset.deny.find((entry) => entry.index === index) ??
        ruleset.allow.find((entry) => entry.index === index) ??
        ruleset.ask.find((entry) => entry.index === index));
}
/** Which layer of the chain produced a decision, from its stage. */
function sourceOfStage(stage, reason) {
    switch (stage) {
        case 'hard-deny':
            return 'hard-deny';
        case 'grant':
            return 'grant';
        case 'rule':
            return 'rule';
        case 'classifier':
            return 'classifier';
        default:
            return reason.startsWith('permissive') ? 'permissive' : 'default';
    }
}
/**
 * One execution's session event log, or `undefined` when the host exposes none.
 *
 * The accessor moved between DSH lines: 0.1.1 exposed `session.events` as a
 * plain array, while 0.1.2 made the log private behind `snapshotEvents()` /
 * `ownEvents()`. Reading only `.events` therefore made {@link
 * PermGateRuntime.presetOf} return `undefined` on 0.1.2, which silently stood
 * the whole gate down (no rule, grant, deny-keyword, or P0 hard-deny decision,
 * and no audit event). Every carrier is probed, array-first; a throwing or
 * missing accessor just moves to the next one, so an unknown future shape
 * degrades to "no events" instead of breaking the decision path.
 *
 * @param exec - the execution whose owning session is inspected.
 * @returns the session's events in log order, or `undefined`.
 */
function sessionEventsOf(exec) {
    const session = exec.agent?.session;
    for (const carrier of [session, exec]) {
        if (carrier === undefined)
            continue;
        const direct = carrier.events;
        if (Array.isArray(direct))
            return direct;
        for (const read of ['snapshotEvents', 'ownEvents']) {
            const accessor = carrier[read];
            if (typeof accessor !== 'function')
                continue;
            try {
                const events = accessor.call(carrier);
                if (Array.isArray(events))
                    return events;
            }
            catch {
                // An accessor that throws is no accessor: try the next carrier.
            }
        }
    }
    return undefined;
}
/** The session id of one execution (direct field, else the agent's session). */
function sessionIdOf(exec) {
    if (typeof exec.sessionId === 'string' && exec.sessionId !== '')
        return exec.sessionId;
    const id = exec.agent?.sessionId ?? exec.agent?.session?.id;
    return typeof id === 'string' ? id : '';
}
/** The workspace cwd of one execution (direct field, else the session header). */
function cwdOf(exec) {
    if (typeof exec.cwd === 'string' && exec.cwd !== '')
        return exec.cwd;
    const cwd = exec.agent?.session?.header?.cwd;
    return typeof cwd === 'string' && cwd !== '' ? cwd : undefined;
}
/** Upper bound on in-flight learning candidates awaiting `tools/result`. */
const PENDING_CAP = 100;
/**
 * Bound on retained call clearances. An in-call approval is raised microseconds
 * after the gate's decision, so the store only ever holds the calls currently
 * executing; the cap keeps a pathological producer from growing it.
 */
const CLEARED_CALL_CAP = 256;
/**
 * How long a clearance may answer an in-call approval. Generous next to one tool
 * call's lifetime, short enough that a stale entry cannot outlive its call.
 */
const CLEARED_CALL_TTL_MS = 5 * 60_000;
/**
 * The sandbox-escalation ask marker. `@deepseek-ai/dsh-sandbox`'s
 * `approveEscalation` builds `escalate sandbox to <mode>: <justification>` for the
 * approval request it raises from inside a shell/fs tool body. The request carries
 * no structural kind field, so this reason text is the only discriminator; an
 * unrecognized wording fails closed (the request is forwarded to the human).
 */
const SANDBOX_ESCALATION_REASON = /^escalate sandbox to (workspace-write|danger-full-access): /;
// --- Deterministic cleanup pre-screen ----------------------------------------
// Pattern for shell deletion commands (rm, rmdir, Remove-Item) with flags.
const SHELL_DELETE_RE = /^(?:rm|rmdir|Remove-Item)\b/i;
// Temp/build artifact directory name patterns (case-insensitive match on each path segment).
const REGENERABLE_SEGMENT = /(?:^|[\\/])(?:temp|tmp|test[-_]clone|node_modules|\.cache|dist|build|__pycache__|\.pytest_cache|\.git|\.next|\.nuxt|coverage|\.tox|\.venv|venv|env|\.mypy_cache|\.parcel-cache)(?:[\\/]|$)/i;
// Workspace-relative path tokens that are always regenerable.
const REGENERABLE_TOKENS = /^(?:node_modules|\.next|__pycache__|\.cache|dist|build|\.git|coverage|\.pytest_cache|\.tox|\.venv|venv|env)$/i;
/**
 * Deterministic pre-screen for deletion commands. Returns a reason string when
 * the deletion is clearly safe (targeting a regenerable/temp artifact inside the
 * workspace), or undefined when the LLM should decide.
 *
 * This runs BEFORE the LLM risk grader to avoid the LLM's unconditional
 * "Remove-Item → risky:deletion" bias. The LLM is still the fallback for
 * ambiguous cases.
 */
function isCleanupSafe(exec) {
    const tool = exec.name;
    const args = exec.arguments ?? {};
    // Only applies to shell/pwsh tools.
    if (!/^(?:pwsh|bash|sh|cmd|shell|terminal)$/i.test(tool))
        return undefined;
    const commandText = typeof args.command === 'string' ? args.command : undefined;
    if (commandText === undefined)
        return undefined;
    let commands = [];
    try {
        commands = decomposeShellCommand(commandText).commands;
    }
    catch {
        return undefined;
    }
    const cwd = typeof args.cwd === 'string' ? args.cwd : cwdOf(exec) ?? '';
    const posixCwd = cwd.replace(/\\/g, '/').toLowerCase();
    for (const cmd of commands) {
        if (!SHELL_DELETE_RE.test(cmd.command))
            continue;
        // Collect all non-flag argument tokens as potential targets.
        const targets = cmd.args.filter((a) => !a.startsWith('-'));
        if (targets.length === 0)
            continue;
        let allSafe = true;
        for (const target of targets) {
            const posixTarget = target.replace(/\\/g, '/').toLowerCase();
            // Resolve relative to cwd.
            const fullPath = posixTarget.startsWith('/') || /^[a-z]:\//i.test(posixTarget)
                ? posixTarget
                : posixCwd !== '' ? `${posixCwd}/${posixTarget}` : posixTarget;
            // Check if the target path contains a regenerable segment.
            if (REGENERABLE_SEGMENT.test(fullPath))
                continue;
            // Check bare token (e.g. "node_modules" without path separators).
            if (REGENERABLE_TOKENS.test(target))
                continue;
            // Not clearly regenerable — let the LLM decide.
            allSafe = false;
            break;
        }
        if (allSafe) {
            return `deletion targets regenerable/temp artifacts: ${targets.join(', ')}`;
        }
    }
    return undefined;
}
/** A shell whose result never arrived is dropped after this long (ms). */
const IN_FLIGHT_SHELL_TTL_MS = 30 * 60_000;
/** Tool names that execute a command string (mirrors evaluate's shell roster). */
const SHELL_TOOL_NAMES = new Set(['shell', 'terminal', 'bash', 'pwsh', 'sh', 'cmd', 'powershell']);
/** Whether a tool name runs a shell command. */
function isShellToolName(name) {
    return SHELL_TOOL_NAMES.has(name);
}
/** The session-grant key for one network target (scheme/host/port). */
function networkGrantKey(sessionId, target) {
    return `${sessionId}|${target.scheme ?? ''}|${target.host}|${target.port ?? ''}`;
}
export class PermGateRuntime {
    options;
    ruleset;
    grants;
    artifacts = new ArtifactRegistry();
    audit = new MemoryAuditMirror();
    cache = new Map(); // hash -> compiled
    permissiveEnabled;
    strategies;
    /** Presets in which this gate is active at all; outside them it stands down. */
    gatePresets;
    /** Extra tool names the user classified as safe (config `autoAllowTools`). */
    autoAllowExtra;
    // ─── Network seam (T2.11) ───────────────────────────────────────────
    /** In-flight shell executions, for proxy-layer network attribution. */
    inFlightShells = new Map();
    /** Stable key per execution object (the host call id is not always present). */
    shellKeys = new WeakMap();
    shellSeq = 0;
    /** Session-scoped network grants: grantKey -> expiry epoch ms. */
    networkGrants = new Map();
    networkGrantTtlMs;
    /**
     * Cache of the permission-preset fold. The key is the log's length plus the
     * identity of its LAST event: a session's log only appends, so "same length
     * and same last event" means the last `permission/preset` event is unchanged.
     * Identity of the tail — not of the array — is the key because DSH 0.1.2's
     * `snapshotEvents()` answers every read with a fresh array over the same
     * frozen events, which would otherwise re-fold on every tool call.
     */
    presetCache;
    /**
     * Last stand-down announced per session (sessionId → the out-of-scope preset
     * name, `''` when the session records none). Bounded by the session count and
     * only read on the stand-down path — the in-scope path never touches it.
     */
    standDownAnnounced = new Map();
    learning;
    events;
    /** Learning candidates awaiting human approval + execution (call fingerprint → candidate). */
    pending = new Map();
    /**
     * Asks awaiting the human's terminal answer, keyed by {@link askKey}. Both the
     * approval observer (primary) and `tools/result` (fallback) settle an entry by
     * deleting it — "delete on settle" is the whole de-duplication rule, so a
     * missing `callId` or an untriggered observer can never lose a record.
     */
    pendingAsks = new Map();
    /**
     * Calls the gate positively allowed, keyed by the host execution id. An approval
     * raised from *inside* such a call (the sandbox escalation) is answered here
     * instead of prompting the human — see {@link answerEscalation}.
     */
    cleared = new Map();
    constructor(options = {}) {
        this.options = options;
        this.grants = new GrantRegistry('__session__', options.now);
        this.permissiveEnabled = options.permissive ?? false;
        // An embedding that never states a scope keeps the historical behaviour
        // (the gate acts in every preset); the plugin always passes the resolved
        // scope from `resolveConfig`, whose product default is `['permissive']`.
        this.gatePresets = options.gatePresets === undefined ? ['*'] : resolveGatePresets(options.gatePresets);
        this.autoAllowExtra = new Set((options.autoAllowTools ?? []).filter((name) => typeof name === 'string' && name !== ''));
        this.strategies = resolvePermissiveStrategies(options.permissiveStrategies);
        this.networkGrantTtlMs = options.networkGrantTtlMs ?? 30 * 60_000;
        this.learning = new RiskLearning(options.learningFile, {
            threshold: () => this.liveRiskLearning().threshold,
            now: options.now,
        });
        this.events = options.eventsFile !== undefined
            ? new EventLog(options.eventsFile, options.now, options.snapshotsDir)
            : undefined;
        this.ruleset = this.compileInline(options);
    }
    compileInline(options) {
        const empty = {
            defaultAction: options.defaultAction ?? 'ask',
            deny: [], allow: [], ask: [],
            caseInsensitivePaths: options.caseInsensitivePaths ?? true,
        };
        // Settings-first (dual-source): a configured `dsh-perm-gate-rules`
        // namespace overrides every file path — the gate then loads with zero
        // filesystem dependency. Bare defaults (nothing configured) fall through
        // to the file sources below. Compile errors propagate: the constructor
        // fails loud, and `reload()` keeps the previous rules on a hot change.
        const settingsDoc = options.readRulesDocument?.();
        if (settingsDoc !== undefined) {
            const hash = documentHash(JSON.stringify(settingsDoc));
            const hit = this.cache.get(hash);
            if (hit !== undefined)
                return hit;
            const compiled = compileRulesObject(settingsDoc, {
                maxGlobStars: 2,
                caseInsensitivePaths: options.caseInsensitivePaths ?? true,
            });
            this.cache.set(hash, compiled);
            return compiled;
        }
        // Chain mode: when searchUp is enabled, use the multi-file chain resolver.
        if (options.searchUp === true) {
            const cwd = options.cwd ?? process.cwd();
            const rulesFile = options.rulesFile !== undefined ? options.rulesFile : 'rules.yml';
            try {
                return resolveRuleChain(cwd, {
                    rulesFile,
                    searchUp: true,
                    fallbackPath: options.fallbackPath,
                    badFilePolicy: options.badFilePolicy ?? 'fail',
                    maxChainLength: options.maxChainLength ?? 10,
                }, {
                    maxGlobStars: 2,
                    caseInsensitivePaths: options.caseInsensitivePaths ?? true,
                });
            }
            catch {
                return empty;
            }
        }
        // Single-file mode (legacy): read and compile one rules file.
        const text = options.rulesFile !== undefined ? readFileSafe(options.rulesFile) : '';
        if (text === '')
            return empty;
        const hash = documentHash(text);
        const hit = this.cache.get(hash);
        if (hit !== undefined)
            return hit;
        const doc = parsePermissionsDocument(text);
        const compiled = compileDocument(doc, {
            maxGlobStars: 2,
            caseInsensitivePaths: options.caseInsensitivePaths ?? true,
        });
        this.cache.set(hash, compiled);
        return compiled;
    }
    /** Reload rules from disk (HMR); on failure keeps the previous rules. */
    reload() {
        try {
            const next = this.compileInline(this.options);
            this.ruleset = next;
            this.options.onRulesChanged?.(next);
            return true;
        }
        catch {
            return false; // keep previous rules; never crash the host
        }
    }
    get auditEntries() {
        return this.audit.entries;
    }
    grantCount() {
        return this.grants.size;
    }
    get defaultAction() {
        return this.ruleset.defaultAction;
    }
    ruleCount() {
        return this.ruleset.deny.length + this.ruleset.allow.length + this.ruleset.ask.length;
    }
    /** Whether the independent Permissive tier is active (single front switch). */
    get permissive() {
        return this.permissiveEnabled;
    }
    /** Backend approval strategy booleans active when Permissive is on. */
    get permissiveStrategies() {
        return this.strategies;
    }
    artifactCount() {
        return this.artifacts.snapshot();
    }
    /** The decision-event feed (undefined when event recording is disabled). */
    get eventLog() {
        return this.events;
    }
    /** The snapshot directory backing diff/revert (undefined when disabled). */
    get snapshotDir() {
        return this.options.snapshotsDir;
    }
    /** Learning candidates currently awaiting settlement (diagnostics/tests). */
    pendingCount() {
        return this.pending.size;
    }
    /** Deep read-only view of the learning state (diagnostics/tests). */
    learningSnapshot() {
        return this.learning.snapshot();
    }
    ctxFor(exec) {
        const cwd = cwdOf(exec) ?? process.cwd();
        return {
            tool: exec.name,
            args: exec.arguments ?? {},
            commandText: exec.commandText ?? (typeof exec.arguments.command === 'string' ? exec.arguments.command : undefined),
            cwd,
            // The workspace root (the session's cwd). The write-path override in
            // `decideRules` uses this to determine whether a write/edit target is
            // inside the workspace or outside it.
            home: cwdOf(exec),
            caseInsensitive: this.options.caseInsensitivePaths ?? true,
            dshHome: this.options.dshHome,
            agentCandidates: extractAgentCandidates(exec),
        };
    }
    // ─── Network seam (T2.11) ───────────────────────────────────────────
    /**
     * Register a shell execution as in-flight so a proxy-layer block made by its
     * child process can be attributed back to the session — and therefore ride
     * the interactive approval seam. Called when the gate lets a shell call run;
     * {@link endShellExecution} removes it.
     */
    beginShellExecution(exec) {
        if (!isShellToolName(exec.name))
            return;
        const key = this.shellKeyOf(exec);
        this.inFlightShells.set(key, {
            key,
            tool: exec.name,
            callId: exec.callId,
            agent: exec.agent,
            sessionId: sessionIdOf(exec),
            signal: exec.signal,
            at: Date.now(),
        });
    }
    /** Remove a shell execution from the in-flight table (its tool call settled). */
    endShellExecution(exec) {
        if (!isShellToolName(exec.name))
            return;
        this.inFlightShells.delete(this.shellKeyOf(exec));
    }
    /** Drop every in-flight entry (dispose / session teardown). */
    clearShellExecutions() {
        this.inFlightShells.clear();
    }
    /**
     * The newest live in-flight shell execution, for proxy-layer attribution.
     * Stale entries (a shell that never reported a result) are expired here so a
     * long-dead call can never authorize a later connection.
     */
    currentAttribution() {
        const now = Date.now();
        let newest;
        for (const entry of this.inFlightShells.values()) {
            if (now - entry.at > IN_FLIGHT_SHELL_TTL_MS) {
                this.inFlightShells.delete(entry.key);
                continue;
            }
            // An aborted call was cancelled or rejected: it will never run, so it
            // must not authorize a connection made by some later command.
            if (entry.signal?.aborted === true) {
                this.inFlightShells.delete(entry.key);
                continue;
            }
            if (newest === undefined || entry.at >= newest.at)
                newest = entry;
        }
        if (newest === undefined)
            return undefined;
        return {
            tool: newest.tool,
            ...(newest.callId !== undefined ? { callId: newest.callId } : {}),
            ...(newest.agent !== undefined ? { agent: newest.agent } : {}),
            sessionId: newest.sessionId,
            ...(newest.signal !== undefined ? { signal: newest.signal } : {}),
        };
    }
    /** A stable per-execution key: the host call id, else an object-keyed fallback. */
    shellKeyOf(exec) {
        const cached = this.shellKeys.get(exec);
        if (cached !== undefined)
            return cached;
        const key = typeof exec.callId === 'string' && exec.callId !== ''
            ? `call:${exec.callId}`
            : `exec:${sessionIdOf(exec)}:${exec.name}:${++this.shellSeq}`;
        this.shellKeys.set(exec, key);
        return key;
    }
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
    async askNetwork(target, reason, timeoutMs) {
        const attribution = this.currentAttribution();
        if (attribution === undefined || attribution.agent === undefined) {
            // Unattributable traffic cannot ride the approval seam — fail closed.
            this.auditNetworkAsk(target, 'deny', 'no in-flight shell to attribute the connection to', undefined);
            return 'deny';
        }
        // A session already allowed this exact target: honour it without asking.
        const grantKey = networkGrantKey(attribution.sessionId, target);
        if (this.networkGrants.has(grantKey)) {
            return 'allow';
        }
        const requester = this.options.requestApproval;
        if (requester === undefined) {
            this.auditNetworkAsk(target, 'deny', 'no approval service available', attribution);
            return 'deny';
        }
        const controller = new AbortController();
        let timer;
        // The timeout is raced, not merely signalled. `abort()` only *asks* the
        // callee to withdraw the question; a callee that ignores the signal would
        // otherwise leave this await pending forever and hang the CONNECT. The
        // race guarantees the wait settles no matter what the seam does.
        const timedOut = new Promise((resolve) => {
            timer = setTimeout(() => {
                controller.abort();
                resolve('unavailable');
            }, Math.max(1, timeoutMs));
        });
        let outcome = 'unavailable';
        try {
            outcome = await Promise.race([
                requester({
                    agent: attribution.agent,
                    toolName: attribution.tool,
                    ...(attribution.callId !== undefined ? { callId: attribution.callId } : {}),
                    reason,
                    signal: controller.signal,
                }),
                timedOut,
            ]);
        }
        catch {
            // A seam failure (e.g. no open turn) is never an allow.
            outcome = 'unavailable';
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
        if (outcome === 'allowed-once') {
            // Remember it for this session so one command making many connections
            // does not prompt once per connection.
            this.networkGrants.set(grantKey, Date.now() + this.networkGrantTtlMs);
            this.auditNetworkAsk(target, 'allow', 'approved by the human (session grant)', attribution);
            return 'allow';
        }
        this.auditNetworkAsk(target, 'deny', `approval seam returned ${outcome}`, attribution);
        return 'deny';
    }
    /** Record one network escalation outcome in the audit mirror + event feed. */
    auditNetworkAsk(target, verdict, reason, attribution) {
        const now = Date.now();
        const tool = attribution?.tool ?? 'subprocess';
        const detail = `network ${verdict === 'allow' ? 'allowed' : 'denied'} ${target.scheme ?? '?'}://${target.host}${target.port !== undefined ? `:${target.port}` : ''} — ${reason}`;
        try {
            this.audit.append(makeEntry({
                callId: randomId(),
                tool,
                outcome: verdict === 'allow' ? 'allow' : 'deny',
                source: 'rule',
                reason: detail,
                at: now,
            }));
        }
        catch {
            // Auditing must never influence the verdict.
        }
        if (this.events !== undefined && attribution?.sessionId !== undefined) {
            try {
                this.events.append({
                    sessionId: attribution.sessionId,
                    tool,
                    kind: verdict === 'allow' ? 'auto' : 'deny',
                    reason: detail,
                    verdict: 'network-ask',
                });
            }
            catch {
                // Same: the feed is best-effort.
            }
        }
    }
    /** The compiled ruleset (read-only view for network module). */
    get compiledRuleset() {
        return this.ruleset;
    }
    liveRiskLearning() {
        const read = this.options.readRiskLearning;
        if (read !== undefined)
            return read();
        return { enabled: this.options.riskLearning ?? false, threshold: this.options.riskThreshold ?? 3 };
    }
    liveRiskSediment() {
        const read = this.options.readRiskSediment;
        return read !== undefined ? read() : (this.options.riskSediment ?? true);
    }
    liveClassifySource() {
        const read = this.options.readClassifySource;
        return read !== undefined ? read() : 'custom';
    }
    /** The host model-group selection, or undefined when unusable. */
    hostModel() {
        const sel = this.options.readHostModel?.();
        return sel !== undefined && sel.provider !== '' && sel.model !== '' ? sel : undefined;
    }
    livePermissive() {
        return this.options.readPermissive !== undefined
            ? this.options.readPermissive()
            : { enabled: this.permissiveEnabled, strategies: this.strategies };
    }
    /**
     * The session's selected permission preset, folded from its event log. The
     * fold is cached on the log's length plus the identity of its last event: a
     * session's log only appends, so an unchanged tail means the last
     * `permission/preset` event is unchanged too. Tail identity — rather than the
     * array's — is the key because DSH 0.1.2's snapshot accessor returns a fresh
     * array over the same frozen events on every read.
     */
    presetOf(exec) {
        const events = sessionEventsOf(exec);
        const length = events?.length ?? -1;
        const last = length > 0 ? events?.[length - 1] : undefined;
        const cached = this.presetCache;
        if (cached !== undefined && cached.length === length && cached.last === last)
            return cached.preset;
        const preset = permissionPresetOf(events);
        this.presetCache = { length, last, preset };
        return preset;
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
     *
     * P0 is therefore monotonic only WITHIN the gate's scope, not across every
     * preset. {@link announceStandDown} makes that visible instead of silent.
     */
    gateActive(preset) {
        return presetInScope(preset, this.gatePresets);
    }
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
    announceStandDown(exec, preset) {
        const sessionId = sessionIdOf(exec);
        const announced = preset ?? '';
        if (this.standDownAnnounced.get(sessionId) === announced)
            return;
        this.standDownAnnounced.set(sessionId, announced);
        const scope = this.gatePresets.includes('*') ? 'every preset' : this.gatePresets.join(', ');
        const named = preset === undefined ? 'no permission/preset recorded' : `"${preset}"`;
        this.recordEvent(exec, 'stand-down', `perm-gate is INACTIVE: the session permission preset is ${named} and the gate scope is ${scope}. `
            + 'No P0 hard-deny, no rule, no ask and no allow is evaluated for any call in this session — '
            + 'the selected tier\'s own policy governs. Select a preset in the gate scope to re-arm it.', { verdict: 'stand-down' });
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
    askAnswerable(exec) {
        try {
            return this.options.readApprovalPolicy?.(exec) !== 'never';
        }
        catch {
            return true;
        }
    }
    /** Effective deny-keyword blacklist: the live namespace override or the preset.
     * An empty override is treated as "no meaningful override" (the blacklist is
     * protective and stays on); schemastery materializes unset arrays as `[]`. */
    liveDenyKeywords() {
        const read = this.options.readDenyKeywords;
        const override = read !== undefined ? read() : undefined;
        return Array.isArray(override) && override.length > 0 ? override : DEFAULT_DENY_KEYWORDS;
    }
    /**
     * The preset deny-keyword layer (inherited from dsh-approval-gate): a keyword
     * hit over the call's command/argument text vetoes it with `deny` before any
     * allow path (deny wins over allow). Purely additive to P0 — it can only ever
     * deny, never widen. Matching is boundary-aware and skips document bodies, so
     * a keyword can no longer veto an unrelated identifier or a file's text.
     */
    denyKeywordHit(exec) {
        const keywords = this.liveDenyKeywords();
        if (keywords.length === 0)
            return undefined;
        const text = denyScanText(exec);
        if (text === '')
            return undefined;
        for (const keyword of keywords) {
            if (String(keyword).trim() === '')
                continue;
            if (keywordMatcher(String(keyword)).test(text))
                return keyword;
        }
        return undefined;
    }
    /**
     * Record one decision event on the feed. `verdict` labels the decision path
     * for the history view; `files` (defaulted from the call itself) drives the
     * snapshot/diff/revert chain, and `baseDir` resolves relative paths.
     */
    recordEvent(exec, kind, reason, extra = {}) {
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
        });
    }
    /** The correlation key of one ask: its call id, or a canonical call fingerprint. */
    askKey(exec) {
        return typeof exec.callId === 'string' && exec.callId !== ''
            ? `id:${exec.callId}`
            : `fp:${canonicalizeCall(exec.name, exec.arguments ?? {})}`;
    }
    /** Remember one ask so either settlement channel can record its terminal answer. */
    trackAsk(exec, reason, learningKey) {
        if (this.pendingAsks.size >= PENDING_CAP) {
            const oldest = this.pendingAsks.keys().next();
            if (!oldest.done)
                this.pendingAsks.delete(oldest.value);
        }
        // Generate a synthetic snapshot ID since we no longer record 'ask' events
        // (they'd pollute the approval record). Snapshots are keyed by this ID.
        const now = typeof this.options.now === 'function' ? this.options.now : Date.now;
        const snapshotId = now();
        const pending = {
            reason,
            tool: exec.name,
            sessionId: sessionIdOf(exec),
            files: eventFiles(exec),
            baseDir: cwdOf(exec),
            snapshotId,
            learningKey,
        };
        this.pendingAsks.set(this.askKey(exec), pending);
        // Save pre-change snapshots so the review page can diff/revert later.
        if (pending.files.length > 0 && this.snapshotDir) {
            try {
                saveEventSnapshots(this.snapshotDir, snapshotId, pending.files, pending.baseDir, pending.sessionId, now);
            }
            catch { /* best-effort */ }
        }
    }
    /** Drop one tracked ask without recording it (the call never needed a human). */
    untrackAsk(exec) {
        this.pendingAsks.delete(this.askKey(exec));
    }
    /** Asks currently awaiting a terminal answer (diagnostics/tests). */
    pendingAskCount() {
        return this.pendingAsks.size;
    }
    /**
     * Remember that the gate positively allowed one call, so an approval raised from
     * inside that same call can be answered from this verdict.
     *
     * Only real allow decisions reach here: a `gateActive` stand-down returns before
     * any decision, and the `approval: never` passthrough is a degradation rather
     * than an approval, so neither may widen the call's privilege.
     */
    clearCall(exec, reason, verdict, source) {
        const callId = typeof exec.callId === 'string' ? exec.callId : '';
        if (callId === '')
            return;
        if (this.cleared.size >= CLEARED_CALL_CAP) {
            const oldest = this.cleared.keys().next();
            if (!oldest.done)
                this.cleared.delete(oldest.value);
        }
        const now = typeof this.options.now === 'function' ? this.options.now : Date.now;
        this.cleared.set(callId, {
            tool: exec.name,
            reason,
            verdict,
            source,
            sessionId: sessionIdOf(exec),
            files: eventFiles(exec),
            baseDir: cwdOf(exec),
            at: now(),
        });
    }
    /** Drop one clearance (the call settled; nothing more can be asked from it). */
    forgetCleared(callId) {
        if (callId !== '')
            this.cleared.delete(callId);
    }
    /** Clearances retained right now (diagnostics/tests). */
    clearedCallCount() {
        return this.cleared.size;
    }
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
    answerEscalation(req) {
        const permissive = this.livePermissive();
        if (!permissive.enabled || !permissive.strategies.trustEscalation)
            return undefined;
        const callId = typeof req?.callId === 'string' ? req.callId : '';
        if (callId === '')
            return undefined;
        const target = SANDBOX_ESCALATION_REASON.exec(typeof req?.reason === 'string' ? req.reason : '')?.[1];
        if (target === undefined)
            return undefined;
        const cleared = this.cleared.get(callId);
        if (cleared === undefined)
            return undefined;
        if (typeof req?.toolName === 'string' && req.toolName !== '' && req.toolName !== cleared.tool)
            return undefined;
        const now = typeof this.options.now === 'function' ? this.options.now : Date.now;
        if (now() - cleared.at > CLEARED_CALL_TTL_MS) {
            this.cleared.delete(callId);
            return undefined;
        }
        const reason = `sandbox escalation to ${target} auto-allowed: the gate cleared this call (${cleared.verdict})`;
        this.audit.append(makeEntry({ callId: randomId(), tool: cleared.tool, outcome: 'allow', source: cleared.source, reason, at: now() }));
        this.events?.append({
            sessionId: cleared.sessionId,
            tool: cleared.tool,
            kind: 'auto',
            reason,
            verdict: 'escalation-auto',
            justification: cleared.reason,
            mode: target,
            files: cleared.files,
            baseDir: cleared.baseDir,
        });
        return 'allowed-once';
    }
    /** Get one pending ask by its key (diagnostics/tests only). */
    getPendingAsk(key) {
        return this.pendingAsks.get(key);
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
    decideExecution(exec) {
        // The gate is scoped to its own tier(s): anywhere else it stands down
        // entirely and decides nothing (the session's selected tier owns the call).
        // The stand-down is announced ONCE per (session, preset) transition — the
        // call's outcome is unchanged, but the user must be able to see that the
        // gate — including P0 hard-deny — is inactive; a silent stand-down reads as
        // "the gate looked at this and allowed it".
        const preset = this.presetOf(exec);
        if (!this.gateActive(preset)) {
            this.announceStandDown(exec, preset);
            return undefined;
        }
        const callId = randomId();
        // Preset deny-keyword layer (deny wins over allow): a dangerous-keyword hit
        // vetoes before grants / rules / LLM. Additive deny only — P0 semantics are
        // untouched and every later stage stays behind this veto.
        const keyword = this.denyKeywordHit(exec);
        if (keyword !== undefined) {
            const reason = `deny-keyword: matches preset blacklist entry "${keyword}"`;
            this.audit.append(makeEntry({ callId, tool: exec.name, outcome: 'deny', source: 'deny-keyword', reason, at: Date.now() }));
            this.recordEvent(exec, 'deny', reason, { verdict: 'deny-keyword' });
            return { kind: 'deny', reason };
        }
        // The same chain `explainCall` reports, evaluated once here so the two views
        // cannot drift; this caller adds the side effects and the session layers.
        const decision = this.applyPermissive(this.rawPolicy(exec));
        // Deterministic cleanup pre-screen: if a deletion command targets a
        // regenerable/temporary artifact inside the workspace, allow it directly.
        // This runs BEFORE the ask/passthrough logic so it works even under
        // `approval: never` (where refineAsk is never called).
        if (decision.action === 'ask') {
            const cleanupSafe = isCleanupSafe(exec);
            if (cleanupSafe !== undefined) {
                const reason = `cleanup-safe: ${cleanupSafe}`;
                this.audit.append(makeEntry({ callId, tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }));
                this.recordEvent(exec, 'auto', reason, { risk: 'safe', verdict: 'cleanup-safe', category: 'safe' });
                return undefined; // passthrough (allow)
            }
        }
        let outcome;
        let source;
        switch (decision.stage) {
            case 'hard-deny':
                outcome = 'deny';
                source = 'hard-deny';
                break;
            case 'grant':
                outcome = 'allow';
                source = 'grant';
                break;
            case 'rule':
                outcome = decision.action === 'ask' ? 'ask' : decision.action;
                source = 'rule';
                break;
            case 'classifier':
                outcome = decision.action;
                source = 'classifier';
                break;
            case 'default':
            case 'ask':
                outcome = decision.action;
                source = decision.reason.startsWith('permissive') ? 'permissive' : 'default';
                break;
        }
        // An ask the gate cannot deliver: under `approval: never` the DSH approval
        // seam rejects before any answerer runs, so forwarding it would only ever
        // produce `the user rejected tool "..."`. Degrade to passthrough instead.
        if (decision.action === 'ask' && !this.askAnswerable(exec)) {
            const reason = `passthrough: approval policy "never" cannot answer an ask — ${decision.reason}`;
            this.audit.append(makeEntry({ callId, tool: exec.name, outcome: 'allow', source, reason, at: Date.now() }));
            this.recordEvent(exec, 'auto', reason, { verdict: 'preset-passthrough' });
            return undefined;
        }
        // Only log terminal outcomes; 'ask' is intermediate and must not pollute
        // the audit or the event feed — recording it would be recursive since the
        // user's terminal answer comes back through tools/result anyway.
        if (outcome !== 'ask') {
            this.audit.append(makeEntry({ callId, tool: exec.name, outcome, source, reason: decision.reason, at: Date.now() }));
            this.recordEvent(exec, outcome === 'allow' ? 'auto' : outcome === 'deny' ? 'deny' : 'ask', decision.reason, { verdict: source });
        }
        if (decision.action === 'deny')
            return { kind: 'deny', reason: decision.reason };
        if (decision.action === 'ask') {
            // Track before returning: the approval observer can settle this ask
            // before the call ever reaches `tools/result`.
            this.trackAsk(exec, decision.reason);
            return { kind: 'ask', reason: decision.reason };
        }
        // A genuine allow (grant / rule / classifier / permissive default): remember it
        // so a sandbox escalation raised from inside this same call is answered here
        // rather than prompted. Reached only after the two passthrough early-returns.
        this.clearCall(exec, decision.reason, source, source);
        return undefined;
    }
    /**
     * The **pure policy** outcome for one call: the same chain
     * {@link decideExecution} runs, with every side effect and every session-state
     * layer removed.
     *
     * Side effects removed — no audit entry, no event, no ask tracking, no call
     * clearance, no learning. A rule-test panel must be able to run on every
     * keystroke without writing to the live decision feed.
     *
     * Session-state layers removed — the preset stand-down and the
     * `approval: never` ask degradation both describe a session a session-less
     * caller does not have. Including them is not harmless: the degradation turns
     * every "the rules would ask a human" into a reported **allow**, which is the
     * opposite of the truth for exactly the rules someone opens the panel to
     * review (measured on the live host: `shell ls -la` reported `allow` while the
     * rule layer said `ask`).
     *
     * `reason` is never collapsed: "allow" has causes worth naming (a rule, a
     * grant, cleanup-safety, the permissive default).
     */
    explainCall(exec) {
        const keyword = this.denyKeywordHit(exec);
        if (keyword !== undefined) {
            return {
                action: 'deny',
                reason: `deny-keyword: matches preset blacklist entry "${keyword}"`,
                source: 'deny-keyword',
            };
        }
        const decision = this.applyPermissive(this.rawPolicy(exec));
        if (decision.action === 'ask') {
            const cleanupSafe = isCleanupSafe(exec);
            if (cleanupSafe !== undefined) {
                return { action: 'allow', reason: `cleanup-safe: ${cleanupSafe}`, source: 'cleanup-safe' };
            }
        }
        return {
            action: decision.action,
            reason: decision.reason,
            source: sourceOfStage(decision.stage, decision.reason),
            ...(decision.ruleIndex !== undefined ? { ruleIndex: decision.ruleIndex } : {}),
        };
    }
    /**
     * P0 hard-deny → P1 session grant → P2 rules → P4 ask, as a value. Shared by
     * the host-facing decision and {@link explainCall} so the two cannot drift.
     */
    rawPolicy(exec) {
        const grantResolver = (tool, args) => {
            if (exec.parentAuthorized === false)
                return 'no-match';
            return this.grants.decide(tool, args);
        };
        return decide(this.ctxFor(exec), { decide: (c) => decideRules(this.ruleset, c) }, grantResolver, this.autoAllowExtra);
    }
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
    explainRules(exec) {
        const decision = decideRules(this.ruleset, this.ctxFor(exec));
        return {
            action: decision.action,
            reason: decision.reason,
            ruleIndex: decision.ruleIndex,
            rule: decision.ruleIndex === undefined ? undefined : findRuleByIndex(this.ruleset, decision.ruleIndex),
            defaultAction: this.ruleset.defaultAction,
        };
    }
    /**
     * Apply the Permissive tier to a raw decision. Hard-deny and minted-grant
     * outcomes are never touched (fail-closed). `alwaysConfirm` escalates a
     * rule-allow to `ask` — which the caller may then refine via
     * {@link refineAsk}. `trustAutoAllow` is the baseline middle-tier auto-allow
     * and needs no modulation here; llmAssist refinement lives in
     * {@link refineAsk} because it is asynchronous.
     */
    applyPermissive(raw) {
        const permissive = this.livePermissive();
        if (!permissive.enabled)
            return raw;
        const { strategies: str } = permissive;
        if (str.alwaysConfirm && raw.action === 'allow' && raw.stage === 'rule') {
            return { action: 'ask', reason: 'permissive always-confirm escalated rule-allow to ask', stage: 'default', ruleIndex: raw.ruleIndex };
        }
        return raw;
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
    async refineAsk(exec, decision) {
        const permissive = this.livePermissive();
        if (!permissive.enabled)
            return decision;
        if (decision.kind !== 'ask')
            return decision;
        // Sedimented learning rules (checked before any LLM work): a confirmed
        // sample of a threshold-reached key auto-allows deterministically. This is
        // the "沉淀" of verdict learning — it keeps working even with llmAssist
        // off, because the human confirmations already happened. Deny-first and
        // P0 are untouched: this only ever converts an `ask` into an allow.
        const learning = this.liveRiskLearning();
        if (learning.enabled && this.liveRiskSediment()) {
            const fp = operationFingerprint(exec.name, exec.arguments ?? {}, exec.commandText);
            const key = learnKey(exec.name, 'neutral', fp);
            if (this.learning.shouldAutoAllow(key, fp)) {
                const reason = `learned sediment allow (${key}, ${fp})`;
                this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }));
                this.recordEvent(exec, 'learned', reason, { risk: 'neutral', verdict: 'learned-sediment', category: 'neutral' });
                this.untrackAsk(exec); // auto-allowed: no human answer is coming
                this.clearCall(exec, reason, 'learned-sediment', 'classifier');
                return undefined;
            }
        }
        // Defensive cleanup pre-screen: normally this is handled in decideExecution
        // before refineAsk is ever called, but refineAsk is public and may be called
        // directly by tests or future embedders. Keep the same deterministic check
        // here as a safety net — identical logic to decideExecution's pre-screen.
        const cleanupSafe = isCleanupSafe(exec);
        if (cleanupSafe !== undefined) {
            const reason = `cleanup-safe: ${cleanupSafe}`;
            this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }));
            this.recordEvent(exec, 'auto', reason, { risk: 'safe', verdict: 'cleanup-safe', category: 'safe' });
            this.untrackAsk(exec);
            this.clearCall(exec, reason, 'cleanup-safe', 'classifier');
            return undefined;
        }
        if (!permissive.strategies.llmAssist)
            return decision;
        // One live read of the classifier setup. Without a usable receiver (a
        // configured custom endpoint, or the host llm service in host mode) the
        // ask goes straight to the human seam (fail-closed) — unless a risk hook
        // is injected (tests / direct embedding replace the grader entirely).
        const cfg = this.options.readClassifyConfig?.();
        const useHost = this.liveClassifySource() === 'host' && this.options.hostLlm !== undefined;
        if (this.options.riskHook === undefined && !useHost
            && (cfg?.endpoint === undefined || cfg?.endpoint === '' || cfg?.model === undefined || cfg?.model === '')) {
            return decision;
        }
        // Inject cwd into the risk request so the LLM can see the full path context
        // (e.g. that a Remove-Item targets a temp directory, not user data).
        const riskArgs = { ...(exec.arguments ?? {}) };
        const cwd = cwdOf(exec);
        if (typeof cwd === 'string' && cwd !== '' && typeof riskArgs.cwd !== 'string') {
            riskArgs.cwd = cwd;
        }
        const req = { tool: exec.name, args: riskArgs, reason: decision.reason };
        let risk;
        if (this.options.riskHook !== undefined) {
            risk = await this.options.riskHook(req);
        }
        else if (useHost) {
            const selection = this.hostModel() ?? DEFAULT_HOST_MODEL;
            risk = await classifyRiskWith((system, user) => completeViaHost(this.options.hostLlm, selection, system, user, cfg?.timeoutMs ?? 20_000), req);
        }
        else {
            risk = await classifyRisk(cfg ?? {}, req);
        }
        if (risk.kind === 'safe') {
            const reason = `llm-assist risk: safe${risk.reason === undefined ? '' : ` (${risk.reason})`}`;
            this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }));
            this.recordEvent(exec, 'auto', reason, { risk: 'safe', verdict: 'llm-safe' });
            this.untrackAsk(exec); // auto-allowed: no human answer is coming
            this.clearCall(exec, reason, 'llm-safe', 'classifier');
            return undefined;
        }
        if (risk.kind === 'risky') {
            if (risk.category !== 'neutral') {
                // Hard category (deletion / credential / remote / system / bulk) or an
                // off-protocol output graded hard: KEEP THE ASK.
                //
                // Denying here would make a probabilistic verdict the source of an
                // unappealable block: the gate would be "sure enough" to refuse on the
                // model's word alone, with no popup to appeal to and no grant to retry
                // with — measured live on a benign `git commit -F …` the grader called
                // `remote`. Deny stays with the deterministic layers (P0 hard-deny, the
                // deny-keyword blacklist, explicit `deny:` rules); everything the
                // classifier merely *suspects* is negotiated with the human instead.
                //
                // Hard categories stay distinct from `neutral` in one way that matters:
                // they are NEVER learnable, so repeated confirmations cannot sediment
                // them into an auto-allow.
                const hardReason = `${decision.reason} [llm-assist risky:${risk.category} → ask]`;
                this.trackAsk(exec, hardReason, undefined);
                return { kind: 'ask', reason: hardReason };
            }
            const learning = this.liveRiskLearning();
            const fp = operationFingerprint(exec.name, exec.arguments ?? {}, exec.commandText);
            const key = learnKey(exec.name, risk.category, fp);
            if (learning.enabled && this.learning.shouldAutoAllow(key, fp)) {
                const reason = `llm-assist learned allow (${key}, ${fp})`;
                this.audit.append(makeEntry({ callId: randomId(), tool: exec.name, outcome: 'allow', source: 'classifier', reason, at: Date.now() }));
                this.recordEvent(exec, 'auto', reason, { risk: risk.category, verdict: 'llm-learned', category: risk.category });
                this.untrackAsk(exec); // auto-allowed: no human answer is coming
                this.clearCall(exec, reason, 'llm-learned', 'classifier');
                return undefined;
            }
            if (learning.enabled) {
                if (this.pending.size >= PENDING_CAP) {
                    const oldest = this.pending.keys().next();
                    if (!oldest.done)
                        this.pending.delete(oldest.value);
                }
                this.pending.set(canonicalizeCall(exec.name, exec.arguments ?? {}), { key, fp, ctx: decision.reason });
            }
            const neutralReason = `${decision.reason} [llm-assist risky:neutral]`;
            // The refined reason supersedes the raw ask, and the candidate key lets the
            // terminal event report the post-approval learning progress.
            this.trackAsk(exec, neutralReason, learning.enabled ? key : undefined);
            return { kind: 'ask', reason: neutralReason };
        }
        // unresolved: keep the ask, learn nothing.
        return decision;
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
    settleAskOutcome(callId, outcome) {
        if (callId === '')
            return false;
        const key = `id:${callId}`;
        const ask = this.pendingAsks.get(key);
        if (ask === undefined)
            return false;
        this.pendingAsks.delete(key);
        this.recordAskOutcome(ask, outcome);
        return true;
    }
    /**
     * Settle after the call finished (`tools/result`): the fallback channel for an
     * ask whose approval never surfaced to the observer (no approval service, a
     * missing `callId`, or an earlier listener short-circuiting the waterfall).
     * Also settles a pending learning candidate: a result for one means the human
     * approved it and it actually executed — one confirmation.
     */
    settleExecution(exec, result) {
        // The call is over: no further in-call approval can arrive for it, so the
        // clearance must not linger.
        this.forgetCleared(typeof exec.callId === 'string' ? exec.callId : '');
        this.settleAskFromResult(exec, result);
        const callKey = canonicalizeCall(exec.name, exec.arguments ?? {});
        const candidate = this.pending.get(callKey);
        if (candidate === undefined)
            return;
        this.pending.delete(callKey);
        if (!this.liveRiskLearning().enabled)
            return;
        this.learning.confirm(candidate.key, candidate.fp, candidate.ctx);
        this.recordEvent(exec, 'learned', `confirmed ${candidate.key} (${candidate.fp})`, { risk: 'neutral', verdict: 'learned-confirm', category: 'neutral' });
    }
    /**
     * Promote a pending learning candidate to a session-level grant: the same
     * operation auto-passes for the rest of the session (bounded by TTL and
     * max-uses) without waiting for human confirmations. This is the "one-click
     * allow in session" shortcut the settings card can expose.
     *
     * @returns `true` when a pending candidate was promoted.
     */
    approveSessionGrant(exec) {
        const callKey = canonicalizeCall(exec.name, exec.arguments ?? {});
        const candidate = this.pending.get(callKey);
        if (candidate === undefined)
            return false;
        this.pending.delete(callKey);
        // Record the learning confirmation so sediment also benefits.
        if (this.liveRiskLearning().enabled) {
            this.learning.confirm(candidate.key, candidate.fp, candidate.ctx);
        }
        this.grants.mint({
            tool: exec.name,
            fingerprint: callKey,
            decidedBy: 'human',
            parentAuthorized: exec.parentAuthorized !== false,
            ttlMs: this.options.grantTtlMs ?? 5 * 60_000,
            maxUses: this.options.grantMaxUses ?? 1,
        });
        this.untrackAsk(exec);
        this.recordEvent(exec, 'learned', `approved session grant (${candidate.key}, ${candidate.fp})`, { risk: 'neutral', verdict: 'learned-granted', category: 'neutral' });
        return true;
    }
    /** Classify one `tools/result` payload into the ask's terminal outcome. */
    settleAskFromResult(exec, result) {
        const key = this.askKey(exec);
        const ask = this.pendingAsks.get(key);
        if (ask === undefined)
            return;
        const message = typeof result?.error?.message === 'string' ? result.error.message : '';
        const failed = result?.isError === true;
        let outcome;
        if (!failed)
            outcome = 'allowed-once';
        else if (/rejected tool/i.test(message))
            outcome = 'rejected';
        else if (/was cancelled/i.test(message))
            outcome = 'cancelled';
        else if (/approval/i.test(message))
            outcome = 'unavailable';
        // The human allowed it and the tool failed on its own afterwards.
        else
            outcome = 'allowed-once';
        this.pendingAsks.delete(key);
        this.recordAskOutcome(ask, outcome);
    }
    /**
     * Write one terminal event from the ask's snapshotted context. The observer
     * has no execution object of its own, so everything here comes from what
     * {@link trackAsk} captured when the ask was recorded.
     */
    recordAskOutcome(ask, outcome) {
        const exec = {
            name: ask.tool,
            arguments: {},
            sessionId: ask.sessionId,
            cwd: ask.baseDir,
        };
        if (outcome === 'allowed-once') {
            const learning = this.liveRiskLearning();
            // Report the post-approval progress: a registered candidate is confirmed
            // by `tools/result` right after this, so it counts as this approval.
            const key = ask.learningKey ?? learnKey(ask.tool, 'neutral');
            const learningCount = learning.enabled
                ? this.learning.count(key) + (ask.learningKey === undefined ? 0 : 1)
                : undefined;
            this.recordEvent(exec, 'manual-approved', ask.reason, {
                verdict: 'human-approved',
                files: ask.files,
                learningCount,
                threshold: learning.enabled ? learning.threshold : undefined,
            });
            return;
        }
        if (outcome === 'rejected') {
            this.recordEvent(exec, 'manual-rejected', ask.reason, { verdict: 'human-rejected', files: ask.files });
            return;
        }
        if (outcome === 'cancelled') {
            this.recordEvent(exec, 'manual-cancelled', ask.reason, { verdict: 'human-cancelled', files: ask.files });
            return;
        }
        // `unavailable`: no human was involved — the ask degraded to a denial.
        this.recordEvent(exec, 'deny', ask.reason, { verdict: 'no-approval-channel', files: ask.files });
    }
    // ---- Learning-store management (the settings UI's sediment view) ----
    /** The live confirmation threshold the sediment view compares counts against. */
    learningThreshold() {
        return this.liveRiskLearning().threshold;
    }
    /** Terminate one key's learning, or drop a single sedimented sample. */
    learningReset(key, fp) {
        if (fp !== undefined)
            this.learning.dropSample(key, fp);
        else
            this.learning.resetKey(key);
    }
    /**
     * One minimal completion through the currently configured receiver (host
     * model group or custom endpoint) with latency — the settings card's
     * "health test". Never throws; failures come back as `ok: false` + detail.
     */
    async healthCheck() {
        const now = this.options.now ?? Date.now;
        const start = now();
        const done = (ok, detail) => ({ ok, ms: now() - start, detail });
        try {
            const cfg = this.options.readClassifyConfig?.();
            if (this.liveClassifySource() === 'host') {
                if (this.options.hostLlm === undefined)
                    return done(false, 'host llm service unavailable');
                const selection = this.hostModel() ?? DEFAULT_HOST_MODEL;
                const r = await completeViaHost(this.options.hostLlm, selection, 'Reply with exactly: OK', 'ping', cfg?.timeoutMs ?? 20_000);
                return r.ok ? done(true, `${selection.provider}/${selection.model} → ${r.content.trim().slice(0, 60) || 'ok'}`) : done(false, r.error ?? 'host llm call failed');
            }
            if (cfg?.endpoint === undefined || cfg.endpoint === '' || cfg?.model === undefined || cfg.model === '') {
                return done(false, 'custom endpoint/model not configured');
            }
            const r = await chatCompletion(cfg, 'Reply with exactly: OK', 'ping');
            if (r.ok)
                return done(true, `${cfg.model} → ${r.content.trim().slice(0, 60) || 'ok'}`);
            // Name the failing leg of the endpoint/model/key triple when possible.
            const why = r.error === 'timeout'
                ? `timeout after ${cfg.timeoutMs ?? 20_000} ms`
                : r.status === 401 || r.status === 403
                    ? `HTTP ${r.status} — API key rejected`
                    : r.status === 404
                        ? 'HTTP 404 — endpoint path or model id not found'
                        : r.status !== undefined
                            ? `HTTP ${r.status} — request rejected (check model id / endpoint shape)`
                            : 'network error (endpoint unreachable)';
            return done(false, why);
        }
        catch (e) {
            return done(false, String(e?.message ?? e));
        }
    }
    /** Mint a precise session grant bound to a canonical call fingerprint. */
    grant(exec, maxUses, ttlMs) {
        const args = exec.arguments ?? {};
        this.grants.mint({
            tool: exec.name,
            fingerprint: canonicalizeCall(exec.name, args),
            decidedBy: 'human',
            parentAuthorized: exec.parentAuthorized !== false,
            ttlMs,
            maxUses,
        });
    }
    /**
     * Grant "repeat this call for the current session" (the always-confirm panel's
     * first extended allow button): mint a bounded session grant for the exact
     * call so an identical re-run this session passes without asking again.
     */
    approveRepeat(exec, maxUses = this.options.grantMaxUses ?? 3, ttlMs = this.options.grantTtlMs ?? 5 * 60_000) {
        this.grant(exec, maxUses, ttlMs);
    }
    /**
     * Grant "allow every occurrence of this command" (the always-confirm panel's
     * second extended allow button): persist the command into the rules' `allow`
     * whitelist and reload. Prefers the settings-backed writer (the namespace's
     * watch triggers the reload once the write lands); falls back to the rules
     * file when no settings scope is wired. Returns the write verdict.
     */
    approveAllowEverywhere(commandWord, reason = 'permissive allow-everywhere') {
        const writer = this.options.allowlistWriter;
        if (writer !== undefined && writer.append(commandWord, reason))
            return true;
        if (!this.options.rulesFile)
            return false;
        if (!appendAllowCommand(this.options.rulesFile, commandWord, reason))
            return false;
        return this.reload();
    }
    /**
     * Read-only view of the current allow-list command patterns (whitelist).
     * Reads the settings document when the namespace is configured, else the
     * rules file.
     */
    allowlist() {
        const doc = this.options.readRulesDocument?.();
        if (doc !== undefined)
            return listAllowFromRulesDoc(doc);
        if (!this.options.rulesFile)
            return [];
        return listAllowCommands(this.options.rulesFile);
    }
    /**
     * Replace the whitelist with exactly the given command patterns and reload.
     * Prefers the settings-backed writer; falls back to the rules file when no
     * settings scope is wired. Returns the write verdict (false when neither
     * sink is available or the write failed).
     */
    setAllowlist(patterns) {
        const writer = this.options.allowlistWriter;
        if (writer !== undefined && writer.replace(patterns, 'permissive allowlist'))
            return true;
        if (!this.options.rulesFile)
            return false;
        if (!replaceAllowCommands(this.options.rulesFile, patterns))
            return false;
        return this.reload();
    }
}
function readFileSafe(p) {
    try {
        return readFileSync(p, 'utf8');
    }
    catch {
        return '';
    }
}
/** Path-ish tokens and bare filenames lifted out of a command string. */
const COMMAND_PATH_RE = /(?:~\/|\/|\.\/)?[\w@.-]+[\\/][\w@.\\/-]+/g;
const COMMAND_FILE_RE = /[\w@.-]+\.(?:md|js|json|ya?ml|env|txt|py|ts|tsx|css|html|log|mjs|cjs|sh|ps1|toml|ini|cfg|conf)/gi;
/** A bare filename (no separator) still names a real target. */
const BARE_FILE_RE = /^[\w@.-]+\.(?:md|js|json|ya?ml|env|txt|py|ts|tsx|css|html|log|mjs|cjs|sh|ps1|toml|ini|cfg|conf)$/i;
/**
 * Paths one decision concerns, for the review page's file chips and snapshots.
 * Explicit argument candidates win (edit/write/read style tools); otherwise the
 * paths are lifted from a write-shaped shell command only — a read command
 * (cat/tail/grep) changes nothing, so its paths would be false positives.
 */
function eventFiles(exec) {
    const out = [];
    const seen = new Set();
    const add = (value) => {
        if (typeof value !== 'string')
            return;
        const seg = value.trim();
        if (seg.length < 3 || seg.length > 1024)
            return;
        if (/^(https?:|data:|blob:)/i.test(seg))
            return;
        if (!seg.includes('/') && !seg.includes('\\') && !BARE_FILE_RE.test(seg))
            return;
        if (seen.has(seg))
            return;
        seen.add(seg);
        out.push(seg);
    };
    for (const candidate of extractPathCandidates(exec.arguments ?? {}))
        add(candidate);
    if (out.length === 0) {
        const raw = typeof exec.arguments?.command === 'string'
            ? exec.arguments.command
            : (exec.commandText ?? '');
        if (raw !== '') {
            // Strip stderr suppression (2>/dev/null, 2>&1) — a read command's idiom,
            // never a write target.
            const clean = raw.replace(/2>>?\/dev\/null/g, ' ').replace(/2>&1/g, ' ');
            const hasWrite = /(^|[;&|]\s*)(touch|cp|mv|rm|tee|mkdir|rmdir|install|dd|truncate|shred|chmod|chown|chgrp)\b/i.test(clean)
                || /(^|[;&|]\s*)(sed|perl|python|node|ruby)\b[^;|]*\s-i\b/i.test(clean)
                || /(^|[;&|]\s*)(curl|wget)\b[^;|]*\s(-o|--output|-O)\b/i.test(clean)
                || /(^|[;&|]\s*)(npm|pnpm|yarn|pip|pip3|gem|go|brew)\b[^;|]*\s(install|add|update|remove|uninstall)\b/i.test(clean)
                || />>?|&>/.test(clean.replace(/[^<>=]/g, '').replace(/<<+/g, ''));
            if (hasWrite) {
                for (const m of clean.matchAll(COMMAND_PATH_RE))
                    add(m[0]);
                for (const m of clean.matchAll(COMMAND_FILE_RE))
                    add(m[0]);
            }
        }
    }
    return out.slice(0, 8);
}
/** Keyword → matcher cache (the blacklist is editable at runtime). */
const keywordMatchers = new Map();
/**
 * Build the matcher for one blacklist keyword. An ASCII-edged keyword is matched
 * against identifier characters — letters, digits, `_` and `-` — so it can no
 * longer veto a longer identifier that merely contains it: `format` no longer
 * matches the PowerShell cmdlet `Format-Table`, while `mkfs` still matches
 * `mkfs.ext4` (`.` ends the identifier). A keyword ending in punctuation keeps
 * its literal edge (a device target keyword still matches its argument), and CJK
 * keywords (no `\w` edges) stay plain substrings.
 */
function keywordMatcher(keyword) {
    const cached = keywordMatchers.get(keyword);
    if (cached !== undefined)
        return cached;
    const needle = keyword.trim().replace(/\s+/g, ' ');
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lead = /^\w/.test(needle) ? '(?<![A-Za-z0-9_-])' : '';
    const trail = /\w$/.test(needle) ? '(?![A-Za-z0-9_-])' : '';
    const re = new RegExp(`${lead}${escaped}${trail}`, 'i');
    keywordMatchers.set(keyword, re);
    return re;
}
/**
 * The text a blacklist keyword may match: the shell command plus the call's
 * scalar arguments, excluding document-body fields. Whitespace is collapsed so
 * a command written with extra spaces still reads as the command it is.
 */
function denyScanText(exec) {
    const parts = [];
    const walk = (node, depth) => {
        if (depth > 6)
            return;
        if (Array.isArray(node)) {
            for (const item of node) {
                if (typeof item === 'string')
                    parts.push(item);
                else
                    walk(item, depth + 1);
            }
            return;
        }
        if (typeof node !== 'object' || node === null)
            return;
        for (const [key, value] of Object.entries(node)) {
            if (typeof value === 'string') {
                if (!CONTENT_ARG_KEYS.has(key))
                    parts.push(value);
            }
            else {
                walk(value, depth + 1);
            }
        }
    };
    walk(exec.arguments ?? {}, 0);
    if (typeof exec.commandText === 'string' && exec.commandText !== '')
        parts.unshift(exec.commandText);
    return parts.join(' ').replace(/\s+/g, ' ');
}
function randomId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
