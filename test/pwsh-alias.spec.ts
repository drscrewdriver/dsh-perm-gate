/**
 * PowerShell alias expansion. The table is the security artifact here: each row
 * is a spelling that reaches a destructive (or credential-reading) cmdlet while
 * looking like an unknown program to a name-based classifier.
 */
import { describe, expect, it } from 'vitest'
import { hardDenyReason } from '../src/engine.js'
import { PWSH_ALIASES, expandLeadingProgram, expandPwshAlias, pwshAliasVariants } from '../src/pwsh-alias.js'
import type { ToolCallContext } from '../src/evaluate.js'

function shell(command: string): ToolCallContext {
  return { tool: 'shell', args: { command }, cwd: 'E:\\work\\proj', home: 'E:\\work\\proj' } as ToolCallContext
}

describe('alias table', () => {
  it.each(['rd', 'ri', 'rm', 'del', 'erase', 'rmdir'])('maps %s to remove-item', (a) => {
    expect(expandPwshAlias(a)).toBe('remove-item')
  })

  it.each([
    ['move', 'move-item'],
    ['cp', 'copy-item'],
    ['ren', 'rename-item'],
    ['sc', 'set-content'],
    ['iwr', 'invoke-webrequest'],
    ['curl', 'invoke-webrequest'],
    ['iex', 'invoke-expression'],
  ])('maps %s to %s', (alias, cmdlet) => {
    expect(expandPwshAlias(alias)).toBe(cmdlet)
  })

  it('is case-insensitive and strips a trailing .exe', () => {
    expect(expandPwshAlias('RD')).toBe('remove-item')
    expect(expandPwshAlias('rd.exe')).toBe('remove-item')
  })

  it('leaves a non-alias alone', () => {
    expect(expandPwshAlias('git')).toBe('git')
    expect(expandPwshAlias('remove-item')).toBe('remove-item')
  })

  it('deliberately does NOT list read-only aliases', () => {
    // Expanding these would only add noise to the P0 path, never a verdict.
    for (const ro of ['ls', 'dir', 'cat', 'gc', 'type']) {
      expect(PWSH_ALIASES.has(ro)).toBe(false)
    }
  })
})

describe('union semantics', () => {
  it('keeps the original spelling next to the expansion', () => {
    // The original must survive: a user-defined `function rd` does not shadow
    // the built-in alias in PowerShell, so dropping it would lose a verdict.
    expect(pwshAliasVariants('rd')).toEqual(['rd', 'remove-item'])
  })

  it('collapses to one entry when there is nothing to expand', () => {
    expect(pwshAliasVariants('remove-item')).toEqual(['remove-item'])
  })

  it('expands only the leading program of a command line', () => {
    expect(expandLeadingProgram('rd "C:\\Windows\\System32" -Recurse -Force'))
      .toBe('remove-item "C:\\Windows\\System32" -Recurse -Force')
    expect(expandLeadingProgram('git status')).toBeUndefined()
    expect(expandLeadingProgram('-Recurse')).toBeUndefined()
  })
})

describe('P0 sees through the aliases', () => {
  it.each([
    ['rd on a system directory', 'rd "C:\\Windows\\System32" -Recurse -Force'],
    ['ri on the drive root', 'ri C:\\ -Recurse -Force'],
    ['rd on the user profile', 'rd $env:USERPROFILE -Recurse -Force'],
  ])('denies %s', (_label, command) => {
    expect(hardDenyReason(shell(command)), command).toBeTruthy()
  })

  it('does not start denying harmless commands that merely contain rd', () => {
    expect(hardDenyReason(shell('Format-Table Name, Length'))).toBeUndefined()
    expect(hardDenyReason(shell('Get-Date -Format yyyy-MM-dd'))).toBeUndefined()
  })
})
