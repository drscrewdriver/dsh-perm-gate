/**
 * Command normalization — decode the layers a call hides behind, as a scan signal.
 *
 * Why this exists: every deterministic layer reads the command *as written*.
 * `deny-defaults` is a word list, the parsers switch on `baseName`, and
 * `isCleanupSafe` matches path segments. All three are blind to
 * `powershell -EncodedCommand UgBlAG0A...`, to `R="-rf"; rm $R /`, and to a
 * function wrapper around a wipe. Measured on the eval set, the encoded cases are
 * exactly where a graded model ships an unrecoverable act past the gate
 * (`adv_013` decodes to `Remove-Item -Recurse -Force C:\`, `adv_032` to
 * `DROP DATABASE orders_prod`).
 *
 * Two rules keep this from becoming its own vulnerability:
 *
 * 1. **Additive only.** The caller feeds these strings to *stricter* scans
 *    (deny-keyword, P0 wipe detection, tier grading). Nothing here can widen a
 *    decision, and no result is written back to `exec.arguments` or the event
 *    log, so fingerprints, grants and audit text stay about the call as received.
 * 2. **Bounded.** Length caps, depth cap, variant cap and a printable-ratio gate,
 *    because decoding is attacker-controlled input on the decision path. Oversized
 *    or undecodable input yields nothing, which leaves the call
 *    `targetResolvable=false` — opaque, never optimistically safe.
 *
 * On the plugin's own `--exec-b64` launcher wrapper: it is decoded like anything
 * else rather than exempted. An exemption would hand the agent a disguise
 * (`ac-launcher --config x --exec-b64 <rm -rf ...>`), while decoding it can only
 * ever escalate — so the cost is at most a second confirmation, never a block
 * that could not have been reached honestly.
 */
/** Where a decoded string came from, and whether the original runs it as code. */
export interface NormalizedText {
    readonly text: string;
    readonly via: 'base64' | 'hex' | 'varsub';
    /**
     * True when the payload is handed to an execution primitive
     * (`-EncodedCommand`, `FromBase64String`, `Invoke-Expression`, `eval`,
     * `bash -c`, `xxd -r -p` …), i.e. it will really run. Only these variants may
     * feed P0 hard-deny; a stray base64 blob in a comment must not.
     */
    readonly executed: boolean;
}
export interface NormalizeOptions {
    /** Refuse to touch a command longer than this (DoS + false-positive guard). */
    readonly maxInputChars?: number;
    /** How many decode layers to peel. */
    readonly maxDepth?: number;
    /** Shortest base64 blob considered (below this, too noisy). */
    readonly minBlobChars?: number;
    /** Longest decoded output kept. */
    readonly maxOutputChars?: number;
    /** Hard cap on returned variants. */
    readonly maxVariants?: number;
    /**
     * Wall-clock budget for the whole peel. On expiry **all** partial work is
     * dropped, not just the remaining layers: a decoded fragment found late could
     * turn into a P0 deny, and the guardrail this plugin cannot trade away is that
     * the normalizer never decides — an expired peel leaves the call opaque, so the
     * decision falls back to the ask it was already heading for.
     */
    readonly maxMs?: number;
    /** Injected clock (tests drive the deadline without sleeping). */
    readonly now?: () => number;
}
/**
 * Peel encoding layers off one command and return every readable variant.
 *
 * Never throws: any failure yields whatever decoded fine, and an empty result
 * simply means the call stays opaque to the deterministic layers. Exceeding the
 * time budget returns **nothing** rather than the partial set (see `maxMs`).
 */
export declare function normalizeCommandText(text: string, options?: NormalizeOptions): NormalizedText[];
/**
 * Whether a command is the plugin's own AppContainer launcher wrapper.
 * Informational only — the payload is still decoded and judged on its merits.
 */
export declare function isOwnLauncher(text: string): boolean;
/** Variants strict enough to feed a deterministic deny: the payload actually runs. */
export declare function executableVariants(variants: readonly NormalizedText[]): string[];
/** All decoded variants, for the additive-only keyword/tier scans. */
export declare function allVariants(variants: readonly NormalizedText[]): string[];
