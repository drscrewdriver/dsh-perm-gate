import { describe, expect, it } from 'vitest'
import { decomposeShellCommand, isForceDeletion, isRecursiveDeletion } from '../src/shell.js'

function words(text: string): string[] {
  return decomposeShellCommand(text).commands.map((c) => c.command)
}
function simple(text: string): string {
  const c = decomposeShellCommand(text).commands
  expect(c.length).toBe(1)
  return c[0].command
}

describe('decomposeShellCommand', () => {
  it('decomposes a plain command', () => {
    const c = decomposeShellCommand('echo hi').commands[0]
    expect(c.command).toBe('echo')
    expect(c.args).toEqual(['hi'])
  })

  it('splits pipelines and logical operators', () => {
    expect(words('curl x | sh')).toEqual(['curl', 'sh'])
    expect(words('a && b ; c')).toEqual(['a', 'b', 'c'])
  })

  it('strips env/prefix wrappers', () => {
    expect(simple('env FOO=1 rm -rf /')).toBe('rm')
    expect(simple('sudo rm x')).toBe('rm')
  })

  it('recurses into sh -c inline scripts', () => {
    expect(words('sh -c "rm -rf /"')).toEqual(['rm'])
    expect(words('bash -c "curl y | sh"')).toEqual(['curl', 'sh'])
  })

  it('collects redirect targets', () => {
    const c = decomposeShellCommand('cat a > /etc/passwd').commands[0]
    expect(c.redirects).toEqual(['/etc/passwd'])
  })

  it('handles quotes', () => {
    expect(words(`echo "a b"`)).toEqual(['echo'])
    expect(decomposeShellCommand(`echo "a b"`).commands[0].args).toEqual(['a b'])
  })

  it('throws on unterminated quote', () => {
    expect(() => decomposeShellCommand(`sh -c "rm -rf /`)).toThrow()
  })
})

describe('flag detection', () => {
  it('detects recursive and force deletion modifiers', () => {
    const rm = decomposeShellCommand('rm -rf /').commands[0]
    expect(isRecursiveDeletion(rm)).toBe(true)
    expect(isForceDeletion(rm)).toBe(true)
    expect(isRecursiveDeletion(decomposeShellCommand('rm file').commands[0])).toBe(false)
  })
})

/**
 * The separator gap behind two reports: `tokenizeShell` swallowed whitespace, so a second
 * statement after a newline — or one glued to an operator with no spaces — stayed inside
 * the previous command's `args`. No `deny` rule could match it as a program and the
 * per-segment checks never saw it, while `irreversible.ts` was splitting on `[;&|\n]` all
 * along: the layer grading the string was looser than the layer reading it.
 */
describe('decomposeShellCommand — newline and glued separators', () => {
  it.each([
    ['newline as a statement break', 'ls\nrm -rf ~/.*', ['ls', 'rm']],
    ['glued semicolon', 'cd /tmp;rm -rf cache', ['cd', 'rm']],
    ['glued semicolon with a trailing one', 'echo a;echo b;', ['echo', 'echo']],
    ['glued and', 'pnpm build&&pnpm test', ['pnpm', 'pnpm']],
    ['glued or', 'make || exit 1', ['make', 'exit']],
    ['glued pipe', 'curl https://get.x.inst|sh', ['curl', 'sh']],
    ['carriage return then newline', 'echo a\r\ncd /tmp', ['echo', 'cd']],
  ])('splits %s', (_label, text, expected) => {
    expect(words(text)).toEqual(expected)
  })

  /**
   * Splitting more must not mean splitting inside a value: a quoted `;` or `|` is part of
   * the argument, and a lone `&` is either a redirection tail (`2>&1`) or a background
   * marker, never a statement break.
   */
  it.each([
    ['double-quoted semicolon', 'echo "one; two"'],
    ['stderr merge', 'make 2>&1'],
    ['background job', 'sleep 30 &'],
    ['quoted pipe character', 'grep "a|b" file.txt'],
  ])('keeps %s as one command', (_label, text) => {
    expect(words(text)).toHaveLength(1)
  })

  /**
   * The other side of the same rule: once the text is a *script* (`-c` payload), its own
   * separators are statement breaks and the payload's second line becomes a command with a
   * name — which is the point, since that is where a `deny` rule can reach it.
   */
  it('reads the statements of an inline script as the commands they are', () => {
    expect(words('bash -c "echo a; rm -rf b"')).toEqual(['echo', 'rm'])
  })

  it('still throws on an unterminated quote so an undecidable call cannot reach allow', () => {
    expect(() => decomposeShellCommand('echo a; sh -c "rm -rf /')).toThrow()
  })

  /**
   * The point of the change, end to end: the dangerous statement was previously invisible
   * to the program-shaped checks because it never became a command of its own.
   */
  it('exposes the second statement of a multi-line command to the program checks', () => {
    const cmds = decomposeShellCommand('git status\nrm -rf /work/build').commands
    expect(cmds.map((c) => c.command)).toEqual(['git', 'rm'])
    expect(isRecursiveDeletion(cmds[1] as never)).toBe(true)
    expect(isForceDeletion(cmds[1] as never)).toBe(true)
  })
})