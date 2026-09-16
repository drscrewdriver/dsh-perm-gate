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
/**
 * Compile a CIDR notation string (e.g. `10.0.0.0/8`) into a matcher that
 * tests whether an IPv4 address falls within the range.
 *
 * Returns a pure function `(ip: string) => boolean`. Non-IPv4 inputs always
 * return false. Invalid CIDR throws at compile time (fail-loud).
 */
export declare function compileCidr(cidr: string): (ip: string) => boolean;
/**
 * Compile a port specification into a matcher function.
 *
 * Accepts:
 *   - A single port: `"443"` → matches exactly 443
 *   - A port range: `"8000-9000"` → matches 8000–9000 inclusive
 *
 * Returns `(port: number) => boolean`. Invalid specs throw at compile time.
 */
export declare function compilePortSpec(spec: string): (port: number) => boolean;
/**
 * Compile a domain pattern into a matcher that supports subdomain inclusion.
 *
 * - `"github.com"` matches `github.com` AND any subdomain (`api.github.com`)
 * - `"*.example.com"` matches only subdomains, not `example.com` itself
 * - Glob characters (`*`, `?`, `[...]`) are handled by {@link compileGlob}.
 *
 * Returns a {@link CompiledPattern} whose `.re` is the anchored RegExp.
 */
export declare function compileDomainPattern(pattern: string): CompiledPattern;
/**
 * Compile a git branch-name pattern into a matcher.
 *
 * Branch names are path-like (`release/1.0`) but a rule author thinks in
 * segments-with-globs terms (`release*`), so this is a **non-segment** glob:
 * `*` crosses `/` on purpose, matching how `args` patterns behave.
 *
 * Rejects a pattern that is nothing but a separator so a typo can not degrade
 * into "matches everything".
 */
export declare function compileBranchPattern(pattern: string): CompiledPattern;
/**
 * Compile a list of patterns (possibly `!`-prefixed) into param matchers.
 * Returns `{ pattern, negated, compiled }` entries for the params dimension.
 */
export declare function compileParamPatterns(patterns: readonly string[], opts?: {
    maxStars?: number;
}): Array<{
    readonly pattern: string;
    readonly negated: boolean;
    readonly compiled: CompiledPattern;
}>;
