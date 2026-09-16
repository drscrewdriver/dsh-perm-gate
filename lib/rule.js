/**
 * Rule vocabulary for dsh-perm-gate: parsing a `permissions` YAML document into
 * a validated config, compiling globs, and first-match evaluation. Every
 * function is pure — no filesystem/clock/process state — so parsing, matching
 * and the failure modes are unit-testable and replayable.
 *
 * The chain is split into `deny` / `allow` / `ask` lists. deny is evaluated
 * first (blacklist priority); within each action list, first match wins. When
 * nothing matches, `defaultAction` applies.
 */
import { parse } from 'yaml';
import { compileGlob, compileBranchPattern, hashText } from './compiler.js';
import { parseParamsDimension, parseAbsentDimension, parseAgentsDimension, parseWhenDimension, parseArgvDimension, parseNetworkDimension, parseBranchDimension, } from './rule-dims.js';
const VALID_ACTIONS = ['allow', 'ask', 'deny'];
const PATH_CANDIDATE_KEYS = [
    'path', 'paths', 'file', 'files', 'file_path', 'dir', 'directory', 'directories',
    'cwd', 'workspace', 'root', 'target', 'targets', 'output',
];
const URL_CANDIDATE_KEYS = ['url', 'urls', 'uri', 'endpoint', 'remote', 'repo', 'repository'];
const COMMAND_CANDIDATE_KEYS = ['command', 'cmd', 'script', 'command_line', 'commandLine'];
export class RuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RuleError';
    }
}
function isRecord(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function stringList(v, at) {
    if (v === undefined)
        return [];
    const list = typeof v === 'string' ? [v] : v;
    if (!Array.isArray(list))
        throw new RuleError(`${at} must be a string or list of strings`);
    return list.map((item, i) => {
        if (typeof item !== 'string' || item.length === 0)
            throw new RuleError(`${at}[${i}] must be a non-empty string`);
        return item;
    });
}
function actionOf(v, at) {
    if (typeof v !== 'string' || !VALID_ACTIONS.includes(v)) {
        throw new RuleError(`${at} action must be one of ${VALID_ACTIONS.join('|')}`);
    }
    return v;
}
/** Parse a raw YAML permissions document; malformed files fail loud at load. */
export function parsePermissionsDocument(text) {
    let raw;
    try {
        raw = parse(text);
    }
    catch (error) {
        throw new RuleError(`invalid YAML: ${String(error)}`);
    }
    if (raw === null || raw === undefined) {
        return { defaultAction: 'ask', deny: [], allow: [], ask: [] };
    }
    if (!isRecord(raw))
        throw new RuleError('permissions document must be a mapping');
    const root = isRecord(raw.permissions) ? raw.permissions : raw;
    const unknown = Object.keys(root).filter((k) => !VALID_ACTIONS.includes(k) && k !== 'defaultAction');
    if (unknown.length > 0) {
        throw new RuleError(`unknown permissions field${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => JSON.stringify(k)).join(', ')}`);
    }
    const defaultAction = root.defaultAction === undefined ? 'ask' : actionOf(root.defaultAction, 'defaultAction');
    const parseList = (key, at) => {
        const arr = root[key];
        if (arr === undefined)
            return [];
        if (!Array.isArray(arr))
            throw new RuleError(`${at}.${key} must be a list`);
        return arr.map((item, i) => parseRuleEntry(item, key, `${at}.${key}[${i}]`));
    };
    return {
        defaultAction,
        deny: parseList('deny', 'permissions'),
        allow: parseList('allow', 'permissions'),
        ask: parseList('ask', 'permissions'),
    };
}
function parseRuleEntry(raw, action, at) {
    if (!isRecord(raw))
        throw new RuleError(`${at} must be a mapping`);
    const VALID_KEYS = ['tools', 'command', 'args', 'paths', 'params', 'absent', 'agents', 'when', 'argv', 'network', 'branch', 'action', 'reason', 'enabled'];
    const unknown = Object.keys(raw).filter((k) => !VALID_KEYS.includes(k));
    if (unknown.length > 0) {
        throw new RuleError(`${at} unknown field${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => JSON.stringify(k)).join(', ')}`);
    }
    if (raw.action !== undefined && actionOf(raw.action, `${at}.action`) !== action) {
        throw new RuleError(`${at} action conflicts with its list`);
    }
    const reason = raw.reason;
    if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length === 0)) {
        throw new RuleError(`${at}.reason must be a non-empty string`);
    }
    return {
        tools: stringList(raw.tools, `${at}.tools`),
        command: stringList(raw.command, `${at}.command`),
        args: stringList(raw.args, `${at}.args`),
        paths: stringList(raw.paths, `${at}.paths`),
        params: parseParamsDimension(raw.params, `${at}.params`),
        absent: parseAbsentDimension(raw.absent, `${at}.absent`),
        agents: parseAgentsDimension(raw.agents, `${at}.agents`),
        when: parseWhenDimension(raw.when, `${at}.when`),
        argv: parseArgvDimension(raw.argv, `${at}.argv`),
        network: parseNetworkDimension(raw.network, `${at}.network`),
        branch: parseBranchDimension(raw.branch, `${at}.branch`),
        action,
        reason: reason === undefined ? `${action}` : reason,
        enabled: raw.enabled === undefined ? true : typeof raw.enabled === 'boolean' ? raw.enabled : (() => { throw new RuleError(`${at}.enabled must be a boolean`); })(),
    };
}
function compilePatternList(patterns, at, opts) {
    const stars = opts.maxGlobStars ?? 2;
    const ci = opts.caseInsensitivePaths ?? false;
    const desc = at.includes('paths');
    const list = [];
    for (const p of patterns) {
        list.push(compileGlob(p, { segments: desc, maxStars: stars }));
    }
    // Case-insensitive path patterns: recompile with `i`.
    if (ci && desc) {
        return list.map((c) => ({ source: c.source, re: new RegExp(c.re.source, 'ui') }));
    }
    return list;
}
/** Compile one command entry (`word` or `word#flag`). */
function compileCommand(entry, opts) {
    const hash = entry.lastIndexOf('#');
    let word;
    let flag;
    if (hash > 0 && hash < entry.length - 1) {
        word = entry.slice(0, hash);
        const f = entry.slice(hash + 1);
        if (f === 'recursive' || f === 'force')
            flag = f;
    }
    else {
        word = entry;
    }
    return { word: compileGlob(word, { segments: false, maxStars: opts.maxGlobStars ?? 2 }), flag };
}
/**
 * Compile the `branch` dimension (undefined = the rule does not constrain on it).
 *
 * Glob degree is bounded inside `compileBranchPattern` (DEFAULT_MAX_STARS), so
 * this takes no options: branch patterns are never path-segmented.
 */
function compileBranchDimension(dim) {
    if (dim === undefined)
        return undefined;
    return {
        target: (dim.target ?? []).map((p) => compileBranchPattern(p)),
        remote: (dim.remote ?? []).map((p) => compileBranchPattern(p)),
        shared: dim.shared === true,
    };
}
/**
 * Compile one parsed entry into a hot-path rule.
 *
 * Exported because the multi-file rule chain (`rule-chain.ts`) merges entries
 * from several documents into one ruleset and must produce the SAME shape here
 * — an entry built by hand would silently drop every compiled dimension, and an
 * empty dimension means "no constraint", i.e. "matches everything".
 */
export function compileRuleEntry(entry, action, index, opts = {}) {
    return {
        index,
        action,
        reason: entry.reason,
        enabled: entry.enabled,
        tools: compilePatternList(entry.tools, 'tools', opts),
        command: entry.command.map((c) => compileCommand(c, opts)),
        args: compilePatternList(entry.args, 'args', opts),
        paths: compilePatternList(entry.paths, 'paths', opts),
        params: entry.params,
        absent: entry.absent,
        agents: entry.agents,
        when: entry.when,
        argv: entry.argv,
        network: entry.network,
        branch: compileBranchDimension(entry.branch),
        source: entry,
    };
}
/** Compile a validated document into hot-path rules. */
export function compileDocument(doc, opts = {}) {
    const comp = (list, action, offset) => list.map((entry, i) => compileRuleEntry(entry, action, offset + i, opts));
    return {
        defaultAction: doc.defaultAction,
        deny: comp(doc.deny, 'deny', 0),
        allow: comp(doc.allow, 'allow', doc.deny.length),
        ask: comp(doc.ask, 'ask', doc.deny.length + doc.allow.length),
        caseInsensitivePaths: opts.caseInsensitivePaths ?? false,
    };
}
/** SHA-256 hash of the raw document (compile-cache key without recompiling). */
export function documentHash(text) {
    return hashText(text);
}
// Candidate extraction (shared by evaluate + path rules).
export function extractPathCandidates(args) {
    const out = [];
    const walk = (node, depth) => {
        if (depth > 8)
            return;
        if (Array.isArray(node)) {
            for (const e of node)
                walk(e, depth + 1);
            return;
        }
        if (!isRecord(node))
            return;
        for (const [k, v] of Object.entries(node)) {
            if (PATH_CANDIDATE_KEYS.includes(k)) {
                if (typeof v === 'string')
                    out.push(v);
                else if (Array.isArray(v))
                    for (const e of v)
                        if (typeof e === 'string')
                            out.push(e);
            }
            walk(v, depth + 1);
        }
    };
    walk(args, 0);
    return out;
}
export function extractUrlCandidates(args) {
    const out = [];
    const urlRe = /https?:\/\/[^\s"'<>)\]\\]+/g;
    const walk = (node, depth) => {
        if (depth > 8)
            return;
        if (Array.isArray(node)) {
            for (const e of node)
                walk(e, depth + 1);
            return;
        }
        if (!isRecord(node))
            return;
        for (const [k, v] of Object.entries(node)) {
            if (URL_CANDIDATE_KEYS.includes(k)) {
                if (typeof v === 'string')
                    out.push(v);
                else if (Array.isArray(v))
                    for (const e of v)
                        if (typeof e === 'string')
                            out.push(e);
            }
            if (COMMAND_CANDIDATE_KEYS.includes(k) && typeof v === 'string') {
                for (const m of v.matchAll(urlRe))
                    out.push(m[0]);
            }
            walk(v, depth + 1);
        }
    };
    walk(args, 0);
    return out;
}
