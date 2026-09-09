/**
 * dsh-perm-gate — DSH cordis function plugin.
 *
 * Function-plugin contract: exports `name` / `inject` / `Config` / `apply`
 * with NO default export (the DSH Loader unwraps `exports.default ?? exports`,
 * and a stray default would discard the metadata).
 */
import type { Context } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { Config, resolveDataDir, resolveGatePresets, resolvePermissiveStrategies, resolveRulesFile } from './config.js'
import { registerEventsRoute, registerHealthRoute, registerLearningRoute, registerReceiverRoute, registerReviewRoutes, type SessionSender, type WebServerLike } from './events.js'
import type { HostLlmLike } from './host-llm.js'
import { buildReceiverInfo } from './receiver-info.js'
import { PermGateRuntime, type PermissiveState, type ToolExecutionLike, type ToolResultLike } from './runtime.js'

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

/** Runtime settings namespace: `permissive` + `permissiveStrategies` (editable in the UI). */
export const PERMISSIVE_NAMESPACE = 'dsh-perm-gate'

/**
 * Minimal face of the dsh `settings` service (typed locally — the plugin must
 * NOT value-import the official `@deepseek-ai/dsh-settings` package: it is
 * provided by the dsh runtime instead).
 */
interface SettingsScopeLike {
  get(): unknown
  set(field: string, value: unknown): Promise<unknown> | unknown
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
  on(name: string, listener: (...args: any[]) => any): () => void
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
 * Build the passive `approval/request` observer (exported for tests).
 *
 * It forwards the waterfall untouched and records the closed outcome for a
 * tracked ask. Recording is best-effort: a throw here would be normalized by
 * the approval service to `unavailable` — a rejection on the human's behalf.
 */
export function makeApprovalObserver(
  runtime: Pick<PermGateRuntime, 'settleAskOutcome'>,
): (req: unknown, next: () => Promise<unknown>) => Promise<unknown> {
  return async (req, next) => {
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
  let approvalService: { effectivePolicy?: (session: unknown) => unknown } | undefined

  const runtime = new PermGateRuntime({
    ...config,
    hostLlm,
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
        if (patterns.length > 0) void scope.set('allowlist', patterns.slice())
      }
      // Card edits -> namespace -> rulesFile (mirror + reload).
      scope.watch(() => {
        const next = asSurface(scope.get())
        if (next !== undefined && Array.isArray(next.allowlist)) {
          runtime.setAllowlist(next.allowlist.filter((x): x is string => typeof x === 'string'))
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

  const listener: (exec: ToolExecutionLike, next: () => unknown) => Promise<unknown> = async (exec, next) => {
    const decision = runtime.decideExecution(exec)
    if (decision === undefined) return next()
    // llmAssist: the panel MUST appear immediately after pre-execute returns.
    // We NEVER await refineAsk here — return the original ask immediately so
    // the approval panel pops up. The LLM classifier runs in the background
    // and may auto-allow later via settleExecution.
    if (decision.kind === 'ask') {
      // Fire-and-forget: background LLM grading
      runtime.refineAsk(exec, decision)
        .then((refined) => {
          if (refined === undefined) {
            // classifier said "safe" → auto-allow
            runtime.settleExecution(exec, { isError: false })
          }
        })
        .catch(() => { /* background failure — ignore, panel already shown */ })
      return decision
    }
    return decision
  }
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
  host.on('tools/result', ((exec: ToolExecutionLike, result: ToolResultLike) => { runtime.settleExecution(exec, result) }) as never)

  // Primary terminal-answer channel: passively observe the approval waterfall.
  // The ask we vetoed is forwarded by dsh-tools to `approval.request(...)`, so
  // the closed outcome is observable here. This listener MUST return `next()`'s
  // value unchanged — a throw is normalized to `unavailable`, i.e. a rejection
  // on the human's behalf. Requests we never tracked (other agents, other
  // sources) are ignored.
  const approvalAware = ctx as unknown as {
    inject(deps: readonly string[], fn: (actx: EventContextLike) => void): void
  }
  approvalAware.inject(['approval'], (actx) => {
    // Capture the live service: the gate reads `effectivePolicy` per call to
    // learn whether an ask can reach a human (`approval: never` cannot).
    approvalService = (actx as { approval?: typeof approvalService }).approval
    const off = actx.on('approval/request', makeApprovalObserver(runtime))
    actx.effect(() => () => {
      off()
      approvalService = undefined
    }, 'dsh-perm-gate: approval observer')
  })

  return runtime
}
