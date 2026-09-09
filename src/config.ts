/**
 * Plugin configuration for dsh-perm-gate, defined with Schemastery so the DSH
 * loader validates and fills defaults before `apply`. Invalid values fail loud.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import type { RuleAction } from './rule.js'

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
}

/** Backend combinable approval strategies for the Permissive tier (all opt-in). */
export interface PermissiveStrategies {
  /** Trust-in-scope safe ops auto-allow; dangerous/in-scope-unknown ops ask. Baseline middle tier. */
  readonly trustAutoAllow: boolean
  /** Every crossing asks (no automatic allow outside a session grant / hard-deny context). */
  readonly alwaysConfirm: boolean
  /** LLM-assist classify first, human fallback on uncertainty or classifier failure. */
  readonly llmAssist: boolean
}

export const DEFAULT_PERMISSIVE_STRATEGIES: Readonly<PermissiveStrategies> = {
  trustAutoAllow: true,
  alwaysConfirm: false,
  llmAssist: false,
}

/**
 * Presets in which the gate is active. It owns the `permissive` tier; `'*'`
 * makes it global (every preset, including the hard-deny layer).
 */
export const DEFAULT_GATE_PRESETS: readonly string[] = ['permissive']

/** Normalize the gate scope: an unset/empty list means the default. */
export function resolveGatePresets(configured?: readonly string[]): readonly string[] {
  if (configured === undefined || configured.length === 0) return DEFAULT_GATE_PRESETS
  return configured.filter((name) => typeof name === 'string' && name !== '')
}

/** Normalize a backend strategy bag to fully-specified booleans (backend-part combinable). */
export function resolvePermissiveStrategies(bag: Partial<PermissiveStrategies> = {}): PermissiveStrategies {
  return {
    trustAutoAllow: bag.trustAutoAllow ?? DEFAULT_PERMISSIVE_STRATEGIES.trustAutoAllow,
    alwaysConfirm: bag.alwaysConfirm ?? DEFAULT_PERMISSIVE_STRATEGIES.alwaysConfirm,
    llmAssist: bag.llmAssist ?? DEFAULT_PERMISSIVE_STRATEGIES.llmAssist,
  }
}

export const Config: z<PermGateConfig> = z.object({
  rulesFile: z.string(),
  dshHome: z.string(),
  defaultAction: z.union(['allow', 'ask', 'deny'] as const).default('ask'),
  caseInsensitivePaths: z.boolean().default(true),
  classifierEnabled: z.boolean().default(false),
  classifierEndpoint: z.string(),
  classifierModel: z.string().default('deepseek-chat'),
  classifierApiKey: z.string(),
  riskTimeoutMs: z.number().min(1000).default(20_000),
  riskLearning: z.boolean().default(true),
  riskSediment: z.boolean().default(true),
  classifierSource: z.union(['custom', 'host'] as const).default('custom'),
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
  }),
  allowlist: z.array(z.string()),
  denyKeywords: z.array(z.string()),
  autoAllowTools: z.array(z.string()),
})

export type ResolvedPermGateConfig = Required<Pick<PermGateConfig, 'caseInsensitivePaths' | 'grantTtlMs' | 'grantMaxUses' | 'permissive' | 'riskTimeoutMs' | 'riskLearning' | 'riskThreshold'>>
  & Pick<PermGateConfig, 'rulesFile' | 'dshHome' | 'defaultAction' | 'classifierEnabled' | 'classifierEndpoint' | 'classifierModel' | 'classifierApiKey' | 'learningFile' | 'eventsFile'>
  & { readonly permissiveStrategies: PermissiveStrategies; readonly gatePresets: readonly string[] }

export function resolveConfig(config: PermGateConfig = {}): ResolvedPermGateConfig {
  const parsed = Config(config)
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