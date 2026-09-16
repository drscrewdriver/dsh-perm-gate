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
    readonly id: string;
    readonly name: string;
}
/** One provider group and its models (or the reason it failed to enumerate). */
export interface ReceiverProvider {
    readonly id: string;
    readonly name: string;
    readonly models: readonly ReceiverModel[];
    readonly error?: string;
}
/** What the settings card needs to render the receiver UI. */
export interface ReceiverInfo {
    readonly source: 'custom' | 'host';
    /** The provider/model the gate will use right now (null when undetermined). */
    readonly selection: {
        readonly provider: string;
        readonly model: string;
    } | null;
    /** Live provider groups; non-empty only in host mode. */
    readonly providers: readonly ReceiverProvider[];
}
/** The minimal faces of the host services this projection reads. */
export interface ReceiverDeps {
    source: 'custom' | 'host';
    /** Host `llm` service (host mode only). */
    llm?: {
        listProviders?: () => readonly {
            id: string;
            name: string;
        }[];
        listModels?: (providerId: string) => Promise<readonly {
            id: string;
            name: string;
        }[]>;
        listConfigurableProviders?: () => readonly {
            provider: string;
            settingsNs: string;
        }[];
        /** Discovery for a configured route answers from the adapter's own knowledge — no network call. */
        discoverModels?: (settingsNs: string, request: {
            provider?: string;
        }) => Promise<readonly {
            id: string;
            name?: string;
        }[]>;
    };
    /** Live session selection (agentDefaultModel.currentSelection). */
    currentSelection?: () => {
        provider?: unknown;
        model?: unknown;
    } | undefined;
    /** Namespace overrides (empty string = follow the session). */
    overrideProvider?: string;
    overrideModel?: string;
    /** The model field as configured for the custom receiver. */
    customModel?: string;
}
/** Resolve the effective host model selection (override → session → default). */
export declare function resolveHostSelection(deps: ReceiverDeps): {
    provider: string;
    model: string;
};
/** Build the receiver projection. Never throws. */
export declare function buildReceiverInfo(deps: ReceiverDeps): Promise<ReceiverInfo>;
