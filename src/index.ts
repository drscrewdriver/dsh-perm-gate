/**
 * dsh-perm-gate — DSH cordis function plugin.
 *
 * Function-plugin contract: exports `name` / `inject` / `Config` / `apply`
 * with NO default export (the DSH Loader unwraps `exports.default ?? exports`,
 * and a stray default would discard the metadata).
 */
import type { Context } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { Config, resolvePermissiveStrategies } from './config.js'
import { registerEventsRoute, registerHealthRoute, registerLearningRoute, registerReceiverRoute, type WebServerLike } from './events.js'
import type { HostLlmLike } from './host-llm.js'
import { buildReceiverInfo } from './receiver-info.js'
import { PermGateRuntime, type PermissiveState, type ToolExecutionLike } from './runtime.js'

export const name = 'dsh-perm-gate'
/** The `tools` service drives `tools/pre-execute`/`tools/result`; it is supplied by dsh-tools. */
export const inject = ['tools']

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

export function apply(ctx: Context, config: Record<string, unknown> = {}): PermGateRuntime {
  // Runtime-adjustable config: the composition entry is the base; the settings
  // namespace layers on top and `current()` always reads the active section.
  let current: () => PermissiveSurface & Record<string, unknown> = () => config as never

  // Plugin-owned data files live under $DSH_HOME (node_modules may be read-only);
  // a missing dshHome degrades both stores to in-memory.
  const dataDir = typeof config.dshHome === 'string' && config.dshHome !== '' ? join(config.dshHome, 'perm-gate') : undefined

  // Host model-group services (best effort, typed minimally; provided by the
  // dsh runtime — dsh-approval-gate demonstrates the same contract). The llm
  // service backs the `host` receiver; agentDefaultModel supplies the current
  // model-group selection.
  const getHostService = (name: string): unknown => {
    try {
      return (ctx as unknown as { get(name: string): unknown }).get(name)
    } catch {
      return undefined
    }
  }
  const llmService = getHostService('llm') as { stream?: unknown } | undefined
  const hostLlm = llmService !== null && typeof llmService === 'object' && typeof llmService.stream === 'function'
    ? (llmService as unknown as HostLlmLike)
    : undefined
  const hostModelService = getHostService('agentDefaultModel')

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
      : (dataDir !== undefined ? join(dataDir, 'learning.json') : undefined),
    eventsFile: typeof config.eventsFile === 'string' && config.eventsFile !== ''
      ? config.eventsFile
      : (dataDir !== undefined ? join(dataDir, 'events.jsonl') : undefined),
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
    const webServer = (ctx as unknown as { get(name: string): unknown }).get('webServer') as WebServerLike | undefined
    if (webServer !== undefined && runtime.eventLog !== undefined) {
      registerEventsRoute(webServer, runtime.eventLog)
    }
    if (webServer !== undefined) {
      registerLearningRoute(webServer, {
        snapshot: () => runtime.learningSnapshot(),
        threshold: () => runtime.learningThreshold(),
        reset: (key, fp) => { runtime.learningReset(key, fp) },
      })
      registerHealthRoute(webServer, { check: () => runtime.healthCheck() })
      // Receiver projection for the settings card (provider/model catalog is
      // potentially slow to enumerate — cached briefly).
      let receiverCache: { at: number; info: unknown } | null = null
      registerReceiverRoute(webServer, {
        info: async () => {
          const now = Date.now()
          if (receiverCache !== null && now - receiverCache.at < 60_000) return receiverCache.info
          const c = current()
          const info = await buildReceiverInfo({
            source: c.classifierSource === 'host' ? 'host' : 'custom',
            llm: llmService as typeof hostLlm & { listProviders?: () => readonly { id: string; name: string }[]; listModels?: (id: string) => Promise<readonly { id: string; name: string }[]> } | undefined,
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
    }
  } catch {
    // webServer unavailable: the feed remains disk-only, sediment is view-only in files
  }

  const listener: (exec: ToolExecutionLike, next: () => unknown) => Promise<unknown> = async (exec, next) => {
    const decision = runtime.decideExecution(exec)
    if (decision === undefined) return next()
    // llmAssist: refine an `ask` with the risk grader before the human seam.
    // undefined = auto-allowed (risk-safe / learned) → proceed.
    if (decision.kind === 'ask') {
      const refined = await runtime.refineAsk(exec, decision)
      if (refined === undefined) return next()
      return refined
    }
    return decision
  }
  // `tools/pre-execute` / `tools/result` are dsh-tools events, not part of
  // cordis core's typed `Events`, so they are registered through the string overload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = ctx as unknown as { on(name: string, listener: (...args: any[]) => any): unknown }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  host.on('tools/pre-execute', listener as (...args: any[]) => any)
  // Settle verdict-learning candidates: a result for a registered ask means the
  // human approved it and it executed — one confirmation recorded.
  host.on('tools/result', ((exec: ToolExecutionLike) => { runtime.settleExecution(exec) }) as never)

  return runtime
}
