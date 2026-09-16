/**
 * Pattern compilation for dsh-perm-gate.
 *
 * Turns glob (and literal) patterns into anchored RegExps with a hard bound
 * on the number of unbounded `*` quantifiers (ReDoS degree). Every function
 * here is pure — no filesystem/clock/process state — so the compiler and its
 * failure modes are unit-testable and replayable.
 */
import { createHash } from 'node:crypto';
/** Raised at load time when a pattern cannot be compiled safely. */
export class PatternError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PatternError';
    }
}
/** No-reconstruction bound: at most one unbounded `*` run per pattern. */
export const DEFAULT_MAX_STARS = 2;
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
export function compileGlob(pattern, options = {}) {
    const { segments = false, maxStars = DEFAULT_MAX_STARS } = options;
    if (pattern === '')
        return { source: pattern, re: /^$/u };
    // Collapse: keep each star (so run length survives), counting star-RUNS and
    // rejecting patterns whose unbounded-run count exceeds maxStars.
    const tokens = [];
    let starRuns = 0;
    let inClass = false;
    for (let i = 0; i < pattern.length; i += 1) {
        const ch = pattern[i];
        if (ch === '[' && !inClass) {
            inClass = true;
            tokens.push(ch);
            continue;
        }
        if (inClass) {
            tokens.push(ch);
            if (ch === ']')
                inClass = false;
            continue;
        }
        if (ch === '*') {
            if (tokens.length === 0 || tokens[tokens.length - 1] !== '*') {
                starRuns += 1;
                if (starRuns > maxStars) {
                    throw new PatternError(`pattern "${pattern}" exceeds maxStars=${maxStars} unbounded glob stars`);
                }
            }
            tokens.push('*');
        }
        else {
            tokens.push(ch);
        }
    }
    let out = '';
    let i = 0;
    const n = tokens.length;
    while (i < n) {
        const ch = tokens[i];
        if (ch === '*') {
            let run = 1;
            while (tokens[i + run] === '*')
                run += 1;
            if (segments)
                out += run >= 2 ? '.*' : '[^/]*';
            else
                out += '.*';
            i += run;
        }
        else if (ch === '?') {
            out += segments ? '[^/]' : '.';
            i += 1;
        }
        else if (ch === '[') {
            let j = i + 1;
            let body = '';
            if (tokens[j] === '!' || tokens[j] === '^') {
                body += '^';
                j += 1;
            }
            let closed = false;
            while (j < n) {
                const c = tokens[j];
                if (c === ']') {
                    closed = true;
                    j += 1;
                    break;
                }
                body += c === '\\' ? '\\\\' : c;
                j += 1;
            }
            if (!closed)
                throw new PatternError(`pattern "${pattern}" has an unterminated character class`);
            out += `[${body}]`;
            i = j;
        }
        else {
            out += escapeRegexChar(ch);
            i += 1;
        }
    }
    return { source: pattern, re: new RegExp(`^${out}$`, 'u') };
}
/** Compile a literal (fully escaped), never a glob. */
export function compileLiteral(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { source: pattern, re: new RegExp(`^${escaped}$`, 'u') };
}
/** Escape one character for safe inclusion in a RegExp literal. */
function escapeRegexChar(ch) {
    return /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
}
/** Stable SHA-256 content hash (used for rule-file compile caching). */
export function hashText(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}
// ─── Extended matchers for new dimensions ──────────────────────────────────
/**
 * Compile a CIDR notation string (e.g. `10.0.0.0/8`) into a matcher that
 * tests whether an IPv4 address falls within the range.
 *
 * Returns a pure function `(ip: string) => boolean`. Non-IPv4 inputs always
 * return false. Invalid CIDR throws at compile time (fail-loud).
 */
export function compileCidr(cidr) {
    const slash = cidr.indexOf('/');
    if (slash <= 0 || slash >= cidr.length - 1) {
        throw new PatternError(`CIDR "${cidr}" must be in address/prefix format`);
    }
    const addrStr = cidr.slice(0, slash);
    const prefixStr = cidr.slice(slash + 1);
    const prefix = Number.parseInt(prefixStr, 10);
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) {
        throw new PatternError(`CIDR "${cidr}" prefix must be 0–32`);
    }
    const addr = ipv4ToNumber(addrStr);
    if (addr === undefined) {
        throw new PatternError(`CIDR "${cidr}" has invalid IPv4 address`);
    }
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const network = (addr & mask) >>> 0;
    return (ip) => {
        const n = ipv4ToNumber(ip);
        if (n === undefined)
            return false;
        return ((n & mask) >>> 0) === network;
    };
}
/** Parse an IPv4 dotted-decimal string to a 32-bit unsigned integer, or undefined. */
function ipv4ToNumber(addr) {
    const parts = addr.split('.');
    if (parts.length !== 4)
        return undefined;
    let result = 0;
    for (const part of parts) {
        const n = Number.parseInt(part, 10);
        if (!Number.isFinite(n) || n < 0 || n > 255)
            return undefined;
        if (part.length > 1 && part.startsWith('0'))
            return undefined; // no leading zeros
        result = (result * 256 + n) >>> 0;
    }
    return result;
}
/**
 * Compile a port specification into a matcher function.
 *
 * Accepts:
 *   - A single port: `"443"` → matches exactly 443
 *   - A port range: `"8000-9000"` → matches 8000–9000 inclusive
 *
 * Returns `(port: number) => boolean`. Invalid specs throw at compile time.
 */
export function compilePortSpec(spec) {
    const dash = spec.indexOf('-');
    if (dash === -1) {
        const n = Number.parseInt(spec, 10);
        if (!Number.isFinite(n) || n < 0 || n > 65535) {
            throw new PatternError(`port "${spec}" must be 0–65535`);
        }
        return (port) => port === n;
    }
    const lo = Number.parseInt(spec.slice(0, dash), 10);
    const hi = Number.parseInt(spec.slice(dash + 1), 10);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo < 0 || hi > 65535 || lo > hi) {
        throw new PatternError(`port range "${spec}" must be low–high within 0–65535`);
    }
    return (port) => port >= lo && port <= hi;
}
/**
 * Compile a domain pattern into a matcher that supports subdomain inclusion.
 *
 * - `"github.com"` matches `github.com` AND any subdomain (`api.github.com`)
 * - `"*.example.com"` matches only subdomains, not `example.com` itself
 * - Glob characters (`*`, `?`, `[...]`) are handled by {@link compileGlob}.
 *
 * Returns a {@link CompiledPattern} whose `.re` is the anchored RegExp.
 */
export function compileDomainPattern(pattern) {
    // If the pattern already contains glob chars, use glob compilation.
    if (/[*?[\]]/.test(pattern)) {
        return compileGlob(pattern, { segments: false, maxStars: DEFAULT_MAX_STARS });
    }
    // Literal domain: match exactly OR as a parent of a subdomain.
    // e.g. "github.com" matches "github.com" and "api.github.com"
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(?:.*\\.)?${escaped}$`, 'u');
    return { source: pattern, re };
}
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
export function compileBranchPattern(pattern) {
    if (!/[A-Za-z0-9_*?[\]]/.test(pattern)) {
        throw new PatternError(`branch pattern ${JSON.stringify(pattern)} has no matchable character`);
    }
    return compileGlob(pattern, { segments: false, maxStars: DEFAULT_MAX_STARS });
}
/**
 * Compile a list of patterns (possibly `!`-prefixed) into param matchers.
 * Returns `{ pattern, negated, compiled }` entries for the params dimension.
 */
export function compileParamPatterns(patterns, opts = {}) {
    const maxStars = opts.maxStars ?? DEFAULT_MAX_STARS;
    return patterns.map((p) => {
        if (p.startsWith('!') && p.length > 1) {
            return { pattern: p, negated: true, compiled: compileGlob(p.slice(1), { segments: false, maxStars }) };
        }
        return { pattern: p, negated: false, compiled: compileGlob(p, { segments: false, maxStars }) };
    });
}
