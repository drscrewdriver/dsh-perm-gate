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
 * The scannable text of one call's arguments, with the rule above applied.
 *
 * Bounded and structure-preserving: values are joined with a single space, nesting is
 * walked to a fixed depth, and nothing is escaped — the output is a haystack for
 * keyword/credential matching, never something executed or logged as the call.
 */
export declare function operationText(args: Record<string, unknown>, tool?: string, depth?: number): string;
/**
 * The text a blacklist keyword may match: the visible command plus the call's
 * scannable arguments. Whitespace is collapsed so a command written with extra spaces
 * still reads as the command it is.
 */
export declare function keywordScanText(tool: string | undefined, args: Record<string, unknown>, commandText?: string): string;
