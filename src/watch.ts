/**
 * File watching for dsh-perm-gate rule hot-reload.
 *
 * Watches the effective rules files (the chain resolved for each workspace)
 * and triggers a debounced `runtime.reload()` when any file changes. Also
 * monitors candidate files (expected-but-absent files) through their deepest
 * existing ancestor directory, so mid-session file creation is adopted.
 *
 * Design:
 * - Chokidar for cross-platform reliability (PerryLink-validated).
 * - Debounce window: multiple rapid writes within `debounceMs` merge into
 *   one reload.
 * - Chain-level: any file change triggers a full chain recompilation.
 * - LRU eviction: workspace watchers are capped; least-recently-used are
 *   closed when the cap is exceeded.
 * - All registrations go through `ctx.effect()` for clean teardown.
 */
import { watch as chokidarWatch, type FSWatcher } from 'chokidar'
import { dirname, resolve } from 'node:path'
import { existsSync, statSync } from 'node:fs'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WatcherOptions {
  /** Debounce interval in ms. Default 300. */
  readonly debounceMs?: number
  /** Maximum number of workspace watchers to keep. Default 10. */
  readonly maxWatchers?: number
  /** Logger sink. */
  readonly logger: { warn(message: string): void }
}

/** One workspace's watcher state. */
interface WorkspaceWatcher {
  /** The resolved cwd this watcher serves. */
  readonly cwd: string
  /** The chokidar watcher instance. */
  readonly watcher: FSWatcher
  /** Debounce timer id. */
  timer: ReturnType<typeof setTimeout> | null
  /** Last access timestamp (for LRU eviction). */
  lastAccess: number
}

// ─── RuleWatcher ───────────────────────────────────────────────────────────

/**
 * Manages file watchers for rule files across workspaces.
 * Each workspace gets its own watcher set; LRU eviction caps total count.
 */
export class RuleWatcher {
  private readonly watchers = new Map<string, WorkspaceWatcher>()
  private readonly debounceMs: number
  private readonly maxWatchers: number
  private readonly logger: { warn(message: string): void }

  constructor(options: WatcherOptions = { logger: console }) {
    this.debounceMs = options.debounceMs ?? 300
    this.maxWatchers = options.maxWatchers ?? 10
    this.logger = options.logger
  }

  /**
   * Start watching rule files for a workspace.
   *
   * @param cwd - The workspace root.
   * @param ruleFiles - Absolute paths to the effective rule files (chain).
   * @param reload - Callback to invoke (debounced) on any change.
   */
  watch(cwd: string, ruleFiles: readonly string[], reload: () => void): void {
    const key = resolve(cwd).toLowerCase()

    // If already watching this workspace, just update the access time.
    const existing = this.watchers.get(key)
    if (existing !== undefined) {
      existing.lastAccess = Date.now()
      return
    }

    // Evict LRU if at capacity.
    this.evictIfNeeded()

    // Collect all paths to watch: effective files + candidate file ancestors.
    const paths = new Set<string>()
    for (const file of ruleFiles) {
      paths.add(file)
      // T3.3: Watch deepest existing ancestor for candidate files.
      const ancestor = deepestExistingAncestor(file)
      if (ancestor !== undefined) paths.add(ancestor)
    }

    const watcher = chokidarWatch([...paths], {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    })

    let timer: ReturnType<typeof setTimeout> | null = null
    const debouncedReload = (): void => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        try {
          reload()
        } catch (error) {
          this.logger.warn(`[dsh-perm-gate] rule reload failed: ${String(error)}`)
        }
      }, this.debounceMs)
    }

    watcher.on('change', debouncedReload)
    watcher.on('add', debouncedReload)
    watcher.on('unlink', debouncedReload)
    watcher.on('error', (error: unknown) => {
      this.logger.warn(`[dsh-perm-gate] watcher error: ${String(error)}`)
    })

    const entry: WorkspaceWatcher = { cwd, watcher, timer, lastAccess: Date.now() }
    this.watchers.set(key, entry)
  }

  /**
   * Stop watching a specific workspace.
   */
  unwatch(cwd: string): void {
    const key = resolve(cwd).toLowerCase()
    const entry = this.watchers.get(key)
    if (entry === undefined) return
    if (entry.timer !== null) clearTimeout(entry.timer)
    void entry.watcher.close()
    this.watchers.delete(key)
  }

  /**
   * Stop all watchers and clear state.
   */
  closeAll(): void {
    for (const entry of this.watchers.values()) {
      if (entry.timer !== null) clearTimeout(entry.timer)
      void entry.watcher.close()
    }
    this.watchers.clear()
  }

  /** Number of active workspace watchers. */
  activeWatcherCount(): number {
    return this.watchers.size
  }

  /** Number of pending (debounced) reloads. */
  pendingReloadCount(): number {
    let count = 0
    for (const entry of this.watchers.values()) {
      if (entry.timer !== null) count++
    }
    return count
  }

  // ─── LRU eviction ──────────────────────────────────────────────────

  private evictIfNeeded(): void {
    if (this.watchers.size < this.maxWatchers) return
    // Find the least-recently-used entry.
    let oldestKey: string | undefined
    let oldestTime = Infinity
    for (const [key, entry] of this.watchers) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestKey = key
      }
    }
    if (oldestKey !== undefined) {
      this.unwatch(oldestKey)
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Find the deepest existing ancestor directory of a file path.
 * Used to watch for candidate files (expected-but-absent) through their
 * closest existing parent.
 */
function deepestExistingAncestor(filePath: string): string | undefined {
  let dir = dirname(resolve(filePath))
  let prev = ''
  while (dir !== prev) {
    if (existsSafe(dir)) return dir
    prev = dir
    dir = dirname(dir)
  }
  return undefined
}

function existsSafe(path: string): boolean {
  try {
    const stat = statSync(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}
