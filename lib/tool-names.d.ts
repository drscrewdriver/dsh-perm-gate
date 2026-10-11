/**
 * The harness tool-name lists, in one place.
 *
 * These sets used to live inside `engine.ts` / `evaluate.ts`, which meant the
 * question "is this call an executed command?" had two answers depending on which
 * file asked it. It now has one, in `commandBearingCall`.
 *
 * Why not a name whitelist for executors: the agent mis-types tool names (today's
 * log has `Error: unknown tool "pash"`), plugins register their own runners, and a
 * future line may rename `shell`. A call that carries a command string and is not
 * a *known* non-executor must be judged as a command call — the whitelist direction
 * was a bypass, not a safety margin.
 */
/** Names the harness uses for "run this shell command". */
export declare const SHELL_TOOLS: Set<string>;
/** File mutation tools: they write paths, they do not execute their arguments. */
export declare const WRITE_TOOLS: Set<string>;
/**
 * Read-only tools that can never modify the workspace or execute anything. P0
 * still protects sensitive path reads outside the workspace root, and the
 * deny-keyword layer still runs first, so a search whose query contains a
 * blacklisted phrase is still vetoed.
 */
export declare const READ_TOOLS: Set<string>;
/** DSH internal coordination / management tools — not workspace-modifying. */
export declare const INTERNAL_TOOLS: Set<string>;
/**
 * Tools whose `command`-shaped argument is **data, not an action**.
 *
 * `read` receives a search string under several keys, `write` may carry a script
 * body; parsing those as shell text would deny a file read because a document
 * happens to quote `git push --force`. Everything *outside* this set is treated as
 * a possible executor when it carries a command string.
 */
export declare const NON_EXECUTOR_TOOLS: ReadonlySet<string>;
/** The command string one call carries, under any of the names runners use. */
export declare function commandArgOf(args: Record<string, unknown> | undefined): string | undefined;
/**
 * The command a call actually executes, or `undefined` when the call is not a
 * command call. Known non-executors are exempt; anything else with a command
 * string is judged as a command (fail-closed toward inspection, never toward allow).
 */
export declare function executableCommandOf(tool: string, args: Record<string, unknown> | undefined): string | undefined;
