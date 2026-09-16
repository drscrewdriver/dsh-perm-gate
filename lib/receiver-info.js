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
function str(v) {
    return typeof v === 'string' ? v : '';
}
/** Resolve the effective host model selection (override → session → default). */
export function resolveHostSelection(deps) {
    const sel = deps.currentSelection?.();
    const provider = deps.overrideProvider !== '' && deps.overrideProvider !== undefined
        ? deps.overrideProvider
        : (str(sel?.provider) !== '' ? str(sel?.provider) : 'deepseek-official');
    const model = deps.overrideModel !== '' && deps.overrideModel !== undefined
        ? deps.overrideModel
        : (str(sel?.model) !== '' ? str(sel?.model) : 'deepseek-v4-flash');
    return { provider, model };
}
/** Build the receiver projection. Never throws. */
export async function buildReceiverInfo(deps) {
    if (deps.source !== 'host' || deps.llm?.listProviders === undefined) {
        return {
            source: deps.source,
            selection: deps.source === 'custom' && str(deps.customModel) !== ''
                ? { provider: 'custom', model: str(deps.customModel) }
                : null,
            providers: [],
        };
    }
    const selection = resolveHostSelection(deps);
    const raw = deps.llm.listProviders();
    const providers = await Promise.all(raw.map(async (p) => {
        let models = [];
        let error;
        try {
            models = (await deps.llm?.listModels?.(p.id) ?? []).map((m) => ({ id: m.id, name: m.name }));
        }
        catch (e) {
            error = String(e?.message ?? e);
        }
        if (models.length === 0) {
            // Fallback: route discovery. For an already-configured route the
            // adapter answers from its own stored knowledge (no network call) —
            // this also covers builds whose `listModels` is absent or dormant.
            try {
                const entry = deps.llm?.listConfigurableProviders?.().find((c) => c.provider === p.id);
                if (entry !== undefined && deps.llm?.discoverModels !== undefined) {
                    const discovered = await deps.llm.discoverModels(entry.settingsNs, { provider: p.id });
                    if (discovered.length > 0) {
                        models = discovered.map((m) => ({ id: m.id, name: m.name ?? m.id }));
                        error = undefined;
                    }
                }
            }
            catch {
                // keep the primary error / empty state
            }
        }
        if (models.length === 0 && error === undefined)
            error = 'no models advertised';
        return { id: p.id, name: p.name, models, ...(error === undefined ? {} : { error }) };
    }));
    return { source: 'host', selection, providers };
}
