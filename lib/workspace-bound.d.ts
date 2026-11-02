/**
 * Whether every named path resolves inside `root`, after following links.
 *
 * An empty list is `true` (the call named nothing), a missing root is `false`, and any
 * path that cannot be resolved is `false`.
 */
export declare function pathsRealInsideWorkspace(root: string | undefined, paths: readonly string[]): boolean;
