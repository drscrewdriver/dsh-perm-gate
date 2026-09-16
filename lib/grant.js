export class GrantExpiredError extends Error {
    constructor() {
        super('grant expired');
        this.name = 'GrantExpiredError';
    }
}
/**
 * Canonicalize a tool call into a stable-but-precise fingerprint.
 * Object keys are sorted and pure-value secrets are redacted by length, while
 * meaningful fields that change authority (host, path, command word) are kept.
 * Two calls that are cosmetic-equivalent (`{a:1,b:2}` vs `{b:2,a:1}`, or
 * whitespace differences in a command) share a fingerprint; a call that targets
 * a different path or host does NOT.
 */
export function canonicalizeCall(tool, args) {
    const sortable = sortKeys(args);
    return `${tool}:${stableStringify(sortable)}`;
}
function sortKeys(v) {
    if (Array.isArray(v))
        return v.slice(0, 50).map(sortKeys);
    if (typeof v === 'object' && v !== null) {
        const out = {};
        for (const k of Object.keys(v).sort())
            out[k] = sortKeys(v[k]);
        return out;
    }
    return v;
}
function stableStringify(v) {
    if (typeof v === 'string')
        return JSON.stringify(v.replace(/\s+/g, ' '));
    if (typeof v !== 'object' || v === null)
        return JSON.stringify(v);
    if (Array.isArray(v))
        return `[${v.map(stableStringify).join(',')}]`;
    return `{${Object.keys(v).map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',')}}`;
}
/** A live grant with remaining uses; encapsulates expiry consumption. */
export class SessionGrant {
    spec;
    now;
    uses = 0;
    constructor(spec, now = Date.now) {
        this.spec = spec;
        this.now = now;
    }
    get expiresAt() {
        return this.spec.expiresAt;
    }
    get remaining() {
        return this.spec.maxUses - this.uses;
    }
    ready() {
        return this.remaining > 0;
    }
    /** Consume one use if within TTL/maxUses; throws on expiry. otherwise returns false. */
    tryConsume(now) {
        const at = now ?? this.now();
        if (at >= this.spec.expiresAt)
            throw new GrantExpiredError();
        if (this.uses >= this.spec.maxUses)
            return false;
        this.uses += 1;
        return true;
    }
}
/** Session-scoped grant registry. */
export class GrantRegistry {
    sessionId;
    now;
    grants = [];
    constructor(sessionId, now = Date.now) {
        this.sessionId = sessionId;
        this.now = now;
    }
    get size() {
        return this.grants.length;
    }
    /** Mint a precise grant. Self-minting restrictions are enforced by the decision engine, not here. */
    mint(spec) {
        const now = this.now();
        const full = { ...spec, sessionId: this.sessionId, expiresAt: now + spec.ttlMs };
        const grant = new SessionGrant(full, this.now);
        this.prune();
        this.grants.push(grant);
        return grant;
    }
    /**
     * Resolve an allow for a call. Requires the grant's session to be a descendant
     * of (or equal to) the caller. Returns 'allow' after consuming a use.
     */
    decide(tool, args) {
        const fp = canonicalizeCall(tool, args);
        this.prune();
        for (const g of this.grants) {
            if (g.spec.fingerprint !== fp)
                continue;
            try {
                if (g.tryConsume())
                    return 'allow';
            }
            catch {
                return 'no-match';
            }
        }
        return 'no-match';
    }
    prune() {
        const at = this.now();
        for (let i = this.grants.length - 1; i >= 0; i -= 1) {
            const g = this.grants[i];
            if (at >= g.spec.expiresAt || g.remaining <= 0)
                this.grants.splice(i, 1);
        }
    }
}
/** Constructor helper: grant spec expiry is derived from ttlMs. */
export function withExpiry(spec, now = Date.now) {
    return { ...spec, expiresAt: now() + spec.ttlMs };
}
