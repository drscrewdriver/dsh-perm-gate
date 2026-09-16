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
    readonly key: string;
    readonly fp: string;
    readonly ctx: string;
    readonly at: number;
}
export interface RiskLearningOptions {
    /** Confirmations required before an exact-sample re-run may auto-allow. A getter reads the live setting. Default 3. */
    readonly threshold?: number | (() => number);
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
    private load;
    private persist;
    /** Human confirmations recorded so far for one key. */
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
    /** Remove one sedimented sample (its fingerprint no longer auto-allows). */
    dropSample(key: string, fp: string): void;
    /** Terminate learning for one key: drop its confirmation count and samples. */
    resetKey(key: string): void;
    /** Read-only deep view (for tests and diagnostics). */
    snapshot(): LearningDoc;
}
