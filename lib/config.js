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
    // Activation-time seed marker: the gate writes `true` the first time it
    // populates an empty document (file migration or bare starter), so the
    // seeded namespace becomes the rules source instead of shadowing nothing.
    initialized: z.boolean().default(false),
});
/** Settings namespace for rules (separate from the main perm-gate namespace). */
export const RULES_NAMESPACE = 'dsh-perm-gate-rules';
/**
 * Whether a settings-sourced rules document carries a REAL configuration —
 * entries, a non-default `defaultAction`, or the `initialized` marker the
 * activation-time seed writes after populating an empty document. A namespace
 * still holding bare schema defaults is "not configured" and must not shadow
 * the rules file (the dual-source contract: settings first, file fallback).
 */
export function isRulesConfigured(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const doc = value;
    if (doc.initialized === true)
        return true;
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
/**
 * Feature guard for `Schema…volatile()`.
 *
 * `.volatile()` is not guaranteed to exist on the schemastery copy this plugin
 * resolves at runtime. Every node below used to chain it unguarded **inside the
 * module body**, so a missing method throws while `Config` is being built: the
 * plugin fails to load at all (`engines.dsh` declares support for all 15 host
 * lines, so that is a hard load-failure, not a degradation).
 *
 * Probing per node keeps the plain schema node instead. The read side already
 * tolerates that — `readVolatileValue` / `resolveVolatileConfig` treat a value
 * without `get()` as the frozen snapshot — so every switch still works, and only
 * hot reload of a changed value is lost (it then needs a restart).
 *
 * Do **not** “fix” this by adding `volatile` to schemastery's prototype: the
 * profile uses a hoisted flat layout, so that single copy is shared by every
 * plugin in the profile (14 of them declare schemastery themselves) — a
 * prototype write here would silently change their behaviour too.
 */
function vol(node) {
    const maybe = node;
    return typeof maybe.volatile === 'function' ? maybe.volatile() : node;
}
export const Config = z.object({
    rulesFile: z.string(),
    dshHome: z.string(),
    defaultAction: vol(z.union(['allow', 'ask', 'deny']).default('ask')),
    caseInsensitivePaths: vol(z.boolean().default(true)),
    classifierEnabled: vol(z.boolean().default(false)),
    classifierEndpoint: vol(z.string()),
    classifierModel: vol(z.string().default('deepseek-chat')),
    classifierApiKey: vol(z.string()),
    riskTimeoutMs: vol(z.number().min(1000).default(20_000)),
    riskLearning: vol(z.boolean().default(true)),
    riskSediment: vol(z.boolean().default(true)),
    classifierSource: vol(z.union(['custom', 'host']).default('custom')),
    classifierProvider: vol(z.string()),
    riskThreshold: vol(z.number().min(1).max(10).default(1)),
    learningFile: z.string(),
    eventsFile: z.string(),
    grantTtlMs: vol(z.number().min(1).default(5 * 60_000)),
    grantMaxUses: vol(z.number().min(1).default(1)),
    permissive: vol(z.boolean().default(false)),
    yolo: vol(z.boolean().default(false)),
    rulesFallback: vol(z.boolean().default(false)),
    scriptReview: vol(z.boolean().default(true)),
    gatePresets: z.array(z.string()),
    permissiveStrategies: vol(z.object({
        trustAutoAllow: z.boolean().default(true),
        alwaysConfirm: z.boolean().default(false),
        llmAssist: z.boolean().default(false),
        trustEscalation: z.boolean().default(true),
    })),
    allowlist: vol(z.array(z.string())),
    denyKeywords: vol(z.array(z.string())),
    denyKeywordsExtra: vol(z.array(z.string()).default([])),
    credentialPaths: vol(z.array(z.string()).default([])),
    extraContentArgKeys: vol(z.array(z.string()).default([])),
    extraOperationArgKeys: vol(z.array(z.string()).default([])),
    presetRulesSeeded: vol(z.boolean().default(false)),
    autoAllowTools: vol(z.array(z.string())),
    sessionSweep: vol(z.boolean().default(true)),
    workspaceStoreFile: z.string(),
    // Rule chain (T1.9)
    searchUp: vol(z.boolean().default(false)),
    fallbackPath: z.string(),
    badFilePolicy: vol(z.union(['fail', 'warn']).default('fail')),
    maxChainLength: vol(z.number().min(1).max(50).default(10)),
    // Network (Phase 2)
    networkEnabled: vol(z.boolean().default(false)),
    networkMode: vol(z.union(['deny-all', 'whitelist', 'allow-all']).default('whitelist')),
    networkUnlisted: vol(z.union(['ask', 'deny']).default('ask')),
    networkUnattributed: vol(z.union(['allow', 'deny']).default('allow')),
    networkLoopback: vol(z.union(['allow', 'policy']).default('allow')),
    networkBind: vol(z.string().default('127.0.0.1')),
    networkPort: vol(z.number().min(0).max(65535).default(0)),
    networkNoProxy: vol(z.union(['clear', 'preserve']).default('clear')),
    networkInjectEnv: vol(z.boolean().default(true)),
    networkAskTimeoutMs: vol(z.number().min(1000).max(600_000).default(120_000)),
    networkGrantTtlMs: vol(z.number().min(0).max(24 * 60 * 60_000).default(30 * 60_000)),
    // AppContainer sandbox (Windows; goal 2)
    sandboxEnabled: vol(z.boolean().default(false)),
    sandboxMode: vol(z.union(['read-only', 'workspace-write']).default('workspace-write')),
    sandboxProxy: vol(z.string().default('')),
    sandboxLoopback: vol(z.union(['exempt', 'off']).default('exempt')),
    // 0.1.7: the rules document lives on this entry as a volatile whole-object
    // field (a second settings namespace is no longer projectable). Unconfigured
    // (bare defaults) -> the rules file remains the source.
    rules: vol(RulesSchema),
    // Hot reload (Phase 3)
    watch: z.boolean().default(false),
    watchDebounceMs: z.number().min(50).max(5000).default(300),
});
/** The config fields marked `.volatile()` — live refs inside `apply`'s config. */
export const VOLATILE_CONFIG_KEYS = [
    'defaultAction', 'caseInsensitivePaths', 'classifierEnabled', 'classifierEndpoint',
    'classifierModel', 'classifierApiKey', 'riskTimeoutMs', 'riskLearning', 'riskSediment',
    'classifierSource', 'classifierProvider', 'riskThreshold', 'grantTtlMs', 'grantMaxUses',
    'permissive', 'yolo', 'rulesFallback', 'scriptReview', 'permissiveStrategies', 'allowlist', 'denyKeywords', 'denyKeywordsExtra', 'credentialPaths', 'extraContentArgKeys', 'extraOperationArgKeys', 'presetRulesSeeded', 'autoAllowTools',
    'sessionSweep', 'searchUp', 'badFilePolicy', 'maxChainLength',
    'networkEnabled', 'networkMode', 'networkUnlisted', 'networkUnattributed', 'networkLoopback',
    'networkBind', 'networkPort', 'networkNoProxy', 'networkInjectEnv', 'networkAskTimeoutMs',
    'networkGrantTtlMs', 'rules',
    'sandboxEnabled', 'sandboxMode', 'sandboxProxy', 'sandboxLoopback',
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
