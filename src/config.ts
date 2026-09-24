/**
 * Plugin configuration for dsh-perm-gate, defined with Schemastery so the DSH
 * loader validates and fills defaults before `apply`. Invalid values fail loud.
 */
import { homedir } from 'node:os'
import { mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import type { Volatile, VolatileSnapshot } from '@deepseek-ai/cosmokit'
import type { RuleAction } from './rule.js'
import { DEFAULT_GATE_PRESETS, resolveGatePresets } from './preset.js'

/**
 * The DSH home directory: an explicit `dshHome`, else `$DSH_HOME`, else
 * `~/.dsh`. A profile entry that omits `config` must still get a writable data
 * home — otherwise the event feed, snapshots and learning store silently stay
 * disabled (no log, no review page).
 */
export function resolveDshHome(configured?: string): string {
  if (typeof configured === 'string' && configured !== '') return configured
  const env = process.env.DSH_HOME
  if (typeof env === 'string' && env !== '') return env
  return join(homedir(), '.dsh')
}

/** This plugin's data directory (`<dshHome>/perm-gate`), always defined. */
export function resolveDataDir(configured?: string): string {
  return join(resolveDshHome(configured), 'perm-gate')
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
let _dataDirReady = false
export function ensureDataDir(dataDir: string): boolean {
  if (_dataDirReady) return true
  try {
    mkdirSync(dataDir, { recursive: true })
    _dataDirReady = true
    return true
  } catch {
    return false
  }
}

/** Check whether the data directory exists without creating it. */
export function dataDirReady(dataDir: string): boolean {
  if (_dataDirReady) return true
  try {
    statSync(dataDir)
    _dataDirReady = true
    return true
  } catch {
    return false
  }
}

/**
 * The permissions document the gate loads. An explicit `rulesFile` wins; unset
 * falls back to `<dataDir>/rules.yml`, so a rules file the user drops in the
 * plugin's own data directory is loaded without also declaring the path in the
 * composition entry. A missing file still yields an empty ruleset (the gate then
 * applies `defaultAction`), so the fallback never fails the plugin load.
 */
export function resolveRulesFile(configured: string | undefined, dataDir: string): string {
  return typeof configured === 'string' && configured !== '' ? configured : join(dataDir, 'rules.yml')
}

export interface PermGateConfig {
  /** Absolute or `./`-relative path to the YAML permissions document. */
  readonly rulesFile?: string
  /** Absolute `$DSH_HOME` root (used for protected-target checks and root pinning). */
  readonly dshHome?: string
  /** Fallback action when no rule matches. Default `ask`. */
  readonly defaultAction?: RuleAction
  /** Compare path patterns case-insensitively (Windows default true). */
  readonly caseInsensitivePaths?: boolean
  /** Enable the optional LLM semantic classifier (P3). Default false. */
  readonly classifierEnabled?: boolean
  readonly classifierEndpoint?: string
  readonly classifierModel?: string
  readonly classifierApiKey?: string
  /** Abort the llmAssist risk call after this many milliseconds. Default 20000. */
  readonly riskTimeoutMs?: number
  /**
   * Verdict learning (llmAssist neutral-risk confirmations). When enabled,
   * neutral-risk asks that the human approves and that actually execute count
   * toward auto-allowing the exact same operation later. Default false.
   */
  readonly riskLearning?: boolean
  /** Learning sedimentation switch: threshold-reached samples become deterministic auto-allows. Default true (while learning is on). */
  readonly riskSediment?: boolean
  /** llmAssist receiver source: an OpenAI-compatible endpoint (`custom`) or the DSH host `llm` service (`host`). Default custom. */
  readonly classifierSource?: 'custom' | 'host'
  /** Optional provider override for the host receiver (empty = the session's current model group). */
  readonly classifierProvider?: string
  /** Confirmations required before a neutral-risk re-run may auto-allow. Default 3. */
  readonly riskThreshold?: number
  /** Persistence path for verdict learning; defaults to `<dshHome>/perm-gate/learning.json`. */
  readonly learningFile?: string
  /** Persistence path for the decision-event feed; defaults to `<dshHome>/perm-gate/events.jsonl`. */
  readonly eventsFile?: string
  readonly grantTtlMs?: number
  readonly grantMaxUses?: number
  /**
   * Permissive — an independent permission tier (a single front-facing switch).
   * When on, the gate routes crossings through the backend `permissiveStrategies`
   * below instead of the baseline P2/P4 path. It is NOT the Auto "auto-approval"
   * mode: it never mints blanket authority, stays fail-closed, and only ever
   * widens decision before the human/LLM seam.
   */
  readonly permissive?: boolean
  /** Backend approval strategies; combinable. Front-end exposes only `permissive` itself. */
  readonly permissiveStrategies?: Partial<PermissiveStrategies>
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
  readonly gatePresets?: string[]
  /**
   * Editable whitelist (allow-list command patterns), mirrored to the rules
   * file's `allow` section. Optional; edit from the settings card as a list.
   */
  readonly allowlist?: string[]
  /**
   * Editable deny-keyword blacklist (preset: dsh-approval-gate's inherited
   * `DEFAULT_DENY_KEYWORDS`). Unset applies the preset; an explicit array
   * (possibly empty) replaces it. Editable from the settings card as a list.
   */
  readonly denyKeywords?: string[]
  /**
   * Extra tool names classified as read-only/internal and therefore auto-allowed.
   *
   * The gate already auto-allows DSH's own read-only and session-local tools
   * (reads, searches, memory/goal/taskboard/job management, UI and todo state);
   * this list extends that classification for third-party read-only tools.
   * P0 hard-deny and the deny-keyword layer still run before it, so the list can
   * never widen authority for a destructive or credential-bearing call.
   */
  readonly autoAllowTools?: string[]
  /**
   * Session-lifecycle sweep: on startup and hourly, drop the authorization
   * chain's decision events and pre-change snapshots of sessions DSH has
   * archived or no longer tracks. Fail-open, best-effort. Default true.
   */
  readonly sessionSweep?: boolean
  /** Path to DSH's workspace store; defaults to `<dshHome>/storages/workspace.json`. Read-only to the gate. */
  readonly workspaceStoreFile?: string
  // ─── Rule chain (T1.9) ──────────────────────────────────────────────
  /**
   * Whether to enable multi-file rule chain resolution. When true, the gate
   * searches up directory ancestors for the rules file. Default false.
   */
  readonly searchUp?: boolean
  /** Fallback rules file path when no file is found in the chain search. */
  readonly fallbackPath?: string
  /** Error policy for malformed files in the chain: `fail` (throw) or `warn` (skip). Default fail. */
  readonly badFilePolicy?: 'fail' | 'warn'
  /** Maximum number of files in the rule chain. Default 10. */
  readonly maxChainLength?: number
  // ─── Network (Phase 2) ───────────────────────────────────────────────
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
  readonly networkEnabled?: boolean
  /** Network policy mode when auto-mapping from sandbox is not used. Default 'whitelist'. */
  readonly networkMode?: import('./network.js').NetworkMode
  /** How unlisted targets are handled in whitelist mode.
   *
   * - `'deny'` — block outright, never prompt.
   * - `'ask'`  — raise an interactive approval for the attributed shell command;
   *              approve to let THIS target through for this session.
   *
   * A `deny` rule always wins: approval can widen reach for a target no rule
   * allows, but it can never override a rule that says no.
   */
  readonly networkUnlisted?: import('./network.js').UnlistedAction
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
  readonly networkUnattributed?: import('./network.js').UnattributedAction
  /** Loopback handling: 'allow' short-circuits before rules; 'policy' evaluates normally. Default 'allow'. */
  readonly networkLoopback?: 'allow' | 'policy'
  /** Proxy bind address. Default '127.0.0.1'. */
  readonly networkBind?: string
  /** Proxy bind port. Default 0 (ephemeral). */
  readonly networkPort?: number
  /** NO_PROXY handling: 'clear' empties it so policy cannot be bypassed; 'preserve' keeps ambient values. Default 'clear'. */
  readonly networkNoProxy?: 'clear' | 'preserve'
  /**
   * Rewrite `HTTP(S)_PROXY` / `ALL_PROXY` for subprocesses so their traffic
   * reaches the proxy. Default true.
   *
   * Turn it off to run the proxy WITHOUT touching `process.env` — the
   * listener still adjudicates whatever is explicitly pointed at it, but no
   * ambient state is rewritten. Useful when the environment is managed
   * elsewhere or when verifying the proxy in isolation.
   */
  readonly networkInjectEnv?: boolean
  /**
   * How long an unlisted-target approval waits for a human before failing
   * closed to a block (ms). Default 120000 (2 min).
   */
  readonly networkAskTimeoutMs?: number
  /**
   * How long one approved network target stays approved for the session (ms).
   * One shell command routinely opens many connections to the same host, so
   * without this the human would be prompted once per connection.
   * Default 1800000 (30 min).
   */
  readonly networkGrantTtlMs?: number
  // ─── Hot reload (Phase 3) ──────────────────────────────────────────
  /** @deprecated Rules now live in the `dsh-perm-gate-rules` settings namespace; file watching was removed. Accepted (ignored) for composition compatibility. */
  readonly watch?: boolean
  /** @deprecated See {@link watch}. */
  readonly watchDebounceMs?: number
}

/** Backend combinable approval strategies for the Permissive tier (all opt-in). */
export interface PermissiveStrategies {
  /** Trust-in-scope safe ops auto-allow; dangerous/in-scope-unknown ops ask. Baseline middle tier. */
  readonly trustAutoAllow: boolean
  /** Every crossing asks (no automatic allow outside a session grant / hard-deny context). */
  readonly alwaysConfirm: boolean
  /** LLM-assist classify first, human fallback on uncertainty or classifier failure. */
  readonly llmAssist: boolean
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
  readonly trustEscalation: boolean
}

export const DEFAULT_PERMISSIVE_STRATEGIES: Readonly<PermissiveStrategies> = {
  trustAutoAllow: true,
  alwaysConfirm: false,
  llmAssist: false,
  // On inside the tier: the tier already owns the allow decision for the call, and
  // the classifier's hard categories (deletion / credential / remote / system /
  // bulk) — the escalation-worthy ones — auto-deny rather than allow.
  trustEscalation: true,
}

// The scope constants live in the dependency-free `preset` module (the browser
// half renders them); bound locally AND re-exported so every existing
// `./config.js` import keeps resolving.
export { DEFAULT_GATE_PRESETS, resolveGatePresets }

/** Normalize a backend strategy bag to fully-specified booleans (backend-part combinable). */
export function resolvePermissiveStrategies(bag: Partial<PermissiveStrategies> = {}): PermissiveStrategies {
  return {
    trustAutoAllow: bag.trustAutoAllow ?? DEFAULT_PERMISSIVE_STRATEGIES.trustAutoAllow,
    alwaysConfirm: bag.alwaysConfirm ?? DEFAULT_PERMISSIVE_STRATEGIES.alwaysConfirm,
    llmAssist: bag.llmAssist ?? DEFAULT_PERMISSIVE_STRATEGIES.llmAssist,
    trustEscalation: bag.trustEscalation ?? DEFAULT_PERMISSIVE_STRATEGIES.trustEscalation,
  }
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
export const RuleEntrySchema: z<unknown> = z.any()

/**
 * The rules structure stored in the DSH settings namespace — the JSON form of
 * rules.yml. Unknown extra keys on the document itself are preserved too.
 */
export const RulesSchema: z<RulesConfig> = z.object({
  defaultAction: z.union(['allow', 'ask', 'deny'] as const).default('ask'),
  deny: z.array(RuleEntrySchema).default([]),
  allow: z.array(RuleEntrySchema).default([]),
  ask: z.array(RuleEntrySchema).default([]),
})

/** One rule entry in the settings-stored rules document (JSON form; all optional). */
export interface RulesEntryConfig {
  readonly tools?: readonly string[]
  readonly command?: readonly string[]
  readonly args?: readonly string[]
  readonly paths?: readonly string[]
  readonly params?: unknown
  readonly absent?: readonly string[]
  readonly agents?: readonly string[]
  readonly when?: unknown
  readonly argv?: unknown
  readonly network?: { readonly domains?: readonly string[]; readonly ips?: readonly string[]; readonly ports?: readonly string[]; readonly schemes?: readonly string[] }
  readonly branch?: { readonly target?: readonly string[]; readonly remote?: readonly string[]; readonly shared?: boolean }
  readonly reason?: string
  readonly enabled?: boolean
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
  readonly defaultAction?: RuleAction
  readonly deny?: unknown[]
  readonly allow?: unknown[]
  readonly ask?: unknown[]
}

/** Settings namespace for rules (separate from the main perm-gate namespace). */
export const RULES_NAMESPACE = 'dsh-perm-gate-rules'

/**
 * Whether a settings-sourced rules document carries a REAL configuration —
 * entries or a non-default `defaultAction`. A namespace still holding bare
 * schema defaults is "not configured" and must not shadow the rules file
 * (the dual-source contract: settings first, file fallback).
 */
export function isRulesConfigured(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const doc = value as RulesConfig
  if (doc.defaultAction !== undefined && doc.defaultAction !== 'ask') return true
  for (const key of ['deny', 'allow', 'ask'] as const) {
    const list = doc[key]
    if (Array.isArray(list) && list.length > 0) return true
  }
  return false
}

/**
 * Read the rules from a settings scope: the document when the namespace is
 * configured, otherwise `undefined` so the caller falls back to the rules file.
 */
export function readRulesFromSettings(scope: { get(): unknown } | undefined): RulesConfig | undefined {
  const value = scope?.get()
  return isRulesConfigured(value) ? (value as RulesConfig) : undefined
}

export const Config = z.object({
  rulesFile: z.string(),
  dshHome: z.string(),
  defaultAction: z.union(['allow', 'ask', 'deny'] as const).default('ask').volatile(),
  caseInsensitivePaths: z.boolean().default(true).volatile(),
  classifierEnabled: z.boolean().default(false).volatile(),
  classifierEndpoint: z.string().volatile(),
  classifierModel: z.string().default('deepseek-chat').volatile(),
  classifierApiKey: z.string().volatile(),
  riskTimeoutMs: z.number().min(1000).default(20_000).volatile(),
  riskLearning: z.boolean().default(true).volatile(),
  riskSediment: z.boolean().default(true).volatile(),
  classifierSource: z.union(['custom', 'host'] as const).default('custom').volatile(),
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
  badFilePolicy: z.union(['fail', 'warn'] as const).default('fail').volatile(),
  maxChainLength: z.number().min(1).max(50).default(10).volatile(),
  // Network (Phase 2)
  networkEnabled: z.boolean().default(false).volatile(),
  networkMode: z.union(['deny-all', 'whitelist', 'allow-all'] as const).default('whitelist').volatile(),
  networkUnlisted: z.union(['ask', 'deny'] as const).default('ask').volatile(),
  networkUnattributed: z.union(['allow', 'deny'] as const).default('allow').volatile(),
  networkLoopback: z.union(['allow', 'policy'] as const).default('allow').volatile(),
  networkBind: z.string().default('127.0.0.1').volatile(),
  networkPort: z.number().min(0).max(65535).default(0).volatile(),
  networkNoProxy: z.union(['clear', 'preserve'] as const).default('clear').volatile(),
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
})

/** Live reference the 0.1.7 loader hands `apply` for `.volatile()` config fields. */
export type VolatileRef<T> = Volatile<T>

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
] as const

/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
export function readVolatileValue<T>(value: T | Volatile<T> | undefined): VolatileSnapshot<T> | undefined {
  if (value !== null && typeof value === 'object' && typeof (value as { get?: unknown }).get === 'function') {
    return (value as Volatile<T>).get()
  }
  return value as VolatileSnapshot<T> | undefined
}

/** Shallow-resolve every volatile field into a plain snapshot (one per read). */
export function resolveVolatileConfig(config: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(config as Record<string, unknown>) }
  for (const key of VOLATILE_CONFIG_KEYS) {
    const v = out[key]
    if (v !== null && typeof v === 'object' && typeof (v as { get?: unknown }).get === 'function') {
      out[key] = (v as Volatile<unknown>).get()
    }
  }
  return out
}

export type ResolvedPermGateConfig = Required<Pick<PermGateConfig, 'caseInsensitivePaths' | 'grantTtlMs' | 'grantMaxUses' | 'permissive' | 'riskTimeoutMs' | 'riskLearning' | 'riskThreshold'>>
  & Pick<PermGateConfig, 'rulesFile' | 'dshHome' | 'defaultAction' | 'classifierEnabled' | 'classifierEndpoint' | 'classifierModel' | 'classifierApiKey' | 'learningFile' | 'eventsFile'>
  & { readonly permissiveStrategies: PermissiveStrategies; readonly gatePresets: readonly string[] }

export function resolveConfig(config: PermGateConfig = {}): ResolvedPermGateConfig {
  // 0.1.7: the apply-time config carries live refs for `.volatile()` fields —
  // resolve them before validation; schemastery's own schema call also wraps
  // volatile fields into fresh refs, so resolve the output as well.
  const parsed = resolveVolatileConfig(
    Config(resolveVolatileConfig(config) as PermGateConfig),
  ) as unknown as PermGateConfig
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
  }
}