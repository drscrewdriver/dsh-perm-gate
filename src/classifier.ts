/**
 * LLM-assist classifier for dsh-perm-gate's `llmAssist` strategy.
 *
 * Calls an OpenAI-compatible `/chat/completions` endpoint (the user may point it
 * at any custom API via `classifierEndpoint` / `classifierModel` / `classifierApiKey`)
 * and asks for a structured verdict on one tool call. Strictly fail-closed: any
 * transport, parsing, or schema error returns `ask` so the human seam stays
 * authoritative — an LLM can widen to `allow`/`deny` but never silence the review.
 */
export type ClassifyVerdict = 'allow' | 'deny' | 'ask'

/** Setup for one classifier call. */
export interface ClassifierConfig {
  /** OpenAI-compatible base URL, e.g. `https://api.openai.com/v1` (or any custom gateway). */
  endpoint?: string
  /** The chat model id to invoke. */
  model?: string
  /** Bearer token / API key for the endpoint; use the session provider when absent. */
  apiKey?: string
  /** Abort after this many milliseconds. Default 30s. */
  timeoutMs?: number
}

/** The call being judged (bounded/redacted before it leaves the host). */
export interface ClassifyRequest {
  readonly tool: string
  /** Redacted/bounded argument snapshot (secrets already stripped upstream). */
  readonly args: unknown
  /** The deterministic reason the call reached the LLM-assist seam. */
  readonly reason: string
}

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Ask the configured LLM whether one tool call should proceed.
 * @param cfg - endpoint/model/timeout setup.
 * @param req - the bounded call to judge.
 * @param nowFetch - injectable fetch (defaults to global fetch) for tests.
 * @returns `allow` / `deny`, or `ask` on any error or uncertainty (fail-closed).
 */
export async function classifyWithLLM(
  cfg: ClassifierConfig,
  req: ClassifyRequest,
  nowFetch: typeof fetch = fetch,
): Promise<ClassifyVerdict> {
  const endpoint = cfg.endpoint
  const model = cfg.model
  if (!endpoint || !model) return 'ask'
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const system =
    'You are a permission classifier for a coding agent. Judge one tool call and reply with ONLY JSON ' +
    '{"verdict":"allow"|"deny"|"ask","reason":"short"}. allow only for clearly safe, in-scope operations; ' +
    'deny for destructive, credential, or exfiltration-adjacent operations; ask on any doubt. Never reveal secrets.'

  const url = `${endpoint.replace(/\/$/, '')}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`

  try {
    const res = await nowFetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: JSON.stringify({
              tool: req.tool,
              args: req.args ?? {},
              reason: req.reason,
              instruction: 'Reply strictly as JSON: {"verdict":"allow"|"deny"|"ask","reason":"..."}',
            }),
          },
        ],
      }),
    })
    if (!res.ok) return 'ask'
    const body = await res.json() as { choices?: { message?: { content?: string } }[] }
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== 'string') return 'ask'
    const parsed = JSON.parse(content) as { verdict?: unknown; reason?: unknown }
    if (parsed.verdict === 'allow' || parsed.verdict === 'deny') return parsed.verdict
    return 'ask'
  } catch {
    return 'ask' // network failure / abort / malformed JSON — fail closed
  } finally {
    clearTimeout(timer)
  }
}