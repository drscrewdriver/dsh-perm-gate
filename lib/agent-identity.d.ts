/**
 * Agent identity extraction for the `agents` rule dimension.
 *
 * Given a tool execution context, produces zero or more identity candidates
 * that the `agents` dimension can match against. Candidates are produced
 * in priority order: most-specific first.
 *
 * Identity model:
 *   - `main`          — the primary (top-level) agent session
 *   - `subagent`      — a delegated child agent (parentAuthorized present)
 *   - `preset:<name>` — running under a named permission preset
 *
 * When no identity can be determined, an empty array is returned and the
 * `agents` dimension in rules fail-closes (no match → rule skipped).
 */
/**
 * The subset of ToolExecutionLike we need. Defined as a permissive interface
 * to avoid a circular import with runtime.ts. Uses `unknown` for event types
 * since we only need to read `.type`/`.kind` and `.preset`/`.tier` properties.
 */
export interface ExecutionLike {
    readonly parentAuthorized?: boolean;
    readonly agent?: {
        readonly sessionId?: string;
        readonly session?: {
            readonly id?: string;
            readonly events?: readonly unknown[];
            readonly snapshotEvents?: () => readonly unknown[];
            readonly ownEvents?: () => readonly unknown[];
        };
    };
}
/**
 * Extract agent identity candidates from a tool execution context.
 *
 * Returns a deduplicated list of identity strings. The `agents` rule
 * dimension matches if ANY candidate matches ANY entry in the rule's
 * `agents` list.
 *
 * @returns candidates in priority order, e.g. `['preset:permissive', 'subagent']`
 *          or `['main']`. Empty array = undecidable → agents rules fail-close.
 */
export declare function extractAgentCandidates(exec: ExecutionLike): string[];
