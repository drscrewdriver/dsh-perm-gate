/**
 * dsh-perm-gate — DSH cordis function plugin.
 *
 * Function-plugin contract: exports `name` / `inject` / `Config` / `apply`
 * with NO default export (the DSH Loader unwraps `exports.default ?? exports`,
 * and a stray default would discard the metadata).
 */
import type { Context } from '@deepseek-ai/cordis'
import { Config, resolvePermissiveStrategies } from './config.js'
import { PermGateRuntime, type PermissiveState, type PreToolDecisionLike, type ToolExecutionLike } from './runtime.js'

export const name = 'dsh-perm-gate'
/** The `tools` service drives `tools/pre-execute`; it is supplied by dsh-tools. */
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
  /** Editable whitelist, mirrored to the rules file's `allow`. */
  allowlist?: string[]
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

  const runtime = new PermGateRuntime({
    ...config,
    // Read the Permissive tier live so the UI card's switches take effect on
    // the next tool call (no reload). Falls back to the composition entry.
    readPermissive: (): PermissiveState => {
      const c = current()
      return {
        enabled: c.permissive ?? false,
        strategies: resolvePermissiveStrategies(c.permissiveStrategies),
      }
    },
    // Read the llmAssist receiver (endpoint/model/secret) live from the same
    // namespace, so editing the settings card applies to the next tool call.
    readClassifyConfig: (): { endpoint?: string; model?: string; apiKey?: string } => {
      const c = current()
      return {
        endpoint: c.classifierEndpoint,
        model: c.classifierModel,
        apiKey: c.classifierApiKey,
      }
    },
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

  const listener: (exec: ToolExecutionLike, next: () => unknown) => unknown = async (exec, next) => {
    const decision = runtime.decideExecution(exec)
    if (decision === undefined) return next()
    // llmAssist: refine an `ask` with the configured LLM before falling to the
    // human seam. allow -> proceed; deny -> veto; ask/missing config -> human.
    if (decision.kind === 'ask' && runtime.permissiveStrategies.llmAssist) {
      const verdict = await runtime.classifyAsync({ tool: exec.name, args: exec.arguments ?? {}, reason: decision.reason })
      if (verdict === 'allow') return next()
      if (verdict === 'deny') return { kind: 'deny', reason: `[llm-assist] ${decision.reason}` } as PreToolDecisionLike
    }
    return decision as PreToolDecisionLike
  }
  // `tools/pre-execute` is a dsh-tools event, not part of cordis core's typed
  // `Events`, so it is registered through the string overload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const host = ctx as unknown as { on(name: string, listener: (...args: any[]) => any): unknown }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  host.on('tools/pre-execute', listener as (...args: any[]) => any)

  return runtime
}