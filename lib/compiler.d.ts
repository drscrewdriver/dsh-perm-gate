/** A checkable pattern already compiled to a RegExp. */
export interface CompiledPattern {
    readonly source: string;
    readonly re: RegExp;
}
/** Raised at load time when a pattern cannot be compiled safely. */
export declare class PatternError extends Error {
    constructor(message: string);
}
/** No-reconstruction bound: at most one unbounded `*` run per pattern. */
export declare const DEFAULT_MAX_STARS = 2;
/**
 * Compile a simple glob into an anchored RegExp.
 *
 * - `*` matches any characters; when `segments` is true it stops at a path
 *   separator `/`.
 * - `?` matches one char (not a separator when `segments`).
 * - `[...]` char classes are preserved.
 * - Consecutive unbounded `*` are collapsed into one; a pattern whose star-run
 *   count exceeds `maxStars` is rejected (ReDoS degree bound), never silently
 *   bounded to a partial match.
 */
export declare function compileGlob(pattern: string, options?: {
    segments?: boolean;
    maxStars?: number;
}): CompiledPattern;
/** Compile a literal (fully escaped), never a glob. */
export declare function compileLiteral(pattern: string): CompiledPattern;
/** Stable SHA-256 content hash (used for rule-file compile caching). */
export declare function hashText(text: string): string;
