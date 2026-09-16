import type { NetworkDecision, NetworkMode, NetworkTarget } from './network.js';
/** Proxy env var names the injector sets/restores (upper + lower for mixed-ecosystem CLIs). */
export declare const PROXY_ENV_NAMES: readonly string[];
/** NO_PROXY env var names cleared by the injector. */
export declare const NO_PROXY_ENV_NAMES: readonly string[];
/** Default DNS lookup bound (ms). A black-holed resolver must not hang a CONNECT. */
export declare const DNS_TIMEOUT_MS = 3000;
/** Default connection-setup bound (ms) — slowloris guard. */
export declare const HEADERS_TIMEOUT_MS = 60000;
/** Default cap on concurrent accepted connections. */
export declare const MAX_CONNECTIONS = 256;
/** Bound on how long close() waits for a server to finish closing (ms). */
export declare const CLOSE_TIMEOUT_MS = 2000;
/** One recorded proxy-layer block. */
export interface NetworkBlockRecord {
    readonly time: number;
    readonly tool: string;
    readonly attributed: boolean;
    readonly callId?: string;
    readonly domain: string;
    readonly scheme?: string;
    readonly port?: number;
    readonly action: 'deny' | 'ask';
    readonly mode: NetworkMode;
    readonly matched: boolean;
    readonly source: string;
    readonly ruleIndex?: number;
    readonly reason?: string;
}
/** Cumulative proxy-layer block counters. */
export interface NetworkStats {
    denied: number;
    askBlocked: number;
}
/** Attribution the runtime supplies for one connection. */
export interface ProxyAttribution {
    readonly tool: string;
    readonly callId?: string;
}
/** Construction options for NetworkProxy. */
export interface NetworkProxyOptions {
    /** Bind address (loopback by config). */
    readonly bind: string;
    /** Requested port; `0` binds an ephemeral port. */
    readonly port: number;
    /** Cap on recent-block records kept in memory. */
    readonly maxRecent: number;
    /** Decision function supplied by the runtime. */
    readonly decide: (target: NetworkTarget) => NetworkDecision | Promise<NetworkDecision>;
    /**
     * Escalate an `ask` decision to the interactive approval seam. Called ONLY
     * when {@link decide} returns `ask` — a `deny` is never escalated, so the
     * rule review cannot be bypassed by approving a connection.
     *
     * Absent, throwing, or timing out all mean "not allowed": the connection is
     * blocked exactly as it would have been.
     */
    readonly escalate?: (target: NetworkTarget, decision: NetworkDecision) => Promise<'allow' | 'deny'>;
    /** Current attribution (newest in-flight shell execution). */
    readonly attribution?: () => ProxyAttribution | undefined;
    /** Called for every blocked connection. */
    readonly onBlock?: (record: NetworkBlockRecord, attribution: ProxyAttribution | undefined) => void;
    /** Bind a DNS lookup with this timeout (ms). Default {@link DNS_TIMEOUT_MS}. */
    readonly dnsTimeoutMs?: number;
    /** Connection-setup bound (ms). Default {@link HEADERS_TIMEOUT_MS}. */
    readonly headersTimeoutMs?: number;
    /** Cap on concurrent connections. Default {@link MAX_CONNECTIONS}. */
    readonly maxConnections?: number;
    /** Logger sink (proxy failures must never crash the host). */
    readonly logger: {
        warn(message: string): void;
    };
}
/**
 * The local HTTP/CONNECT policy proxy. Binds on demand; every live tunnel
 * socket is tracked and destroyed on close so updates and uninstalls leave
 * no orphaned connections.
 */
export declare class NetworkProxy {
    private readonly options;
    private server;
    private readonly sockets;
    private readonly recent;
    private readonly stats;
    private actualPort;
    /** In-flight start(); guards against a second concurrent bind. */
    private starting;
    /** Set by close(); a bind resolving afterwards tears itself down. */
    private closed;
    constructor(options: NetworkProxyOptions);
    /**
     * Logger sink that can never throw. The logger is called from inside
     * 'error' handlers, so a throwing logger would itself become an
     * unhandled error and defeat the whole point of the guard.
     */
    private safeWarn;
    /** The bound port (valid after start resolves). */
    get port(): number;
    /** Deny/ask blocks recorded since mount, newest first. */
    recentBlocks(): readonly NetworkBlockRecord[];
    /** Cumulative block counters. */
    blockStats(): NetworkStats;
    /** Number of active sockets (tunnels + client connections). */
    activeSocketCount(): number;
    /**
     * Bind the server and return the actual port.
     * On bind failure: warns and returns -1 (degraded mode — no proxy).
     * Concurrent calls share the single in-flight bind.
     */
    start(): Promise<number>;
    private bind;
    /**
     * Stop the server and destroy every tunnel socket.
     *
     * Safe against a concurrent (in-flight) {@link start}: the `closed` flag
     * makes a bind that resolves after this call tear itself down instead of
     * leaving an orphaned listening server behind.
     */
    close(): Promise<void>;
    private handleRequest;
    private handleConnect;
    private forwardOrBlock;
    /**
     * DNS-resolve a hostname so `ips`-scoped rules see real addresses, then
     * decide. Resolution failure → decide on the literal name.
     *
     * The lookup is **time-bounded**: an unbounded `lookup()` on a black-holed
     * resolver would hold the CONNECT socket open indefinitely, so a slow
     * resolver degrades to literal-name evaluation instead of hanging the
     * client. `ips`-scoped rules simply cannot fire in that case.
     */
    private decideWithResolution;
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
    private resolveDecision;
    private recordBlock;
}
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
export declare function injectProxyEnv(port: number, noProxy: 'clear' | 'preserve'): () => void;
