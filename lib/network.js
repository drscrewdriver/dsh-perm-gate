import { compileCidr, compilePortSpec, compileDomainPattern } from './compiler.js';
/** Closed mode list for runtime normalization. */
export const NETWORK_MODES = ['deny-all', 'whitelist', 'allow-all'];
// ─── Mode mapping ──────────────────────────────────────────────────────────
/**
 * Map one official sandbox preset onto its network mode.
 * `read-only` → deny-all, `workspace-write` → whitelist,
 * `danger-full-access` → allow-all. Unknown → fallback.
 */
export function networkModeForSandbox(sandbox, fallback) {
    switch (sandbox) {
        case 'read-only': return 'deny-all';
        case 'workspace-write': return 'whitelist';
        case 'danger-full-access': return 'allow-all';
        default: return fallback;
    }
}
/** The default decision a mode yields for an unmatched target. */
export function defaultDecision(mode, unlisted) {
    switch (mode) {
        case 'deny-all':
            return { action: 'deny', matched: false, mode };
        case 'whitelist':
            return { action: unlisted, matched: false, mode };
        case 'allow-all':
            return { action: 'allow', matched: false, mode };
    }
}
// ─── Target matching ───────────────────────────────────────────────────────
/**
 * Evaluate the network policy for one target against a compiled ruleset.
 * First-match wins across deny → allow → ask partitions (deny-first).
 *
 * Proxy-layer tool attribution: shell subprocess connections carry
 * `bash`/`pwsh` identity; rules scoped to other tools never fire.
 * Agent identity is unknown at the proxy → agent-scoped rules fail-closed.
 *
 * **Unattributed traffic is exempt by default.** A connection that cannot be
 * tied to an in-flight shell execution did not come from a subprocess the gate
 * manages — it is DSH's own client. Reviewing it would let the host block
 * itself, so it passes through (see {@link UnattributedAction}).
 */
export function decideNetworkTarget(ruleset, target, options) {
    if (options.loopback === 'allow' && isLoopbackTarget(target)) {
        return { action: 'allow', matched: false, mode: options.mode };
    }
    // Not from a shell subprocess → not this surface's to police.
    if (options.attributed === false && (options.unattributed ?? 'allow') === 'allow') {
        return { action: 'allow', matched: false, mode: options.mode, unattributed: true };
    }
    // Scan deny → allow → ask (deny-first).
    for (const partition of [ruleset.deny, ruleset.allow, ruleset.ask]) {
        for (const rule of partition) {
            if (!rule.enabled)
                continue;
            if (rule.network === undefined)
                continue;
            if (!matchToolsProxy(rule))
                continue;
            if (!targetMatchesNetwork(target, rule.network))
                continue;
            return {
                action: rule.action,
                matched: true,
                mode: options.mode,
                ruleIndex: rule.index,
                rule,
            };
        }
    }
    return defaultDecision(options.mode, options.unlisted);
}
/**
 * Tool-scope check for proxy traffic: shell subprocess connections carry
 * `bash`/`pwsh` identity. Rules scoped to other tools never fire at proxy.
 */
function matchToolsProxy(rule) {
    if (rule.tools.length === 0)
        return true;
    // Match if any tool pattern matches 'bash' or 'pwsh'.
    return rule.tools.some((t) => t.re.test('bash') || t.re.test('pwsh'));
}
/**
 * Check if a network target matches a rule's network dimension.
 * All present sub-dimensions must match (AND); within a sub-dimension, entries are OR.
 */
function targetMatchesNetwork(target, network) {
    // domains
    if (network.domains !== undefined && network.domains.length > 0) {
        const matchers = network.domains.map((d) => compileDomainPattern(d));
        if (!matchers.some((m) => m.re.test(target.host)))
            return false;
    }
    // ips
    if (network.ips !== undefined && network.ips.length > 0) {
        const allIps = [...target.ips];
        if (target.host !== undefined)
            allIps.push(target.host);
        const cidrs = network.ips.filter((s) => s.includes('/'));
        const literals = network.ips.filter((s) => !s.includes('/'));
        const ipMatch = allIps.some((ip) => literals.includes(ip) || cidrs.some((c) => {
            try {
                return compileCidr(c)(ip);
            }
            catch {
                return false;
            }
        }));
        if (!ipMatch)
            return false;
    }
    // ports
    if (network.ports !== undefined && network.ports.length > 0) {
        if (target.port === undefined)
            return false;
        const matchers = network.ports.map((p) => {
            try {
                return compilePortSpec(p);
            }
            catch {
                return (_) => false;
            }
        });
        if (!matchers.some((m) => m(target.port)))
            return false;
    }
    // schemes
    if (network.schemes !== undefined && network.schemes.length > 0) {
        if (target.scheme === undefined)
            return false;
        if (!network.schemes.includes(target.scheme))
            return false;
    }
    return true;
}
// ─── Helpers ───────────────────────────────────────────────────────────────
/** Whether a target addresses the loopback range. */
export function isLoopbackTarget(target) {
    const host = target.host;
    if (host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1')
        return true;
    const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (parts === null)
        return false;
    return parts.slice(1).every((o) => Number(o) <= 255) && parts[1] === '127';
}
/** Whether a string is an IP literal (v4 or v6). */
export function isIpLiteral(host) {
    return /^[\d.:a-fA-F]+$/.test(host) && (host.includes(':') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host));
}
/**
 * Parse a URL string into a NetworkTarget.
 * Returns undefined for malformed URLs.
 */
export function parseUrlTarget(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase().replace(/\.+$/, '');
        if (host.length === 0)
            return undefined;
        const port = u.port !== '' ? Number(u.port) : (u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : undefined);
        return {
            host,
            port: port !== undefined && Number.isFinite(port) ? port : undefined,
            scheme: u.protocol.replace(/:$/, ''),
            ips: isIpLiteral(host) ? [host] : [],
        };
    }
    catch {
        return undefined;
    }
}
/**
 * The short structured message a blocked proxy connection receives.
 * `ask` at proxy layer degrades to block + audit (no session context).
 */
export function blockMessage(decision) {
    const reason = decision.rule?.reason ?? '';
    if (decision.matched) {
        const rulePart = decision.ruleIndex !== undefined ? ` by rule ${decision.ruleIndex + 1}` : '';
        if (decision.action === 'ask') {
            return `[network: blocked pending approval${rulePart}] ${reason}\n(subprocess connections cannot ride the interactive approval seam — ask your user or add an allow rule for this target)`;
        }
        return `[network: denied${rulePart}] ${reason}`;
    }
    switch (decision.mode) {
        case 'deny-all':
            return '[network: denied] network mode deny-all (read-only sandbox preset): only whitelisted targets are reachable';
        case 'whitelist':
            return decision.action === 'ask'
                ? '[network: blocked pending approval] whitelist mode: the target is not matched by an allow rule'
                : '[network: denied] whitelist mode: the target is not matched by an allow rule';
        case 'allow-all':
            return '[network: denied]';
    }
}
