/** Session ids grouped by their lifecycle class, all prefix-stripped (see {@link normalizeSessionId}). */
export interface SessionClassification {
    /** Sessions referenced by some workspace's `sessionIds`. */
    readonly live: ReadonlySet<string>;
    /** Sessions listed in the store's `global.archivedSessionIds`. */
    readonly archived: ReadonlySet<string>;
}
/** A session id whose gate data is stale and can be swept. */
export interface SweepReport {
    /** Decision-event lines removed from events.jsonl. */
    readonly eventsRemoved: number;
    /** Snapshot files deleted from the snapshots directory. */
    readonly snapshotsRemoved: number;
}
/** Strip the `session-` prefix so ids from different sources compare equal. */
export declare function normalizeSessionId(id: unknown): string;
/**
 * Classify sessions from the raw text of the workspace store. Returns `null`
 * on unparsable or structurally unexpected content (torn write, format bump) —
 * the caller skips the round. Missing `global`/`tables` sections degrade to
 * empty sets rather than failing: a fresh install has neither.
 */
export declare function classifySessions(raw: string): SessionClassification | null;
/**
 * Whether a gate-side session id belongs to an archived or deleted session.
 * An empty id (unattributable legacy row) never matches — the same semantics
 * `snapshotMatchesSession` uses for snapshots, so unattributable data is kept.
 */
export declare function isStaleSession(id: string, cls: SessionClassification): boolean;
/** Options for {@link sweepSessionData}; all paths are plugin-owned except the store. */
export interface SweepOptions {
    readonly classification: SessionClassification;
    /** The decision-event JSONL feed (plugin data dir). */
    readonly eventsFile: string;
    /** The per-event pre-change snapshot directory (plugin data dir). */
    readonly snapshotsDir: string;
}
/**
 * Drop archived/dead sessions' rows from `events.jsonl` (atomic tmp+rename
 * rewrite, only when something is actually removed) and delete their snapshot
 * files. Both halves are independent: a failure in one still lets the other
 * run. I/O errors are swallowed with a warn — best-effort cleanup, never a
 * gating concern.
 */
export declare function sweepSessionData(opts: SweepOptions): SweepReport;
