/**
 * Host-side LLM transport for dsh-perm-gate's llmAssist: instead of a custom
 * OpenAI-compatible endpoint, the gate may call the DSH host's `llm` service
 * (the model-group setup the user already configured, as demonstrated by
 * dsh-approval-gate's `llm.stream` + `agentDefaultModel.currentSelection`).
 *
 * Transport-only and never throws: any failure resolves `{ ok: false }` so the
 * caller keeps the ask (fail-closed). Node-half only — never imported by the
 * client bundle.
 */
/** One request to the host `llm` service (shape per the dsh runtime contract). */
export interface HostLlmRequest {
    readonly provider: string;
    readonly model: string;
    readonly messages: readonly {
        readonly role: 'user';
        readonly content: readonly {
            readonly type: 'text';
            readonly text: string;
        }[];
    }[];
    readonly system?: string;
    readonly temperature?: number;
    readonly reasoningEffort?: string;
    readonly maxTokens?: number;
    readonly signal?: AbortSignal;
}
/** One stream chunk: text/reasoning deltas, or a terminal finish event. */
export interface HostLlmChunk {
    readonly type: string;
    readonly text?: string;
    readonly reason?: {
        readonly kind?: string;
        readonly failure?: {
            readonly message?: string;
        };
    };
}
/** The minimal face of the DSH `llm` service this plugin uses. */
export interface HostLlmLike {
    stream(request: HostLlmRequest): AsyncIterable<HostLlmChunk>;
}
/** The model-group selection used when no explicit override is configured. */
export interface HostModelSelection {
    readonly provider: string;
    readonly model: string;
}
/** Fallback matching dsh-approval-gate's resolveModel default. */
export declare const DEFAULT_HOST_MODEL: HostModelSelection;
/** Optional knobs for one host completion. */
export interface HostCallOptions {
    /**
     * Reasoning effort to request. Empty/undefined **omits** the field entirely so
     * the host's own model configuration decides — a hardcoded value is rejected by
     * host validation when the selected model does not advertise it (issue #8).
     */
    readonly effort?: string;
    readonly maxTokens?: number;
}
/**
 * One completion through the host `llm` service with an abort timeout.
 *
 * Only **final text** is the answer: `reasoning-delta` chunks are the model's
 * private working, never a verdict, and a stream that ends on `max-tokens` (or
 * any other truncating finish) is a failure rather than a short answer. Both
 * used to be accepted, which let a reasoning-only or cut-off stream reach the
 * verdict parser and be read as `safe` (issue #7).
 *
 * Resolves `{ ok: true, content }` with the accumulated assistant text, or
 * `{ ok: false, error }` on stream failure, abort, truncation, or an empty answer.
 */
export declare function completeViaHost(hostLlm: HostLlmLike, selection: HostModelSelection, system: string, user: string, timeoutMs: number, opts?: HostCallOptions): Promise<{
    ok: true;
    content: string;
} | {
    ok: false;
    error?: string;
}>;
