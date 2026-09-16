import z from '@deepseek-ai/schemastery';
import type { RuleAction } from './rule.js';
/**
 * The DSH home directory: an explicit `dshHome`, else `$DSH_HOME`, else
 * `~/.dsh`. A profile entry that omits `config` must still get a writable data
 * home — otherwise the event feed, snapshots and learning store silently stay
 * disabled (no log, no review page).
 */
export declare function resolveDshHome(configured?: string): string;
/** This plugin's data directory (`<dshHome>/perm-gate`), always defined. */
export declare function resolveDataDir(configured?: string): string;
/**
 * The permissions document the gate loads. An explicit `rulesFile` wins; unset
 * falls back to `<dataDir>/rules.yml`, so a rules file the user drops in the
 * plugin's own data directory is loaded without also declaring the path in the
 * composition entry. A missing file still yields an empty ruleset (the gate then
 * applies `defaultAction`), so the fallback never fails the plugin load.
 */
export declare function resolveRulesFile(configured: string | undefined, dataDir: string): string;
export interface PermGateConfig {
    /** Absolute or `./`-relative path to the YAML permissions document. */
    readonly rulesFile?: string;
    /** Absolute `$DSH_HOME` root (used for protected-target checks and root pinning). */
    readonly dshHome?: string;
    /** Fallback action when no rule matches. Default `ask`. */
    readonly defaultAction?: RuleAction;
    /** Compare path patterns case-insensitively (Windows default true). */
    readonly caseInsensitivePaths?: boolean;
    /** Enable the optional LLM semantic classifier (P3). Default false. */
    readonly classifierEnabled?: boolean;
    readonly classifierEndpoint?: string;
    readonly classifierModel?: string;
    readonly classifierApiKey?: string;
    /** Abort the llmAssist risk call after this many milliseconds. Default 20000. */
    readonly riskTimeoutMs?: number;
    /**
     * Verdict learning (llmAssist neutral-risk confirmations). When enabled,
     * neutral-risk asks that the human approves and that actually execute count
     * toward auto-allowing the exact same operation later. Default false.
     */
    readonly riskLearning?: boolean;
    /** Learning sedimentation switch: threshold-reached samples become deterministic auto-allows. Default true (while learning is on). */
    readonly riskSediment?: boolean;
    /** llmAssist receiver source: an OpenAI-compatible endpoint (`custom`) or the DSH host `llm` service (`host`). Default custom. */
    readonly classifierSource?: 'custom' | 'host';
    /** Optional provider override for the host receiver (empty = the session's current model group). */
    readonly classifierProvider?: string;
    /** Confirmations required before a neutral-risk re-run may auto-allow. Default 3. */
    readonly riskThreshold?: number;
    /** Persistence path for verdict learning; defaults to `<dshHome>/perm-gate/learning.json`. */
    readonly learningFile?: string;
    /** Persistence path for the decision-event feed; defaults to `<dshHome>/perm-gate/events.jsonl`. */
    readonly eventsFile?: string;
    readonly grantTtlMs?: number;
    readonly grantMaxUses?: number;
    /**
     * Permissive — an independent permission tier (a single front-facing switch).
     * When on, the gate routes crossings through the backend `permissiveStrategies`
     * below instead of the baseline P2/P4 path. It is NOT the Auto "auto-approval"
     * mode: it never mints blanket authority, stays fail-closed, and only ever
     * widens decision before the human/LLM seam.
     */
    readonly permissive?: boolean;
    /** Backend approval strategies; combinable. Front-end exposes only `permissive` itself. */
    readonly permissiveStrategies?: Partial<PermissiveStrategies>;
    /**
     * Session permission presets in which this gate is active at all.
     *
     * The gate owns an independent tier, so it must not overrule a tier the user
     * selected instead. Outside this scope the gate stands down completely — no
     * allow, no ask, no deny, no P0 hard-deny, no deny-keyword veto — and the
     * selected tier's own policy governs the call. That matters because
     * `danger-full-access` is defined as "full access without approval prompts":
     * there the DSH approval seam rejects every request before any answerer runs,
     * so a forwarded ask could only ever fail with `the user rejected tool ...`,
     * and a hard-deny would silently contradict the tier the user chose.
     *
     * Default `['permissive']` (the tier this plugin adds). `['*']` makes the gate
     * global again, including its hard-deny layer.
     */
    readonly gatePresets?: string[];
    /**
     * Editable whitelist (allow-list command patterns), mirrored to the rules
     * file's `allow` section. Optional; edit from the settings card as a list.
     */
    readonly allowlist?: string[];
    /**
     * Editable deny-keyword blacklist (preset: dsh-approval-gate's inherited
     * `DEFAULT_DENY_KEYWORDS`). Unset applies the preset; an explicit array
     * (possibly empty) replaces it. Editable from the settings card as a list.
     */
    readonly denyKeywords?: string[];
    /**
     * Extra tool names classified as read-only/internal and therefore auto-allowed.
     *
     * The gate already auto-allows DSH's own read-only and session-local tools
     * (reads, searches, memory/goal/taskboard/job management, UI and todo state);
     * this list extends that classification for third-party read-only tools.
     * P0 hard-deny and the deny-keyword layer still run before it, so the list can
     * never widen authority for a destructive or credential-bearing call.
     */
    readonly autoAllowTools?: string[];
    /**
     * Session-lifecycle sweep: on startup and hourly, drop the authorization
     * chain's decision events and pre-change snapshots of sessions DSH has
     * archived or no longer tracks. Fail-open, best-effort. Default true.
     */
    readonly sessionSweep?: boolean;
    /** Path to DSH's workspace store; defaults to `<dshHome>/storages/workspace.json`. Read-only to the gate. */
    readonly workspaceStoreFile?: string;
}
/** Backend combinable approval strategies for the Permissive tier (all opt-in). */
export interface PermissiveStrategies {
    /** Trust-in-scope safe ops auto-allow; dangerous/in-scope-unknown ops ask. Baseline middle tier. */
    readonly trustAutoAllow: boolean;
    /** Every crossing asks (no automatic allow outside a session grant / hard-deny context). */
    readonly alwaysConfirm: boolean;
    /** LLM-assist classify first, human fallback on uncertainty or classifier failure. */
    readonly llmAssist: boolean;
    /**
     * Answer a sandbox-escalation approval for a call the gate already cleared.
     *
     * The escalation ask is raised from inside the tool body (`ctx.approval.request`)
     * after `tools/pre-execute` has finished, so the gate's own allow never reaches
     * it: without this strategy, a call the gate auto-allowed still prompts the human
     * for the privilege widening. With it on, an `approval/request` whose reason is
     * `escalate sandbox to <mode>: …` and whose `callId` the gate positively cleared
     * is answered `allowed-once` here instead of being forwarded to the answerers.
     *
     * Only a call the gate *allowed* qualifies, the target must be a known sandbox
     * mode, and any unrecognized request still delegates to the human — fail-closed.
     * Turn it off to keep sandbox widening human-gated while other allows stay
     * automatic.
     */
    readonly trustEscalation: boolean;
}
export declare const DEFAULT_PERMISSIVE_STRATEGIES: Readonly<PermissiveStrategies>;
/**
 * Presets in which the gate is active. It owns the `permissive` tier; `'*'`
 * makes it global (every preset, including the hard-deny layer).
 */
export declare const DEFAULT_GATE_PRESETS: readonly string[];
/** Normalize the gate scope: an unset/empty list means the default. */
export declare function resolveGatePresets(configured?: readonly string[]): readonly string[];
/** Normalize a backend strategy bag to fully-specified booleans (backend-part combinable). */
export declare function resolvePermissiveStrategies(bag?: Partial<PermissiveStrategies>): PermissiveStrategies;
export declare const Config: z<PermGateConfig>;
export type ResolvedPermGateConfig = Required<Pick<PermGateConfig, 'caseInsensitivePaths' | 'grantTtlMs' | 'grantMaxUses' | 'permissive' | 'riskTimeoutMs' | 'riskLearning' | 'riskThreshold'>> & Pick<PermGateConfig, 'rulesFile' | 'dshHome' | 'defaultAction' | 'classifierEnabled' | 'classifierEndpoint' | 'classifierModel' | 'classifierApiKey' | 'learningFile' | 'eventsFile'> & {
    readonly permissiveStrategies: PermissiveStrategies;
    readonly gatePresets: readonly string[];
};
export declare function resolveConfig(config?: PermGateConfig): ResolvedPermGateConfig;
