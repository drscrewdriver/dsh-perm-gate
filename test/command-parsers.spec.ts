/**
 * Tests for command parsers (git, shell-dangerous)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { dispatchCommand, registerParser, clearParsers } from '../src/command-dispatcher'
import { GitParser } from '../src/parsers/git'
import { ShellDangerousParser } from '../src/parsers/shell-cmds'
import { WIPE_UTILITIES } from '../src/irreversible'

describe('Git Parser', () => {
  const parser = new GitParser()

  describe('canParse', () => {
    it('detects git commands', () => {
      expect(parser.canParse('git push origin main')).toBe(true)
      expect(parser.canParse('git status')).toBe(true)
      expect(parser.canParse('git checkout -b feature')).toBe(true)
    })

    it('detects shell-wrapped git commands', () => {
      expect(parser.canParse('sh -c "git push"')).toBe(true)
      expect(parser.canParse('bash -c git push')).toBe(true)
    })

    it('rejects non-git commands', () => {
      expect(parser.canParse('npm install')).toBe(false)
      expect(parser.canParse('ls -la')).toBe(false)
    })
  })

  describe('parse - push', () => {
    it('parses basic push', () => {
      const result = parser.parse('git push origin main')
      expect(result).not.toBeNull()
      expect(result!.family).toBe('git')
      expect(result!.subcommand).toBe('push')
      expect(result!.operation).toBe('push')
      expect(result!.remote).toBe('origin')
      expect(result!.branch).toBe('main')
      expect(result!.targetsSharedBranch).toBe(true) // main is protected
    })

    it('detects force push', () => {
      const result = parser.parse('git push --force origin main')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('force-push')
      expect(result!.destructiveness).toBe(5) // force push to protected branch
      expect(result!.destructiveFlags).toBe(true)
      expect(result!.requiresConfirmation).toBe(true)
    })

    it('detects force-with-lease', () => {
      const result = parser.parse('git push --force-with-lease origin develop')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('force-push')
      expect(result!.destructiveness).toBe(4) // force push to non-protected branch
      expect(result!.targetsSharedBranch).toBe(false)
    })
  })

  describe('parse - branch', () => {
    it('parses branch create', () => {
      const result = parser.parse('git branch feature/new-feature')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('branch-create')
      expect(result!.branch).toBe('feature/new-feature')
    })

    it('detects branch delete', () => {
      const result = parser.parse('git branch -d feature/old')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('branch-delete')
      expect(result!.destructiveness).toBe(2)
    })

    it('detects force delete', () => {
      const result = parser.parse('git branch -D feature/old')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('branch-delete-force')
      expect(result!.destructiveness).toBe(3)
    })

    it('detects delete of protected branch', () => {
      const result = parser.parse('git branch -d main')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('branch-delete')
      expect(result!.destructiveness).toBe(5) // protected branch
      expect(result!.targetsSharedBranch).toBe(true)
    })
  })

  describe('parse - checkout/switch', () => {
    it('parses checkout existing branch', () => {
      const result = parser.parse('git checkout main')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('checkout')
      expect(result!.branch).toBe('main')
    })

    it('parses checkout new branch', () => {
      const result = parser.parse('git checkout -b feature/new')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('checkout-new-branch')
      expect(result!.branch).toBe('feature/new')
      expect(result!.destructiveness).toBe(3)
    })
  })

  describe('parse - reset', () => {
    it('detects hard reset', () => {
      const result = parser.parse('git reset --hard HEAD~1')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('reset-hard')
      expect(result!.destructiveness).toBe(5)
      expect(result!.destructiveFlags).toBe(true)
      expect(result!.requiresConfirmation).toBe(true)
    })

    it('detects soft reset', () => {
      const result = parser.parse('git reset --soft HEAD~1')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('reset-soft')
      expect(result!.destructiveness).toBe(2)
    })
  })

  describe('parse - merge/rebase', () => {
    it('parses merge', () => {
      const result = parser.parse('git merge feature/branch')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('merge')
      expect(result!.destructiveness).toBe(3)
    })

    it('detects interactive rebase', () => {
      const result = parser.parse('git rebase -i HEAD~5')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('rebase-interactive')
      expect(result!.destructiveness).toBe(4)
    })
  })

  describe('parse - read-only', () => {
    it('parses status', () => {
      const result = parser.parse('git status')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('status')
      expect(result!.destructiveness).toBe(1)
      expect(result!.requiresConfirmation).toBe(false)
    })

    it('parses log', () => {
      const result = parser.parse('git log --oneline -10')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('log')
      expect(result!.destructiveness).toBe(1)
    })
  })
})

describe('Shell Dangerous Parser', () => {
  const parser = new ShellDangerousParser()

  describe('canParse', () => {
    it('detects rm commands', () => {
      expect(parser.canParse('rm -rf /tmp/test')).toBe(true)
      expect(parser.canParse('rm file.txt')).toBe(true)
    })

    it('detects PowerShell Remove-Item', () => {
      expect(parser.canParse('Remove-Item -Recurse -Force C:\\temp')).toBe(true)
      expect(parser.canParse('ri -r folder')).toBe(true)
    })

    it('detects diskpart', () => {
      expect(parser.canParse('diskpart /s script.txt')).toBe(true)
    })

    it('detects dd', () => {
      expect(parser.canParse('dd if=/dev/zero of=/dev/sda')).toBe(true)
    })

    it('rejects safe commands', () => {
      expect(parser.canParse('ls -la')).toBe(false)
      expect(parser.canParse('cat file.txt')).toBe(false)
    })
  })

  describe('parse - rm', () => {
    it('parses simple rm', () => {
      const result = parser.parse('rm file.txt')
      expect(result).not.toBeNull()
      expect(result!.family).toBe('shell-dangerous')
      expect(result!.subcommand).toBe('rm')
      expect(result!.destructiveness).toBe(4)
    })

    it('detects recursive force delete', () => {
      const result = parser.parse('rm -rf /tmp/test')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('recursive-force-delete')
      expect(result!.destructiveness).toBe(5)
      expect(result!.requiresConfirmation).toBe(true)
    })

    it('detects recursive delete', () => {
      const result = parser.parse('rm -r folder')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('recursive-delete')
      expect(result!.destructiveness).toBe(4)
    })
  })

  describe('parse - mv', () => {
    it('parses mv', () => {
      const result = parser.parse('mv file.txt /backup/')
      expect(result).not.toBeNull()
      expect(result!.subcommand).toBe('mv')
      expect(result!.destructiveness).toBe(3)
    })

    it('detects force mv', () => {
      const result = parser.parse('mv -f file.txt /etc/config')
      expect(result).not.toBeNull()
      expect(result!.operation).toBe('force-move')
      expect(result!.destructiveness).toBe(4)
    })
  })

  describe('parse - dd', () => {
    it('parses dd command', () => {
      const result = parser.parse('dd if=input.img of=/dev/sda')
      expect(result).not.toBeNull()
      expect(result!.subcommand).toBe('dd')
      expect(result!.destructiveness).toBe(5)
      expect(result!.requiresConfirmation).toBe(true)
      expect(result!.targets).toContain('/dev/sda')
    })
  })

  describe('parse - PowerShell', () => {
    it('parses Remove-Item', () => {
      const result = parser.parse('Remove-Item -Recurse -Force C:\\temp')
      expect(result).not.toBeNull()
      expect(result!.family).toBe('shell-dangerous')
      expect(result!.operation).toBe('recursive-force-delete')
      expect(result!.destructiveness).toBe(5)
    })
  })
})

describe('Command Dispatcher', () => {
  beforeAll(() => {
    clearParsers()
    registerParser(new GitParser())
    registerParser(new ShellDangerousParser())
  })

  it('dispatches git commands', () => {
    const result = dispatchCommand('git push --force origin main')
    expect(result).not.toBeNull()
    expect(result!.semantics.family).toBe('git')
    expect(result!.parser).toBe('git')
  })

  it('dispatches shell commands', () => {
    const result = dispatchCommand('rm -rf /tmp/test')
    expect(result).not.toBeNull()
    expect(result!.semantics.family).toBe('shell-dangerous')
    expect(result!.parser).toBe('shell-dangerous')
  })

  it('returns unknown for unrecognized commands', () => {
    const result = dispatchCommand('npm install')
    expect(result).not.toBeNull()
    expect(result!.semantics.family).toBe('unknown')
    expect(result!.parser).toBe('none')
  })

  it('measures parse time', () => {
    const result = dispatchCommand('git status')
    expect(result).not.toBeNull()
    expect(result!.parseTimeMs).toBeGreaterThanOrEqual(0)
  })
})

/**
 * The Windows storage-wipe family, and the agreement between the two places that
 * know about it.
 *
 * Irreversibility is decided once (`src/irreversible.ts`), and that module — not
 * this parser — gates P0 and the reversibility tier. The parser still has to agree:
 * if it reports `unknown` for `Clear-Disk`, then every consumer of `destructiveness`
 * (a future rule dimension, the explanation view) inherits a second, weaker opinion
 * about the same fact. That divergence is what left `Optimize-VHD` with no rule and
 * no model denial in the first place.
 */
describe('shell parser agrees with the irreversibility source', () => {
  const parser = new ShellDangerousParser()

  const LEVEL5: readonly (readonly [string, string])[] = [
    ['Optimize-VHD -Path disk.vhdx -Mode Full', 'optimize-vhd'],
    ['Clear-Disk -Number 0 -RemoveData -Confirm:$false', 'clear-disk'],
    ['Initialize-Disk -Number 1', 'initialize-disk'],
    ['Set-Disk -Number 2 -IsOffline $true', 'set-disk'],
    ['Remove-VHD -Path disk.vhdx', 'remove-vhd'],
    ['Mount-Disk -Path disk.vhdx', 'mount-disk'],
    ['sdelete -z C:', 'sdelete'],
    ['diskpart /s clean.txt', 'diskpart'],
    ['mkfs.ext4 /dev/sda1', 'mkfs'],
  ]

  it.each(LEVEL5)('Level 5 by name: %s', (command) => {
    expect(parser.canParse(command), command).toBe(true)
    expect(parser.parse(command)?.destructiveness, command).toBe(5)
  })

  it('requires the argument shape for the arg-dependent tools', () => {
    // The pattern route is what flags these; a numeric Level 5 is reserved for the
    // names that are wipes by themselves. Nothing on the decision path reads the
    // number anyway — P0 and the tier consume `irreversible.ts`.
    expect(parser.canParse('vssadmin delete shadows /all /quiet')).toBe(true)
    expect(parser.canParse('cipher /w:C:\\')).toBe(true)
    expect(parser.canParse('vssadmin')).toBe(false)
    expect(parser.canParse('cipher')).toBe(false)
    expect(parser.canParse('Get-Command cipher')).toBe(false)
  })

  it('covers every name the deny layer calls a wipe utility', () => {
    for (const name of WIPE_UTILITIES) {
      // `mkfs` is stored bare while real calls carry a suffix (`mkfs.ext4`).
      const probe = name === 'mkfs' ? 'mkfs.ext4 /dev/sda1' : `${name} -Number 0`
      expect(parser.canParse(probe), name).toBe(true)
    }
  })
})
