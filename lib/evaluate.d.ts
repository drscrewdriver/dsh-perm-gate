import { type CompiledRuleEntry, type CompiledRuleset, type RuleAction } from './rule.js';
import { type SimpleCommand } from './shell.js';
export interface ToolCallContext {
    readonly tool: string;
    readonly args: Record<string, unknown>;
    readonly commandText?: string;
    readonly cwd: string;
    /** Workspace root; used by the write-path override to decide inside vs outside. */
    readonly home?: string;
    /**
     * The real user directory (`os.homedir()`), used to expand a `~/` in a declared
     * credential path. Deliberately separate from `home`, which is the workspace root —
     * conflating them would expand `~/.myco/vault.token` into the project and protect
     * nothing at all.
     */
    readonly userHome?: string;
    readonly dshHome?: string;
    readonly caseInsensitive?: boolean;
    /**
     * User-declared credential paths (`credentialPaths` setting), raw as configured.
     * P0 compiles them; they extend the built-in store list for the two checks a read or
     * write call cannot route around. Absent means the built-ins alone.
     */
    readonly credentialPaths?: readonly string[];
    /** Agent identity candidates from session context. */
    readonly agentCandidates?: readonly string[];
    /** Network request info (for network dimension matching). */
    readonly network?: {
        readonly domain?: string;
        readonly ip?: string;
        readonly port?: number;
        readonly scheme?: string;
    };
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
/**
 * Executor names, re-exported for the rule layer's `tools` dimension and for
 * learning/appcontainer consumers. The list itself lives in `tool-names.ts` so the
 * "is this an executed command?" question has one answer in the codebase.
 */
export declare const SHELL_TOOLS: Set<string>;
/** Whether one compiled rule matches the given call context. */
export declare function ruleMatches(rule: CompiledRuleEntry, ctx: ToolCallContext, commands: readonly SimpleCommand[], pathCands: readonly string[], urlCands: readonly string[]): boolean;
/** Compute the deterministic first-match decision (P2 chain). */
export declare function decideRules(ruleset: CompiledRuleset, ctx: ToolCallContext): Decision;
