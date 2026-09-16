export interface WatcherOptions {
    /** Debounce interval in ms. Default 300. */
    readonly debounceMs?: number;
    /** Maximum number of workspace watchers to keep. Default 10. */
    readonly maxWatchers?: number;
    /** Logger sink. */
    readonly logger: {
        warn(message: string): void;
    };
}
/**
 * Manages file watchers for rule files across workspaces.
 * Each workspace gets its own watcher set; LRU eviction caps total count.
 */
export declare class RuleWatcher {
    private readonly watchers;
    private readonly debounceMs;
    private readonly maxWatchers;
    private readonly logger;
    constructor(options?: WatcherOptions);
    /**
     * Start watching rule files for a workspace.
     *
     * @param cwd - The workspace root.
     * @param ruleFiles - Absolute paths to the effective rule files (chain).
     * @param reload - Callback to invoke (debounced) on any change.
     */
    watch(cwd: string, ruleFiles: readonly string[], reload: () => void): void;
    /**
     * Stop watching a specific workspace.
     */
    unwatch(cwd: string): void;
    /**
     * Stop all watchers and clear state.
     */
    closeAll(): void;
    /** Number of active workspace watchers. */
    activeWatcherCount(): number;
    /** Number of pending (debounced) reloads. */
    pendingReloadCount(): number;
    private evictIfNeeded;
}
