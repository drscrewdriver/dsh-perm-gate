import { type CompiledPattern } from './compiler.js';
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
