/**
 * Cross-origin request fence: the second, independent line behind the route
 * admission in route-guard.ts.
 *
 * Admission answers *who is calling*; this answers *where the call was
 * initiated*. Either one alone still leaves a hole:
 *
 * - Without admission, any local process reads the approval timeline.
 * - Without this fence, any page in the user browser can drive the
 *   destructive POSTs. A cross-site `text/plain` POST is a CORS *simple*
 *   request, so the browser sends it with no preflight and the side effect
 *   lands even though the page cannot read the response.
 *
 * The two checks are deliberately asymmetric:
 *
 * | | GET/HEAD (read) | POST (write) |
 * | no Origin | allow (curl, EventSource) | 403 (a same-origin fetch always sends it) |
 * | Origin present | scheme+host+port must equal Host | same |
 * | Sec-Fetch-Site: cross-site | 403 | 403 |
 * | Content-Type | not checked | must be application/json (else 415) |
 *
 * Comparing the whole origin triple — not just the host — is what closes DNS
 * rebinding: `http://127.0.0.1:PORT` and `https://127.0.0.1:PORT` share a host
 * and differ in origin.
 */

/** Outcome of one fence check. */
export type FenceVerdict = { ok: true } | { ok: false; status: 403 | 415; reason: string }

/** Minimal request face (mirrors the guard's). */
export interface FenceRequest {
  method?: string | undefined
  url?: string | undefined
  headers?: Record<string, string | string[] | undefined> | undefined
}

/** Escape hatch: `strict` (default) | `lenient` (allow Origin-less writes) | `off`. */
export const ORIGIN_ENV = 'DSH_PERM_GATE_ORIGIN_FENCE'

/** A write must arrive as JSON; anything else is not a call this API accepts. */
const JSON_TYPE = /^application\/json\s*(?:;|$)/i

function envValue(env?: Readonly<Record<string, string | undefined>>): 'strict' | 'lenient' | 'off' {
  const raw = (env ?? (process.env as Readonly<Record<string, string | undefined>>))[ORIGIN_ENV]?.trim().toLowerCase()
  if (raw === 'lenient' || raw === 'off') return raw
  return 'strict'
}

/** Case-insensitive header read. */
function header(req: FenceRequest, name: string): string {
  const headers = req.headers
  if (headers === undefined || headers === null) return ''
  const want = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== want) continue
    const raw = headers[key]
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) return raw.join('; ')
    return ''
  }
  return ''
}

/**
 * Compare an `Origin` header against the request's own authority.
 * @returns `undefined` when they match, else a reason.
 */
function originMismatch(req: FenceRequest, origin: string): string | undefined {
  if (origin === 'null') return 'opaque origin'
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return 'unparseable origin'
  }
  // The authority the client actually addressed. Node lowercases the key;
  // the value keeps its case, and host names compare case-insensitively.
  const host = header(req, 'host').trim().toLowerCase()
  if (host === '') return 'missing host header'
  if (parsed.host.toLowerCase() !== host) return 'origin host mismatch'
  // https vs http on the same host/port is a different origin (DNS rebinding).
  const viaTls = (req as { socket?: { encrypted?: boolean } }).socket?.encrypted === true
  const expectedScheme = viaTls ? 'https:' : 'http:'
  if (parsed.protocol !== expectedScheme) return 'origin scheme mismatch'
  return undefined
}

/** Shared prefix checks: an explicit cross-site marker is always refused. */
function crossSite(req: FenceRequest): boolean {
  return header(req, 'sec-fetch-site').trim().toLowerCase() === 'cross-site'
}

/**
 * Read semantics (GET / HEAD). Served to anything that asked: a browser
 * same-origin GET carries no Origin at all, and EventSource never sets one, so
 * requiring it would break the SSE stream that the notice strip depends on.
 * An *present* Origin still has to match, which is what stops a rebinding
 * page from reading the timeline.
 */
export function checkRead(req: FenceRequest, env?: Readonly<Record<string, string | undefined>>): FenceVerdict {
  const mode = envValue(env)
  if (mode === 'off') return { ok: true }
  if (crossSite(req)) return { ok: false, status: 403, reason: 'cross-site read refused' }
  const origin = header(req, 'origin').trim()
  if (origin === '') return { ok: true }
  const mismatch = originMismatch(req, origin)
  if (mismatch !== undefined) return { ok: false, status: 403, reason: mismatch }
  return { ok: true }
}

/**
 * Write semantics (POST). A same-origin `fetch` always sends `Origin`, so a
 * write without one did not come from a browser page at all — it came from a
 * local client, which is exactly what the admission layer owns. In `lenient`
 * mode that rule is relaxed for old webviews that omit the header.
 */
export function checkWrite(req: FenceRequest, env?: Readonly<Record<string, string | undefined>>): FenceVerdict {
  const mode = envValue(env)
  if (mode === 'off') return { ok: true }
  if (crossSite(req)) return { ok: false, status: 403, reason: 'cross-site write refused' }
  const origin = header(req, 'origin').trim()
  if (origin === '') {
    if (mode === 'strict') return { ok: false, status: 403, reason: 'write without origin' }
  } else {
    const mismatch = originMismatch(req, origin)
    if (mismatch !== undefined) return { ok: false, status: 403, reason: mismatch }
  }
  const type = header(req, 'content-type').trim()
  if (type === '') return { ok: false, status: 415, reason: 'write without content-type' }
  if (!JSON_TYPE.test(type)) return { ok: false, status: 415, reason: 'write must be application/json' }
  return { ok: true }
}

/** Which fence a route gets. `auto` derives it from the request method. */
export type MethodKind = 'read' | 'write' | 'auto'

/** Resolve `auto` to a concrete kind for one request. */
export function kindOf(requested: MethodKind, method: string | undefined): 'read' | 'write' {
  if (requested !== 'auto') return requested
  const m = (method ?? 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD' ? 'read' : 'write'
}

/** Route the request through the matching fence. */
export function checkRequest(
  req: FenceRequest,
  requested: MethodKind,
  env?: Readonly<Record<string, string | undefined>>,
): FenceVerdict {
  return kindOf(requested, req.method) === 'read' ? checkRead(req, env) : checkWrite(req, env)
}
