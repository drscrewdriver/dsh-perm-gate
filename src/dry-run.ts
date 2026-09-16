/**
 * Rule dry-run: evaluate one would-be tool call against a rules file and report
 * the verdict in a shape both the CLI and the settings-card "rule test" panel can
 * use.
 *
 * The evaluator itself lives in {@link PermGateRuntime}; this module only owns
 * the standalone construction (no session, no audit feed, no event log, no
 * persistence paths) and the reporting shape. Nothing here writes to disk or to
 * the live gate — the runtime it builds is thrown away when the call returns.
 *
 * Two verdicts are reported, and they are not the same thing:
 *
 * - `verdict` is the *effective* result of the whole chain the live gate runs
 *   (P0 hard-deny → P1 grant → P2 rules → P3 classifier → P4 ask), minus the
 *   session-scoped state a dry-run has none of. This is what the user sees.
 * - `ruleLayer` is what the `permissions` chain decides *on its own*. Only this
 *   layer can name a rule, so `ruleIndex` belongs to it. A P0 hard-deny or a
 *   preset deny-keyword fires before it and reports no index; when the two
 *   differ, that difference is the answer, not an error.
 */
import { resolve } from 'node:path'
import type { RuleAction } from './rule.js'
import { PermGateRuntime, type ToolExecutionLike } from './runtime.js'

/**
 * The eleven match dimensions, in the order `docs/rules-format.md` documents
 * them. Used purely for reporting which dimensions a matched rule constrains.
 */
const DIMENSION_KEYS = [
  'tools',
  'command',
  'args',
  'paths',
  'params',
  'absent',
  'agents',
  'when',
  'argv',
  'network',
  'branch',
] as const

export interface DryRunInput {
  /** Tool name to evaluate, e.g. `shell`, `read`, `write`. */
  readonly tool: string
  /** The tool call's arguments; `command` is what the shell dimensions read. */
  readonly args?: Record<string, unknown>
  /** Rules file to load. Unset = the default chain (cwd upward, then the data home). */
  readonly rulesFile?: string
  /** Working directory the call is evaluated in. Defaults to `process.cwd()`. */
  readonly cwd?: string
  /** Evaluate with the independent Permissive tier on. */
  readonly permissive?: boolean
  /**
   * Also run the **host-facing** decision path and report its own view.
   *
   * That path appends audit entries, records decision events, tracks asks and
   * clears call clearances — so it is opt-in, and a read-only caller must never
   * request it against a live runtime. Only the CLI asks for it, to keep its
   * historic output byte for byte.
   */
  readonly hostView?: boolean
}

/** The host-facing decision path's own view (`decideExecution`) and its audit count. */
export interface DryRunHostView {
  readonly verdict: RuleAction
  /** The waterfall's reason, or the historic `(default/passthrough)` placeholder. */
  readonly reason: string
  readonly audited: number
}

/** The P2 rule chain's own verdict, with the rule that produced it. */
export interface DryRunRuleLayer {
  readonly action: RuleAction
  readonly reason: string
  readonly ruleIndex?: number
  /**
   * The dimensions the matched rule *constrains* — not "the dimension that
   * caused the match". Dimensions are ANDed and an empty one is no constraint at
   * all, so a multi-dimension rule cannot be attributed to a single dimension
   * without lying about which one did the work.
   */
  readonly matchedDimensions: readonly string[]
  /** The raw rule entry as written in the YAML, for display. */
  readonly source?: Record<string, unknown>
}

export interface DryRunResult {
  readonly tool: string
  readonly rulesFile?: string
  /**
   * The **policy** verdict: what the chain decides for this call, independent of
   * the session a caller does not have. See {@link PermGateRuntime.explainCall}
   * for why the session layers are excluded rather than guessed.
   */
  readonly verdict: RuleAction
  /** Why, in the chain's own words — never a bare placeholder. */
  readonly reason: string
  /** Which layer produced `verdict`. */
  readonly source: string
  readonly defaultAction: RuleAction
  readonly ruleCount: number
  readonly permissive: boolean
  readonly ruleLayer: DryRunRuleLayer
  /** Present only when `input.hostView` was set. */
  readonly host?: DryRunHostView
}

export interface DryRunOptions {
  readonly rulesFile?: string
  readonly permissive?: boolean
  /**
   * Workspace root for the rule CHAIN resolution (cwd upward, then the data
   * home). `undefined` keeps the runtime default (`process.cwd()`).
   *
   * The CLI deliberately does not pass its `--cwd` here: that flag scopes the
   * evaluated call, and feeding it into chain resolution as well would change
   * what an existing `--cwd` invocation resolves. A host caller (the rule-test
   * route) does pass its session workspace, because for a live session "which
   * rules file applies" is exactly the question being asked.
   */
  readonly cwd?: string
}

/**
 * Build the standalone runtime a dry-run evaluates against. Exported because
 * `--list` needs the loaded ruleset without deciding anything.
 */
export function createDryRunRuntime(options: DryRunOptions = {}): PermGateRuntime {
  return new PermGateRuntime({
    rulesFile: options.rulesFile,
    cwd: options.cwd,
    caseInsensitivePaths: true,
    permissive: options.permissive || undefined,
  })
}

/** Which of the eleven dimensions this rule actually constrains. */
function constrainedDimensions(source: Record<string, unknown>): readonly string[] {
  return DIMENSION_KEYS.filter((key) => isConstrained(source[key]))
}

/**
 * A dimension constrains when it carries at least one condition. Every shape the
 * parser produces is covered: pattern lists, key→value maps, condition objects.
 */
function isConstrained(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  return true
}

/** Evaluate one call against a rules file and report the verdict. */
export function runDryRun(input: DryRunInput, runtime?: PermGateRuntime): DryRunResult {
  const rulesFile = input.rulesFile ? resolve(input.rulesFile) : undefined
  const gate = runtime ?? createDryRunRuntime({ rulesFile, permissive: input.permissive, cwd: input.cwd })
  const exec: ToolExecutionLike = {
    name: input.tool,
    arguments: input.args ?? {},
    cwd: input.cwd ? resolve(input.cwd) : process.cwd(),
  }

  // Pure policy first (the panel's answer); the side-effecting host view only
  // when explicitly asked for, and it must run last so its audit count is its own.
  const policy = gate.explainCall(exec)
  const layer = gate.explainRules(exec)
  const source = layer.rule?.source as Record<string, unknown> | undefined

  let host: DryRunHostView | undefined
  if (input.hostView === true) {
    const decision = gate.decideExecution(exec)
    host = {
      verdict: decision === undefined ? 'allow' : decision.kind,
      reason: decision?.reason ?? '(default/passthrough)',
      audited: gate.auditEntries.length,
    }
  }

  return {
    tool: input.tool,
    rulesFile,
    verdict: policy.action,
    reason: policy.reason,
    source: policy.source,
    defaultAction: layer.defaultAction,
    ruleCount: gate.ruleCount(),
    permissive: gate.permissive,
    ruleLayer: {
      action: layer.action,
      reason: layer.reason,
      ruleIndex: layer.ruleIndex,
      matchedDimensions: source === undefined ? [] : constrainedDimensions(source),
      source,
    },
    ...(host !== undefined ? { host } : {}),
  }
}
