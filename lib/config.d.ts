import z from '@deepseek-ai/schemastery';
import type { RuleAction } from './rule.js';
import { DEFAULT_GATE_PRESETS, resolveGatePresets } from './preset.js';
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
    /**
     * Whether to enable multi-file rule chain resolution. When true, the gate
     * searches up directory ancestors for the rules file. Default false.
     */
    readonly searchUp?: boolean;
    /** Fallback rules file path when no file is found in the chain search. */
    readonly fallbackPath?: string;
    /** Error policy for malformed files in the chain: `fail` (throw) or `warn` (skip). Default fail. */
    readonly badFilePolicy?: 'fail' | 'warn';
    /** Maximum number of files in the rule chain. Default 10. */
    readonly maxChainLength?: number;
    /**
     * Master network switch. **Default false** — the network proxy is an
     * opt-in capability, not part of the baseline gate.
     *
     * When false: no proxy is started, no environment variables are injected,
     * and no network interception occurs — zero behavior change from the
     * pre-network baseline.
     *
     * Enable it from the settings card only after verifying it in your
     * environment. The proxy binds a loopback port and rewrites proxy env
     * vars for subprocesses, so it must never be enabled implicitly.
     */
    readonly networkEnabled?: boolean;
    /** Network policy mode when auto-mapping from sandbox is not used. Default 'whitelist'. */
    readonly networkMode?: import('./network.js').NetworkMode;
    /** How unlisted targets are handled in whitelist mode.
     *
     * - `'deny'` — block outright, never prompt.
     * - `'ask'`  — raise an interactive approval for the attributed shell command;
     *              approve to let THIS target through for this session.
     *
     * A `deny` rule always wins: approval can widen reach for a target no rule
     * allows, but it can never override a rule that says no.
     */
    readonly networkUnlisted?: import('./network.js').UnlistedAction;
    /**
     * How traffic with **no shell attribution** is handled. Default `'allow'`.
     *
     * A connection that cannot be tied to an in-flight shell execution did not
     * come from a subprocess this gate manages — it is DSH's own client (a
     * built-in network tool, the LLM transport). The proxy is a *subprocess*
     * policy surface, so reviewing the host's own traffic risks the host
     * blocking itself, which is far worse than a missed block. `'deny'` reviews
     * it anyway, and would break DSH if a built-in client ever honors the proxy
     * environment (e.g. Node 24+ with `NODE_USE_ENV_PROXY=1`).
     */
    readonly networkUnattributed?: import('./network.js').UnattributedAction;
    /** Loopback handling: 'allow' short-circuits before rules; 'policy' evaluates normally. Default 'allow'. */
    readonly networkLoopback?: 'allow' | 'policy';
    /** Proxy bind address. Default '127.0.0.1'. */
    readonly networkBind?: string;
    /** Proxy bind port. Default 0 (ephemeral). */
    readonly networkPort?: number;
    /** NO_PROXY handling: 'clear' empties it so policy cannot be bypassed; 'preserve' keeps ambient values. Default 'clear'. */
    readonly networkNoProxy?: 'clear' | 'preserve';
    /**
     * Rewrite `HTTP(S)_PROXY` / `ALL_PROXY` for subprocesses so their traffic
     * reaches the proxy. Default true.
     *
     * Turn it off to run the proxy WITHOUT touching `process.env` — the
     * listener still adjudicates whatever is explicitly pointed at it, but no
     * ambient state is rewritten. Useful when the environment is managed
     * elsewhere or when verifying the proxy in isolation.
     */
    readonly networkInjectEnv?: boolean;
    /**
     * How long an unlisted-target approval waits for a human before failing
     * closed to a block (ms). Default 120000 (2 min).
     */
    readonly networkAskTimeoutMs?: number;
    /**
     * How long one approved network target stays approved for the session (ms).
     * One shell command routinely opens many connections to the same host, so
     * without this the human would be prompted once per connection.
     * Default 1800000 (30 min).
     */
    readonly networkGrantTtlMs?: number;
    /** Enable file watching for rule hot-reload. Default true. */
    readonly watch?: boolean;
    /** Debounce interval for rule file changes in ms. Default 300. */
    readonly watchDebounceMs?: number;
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
export { DEFAULT_GATE_PRESETS, resolveGatePresets };
/** Normalize a backend strategy bag to fully-specified booleans (backend-part combinable). */
export declare function resolvePermissiveStrategies(bag?: Partial<PermissiveStrategies>): PermissiveStrategies;
export declare const Config: z<PermGateConfig>;
export type ResolvedPermGateConfig = Required<Pick<PermGateConfig, 'caseInsensitivePaths' | 'grantTtlMs' | 'grantMaxUses' | 'permissive' | 'riskTimeoutMs' | 'riskLearning' | 'riskThreshold'>> & Pick<PermGateConfig, 'rulesFile' | 'dshHome' | 'defaultAction' | 'classifierEnabled' | 'classifierEndpoint' | 'classifierModel' | 'classifierApiKey' | 'learningFile' | 'eventsFile'> & {
    readonly permissiveStrategies: PermissiveStrategies;
    readonly gatePresets: readonly string[];
};
export declare function resolveConfig(config?: PermGateConfig): ResolvedPermGateConfig;
