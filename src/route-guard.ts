/**
 * The single choke point every route of this plugin registers through, so that
 * "registered" and "access-controlled" are the same structural fact instead of
 * something a future route has to remember.
 *
 * Background: ctx.webServer.register() predates the host admission layer, and a
 * handler that only branches on req.method is reachable by anything that can
 * open a loopback socket - including any page in the user browser (a cross-site
 * text/plain POST is a CORS *simple* request, so it is sent without a preflight).
 * All 13 routes of this plugin were in that shape.
 *
 * Why capability probing and not a version check: the plugin serves
 * engines.dsh >=0.1.0-rc.2 <0.3.0-0. In the 0.2.2 desktop build
 * connection.requestRejection is real code (16 references in the asar); in
 * 0.2.3-alpha.2 it is gone and webServer.register({ auth }) is the only
 * mechanism. Measured, the same minor version exposes different APIs depending
 * on deployment shape, so a version test would lie in one of the two directions
 * - and lying here means "silently unprotected".
 */

import { checkRequest, type MethodKind } from './request-fence.js'

/** How this host can enforce route access. */
export type FenceMode = 'host' | 'pass' | 'cookie' | 'off'

/** The admission policy webServer.register understands on the newer line. */
export type AuthPolicy = 'anonymous' | 'required' | 'deny'

/** Minimal request face: enough to read headers (and later Origin). */
export interface GuardRequest {
  method?: string | undefined
  url?: string | undefined
  headers?: Record<string, string | string[] | undefined> | undefined
  on?: ((event: string, cb: (chunk?: unknown) => void) => unknown) | undefined
}

/** Minimal response face used by the 401 answer. */
export interface GuardResponse {
  writeHead?: (code: number, headers?: Record<string, string>) => unknown
  end?: (body?: string) => unknown
  write?: ((chunk: string) => unknown) | undefined
}

/**
 * The connection service face used for admission. Only probed, never
 * value-imported, and never made an inject entry: a hard dependency would make
 * the whole plugin refuse to load on hosts that do not ship the service.
 */
export interface GuardConnection {
  requestRejection?: (request: { headers: Record<string, string | readonly string[] | undefined> }) => unknown
}

/** Wiring handed over once per plugin load (see configureRouteGuard). */
export interface GuardDeps {
  /** The connection service when the host has one (probed, not required). */
  readonly connection?: GuardConnection | undefined
  /** Environment source (defaults to process.env); injectable for tests. */
  readonly env?: Readonly<Record<string, string | undefined>> | undefined
  /** WARN sink; defaults to console.warn. */
  readonly log?: ((line: string) => void) | undefined
  /** Test seam: pin one mode and skip env + probing entirely. */
  readonly mode?: FenceMode | undefined
  /** Test seam: `off` skips the cross-origin fence as well. */
  readonly originFence?: 'on' | 'off' | undefined
}

/** One exact route, with the admission policy the newer host understands. */
export interface GuardRoute {
  kind: 'exact'
  path: string
  /**
   * Admission policy - 'required' is what this plugin asks for. Declared here
   * (not in the host package) because the host types are version-specific and
   * this module must load on every supported line; an older register simply
   * ignores the unknown key (and if it throws instead, the guard downgrades to
   * the cookie fence).
   */
  auth?: AuthPolicy | undefined
  /**
   * Read/write class for the cross-origin fence (request-fence.ts).
   * `auto` keys off the request method; the POST routes that have no side
   * effect (health probe, rule test) are marked `read` explicitly — deriving
   * them from the verb would 403 every `curl -X POST` health check.
   */
  methodKind?: MethodKind | undefined
  handler: (req: unknown, res: unknown) => unknown
}

/** The minimal webServer face this module registers against. */
export interface GuardServer {
  register(route: GuardRoute): () => void
}

/** Escape hatch env var: host | pass | cookie | off. */
export const MODE_ENV = 'DSH_PERM_GATE_ROUTE_AUTH'

/** Cookie shape the browser half receives from the host on both lines. */
const AUTH_COOKIE = /(?:^|;\s*)dsh-auth-[^=]+=/

/** Anything non-empty here means this request is not admitted. */
function isRejection(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false
  if (typeof value === 'string') return value !== ''
  return true
}

/** Case-insensitive single-header read (Node lowercases, fakes and proxies do not). */
export function headerValue(req: GuardRequest, name: string): string {
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

/** The header bag a host probe expects (no undefined values). */
function headerBag(req: GuardRequest): Record<string, string | readonly string[] | undefined> {
  const headers = req.headers ?? {}
  const out: Record<string, string | readonly string[] | undefined> = {}
  for (const key of Object.keys(headers)) out[key] = headers[key]
  return out
}

// --- warnings (each exactly once per process) ------------------------------

const warned = new Set<string>()

function warnOnce(deps: GuardDeps, key: string, line: string): void {
  if (warned.has(key)) return
  warned.add(key)
  const sink = deps.log ?? ((text: string) => { console.warn(text) })
  sink('[dsh-perm-gate] ' + line)
}

/** Test-only: forget the once-per-process warnings. */
export function resetGuardWarnings(): void {
  warned.clear()
}

// --- capability probing ----------------------------------------------------

/**
 * Resolve the fence mode for this host.
 *
 * Order is fixed and deliberate: an explicit env value wins; otherwise the
 * connection probe decides; otherwise the host owns admission (pass). That
 * last one is never assumed to work silently - guardedRegister proves it by
 * calling register and downgrades to cookie if the host rejects the option.
 */
export function fenceMode(deps: GuardDeps = configured): FenceMode {
  if (deps.mode !== undefined) return deps.mode

  const env = deps.env ?? (process.env as Readonly<Record<string, string | undefined>>)
  const raw = env[MODE_ENV]?.trim().toLowerCase()
  if (raw === 'host' || raw === 'pass' || raw === 'cookie' || raw === 'off') {
    if (raw === 'off') {
      warnOnce(deps, 'off', MODE_ENV + '=off - route authentication is DISABLED (operator override)')
    }
    return raw
  }
  if (raw !== undefined && raw !== '') {
    warnOnce(deps, 'unknown:' + raw, MODE_ENV + '="' + raw + '" is not a mode; falling back to capability probing')
  }

  return typeof deps.connection?.requestRejection === 'function' ? 'host' : 'pass'
}

// --- the deps the plugin wired at load time --------------------------------

let configured: GuardDeps = {}

/**
 * Hand the guard its one copy of the host capabilities. Called once from
 * apply with { connection: fallbackGet('connection') }; every route
 * registration after that point is protected without further arguments.
 */
export function configureRouteGuard(deps: GuardDeps): void {
  configured = deps
}

/** The wired deps (exported so tests and diagnostics can see what is in force). */
export function routeGuardDeps(): GuardDeps {
  return configured
}

// --- fenced handlers -------------------------------------------------------

/** Answer 401 without touching the handler. */
function refused(res: GuardResponse, reason: string): void {
  const body = JSON.stringify({ ok: false, error: reason, fence: 'auth' })
  try {
    res.writeHead?.(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
    res.end?.(body)
  } catch {
    // The socket is already gone; nothing to answer.
  }
}

/**
 * host mode: ask the host per request and stop before the handler when the
 * host says no. A probe that throws is NOT a pass - fail closed.
 */
function hostFence(handler: GuardRoute['handler'], deps: GuardDeps): GuardRoute['handler'] {
  const reject = deps.connection?.requestRejection
  return (rawReq, rawRes) => {
    const req = rawReq as GuardRequest
    const res = rawRes as GuardResponse
    let verdict: unknown
    try {
      verdict = reject?.({ headers: headerBag(req) })
    } catch (e) {
      warnOnce(deps, 'probe-error', 'admission probe threw (' + String((e as Error)?.message ?? e) + '); refusing the request')
      refused(res, 'authentication unavailable')
      return undefined
    }
    if (isRejection(verdict)) {
      refused(res, typeof verdict === 'string' ? verdict : 'unauthorized')
      return undefined
    }
    return handler(rawReq, rawRes)
  }
}

/**
 * cookie mode: the last-resort fence for hosts that offer no admission API.
 * Presence of the host-issued dsh-auth-* cookie is required; absent means 401.
 */
function cookieFence(handler: GuardRoute['handler']): GuardRoute['handler'] {
  return (rawReq, rawRes) => {
    const req = rawReq as GuardRequest
    const res = rawRes as GuardResponse
    if (!AUTH_COOKIE.test(headerValue(req, 'cookie'))) {
      refused(res, 'missing dsh-auth cookie')
      return undefined
    }
    return handler(rawReq, rawRes)
  }
}

/**
 * The cross-origin fence, applied after admission and before the handler.
 * Kept separate from the admission fence so a refusal can say which line
 * stopped it (`fence: 'origin'`), which is the difference between "log in"
 * and "you are not calling this from where you claim".
 */
function originFence(handler: GuardRoute['handler'], methodKind: MethodKind, deps: GuardDeps): GuardRoute['handler'] {
  if (methodKind === 'read' && deps.originFence === 'off') return handler
  return (rawReq, rawRes) => {
    const req = rawReq as GuardRequest
    const res = rawRes as GuardResponse
    const verdict = checkRequest(req, methodKind, deps.env)
    if (!verdict.ok) {
      try {
        res.writeHead?.(verdict.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
        res.end?.(JSON.stringify({ ok: false, error: verdict.reason, fence: 'origin' }))
      } catch {
        // socket already gone
      }
      return undefined
    }
    return handler(rawReq, rawRes)
  }
}

/**
 * Register one route behind the best fence this host can enforce.
 *
 * - host   - per-request connection.requestRejection, 401 before the handler.
 * - pass   - declare auth: 'required' and let the host adjudicate; if the host
 *            refuses the unknown key, downgrade to cookie and re-register once.
 * - cookie - dsh-auth-* cookie shape check.
 * - off    - operator escape hatch: register bare, WARN once (never silent).
 *
 * Returns the unregister function the caller must tie to ctx.effect.
 */
export function guardedRegister(
  ws: GuardServer,
  route: GuardRoute,
  deps: GuardDeps = configured,
): () => void {
  const mode = fenceMode(deps)
  const methodKind: MethodKind = route.methodKind ?? 'auto'

  // Two independent lines, in this order: admission (who) then origin (from
  // where). The origin fence is applied in every mode except the operator
  // "off" - a host that admits too much must not thereby drop the whole
  // cross-origin check as well.
  const fenced = (handler: GuardRoute['handler']): GuardRoute['handler'] =>
    originFence(handler, methodKind, deps)

  if (mode === 'off') {
    // Never silent: the operator escape hatch is loud, and loud exactly once.
    warnOnce(deps, 'off', MODE_ENV + '=off - route authentication is DISABLED (operator override)')
    return ws.register(route)
  }

  if (mode === 'pass') {
    try {
      return ws.register({ ...route, auth: 'required', handler: fenced(route.handler) })
    } catch (e) {
      // A host that does not understand "auth" throws on an unknown option.
      // That must not leave 13 routes unregistered - and it must not leave
      // them unprotected either: fall back to the cookie fence.
      warnOnce(
        deps,
        'pass-downgrade',
        'webServer.register({auth}) was refused (' + String((e as Error)?.message ?? e) + '); falling back to the cookie fence',
      )
      return guardedRegister(ws, route, { ...deps, mode: 'cookie' })
    }
  }

  if (mode === 'host') return ws.register({ ...route, handler: fenced(hostFence(route.handler, deps)) })
  return ws.register({ ...route, handler: fenced(cookieFence(route.handler)) })
}
