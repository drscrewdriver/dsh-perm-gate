import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Config, resolveDshHome, resolveDataDir, resolveGatePresets, resolvePermissiveStrategies, resolveRulesFile } from './config.js';
import { registerEventsRoute, registerHealthRoute, registerLearningRoute, registerReceiverRoute, registerReviewRoutes } from './events.js';
import { buildReceiverInfo } from './receiver-info.js';
import { PermGateRuntime } from './runtime.js';
import { classifySessions, sweepSessionData } from './session-sweep.js';
export const name = 'dsh-perm-gate';
/**
 * The `tools` service drives `tools/pre-execute`/`tools/result` (dsh-tools).
 * `webServer` hosts the plugin's HTTP routes; `llm` + `agentDefaultModel` back
 * the `host` llmAssist receiver — all supplied by the dsh runtime through the
 * loader inject (the same pattern dsh-approval-gate demonstrates; probing via
 * `ctx.get` does not cross the plugin's isolated context).
 */
export const inject = ['tools', 'webServer', 'llm', 'agentDefaultModel'];
export { Config };
/** Runtime settings namespace: `permissive` + `permissiveStrategies` (editable in the UI). */
export const PERMISSIVE_NAMESPACE = 'dsh-perm-gate';
/**
 * Inline equivalent of the official `installSettingsSection` helper: register
 * the namespace through the `settings` service, layer the composition entry as
 * `base`, and keep the runtime source live so the UI card applies immediately.
 * `onScope` receives the live scope after registration (for seeding/syncing
 * host-owned fields like the allowlist).
 */
function installSettingsSection(ctx, ns, schema, entry, hooks) {
    ;
    ctx.inject(['settings'], (sctx) => {
        const scope = sctx.settings.register(ns, schema, { base: entry });
        hooks.setSource(() => scope.get());
        hooks.onChange();
        hooks.onScope?.(scope);
        sctx.effect(() => () => {
            hooks.setSource(() => entry);
            hooks.onChange();
        });
        scope.watch(() => hooks.onChange());
    });
}
/** Column a settings-scope value into the typed live face. */
function asSurface(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
/**
 * Deliver a revert instruction into a conversation (the review page's "撤销此改动").
 * A DSH user message content must be a block array — a bare string is rendered
 * per character by the GUI — and two channels are tried in order: the typert
 * gateway, then the live agent's followup.
 */
function buildSessionSender(get) {
    return async (sessionId, content) => {
        const textBlock = [{ type: 'text', text: content }];
        const gateway = get('typertGateway');
        if (gateway !== undefined && typeof gateway.invoke === 'function') {
            try {
                await gateway.invoke({ namespace: 'session', method: 'prompt', args: { sessionId, mode: 'queue', content: textBlock } });
                return { ok: true, via: 'gateway' };
            }
            catch {
                // fall through to the agent channel
            }
        }
        const agents = get('agents');
        if (agents !== undefined && typeof agents.get === 'function') {
            const agent = agents.get(sessionId);
            if (agent !== undefined && typeof agent.followup === 'function') {
                agent.followup({
                    id: 'pg-revert-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36),
                    role: 'user',
                    content: textBlock,
                    source: { kind: 'user' },
                });
                return { ok: true, via: 'followup' };
            }
        }
        return { ok: false, error: '没有可用的消息投递通道' };
    };
}
/**
 * Build the `approval/request` listener (exported for tests).
 *
 * Two jobs, in this order:
 *
 * 1. **Answer an escalation the gate already decided.** A sandbox escalation is
 *    raised by `approveEscalation` from *inside* a shell/filesystem tool body —
 *    after `tools/pre-execute` settled — so the gate's own allow never reaches it
 *    and a call it auto-allowed would still prompt the human for the privilege
 *    widening. {@link PermGateRuntime.answerEscalation} returns `allowed-once` for
 *    exactly that case (the Permissive tier on, `trustEscalation` on, a positively
 *    cleared `callId` with a matching tool, a recognized escalation reason and
 *    target mode) and `undefined` for every other request, which then delegates
 *    unchanged.
 * 2. **Record the terminal outcome** of an ask the gate did raise. This is
 *    best-effort: a throw here would be normalized by the approval service to
 *    `unavailable` — a rejection on the human's behalf.
 */
export function makeApprovalAnswerer(runtime) {
    return async (req, next) => {
        let answered;
        try {
            answered = runtime.answerEscalation(req);
        }
        catch {
            // A gate failure must never reject on the human's behalf: fall through to
            // the ordinary answerers.
            answered = undefined;
        }
        if (answered !== undefined)
            return answered;
        const outcome = await next();
        try {
            const callId = req?.callId;
            runtime.settleAskOutcome(typeof callId === 'string' ? callId : '', String(outcome ?? ''));
        }
        catch {
            // Recording must never influence the approval outcome.
        }
        return outcome;
    };
}
/**
 * Build the `tools/pre-execute` waterfall listener (exported for tests).
 *
 * The llmAssist refinement is awaited **before** the decision leaves the
 * waterfall. An ask that has been returned to the host is already on its way to
 * the approval answerers, and DSH offers no API to retract it — the request's
 * own `signal` can only settle it `cancelled` — so a `safe` verdict learned
 * afterwards could be *recorded* but never acted on: the human still had to
 * click. Grading here is what turns `safe` into a real auto-allow and keeps the
 * prompt for the genuinely uncertain verdicts only (`risky:neutral`,
 * `unresolved`, transport failure). The wait is bounded by the classifier's own
 * `riskTimeoutMs` (default 20 s), and a grader failure keeps the original ask
 * (fail-closed).
 */
export function makePreExecuteListener(runtime) {
    return async (exec, next) => {
        const decision = runtime.decideExecution(exec);
        // Passthrough (allow / stand-down) and a hard-deny need no grading.
        if (decision === undefined)
            return next();
        if (decision.kind !== 'ask')
            return decision;
        // A cancelled call is never worth a model round-trip; the registry rechecks
        // cancellation after this gate settles.
        if (exec.signal?.aborted === true)
            return decision;
        let refined;
        try {
            refined = await runtime.refineAsk(exec, decision);
        }
        catch {
            return decision; // fail-closed: keep the human ask
        }
        return refined ?? next();
    };
}
export function apply(ctx, config = {}) {
    // Runtime-adjustable config: the composition entry is the base; the settings
    // namespace layers on top and `current()` always reads the active section.
    let current = () => config;
    // Plugin-owned data files live under $DSH_HOME (node_modules may be
    // read-only). The default resolves to `$DSH_HOME` / `~/.dsh`, so a profile
    // entry that omits `config` still records events, snapshots and learning.
    const dataDir = resolveDataDir(typeof config.dshHome === 'string' ? config.dshHome : undefined);
    // Host model-group services (typed minimally; supplied by the dsh runtime
    // through the loader `inject` — dsh-approval-gate demonstrates the same
    // contract). The llm service backs the `host` receiver; agentDefaultModel
    // supplies the current model-group selection.
    const injected = ctx;
    const fallbackGet = (name) => {
        try {
            return injected.get(name);
        }
        catch {
            return undefined;
        }
    };
    const llmService = (injected.llm ?? fallbackGet('llm'));
    const hostLlm = llmService !== null && typeof llmService === 'object' && typeof llmService.stream === 'function'
        ? llmService
        : undefined;
    const hostModelService = injected.agentDefaultModel ?? fallbackGet('agentDefaultModel');
    // The live approval service, captured by the optional inject below. Its
    // `effectivePolicy` tells the gate whether an ask can reach a human at all.
    //
    // DUAL-VERSION NOTE (DSH 0.1.1-rc.2, 0.1.2-rc.1 and 0.1.5-rc.2): `effectivePolicy` is a
    // **private** method of the user-approval service in ALL THREE versions
    // (0.1.5: packages/interaction/user-approval/lib/types/index.js:145, verified
    // present in the published @deepseek-ai/dsh@0.1.5-rc.2 bundle).
    // It is therefore a duck-typed, non-contract dependency: read it only through
    // a `typeof` probe, never assume it exists, and never let a failure escape
    // (a throw would be normalized by the approval seam into a rejection on the
    // human's behalf). The public fallback is the `agents.get(id).followup(...)`
    // channel in buildSessionSender.
    let approvalService;
    const runtime = new PermGateRuntime({
        ...config,
        hostLlm,
        // Read the Permissive tier live so the UI card's switches take effect on
        // the next tool call (no reload). Falls back to the composition entry.
        readPermissive: () => {
            const c = current();
            return {
                enabled: c.permissive ?? false,
                strategies: resolvePermissiveStrategies(c.permissiveStrategies),
            };
        },
        // Read the llmAssist receiver (endpoint/model/secret/timeout) live from the
        // same namespace, so editing the settings card applies to the next tool call.
        readClassifyConfig: () => {
            const c = current();
            return {
                endpoint: c.classifierEndpoint,
                model: c.classifierModel,
                apiKey: c.classifierApiKey,
                timeoutMs: c.riskTimeoutMs ?? 20_000,
            };
        },
        // Read the verdict-learning switch and threshold live.
        readRiskLearning: () => {
            const c = current();
            return {
                enabled: c.riskLearning ?? false,
                threshold: c.riskThreshold ?? 3,
            };
        },
        // Read the deny-keyword blacklist live; unset (not an array) applies the preset.
        readDenyKeywords: () => {
            const c = current();
            return Array.isArray(c.denyKeywords) ? c.denyKeywords : undefined;
        },
        // Learning sedimentation: threshold-reached samples become deterministic allows.
        readRiskSediment: () => current().riskSediment ?? true,
        // llmAssist receiver source: custom OpenAI-compatible endpoint or the host llm service.
        readClassifySource: () => (current().classifierSource === 'host' ? 'host' : 'custom'),
        readHostModel: () => {
            const c = current();
            let selection;
            try {
                selection = hostModelService?.currentSelection?.();
            }
            catch {
                selection = undefined;
            }
            const provider = typeof c.classifierProvider === 'string' && c.classifierProvider !== ''
                ? c.classifierProvider
                : (typeof selection?.provider === 'string' && selection.provider !== '' ? selection.provider : 'deepseek-official');
            const model = typeof c.classifierModel === 'string' && c.classifierModel !== ''
                ? c.classifierModel
                : (typeof selection?.model === 'string' && selection.model !== '' ? selection.model : 'deepseek-v4-flash');
            return { provider, model };
        },
        learningFile: typeof config.learningFile === 'string' && config.learningFile !== ''
            ? config.learningFile
            : join(dataDir, 'learning.json'),
        // The rules document lives in the plugin's data dir by default, so a
        // `$DSH_HOME/perm-gate/rules.yml` the user writes is actually loaded without
        // also having to declare `rulesFile` in the composition entry.
        rulesFile: resolveRulesFile(typeof config.rulesFile === 'string' ? config.rulesFile : undefined, dataDir),
        // The whole gate is scoped to the presets that opt into it (default: the
        // `permissive` tier this plugin adds); elsewhere it stands down entirely.
        gatePresets: resolveGatePresets(Array.isArray(config.gatePresets) ? config.gatePresets : undefined),
        // Third-party read-only tools the user classified as safe; the built-in
        // read-only/internal sets already cover DSH's own tools.
        autoAllowTools: Array.isArray(config.autoAllowTools) ? config.autoAllowTools : undefined,
        // `approval: never` rejects every request before any answerer runs, so an
        // ask the gate cannot answer must pass through instead of denying.
        //
        // Capability probe, not a version check: `effectivePolicy` is private in
        // both DSH 0.1.1-rc.2 and 0.1.2-rc.1, so an absent or throwing reader means
        // "unknown policy" — return undefined and let the ask stand (the approval
        // seam then decides). Never surface the failure to the decision path.
        readApprovalPolicy: (exec) => {
            const read = approvalService?.effectivePolicy;
            if (typeof read !== 'function')
                return undefined;
            try {
                const policy = read.call(approvalService, exec.agent?.session);
                return typeof policy === 'string' ? policy : undefined;
            }
            catch {
                return undefined;
            }
        },
        eventsFile: typeof config.eventsFile === 'string' && config.eventsFile !== ''
            ? config.eventsFile
            : join(dataDir, 'events.jsonl'),
        // Per-event pre-change snapshots back the review page's diff/revert plane.
        snapshotsDir: typeof config.snapshotsDir === 'string' && config.snapshotsDir !== ''
            ? config.snapshotsDir
            : join(dataDir, 'snapshots'),
    });
    // Session-lifecycle sweep: on startup and hourly, classify every session the
    // gate holds data for against DSH's workspace store, and drop the
    // authorization-chain data (decision events + pre-change snapshots) of
    // sessions that were archived or no longer exist. The store is read-only
    // here and every failure is fail-open (a skipped round retries in an hour);
    // the timers are unref'd so cleanup never holds the process open.
    if (config.sessionSweep !== false) {
        const storeFile = typeof config.workspaceStoreFile === 'string' && config.workspaceStoreFile !== ''
            ? config.workspaceStoreFile
            : join(resolveDshHome(typeof config.dshHome === 'string' ? config.dshHome : undefined), 'storages', 'workspace.json');
        const sweepEventsFile = typeof config.eventsFile === 'string' && config.eventsFile !== ''
            ? config.eventsFile
            : join(dataDir, 'events.jsonl');
        const sweepSnapshotsDir = typeof config.snapshotsDir === 'string' && config.snapshotsDir !== ''
            ? config.snapshotsDir
            : join(dataDir, 'snapshots');
        const sweepOnce = () => {
            try {
                const cls = classifySessions(readFileSync(storeFile, 'utf8'));
                if (cls === null)
                    return; // torn read / format change — retry next round
                sweepSessionData({ classification: cls, eventsFile: sweepEventsFile, snapshotsDir: sweepSnapshotsDir });
            }
            catch (e) {
                console.warn('[dsh-perm-gate] session sweep skipped:', e instanceof Error ? e.message : e);
            }
        };
        const first = setTimeout(sweepOnce, 0);
        const hourly = setInterval(sweepOnce, 60 * 60 * 1000);
        hourly.unref?.();
        ctx.effect(() => () => {
            clearTimeout(first);
            clearInterval(hourly);
        }, 'dsh-perm-gate: session sweep');
    }
    installSettingsSection(ctx, PERMISSIVE_NAMESPACE, Config, config, {
        setSource: (source) => {
            current = source;
        },
        onChange: () => { },
        onScope: (scope) => {
            // Seed the editable whitelist from the rules file only when the namespace
            // carries no override yet, so the card shows the current allow patterns.
            const surface = asSurface(scope.get());
            if (surface !== undefined && !Array.isArray(surface.allowlist)) {
                const patterns = runtime.allowlist();
                if (patterns.length > 0)
                    void scope.update({ allowlist: patterns.slice() });
            }
            // Card edits -> namespace -> rulesFile (mirror + reload).
            scope.watch(() => {
                const next = asSurface(scope.get());
                if (next !== undefined && Array.isArray(next.allowlist)) {
                    runtime.setAllowlist(next.allowlist.filter((x) => typeof x === 'string'));
                }
            });
        },
    });
    // Event feed HTTP API (best effort): the dsh webServer service exposes the
    // JSONL decision events to the browser half; without it events stay on disk.
    try {
        const webServerCandidate = (injected.webServer ?? fallbackGet('webServer'));
        const webServer = webServerCandidate !== null && typeof webServerCandidate === 'object' && typeof webServerCandidate.register === 'function'
            ? webServerCandidate
            : undefined;
        if (webServer === undefined) {
            // Loud but non-fatal: everything else keeps working without the HTTP routes.
            console.warn('[dsh-perm-gate] webServer service unavailable — events/learning/health/receiver routes not registered');
        }
        if (webServer !== undefined && runtime.eventLog !== undefined) {
            const offEvents = registerEventsRoute(webServer, runtime.eventLog);
            if (offEvents !== undefined)
                ctx.effect(() => () => { offEvents(); }, 'dsh-perm-gate: events route');
        }
        // Review-page plane (diff / revert / snapshot stats / snapshot clear): the
        // approval-history view's file chips and snapshot bar drive these.
        if (webServer !== undefined && runtime.eventLog !== undefined && runtime.snapshotDir !== undefined) {
            const offs = registerReviewRoutes(webServer, {
                log: runtime.eventLog,
                snapshotsDir: runtime.snapshotDir,
                send: buildSessionSender(fallbackGet),
            });
            for (const off of offs) {
                ctx.effect(() => () => { off(); }, 'dsh-perm-gate: review route');
            }
        }
        if (webServer !== undefined) {
            const offLearning = registerLearningRoute(webServer, {
                snapshot: () => runtime.learningSnapshot(),
                threshold: () => runtime.learningThreshold(),
                reset: (key, fp) => { runtime.learningReset(key, fp); },
            });
            if (offLearning !== undefined)
                ctx.effect(() => () => { offLearning(); }, 'dsh-perm-gate: learning route');
            const offHealth = registerHealthRoute(webServer, { check: () => runtime.healthCheck() });
            if (offHealth !== undefined)
                ctx.effect(() => () => { offHealth(); }, 'dsh-perm-gate: health route');
            // Receiver projection for the settings card (provider/model catalog is
            // potentially slow to enumerate — cached briefly).
            let receiverCache = null;
            const offReceiver = registerReceiverRoute(webServer, {
                info: async () => {
                    const now = Date.now();
                    if (receiverCache !== null && now - receiverCache.at < 60_000)
                        return receiverCache.info;
                    const c = current();
                    const info = await buildReceiverInfo({
                        source: c.classifierSource === 'host' ? 'host' : 'custom',
                        llm: llmService,
                        currentSelection: () => {
                            try {
                                return hostModelService?.currentSelection?.();
                            }
                            catch {
                                return undefined;
                            }
                        },
                        overrideProvider: typeof c.classifierProvider === 'string' ? c.classifierProvider : '',
                        overrideModel: typeof c.classifierModel === 'string' ? c.classifierModel : '',
                        customModel: typeof c.classifierModel === 'string' ? c.classifierModel : '',
                    });
                    receiverCache = { at: now, info };
                    return info;
                },
            });
            if (offReceiver !== undefined)
                ctx.effect(() => () => { offReceiver(); }, 'dsh-perm-gate: receiver route');
        }
    }
    catch {
        // webServer unavailable: the feed remains disk-only, sediment is view-only in files
    }
    const listener = makePreExecuteListener(runtime);
    // `tools/pre-execute` / `tools/result` / `approval/request` are service events,
    // not part of cordis core's typed `Events`, so they are registered through the
    // string overload.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const host = ctx;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    host.on('tools/pre-execute', listener);
    // Fallback terminal-answer channel: settle the ask from the call's result,
    // and settle a pending learning candidate (a result for one means the human
    // approved it and it executed — one confirmation).
    host.on('tools/result', ((exec, result) => { runtime.settleExecution(exec, result); }));
    // Approval channel: answer an escalation the gate already cleared, and settle
    // the outcome of an ask the gate did raise. Registered `prepend` so it sits at
    // the head of the `approval/request` waterfall, ahead of the remote bridge that
    // renders the browser prompt (`packages/api/remotes` registers a plain `ctx.on`).
    // A listener behind that bridge could only ever record a prompt that was already
    // shown. The `'never'` policy is unaffected: `ApprovalService.decide` resolves it
    // before dispatching, so this gate is never consulted, and a rogue return value is
    // normalized to `'unavailable'` by the service.
    //
    // This listener MUST return `next()`'s value unchanged when it does not answer —
    // a throw is normalized to `unavailable`, i.e. a rejection on the human's behalf.
    // Requests we never tracked (other agents, other sources) are ignored.
    const approvalAware = ctx;
    approvalAware.inject(['approval'], (actx) => {
        // Capture the live service: the gate reads `effectivePolicy` per call to
        // learn whether an ask can reach a human (`approval: never` cannot).
        approvalService = actx.approval;
        const off = actx.on('approval/request', makeApprovalAnswerer(runtime), { prepend: true });
        actx.effect(() => () => {
            off();
            approvalService = undefined;
        }, 'dsh-perm-gate: approval answerer');
    });
    return runtime;
}
