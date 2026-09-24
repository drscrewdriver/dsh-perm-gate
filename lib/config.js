/**
 * Plugin configuration for dsh-perm-gate, defined with Schemastery so the DSH
 * loader validates and fills defaults before `apply`. Invalid values fail loud.
 */
import { homedir } from 'node:os';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import z from '@deepseek-ai/schemastery';
import { DEFAULT_GATE_PRESETS, resolveGatePresets } from './preset.js';
/**
 * The DSH home directory: an explicit `dshHome`, else `$DSH_HOME`, else
 * `~/.dsh`. A profile entry that omits `config` must still get a writable data
 * home — otherwise the event feed, snapshots and learning store silently stay
 * disabled (no log, no review page).
 */
export function resolveDshHome(configured) {
    if (typeof configured === 'string' && configured !== '')
        return configured;
    const env = process.env.DSH_HOME;
    if (typeof env === 'string' && env !== '')
        return env;
    return join(homedir(), '.dsh');
}
/** This plugin's data directory (`<dshHome>/perm-gate`), always defined. */
export function resolveDataDir(configured) {
    return join(resolveDshHome(configured), 'perm-gate');
}
/**
 * Lazily ensure the data directory exists. Safe to call repeatedly —
 * `mkdirSync({recursive:true})` is a no-op when the directory already
 * exists. Returns `true` if the directory is now available, `false`
 * if creation failed (caller should degrade to empty defaults).
 *
 * Used by every write path. Read paths should call `dataDirReady()`
 * instead to avoid creating the directory as a side effect of reading.
 */
let _dataDirReady = false;
export function ensureDataDir(dataDir) {
    if (_dataDirReady)
        return true;
    try {
        mkdirSync(dataDir, { recursive: true });
        _dataDirReady = true;
        return true;
    }
    catch {
        return false;
    }
}
/** Check whether the data directory exists without creating it. */
export function dataDirReady(dataDir) {
    if (_dataDirReady)
        return true;
    try {
        statSync(dataDir);
        _dataDirReady = true;
        return true;
    }
    catch {
        return false;
    }
}
/**
 * The permissions document the gate loads. An explicit `rulesFile` wins; unset
 * falls back to `<dataDir>/rules.yml`, so a rules file the user drops in the
 * plugin's own data directory is loaded without also declaring the path in the
 * composition entry. A missing file still yields an empty ruleset (the gate then
 * applies `defaultAction`), so the fallback never fails the plugin load.
 */
export function resolveRulesFile(configured, dataDir) {
    return typeof configured === 'string' && configured !== '' ? configured : join(dataDir, 'rules.yml');
}
export const DEFAULT_PERMISSIVE_STRATEGIES = {
    trustAutoAllow: true,
    alwaysConfirm: false,
    llmAssist: false,
    // On inside the tier: the tier already owns the allow decision for the call, and
    // the classifier's hard categories (deletion / credential / remote / system /
    // bulk) — the escalation-worthy ones — auto-deny rather than allow.
    trustEscalation: true,
};
// The scope constants live in the dependency-free `preset` module (the browser
// half renders them); bound locally AND re-exported so every existing
// `./config.js` import keeps resolving.
export { DEFAULT_GATE_PRESETS, resolveGatePresets };
/** Normalize a backend strategy bag to fully-specified booleans (backend-part combinable). */
export function resolvePermissiveStrategies(bag = {}) {
    return {
        trustAutoAllow: bag.trustAutoAllow ?? DEFAULT_PERMISSIVE_STRATEGIES.trustAutoAllow,
        alwaysConfirm: bag.alwaysConfirm ?? DEFAULT_PERMISSIVE_STRATEGIES.alwaysConfirm,
        llmAssist: bag.llmAssist ?? DEFAULT_PERMISSIVE_STRATEGIES.llmAssist,
        trustEscalation: bag.trustEscalation ?? DEFAULT_PERMISSIVE_STRATEGIES.trustEscalation,
    };
}
// ─── Rules Schema (for settings namespace) ──────────────────────────────────
// The JSON twin of the rules.yml permissions document, stored in its own DSH
// settings namespace so the gate loads without any file on disk.
/**
 * One rule entry as stored in settings. Deliberately permissive (`z.any()`
 * fields): strict validation happens in `parseRuleEntry` at compile time (fail
 * loud), and the stored form must round-trip BOTH the raw YAML shape (string
 * scalars, `params` as a key→patterns mapping) and the parsed document shape
 * (parsed dimensions), so a file migration can be seeded without lossy
 * normalization. Schemastery preserves unknown keys in non-strict object mode.
 */
export const RuleEntrySchema = z.any();
/**
 * The rules structure stored in the DSH settings namespace — the JSON form of
 * rules.yml. Unknown extra keys on the document itself are preserved too.
 */
export const RulesSchema = z.object({
    defaultAction: z.union(['allow', 'ask', 'deny']).default('ask'),
    deny: z.array(RuleEntrySchema).default([]),
    allow: z.array(RuleEntrySchema).default([]),
    ask: z.array(RuleEntrySchema).default([]),
});
/** Settings namespace for rules (separate from the main perm-gate namespace). */
export const RULES_NAMESPACE = 'dsh-perm-gate-rules';
/**
 * Whether a settings-sourced rules document carries a REAL configuration —
 * entries or a non-default `defaultAction`. A namespace still holding bare
 * schema defaults is "not configured" and must not shadow the rules file
 * (the dual-source contract: settings first, file fallback).
 */
export function isRulesConfigured(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const doc = value;
    if (doc.defaultAction !== undefined && doc.defaultAction !== 'ask')
        return true;
    for (const key of ['deny', 'allow', 'ask']) {
        const list = doc[key];
        if (Array.isArray(list) && list.length > 0)
            return true;
    }
    return false;
}
/**
 * Read the rules from a settings scope: the document when the namespace is
 * configured, otherwise `undefined` so the caller falls back to the rules file.
 */
export function readRulesFromSettings(scope) {
    const value = scope?.get();
    return isRulesConfigured(value) ? value : undefined;
}
export const Config = z.object({
    rulesFile: z.string(),
    dshHome: z.string(),
    defaultAction: z.union(['allow', 'ask', 'deny']).default('ask').volatile(),
    caseInsensitivePaths: z.boolean().default(true).volatile(),
    classifierEnabled: z.boolean().default(false).volatile(),
    classifierEndpoint: z.string().volatile(),
    classifierModel: z.string().default('deepseek-chat').volatile(),
    classifierApiKey: z.string().volatile(),
    riskTimeoutMs: z.number().min(1000).default(20_000).volatile(),
    riskLearning: z.boolean().default(true).volatile(),
    riskSediment: z.boolean().default(true).volatile(),
    classifierSource: z.union(['custom', 'host']).default('custom').volatile(),
    classifierProvider: z.string().volatile(),
    riskThreshold: z.number().min(1).max(10).default(1).volatile(),
    learningFile: z.string(),
    eventsFile: z.string(),
    grantTtlMs: z.number().min(1).default(5 * 60_000).volatile(),
    grantMaxUses: z.number().min(1).default(1).volatile(),
    permissive: z.boolean().default(false).volatile(),
    gatePresets: z.array(z.string()),
    permissiveStrategies: z.object({
        trustAutoAllow: z.boolean().default(true),
        alwaysConfirm: z.boolean().default(false),
        llmAssist: z.boolean().default(false),
        trustEscalation: z.boolean().default(true),
    }).volatile(),
    allowlist: z.array(z.string()).volatile(),
    denyKeywords: z.array(z.string()).volatile(),
    autoAllowTools: z.array(z.string()).volatile(),
    sessionSweep: z.boolean().default(true).volatile(),
    workspaceStoreFile: z.string(),
    // Rule chain (T1.9)
    searchUp: z.boolean().default(false).volatile(),
    fallbackPath: z.string(),
    badFilePolicy: z.union(['fail', 'warn']).default('fail').volatile(),
    maxChainLength: z.number().min(1).max(50).default(10).volatile(),
    // Network (Phase 2)
    networkEnabled: z.boolean().default(false).volatile(),
    networkMode: z.union(['deny-all', 'whitelist', 'allow-all']).default('whitelist').volatile(),
    networkUnlisted: z.union(['ask', 'deny']).default('ask').volatile(),
    networkUnattributed: z.union(['allow', 'deny']).default('allow').volatile(),
    networkLoopback: z.union(['allow', 'policy']).default('allow').volatile(),
    networkBind: z.string().default('127.0.0.1').volatile(),
    networkPort: z.number().min(0).max(65535).default(0).volatile(),
    networkNoProxy: z.union(['clear', 'preserve']).default('clear').volatile(),
    networkInjectEnv: z.boolean().default(true).volatile(),
    networkAskTimeoutMs: z.number().min(1000).max(600_000).default(120_000).volatile(),
    networkGrantTtlMs: z.number().min(0).max(24 * 60 * 60_000).default(30 * 60_000).volatile(),
    // 0.1.7: the rules document lives on this entry as a volatile whole-object
    // field (a second settings namespace is no longer projectable). Unconfigured
    // (bare defaults) -> the rules file remains the source.
    rules: RulesSchema.volatile(),
    // Hot reload (Phase 3)
    watch: z.boolean().default(false),
    watchDebounceMs: z.number().min(50).max(5000).default(300),
});
/** The config fields marked `.volatile()` — live refs inside `apply`'s config. */
export const VOLATILE_CONFIG_KEYS = [
    'defaultAction', 'caseInsensitivePaths', 'classifierEnabled', 'classifierEndpoint',
    'classifierModel', 'classifierApiKey', 'riskTimeoutMs', 'riskLearning', 'riskSediment',
    'classifierSource', 'classifierProvider', 'riskThreshold', 'grantTtlMs', 'grantMaxUses',
    'permissive', 'permissiveStrategies', 'allowlist', 'denyKeywords', 'autoAllowTools',
    'sessionSweep', 'searchUp', 'badFilePolicy', 'maxChainLength',
    'networkEnabled', 'networkMode', 'networkUnlisted', 'networkUnattributed', 'networkLoopback',
    'networkBind', 'networkPort', 'networkNoProxy', 'networkInjectEnv', 'networkAskTimeoutMs',
    'networkGrantTtlMs', 'rules',
];
/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
export function readVolatileValue(value) {
    if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
        return value.get();
    }
    return value;
}
/** Shallow-resolve every volatile field into a plain snapshot (one per read). */
export function resolveVolatileConfig(config) {
    const out = { ...config };
    for (const key of VOLATILE_CONFIG_KEYS) {
        const v = out[key];
        if (v !== null && typeof v === 'object' && typeof v.get === 'function') {
            out[key] = v.get();
        }
    }
    return out;
}
export function resolveConfig(config = {}) {
    // 0.1.7: the apply-time config carries live refs for `.volatile()` fields —
    // resolve them before validation; schemastery's own schema call also wraps
    // volatile fields into fresh refs, so resolve the output as well.
    const parsed = resolveVolatileConfig(Config(resolveVolatileConfig(config)));
    return {
        rulesFile: parsed.rulesFile,
        dshHome: parsed.dshHome,
        defaultAction: parsed.defaultAction,
        caseInsensitivePaths: parsed.caseInsensitivePaths ?? true,
        classifierEnabled: parsed.classifierEnabled ?? false,
        classifierEndpoint: parsed.classifierEndpoint,
        classifierModel: parsed.classifierModel ?? 'deepseek-chat',
        classifierApiKey: parsed.classifierApiKey,
        riskTimeoutMs: parsed.riskTimeoutMs ?? 20_000,
        riskLearning: parsed.riskLearning ?? false,
        riskThreshold: parsed.riskThreshold ?? 3,
        learningFile: parsed.learningFile,
        eventsFile: parsed.eventsFile,
        grantTtlMs: parsed.grantTtlMs ?? 5 * 60_000,
        grantMaxUses: parsed.grantMaxUses ?? 1,
        permissive: parsed.permissive ?? false,
        gatePresets: resolveGatePresets(parsed.gatePresets),
        permissiveStrategies: resolvePermissiveStrategies(parsed.permissiveStrategies),
    };
}
