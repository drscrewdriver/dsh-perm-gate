/**
 * The built-in local HTTP/CONNECT proxy for dsh-perm-gate.
 *
 * The process-level network gate for shell subprocess traffic. Bash/pwsh
 * children inherit `HTTP(S)_PROXY`/`ALL_PROXY` environment variables
 * pointing here, and the proxy adjudicates EVERY connection target against
 * the loaded network rules and the active policy mode.
 *
 * Boundaries:
 * - DSH's `ctx.sandbox` enforces file effects only; network interception
 *   is entirely this plugin's job.
 * - The proxy has no session context, so `ask` decisions degrade to
 *   block + audit (web tools get the real approval seam at pre-execute).
 * - Bind failures degrade gracefully: warn + continue without proxy.
 */
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect } from 'node:net';
import { lookup } from 'node:dns/promises';
import { blockMessage, isIpLiteral } from './network.js';
// ─── Constants ─────────────────────────────────────────────────────────────
/** Proxy env var names the injector sets/restores (upper + lower for mixed-ecosystem CLIs). */
export const PROXY_ENV_NAMES = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
/** NO_PROXY env var names cleared by the injector. */
export const NO_PROXY_ENV_NAMES = ['NO_PROXY', 'no_proxy'];
/** Default DNS lookup bound (ms). A black-holed resolver must not hang a CONNECT. */
export const DNS_TIMEOUT_MS = 3000;
/** Default connection-setup bound (ms) — slowloris guard. */
export const HEADERS_TIMEOUT_MS = 60_000;
/** Default cap on concurrent accepted connections. */
export const MAX_CONNECTIONS = 256;
/** Bound on how long close() waits for a server to finish closing (ms). */
export const CLOSE_TIMEOUT_MS = 2000;
// ─── NetworkProxy ──────────────────────────────────────────────────────────
/**
 * The local HTTP/CONNECT policy proxy. Binds on demand; every live tunnel
 * socket is tracked and destroyed on close so updates and uninstalls leave
 * no orphaned connections.
 */
export class NetworkProxy {
    options;
    server;
    sockets = new Set();
    recent = [];
    stats = { denied: 0, askBlocked: 0 };
    actualPort = 0;
    /** In-flight start(); guards against a second concurrent bind. */
    starting;
    /** Set by close(); a bind resolving afterwards tears itself down. */
    closed = false;
    constructor(options) {
        this.options = options;
    }
    /**
     * Logger sink that can never throw. The logger is called from inside
     * 'error' handlers, so a throwing logger would itself become an
     * unhandled error and defeat the whole point of the guard.
     */
    safeWarn(message) {
        try {
            this.options.logger.warn(message);
        }
        catch {
            // A logger that throws must never escalate into a host crash.
        }
    }
    /** The bound port (valid after start resolves). */
    get port() {
        return this.actualPort;
    }
    /** Deny/ask blocks recorded since mount, newest first. */
    recentBlocks() {
        return this.recent;
    }
    /** Cumulative block counters. */
    blockStats() {
        return { ...this.stats };
    }
    /** Number of active sockets (tunnels + client connections). */
    activeSocketCount() {
        return this.sockets.size;
    }
    /**
     * Bind the server and return the actual port.
     * On bind failure: warns and returns -1 (degraded mode — no proxy).
     * Concurrent calls share the single in-flight bind.
     */
    async start() {
        if (this.starting !== undefined)
            return this.starting;
        this.starting = this.bind();
        try {
            return await this.starting;
        }
        finally {
            this.starting = undefined;
        }
    }
    async bind() {
        const server = createServer((req, res) => {
            // The request arrived: lift the pre-request idle bound.
            req.socket.setTimeout(0);
            this.handleRequest(req, res).catch((err) => {
                this.safeWarn(`[dsh-perm-gate] proxy request error: ${String(err)}`);
            });
        });
        server.on('connect', (req, socket, head) => {
            // CONNECT parsed: lift the pre-request idle bound so the tunnel may
            // stay open for as long as the client needs.
            ;
            socket.setTimeout(0);
            this.handleConnect(req, socket, head).catch((err) => {
                this.safeWarn(`[dsh-perm-gate] proxy connect error: ${String(err)}`);
                if (!socket.destroyed)
                    socket.destroy();
            });
        });
        server.on('error', (error) => {
            this.safeWarn(`[dsh-perm-gate] proxy server error: ${String(error)}`);
        });
        // T2.9 safety: catch client socket errors that slip through individual
        // request handlers (ECONNRESET after 403, etc.) — never crash the host.
        server.on('clientError', (err, socket) => {
            if (err && err.code !== 'ECONNRESET' && err.message !== 'socket hang up') {
                this.safeWarn(`[dsh-perm-gate] proxy clientError: ${String(err)}`);
            }
            if (!socket.destroyed)
                socket.destroy();
        });
        // ULTIMATE safety net: every accepted socket gets an error handler the
        // moment it connects, before any request/CONNECT parsing. Without this,
        // any socket-level error (ECONNRESET from a client that received a 403
        // block and hung up) becomes an unhandled 'error' event and kills the
        // entire DSH process. A policy proxy must NEVER take down its host.
        server.on('connection', (socket) => {
            socket.on('error', (err) => {
                if (err && err.code !== 'ECONNRESET' && err.message !== 'socket hang up') {
                    this.safeWarn(`[dsh-perm-gate] proxy socket error: ${String(err)}`);
                }
                if (!socket.destroyed)
                    socket.destroy();
            });
            socket.setTimeout(this.options.headersTimeoutMs ?? HEADERS_TIMEOUT_MS, () => {
                socket.destroy();
            });
        });
        this.server = server;
        // Slowloris guard: bound the connection-setup phase. A peer that opens a
        // socket and dribbles headers would otherwise hold a connection forever.
        // CONNECT is emitted as soon as headers parse, so this protects setup
        // without touching the (legitimately long-lived) tunnel phase.
        server.headersTimeout = this.options.headersTimeoutMs ?? HEADERS_TIMEOUT_MS;
        // Bounded concurrency: a policy proxy must not accumulate unbounded
        // sockets. Excess connections are refused by the server rather than
        // growing the tracked set without limit.
        server.maxConnections = this.options.maxConnections ?? MAX_CONNECTIONS;
        try {
            const port = await new Promise((resolve, reject) => {
                const onError = (error) => {
                    server.off('listening', onListening);
                    reject(error);
                };
                const onListening = () => {
                    server.off('error', onError);
                    const address = server.address();
                    resolve(address.port);
                };
                server.once('error', onError);
                server.once('listening', onListening);
                server.listen(this.options.port, this.options.bind);
            });
            this.actualPort = port;
            // close() landed while the bind was in flight: this server is already
            // orphaned, so tear it down here rather than leaving a listening socket
            // (and a rewritten environment) behind.
            if (this.closed) {
                this.actualPort = 0;
                this.server = undefined;
                try {
                    server.close();
                }
                catch { /* never started */ }
                return -1;
            }
            return port;
        }
        catch (error) {
            // T2.9: Bind failure degradation — warn + continue without proxy.
            this.safeWarn(`[dsh-perm-gate] proxy bind failed (port ${this.options.port}): ${String(error)} — continuing without network proxy`);
            this.server = undefined;
            this.actualPort = -1;
            return -1;
        }
    }
    /**
     * Stop the server and destroy every tunnel socket.
     *
     * Safe against a concurrent (in-flight) {@link start}: the `closed` flag
     * makes a bind that resolves after this call tear itself down instead of
     * leaving an orphaned listening server behind.
     */
    async close() {
        this.closed = true;
        // An in-flight bind owns the server handle. Let it settle first: it sees
        // `closed` and tears itself down, so we never race a close against a
        // server that has not finished listening (whose close callback may never
        // fire).
        const pending = this.starting;
        if (pending !== undefined) {
            try {
                await pending;
            }
            catch { /* start() reports -1 on failure */ }
        }
        const server = this.server;
        this.server = undefined;
        for (const socket of this.sockets)
            socket.destroy();
        this.sockets.clear();
        this.actualPort = 0;
        if (server === undefined)
            return;
        await new Promise((resolve) => {
            let settled = false;
            const done = () => { if (!settled) {
                settled = true;
                resolve();
            } };
            try {
                server.close(done);
            }
            catch {
                done();
                return;
            }
            // Bounded: a server that never started listening can leave the close
            // callback pending forever, and close() must always resolve.
            const timer = setTimeout(done, CLOSE_TIMEOUT_MS);
            timer.unref?.();
        });
    }
    // ─── HTTP proxy ──────────────────────────────────────────────────────
    async handleRequest(req, res) {
        // Attach error handlers IMMEDIATELY (before any async work): a client that
        // receives a 403 block closes its socket with RST, and the resulting
        // ECONNRESET on req/res must never reach an unhandled 'error' event.
        const suppressStreamError = (err) => {
            if (err && err.code !== 'ECONNRESET' && err.message !== 'socket hang up') {
                this.safeWarn(`[dsh-perm-gate] proxy stream error: ${String(err)}`);
            }
        };
        req.on('error', suppressStreamError);
        res.on('error', suppressStreamError);
        const target = parseUrlTarget(req.url ?? '');
        if (target === undefined || target.scheme === undefined) {
            res.writeHead(404, { 'content-type': 'text/plain' });
            res.end('[dsh-perm-gate] proxy: only absolute-form proxy requests are served\n');
            return;
        }
        await this.forwardOrBlock(res, target, () => {
            const upstream = new URL(req.url);
            const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
            const proxyReq = send(upstream.href, { method: req.method, headers: req.headers }, (proxyRes) => {
                res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
                proxyRes.pipe(res);
            });
            proxyReq.on('error', (error) => {
                if (!res.headersSent) {
                    res.writeHead(502, { 'content-type': 'text/plain' });
                    res.end(`[network: upstream error] ${String(error)}\n`);
                }
                else {
                    res.destroy();
                }
            });
            // Suppress ECONNRESET from client closing after receiving 403/502.
            req.on('error', (err) => {
                if (err && err.code !== 'ECONNRESET') {
                    this.safeWarn(`[dsh-perm-gate] proxy req error: ${String(err)}`);
                }
            });
            req.pipe(proxyReq);
        });
    }
    // ─── CONNECT tunnel ──────────────────────────────────────────────────
    async handleConnect(req, socket, head) {
        // T2.8/T2.9 safety: attach error handler IMMEDIATELY to prevent unhandled
        // errors from crashing the host process. Client may RST at any point
        // (e.g. after receiving a 403 block), and upstream may fail to connect.
        const tunnel = {};
        const suppressError = (err) => {
            // Suppress ECONNRESET / EPIPE after a 403 block — expected behavior.
            // Only log unexpected errors.
            if (err && err.code !== 'ECONNRESET' && err.message !== 'socket hang up') {
                this.safeWarn(`[dsh-perm-gate] proxy connect error: ${String(err)}`);
            }
        };
        socket.on('error', (err) => {
            suppressError(err);
            tunnel.upstream?.destroy();
        });
        const target = connectTarget(req.url ?? '');
        if (target === undefined) {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            return;
        }
        const decision = await this.resolveDecision(target);
        if (decision.action !== 'allow') {
            this.recordBlock(decision, target);
            const body = blockMessage(decision);
            socket.end(`HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\ncontent-length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
            return;
        }
        const upstream = connect(target.port ?? 443, target.host);
        tunnel.upstream = upstream;
        this.sockets.add(socket);
        this.sockets.add(upstream);
        const cleanup = () => {
            this.sockets.delete(socket);
            this.sockets.delete(upstream);
        };
        socket.on('close', cleanup);
        upstream.on('close', cleanup);
        upstream.on('error', (err) => {
            suppressError(err);
            socket.destroy();
        });
        upstream.once('connect', () => {
            socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head.length > 0)
                upstream.write(head);
            upstream.pipe(socket);
            socket.pipe(upstream);
        });
    }
    // ─── Decision pipeline ───────────────────────────────────────────────
    async forwardOrBlock(res, target, forward) {
        const decision = await this.resolveDecision(target);
        if (decision.action !== 'allow') {
            this.recordBlock(decision, target);
            const body = blockMessage(decision);
            res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body) });
            res.end(body);
            return;
        }
        forward();
    }
    /**
     * DNS-resolve a hostname so `ips`-scoped rules see real addresses, then
     * decide. Resolution failure → decide on the literal name.
     *
     * The lookup is **time-bounded**: an unbounded `lookup()` on a black-holed
     * resolver would hold the CONNECT socket open indefinitely, so a slow
     * resolver degrades to literal-name evaluation instead of hanging the
     * client. `ips`-scoped rules simply cannot fire in that case.
     */
    async decideWithResolution(target) {
        if (!isIpLiteral(target.host)) {
            try {
                const addresses = await withTimeout(lookup(target.host, { all: true, verbatim: true }), this.options.dnsTimeoutMs ?? DNS_TIMEOUT_MS);
                const resolved = addresses.map((entry) => entry.address);
                if (resolved.length > 0) {
                    return await this.options.decide({ ...target, ips: [...target.ips, ...resolved] });
                }
            }
            catch {
                // Unresolvable or too slow: decide on the literal name.
            }
        }
        return await this.options.decide(target);
    }
    /**
     * The final decision for one target: the rule/mode verdict, then — only for
     * an `ask` — the interactive approval seam.
     *
     * Escalation is deliberately narrow:
     * - A `deny` verdict is NEVER escalated. Approving a connection can widen
     *   reach for a target no rule allows, but it can never override a rule that
     *   says no. The rule review stays authoritative.
     * - An escalation that throws, is absent, or returns anything but `allow`
     *   leaves the verdict blocked.
     */
    async resolveDecision(target) {
        const decision = await this.decideWithResolution(target);
        if (decision.action !== 'ask')
            return decision;
        const escalate = this.options.escalate;
        if (escalate === undefined)
            return decision;
        let verdict = 'deny';
        try {
            verdict = await escalate(target, decision);
        }
        catch (error) {
            this.safeWarn(`[dsh-perm-gate] network escalation failed: ${String(error)}`);
            verdict = 'deny';
        }
        if (verdict !== 'allow')
            return decision;
        // Approved: the connection proceeds, and the audit keeps the rule context
        // that produced the ask (`matched` / `ruleIndex` are preserved).
        return { ...decision, action: 'allow' };
    }
    // ─── Block recording ─────────────────────────────────────────────────
    recordBlock(decision, target) {
        const attribution = this.options.attribution?.();
        const record = {
            time: Date.now(),
            tool: attribution?.tool ?? 'subprocess',
            attributed: attribution !== undefined,
            ...(attribution?.callId !== undefined ? { callId: attribution.callId } : {}),
            domain: target.host,
            ...(target.scheme !== undefined ? { scheme: target.scheme } : {}),
            ...(target.port !== undefined ? { port: target.port } : {}),
            action: decision.action === 'ask' ? 'ask' : 'deny',
            mode: decision.mode,
            matched: decision.matched,
            source: decision.source ?? '',
            ...(decision.ruleIndex !== undefined ? { ruleIndex: decision.ruleIndex } : {}),
            ...(decision.rule !== undefined ? { reason: decision.rule.reason } : {}),
        };
        if (record.action === 'deny')
            this.stats.denied += 1;
        else
            this.stats.askBlocked += 1;
        this.recent.unshift(record);
        if (this.recent.length > this.options.maxRecent)
            this.recent.length = this.options.maxRecent;
        this.safeWarn(`[dsh-perm-gate] network ${record.action === 'deny' ? 'denied' : 'ask-blocked'} ${target.scheme ?? '?'}://${target.host}${target.port !== undefined ? `:${target.port}` : ''} (mode ${decision.mode}${decision.matched ? `, rule ${(decision.ruleIndex ?? 0) + 1}` : ', mode default'})`);
        try {
            this.options.onBlock?.(record, attribution);
        }
        catch (error) {
            this.safeWarn(`[dsh-perm-gate] network block hook failed: ${String(error)}`);
        }
    }
}
// ─── Environment injection ─────────────────────────────────────────────────
/**
 * Inject proxy environment variables for subprocesses and return a disposer
 * restoring every previous value exactly.
 *
 * The snapshot pass covers EVERY name BEFORE any write: on Windows
 * `process.env` is case-insensitive, so writing `HTTP_PROXY` mid-loop
 * would poison the later snapshot of `http_proxy`.
 *
 * @param port - the bound proxy port.
 * @param noProxy - `'clear'` empties NO_PROXY so policy cannot be bypassed;
 *                  `'preserve'` keeps ambient values.
 * @returns the restore disposer.
 */
export function injectProxyEnv(port, noProxy) {
    const previous = new Map();
    const value = `http://127.0.0.1:${port}`;
    // Snapshot ALL names before any write.
    for (const name of PROXY_ENV_NAMES)
        previous.set(name, process.env[name]);
    if (noProxy === 'clear') {
        for (const name of NO_PROXY_ENV_NAMES)
            previous.set(name, process.env[name]);
    }
    // Write proxy env.
    for (const name of PROXY_ENV_NAMES)
        process.env[name] = value;
    if (noProxy === 'clear') {
        for (const name of NO_PROXY_ENV_NAMES)
            process.env[name] = '';
    }
    // Return restore disposer.
    return () => {
        for (const name of PROXY_ENV_NAMES) {
            const old = previous.get(name);
            if (old === undefined)
                delete process.env[name];
            else
                process.env[name] = old;
        }
        if (noProxy === 'clear') {
            for (const name of NO_PROXY_ENV_NAMES) {
                const old = previous.get(name);
                if (old === undefined)
                    delete process.env[name];
                else
                    process.env[name] = old;
            }
        }
    };
}
// ─── Helpers ───────────────────────────────────────────────────────────────
/** Parse a CONNECT authority (`host:port`) into an https target. */
function connectTarget(authority) {
    const colon = authority.lastIndexOf(':');
    if (colon <= 0)
        return undefined;
    const host = authority.slice(0, colon).replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, '');
    const port = Number(authority.slice(colon + 1));
    if (host.length === 0 || !Number.isInteger(port) || port < 1 || port > 65535)
        return undefined;
    return { scheme: 'https', host, port, ips: isIpLiteral(host) ? [host] : [] };
}
/** Parse a URL string into a NetworkTarget. */
function parseUrlTarget(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase().replace(/\.+$/, '');
        if (host.length === 0)
            return undefined;
        const port = u.port !== '' ? Number(u.port) : (u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : undefined);
        return {
            host,
            port: port !== undefined && Number.isFinite(port) ? port : undefined,
            scheme: u.protocol.replace(/:$/, ''),
            ips: isIpLiteral(host) ? [host] : [],
        };
    }
    catch {
        return undefined;
    }
}
/**
 * Reject after `ms` if `promise` has not settled. The timer is always
 * cleared, so a resolved lookup leaves nothing behind.
 */
function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`DNS lookup exceeded ${ms}ms`)), ms);
        promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); });
    });
}
