/**
 * Receiver introspection for the settings card: which LLM the gate will
 * actually use right now, plus (in host mode) the live provider/model-group
 * catalog from the DSH `llm` service — including user-configured custom
 * groups (e.g. a self-hosted provider), the same projection the harness's
 * model catalog builds via `listProviders` / `listModels`.
 *
 * Pure projection: never throws, per-provider failures are reported inline so
 * one broken group never blanks the whole list.
 */

/** One model entry as offered by a provider group. */
export interface ReceiverModel {
  readonly id: string
  readonly name: string
}

/** One provider group and its models (or the reason it failed to enumerate). */
export interface ReceiverProvider {
  readonly id: string
  readonly name: string
  readonly models: readonly ReceiverModel[]
  readonly error?: string
}

/** What the settings card needs to render the receiver UI. */
export interface ReceiverInfo {
  readonly source: 'custom' | 'host'
  /** The provider/model the gate will use right now (null when undetermined). */
  readonly selection: { readonly provider: string; readonly model: string } | null
  /** Live provider groups; non-empty only in host mode. */
  readonly providers: readonly ReceiverProvider[]
}

/** The minimal faces of the host services this projection reads. */
export interface ReceiverDeps {
  source: 'custom' | 'host'
  /** Host `llm` service (host mode only). */
  llm?: {
    listProviders?: () => readonly { id: string; name: string }[]
    listModels?: (providerId: string) => Promise<readonly { id: string; name: string }[]>
  }
  /** Live session selection (agentDefaultModel.currentSelection). */
  currentSelection?: () => { provider?: unknown; model?: unknown } | undefined
  /** Namespace overrides (empty string = follow the session). */
  overrideProvider?: string
  overrideModel?: string
  /** The model field as configured for the custom receiver. */
  customModel?: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Resolve the effective host model selection (override → session → default). */
export function resolveHostSelection(deps: ReceiverDeps): { provider: string; model: string } {
  const sel = deps.currentSelection?.()
  const provider = deps.overrideProvider !== '' && deps.overrideProvider !== undefined
    ? deps.overrideProvider
    : (str(sel?.provider) !== '' ? str(sel?.provider) : 'deepseek-official')
  const model = deps.overrideModel !== '' && deps.overrideModel !== undefined
    ? deps.overrideModel
    : (str(sel?.model) !== '' ? str(sel?.model) : 'deepseek-v4-flash')
  return { provider, model }
}

/** Build the receiver projection. Never throws. */
export async function buildReceiverInfo(deps: ReceiverDeps): Promise<ReceiverInfo> {
  if (deps.source !== 'host' || deps.llm?.listProviders === undefined || deps.llm.listModels === undefined) {
    return {
      source: deps.source,
      selection: deps.source === 'custom' && str(deps.customModel) !== ''
        ? { provider: 'custom', model: str(deps.customModel) }
        : null,
      providers: [],
    }
  }
  const selection = resolveHostSelection(deps)
  const raw = deps.llm.listProviders()
  const providers = await Promise.all(raw.map(async (p) => {
    try {
      const models = await deps.llm?.listModels?.(p.id) ?? []
      return { id: p.id, name: p.name, models: models.map((m) => ({ id: m.id, name: m.name })) }
    } catch (e) {
      return { id: p.id, name: p.name, models: [] as ReceiverModel[], error: String((e as Error)?.message ?? e) }
    }
  }))
  return { source: 'host', selection, providers }
}
