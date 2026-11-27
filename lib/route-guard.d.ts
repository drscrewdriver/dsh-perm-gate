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
import { type MethodKind } from './request-fence.js';
/** How this host can enforce route access. */
export type FenceMode = 'host' | 'pass' | 'cookie' | 'off';
/** The admission policy webServer.register understands on the newer line. */
export type AuthPolicy = 'anonymous' | 'required' | 'deny';
/** Minimal request face: enough to read headers (and later Origin). */
export interface GuardRequest {
    method?: string | undefined;
    url?: string | undefined;
    headers?: Record<string, string | string[] | undefined> | undefined;
    on?: ((event: string, cb: (chunk?: unknown) => void) => unknown) | undefined;
}
/** Minimal response face used by the 401 answer. */
export interface GuardResponse {
    writeHead?: (code: number, headers?: Record<string, string>) => unknown;
    end?: (body?: string) => unknown;
    write?: ((chunk: string) => unknown) | undefined;
}
/**
 * The connection service face used for admission. Only probed, never
 * value-imported, and never made an inject entry: a hard dependency would make
 * the whole plugin refuse to load on hosts that do not ship the service.
 */
export interface GuardConnection {
    requestRejection?: (request: {
        headers: Record<string, string | readonly string[] | undefined>;
    }) => unknown;
}
/** Wiring handed over once per plugin load (see configureRouteGuard). */
export interface GuardDeps {
    /** The connection service when the host has one (probed, not required). */
    readonly connection?: GuardConnection | undefined;
    /** Environment source (defaults to process.env); injectable for tests. */
    readonly env?: Readonly<Record<string, string | undefined>> | undefined;
    /** WARN sink; defaults to console.warn. */
    readonly log?: ((line: string) => void) | undefined;
    /** Test seam: pin one mode and skip env + probing entirely. */
    readonly mode?: FenceMode | undefined;
    /** Test seam: `off` skips the cross-origin fence as well. */
    readonly originFence?: 'on' | 'off' | undefined;
}
/** One exact route, with the admission policy the newer host understands. */
export interface GuardRoute {
    kind: 'exact';
    path: string;
    /**
     * Admission policy - 'required' is what this plugin asks for. Declared here
     * (not in the host package) because the host types are version-specific and
     * this module must load on every supported line; an older register simply
     * ignores the unknown key (and if it throws instead, the guard downgrades to
     * the cookie fence).
     */
    auth?: AuthPolicy | undefined;
    /**
     * Read/write class for the cross-origin fence (request-fence.ts).
     * `auto` keys off the request method; the POST routes that have no side
     * effect (health probe, rule test) are marked `read` explicitly — deriving
     * them from the verb would 403 every `curl -X POST` health check.
     */
    methodKind?: MethodKind | undefined;
    handler: (req: unknown, res: unknown) => unknown;
}
/** The minimal webServer face this module registers against. */
export interface GuardServer {
    register(route: GuardRoute): () => void;
}
/** Escape hatch env var: host | pass | cookie | off. */
export declare const MODE_ENV = "DSH_PERM_GATE_ROUTE_AUTH";
/** Case-insensitive single-header read (Node lowercases, fakes and proxies do not). */
export declare function headerValue(req: GuardRequest, name: string): string;
/** Test-only: forget the once-per-process warnings. */
export declare function resetGuardWarnings(): void;
/**
 * Resolve the fence mode for this host.
 *
 * Order is fixed and deliberate: an explicit env value wins; otherwise the
 * connection probe decides; otherwise the host owns admission (pass). That
 * last one is never assumed to work silently - guardedRegister proves it by
 * calling register and downgrades to cookie if the host rejects the option.
 */
export declare function fenceMode(deps?: GuardDeps): FenceMode;
/**
 * Hand the guard its one copy of the host capabilities. Called once from
 * apply with { connection: fallbackGet('connection') }; every route
 * registration after that point is protected without further arguments.
 */
export declare function configureRouteGuard(deps: GuardDeps): void;
/** The wired deps (exported so tests and diagnostics can see what is in force). */
export declare function routeGuardDeps(): GuardDeps;
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
export declare function guardedRegister(ws: GuardServer, route: GuardRoute, deps?: GuardDeps): () => void;
