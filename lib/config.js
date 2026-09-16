/**
 * Plugin configuration for dsh-perm-gate, defined with Schemastery so the DSH
 * loader validates and fills defaults before `apply`. Invalid values fail loud.
 */
import { homedir } from 'node:os';
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
export const Config = z.object({
    rulesFile: z.string(),
    dshHome: z.string(),
    defaultAction: z.union(['allow', 'ask', 'deny']).default('ask'),
    caseInsensitivePaths: z.boolean().default(true),
    classifierEnabled: z.boolean().default(false),
    classifierEndpoint: z.string(),
    classifierModel: z.string().default('deepseek-chat'),
    classifierApiKey: z.string(),
    riskTimeoutMs: z.number().min(1000).default(20_000),
    riskLearning: z.boolean().default(true),
    riskSediment: z.boolean().default(true),
    classifierSource: z.union(['custom', 'host']).default('custom'),
    classifierProvider: z.string(),
    riskThreshold: z.number().min(1).max(10).default(1),
    learningFile: z.string(),
    eventsFile: z.string(),
    grantTtlMs: z.number().min(1).default(5 * 60_000),
    grantMaxUses: z.number().min(1).default(1),
    permissive: z.boolean().default(false),
    gatePresets: z.array(z.string()),
    permissiveStrategies: z.object({
        trustAutoAllow: z.boolean().default(true),
        alwaysConfirm: z.boolean().default(false),
        llmAssist: z.boolean().default(false),
        trustEscalation: z.boolean().default(true),
    }),
    allowlist: z.array(z.string()),
    denyKeywords: z.array(z.string()),
    autoAllowTools: z.array(z.string()),
    sessionSweep: z.boolean().default(true),
    workspaceStoreFile: z.string(),
    // Rule chain (T1.9)
    searchUp: z.boolean().default(false),
    fallbackPath: z.string(),
    badFilePolicy: z.union(['fail', 'warn']).default('fail'),
    maxChainLength: z.number().min(1).max(50).default(10),
    // Network (Phase 2)
    networkEnabled: z.boolean().default(false),
    networkMode: z.union(['deny-all', 'whitelist', 'allow-all']).default('whitelist'),
    networkUnlisted: z.union(['ask', 'deny']).default('ask'),
    networkUnattributed: z.union(['allow', 'deny']).default('allow'),
    networkLoopback: z.union(['allow', 'policy']).default('allow'),
    networkBind: z.string().default('127.0.0.1'),
    networkPort: z.number().min(0).max(65535).default(0),
    networkNoProxy: z.union(['clear', 'preserve']).default('clear'),
    networkInjectEnv: z.boolean().default(true),
    networkAskTimeoutMs: z.number().min(1000).max(600_000).default(120_000),
    networkGrantTtlMs: z.number().min(0).max(24 * 60 * 60_000).default(30 * 60_000),
    // Hot reload (Phase 3)
    watch: z.boolean().default(true),
    watchDebounceMs: z.number().min(50).max(5000).default(300),
});
export function resolveConfig(config = {}) {
    const parsed = Config(config);
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
