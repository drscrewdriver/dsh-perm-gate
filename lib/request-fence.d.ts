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
export type FenceVerdict = {
    ok: true;
} | {
    ok: false;
    status: 403 | 415;
    reason: string;
};
/** Minimal request face (mirrors the guard's). */
export interface FenceRequest {
    method?: string | undefined;
    url?: string | undefined;
    headers?: Record<string, string | string[] | undefined> | undefined;
}
/** Escape hatch: `strict` (default) | `lenient` (allow Origin-less writes) | `off`. */
export declare const ORIGIN_ENV = "DSH_PERM_GATE_ORIGIN_FENCE";
/**
 * Read semantics (GET / HEAD). Served to anything that asked: a browser
 * same-origin GET carries no Origin at all, and EventSource never sets one, so
 * requiring it would break the SSE stream that the notice strip depends on.
 * An *present* Origin still has to match, which is what stops a rebinding
 * page from reading the timeline.
 */
export declare function checkRead(req: FenceRequest, env?: Readonly<Record<string, string | undefined>>): FenceVerdict;
/**
 * Write semantics (POST). A same-origin `fetch` always sends `Origin`, so a
 * write without one did not come from a browser page at all — it came from a
 * local client, which is exactly what the admission layer owns. In `lenient`
 * mode that rule is relaxed for old webviews that omit the header.
 */
export declare function checkWrite(req: FenceRequest, env?: Readonly<Record<string, string | undefined>>): FenceVerdict;
/** Which fence a route gets. `auto` derives it from the request method. */
export type MethodKind = 'read' | 'write' | 'auto';
/** Resolve `auto` to a concrete kind for one request. */
export declare function kindOf(requested: MethodKind, method: string | undefined): 'read' | 'write';
/** Route the request through the matching fence. */
export declare function checkRequest(req: FenceRequest, requested: MethodKind, env?: Readonly<Record<string, string | undefined>>): FenceVerdict;
