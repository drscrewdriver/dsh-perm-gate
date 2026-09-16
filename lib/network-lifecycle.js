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
import { NetworkProxy, injectProxyEnv } from './proxy.js';
/**
 * Owns the proxy and the environment injection across (re)binds.
 */
export class NetworkLifecycle {
    options;
    proxy;
    envRestore;
    disposed = false;
    /** Serializes mutations so rapid toggles cannot interleave. */
    queue = Promise.resolve();
    constructor(options) {
        this.options = options;
        // Registered ONCE, before any bind: a dispose that races the first bind
        // still tears the proxy down and restores the environment. `effect`
        // expects a factory returning the disposer, so the disposer is returned.
        options.effect(() => () => {
            this.disposed = true;
            void this.run(() => this.detachLocked());
        }, 'dsh-perm-gate: network proxy');
    }
    /** Mount the proxy per the current config. No-op when disabled or live. */
    attach() {
        return this.run(() => this.attachLocked());
    }
    /** Close the proxy and restore the environment. */
    detach() {
        return this.run(() => this.detachLocked());
    }
    /**
     * Re-read the config and re-mount: the old proxy is closed and the old
     * environment restored before the new one is installed. This is what makes
     * the settings-card switches take effect without a plugin reload.
     */
    rebind() {
        return this.run(async () => {
            await this.detachLocked();
            await this.attachLocked();
        });
    }
    /** The diagnostics snapshot (safe to call at any time). */
    snapshot() {
        const cfg = this.options.readConfig();
        const proxy = this.proxy;
        const stats = proxy?.blockStats() ?? { denied: 0, askBlocked: 0 };
        const port = proxy?.port ?? 0;
        return {
            enabled: cfg.enabled,
            mode: cfg.mode,
            bind: cfg.bind,
            port,
            proxyActive: proxy !== undefined && port > 0,
            envInjected: this.envRestore !== undefined,
            denied: stats.denied,
            askBlocked: stats.askBlocked,
            recent: proxy?.recentBlocks() ?? [],
        };
    }
    // ─── Internals (always called through the queue) ─────────────────────
    run(work) {
        const next = this.queue.then(() => work());
        // Keep the chain alive through a rejected step; the step itself is
        // responsible for degrading rather than throwing.
        this.queue = next.then(() => undefined, () => undefined);
        return next;
    }
    async attachLocked() {
        if (this.disposed)
            return;
        const cfg = this.options.readConfig();
        if (!cfg.enabled)
            return;
        // Already live: leave it alone (a rebind detaches first).
        if (this.proxy !== undefined && this.proxy.port > 0)
            return;
        // A previous attempt may have left a proxy that failed to bind; drop it
        // so the retry starts clean.
        await this.closeProxyLocked();
        this.restoreEnvLocked();
        const proxy = new NetworkProxy({
            bind: cfg.bind,
            port: cfg.port,
            maxRecent: 100,
            decide: this.options.decide,
            ...(this.options.escalate !== undefined ? { escalate: this.options.escalate } : {}),
            attribution: this.options.attribution,
            ...(this.options.onBlock !== undefined ? { onBlock: this.options.onBlock } : {}),
            logger: this.options.logger,
        });
        this.proxy = proxy;
        const port = await proxy.start();
        // A dispose landed while binding: the effect already ran detach, but the
        // proxy was created after it, so close it here.
        if (this.disposed) {
            await this.closeProxyLocked();
            return;
        }
        if (port <= 0) {
            // Bind failed (already logged by the proxy). Keep the handle so the
            // snapshot can report `proxyActive: false`.
            return;
        }
        if (cfg.injectEnv) {
            try {
                this.envRestore = injectProxyEnv(port, cfg.noProxy);
            }
            catch (error) {
                this.safeWarn(`[dsh-perm-gate] proxy env injection failed: ${String(error)} — the proxy is live but subprocesses are not routed through it`);
            }
        }
        this.safeInfo(`[dsh-perm-gate] network proxy listening on ${cfg.bind}:${port} (mode ${cfg.mode}${cfg.injectEnv ? ', env injected' : ', env not injected'})`);
    }
    async detachLocked() {
        this.restoreEnvLocked();
        await this.closeProxyLocked();
    }
    async closeProxyLocked() {
        const proxy = this.proxy;
        this.proxy = undefined;
        if (proxy === undefined)
            return;
        try {
            await proxy.close();
        }
        catch (error) {
            this.safeWarn(`[dsh-perm-gate] proxy close failed: ${String(error)}`);
        }
    }
    restoreEnvLocked() {
        const restore = this.envRestore;
        this.envRestore = undefined;
        if (restore === undefined)
            return;
        try {
            restore();
        }
        catch (error) {
            this.safeWarn(`[dsh-perm-gate] proxy env restore failed: ${String(error)}`);
        }
    }
    safeWarn(message) {
        try {
            this.options.logger.warn(message);
        }
        catch { /* never escalate */ }
    }
    safeInfo(message) {
        const info = this.options.logger.info;
        if (info === undefined)
            return;
        try {
            info.call(this.options.logger, message);
        }
        catch { /* never escalate */ }
    }
}
