/**
 * Shell dangerous commands parser - rm, mv, cp, chmod, dd, diskpart, etc.
 * P1 priority - detects destructive filesystem operations.
 *
 * Handles:
 * - rm -rf / recursive deletion
 * - mv overwriting existing files
 * - cp -r with destructive patterns
 * - chmod/chown with system directories
 * - dd writing to disk
 * - diskpart on Windows
 * - format disk operations
 * - PowerShell Remove-Item with dangerous patterns
 */

import type { CommandParser, CommandSemantics } from '../command-semantics.js'

/** Commands that are inherently destructive (only dangerous ones trigger canParse) */
const DESTRUCTIVE_COMMANDS: Record<string, number> = {
  // Level 5: Extreme (system-wide, data loss)
  'dd': 5,
  'diskpart': 5,
  'format': 5,
  'fdisk': 5,
  'mkfs': 5,
  'rm-sudo': 5,

  // Level 4: High (significant file deletion/modification)
  'rm': 4,
  'rmdir': 4,
  'shred': 4,
  'wipefs': 4,

  // Level 3: Medium (file operations with potential data loss)
  'mv': 3,

  // Level 2: Low (potentially risky)
  'cp': 2,
  'chmod': 2,
  'chown': 2,
  'chgrp': 2,
  'install': 2,
  'rsync': 2,
  'tar': 2,
}

/** Dangerous flags that increase destructiveness */
const DANGEROUS_FLAGS = new Set([
  '-rf', '-r', '-f', '-fr',
  '--recursive', '--force', '--no-preserve-root',
  '--no-clobber',
  '-p', // preserve
  '-a', // archive
  '--delete',
])

/** System directories that shouldn't be modified */
const SYSTEM_DIRS = /^(\/bin|\/sbin|\/usr|\/lib|\/etc|\/boot|\/dev|\/proc|\/sys|\/var|C:\\Windows|C:\\Program Files)/i

/** Patterns that indicate destructive operations */
const DESTRUCTIVE_PATTERNS = [
  /rm\s+(-\w*\s+)*[^-\w]*\//i,       // rm with /
  /rm\s+(-\w*\s+)*\*/i,              // rm with *
  /rm\s+(-\w*\s+)*~/i,              // rm with ~
  /rm\s+(-\w*\s+)*\/[a-z]/i,       // rm /anything
  /rmdir\s+/i,
  /mv\s+.*\//i,                      // mv to absolute path
  /chmod\s+[0-7]*\s*\//i,          // chmod on root paths
  /chown\s+.*\//i,                  // chown on root paths
  /dd\s+.*of=/i,                    // dd writing
  /mkfs\./i,                        // format filesystem
  />\s*\//i,                         // redirect to /
  />>\s*\//i,                       // append to /
]

export class ShellDangerousParser implements CommandParser {
  readonly name = 'shell-dangerous'
  readonly priority = 20

  canParse(command: string): boolean {
    const cmd = command.trim().toLowerCase()
    const baseName = this.extractBaseName(cmd)

    // Check if it's a known destructive command
    if (DESTRUCTIVE_COMMANDS[baseName] !== undefined) {
      return true
    }

    // Check for PowerShell equivalents
    if (cmd.startsWith('remove-item') || cmd.startsWith('ri ')) {
      return true
    }

    // Check for destructive patterns
    return DESTRUCTIVE_PATTERNS.some(p => p.test(command))
  }

  parse(command: string): CommandSemantics | null {
    const startTime = performance.now()
    const trimmed = command.trim()
    const cmd = trimmed.toLowerCase()
    const baseName = this.extractBaseName(cmd)

    let destructiveness = DESTRUCTIVE_COMMANDS[baseName] || 1
    let operation = baseName
    let targets: string[] = []
    let destructiveFlags = false
    let requiresConfirmation = false

    // Parse based on command type
    if (baseName === 'rm' || baseName === 'rmdir') {
      const parsed = this.parseRm(trimmed)
      targets = parsed.targets
      destructiveFlags = parsed.recursive || parsed.force
      if (parsed.recursive && parsed.force) {
        destructiveness = 5
        operation = 'recursive-force-delete'
      } else if (parsed.recursive) {
        destructiveness = 4
        operation = 'recursive-delete'
      } else if (parsed.force) {
        destructiveness = 3
        operation = 'force-delete'
      }
      // Check if targeting system directories
      if (targets.some(t => SYSTEM_DIRS.test(t))) {
        destructiveness = 5
      }
    } else if (baseName === 'mv') {
      const parsed = this.parseMv(trimmed)
      targets = parsed.targets
      destructiveFlags = parsed.force
      if (parsed.force) {
        destructiveness = 4
        operation = 'force-move'
      }
      // Check if overwriting system files
      if (targets.some(t => SYSTEM_DIRS.test(t))) {
        destructiveness = 4
      }
    } else if (baseName === 'chmod' || baseName === 'chown' || baseName === 'chgrp') {
      const parsed = this.parseChmod(trimmed)
      targets = parsed.targets
      if (targets.some(t => SYSTEM_DIRS.test(t))) {
        destructiveness = 4
      }
    } else if (baseName === 'dd') {
      const parsed = this.parseDd(trimmed)
      targets = parsed.targets
      destructiveFlags = parsed.force
    } else if (baseName === 'diskpart' || baseName === 'format') {
      const parsed = this.parseDiskpart(trimmed)
      targets = parsed.targets
      destructiveFlags = true
    } else if (baseName.startsWith('remove-item') || baseName.startsWith('ri ')) {
      const parsed = this.parsePowerShellRemove(trimmed)
      targets = parsed.targets
      destructiveFlags = parsed.recursive || parsed.force
      if (parsed.recursive && parsed.force) {
        destructiveness = 5
        operation = 'recursive-force-delete'
      } else if (parsed.recursive) {
        destructiveness = 4
        operation = 'recursive-delete'
      }
    } else if (baseName === 'cp') {
      const parsed = this.parseCp(trimmed)
      targets = parsed.targets
      destructiveFlags = parsed.force
      if (parsed.recursive) {
        operation = 'recursive-copy'
        destructiveness = 3
      }
    } else if (baseName === 'tar' || baseName === 'rsync') {
      const parsed = this.parseArchive(trimmed)
      targets = parsed.targets
      destructiveFlags = parsed.delete
      if (parsed.delete) {
        destructiveness = 4
        operation = 'archive-delete-target'
      }
    }

    const flags = this.extractFlags(trimmed)

    return {
      family: 'shell-dangerous',
      subcommand: baseName,
      operation,
      destructiveness: destructiveness as 0 | 1 | 2 | 3 | 4 | 5,
      destructiveFlags,
      targets,
      flags,
      requiresConfirmation: destructiveness >= 4,
      compound: false,
      gitOperation: false,
      targetsSharedBranch: false,
      rawCommand: trimmed,
    }
  }

  private extractBaseName(command: string): string {
    // Handle sh -c "..." patterns
    const shMatch = command.match(/(?:sh|bash|pwsh)(?:\s+-c\s+['"]?)(.+?)(?:['"]?)$/)
    const actual = shMatch ? shMatch[1] : command

    // Extract first word
    const parts = actual.trim().split(/\s+/)
    return parts[0]?.toLowerCase() || ''
  }

  private parseRm(command: string): { targets: string[]; recursive: boolean; force: boolean } {
    const args = this.extractArgs(command)
    const recursive = args.some(a => a === '-r' || a === '-rf' || a === '-fr' || a === '--recursive')
    const force = args.some(a => a === '-f' || a === '-rf' || a === '-fr' || a === '--force')
    const targets = args.filter(a => !a.startsWith('-'))
    return { targets, recursive, force }
  }

  private parseMv(command: string): { targets: string[]; force: boolean } {
    const args = this.extractArgs(command)
    const force = args.some(a => a === '-f' || a === '--force')
    const targets = args.filter(a => !a.startsWith('-'))
    return { targets, force }
  }

  private parseCp(command: string): { targets: string[]; recursive: boolean; force: boolean } {
    const args = this.extractArgs(command)
    const recursive = args.some(a => a === '-r' || a === '-R' || a === '--recursive')
    const force = args.some(a => a === '-f' || a === '--force')
    const targets = args.filter(a => !a.startsWith('-'))
    return { targets, recursive, force }
  }

  private parseChmod(command: string): { targets: string[] } {
    const args = this.extractArgs(command)
    const targets = args.filter(a => !a.startsWith('-') && !/^[0-7]+$/.test(a))
    return { targets }
  }

  private parseDd(command: string): { targets: string[]; force: boolean } {
    const args = this.extractArgs(command)
    const targets: string[] = []
    for (const arg of args) {
      if (arg.startsWith('of=')) {
        targets.push(arg.slice(3))
      }
      if (arg.startsWith('if=')) {
        targets.push(arg.slice(3))
      }
    }
    const force = command.includes('conv=') || command.includes('oflag=')
    return { targets, force }
  }

  private parseDiskpart(command: string): { targets: string[] } {
    // Diskpart commands are always dangerous
    const args = this.extractArgs(command)
    const targets = args.filter(a => !a.startsWith('-'))
    return { targets }
  }

  private parsePowerShellRemove(command: string): { targets: string[]; recursive: boolean; force: boolean } {
    const args = this.extractArgs(command)
    const recursive = args.some(a => a === '-Recurse' || a === '-r')
    const force = args.some(a => a === '-Force' || a === '-f')
    const targets = args.filter(a => !a.startsWith('-'))
    return { targets, recursive, force }
  }

  private parseArchive(command: string): { targets: string[]; delete: boolean } {
    const args = this.extractArgs(command)
    const deleteFlag = args.some(a => a === '--delete' || a === '-d')
    const targets = args.filter(a => !a.startsWith('-'))
    return { targets, delete: deleteFlag }
  }

  private extractArgs(command: string): string[] {
    const args: string[] = []
    let current = ''
    let inQuote = false
    let quoteChar = ''
    let escape = false

    for (const char of command) {
      if (escape) {
        current += char
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (inQuote) {
        if (char === quoteChar) {
          inQuote = false
          continue
        }
        current += char
        continue
      }
      if (char === '"' || char === "'") {
        inQuote = true
        quoteChar = char
        continue
      }
      if (/\s/.test(char)) {
        if (current) {
          args.push(current)
          current = ''
        }
        continue
      }
      current += char
    }
    if (current) args.push(current)

    return args
  }

  private extractFlags(command: string): string[] {
    const args = this.extractArgs(command)
    return args.filter(a => a.startsWith('-'))
  }
}
