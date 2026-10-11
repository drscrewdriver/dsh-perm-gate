/**
 * Redaction primitives for dsh-perm-gate.
 *
 * Before this module existed, the grader payload (`risk.ts riskUserText`)
 * serialized the *whole* `args` object — including file bodies and inline
 * credentials — and POSTed it to a user-configured third-party endpoint, while
 * `classifier.ts` claimed secrets had already been stripped upstream. They had
 * not. This module is the single place that makes that claim true.
 *
 * Three properties are load-bearing, and each has a test:
 *
 * 1. **Judgment-preserving.** Only secret *values* are masked; verbs, path
 *    segments, flags and remote hosts survive, because the deterministic layers
 *    (deny-keywords, `isCleanupSafe`, the parsers) and the reversibility tier
 *    all read those. A redaction that hides `rm -rf /` would be a security
 *    regression, so `adv_040/043/046/047` must still read as credential/remote.
 * 2. **Idempotent.** Every replacement is a `[redacted:<kind>:<len>]` marker
 *    that the patterns themselves refuse to re-match. Without this, piping an
 *    already-redacted value through a second layer (grader payload + event
 *    digest) silently rewrites lengths and breaks fingerprint stability.
 * 3. **Bounded.** Long bodies collapse to a byte count plus a cheap hash, so
 *    redaction also caps prompt size — grading latency is prefill-dominated.
 *
 * The hash here is FNV-1a, deliberately **not** a cryptographic digest: it only
 * needs to identify "the same big body" across events. Security-sensitive
 * digests (event `inputDigest`) use sha256 on the node half.
 */
/** Default ceiling for a redacted command string. */
export declare const DEFAULT_MAX_COMMAND_CHARS = 800;
/** Default ceiling for a single argument string before it collapses to a hash. */
export declare const DEFAULT_MAX_ARG_CHARS = 200;
/** Options for {@link redactCommandText}. */
export interface RedactOptions {
    /** Hard ceiling on the returned string; overflow is cut with a `…[+N]` tail. */
    readonly maxChars?: number;
}
/**
 * Redact one command/text string, preserving the structure the deterministic
 * layers and the grader depend on. Idempotent by construction.
 */
export declare function redactCommandText(text: string, options?: RedactOptions): string;
/** Options for {@link redactArgs}. */
export interface RedactArgsOptions {
    readonly maxStringChars?: number;
    /** Cap on array length and object keys, so a huge payload cannot bloat the prompt. */
    readonly maxItems?: number;
    readonly maxDepth?: number;
}
/**
 * Redact a tool-call argument bag for egress (grader payload, event digest,
 * approval card). Keys are preserved — several are authority-bearing (host,
 * path, command) — and values go through {@link redactCommandText}, with long
 * bodies collapsed to a byte count plus a cheap identity hash.
 */
export declare function redactArgs(args: unknown, options?: RedactArgsOptions): unknown;
