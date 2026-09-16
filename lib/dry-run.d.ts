import type { RuleAction } from './rule.js';
import { PermGateRuntime } from './runtime.js';
export interface DryRunInput {
    /** Tool name to evaluate, e.g. `shell`, `read`, `write`. */
    readonly tool: string;
    /** The tool call's arguments; `command` is what the shell dimensions read. */
    readonly args?: Record<string, unknown>;
    /** Rules file to load. Unset = the default chain (cwd upward, then the data home). */
    readonly rulesFile?: string;
    /** Working directory the call is evaluated in. Defaults to `process.cwd()`. */
    readonly cwd?: string;
    /** Evaluate with the independent Permissive tier on. */
    readonly permissive?: boolean;
    /**
     * Also run the **host-facing** decision path and report its own view.
     *
     * That path appends audit entries, records decision events, tracks asks and
     * clears call clearances — so it is opt-in, and a read-only caller must never
     * request it against a live runtime. Only the CLI asks for it, to keep its
     * historic output byte for byte.
     */
    readonly hostView?: boolean;
}
/** The host-facing decision path's own view (`decideExecution`) and its audit count. */
export interface DryRunHostView {
    readonly verdict: RuleAction;
    /** The waterfall's reason, or the historic `(default/passthrough)` placeholder. */
    readonly reason: string;
    readonly audited: number;
}
/** The P2 rule chain's own verdict, with the rule that produced it. */
export interface DryRunRuleLayer {
    readonly action: RuleAction;
    readonly reason: string;
    readonly ruleIndex?: number;
    /**
     * The dimensions the matched rule *constrains* — not "the dimension that
     * caused the match". Dimensions are ANDed and an empty one is no constraint at
     * all, so a multi-dimension rule cannot be attributed to a single dimension
     * without lying about which one did the work.
     */
    readonly matchedDimensions: readonly string[];
    /** The raw rule entry as written in the YAML, for display. */
    readonly source?: Record<string, unknown>;
}
export interface DryRunResult {
    readonly tool: string;
    readonly rulesFile?: string;
    /**
     * The **policy** verdict: what the chain decides for this call, independent of
     * the session a caller does not have. See {@link PermGateRuntime.explainCall}
     * for why the session layers are excluded rather than guessed.
     */
    readonly verdict: RuleAction;
    /** Why, in the chain's own words — never a bare placeholder. */
    readonly reason: string;
    /** Which layer produced `verdict`. */
    readonly source: string;
    readonly defaultAction: RuleAction;
    readonly ruleCount: number;
    readonly permissive: boolean;
    readonly ruleLayer: DryRunRuleLayer;
    /** Present only when `input.hostView` was set. */
    readonly host?: DryRunHostView;
}
export interface DryRunOptions {
    readonly rulesFile?: string;
    readonly permissive?: boolean;
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
    readonly cwd?: string;
}
/**
 * Build the standalone runtime a dry-run evaluates against. Exported because
 * `--list` needs the loaded ruleset without deciding anything.
 */
export declare function createDryRunRuntime(options?: DryRunOptions): PermGateRuntime;
/** Evaluate one call against a rules file and report the verdict. */
export declare function runDryRun(input: DryRunInput, runtime?: PermGateRuntime): DryRunResult;
