/**
 * Network proxy lifecycle for dsh-perm-gate.
 *
 * Owns the proxy + the subprocess environment injection and exposes the
 * three operations the host needs:
 *
 *   attach()   — mount per the current config (called once at apply)
 *   rebind()   — re-read the config and re-mount (called on a settings change)
 *   detach()   — close the proxy and restore the environment
 *
 * Keeping this out of `index.ts` matters: the proxy has a real lifecycle
 * (bind, env rewrite, teardown) and every step must be owned by exactly one
 * disposer. `index.ts` only wires it.
 *
 * Robustness contract:
 * - One persistent teardown effect is registered at construction, so a
 *   dispose that races an in-flight bind still closes the proxy and restores
 *   the environment.
 * - Mutating operations are serialized: rapid settings toggles cannot
 *   interleave attach/detach and leave an orphaned listener or a rewritten
 *   `process.env`.
 * - Nothing here throws into the host: failures degrade to "no proxy" and
 *   surface through the optional logger.
 */
import { type NetworkBlockRecord, type ProxyAttribution } from './proxy.js';
import type { NetworkDecision, NetworkMode, NetworkTarget, UnattributedAction, UnlistedAction } from './network.js';
/** The live network configuration (read fresh on every operation). */
export interface NetworkConfigSnapshot {
    readonly enabled: boolean;
    readonly mode: NetworkMode;
    readonly unlisted: UnlistedAction;
    /** Handling for traffic with no shell attribution. Default `'allow'`. */
    readonly unattributed: UnattributedAction;
    readonly loopback: 'allow' | 'policy';
    readonly bind: string;
    readonly port: number;
    readonly noProxy: 'clear' | 'preserve';
    /** Rewrite `HTTP(S)_PROXY`/`ALL_PROXY` for subprocesses. Default true. */
    readonly injectEnv: boolean;
    /** How long an unlisted-target approval may wait for a human (ms). */
    readonly askTimeoutMs: number;
}
/** The network state the settings page and HTTP route render. */
export interface NetworkSnapshot {
    readonly enabled: boolean;
    readonly mode: NetworkMode;
    readonly bind: string;
    readonly port: number;
    readonly proxyActive: boolean;
    readonly envInjected: boolean;
    readonly denied: number;
    readonly askBlocked: number;
    readonly recent: readonly NetworkBlockRecord[];
}
export interface NetworkLifecycleOptions {
    /** Register one disposer factory with the host plugin context. The factory
     *  is invoked at dispose time; it must RETURN the teardown function. */
    readonly effect: (disposeFactory: () => () => void, label: string) => void;
    /** Read the live network config (settings-aware). */
    readonly readConfig: () => NetworkConfigSnapshot;
    /** The decision function (reads the live ruleset). */
    readonly decide: (target: NetworkTarget) => NetworkDecision | Promise<NetworkDecision>;
    /**
     * Escalate an `ask` verdict to the interactive approval seam. Never called
     * for a `deny` — the rule review stays authoritative.
     */
    readonly escalate?: (target: NetworkTarget, decision: NetworkDecision) => Promise<'allow' | 'deny'>;
    /** Attribution for block records. */
    readonly attribution: () => ProxyAttribution | undefined;
    /** Extra block observer (audit/event feed). */
    readonly onBlock?: (record: NetworkBlockRecord, attribution: ProxyAttribution | undefined) => void;
    readonly logger: {
        warn(message: string): void;
        info?(message: string): void;
    };
}
/**
 * Owns the proxy and the environment injection across (re)binds.
 */
export declare class NetworkLifecycle {
    private readonly options;
    private proxy;
    private envRestore;
    private disposed;
    /** Serializes mutations so rapid toggles cannot interleave. */
    private queue;
    constructor(options: NetworkLifecycleOptions);
    /** Mount the proxy per the current config. No-op when disabled or live. */
    attach(): Promise<void>;
    /** Close the proxy and restore the environment. */
    detach(): Promise<void>;
    /**
     * Re-read the config and re-mount: the old proxy is closed and the old
     * environment restored before the new one is installed. This is what makes
     * the settings-card switches take effect without a plugin reload.
     */
    rebind(): Promise<void>;
    /** The diagnostics snapshot (safe to call at any time). */
    snapshot(): NetworkSnapshot;
    private run;
    private attachLocked;
    private detachLocked;
    private closeProxyLocked;
    private restoreEnvLocked;
    private safeWarn;
    private safeInfo;
}
