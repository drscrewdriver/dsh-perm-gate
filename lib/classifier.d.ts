/**
 * LLM-assist classifier for dsh-perm-gate's `llmAssist` strategy.
 *
 * Calls an OpenAI-compatible `/chat/completions` endpoint (the user may point it
 * at any custom API via `classifierEndpoint` / `classifierModel` / `classifierApiKey`)
 * and asks for a structured verdict on one tool call. Strictly fail-closed: any
 * transport, parsing, or schema error returns `ask` so the human seam stays
 * authoritative — an LLM can widen to `allow`/`deny` but never silence the review.
 *
 * The transport layer (`chatCompletion`) is shared with `risk.ts`, which layers
 * the risk-category protocol on top of the same custom-endpoint setup.
 */
export type ClassifyVerdict = 'allow' | 'deny' | 'ask';
/** Setup for one classifier call. */
export interface ClassifierConfig {
    /** OpenAI-compatible base URL, e.g. `https://api.openai.com/v1` (or any custom gateway). */
    endpoint?: string;
    /** The chat model id to invoke. */
    model?: string;
    /** Bearer token / API key for the endpoint; use the session provider when absent. */
    apiKey?: string;
    /** Abort after this many milliseconds. Default 30s. */
    timeoutMs?: number;
}
/** The call being judged (bounded/redacted before it leaves the host). */
export interface ClassifyRequest {
    readonly tool: string;
    /** Redacted/bounded argument snapshot (secrets already stripped upstream). */
    readonly args: unknown;
    /** The deterministic reason the call reached the LLM-assist seam. */
    readonly reason: string;
}
export declare const DEFAULT_TIMEOUT_MS = 30000;
/**
 * Normalize a user-entered OpenAI-compatible base URL into the
 * `/chat/completions` POST URL. Accepts both the bare base
 * (`https://api.example.com/v1`) and a fully pasted path
 * (`https://api.example.com/v1/chat/completions`) — pasting the complete URL
 * is the most common custom-endpoint mistake and must not 404.
 */
export declare function chatCompletionsUrl(endpoint: string): string;
/**
 * One OpenAI-compatible `/chat/completions` POST with an abort timeout.
 * Transport-only: resolves `{ ok: true, content }` with the assistant text, or
 * `{ ok: false }` on any non-2xx response, network failure, abort, or malformed
 * payload. Never throws.
 *
 * Custom-endpoint hardening: when the gateway rejects the request shape
 * (400/404/415/422 — typically an unsupported `response_format`), one lenient
 * retry runs WITHOUT `response_format` so plain OpenAI-compatible gateways
 * (ollama / llama.cpp / one-api style) still work.
 */
export declare function chatCompletion(cfg: ClassifierConfig, system: string, user: string, nowFetch?: typeof fetch): Promise<{
    ok: true;
    content: string;
} | {
    ok: false;
    status?: number;
    error?: string;
}>;
/** A bounded single-shot task result; `undefined` means "try again". */
type RetryTask<T> = () => Promise<T | undefined>;
/**
 * Run `task` up to `attempts` times (default 2 = one initial try + one retry),
 * re-running whenever it resolves `undefined` or rejects. Never throws.
 */
export declare function withLlmRetry<T>(task: RetryTask<T>, attempts?: number): Promise<T | undefined>;
/**
 * Ask the configured LLM whether one tool call should proceed.
 * @param cfg - endpoint/model/timeout setup.
 * @param req - the bounded call to judge.
 * @param nowFetch - injectable fetch (defaults to global fetch) for tests.
 * @returns `allow` / `deny`, or `ask` on any error or uncertainty (fail-closed).
 */
export declare function classifyWithLLM(cfg: ClassifierConfig, req: ClassifyRequest, nowFetch?: typeof fetch): Promise<ClassifyVerdict>;
export {};
