/**
 * dsh-perm-gate — DSH cordis function plugin.
 *
 * Function-plugin contract: exports `name` / `inject` / `Config` / `apply`
 * with NO default export (the DSH Loader unwraps `exports.default ?? exports`,
 * and a stray default would discard the metadata).
 */
import type { Context } from '@deepseek-ai/cordis'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Config, resolveDshHome, resolveDataDir, resolveGatePresets, resolvePermissiveStrategies, resolveRulesFile } from './config.js'
import { runDryRun } from './dry-run.js'
import { registerDryRunRoute, registerEventsRoute, registerHealthRoute, registerLearningRoute, registerNetworkRoute, registerReceiverRoute, registerReviewRoutes, type SessionSender, type WebServerLike } from './events.js'
import type { HostLlmLike } from './host-llm.js'
import { buildReceiverInfo } from './receiver-info.js'
import { PermGateRuntime, type ApprovalRequestLike, type NetworkApprovalRequest, type PermissiveState, type PreToolDecisionLike, type ToolExecutionLike, type ToolResultLike } from './runtime.js'
import { classifySessions, sweepSessionData } from './session-sweep.js'
import { decideNetworkTarget, type NetworkTarget } from './network.js'
import { NetworkLifecycle, type NetworkConfigSnapshot } from './network-lifecycle.js'
import { RuleWatcher } from './watch.js'

export const name = 'dsh-perm-gate'
/**
 * The `tools` service drives `tools/pre-execute`/`tools/result` (dsh-tools).
 * `webServer` hosts the plugin's HTTP routes; `llm` + `agentDefaultModel` back
 * the `host` llmAssist receiver — all supplied by the dsh runtime through the
 * loader inject (the same pattern dsh-approval-gate demonstrates; probing via
 * `ctx.get` does not cross the plugin's isolated context).
 */
export const inject = ['tools', 'webServer', 'llm', 'agentDefaultModel']

export { Config }

/** The closed approval-outcome vocabulary (anything else is normalized to `unavailable`). */
const APPROVAL_OUTCOMES: ReadonlySet<string> = new Set(['allowed-once', 'rejected', 'cancelled', 'unavailable'])

/** Runtime settings namespace: `permissive` + `permissiveStrategies` (editable in the UI). */
export const PERMISSIVE_NAMESPACE = 'dsh-perm-gate'

/**
 * Minimal face of the dsh `settings` service (typed locally — the plugin must
 * NOT value-import the official `@deepseek-ai/dsh-settings` package: it is
 * provided by the dsh runtime instead).
 */
interface SettingsScopeLike {
  get(): unknown
  /**
   * Merge a partial patch into the namespace's user layer and persist it. This is
   * the HOST scope's only write verb: it exposes `update(patch)` / `replace(section)`
   * and has never had a `set(field, value)` (that is the client-side convenience
   * wrapper over `mutate()`, a different object).
   */
  update(patch: object): Promise<unknown> | unknown
  watch(callback: () => void): () => void
}
interface SettingsServiceLike {
  register(ns: string, schema: unknown, options?: { base?: unknown }): SettingsScopeLike
}
interface SettingsAwareCtx {
  inject(deps: readonly string[], fn: (sctx: {
    settings: SettingsServiceLike
    effect(cleanup: () => (() => void) | void, label?: string): void
  }) => void): void
}

/**
 * Minimal face of a cordis context that can observe a service event and own the
 * disposer (the shape the settings section already uses for `sctx.effect`).
 */
interface EventContextLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(name: string, listener: (...args: any[]) => any, options?: { prepend?: boolean }): () => void
  effect(cleanup: () => (() => void) | void, label?: string): void
}

/**
 * Inline equivalent of the official `installSettingsSection` helper: register
 * the namespace through the `settings` service, layer the composition entry as
 * `base`, and keep the runtime source live so the UI card applies immediately.
 * `onScope` receives the live scope after registration (for seeding/syncing
 * host-owned fields like the allowlist).
 */
function installSettingsSection<T>(
  ctx: Context,
  ns: string,
  schema: unknown,
  entry: T,
  hooks: {
    setSource: (source: () => T) => void
    onChange: () => void
    onScope?: (scope: SettingsScopeLike) => void
  },
): void {
  ;(ctx as unknown as SettingsAwareCtx).inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(ns, schema, { base: entry })
    hooks.setSource(() => scope.get() as T)
    hooks.onChange()
    hooks.onScope?.(scope)
    sctx.effect(() => () => {
      hooks.setSource(() => entry)
      hooks.onChange()
    })
    scope.watch(() => hooks.onChange())
  })
}

/** The flat set of config fields the Permissive tier reads live. */
interface PermissiveSurface {
  permissive?: boolean
  permissiveStrategies?: { trustAutoAllow?: boolean; alwaysConfirm?: boolean; llmAssist?: boolean }
  classifierEndpoint?: string
  classifierModel?: string
  classifierApiKey?: string
  /** Timeout for one llmAssist risk call. */
  riskTimeoutMs?: number
  /** llmAssist receiver source: an OpenAI-compatible endpoint or the DSH host llm service. */
  classifierSource?: string
  /** Optional provider override for the host receiver. */
  classifierProvider?: string
  /** Verdict learning switch + confirmation threshold (neutral-risk ask auto-allow). */
  riskLearning?: boolean
  riskThreshold?: number
  /** Learning sedimentation switch: threshold-reached samples become deterministic auto-allows. */
  riskSediment?: boolean
  /** Editable whitelist, mirrored to the rules file's `allow`. */
  allowlist?: string[]
  /** Editable deny-keyword blacklist; unset applies the inherited preset list. */
  denyKeywords?: string[]
}

/** Column a settings-scope value into the typed live face. */
function asSurface(value: unknown): PermissiveSurface | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as PermissiveSurface
    : undefined
}

/**
 * Deliver a revert instruction into a conversation (the review page's "撤销此改动").
 * A DSH user message content must be a block array — a bare string is rendered
 * per character by the GUI — and two channels are tried in order: the typert
 * gateway, then the live agent's followup.
 */
function buildSessionSender(get: (name: string) => unknown): SessionSender {
  return async (sessionId, content) => {
    const textBlock = [{ type: 'text', text: content }]
    const gateway = get('typertGateway') as { invoke?: (req: unknown) => Promise<unknown> } | undefined
    if (gateway !== undefined && typeof gateway.invoke === 'function') {
      try {
        await gateway.invoke({ namespace: 'session', method: 'prompt', args: { sessionId, mode: 'queue', content: textBlock } })
        return { ok: true, via: 'gateway' }
      } catch {
        // fall through to the agent channel
      }
    }
    const agents = get('agents') as { get?: (id: string) => { followup?: (msg: unknown) => unknown } | undefined } | undefined
    if (agents !== undefined && typeof agents.get === 'function') {
      const agent = agents.get(sessionId)
      if (agent !== undefined && typeof agent.followup === 'function') {
        agent.followup({
          id: 'pg-revert-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36),
          role: 'user',
          content: textBlock,
          source: { kind: 'user' },
        })
        return { ok: true, via: 'followup' }
      }
    }
    return { ok: false, error: '没有可用的消息投递通道' }
  }
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
export function makeApprovalAnswerer(
  runtime: Pick<PermGateRuntime, 'settleAskOutcome' | 'answerEscalation'>,
): (req: unknown, next: () => Promise<unknown>) => Promise<unknown> {
  return async (req, next) => {
    let answered: string | undefined
    try {
      answered = runtime.answerEscalation(req as ApprovalRequestLike)
    } catch {
      // A gate failure must never reject on the human's behalf: fall through to
      // the ordinary answerers.
      answered = undefined
    }
    if (answered !== undefined) return answered
    const outcome = await next()
    try {
      const callId = (req as { callId?: unknown } | null | undefined)?.callId
      runtime.settleAskOutcome(typeof callId === 'string' ? callId : '', String(outcome ?? ''))
    } catch {
      // Recording must never influence the approval outcome.
    }
    return outcome
  }
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
export function makePreExecuteListener(
  runtime: Pick<PermGateRuntime, 'decideExecution' | 'refineAsk' | 'beginShellExecution'>,
): (exec: ToolExecutionLike, next: () => Promise<unknown>) => Promise<unknown> {
  return async (exec, next) => {
    const decision = runtime.decideExecution(exec)
    // Passthrough (allow / stand-down) and a hard-deny need no grading.
    if (decision === undefined) {
      // The call proceeds: register it so a network connection made by its
      // child process can be attributed back to this session.
      runtime.beginShellExecution(exec)
      return next()
    }
    if (decision.kind !== 'ask') return decision // deny: it never runs
    // A cancelled call is never worth a model round-trip; the registry rechecks
    // cancellation after this gate settles.
    if (exec.signal?.aborted === true) return decision
    let refined: PreToolDecisionLike | undefined
    try {
      refined = await runtime.refineAsk(exec, decision)
    } catch {
      return decision // fail-closed: keep the human ask
    }
    if (refined === undefined) {
      runtime.beginShellExecution(exec)
      return next()
    }
    // Still an ask: the human decides. Register optimistically so a call they
    // approve is attributable; a rejection is dropped by the abort/settle path.
    if (refined.kind === 'ask') runtime.beginShellExecution(exec)
    return refined
  }
}

export function apply(ctx: Context, config: Record<string, unknown> = {}): PermGateRuntime {
  // Runtime-adjustable config: the composition entry is the base; the settings
  // namespace layers on top and `current()` always reads the active section.
  let current: () => PermissiveSurface & Record<string, unknown> = () => config as never

  // Plugin-owned data files live under $DSH_HOME (node_modules may be
  // read-only). The default resolves to `$DSH_HOME` / `~/.dsh`, so a profile
  // entry that omits `config` still records events, snapshots and learning.
  const dataDir = resolveDataDir(typeof config.dshHome === 'string' ? config.dshHome : undefined)

  // Host model-group services (typed minimally; supplied by the dsh runtime
  // through the loader `inject` — dsh-approval-gate demonstrates the same
  // contract). The llm service backs the `host` receiver; agentDefaultModel
  // supplies the current model-group selection.
  const injected = ctx as unknown as { webServer?: unknown; llm?: unknown; agentDefaultModel?: unknown; get(name: string): unknown }
  const fallbackGet = (name: string): unknown => {
    try {
      return injected.get(name)
    } catch {
      return undefined
    }
  }
  const llmService = (injected.llm ?? fallbackGet('llm')) as { stream?: unknown } | undefined
  const hostLlm = llmService !== null && typeof llmService === 'object' && typeof llmService.stream === 'function'
    ? (llmService as unknown as HostLlmLike)
    : undefined
  const hostModelService = injected.agentDefaultModel ?? fallbackGet('agentDefaultModel')

  // Host log channel, probed rather than assumed: cordis exposes `ctx.logger`,
  // but the shape moved between DSH lines. Falls back to console so a warning
  // is never silently dropped — and never throws, because these calls happen
  // inside error handlers where a throw would escalate into a host crash.
  const ctxLogger = (() => {
    const candidate = (ctx as unknown as { logger?: unknown }).logger
    if (candidate !== null && typeof candidate === 'object' && typeof (candidate as { warn?: unknown }).warn === 'function') {
      return candidate as { warn(message: string): void }
    }
    return undefined
  })()
  const loggerWarn = (message: string): void => {
    try {
      if (ctxLogger !== undefined) ctxLogger.warn(message)
      else console.warn(message)
    } catch {
      // A throwing logger must never become an unhandled error.
    }
  }

  // The live approval service, captured by the optional inject below. Its
  // `effectivePolicy` tells the gate whether an ask can reach a human at all.
  //
  // DUAL-VERSION NOTE (DSH 0.1.1-rc.2 and 0.1.2-rc.1): `effectivePolicy` is a
  // **private** method of the user-approval service in BOTH versions
  // (packages/interaction/user-approval/src/index.ts, `private effectivePolicy`).
  // It is therefore a duck-typed, non-contract dependency: read it only through
  // a `typeof` probe, never assume it exists, and never let a failure escape
  // (a throw would be normalized by the approval seam into a rejection on the
  // human's behalf). The public fallback is the `agents.get(id).followup(...)`
  // channel in buildSessionSender.
  let approvalService: {
    effectivePolicy?: (session: unknown) => unknown
    /** Ask the composed answerers to decide one readonly request. */
    request?: (req: unknown) => Promise<unknown>
  } | undefined

  const runtime = new PermGateRuntime({
    ...config,
    hostLlm,
    // Raise a network approval through the DSH approval seam. The service
    // applies the session policy, routes the prompt to the agent, and appends
    // the `approval/asked`/`approval/decided` audit pair. Everything that is
    // not an explicit `allowed-once` fails closed to `unavailable`, and the
    // gate turns that into a block.
    requestApproval: async (req: NetworkApprovalRequest) => {
      const svc = approvalService
      if (svc === undefined || typeof svc.request !== 'function') return 'unavailable'
      try {
        const outcome = await svc.request({
          agent: req.agent,
          toolName: req.toolName,
          ...(req.callId !== undefined ? { callId: req.callId } : {}),
          reason: req.reason,
          ...(req.signal !== undefined ? { signal: req.signal } : {}),
        })
        return APPROVAL_OUTCOMES.has(String(outcome))
          ? outcome as 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'
          : 'unavailable'
      } catch {
        // No open turn, a missing answerer, or a seam failure: never an allow.
        return 'unavailable'
      }
    },
    // Read the Permissive tier live so the UI card's switches take effect on
    // the next tool call (no reload). Falls back to the composition entry.
    readPermissive: (): PermissiveState => {
      const c = current()
      return {
        enabled: c.permissive ?? false,
        strategies: resolvePermissiveStrategies(c.permissiveStrategies),
      }
    },
    // Read the llmAssist receiver (endpoint/model/secret/timeout) live from the
    // same namespace, so editing the settings card applies to the next tool call.
    readClassifyConfig: () => {
      const c = current()
      return {
        endpoint: c.classifierEndpoint,
        model: c.classifierModel,
        apiKey: c.classifierApiKey,
        timeoutMs: c.riskTimeoutMs ?? 20_000,
      }
    },
    // Read the verdict-learning switch and threshold live.
    readRiskLearning: () => {
      const c = current()
      return {
        enabled: c.riskLearning ?? false,
        threshold: c.riskThreshold ?? 3,
      }
    },
    // Read the deny-keyword blacklist live; unset (not an array) applies the preset.
    readDenyKeywords: () => {
      const c = current()
      return Array.isArray(c.denyKeywords) ? c.denyKeywords : undefined
    },
    // Learning sedimentation: threshold-reached samples become deterministic allows.
    readRiskSediment: () => current().riskSediment ?? true,
    // llmAssist receiver source: custom OpenAI-compatible endpoint or the host llm service.
    readClassifySource: () => (current().classifierSource === 'host' ? 'host' : 'custom'),
    readHostModel: () => {
      const c = current()
      let selection: { provider?: unknown; model?: unknown } | undefined
      try {
        selection = (hostModelService as { currentSelection?: () => { provider?: unknown; model?: unknown } } | undefined)?.currentSelection?.()
      } catch {
        selection = undefined
      }
      const provider = typeof c.classifierProvider === 'string' && c.classifierProvider !== ''
        ? c.classifierProvider
        : (typeof selection?.provider === 'string' && selection.provider !== '' ? selection.provider : 'deepseek-official')
      const model = typeof c.classifierModel === 'string' && c.classifierModel !== ''
        ? c.classifierModel
        : (typeof selection?.model === 'string' && selection.model !== '' ? selection.model : 'deepseek-v4-flash')
      return { provider, model }
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
    gatePresets: resolveGatePresets(
      Array.isArray(config.gatePresets) ? config.gatePresets as string[] : undefined,
    ),
    // Third-party read-only tools the user classified as safe; the built-in
    // read-only/internal sets already cover DSH's own tools.
    autoAllowTools: Array.isArray(config.autoAllowTools) ? config.autoAllowTools as string[] : undefined,
    // `approval: never` rejects every request before any answerer runs, so an
    // ask the gate cannot answer must pass through instead of denying.
    //
    // Capability probe, not a version check: `effectivePolicy` is private in
    // both DSH 0.1.1-rc.2 and 0.1.2-rc.1, so an absent or throwing reader means
    // "unknown policy" — return undefined and let the ask stand (the approval
    // seam then decides). Never surface the failure to the decision path.
    readApprovalPolicy: (exec: ToolExecutionLike): string | undefined => {
      const read = approvalService?.effectivePolicy
      if (typeof read !== 'function') return undefined
      try {
        const policy = read.call(approvalService, exec.agent?.session)
        return typeof policy === 'string' ? policy : undefined
      } catch {
        return undefined
      }
    },
    eventsFile: typeof config.eventsFile === 'string' && config.eventsFile !== ''
      ? config.eventsFile
      : join(dataDir, 'events.jsonl'),
    // Per-event pre-change snapshots back the review page's diff/revert plane.
    snapshotsDir: typeof config.snapshotsDir === 'string' && config.snapshotsDir !== ''
      ? config.snapshotsDir
      : join(dataDir, 'snapshots'),
  } as never)

  // Session-lifecycle sweep: on startup and hourly, classify every session the
  // gate holds data for against DSH's workspace store, and drop the
  // authorization-chain data (decision events + pre-change snapshots) of
  // sessions that were archived or no longer exist. The store is read-only
  // here and every failure is fail-open (a skipped round retries in an hour);
  // the timers are unref'd so cleanup never holds the process open.
  if (config.sessionSweep !== false) {
    const storeFile = typeof config.workspaceStoreFile === 'string' && config.workspaceStoreFile !== ''
      ? config.workspaceStoreFile
      : join(resolveDshHome(typeof config.dshHome === 'string' ? config.dshHome : undefined), 'storages', 'workspace.json')
    const sweepEventsFile = typeof config.eventsFile === 'string' && config.eventsFile !== ''
      ? config.eventsFile
      : join(dataDir, 'events.jsonl')
    const sweepSnapshotsDir = typeof config.snapshotsDir === 'string' && config.snapshotsDir !== ''
      ? config.snapshotsDir
      : join(dataDir, 'snapshots')
    const sweepOnce = (): void => {
      try {
        const cls = classifySessions(readFileSync(storeFile, 'utf8'))
        if (cls === null) return // torn read / format change — retry next round
        sweepSessionData({ classification: cls, eventsFile: sweepEventsFile, snapshotsDir: sweepSnapshotsDir })
      } catch (e) {
        console.warn('[dsh-perm-gate] session sweep skipped:', e instanceof Error ? e.message : e)
      }
    }
    const first = setTimeout(sweepOnce, 0)
    const hourly = setInterval(sweepOnce, 60 * 60 * 1000)
    hourly.unref?.()
    ctx.effect(() => () => {
      clearTimeout(first)
      clearInterval(hourly)
    }, 'dsh-perm-gate: session sweep')
  }

  /**
   * The network-relevant slice of a settings surface, as a comparison key.
   * Used to decide whether a settings edit needs a proxy rebind at all — an
   * unrelated edit (say, the allowlist) must not close and reopen the proxy.
   */
  const networkKeyOf = (source: unknown): string => {
    const s = (source ?? {}) as Record<string, unknown>
    return JSON.stringify([
      s.networkEnabled, s.networkMode, s.networkUnlisted, s.networkLoopback,
      s.networkBind, s.networkPort, s.networkNoProxy, s.networkInjectEnv,
    ])
  }
  // Forward references, resolved during apply before any UI edit can fire:
  // the settings watch only ever runs on a later user action. Held in an
  // object so the mutable slots stay lint-clean and the intent is explicit.
  const networkRefs: {
    rebind?: () => void
    snapshot?: () => unknown
    appliedKey?: string
  } = {}

  installSettingsSection<PermissiveSurface & Record<string, unknown>>(ctx, PERMISSIVE_NAMESPACE, Config, config as never, {
    setSource: (source) => {
      current = source
    },
    onChange: () => {},
    onScope: (scope) => {
      // Seed the editable whitelist from the rules file only when the namespace
      // carries no override yet, so the card shows the current allow patterns.
      const surface = asSurface(scope.get())
      if (surface !== undefined && !Array.isArray(surface.allowlist)) {
        const patterns = runtime.allowlist()
        if (patterns.length > 0) void scope.update({ allowlist: patterns.slice() })
      }
      // Card edits -> namespace -> rulesFile (mirror + reload).
      scope.watch(() => {
        const next = asSurface(scope.get())
        if (next !== undefined && Array.isArray(next.allowlist)) {
          runtime.setAllowlist(next.allowlist.filter((x): x is string => typeof x === 'string'))
        }
        // A network knob changed: re-mount the proxy so the card's switches
        // take effect without a plugin reload. Only a rebind-relevant edit
        // triggers it.
        const key = networkKeyOf(next)
        if (networkRefs.appliedKey !== undefined && networkRefs.appliedKey !== key) {
          networkRefs.appliedKey = key
          networkRefs.rebind?.()
        } else if (networkRefs.appliedKey === undefined) {
          networkRefs.appliedKey = key
        }
      })
    },
  })

  // Event feed HTTP API (best effort): the dsh webServer service exposes the
  // JSONL decision events to the browser half; without it events stay on disk.
  try {
    const webServerCandidate = (injected.webServer ?? fallbackGet('webServer')) as { register?: unknown } | undefined
    const webServer = webServerCandidate !== null && typeof webServerCandidate === 'object' && typeof webServerCandidate.register === 'function'
      ? webServerCandidate as unknown as WebServerLike
      : undefined
    if (webServer === undefined) {
      // Loud but non-fatal: everything else keeps working without the HTTP routes.
      console.warn('[dsh-perm-gate] webServer service unavailable — events/learning/health/receiver routes not registered')
    }
    if (webServer !== undefined && runtime.eventLog !== undefined) {
      const offEvents = registerEventsRoute(webServer, runtime.eventLog)
      if (offEvents !== undefined) ctx.effect(() => () => { offEvents() }, 'dsh-perm-gate: events route')
    }
    // Review-page plane (diff / revert / snapshot stats / snapshot clear): the
    // approval-history view's file chips and snapshot bar drive these.
    if (webServer !== undefined && runtime.eventLog !== undefined && runtime.snapshotDir !== undefined) {
      const offs = registerReviewRoutes(webServer, {
        log: runtime.eventLog,
        snapshotsDir: runtime.snapshotDir,
        send: buildSessionSender(fallbackGet),
      })
      for (const off of offs) {
        ctx.effect(() => () => { off() }, 'dsh-perm-gate: review route')
      }
    }
    if (webServer !== undefined) {
      const offLearning = registerLearningRoute(webServer, {
        snapshot: () => runtime.learningSnapshot(),
        threshold: () => runtime.learningThreshold(),
        reset: (key, fp) => { runtime.learningReset(key, fp) },
      })
      if (offLearning !== undefined) ctx.effect(() => () => { offLearning() }, 'dsh-perm-gate: learning route')
      const offHealth = registerHealthRoute(webServer, { check: () => runtime.healthCheck() })
      if (offHealth !== undefined) ctx.effect(() => () => { offHealth() }, 'dsh-perm-gate: health route')
      // Network diagnostics: mode, bind, port, proxy liveness, env injection,
      // block counters and recent blocks. Read-only.
      const offNetwork = registerNetworkRoute(webServer, {
        snapshot: () => networkRefs.snapshot?.() ?? { enabled: false, proxyActive: false },
      })
      if (offNetwork !== undefined) ctx.effect(() => () => { offNetwork() }, 'dsh-perm-gate: network route')
      // Rule test (dry-run): evaluate one would-be call against the ruleset the
      // gate currently has loaded, and report both the effective verdict and the
      // rule layer's own answer. Read-only — the route has no write form, so
      // testing a rule can never change it. It runs against the LIVE runtime
      // rather than a fresh one so the panel tests the rules in force, not a
      // re-derivation of them (a fresh runtime would also re-resolve the chain
      // from a different root and could silently answer about a different file).
      const offDryRun = registerDryRunRoute(webServer, {
        run: (request) =>
          runDryRun(
            {
              tool: request.tool,
              args: request.args,
              ...(request.permissive !== undefined ? { permissive: request.permissive } : {}),
            },
            runtime,
          ),
      })
      if (offDryRun !== undefined) ctx.effect(() => () => { offDryRun() }, 'dsh-perm-gate: dry-run route')
      // Receiver projection for the settings card (provider/model catalog is
      // potentially slow to enumerate — cached briefly).
      let receiverCache: { at: number; info: unknown } | null = null
      const offReceiver = registerReceiverRoute(webServer, {
        info: async () => {
          const now = Date.now()
          if (receiverCache !== null && now - receiverCache.at < 60_000) return receiverCache.info
          const c = current()
          const info = await buildReceiverInfo({
            source: c.classifierSource === 'host' ? 'host' : 'custom',
            llm: llmService as typeof hostLlm & {
              listProviders?: () => readonly { id: string; name: string }[]
              listModels?: (id: string) => Promise<readonly { id: string; name: string }[]>
              listConfigurableProviders?: () => readonly { provider: string; settingsNs: string }[]
              discoverModels?: (settingsNs: string, request: { provider?: string }) => Promise<readonly { id: string; name?: string }[]>
            } | undefined,
            currentSelection: () => {
              try {
                return (hostModelService as { currentSelection?: () => { provider?: unknown; model?: unknown } } | undefined)?.currentSelection?.()
              } catch {
                return undefined
              }
            },
            overrideProvider: typeof c.classifierProvider === 'string' ? c.classifierProvider : '',
            overrideModel: typeof c.classifierModel === 'string' ? c.classifierModel : '',
            customModel: typeof c.classifierModel === 'string' ? c.classifierModel : '',
          })
          receiverCache = { at: now, info }
          return info
        },
      })
      if (offReceiver !== undefined) ctx.effect(() => () => { offReceiver() }, 'dsh-perm-gate: receiver route')
    }
  } catch {
    // webServer unavailable: the feed remains disk-only, sediment is view-only in files
  }

  const listener = makePreExecuteListener(runtime)
  // `tools/pre-execute` / `tools/result` / `approval/request` are service events,
  // not part of cordis core's typed `Events`, so they are registered through the
  // string overload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = ctx as unknown as { on(name: string, listener: (...args: any[]) => any): unknown }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  host.on('tools/pre-execute', listener as (...args: any[]) => any)
  // Fallback terminal-answer channel: settle the ask from the call's result,
  // and settle a pending learning candidate (a result for one means the human
  // approved it and it executed — one confirmation).
  host.on('tools/result', ((exec: ToolExecutionLike, result: ToolResultLike) => {
    // The call settled: it is no longer in flight, so a later connection must
    // not be attributed to it.
    runtime.endShellExecution(exec)
    runtime.settleExecution(exec, result)
  }) as never)

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
  const approvalAware = ctx as unknown as {
    inject(deps: readonly string[], fn: (actx: EventContextLike) => void): void
  }
  approvalAware.inject(['approval'], (actx) => {
    // Capture the live service: the gate reads `effectivePolicy` per call to
    // learn whether an ask can reach a human (`approval: never` cannot).
    approvalService = (actx as { approval?: typeof approvalService }).approval
    const off = actx.on('approval/request', makeApprovalAnswerer(runtime), { prepend: true })
    actx.effect(() => () => {
      off()
      approvalService = undefined
    }, 'dsh-perm-gate: approval answerer')
  })

  // ─── Network proxy (Phase 2, T2.12 + rebind) ────────────────────────
  // T2.10 escape hatch: default OFF. The network proxy is opt-in — enabling
  // it binds a loopback port and rewrites proxy env vars, so it must never
  // be turned on implicitly.
  //
  // The lifecycle lives in NetworkLifecycle: one persistent teardown effect,
  // serialized (re)binds, and a diagnostics snapshot. A settings change calls
  // rebind(), so the card's switches take effect without a plugin reload.
  const readNetworkConfig = (): NetworkConfigSnapshot => {
    const live = current() as Record<string, unknown>
    const str = (key: string, fallback: string): string =>
      typeof live[key] === 'string' && live[key] !== '' ? live[key] as string : fallback
    const num = (key: string, fallback: number): number =>
      typeof live[key] === 'number' ? live[key] as number : fallback
    const bool = (key: string, fallback: boolean): boolean =>
      typeof live[key] === 'boolean' ? live[key] as boolean : fallback
    return {
      enabled: bool('networkEnabled', false),
      mode: str('networkMode', 'whitelist') as 'deny-all' | 'whitelist' | 'allow-all',
      unlisted: str('networkUnlisted', 'ask') as 'ask' | 'deny',
      unattributed: str('networkUnattributed', 'allow') as 'allow' | 'deny',
      loopback: str('networkLoopback', 'allow') as 'allow' | 'policy',
      bind: str('networkBind', '127.0.0.1'),
      port: num('networkPort', 0),
      noProxy: str('networkNoProxy', 'clear') as 'clear' | 'preserve',
      injectEnv: bool('networkInjectEnv', true),
      askTimeoutMs: num('networkAskTimeoutMs', 120_000),
    }
  }
  const networkLogger: { warn(message: string): void; info?(message: string): void } =
    ctxLogger !== undefined ? ctxLogger : { warn: (msg: string) => console.warn(msg) }
  const networkLifecycle = new NetworkLifecycle({
    effect: (disposeFactory, label) => { ctx.effect(disposeFactory, label) },
    readConfig: readNetworkConfig,
    decide: (target: NetworkTarget) => {
      const cfg = readNetworkConfig()
      return decideNetworkTarget(runtime.compiledRuleset, target, {
        mode: cfg.mode,
        unlisted: cfg.unlisted,
        loopback: cfg.loopback,
        // Attribution decides whether this connection is a shell subprocess
        // (the gate's business) or DSH's own client (left alone by default).
        attributed: runtime.currentAttribution() !== undefined,
        unattributed: cfg.unattributed,
      })
    },
    attribution: () => runtime.currentAttribution(),
    // An `ask` verdict escalates to the interactive approval seam, raised on
    // behalf of the shell command that opened the connection. A `deny` verdict
    // never reaches here — approval widens reach but cannot override a rule.
    escalate: async (target: NetworkTarget, decision) => {
      const where = `${target.scheme ?? 'https'}://${target.host}${target.port !== undefined ? `:${target.port}` : ''}`
      const why = decision.matched && decision.ruleIndex !== undefined
        ? `rule #${decision.ruleIndex + 1} asks about it`
        : `${decision.mode} mode has no allow rule for it`
      return runtime.askNetwork(
        target,
        `a shell subprocess wants to reach ${where} — ${why}. Approve to let this command use the network for this target.`,
        readNetworkConfig().askTimeoutMs,
      )
    },
    logger: networkLogger,
  })
  // Never awaited at apply(): a slow or failing bind must not block plugin
  // load. attach() degrades to "no proxy" internally.
  void networkLifecycle.attach().catch((error: unknown) => {
    loggerWarn(`[dsh-perm-gate] network proxy attach failed: ${String(error)}`)
  })
  // Resolve the forward reference and seed the change-detection key from the
  // config actually applied, so the first UI edit is compared against it.
  networkRefs.rebind = () => {
    void networkLifecycle.rebind().catch((error: unknown) => {
      loggerWarn(`[dsh-perm-gate] network proxy rebind failed: ${String(error)}`)
    })
  }
  networkRefs.snapshot = () => networkLifecycle.snapshot()
  if (networkRefs.appliedKey === undefined) networkRefs.appliedKey = networkKeyOf(current())
  // ─── Hot reload watcher (Phase 3, T3.6) ────────────────────────────
  const watchEnabled = typeof config.watch === 'boolean' ? config.watch : true
  if (watchEnabled) {
    const watchDebounceMs = typeof config.watchDebounceMs === 'number' ? config.watchDebounceMs : 300
    const ruleWatcher = new RuleWatcher({
      debounceMs: watchDebounceMs,
      logger: { warn: (msg: string) => console.warn(msg) },
    })
    // Watch the effective rules file for the current workspace.
    const rulesFile = resolveRulesFile(
      typeof config.rulesFile === 'string' ? config.rulesFile : undefined,
      dataDir,
    )
    const cwd = typeof config.cwd === 'string' ? config.cwd : process.cwd()
    ruleWatcher.watch(cwd, [rulesFile], () => {
      runtime.reload()
    })
    ctx.effect(() => () => {
      ruleWatcher.closeAll()
    }, 'dsh-perm-gate: rule watcher')
  }

  return runtime
}
