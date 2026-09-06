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
  readonly provider: string
  readonly model: string
  readonly messages: readonly { readonly role: 'user'; readonly content: readonly { readonly type: 'text'; readonly text: string }[] }[]
  readonly system?: string
  readonly temperature?: number
  readonly reasoningEffort?: string
  readonly maxTokens?: number
  readonly signal?: AbortSignal
}

/** One stream chunk: text/reasoning deltas, or a terminal finish event. */
export interface HostLlmChunk {
  readonly type: string
  readonly text?: string
  readonly reason?: { readonly kind?: string; readonly failure?: { readonly message?: string } }
}

/** The minimal face of the DSH `llm` service this plugin uses. */
export interface HostLlmLike {
  stream(request: HostLlmRequest): AsyncIterable<HostLlmChunk>
}

/** The model-group selection used when no explicit override is configured. */
export interface HostModelSelection {
  readonly provider: string
  readonly model: string
}

/** Fallback matching dsh-approval-gate's resolveModel default. */
export const DEFAULT_HOST_MODEL: HostModelSelection = { provider: 'deepseek-official', model: 'deepseek-v4-flash' }

/**
 * One completion through the host `llm` service with an abort timeout.
 * Resolves `{ ok: true, content }` with the accumulated assistant text, or
 * `{ ok: false, error }` on stream failure, abort, or an empty answer.
 */
export async function completeViaHost(
  hostLlm: HostLlmLike,
  selection: HostModelSelection,
  system: string,
  user: string,
  timeoutMs: number,
): Promise<{ ok: true; content: string } | { ok: false; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let text = ''
    const stream = hostLlm.stream({
      provider: selection.provider,
      model: selection.model,
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
      system,
      temperature: 0,
      reasoningEffort: 'off',
      maxTokens: 256,
      signal: controller.signal,
    })
    for await (const chunk of stream) {
      if ((chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') && typeof chunk.text === 'string') {
        text += chunk.text
      } else if (chunk.type === 'finish' && chunk.reason !== undefined && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
        const failure = chunk.reason.failure?.message
        return { ok: false, error: failure ?? chunk.reason.kind }
      }
    }
    if (text.trim() === '') return { ok: false, error: 'empty answer' }
    return { ok: true, content: text }
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) }
  } finally {
    clearTimeout(timer)
  }
}
