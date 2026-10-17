/**
 * Which argument text a protective screen is allowed to read — one rule, shared.
 *
 * Two copies of this logic existed (`engine.operationText` for the P0 credential
 * pre-screen, `runtime.denyScanText` for the deny-keyword blacklist) and both were a
 * *denylist* of document-body keys. That is how GitHub issue #2 happened:
 * `exit_plan_mode` carries its plan under `plan`, which was not in the list, so the
 * whole plan text went into a screen built to catch *operations* — and a plan that
 * honestly names `rm -rf` as a step it intends to ask about was hard-refused for
 * describing it. The model then learns to reword plans to get past the gate, which is
 * strictly worse than no gate.
 *
 * The list was also doomed to be re-filed for the next body key (`notes`, `summary`,
 * `description`…), so this module changes the *shape* of the rule, per tool class:
 *
 * - a tool that **executes or is unknown** → every non-body key is read (the old,
 *   conservative behaviour — an unfamiliar name never gets the benefit of the doubt);
 * - a tool in {@link NON_EXECUTOR_TOOLS} (read / internal / file-write) → only keys
 *   that *describe an action* are read: commands, urls, target paths, search queries.
 *   Its document text is data, and `decide()` already classifies it as work that needs
 *   no approval, so screening its prose contradicts that verdict.
 *
 * Residual, stated rather than hidden: a tool that *executes* a document body it was
 * given (`workflow`, `skill`, `ralph`, `subagent`) is no longer read from that body
 * here. Those paths delegate work that is gated as its own tool call, which is where an
 * actual act becomes visible — see the comment on `INTERNAL_TOOLS` in `tool-names.ts`.
 */
import { NON_EXECUTOR_TOOLS } from './tool-names.js';
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
export const CONTENT_ARG_KEYS = new Set([
    'content', 'contents', 'text', 'body', 'message', 'prompt',
    'new_string', 'old_string', 'newText', 'oldText', 'file_text', 'fileText',
    'diff', 'patch', 'replacement', 'snippet', 'plan',
]);
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
export const OPERATION_ARG_KEYS = new Set([
    'command', 'cmd', 'script', 'shell', 'code',
    'url', 'urls', 'href', 'uri', 'endpoint',
    'path', 'paths', 'file', 'files', 'file_path', 'filePath', 'dir', 'directory',
    'directories', 'cwd', 'workdir', 'target_path',
    'query', 'pattern',
]);
/** Whether this tool's arguments describe an action rather than carry a document. */
function actionOnlyTool(tool) {
    return tool !== undefined && NON_EXECUTOR_TOOLS.has(tool);
}
/** The built-in pair, returned as-is when nothing was configured (no per-call Set churn). */
const BUILTIN_KEYS = { content: CONTENT_ARG_KEYS, operation: OPERATION_ARG_KEYS };
/** Blank and non-string entries are dropped rather than guessed at; empty input keeps the base set. */
function withExtra(base, extra) {
    if (extra === undefined)
        return base;
    const added = extra
        .filter((key) => typeof key === 'string' && key.trim() !== '')
        .map((key) => key.trim());
    return added.length === 0 ? base : new Set([...base, ...added]);
}
/** Merge the configured additions into the built-in sets. */
export function mergeScanKeys(policy) {
    if (policy === undefined)
        return BUILTIN_KEYS;
    if (policy.content === undefined && policy.operation === undefined)
        return BUILTIN_KEYS;
    return {
        content: withExtra(CONTENT_ARG_KEYS, policy.content),
        operation: withExtra(OPERATION_ARG_KEYS, policy.operation),
    };
}
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
export function operationText(args, tool, policy) {
    return collectText(args, tool, mergeScanKeys(policy), 0);
}
function collectText(args, tool, keys, depth) {
    if (depth > 6)
        return '';
    const actionOnly = actionOnlyTool(tool);
    // Whether a scalar sitting under `key` describes the operation.
    const reads = (key) => keys.operation.has(key) || (!actionOnly && !keys.content.has(key));
    // Whether to walk into `key`'s nested bag. A declared operation key and a neutral
    // container (`{ params: { command: … } }`) both qualify; under a prose key the walk
    // stops, so a document's nested fields cannot smuggle an operation back in.
    const descends = (key) => !actionOnly || keys.operation.has(key) || CONTAINER_ARG_KEYS.has(key);
    const parts = [];
    for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
            if (reads(key))
                parts.push(value);
            continue;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                // Array elements have no key of their own, so the parent decides: a `urls: […]`
                // list is operation, a `notes: […]` list is prose.
                if (typeof item === 'string') {
                    if (reads(key))
                        parts.push(item);
                    continue;
                }
                if (item !== null && typeof item === 'object' && descends(key)) {
                    parts.push(collectText(item, tool, keys, depth + 1));
                }
            }
            continue;
        }
        if (value !== null && typeof value === 'object' && descends(key)) {
            parts.push(collectText(value, tool, keys, depth + 1));
        }
    }
    return parts.join(' ');
}
/** Keys whose value is a nested argument bag rather than a field of the call. */
const CONTAINER_ARG_KEYS = new Set(['args', 'arguments', 'input', 'params', 'parameters', 'tool_input']);
/**
 * The text a blacklist keyword may match: the visible command plus the call's
 * scannable arguments. Whitespace is collapsed so a command written with extra spaces
 * still reads as the command it is.
 *
 * The command is placed first and is **not** subject to the key policy: no configuration
 * of "which fields are documents" can take the executed command out of the blacklist's
 * reach.
 */
export function keywordScanText(tool, args, commandText, policy) {
    const parts = [];
    if (typeof commandText === 'string' && commandText !== '')
        parts.push(commandText);
    parts.push(operationText(args, tool, policy));
    return parts.join(' ').replace(/\s+/g, ' ');
}
