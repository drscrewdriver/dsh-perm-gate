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