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
 * One completion through the host `llm` service with an abort timeout.
 * Resolves `{ ok: true, content }` with the accumulated assistant text, or
 * `{ ok: false, error }` on stream failure, abort, or an empty answer.
 */
export async function completeViaHost(hostLlm, selection, system, user, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let text = '';
        const stream = hostLlm.stream({
            provider: selection.provider,
            model: selection.model,
            messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
            system,
            temperature: 0,
            reasoningEffort: 'off',
            maxTokens: 256,
            signal: controller.signal,
        });
        for await (const chunk of stream) {
            if ((chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') && typeof chunk.text === 'string') {
                text += chunk.text;
            }
            else if (chunk.type === 'finish' && chunk.reason !== undefined && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
                const failure = chunk.reason.failure?.message;
                return { ok: false, error: failure ?? chunk.reason.kind };
            }
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
