/**
 * Extended rule dimensions for dsh-perm-gate.
 *
 * These 6 dimensions extend the existing 4 (tools/command/args/paths) and are
 * parsed from each rule entry in the YAML permissions document. All types are
 * pure — no I/O — so parsing and validation are unit-testable.
 *
 * Dimensions:
 *   1. params   — key→value glob matching (AND over keys, `!` prefix negates)
 *   2. absent   — parameter keys that must NOT be present
 *   3. agents   — agent identity candidates (main/subagent/preset:<name>)
 *   4. when     — environment / platform conditions
 *   5. argv     — extra argv patterns (pipeline, etc.) not covered by command/args
 *   6. network  — domain / IP / port / scheme matching
 */
import { RuleError } from './rule.js';
/**
 * Parse the `params` field from a rule entry.
 *
 * Format:
 * ```yaml
 * params:
 *   command: ["*--force*", "!*--dry-run*"]
 *   flags.mode: ["production"]
 * ```
 *
 * Each key maps to a string-or-list of value glob patterns.
 * A single `!`-prefixed pattern sets `negated: true`.
 */
export function parseParamsDimension(raw, at) {
    if (raw === undefined || raw === null)
        return [];
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RuleError(`${at}.params must be a mapping`);
    }
    const result = [];
    for (const [key, val] of Object.entries(raw)) {
        if (key.length === 0)
            throw new RuleError(`${at}.params has empty key`);
        const patterns = toStringList(val, `${at}.params.${key}`);
        const negated = patterns.length === 1 && patterns[0].startsWith('!');
        result.push({ key, patterns, negated });
    }
    return result;
}
/**
 * Parse the `absent` field: a list of parameter key names that must be absent.
 */
export function parseAbsentDimension(raw, at) {
    if (raw === undefined || raw === null)
        return [];
    const list = toStringList(raw, `${at}.absent`);
    for (let i = 0; i < list.length; i++) {
        if (list[i].length === 0)
            throw new RuleError(`${at}.absent[${i}] must be a non-empty string`);
    }
    return list;
}
const VALID_AGENT_PATTERNS = /^(?:main|subagent|preset:.+)$/i;
/**
 * Parse the `agents` field: a list of agent identity patterns.
 */
export function parseAgentsDimension(raw, at) {
    if (raw === undefined || raw === null)
        return [];
    const list = toStringList(raw, `${at}.agents`);
    for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (v.length === 0)
            throw new RuleError(`${at}.agents[${i}] must be a non-empty string`);
        if (!VALID_AGENT_PATTERNS.test(v)) {
            throw new RuleError(`${at}.agents[${i}] must be "main", "subagent", or "preset:<name>"`);
        }
    }
    return list;
}
/**
 * Parse the `when` field: environment and platform conditions.
 *
 * Format:
 * ```yaml
 * when:
 *   env:
 *     NODE_ENV: ["production"]
 *     CI: ["true", "1"]
 *   platform: [linux, win32]
 * ```
 */
export function parseWhenDimension(raw, at) {
    if (raw === undefined || raw === null)
        return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RuleError(`${at}.when must be a mapping`);
    }
    const obj = raw;
    const env_ = (() => {
        if (obj.env === undefined)
            return undefined;
        if (typeof obj.env !== 'object' || Array.isArray(obj.env)) {
            throw new RuleError(`${at}.when.env must be a mapping`);
        }
        const e = {};
        for (const [k, v] of Object.entries(obj.env)) {
            e[k] = toStringList(v, `${at}.when.env.${k}`);
        }
        return e;
    })();
    const platform_ = obj.platform !== undefined ? toStringList(obj.platform, `${at}.when.platform`) : undefined;
    const nodeVersion_ = obj.nodeVersion !== undefined
        ? (typeof obj.nodeVersion === 'string' && obj.nodeVersion.length > 0
            ? obj.nodeVersion
            : (() => { throw new RuleError(`${at}.when.nodeVersion must be a non-empty string`); })())
        : undefined;
    if (env_ === undefined && platform_ === undefined && nodeVersion_ === undefined)
        return undefined;
    const result = {
        ...(env_ !== undefined && { env: env_ }),
        ...(platform_ !== undefined && { platform: platform_ }),
        ...(nodeVersion_ !== undefined && { nodeVersion: nodeVersion_ }),
    };
    return result;
}
/**
 * Parse the `argv` field: extra argv patterns.
 *
 * Format:
 * ```yaml
 * argv:
 *   pipeline: ["curl|sh", "wget|bash"]
 * ```
 */
export function parseArgvDimension(raw, at) {
    if (raw === undefined || raw === null)
        return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RuleError(`${at}.argv must be a mapping`);
    }
    const obj = raw;
    const pipeline_ = obj.pipeline !== undefined ? toStringList(obj.pipeline, `${at}.argv.pipeline`) : undefined;
    if (pipeline_ === undefined)
        return undefined;
    return { pipeline: pipeline_ };
}
/**
 * Parse the `network` field: domain / IP / port / scheme matching.
 *
 * Format:
 * ```yaml
 * network:
 *   domains: ["*.internal.corp", "github.com"]
 *   ips: ["10.0.0.0/8"]
 *   ports: ["443", "8000-9000"]
 *   schemes: [https]
 * ```
 */
export function parseNetworkDimension(raw, at) {
    if (raw === undefined || raw === null)
        return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RuleError(`${at}.network must be a mapping`);
    }
    const obj = raw;
    const domains_ = obj.domains !== undefined ? toStringList(obj.domains, `${at}.network.domains`) : undefined;
    const ips_ = obj.ips !== undefined ? toStringList(obj.ips, `${at}.network.ips`) : undefined;
    const ports_ = obj.ports !== undefined ? toStringList(obj.ports, `${at}.network.ports`) : undefined;
    const schemes_ = obj.schemes !== undefined ? toStringList(obj.schemes, `${at}.network.schemes`) : undefined;
    if (domains_ === undefined && ips_ === undefined && ports_ === undefined && schemes_ === undefined)
        return undefined;
    const result = {
        ...(domains_ !== undefined && { domains: domains_ }),
        ...(ips_ !== undefined && { ips: ips_ }),
        ...(ports_ !== undefined && { ports: ports_ }),
        ...(schemes_ !== undefined && { schemes: schemes_ }),
    };
    return result;
}
/**
 * Parse the `branch` field: branch / remote / protected-branch matching.
 *
 * Format:
 * ```yaml
 * branch:
 *   target: [main, "release*"]
 *   remote: [origin]
 *   shared: true
 * ```
 */
export function parseBranchDimension(raw, at) {
    if (raw === undefined || raw === null)
        return undefined;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        throw new RuleError(`${at}.branch must be a mapping`);
    }
    const obj = raw;
    const unknownKeys = Object.keys(obj).filter((k) => k !== 'target' && k !== 'remote' && k !== 'shared');
    if (unknownKeys.length > 0) {
        throw new RuleError(`${at}.branch unknown field${unknownKeys.length > 1 ? 's' : ''} ${unknownKeys.map((k) => JSON.stringify(k)).join(', ')} (expected target / remote / shared)`);
    }
    const target_ = obj.target !== undefined ? toStringList(obj.target, `${at}.branch.target`) : undefined;
    const remote_ = obj.remote !== undefined ? toStringList(obj.remote, `${at}.branch.remote`) : undefined;
    if (obj.shared !== undefined && typeof obj.shared !== 'boolean') {
        throw new RuleError(`${at}.branch.shared must be a boolean`);
    }
    const shared_ = obj.shared;
    if (target_ === undefined && remote_ === undefined && shared_ === undefined)
        return undefined;
    return {
        ...(target_ !== undefined && { target: target_ }),
        ...(remote_ !== undefined && { remote: remote_ }),
        ...(shared_ !== undefined && { shared: shared_ }),
    };
}
// ─── Helpers ───────────────────────────────────────────────────────────────
/** Convert an unknown value to a string list (string → [string], array → filtered). */
function toStringList(value, at) {
    if (value === undefined || value === null)
        return [];
    const list = typeof value === 'string' ? [value] : value;
    if (!Array.isArray(list))
        throw new RuleError(`${at} must be a string or list of strings`);
    const result = [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (typeof item !== 'string' || item.length === 0) {
            throw new RuleError(`${at}[${i}] must be a non-empty string`);
        }
        result.push(item);
    }
    return result;
}
