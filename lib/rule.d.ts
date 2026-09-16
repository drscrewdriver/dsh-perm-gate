import { type CompiledPattern } from './compiler.js';
import { type ParamsDimension, type AbsentDimension, type AgentsDimension, type WhenDimension, type ArgvDimension, type NetworkDimension } from './rule-dims.js';
export type RuleAction = 'allow' | 'ask' | 'deny';
/** A parsed, shape-validated permissions document (patterns not yet compiled). */
export interface PermissionsDoc {
    readonly defaultAction: RuleAction;
    readonly deny: RuleEntryDoc[];
    readonly allow: RuleEntryDoc[];
    readonly ask: RuleEntryDoc[];
}
/** One parsed rule: match dimensions plus the action, reason, and metadata. */
export interface RuleEntryDoc {
    /** Tool-name globs; empty = every tool. */
    readonly tools: string[];
    /**
     * Shell command-word patterns. An entry `word` or `word#flag` where flag is
     * `recursive`/`force`. Empty = this rule does not constrain on command.
     */
    readonly command: string[];
    /** Argument/value token globs (file paths, urls, command args); empty = no constraint. */
    readonly args: string[];
    /** Workspace-relative path globs; empty = no constraint. */
    readonly paths: string[];
    /** Parameter key→value matching (AND over keys, `!` prefix negates). */
    readonly params: ParamsDimension;
    /** Parameter keys that must NOT be present. */
    readonly absent: AbsentDimension;
    /** Agent identity candidates (main / subagent / preset:<name>). */
    readonly agents: AgentsDimension;
    /** Environment / platform conditions. */
    readonly when: WhenDimension | undefined;
    /** Extra argv patterns (pipeline etc.). */
    readonly argv: ArgvDimension | undefined;
    /** Network dimension (domain / IP / port / scheme). */
    readonly network: NetworkDimension | undefined;
    readonly action: RuleAction;
    readonly reason: string;
    readonly enabled: boolean;
}
export interface CompiledRuleEntry {
    readonly index: number;
    readonly action: RuleAction;
    readonly reason: string;
    readonly enabled: boolean;
    readonly tools: readonly CompiledPattern[];
    /** Command specs: { word glob, flag? }. */
    readonly command: readonly CommandSpec[];
    readonly args: readonly CompiledPattern[];
    readonly paths: readonly CompiledPattern[];
    /** Parsed params dimension (raw patterns; compiled on match). */
    readonly params: ParamsDimension;
    /** Parsed absent dimension (raw key names). */
    readonly absent: AbsentDimension;
    /** Parsed agents dimension (raw patterns). */
    readonly agents: AgentsDimension;
    /** Parsed when dimension (raw conditions). */
    readonly when: WhenDimension | undefined;
    /** Parsed argv dimension (raw patterns). */
    readonly argv: ArgvDimension | undefined;
    /** Parsed network dimension (raw patterns). */
    readonly network: NetworkDimension | undefined;
    readonly source: RuleEntryDoc;
}
export interface CommandSpec {
    readonly word: CompiledPattern;
    readonly flag?: 'recursive' | 'force';
}
export interface CompiledRuleset {
    readonly defaultAction: RuleAction;
    readonly deny: readonly CompiledRuleEntry[];
    readonly allow: readonly CompiledRuleEntry[];
    readonly ask: readonly CompiledRuleEntry[];
    readonly caseInsensitivePaths: boolean;
}
export interface CompileOptions {
    readonly maxGlobStars?: number;
    readonly caseInsensitivePaths?: boolean;
}
export declare class RuleError extends Error {
    constructor(message: string);
}
/** Parse a raw YAML permissions document; malformed files fail loud at load. */
export declare function parsePermissionsDocument(text: string): PermissionsDoc;
/** Compile a validated document into hot-path rules. */
export declare function compileDocument(doc: PermissionsDoc, opts?: CompileOptions): CompiledRuleset;
/** SHA-256 hash of the raw document (compile-cache key without recompiling). */
export declare function documentHash(text: string): string;
export declare function extractPathCandidates(args: Record<string, unknown>): string[];
export declare function extractUrlCandidates(args: Record<string, unknown>): string[];
