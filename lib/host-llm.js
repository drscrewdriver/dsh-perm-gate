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
/** Fallback matching dsh-approval-gate's resolveModel default. */
export const DEFAULT_HOST_MODEL = { provider: 'deepseek-official', model: 'deepseek-v4-flash' };
/**
 * Finish kinds that mean "what you got is not the whole answer". Graded as a
 * failure: a truncated or filtered stream is not a verdict (issue #7).
 */
const TRUNCATED_FINISH_KINDS = new Set([
    'max-tokens', 'max_tokens', 'length', 'truncated', 'content-filter', 'content_filter',
]);
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
export async function completeViaHost(hostLlm, selection, system, user, timeoutMs, opts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let text = '';
        let finishKind;
        const effort = typeof opts.effort === 'string' && opts.effort !== '' ? opts.effort : undefined;
        const stream = hostLlm.stream({
            provider: selection.provider,
            model: selection.model,
            messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
            system,
            temperature: 0,
            ...(effort !== undefined ? { reasoningEffort: effort } : {}),
            maxTokens: opts.maxTokens ?? 256,
            signal: controller.signal,
        });
        for await (const chunk of stream) {
            if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
                text += chunk.text;
            }
            else if (chunk.type === 'finish') {
                const kind = chunk.reason?.kind;
                if (kind === 'error' || kind === 'aborted') {
                    const failure = chunk.reason?.failure?.message;
                    return { ok: false, error: failure ?? kind };
                }
                finishKind = kind;
            }
        }
        if (finishKind !== undefined && TRUNCATED_FINISH_KINDS.has(finishKind)) {
            return { ok: false, error: `truncated answer (finish: ${finishKind})` };
        }
        if (text.trim() === '')
            return { ok: false, error: 'empty answer' };
        return { ok: true, content: text };
    }
    catch (e) {
        return { ok: false, error: String(e?.message ?? e) };
    }
    finally {
        clearTimeout(timer);
    }
}
