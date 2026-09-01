/**
 * Shell command decomposition for dsh-perm-gate.
 *
 * Turns a raw command-string argument into a list of SIMPLE commands: each
 * simple command is a `command` word plus `args` and `redirect` tokens. It
 * recognizes pipelines/`&&`/`;` at the top level, strips common prefix wrappers
 * (`env`, `sudo`, `command`, literal-prefix `\`), and RECURSIVELY descends into
 * `sh -c "..."` / `bash -c "..."` / `powershell -Command "..."` so that
 * `sh -c "rm -rf /"` matches the same way as a bare `rm -rf /`.
 *
 * Pure: no filesystem/process state.
 */
export interface SimpleCommand {
  /** The command word (env/prefix wrappers stripped, `\,` backtick un-escaped). */
  readonly command: string
  /** Argument tokens (redirect targets are NOT part of `args`). */
  readonly args: readonly string[]
  /** Redirect targets (`>`, `>>`, `<`) — treated as argument-token candidates too. */
  readonly redirects: readonly string[]
}

export type CmdFlag = 'recursive' | 'force'

const WRAPPER_WORDS = new Set(['env', 'sudo', 'command', 'nohup', 'xargs'])
const COMMAND_WORDS = new Set(['sh', 'bash', 'zsh', 'dash', 'busybox', 'pwsh', 'powershell', 'cmd'])

/**
 * Tokenize a shell string into tokens, honoring single/double quotes and a few
 * common escapes. Missing/EOF quotes throw so the caller can route an
 * undecidable command to `ask` rather than guessing.
 */
export function tokenizeShell(text: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    if (quote === "'") {
      if (ch === "'") {
        quote = null
        i += 1
        continue
      }
      cur += ch
      i += 1
      continue
    }
    if (quote === '"') {
      if (ch === '"') {
        quote = null
        i += 1
        continue
      }
      if (ch === '\\' && i + 1 < n) {
        cur += text[i + 1]
        i += 2
        continue
      }
      cur += ch
      i += 1
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      i += 1
      continue
    }
    if (ch === '\\' && i + 1 < n) {
      cur += text[i + 1]
      i += 2
      continue
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        tokens.push(cur)
        cur = ''
      }
      i += 1
      continue
    }
    cur += ch
    i += 1
  }
  if (quote !== null) {
    throw new Error('unterminated quote in command string')
  }
  if (cur.length > 0) tokens.push(cur)
  return tokens
}

/** Split into top-level simple-command token groups on `|`/`&&`/`;`/`||`. */
function splitPipeline(tokens: string[]): string[][] {
  const groups: string[][] = []
  let cur: string[] = []
  for (const tok of tokens) {
    if (tok === '|' || tok === '&&' || tok === ';' || tok === '||') {
      if (cur.length > 0) groups.push(cur)
      cur = []
    } else {
      cur.push(tok)
    }
  }
  if (cur.length > 0) groups.push(cur)
  return groups
}

function splitRedirects(tokens: string[]): { args: string[]; redirects: string[] } {
  const args: string[] = []
  const redirects: string[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (t === '>' || t === '>>' || t === '<' || t === '1>' || t === '2>' || /^\d+>[>&]?$/.test(t)) {
      if (i + 1 < tokens.length) redirects.push(tokens[i + 1])
      i += 1
      continue
    }
    args.push(t)
  }
  return { args, redirects }
}

/** Strip prefix wrappers (`env A=1`, `sudo`, `command`, leading `\`) from a command token list. */
function stripWrappers(args: string[]): string[] {
  let list = [...args]
  let guard = 0
  while (list.length > 0 && guard++ < 8) {
    let head = list[0]
    if (head.startsWith('\\')) head = head.slice(1)
    if (WRAPPER_WORDS.has(head)) {
      // Drop the wrapper and any `K=V` right after it.
      list = list.slice(1)
      while (list.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(list[0])) list = list.slice(1)
      continue
    }
    break
  }
  return list
}

/**
 * Recursively decompose a command string into simple commands, descending into
 * `-c`/`-Command` inline scripts. Throws on undecidable syntax (unclosed quote);
 * callers route that to `ask`, never `allow`.
 */
export function decomposeShellCommand(text: string): { commands: SimpleCommand[] } {
  const tokens = tokenizeShell(text)
  const groups = splitPipeline(tokens)
  const commands: SimpleCommand[] = []
  for (const group of groups) {
    collectSimpleCommand(group, commands)
  }
  return { commands }
}

function collectSimpleCommand(tokens: string[], out: SimpleCommand[]): void {
  const stripped = stripWrappers(tokens)
  if (stripped.length === 0) return
  let command = stripped[0]
  const rest = stripped.slice(1)
  if (command.startsWith('\\')) command = command.slice(1)
  command = command.replace(/`/g, '')

  // Inline interpreter (-c / -Command): recurse into the script token.
  const flagIndex = rest.findIndex((t) => t === '-c' || t === '--command' || /^-Command$/i.test(t))
  if (COMMAND_WORDS.has(command) && flagIndex >= 0) {
    const script = rest[flagIndex + 1]
    if (typeof script === 'string') {
      const nested = new Set<string>()
      try {
        for (const sc of decomposeShellCommand(script).commands) {
          // Flatten; dedupe exact same command word + token signature.
          const key = `${sc.command}:${sc.args.join('\x00')}:${sc.redirects.join('\x00')}`
          if (nested.has(key)) continue
          nested.add(key)
          out.push(sc)
        }
      } catch {
        out.push({ command: command.toLowerCase(), args: rest, redirects: [] })
        return
      }
      return
    }
  }

  const { args, redirects } = splitRedirects(rest)
  out.push({ command: command.toLowerCase(), args, redirects })
}

/** Whether a simple command's args carry a `recursive` deletion modifier. */
export function isRecursiveDeletion(cmd: SimpleCommand): boolean {
  return cmd.args.some(
    (token) =>
      /^-.*r/i.test(token) || /^-.*rf/i.test(token) || /^--(?:recursive|-?force)$/i.test(token) || token === 'recursive',
  )
}
export function isForceDeletion(cmd: SimpleCommand): boolean {
  return cmd.args.some((token) => /^-.*f/i.test(token) || /^--force$/i.test(token) || token === 'force')
}