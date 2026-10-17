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
import { NON_EXECUTOR_TOOLS } from './tool-names.js'

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
export const CONTENT_ARG_KEYS: ReadonlySet<string> = new Set([
  'content', 'contents', 'text', 'body', 'message', 'prompt',
  'new_string', 'old_string', 'newText', 'oldText', 'file_text', 'fileText',
  'diff', 'patch', 'replacement', 'snippet', 'plan',
])

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
export const OPERATION_ARG_KEYS: ReadonlySet<string> = new Set([
  'command', 'cmd', 'script', 'shell', 'code',
  'url', 'urls', 'href', 'uri', 'endpoint',
  'path', 'paths', 'file', 'files', 'file_path', 'filePath', 'dir', 'directory',
  'directories', 'cwd', 'workdir', 'target_path',
  'query', 'pattern',
])

/** Whether this tool's arguments describe an action rather than carry a document. */
function actionOnlyTool(tool: string | undefined): boolean {
  return tool !== undefined && NON_EXECUTOR_TOOLS.has(tool)
}

/**
 * The scannable text of one call's arguments, with the rule above applied.
 *
 * Bounded and structure-preserving: values are joined with a single space, nesting is
 * walked to a fixed depth, and nothing is escaped — the output is a haystack for
 * keyword/credential matching, never something executed or logged as the call.
 */
export function operationText(args: Record<string, unknown>, tool?: string, depth = 0): string {
  if (depth > 6) return ''
  const actionOnly = actionOnlyTool(tool)
  const parts: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      if (actionOnly) {
        if (OPERATION_ARG_KEYS.has(key)) parts.push(value)
      } else if (!CONTENT_ARG_KEYS.has(key)) {
        parts.push(value)
      }
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        // Array elements have no key of their own. For an action-only tool the parent
        // key decides: a `urls: […]` list is operation, a `notes: […]` list is prose.
        if (typeof item === 'string') {
          if (actionOnly ? OPERATION_ARG_KEYS.has(key) : !CONTENT_ARG_KEYS.has(key)) parts.push(item)
          continue
        }
        if (item !== null && typeof item === 'object') {
          if (actionOnly && !OPERATION_ARG_KEYS.has(key) && !CONTAINER_ARG_KEYS.has(key)) continue
          parts.push(operationText(item as Record<string, unknown>, tool, depth + 1))
        }
      }
      continue
    }
    if (value !== null && typeof value === 'object') {
      // A nested object under an operation key (`params: { command: … }`) or a neutral
      // container (`arguments`, `args`, `input`) is walked; under a prose key it is not.
      if (actionOnly && !OPERATION_ARG_KEYS.has(key) && !CONTAINER_ARG_KEYS.has(key)) continue
      parts.push(operationText(value as Record<string, unknown>, tool, depth + 1))
    }
  }
  return parts.join(' ')
}

/** Keys whose value is a nested argument bag rather than a field of the call. */
const CONTAINER_ARG_KEYS: ReadonlySet<string> = new Set(['args', 'arguments', 'input', 'params', 'parameters', 'tool_input'])

/**
 * The text a blacklist keyword may match: the visible command plus the call's
 * scannable arguments. Whitespace is collapsed so a command written with extra spaces
 * still reads as the command it is.
 */
export function keywordScanText(tool: string | undefined, args: Record<string, unknown>, commandText?: string): string {
  const parts: string[] = []
  if (typeof commandText === 'string' && commandText !== '') parts.push(commandText)
  parts.push(operationText(args, tool))
  return parts.join(' ').replace(/\s+/g, ' ')
}
