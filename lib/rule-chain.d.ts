import { type PermissionsDoc, type CompiledRuleset, type CompileOptions } from './rule.js';
export interface RuleChainConfig {
    /** The rules file name to search for (e.g. `rules.yml`). */
    readonly rulesFile: string;
    /** Whether to search up directory ancestors from cwd. Default false. */
    readonly searchUp?: boolean;
    /** Fallback path when no file is found in the chain. */
    readonly fallbackPath?: string;
    /** Error policy for malformed files: `fail` (throw) or `warn` (skip). Default fail. */
    readonly badFilePolicy?: 'fail' | 'warn';
    /** Maximum number of files in the chain. Default 10. */
    readonly maxChainLength?: number;
}
export interface ChainEntry {
    /** Absolute path to the rules file. */
    readonly path: string;
    /** Content hash (compile-cache key). */
    readonly hash: string;
    /** Parsed document. */
    readonly doc: PermissionsDoc;
}
/**
 * Resolve the rule chain: find all applicable rules files and merge them.
 *
 * @param cwd - The workspace root directory.
 * @param config - Chain configuration.
 * @param opts - Compile options forwarded to each file's compiler.
 * @returns The merged compiled ruleset.
 */
export declare function resolveRuleChain(cwd: string, config: RuleChainConfig, opts?: CompileOptions): CompiledRuleset;
/**
 * Get or create a compiled ruleset from the cache.
 * Returns the cached version if the hash matches; otherwise compiles fresh.
 */
export declare function cachedCompile(text: string, opts?: CompileOptions): CompiledRuleset;
/** Clear the compile cache (used in tests and on reload). */
export declare function clearCompileCache(): void;
/** Current compile cache size (diagnostics). */
export declare function compileCacheSize(): number;
