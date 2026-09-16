/**
 * Session-scoped grants for dsh-perm-gate: a bounded, precise grant that lets a
 * specific tool+call through once (or N times) within a TTL. Grants are keyed
 * by a canonical fingerprint of the call so re-running with a DIFFERENT target
 * never reuses authority.
 */
export type GrantDecision = 'allow' | 'no-match';
export interface GrantSpec {
    readonly tool: string;
    /** Canonical fingerprint of the call (see {@link canonicalizeCall}). */
    readonly fingerprint: string;
    readonly decidedBy: 'human' | 'approval' | 'grant-chain';
    readonly sessionId: string;
    readonly parentAuthorized: boolean;
    readonly ttlMs: number;
    readonly maxUses: number;
    readonly expiresAt: number;
}
export declare class GrantExpiredError extends Error {
    constructor();
}
/**
 * Canonicalize a tool call into a stable-but-precise fingerprint.
 * Object keys are sorted and pure-value secrets are redacted by length, while
 * meaningful fields that change authority (host, path, command word) are kept.
 * Two calls that are cosmetic-equivalent (`{a:1,b:2}` vs `{b:2,a:1}`, or
 * whitespace differences in a command) share a fingerprint; a call that targets
 * a different path or host does NOT.
 */
export declare function canonicalizeCall(tool: string, args: Record<string, unknown>): string;
/** A live grant with remaining uses; encapsulates expiry consumption. */
export declare class SessionGrant {
    readonly spec: GrantSpec;
    private readonly now;
    private uses;
    constructor(spec: GrantSpec, now?: () => number);
    get expiresAt(): number;
    get remaining(): number;
    ready(): boolean;
    /** Consume one use if within TTL/maxUses; throws on expiry. otherwise returns false. */
    tryConsume(now?: number): boolean;
}
/** Session-scoped grant registry. */
export declare class GrantRegistry {
    private readonly sessionId;
    private readonly now;
    private readonly grants;
    constructor(sessionId: string, now?: () => number);
    get size(): number;
    /** Mint a precise grant. Self-minting restrictions are enforced by the decision engine, not here. */
    mint(spec: Omit<GrantSpec, 'sessionId' | 'expiresAt'>): SessionGrant;
    /**
     * Resolve an allow for a call. Requires the grant's session to be a descendant
     * of (or equal to) the caller. Returns 'allow' after consuming a use.
     */
    decide(tool: string, args: Record<string, unknown>): GrantDecision;
    private prune;
}
/** Constructor helper: grant spec expiry is derived from ttlMs. */
export declare function withExpiry(spec: Omit<GrantSpec, 'expiresAt'>, now?: () => number): GrantSpec;
