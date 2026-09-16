/** One gate decision event. `kind` drives the client notice strip styling. */
export interface GateEvent {
    /** Monotonic id (resumed from the file across restarts). */
    readonly id: number;
    readonly ts: string;
    readonly sessionId: string;
    readonly tool: string;
    /**
     * auto = allowed (rule/grant/llm), ask = routed to the human, deny = vetoed,
     * learned = confirmation settled, manual-* = the human's terminal answer to an
     * ask (approved / rejected / cancelled).
     */
    readonly kind: 'auto' | 'ask' | 'deny' | 'learned' | 'manual-approved' | 'manual-rejected' | 'manual-cancelled';
    /** Risk category when an LLM verdict contributed to the decision. */
    readonly risk?: string;
    /** Truncated decision reason. */
    readonly reason: string;
    /** Decision path label (rule / grant / learned / llm-assist …) — the history tag. */
    readonly verdict?: string;
    /** The model's stated intent (justification) when one was available. */
    readonly justification?: string;
    /** Sandbox mode involved in the decision, when known. */
    readonly mode?: string;
    /** Risk category name (deletion / credential / neutral …) when classified. */
    readonly category?: string;
    /** Files the decision concerns (absolute, workspace-relative, or bare names). */
    readonly files?: readonly string[];
    /** Human confirmations so far for the learned key (manual-approve events). */
    readonly learningCount?: number;
    /** Confirmations required before that key auto-allows (manual-approve events). */
    readonly threshold?: number;
}
export interface GateEventInput {
    readonly sessionId?: string;
    readonly tool: string;
    readonly kind: GateEvent['kind'];
    readonly risk?: string;
    readonly reason: string;
    readonly verdict?: string;
    readonly justification?: string;
    readonly mode?: string;
    readonly category?: string;
    readonly files?: readonly string[];
    readonly learningCount?: number;
    readonly threshold?: number;
    /** Session working directory, used to resolve relative snapshot paths. */
    readonly baseDir?: string;
}
/** Read one file as snapshot text; null when unreadable, binary, or oversized. */
export declare function readSnapshotFile(absPath: string): string | null;
/**
 * Resolve a path from a decision into an absolute path: `~` expands to home,
 * absolute paths pass through, relative paths try the session cwd, the process
 * cwd, then home (first existing wins; otherwise the first candidate).
 */
export declare function resolveAbsPath(p: string, baseDir?: string): string;
export interface EventSnapshot {
    readonly path: string;
    readonly content: string;
    readonly ts: string;
}
/** Write the pre-change snapshot of every file one event touched. */
export declare function saveEventSnapshots(dir: string, eventId: number, files: readonly string[], baseDir: string | undefined, sessionId: string, now?: () => number): void;
/** Load one event's snapshots ([] when absent or corrupt). */
export declare function loadEventSnapshots(dir: string, eventId: number): EventSnapshot[];
export interface DiffLine {
    readonly type: 'same' | 'add' | 'del';
    readonly aNo?: number;
    readonly bNo?: number;
    readonly text: string;
}
export interface DiffHunk {
    readonly hiddenBefore: number;
    readonly lines: readonly DiffLine[];
}
export interface DiffStats {
    readonly added: number;
    readonly removed: number;
    readonly contextLines: number;
}
export interface DiffResult {
    readonly hunks: readonly DiffHunk[];
    readonly stats: DiffStats;
    readonly changedLines: readonly DiffLine[];
}
/**
 * Line-level diff with context: a greedy in-order LCS approximation (each `a`
 * line matches the next unused equal `b` line), then change windows of ±`CTX`
 * context lines clustered into hunks. Ported from dsh-approval-gate so both
 * review pages render identical diffs.
 */
export declare function diffLines(before: string | null | undefined, after: string | null | undefined, contextLines?: number): DiffResult;
export declare class EventLog {
    /** JSONL path; `undefined` disables event recording entirely. */
    private readonly filePath;
    private readonly now;
    /** Snapshot directory; `undefined` disables diff/revert support. */
    private readonly snapshotsDir;
    private seq;
    constructor(
    /** JSONL path; `undefined` disables event recording entirely. */
    filePath: string | undefined, now?: () => number, 
    /** Snapshot directory; `undefined` disables diff/revert support. */
    snapshotsDir?: string | undefined);
    /** Append one event; returns it, or undefined when recording is disabled/failed. */
    append(input: GateEventInput): GateEvent | undefined;
    /** Events with `id > since`, optionally filtered to one session. */
    query({ sessionId, since }?: {
        sessionId?: string;
        since?: number;
    }): GateEvent[];
    /** One event by id (undefined when absent). */
    byId(id: number): GateEvent | undefined;
    private nextId;
}
/**
 * The minimal face of the DSH `webServer` service this plugin uses
 * (typed locally — never value-imported; provided by the dsh runtime).
 */
export interface WebServerLike {
    register(route: {
        kind: 'exact';
        path: string;
        handler: (req: unknown, res: unknown) => unknown;
    }): () => void;
}
export declare const EVENTS_ROUTE = "/api/dsh-perm-gate/events";
export declare const LEARNING_ROUTE = "/api/dsh-perm-gate/learning";
export declare const HEALTH_ROUTE = "/api/dsh-perm-gate/health";
export declare const NETWORK_ROUTE = "/api/dsh-perm-gate/network";
export declare const RECEIVER_ROUTE = "/api/dsh-perm-gate/receiver";
export declare const DIFF_ROUTE = "/api/dsh-perm-gate/diff";
export declare const REVERT_ROUTE = "/api/dsh-perm-gate/revert";
export declare const SNAPSHOTS_STATS_ROUTE = "/api/dsh-perm-gate/snapshots-stats";
export declare const SNAPSHOTS_CLEAR_ROUTE = "/api/dsh-perm-gate/snapshots-clear";
/**
 * Register `GET /api/dsh-perm-gate/events?sessionId=&since=` on the webServer
 * service. Returns whether the route was registered (false when the service is
 * unavailable — the host keeps running, only the HTTP API is missing).
 */
export declare function registerEventsRoute(server: unknown, log: EventLog): (() => void) | undefined;
/** Delivers a revert instruction into the conversation (see index.ts wiring). */
export type SessionSender = (sessionId: string, content: string) => Promise<{
    ok: boolean;
    via?: string;
    error?: string;
}>;
/**
 * Register the review-page routes:
 * `GET  /diff?eventId=&path=`        → before/after line diff for one file
 * `POST /revert`                     → deliver a revert instruction into the session
 * `GET  /snapshots-stats?sessionId=` → snapshot count/bytes/ids/file map
 * `POST /snapshots-clear`            → drop snapshots (session-scoped or all)
 */
export declare function registerReviewRoutes(server: unknown, deps: {
    log: EventLog;
    snapshotsDir: string | undefined;
    send: SessionSender;
    audit?: (line: string) => void;
}): (() => void)[];
/**
 * Register `GET /api/dsh-perm-gate/receiver` — the receiver projection for the
 * settings card: the effective provider/model plus (host mode) the live
 * provider/model-group catalog from the DSH `llm` service.
 */
export declare function registerReceiverRoute(server: unknown, provider: {
    info(): Promise<unknown>;
}): (() => void) | undefined;
/**
 * Register `POST /api/dsh-perm-gate/health` — runs one minimal completion
 * through the currently configured llmAssist receiver and returns
 * `{ ok, ms, detail }` (the settings card's health test).
 */
export declare function registerHealthRoute(server: unknown, provider: {
    check(): Promise<{
        ok: boolean;
        ms: number;
        detail: string;
    }>;
}): (() => void) | undefined;
/** The network-state face the settings UI's network section needs. */
export interface NetworkRouteProvider {
    snapshot(): unknown;
}
/**
 * Register the network diagnostics route: `GET /api/dsh-perm-gate/network`
 * returns the live network state (mode, bind, port, proxy liveness, env
 * injection, block counters, recent blocks). Read-only — a policy change goes
 * through the settings namespace, never through HTTP.
 * Returns whether the route was registered.
 */
export declare function registerNetworkRoute(server: unknown, provider: NetworkRouteProvider): (() => void) | undefined;
/** The learning-store face the settings UI's sediment view needs. */
export interface LearningRouteProvider {
    snapshot(): unknown;
    threshold(): number;
    reset(key: string, fp?: string): void;
}
/**
 * Register the learning-store routes on the webServer service:
 * `GET  /api/dsh-perm-gate/learning` → the store snapshot + live threshold,
 * `POST /api/dsh-perm-gate/learning` → `{ key, fp? }` terminates one key's
 * learning or drops one sedimented sample. Returns whether registered.
 */
export declare function registerLearningRoute(server: unknown, provider: LearningRouteProvider): (() => void) | undefined;
