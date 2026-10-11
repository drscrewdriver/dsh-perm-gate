/**
 * LLM-assist classifier for dsh-perm-gate's `llmAssist` strategy.
 *
 * Calls an OpenAI-compatible `/chat/completions` endpoint (the user may point it
 * at any custom API via `classifierEndpoint` / `classifierModel` / `classifierApiKey`)
 * and asks for a structured verdict on one tool call. Strictly fail-closed: any
 * transport, parsing, or schema error returns `ask` so the human seam stays
 * authoritative — an LLM can widen to `allow`/`deny` but never silence the review.
 *
 * @deprecated No production call site: the live grading path is `risk.ts`
 * (`classifyRisk`). Kept because `test/feature.spec.ts` and the published
 * `./classifier` export depend on it. Its `deny` output must never be acted on by
 * the runtime — a probabilistic verdict may not create an unappealable block.
 *
 * The transport layer (`chatCompletion`) is shared with `risk.ts`, which layers
 * the risk-category protocol on top of the same custom-endpoint setup.
 */
import { graderRulesText } from './grader-rules.js'

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

/** The call being judged. Callers MUST pass args already through `redactArgs`. */
export interface ClassifyRequest {
  readonly tool: string
  /**
   * Bounded argument snapshot with secret values masked by `redactArgs` from
   * `./redact.js`. This used to be documented as "secrets already stripped
   * upstream" while nothing upstream stripped anything — the raw args object
   * was serialized straight to a user-configured third-party endpoint. Redaction
   * is now a real, tested layer; passing unredacted args here is a bug.
   */
  readonly args: unknown
  /** The deterministic reason the call reached the LLM-assist seam. */
  readonly reason: string
}

export const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Normalize a user-entered OpenAI-compatible base URL into the
 * `/chat/completions` POST URL. Accepts both the bare base
 * (`https://api.example.com/v1`) and a fully pasted path
 * (`https://api.example.com/v1/chat/completions`) — pasting the complete URL
 * is the most common custom-endpoint mistake and must not 404.
 */
export function chatCompletionsUrl(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '')
  return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`
}

/** Status codes that mean "the request shape was rejected" (not auth/network) — worth one lenient retry. */
const SHAPE_REJECT_STATUS = new Set([400, 404, 415, 422])

async function postChat(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  nowFetch: typeof fetch,
): Promise<{ ok: true; content: string } | { ok: false; status?: number }> {
  try {
    const res = await nowFetch(url, { method: 'POST', headers, signal, body: JSON.stringify(body) })
    if (!res.ok) return { ok: false, status: res.status }
    const text = await res.text()
    if (text.trim() === '') return { ok: false, status: res.status }
    // Custom models may answer with plain text instead of the JSON envelope;
    // pass the raw text through — the verdict parser's keyword fallback judges it.
    let content = text
    try {
      const parsed = JSON.parse(text) as { choices?: { message?: { content?: string } }[] }
      const inner = parsed.choices?.[0]?.message?.content
      if (typeof inner === 'string') content = inner
    } catch {
      // not the OpenAI envelope: keep the raw body as content
    }
    return { ok: true, content }
  } catch {
    return { ok: false } // network failure / abort
  }
}

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
export async function chatCompletion(
  cfg: ClassifierConfig,
  system: string,
  user: string,
  nowFetch: typeof fetch = fetch,
): Promise<{ ok: true; content: string } | { ok: false; status?: number; error?: string }> {
  const endpoint = cfg.endpoint
  const model = cfg.model
  if (!endpoint || !model) return { ok: false }
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = chatCompletionsUrl(endpoint)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]

  try {
    const first = await postChat(url, headers, {
      model, temperature: 0, response_format: { type: 'json_object' }, messages,
    }, controller.signal, nowFetch)
    if (first.ok) return first
    if (first.status === undefined || !SHAPE_REJECT_STATUS.has(first.status)) {
      return controller.signal.aborted ? { ok: false, error: 'timeout' } : first
    }
    const second = await postChat(url, headers, { model, temperature: 0, messages }, controller.signal, nowFetch)
    if (second.ok) return second
    return controller.signal.aborted ? { ok: false, error: 'timeout' } : second
  } finally {
    clearTimeout(timer)
  }
}

/** A bounded single-shot task result; `undefined` means "try again". */
type RetryTask<T> = () => Promise<T | undefined>

/**
 * Run `task` up to `attempts` times (default 2 = one initial try + one retry),
 * re-running whenever it resolves `undefined` or rejects. Never throws.
 */
export async function withLlmRetry<T>(task: RetryTask<T>, attempts = 2): Promise<T | undefined> {
  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    try {
      const result = await task()
      if (result !== undefined) return result
    } catch {
      // fall through to the next attempt
    }
  }
  return undefined
}

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
  // The rule text is shared with `risk.ts` through `grader-rules.ts`: two graders
  // with different standards grade the same call differently (a local `cat .env`
  // denied by one, allowed by the other). Only the output shape differs here.
  const system =
    'You are a permission classifier for a coding agent. Judge one tool call and reply with ONLY JSON ' +
    '{"verdict":"allow"|"deny"|"ask","reason":"short"}.\n' +
    'allow = proceed; deny = refuse; ask = needs the human.\n' +
    graderRulesText()

  const user = JSON.stringify({
    tool: req.tool,
    args: req.args ?? {},
    reason: req.reason,
    instruction: 'Reply strictly as JSON: {"verdict":"allow"|"deny"|"ask","reason":"..."}',
  })

  const content = await withLlmRetry(() => chatCompletion(cfg, system, user, nowFetch).then((r) => (r.ok ? r.content : undefined)))
  if (content === undefined) return 'ask'
  try {
    const parsed = JSON.parse(content) as { verdict?: unknown }
    if (parsed.verdict === 'allow' || parsed.verdict === 'deny') return parsed.verdict
    return 'ask'
  } catch {
    return 'ask' // malformed JSON — fail closed
  }
}
