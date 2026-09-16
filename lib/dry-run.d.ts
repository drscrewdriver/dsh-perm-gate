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
    /** Effective verdict of the full chain; `allow` also covers "no decision". */
    readonly verdict: RuleAction;
    readonly reason: string;
    /** Entries the decision wrote to the throwaway runtime's audit mirror (0 or 1). */
    readonly audited: number;
    readonly defaultAction: RuleAction;
    readonly ruleCount: number;
    readonly permissive: boolean;
    readonly ruleLayer: DryRunRuleLayer;
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
