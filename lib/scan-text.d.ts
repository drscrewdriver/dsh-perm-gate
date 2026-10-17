/**
 * Argument keys that carry a document body rather than the operation itself.
 * A file's text is not the operation: writing a document that *mentions* a token, a
 * private key, or `credentials.yaml` must not hard-deny the write, and the deny-keyword
 * layer must not refuse it either. Still consulted for executing tools, whose *other*
 * keys are all operation-shaped.
 *
 * `plan` is the case that made this list look wrong (issue #2): it was missing, so a
 * planning tool's prose was scanned as an operation.
 */
export declare const CONTENT_ARG_KEYS: ReadonlySet<string>;
/**
 * Keys that name an action for a non-executing tool: what a command would run, where a
 * request goes, which path is touched, what a search looks for. Everything else such a
 * tool carries is prose.
 *
 * `query` / `pattern` stay in on purpose: a search term is the whole operation of a
 * lookup tool, and the tool-name doc already promises that a search whose query hits
 * the blacklist is still vetoed (a `curl … ?token=` shape shipped in a search field is
 * exactly as leaky as one in a `url`).
 */
export declare const OPERATION_ARG_KEYS: ReadonlySet<string>;
/**
 * A caller's additions to the two key sets (`extraContentArgKeys` / `extraOperationArgKeys`).
 *
 * Purely additive: the built-in sets are never replaced or cleared, because the bug this
 * rule exists to prevent (issue #2) was exactly "the list of document keys forgot one".
 * A setting that could drop `content` would let a profile author re-create that bug by
 * omission, silently.
 */
export interface ScanKeyPolicy {
    readonly content?: readonly string[];
    readonly operation?: readonly string[];
}
interface KeySets {
    readonly content: ReadonlySet<string>;
    readonly operation: ReadonlySet<string>;
}
/** Merge the configured additions into the built-in sets. */
export declare function mergeScanKeys(policy?: ScanKeyPolicy): KeySets;
/**
 * The scannable text of one call's arguments, with the rule above applied.
 *
 * Key precedence, in order (this ordering *is* the contract):
 *
 * 1. a key in the **operation** set is read, whatever the tool class and even if it also
 *    landed in the content set — an explicit declaration that the field describes an act
 *    (e.g. a workflow body that really executes) outranks a heuristic;
 * 2. otherwise, for a non-executing tool, nothing else is read: its remaining fields are
 *    documents, and `decide()` already classified the call as needing no approval;
 * 3. otherwise (executor or a name the gate does not know) every key outside the content
 *    set is read — an unfamiliar tool never gets the benefit of the doubt.
 *
 * Bounded and structure-preserving: values are joined with a single space, nesting is
 * walked to a fixed depth, and nothing is escaped — the output is a haystack for
 * keyword/credential matching, never something executed or logged as the call.
 */
export declare function operationText(args: Record<string, unknown>, tool?: string, policy?: ScanKeyPolicy): string;
/**
 * The text a blacklist keyword may match: the visible command plus the call's
 * scannable arguments. Whitespace is collapsed so a command written with extra spaces
 * still reads as the command it is.
 *
 * The command is placed first and is **not** subject to the key policy: no configuration
 * of "which fields are documents" can take the executed command out of the blacklist's
 * reach.
 */
export declare function keywordScanText(tool: string | undefined, args: Record<string, unknown>, commandText?: string, policy?: ScanKeyPolicy): string;
export {};
