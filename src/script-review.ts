/**
 * Script-body attachment for review — "what will run", not "which file was named".
 *
 * A call like `bash ./clean-home.sh` or `pwsh -File ~/scripts/clean-home.ps1` names a
 * file; the *operation* is inside it. Before this module the grader saw only the
 * filename, so a script that wipes `$HOME` while claiming to free up cache was graded
 * on a sentence that contains nothing dangerous — and out-of-workspace scripts were
 * pushed to the `U` tier (uninspectable), which is honest but also means nobody ever
 * looked. So: when a call runs a script, read it (bounded) and hand the same text to
 * the risk model and to the human, and let the deterministic nets judge the body too.
 *
 * Two boundaries are kept on purpose:
 * - **Reading is not executing.** Only the bytes are looked at; nothing here runs,
 *   sources, or resolves a shebang.
 * - **The file is untrusted data.** The body reaches the grader inside a labelled
 *   field and must never be treated as instructions by whoever consumes it; secrets in
 *   it go through the same redaction as every other egress text.
 *
 * The pure half ({@link scriptRefs}) has no filesystem access so `ask-context.ts` can
 * keep its "never touches fs" invariant; the reading half is used by the node runtime.
 */
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

/** Extensions whose file *is* the payload of the call. */
const SCRIPT_EXT = '(?:sh|bash|zsh|dash|ksh|ps1|psm1|psd1|py|py3|js|mjs|cjs|ts|mts|rb|pl|php|bat|cmd)'

/** Interpreters that take a script file as a bare argument. */
const FILE_INTERPRETERS = /^(?:sh|bash|zsh|dash|ksh|busybox|pwsh|powershell|cmd|python[23]?|node|nodejs|deno|bun|ruby|perl|php)$/i

/** Shell builtins that run a file in the current shell. */
const SOURCE_HEADS = /^(?:source|\.)$/i

/**
 * Flags that mean "the next argument is inline code, not a file". Attaching them as a
 * script path would read a file named after a whole code string, and grading them as
 * content is pointless — the code is already the command text.
 *
 * `cmd`'s `/c` and `/k` are deliberately **not** here: `cmd /c build.bat` is how a batch
 * file is run, and the inline-code reading of `/c` (a quoted command string) still
 * yields no file, because a code blob never ends in a script extension.
 */
const INLINE_CODE_FLAGS = /^-{1,2}(?:c\b|e\b|command|c=|encodedcommand|eval|exec)$|^-C$/i

/**
 * Bare interpreter flags that may swallow the next token (`bash -x -c '…' script.sh`
 * is not a file argument after `-c`, but `-x` leaves the next candidate alone).
 */
const SWITCH_ONLY_FLAGS = /^-+[\w-]+$/

export interface ScriptRef {
  /** Exactly as it appeared in the command, so the ask context can match coverage. */
  readonly ref: string
  /** Which interpreter runs it (`bash`, `pwsh`, … or `direct` for `./x.sh`). */
  readonly interpreter: string
}

/** Whether one token looks like a script file rather than a flag or an inline body. */
function looksLikeScript(token: string): boolean {
  if (token === '' || token.startsWith('-') || token.startsWith('/')) return false
  return new RegExp(`\\.${SCRIPT_EXT}$`, 'i').test(token)
}

/**
 * Every script file the command runs, in order of appearance, deduplicated.
 *
 * Shapes covered: `bash x.sh`, `pwsh -File x.ps1`, `python -m pkg` (no file — nothing
 * is returned), `node -e 'code'` (inline — nothing returned), `./deploy.sh`,
 * `~/scripts/clean.sh`, `source env.sh`, `cmd /c build.bat`, and a pipeline of several
 * of them. A `-c`/`-Command` payload is deliberately *not* mined for a nested script
 * name: the code text is already what the gate grades.
 */
export function scriptRefs(commandText: string): readonly ScriptRef[] {
  const out: ScriptRef[] = []
  const seen = new Set<string>()
  const push = (ref: string, interpreter: string): void => {
    if (ref === '' || seen.has(ref)) return
    seen.add(ref)
    out.push({ ref, interpreter })
  }
  for (const segment of commandText.split(/[;&|\n]+/)) {
    const tokens = segment.trim().split(/\s+/).filter((t) => t !== '')
    if (tokens.length === 0) continue
    const head = (tokens[0] ?? '').replace(/^["'`]+/, '').replace(/["'`]+$/, '')
    const bare = head.split(/[\\/]/).pop() ?? head
    // `./deploy.sh`, `~/scripts/x.sh`, `/tmp/run.py` executed directly.
    if (looksLikeScript(head)) {
      push(head, 'direct')
      continue
    }
    if (!(FILE_INTERPRETERS.test(bare) || SOURCE_HEADS.test(head))) continue
    const isFileFlagAware = FILE_INTERPRETERS.test(bare)
    const isSource = SOURCE_HEADS.test(head)
    for (let i = 1; i < tokens.length; i += 1) {
      const tok = (tokens[i] ?? '').replace(/^["'`]+/, '').replace(/["'`]+$/, '')
      if (tok === '') continue
      // `source`/`.` runs the file in the current shell, and its argument need not
      // carry a known extension (`source ~/.profile`, `. ./env`). Anything that is not
      // a flag is the file.
      if (isSource) {
        if (!tok.startsWith('-')) push(tok, 'source')
        continue
      }
      if (isFileFlagAware && INLINE_CODE_FLAGS.test(tok)) break // the rest is inline code
      // `-File x.ps1` / `/c build.bat`: the flag itself is skipped, the value is read.
      if (isFileFlagAware && SWITCH_ONLY_FLAGS.test(tok)) {
        const next = (tokens[i + 1] ?? '').replace(/^["'`]+/, '').replace(/["'`]+$/, '')
        if (looksLikeScript(next)) push(next, bare.toLowerCase())
        i += 1
        continue
      }
      if (looksLikeScript(tok)) push(tok, bare.toLowerCase())
    }
  }
  return out
}

/** One script the call will run, with the text the reviewer gets. */
export interface ScriptContent extends ScriptRef {
  /** Absolute path actually read. */
  readonly path: string
  readonly body: string
  /** True when the file is longer than the budget and `body` is a prefix. */
  readonly truncated: boolean
  /** Set instead of `body` when nothing could be read (never silently empty). */
  readonly unreadable?: 'missing' | 'not-a-file' | 'too-large' | 'binary' | 'unreadable'
  readonly bytes: number
}

/** Reading budget: enough for a real script, small enough for one grader round-trip. */
export const SCRIPT_REVIEW_MAX_BODY_CHARS = 20_000
export const SCRIPT_REVIEW_MAX_FILE_BYTES = 512_000
export const SCRIPT_REVIEW_MAX_FILES = 4

/** `~` expansion plus cwd-relative resolution, without touching the filesystem. */
export function resolveScriptPath(ref: string, cwd: string): string {
  const cleaned = ref.replace(/^["'`]+/, '').replace(/["'`]+$/, '')
  const expanded = cleaned === '~' || cleaned.startsWith('~/') || cleaned.startsWith('~\\')
    ? resolve(homedir(), cleaned.slice(1).replace(/^[\\/]/, ''))
    : cleaned
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded)
}

/** Whether a decoded body is text at all (a compiled artifact is not reviewable). */
function looksBinary(text: string): boolean {
  if (text.includes('\u0000')) return true
  const sample = text.slice(0, 2000)
  if (sample === '') return false
  let weird = 0
  for (const ch of sample) {
    const code = ch.charCodeAt(0)
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) continue
    weird += 1
  }
  return weird / sample.length > 0.15
}

/**
 * Read the bodies of {@link scriptRefs}, bounded and best-effort: a file that cannot be
 * read is *reported* as such (`unreadable`), because "we looked and could not see" is
 * information the reviewer needs, while an empty body would read as a benign script.
 *
 * Never throws — a missing file, a permission error, or an undecodable blob all come
 * back as a labelled entry.
 */
export function readScriptContents(
  refs: readonly ScriptRef[],
  cwd: string,
  limits: { readonly maxFiles?: number, readonly maxBodyChars?: number, readonly maxFileBytes?: number } = {},
): readonly ScriptContent[] {
  const maxFiles = limits.maxFiles ?? SCRIPT_REVIEW_MAX_FILES
  const maxBodyChars = limits.maxBodyChars ?? SCRIPT_REVIEW_MAX_BODY_CHARS
  const maxFileBytes = limits.maxFileBytes ?? SCRIPT_REVIEW_MAX_FILE_BYTES
  const out: ScriptContent[] = []
  for (const ref of refs.slice(0, maxFiles)) {
    const path = resolveScriptPath(ref.ref, cwd)
    const entry = (body: string, truncated: boolean, bytes: number, unreadable?: ScriptContent['unreadable']): ScriptContent => ({
      ...ref,
      path,
      body,
      truncated,
      bytes,
      ...(unreadable === undefined ? {} : { unreadable }),
    })
    try {
      const st = statSync(path)
      if (!st.isFile()) {
        out.push(entry('', false, 0, 'not-a-file'))
        continue
      }
      if (st.size > maxFileBytes) {
        // The size still says something (a 40 MB "cleanup script" is worth a human look),
        // but the body is out of budget.
        out.push(entry('', true, st.size, 'too-large'))
        continue
      }
      const raw = readFileSync(path, 'utf8')
      if (looksBinary(raw)) {
        out.push(entry('', false, st.size, 'binary'))
        continue
      }
      out.push(entry(raw.slice(0, maxBodyChars), raw.length > maxBodyChars, st.size))
    } catch (err) {
      const missing = (err as { code?: string }).code === 'ENOENT'
      out.push(entry('', false, 0, missing ? 'missing' : 'unreadable'))
    }
  }
  return out
}

/** Whether every script the call runs has been read (i.e. the payload is now visible). */
export function scriptsFullyCovered(refs: readonly ScriptRef[], contents: readonly ScriptContent[]): boolean {
  if (refs.length === 0) return false
  return refs.every((r) => contents.some((c) => c.ref === r.ref && c.unreadable === undefined && c.body !== ''))
}

/** The readable summary the deterministic layers judge a script body alongside. */
export function scriptBodyText(contents: readonly ScriptContent[]): string {
  return contents
    .filter((c) => c.unreadable === undefined)
    .map((c) => `${c.ref}\n${c.body}`)
    .join('\n')
}
