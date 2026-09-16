import { type CompiledRuleEntry, type CompiledRuleset, type RuleAction } from './rule.js';
import { type SimpleCommand } from './shell.js';
export interface ToolCallContext {
    readonly tool: string;
    readonly args: Record<string, unknown>;
    readonly commandText?: string;
    readonly cwd: string;
    /** Workspace root; used by the write-path override to decide inside vs outside. */
    readonly home?: string;
    readonly dshHome?: string;
    readonly caseInsensitive?: boolean;
}
export interface Decision {
    readonly action: RuleAction;
    readonly reason: string;
    readonly ruleIndex: number | undefined;
}
/**
 * Tool names that execute a shell command string. `shell` and `terminal` are
 * DSH's own names (the shipped tool roster uses `shell`; `terminal` is the
 * interactive variant), and `pwsh` / `bash` / `sh` / `cmd` / `powershell` cover
 * the platform-specific aliases. Missing `shell` here silently disables the
 * command-content inspection below for the primary tool — every `git push`,
 * `chmod`, redirect and `tee` would fall through to `defaultAction`.
 */
export declare const SHELL_TOOLS: Set<string>;
/** Whether one compiled rule matches the given call context. */
export declare function ruleMatches(rule: CompiledRuleEntry, ctx: ToolCallContext, commands: readonly SimpleCommand[], pathCands: readonly string[], urlCands: readonly string[]): boolean;
/** Compute the deterministic first-match decision (P2 chain). */
export declare function decideRules(ruleset: CompiledRuleset, ctx: ToolCallContext): Decision;
