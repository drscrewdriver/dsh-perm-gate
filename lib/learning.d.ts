/** One confirmed operation sample: fingerprint plus a short human-readable context. */
export interface LearningSample {
    readonly fp: string;
    readonly ctx: string;
    readonly at: number;
}
/** The persisted document shape (version 1). */
export interface LearningDoc {
    version: 1;
    /** key (`tool|category`) → human confirmation count. */
    confirmed: Record<string, number>;
    /** key → the most recent confirmed samples (bounded). */
    samples: Record<string, LearningSample[]>;
}
/** One sedimented rule view: a threshold-reached key's confirmed sample. */
export interface SedimentEntry {
    /** The stored key, namespace included. */
    readonly key: string;
    readonly fp: string;
    readonly ctx: string;
    readonly at: number;
    /** Which namespace the rule lives in. */
    readonly scope: LearningScope;
    /** The session that farmed it, for a `session` entry. */
    readonly sessionId?: string;
    /**
     * In `session` scope a `global|` rule is NOT in force (that is the whole
     * point of isolation). It is reported here with `promoted: false` so the
     * settings face can offer the explicit promotion instead of silently
     * dropping a rule the user once confirmed.
     */
    readonly promoted: boolean;
}
/** Which namespace a confirmation lands in. */
export type LearningScope = 'global' | 'session';
/**
 * The namespaced key shapes. The single-file store never mattered as much as
 * the KEY SPACE did: every session wrote the same `tool|fp` key, so a session
 * that confirmed an operation twice lowered the bar for every other session -
 * a rule could be "farmed" into existence for sessions that never saw it.
 *
 * The fix is key-level, not file-level: the file stays one `version: 1` doc and
 * needs no migration, because a key with no prefix is read as `global|`
 * (see {@link normalizeKey}). `global|` keeps today's meaning and stays the
 * default; `session:<id>|` is the isolated form.
 */
export declare const GLOBAL_PREFIX = "global|";
export declare const SESSION_PREFIX = "session:";
/** Prefix a bare `tool|fp` key with the global namespace (idempotent). */
export declare function normalizeKey(key: string): string;
/** Build the session-scoped key for one call. */
export declare function sessionKey(sessionId: string, key: string): string;
/** Split a stored key back into its namespace and the bare `tool|fp` part. */
export declare function parseKey(key: string): {
    scope: LearningScope;
    sessionId?: string;
    bare: string;
};
export interface RiskLearningOptions {
    /** Confirmations required before an exact-sample re-run may auto-allow. A getter reads the live setting. Default 3. */
    readonly threshold?: number | (() => number);
    /**
     * Where confirmations land. `global` (default) keeps the historical
     * cross-session behaviour; `session` isolates every session and stops a
     * `global|` entry from auto-allowing anything until it is promoted on
     * purpose. A getter keeps the setting hot, like `threshold`.
     */
    readonly scope?: LearningScope | (() => LearningScope);
    /** The session the caller acts for (required for `session` scope to do anything). */
    readonly sessionId?: string | (() => string | undefined);
    /** Samples retained per key (oldest evicted). Default 10. */
    readonly maxSamples?: number;
    readonly now?: () => number;
}
/**
 * Derive a stable, precise operation fingerprint from structured arguments:
 * shell calls → `word|target-basename`; file-arg tools → the target basename;
 * everything else → the tool name alone. Two calls share a fingerprint only
 * when they perform the same kind of write against the same-named target.
 */
export declare function operationFingerprint(tool: string, args: Record<string, unknown>, commandText?: string): string;
/** The learning key for one call: `tool|fingerprint` (fingerprint-level learning). */
export declare function learnKey(tool: string, _category: string, fp?: string): string;
export declare class RiskLearning {
    /** Persistence path; `undefined` keeps state in memory only. */
    private readonly filePath;
    private readonly options;
    private doc;
    private loaded;
    constructor(
    /** Persistence path; `undefined` keeps state in memory only. */
    filePath: string | undefined, options?: RiskLearningOptions);
    private get threshold();
    /** The scope in force right now (a getter keeps the setting hot). */
    get scope(): LearningScope;
    /** The session this instance acts for, if it knows one. */
    get sessionId(): string | undefined;
    /**
     * The key a confirmation is WRITTEN to under the current scope. With no
     * session id the scoped form is impossible, so it stays global — writing a
     * `session:|…` key with an empty id would create a shared bucket that looks
     * isolated, which is worse than the global default.
     */
    private writeKey;
    /**
     * The keys a decision READS. In `session` scope the session's own namespace
     * is the only one consulted: a `global|` entry that some other session
     * farmed must not auto-allow here. In `global` scope the historical
     * behaviour is preserved (global first, then this session's own entries).
     */
    private readKeys;
    private load;
    private persist;
    /** Human confirmations recorded so far for one key (scope-aware). */
    count(key: string): number;
    /** Whether one key already holds a confirmed sample with this fingerprint. */
    hasSample(key: string, fp: string): boolean;
    /**
     * The learning gate: auto-allow only when the key reached the threshold AND
     * this exact fingerprint was among the human-confirmed samples.
     */
    shouldAutoAllow(key: string, fp: string): boolean;
    /** Record one human confirmation: bump the count and store the sample (bounded). */
    confirm(key: string, fp: string, ctx: string): void;
    /** Drop all learning state (counts and samples) and persist the empty doc. */
    reset(): void;
    /**
     * The sedimented-rule view: every confirmed sample of a key whose count
     * reached the threshold. These are the deterministic auto-allow rules —
     * derived from the store, so no extra persistence is needed.
     */
    sedimented(): SedimentEntry[];
    /**
     * Promote one session-scoped rule into the global namespace. Explicit only:
     * promotion is a human decision, and doing it automatically is exactly the
     * "farm a rule across sessions" behaviour this store was fixed to stop.
     * The original entry is kept, so the session keeps its own record.
     */
    promoteToGlobal(key: string, fp: string): void;
    /** Session-scoped rules that are waiting for an explicit promotion. */
    pendingPromotions(): SedimentEntry[];
    /** Remove one sedimented sample (its fingerprint no longer auto-allows). */
    dropSample(key: string, fp: string): void;
    /** Terminate learning for one key: drop its confirmation count and samples. */
    resetKey(key: string): void;
    /** Read-only deep view (for tests and diagnostics). */
    snapshot(): LearningDoc;
}
