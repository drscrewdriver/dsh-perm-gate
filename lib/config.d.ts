import z from '@deepseek-ai/schemastery';
import type { Volatile, VolatileSnapshot } from '@deepseek-ai/cosmokit';
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
export declare function ensureDataDir(dataDir: string): boolean;
/** Check whether the data directory exists without creating it. */
export declare function dataDirReady(dataDir: string): boolean;
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
    /**
     * YOLO — the switch behind the `permissive-yolo` tier, the model-backed human-free
     * implementation. It never raises a human confirmation: what the mechanical screen names
     * (irreversible, unlearnable, unreadable payload) is blocked and fed back to the main LLM
     * as a `工具审核意见` user message, and the residual goes to the review model, which
     * answers in the person's place — risky blocks, anything else runs.
     *
     * This is a per-tier switch, not a session-wide flow: it governs the `permissive-yolo`
     * preset and nothing else, so turning it off changes no other tier's behaviour. The tier
     * is the model-backed one by definition; with no reviewer in seat it still refuses to ask
     * a person (that is the promise), settles on the mechanical screen alone, and records that
     * the model never answered instead of letting the tier quietly become a different one.
     */
    readonly yolo?: boolean;
    /**
     * `safenet-pass` — the switch behind the `permissive-mech` tier: the deterministic
     * mechanical screen plus the preset opinions take over the ask. Named danger is blocked
     * and fed back to the main LLM, everything the nets cannot condemn runs. No human prompt
     * and **no model call at all** — the reviewed form of `approval: never`, and the tier for
     * a run with no reviewer LLM or where the tokens are not worth spending.
     */
    readonly safenetPass?: boolean;
    /**
     * `safenet-ask` — the switch behind the `permissive-snet` tier: the mechanical screen
     * still filters and lists its doubts, but the ask stays with a **person** and no grader is
     * consulted. The shape the gate takes when no reviewer LLM is connected and you would
     * rather answer than auto-run. Uncommon by design.
     */
    readonly safenetAsk?: boolean;
    /**
     * Degraded review — fall back to a **rule-only gate when there is no reviewer**.
     *
     * With `permissiveStrategies.llmAssist` on, an `ask` is normally graded by the
     * configured model, and every path that cannot grade it (no endpoint/model set up,
     * host `llm` absent, transport failure → `unresolved`) is fail-closed to a *human*
     * confirmation. In a headless or unattended run that is a stall: nobody answers.
     * This switch degrades those two no-reviewer paths to the deterministic nets only —
     * a cc-safety-net-class gate: danger the rules can name (irreversible / unlearnable /
     * opaque payload) is **blocked** and the reason is fed back to the main LLM, anything
     * else runs. It changes nothing while a reviewer *is* answering, and never softens a
     * deterministic deny. It applies to the ordinary 自动审查 tiers (`permissive`,
     * `permissive-full`); the three tiers that own an implementation (`yolo`, `safenetPass`,
     * `safenetAsk`) already say who answers and are not degraded by this switch.
     */
    readonly rulesFallback?: boolean;
    /**
     * **Retired** (2026-10-17) — the per-preset mode table (`<preset id>=<mode>`) that briefly
     * decided who answers an ask. Each human-free implementation now owns exactly one preset
     * and exactly one switch (`yolo` → `permissive-yolo`, `safenetPass` → `permissive-mech`,
     * `safenetAsk` → `permissive-snet`), which is what the table could not guarantee: entries
     * could name a preset outside the gate's scope, and a stored list could claim to steer
     * presets it never actually reached. The key stays in the schema **only** so a
     * profile written by those builds still parses; nothing reads it, and the settings card no
     * longer writes it. The replacement semantics live in `src/unattended.ts`.
     */
    readonly unattendedTiers?: string[];
    /**
     * Script review (default **on**) — when a call runs a script file (`bash x.sh`,
     * `pwsh -File x.ps1`, `python x.py`, `./deploy.sh`), read the file and attach its
     * body to the review: the risk grader and the human both judge the code that will
     * execute instead of a filename, and the deterministic nets grade the body too (a
     * script that wipes `$HOME` is irreversible whatever the command line says).
     *
     * Bounded (a few files, a fixed per-file budget) and redacted on the way out like
     * every other egress text. Turn it off to keep file contents off the configured
     * endpoint: the cost is that out-of-workspace and unreadable script runs go back to
     * being graded as unknowable (the `U` tier).
     */
    readonly scriptReview?: boolean;
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
     * Keywords **appended** to whichever blacklist is live (`denyKeywords` when set, the
     * preset otherwise) instead of replacing it. This is what to use to protect a
     * long-tail secret of your own — a company token prefix, a vault CLI subcommand —
     * without having to copy fifty preset entries into your profile and keep them current.
     */
    readonly denyKeywordsExtra?: string[];
    /**
     * Credential paths beyond the built-in store list (`.ssh`, `.aws`, `.npmrc`,
     * `credentials.yaml`, …), which P0 refuses to read from outside the workspace and
     * refuses to mutate through a file tool.
     *
     * Entries are path globs matched on the normalized path: `**` crosses directories, `*`
     * and `?` stay inside one; a plain entry is a path fragment (`vault/prod.env`,
     * `.myco_token`), and a `~/` prefix expands to the real home. Relative patterns also
     * match at any depth, so `secrets/*.env` covers `a/b/secrets/prod.env`.
     *
     * Why a setting and not a rule in `rules.yml`: a `read`/`grep` call is auto-allowed a
     * stage before the rule chain runs (the only layer that sees it first is P0), and the
     * tier of an entry must not be the author's choice — a declared secret gets what
     * `.ssh` gets, never a confirmation a model can talk its way out of.
     */
    readonly credentialPaths?: string[];
    /**
     * Argument keys to treat as **document bodies** in addition to the built-in list
     * (`content`, `text`, `plan`…): their values never enter the flattened text the
     * deny-keyword blacklist and the P0 credential pre-screen read.
     *
     * The point is the long tail of host tools whose prose keys nobody shipped a rule for
     * (`steps`, `notes`, `rationale`) — the shape of GitHub issue #2, where an unlisted
     * document key made a plan get refused for describing `rm -rf`. Additive only: the
     * built-in list cannot be replaced, because an omission would re-create that bug.
     */
    readonly extraContentArgKeys?: string[];
    /**
     * Argument keys to treat as **operations** even when the tool class says otherwise: the
     * field's text is read by the blacklist and the credential pre-screen, and this list
     * wins over `extraContentArgKeys` when both name the same key.
     *
     * For a workflow/skill-style tool whose body *is* executed code. Cost, stated: naming a
     * genuine document key here re-exposes the issue #2 failure — a plan or note that merely
     * mentions a destructive command will be refused for mentioning it.
     */
    readonly extraOperationArgKeys?: string[];
    /**
     * One-shot marker for the preset deny-table seed (`preset-rules.ts`, ported
     * from cc-safety-net): set once the `[deny-rule:*]` entries have been merged
     * into the live rules source. A full revocation (deleting every preset entry)
     * persists — the seed never re-adds them.
     */
    readonly presetRulesSeeded?: boolean;
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
    /**
     * Run gate-allowed shell commands inside a Windows AppContainer. The
     * container token carries NO network capability, so non-loopback egress is
     * denied by Windows Firewall (WFP) itself; the container SID is derived
     * deterministically so the loopback exemption is a one-time step. Default
     * false — enabling changes how allowed commands execute.
     */
    readonly sandboxEnabled?: boolean;
    /**
     * Filesystem posture inside the container: 'workspace-write' grants the
     * workspace Modify + temp FullControl; 'read-only' grants RX only.
     * System directories stay readable through the stock ALL APPLICATION
     * PACKAGES ACEs. Default 'workspace-write'.
     */
    readonly sandboxMode?: 'read-only' | 'workspace-write';
    /**
     * THE proxy parameter: the URL injected as HTTP(S)_PROXY / ALL_PROXY into
     * sandboxed processes. Empty (default) follows the builtin filtered proxy
     * (its actual bound 127.0.0.1 port) when networkEnabled; an explicit value
     * must be loopback-bound (the container cannot reach anything else) and the
     * destination filtering is that proxy's job. Neither set → no proxy env;
     * direct egress stays WFP-blocked either way.
     */
    readonly sandboxProxy?: string;
    /**
     * Attempt the one-time `CheckNetIsolation LoopbackExempt -a -p=<sid>` for
     * the container SID so sandboxed processes can reach 127.0.0.1 (the proxy
     * and the host webServer). Denied without elevation → warning with the
     * exact command; the sandbox still runs, only loopback stays closed.
     * Default 'exempt'.
     */
    readonly sandboxLoopback?: 'exempt' | 'off';
    /** @deprecated Rules now live in the `dsh-perm-gate-rules` settings namespace; file watching was removed. Accepted (ignored) for composition compatibility. */
    readonly watch?: boolean;
    /** @deprecated See {@link watch}. */
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
/**
 * One rule entry as stored in settings. Deliberately permissive (`z.any()`
 * fields): strict validation happens in `parseRuleEntry` at compile time (fail
 * loud), and the stored form must round-trip BOTH the raw YAML shape (string
 * scalars, `params` as a key→patterns mapping) and the parsed document shape
 * (parsed dimensions), so a file migration can be seeded without lossy
 * normalization. Schemastery preserves unknown keys in non-strict object mode.
 */
export declare const RuleEntrySchema: z<unknown>;
/**
 * The rules structure stored in the DSH settings namespace — the JSON form of
 * rules.yml. Unknown extra keys on the document itself are preserved too.
 */
export declare const RulesSchema: z<RulesConfig>;
/** One rule entry in the settings-stored rules document (JSON form; all optional). */
export interface RulesEntryConfig {
    readonly tools?: readonly string[];
    readonly command?: readonly string[];
    readonly args?: readonly string[];
    readonly paths?: readonly string[];
    readonly params?: unknown;
    readonly absent?: readonly string[];
    readonly agents?: readonly string[];
    readonly when?: unknown;
    readonly argv?: unknown;
    readonly network?: {
        readonly domains?: readonly string[];
        readonly ips?: readonly string[];
        readonly ports?: readonly string[];
        readonly schemes?: readonly string[];
    };
    readonly branch?: {
        readonly target?: readonly string[];
        readonly remote?: readonly string[];
        readonly shared?: boolean;
    };
    readonly reason?: string;
    readonly enabled?: boolean;
}
/**
 * The rules document stored in the settings namespace. The action lists are
 * `unknown[]` on purpose: entries may be the raw YAML shape or the parsed
 * document shape, and strict validation belongs to `parseRuleEntry` at compile
 * time — see {@link RulesEntryConfig} for the documented JSON form. (Mutable
 * arrays: the type doubles as the Schemastery input face of {@link RulesSchema},
 * which validates in place.)
 */
export interface RulesConfig {
    readonly defaultAction?: RuleAction;
    readonly deny?: unknown[];
    readonly allow?: unknown[];
    readonly ask?: unknown[];
    /** Activation-time seed marker (see RulesSchema). */
    readonly initialized?: boolean;
}
/** Settings namespace for rules (separate from the main perm-gate namespace). */
export declare const RULES_NAMESPACE = "dsh-perm-gate-rules";
/**
 * Whether a settings-sourced rules document carries a REAL configuration —
 * entries, a non-default `defaultAction`, or the `initialized` marker the
 * activation-time seed writes after populating an empty document. A namespace
 * still holding bare schema defaults is "not configured" and must not shadow
 * the rules file (the dual-source contract: settings first, file fallback).
 */
export declare function isRulesConfigured(value: unknown): boolean;
/**
 * Read the rules from a settings scope: the document when the namespace is
 * configured, otherwise `undefined` so the caller falls back to the rules file.
 */
export declare function readRulesFromSettings(scope: {
    get(): unknown;
} | undefined): RulesConfig | undefined;
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    rulesFile: z<string, string, "plain">;
    dshHome: z<string, string, "plain">;
    defaultAction: z<"allow" | "ask" | "deny", "allow" | "ask" | "deny", "defined">;
    caseInsensitivePaths: z<boolean, boolean, "defined">;
    classifierEnabled: z<boolean, boolean, "defined">;
    classifierEndpoint: z<string, string, "plain">;
    classifierModel: z<string, string, "defined">;
    classifierApiKey: z<string, string, "plain">;
    riskTimeoutMs: z<number, number, "defined">;
    riskLearning: z<boolean, boolean, "defined">;
    riskSediment: z<boolean, boolean, "defined">;
    classifierSource: z<"host" | "custom", "host" | "custom", "defined">;
    classifierProvider: z<string, string, "plain">;
    riskThreshold: z<number, number, "defined">;
    learningFile: z<string, string, "plain">;
    eventsFile: z<string, string, "plain">;
    grantTtlMs: z<number, number, "defined">;
    grantMaxUses: z<number, number, "defined">;
    permissive: z<boolean, boolean, "defined">;
    yolo: z<boolean, boolean, "defined">;
    rulesFallback: z<boolean, boolean, "defined">;
    /**
     * Retired (2026-10-17): the per-preset mode table that briefly mapped
     * `<preset id>=<mode>`. Each human-free implementation now owns exactly one preset and
     * exactly one switch (`yolo` / `safenetPass` / `safenetAsk`), so presets never cross and a
     * switch means what it says — whether that implementation exists. The key is kept in the
     * schema only so an older profile that stored it still parses.
     */
    unattendedTiers: z<string[], string[], "defined">;
    /** Switch: the `permissive-mech` implementation exists (mechanical takeover of asks). */
    safenetPass: z<boolean, boolean, "defined">;
    /** Switch: the `permissive-snet` implementation exists (mechanical screen, still asks). */
    safenetAsk: z<boolean, boolean, "defined">;
    scriptReview: z<boolean, boolean, "defined">;
    gatePresets: z<string[], string[], "plain">;
    permissiveStrategies: z<Schemastery.ObjectS<NoInfer<{
        trustAutoAllow: z<boolean, boolean, "defined">;
        alwaysConfirm: z<boolean, boolean, "defined">;
        llmAssist: z<boolean, boolean, "defined">;
        trustEscalation: z<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        trustAutoAllow: z<boolean, boolean, "defined">;
        alwaysConfirm: z<boolean, boolean, "defined">;
        llmAssist: z<boolean, boolean, "defined">;
        trustEscalation: z<boolean, boolean, "defined">;
    }>>, "plain">;
    allowlist: z<string[], string[], "plain">;
    denyKeywords: z<string[], string[], "plain">;
    denyKeywordsExtra: z<string[], string[], "defined">;
    credentialPaths: z<string[], string[], "defined">;
    extraContentArgKeys: z<string[], string[], "defined">;
    extraOperationArgKeys: z<string[], string[], "defined">;
    presetRulesSeeded: z<boolean, boolean, "defined">;
    autoAllowTools: z<string[], string[], "plain">;
    sessionSweep: z<boolean, boolean, "defined">;
    workspaceStoreFile: z<string, string, "plain">;
    searchUp: z<boolean, boolean, "defined">;
    fallbackPath: z<string, string, "plain">;
    badFilePolicy: z<"fail" | "warn", "fail" | "warn", "defined">;
    maxChainLength: z<number, number, "defined">;
    networkEnabled: z<boolean, boolean, "defined">;
    networkMode: z<"deny-all" | "whitelist" | "allow-all", "deny-all" | "whitelist" | "allow-all", "defined">;
    networkUnlisted: z<"ask" | "deny", "ask" | "deny", "defined">;
    networkUnattributed: z<"allow" | "deny", "allow" | "deny", "defined">;
    networkLoopback: z<"allow" | "policy", "allow" | "policy", "defined">;
    networkBind: z<string, string, "defined">;
    networkPort: z<number, number, "defined">;
    networkNoProxy: z<"clear" | "preserve", "clear" | "preserve", "defined">;
    networkInjectEnv: z<boolean, boolean, "defined">;
    networkAskTimeoutMs: z<number, number, "defined">;
    networkGrantTtlMs: z<number, number, "defined">;
    sandboxEnabled: z<boolean, boolean, "defined">;
    sandboxMode: z<"read-only" | "workspace-write", "read-only" | "workspace-write", "defined">;
    sandboxProxy: z<string, string, "defined">;
    sandboxLoopback: z<"exempt" | "off", "exempt" | "off", "defined">;
    rules: z<RulesConfig>;
    watch: z<boolean, boolean, "defined">;
    watchDebounceMs: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    rulesFile: z<string, string, "plain">;
    dshHome: z<string, string, "plain">;
    defaultAction: z<"allow" | "ask" | "deny", "allow" | "ask" | "deny", "defined">;
    caseInsensitivePaths: z<boolean, boolean, "defined">;
    classifierEnabled: z<boolean, boolean, "defined">;
    classifierEndpoint: z<string, string, "plain">;
    classifierModel: z<string, string, "defined">;
    classifierApiKey: z<string, string, "plain">;
    riskTimeoutMs: z<number, number, "defined">;
    riskLearning: z<boolean, boolean, "defined">;
    riskSediment: z<boolean, boolean, "defined">;
    classifierSource: z<"host" | "custom", "host" | "custom", "defined">;
    classifierProvider: z<string, string, "plain">;
    riskThreshold: z<number, number, "defined">;
    learningFile: z<string, string, "plain">;
    eventsFile: z<string, string, "plain">;
    grantTtlMs: z<number, number, "defined">;
    grantMaxUses: z<number, number, "defined">;
    permissive: z<boolean, boolean, "defined">;
    yolo: z<boolean, boolean, "defined">;
    rulesFallback: z<boolean, boolean, "defined">;
    /**
     * Retired (2026-10-17): the per-preset mode table that briefly mapped
     * `<preset id>=<mode>`. Each human-free implementation now owns exactly one preset and
     * exactly one switch (`yolo` / `safenetPass` / `safenetAsk`), so presets never cross and a
     * switch means what it says — whether that implementation exists. The key is kept in the
     * schema only so an older profile that stored it still parses.
     */
    unattendedTiers: z<string[], string[], "defined">;
    /** Switch: the `permissive-mech` implementation exists (mechanical takeover of asks). */
    safenetPass: z<boolean, boolean, "defined">;
    /** Switch: the `permissive-snet` implementation exists (mechanical screen, still asks). */
    safenetAsk: z<boolean, boolean, "defined">;
    scriptReview: z<boolean, boolean, "defined">;
    gatePresets: z<string[], string[], "plain">;
    permissiveStrategies: z<Schemastery.ObjectS<NoInfer<{
        trustAutoAllow: z<boolean, boolean, "defined">;
        alwaysConfirm: z<boolean, boolean, "defined">;
        llmAssist: z<boolean, boolean, "defined">;
        trustEscalation: z<boolean, boolean, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        trustAutoAllow: z<boolean, boolean, "defined">;
        alwaysConfirm: z<boolean, boolean, "defined">;
        llmAssist: z<boolean, boolean, "defined">;
        trustEscalation: z<boolean, boolean, "defined">;
    }>>, "plain">;
    allowlist: z<string[], string[], "plain">;
    denyKeywords: z<string[], string[], "plain">;
    denyKeywordsExtra: z<string[], string[], "defined">;
    credentialPaths: z<string[], string[], "defined">;
    extraContentArgKeys: z<string[], string[], "defined">;
    extraOperationArgKeys: z<string[], string[], "defined">;
    presetRulesSeeded: z<boolean, boolean, "defined">;
    autoAllowTools: z<string[], string[], "plain">;
    sessionSweep: z<boolean, boolean, "defined">;
    workspaceStoreFile: z<string, string, "plain">;
    searchUp: z<boolean, boolean, "defined">;
    fallbackPath: z<string, string, "plain">;
    badFilePolicy: z<"fail" | "warn", "fail" | "warn", "defined">;
    maxChainLength: z<number, number, "defined">;
    networkEnabled: z<boolean, boolean, "defined">;
    networkMode: z<"deny-all" | "whitelist" | "allow-all", "deny-all" | "whitelist" | "allow-all", "defined">;
    networkUnlisted: z<"ask" | "deny", "ask" | "deny", "defined">;
    networkUnattributed: z<"allow" | "deny", "allow" | "deny", "defined">;
    networkLoopback: z<"allow" | "policy", "allow" | "policy", "defined">;
    networkBind: z<string, string, "defined">;
    networkPort: z<number, number, "defined">;
    networkNoProxy: z<"clear" | "preserve", "clear" | "preserve", "defined">;
    networkInjectEnv: z<boolean, boolean, "defined">;
    networkAskTimeoutMs: z<number, number, "defined">;
    networkGrantTtlMs: z<number, number, "defined">;
    sandboxEnabled: z<boolean, boolean, "defined">;
    sandboxMode: z<"read-only" | "workspace-write", "read-only" | "workspace-write", "defined">;
    sandboxProxy: z<string, string, "defined">;
    sandboxLoopback: z<"exempt" | "off", "exempt" | "off", "defined">;
    rules: z<RulesConfig>;
    watch: z<boolean, boolean, "defined">;
    watchDebounceMs: z<number, number, "defined">;
}>>, "plain">;
/** Live reference the 0.1.7 loader hands `apply` for `.volatile()` config fields. */
export type VolatileRef<T> = Volatile<T>;
/** The config fields marked `.volatile()` — live refs inside `apply`'s config. */
export declare const VOLATILE_CONFIG_KEYS: readonly ["defaultAction", "caseInsensitivePaths", "classifierEnabled", "classifierEndpoint", "classifierModel", "classifierApiKey", "riskTimeoutMs", "riskLearning", "riskSediment", "classifierSource", "classifierProvider", "riskThreshold", "grantTtlMs", "grantMaxUses", "permissive", "yolo", "rulesFallback", "unattendedTiers", "safenetPass", "safenetAsk", "scriptReview", "permissiveStrategies", "allowlist", "denyKeywords", "denyKeywordsExtra", "credentialPaths", "extraContentArgKeys", "extraOperationArgKeys", "presetRulesSeeded", "autoAllowTools", "sessionSweep", "searchUp", "badFilePolicy", "maxChainLength", "networkEnabled", "networkMode", "networkUnlisted", "networkUnattributed", "networkLoopback", "networkBind", "networkPort", "networkNoProxy", "networkInjectEnv", "networkAskTimeoutMs", "networkGrantTtlMs", "rules", "sandboxEnabled", "sandboxMode", "sandboxProxy", "sandboxLoopback"];
/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
export declare function readVolatileValue<T>(value: T | Volatile<T> | undefined): VolatileSnapshot<T> | undefined;
/** Shallow-resolve every volatile field into a plain snapshot (one per read). */
export declare function resolveVolatileConfig(config: object): Record<string, unknown>;
export type ResolvedPermGateConfig = Required<Pick<PermGateConfig, 'caseInsensitivePaths' | 'grantTtlMs' | 'grantMaxUses' | 'permissive' | 'riskTimeoutMs' | 'riskLearning' | 'riskThreshold'>> & Pick<PermGateConfig, 'rulesFile' | 'dshHome' | 'defaultAction' | 'classifierEnabled' | 'classifierEndpoint' | 'classifierModel' | 'classifierApiKey' | 'learningFile' | 'eventsFile'> & {
    readonly permissiveStrategies: PermissiveStrategies;
    readonly gatePresets: readonly string[];
};
export declare function resolveConfig(config?: PermGateConfig): ResolvedPermGateConfig;
