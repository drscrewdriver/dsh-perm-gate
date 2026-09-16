/**
 * Git command parser - extracts subcommand, branch, remote, flags, destructiveness.
 * P0 priority - most critical for branch permissions.
 *
 * Handles:
 * - git push/force push detection
 * - git branch operations (delete, rename)
 * - git checkout/switch with branch names
 * - git merge/rebase
 * - git reset (soft/hard/mixed)
 * - git clean (destructive file deletion)
 * - git stash operations
 * - git refspec parsing (HEAD:main)
 * - Remote vs branch name disambiguation
 */

import type { CommandParser, CommandSemantics } from '../command-semantics.js'

/** Known protected branch patterns */
const PROTECTED_BRANCHES = /^(main|master|production|release|stable)$/i

/** Known remote names (common defaults) */
const KNOWN_REMOTES = /^(origin|upstream|fork|origin-\w+)$/i

/** Flags that increase destructiveness */
const DESTRUCTIVE_FLAGS = new Set([
  '--force', '-f',
  '--hard',
  '--delete', '-d', '-D',
  '--amend',
  '--no-backup',
  '-rf',
  '--clean',
  '--reset',
])

export class GitParser implements CommandParser {
  readonly name = 'git'
  readonly priority = 10

  canParse(command: string): boolean {
    const trimmed = command.trim()
    // Direct git command
    if (/^git\s+/.test(trimmed)) return true
    // Shell-wrapped: sh -c "git ...", bash -c git ..., etc.
    if (/(?:sh|bash|pwsh|powershell)(?:\s+-c\s+['"]?)?.*?\bgit\s+/.test(trimmed)) return true
    return false
  }

  parse(command: string): CommandSemantics | null {
    const trimmed = command.trim()

    // Extract the git command portion (strip shell wrappers)
    const gitMatch = trimmed.match(/(?:sh|bash|pwsh|powershell)(?:\s+-c\s+['"]?)?(\s+git\s+.+)/)
    const gitPart = gitMatch ? gitMatch[1].trim() : trimmed

    // Parse git arguments
    const parts = this.parseGitArgs(gitPart)
    if (parts.length < 2) return null

    // Skip 'git' keyword if present
    const startIndex = parts[0] === 'git' ? 1 : 0
    if (parts.length - startIndex < 1) return null

    const subcommand = parts[startIndex]?.toLowerCase()

    // Get rest of arguments
    const args = parts.slice(startIndex + 1)

    return this.analyzeSubcommand(subcommand, args, trimmed)
  }

  private analyzeSubcommand(
    subcommand: string,
    args: string[],
    rawCommand: string,
  ): CommandSemantics | null {
    const flags = this.extractFlags(args)
    const hasForce = flags.includes('--force') || flags.includes('-f') || flags.includes('--force-with-lease')
    const hasDelete = flags.includes('--delete') || flags.includes('-d') || flags.includes('-D')
    const hasHard = flags.includes('--hard')

    let operation: string | undefined
    let destructiveness = 1
    let targets: string[] = []
    let branch: string | undefined
    let remote: string | undefined
    let gitOperation = true
    let targetsSharedBranch = false

    switch (subcommand) {
      case 'push': {
        remote = this.extractRemote(args)
        branch = this.extractBranch(args)
        targets = [branch, remote].filter(Boolean) as string[]
        targetsSharedBranch = this.isProtectedBranch(branch)
        if (hasForce || flags.includes('--force-with-lease')) {
          operation = 'force-push'
          destructiveness = targetsSharedBranch ? 5 : 4
        } else if (hasDelete) {
          // 删除远端分支。`hasDelete` 此前只在 `branch` 分支被读取，push 侧从未
          // 使用——于是 `git push --delete origin main` 落进上面的 else，被判成
          // 普通 push(dest=4)、`DESTRUCTIVENESS_MAP` 里的 `'push-delete': 5`
          // 是**死条目**。删远端分支与 force push 同级：都不可逆地改动共享历史。
          operation = 'push-delete'
          destructiveness = targetsSharedBranch ? 5 : 4
        } else {
          operation = 'push'
          destructiveness = targetsSharedBranch ? 4 : 3
        }
        break
      }

      case 'reset': {
        if (hasHard) {
          operation = 'reset-hard'
          destructiveness = 5
        } else if (flags.includes('--soft')) {
          operation = 'reset-soft'
          destructiveness = 2
        } else {
          operation = 'reset-mixed'
          destructiveness = 4
        }
        targets = this.extractRefs(args)
        break
      }

      case 'branch': {
        if (hasDelete) {
          const forceDelete = flags.includes('-D')
          branch = this.extractBranchName(args)
          targets = [branch].filter(Boolean) as string[]
          targetsSharedBranch = this.isProtectedBranch(branch)
          operation = forceDelete ? 'branch-delete-force' : 'branch-delete'
          destructiveness = targetsSharedBranch ? 5 : (forceDelete ? 3 : 2)
        } else if (flags.includes('-m') || flags.includes('--move')) {
          operation = 'branch-rename'
          destructiveness = 2
          targets = this.extractRefs(args)
        } else {
          operation = 'branch-create'
          destructiveness = 3
          branch = this.extractBranchName(args)
          targets = [branch].filter(Boolean) as string[]
        }
        break
      }

      case 'checkout':
      case 'switch': {
        const isNewBranch = flags.includes('-b') || flags.includes('--create')
        branch = this.extractBranchName(args)
        targets = [branch].filter(Boolean) as string[]
        operation = isNewBranch ? 'checkout-new-branch' : 'checkout'
        destructiveness = isNewBranch ? 3 : 2
        break
      }

      case 'merge': {
        targets = this.extractRefs(args)
        if (flags.includes('--ff-only')) {
          operation = 'merge-ff-only'
          destructiveness = 3
        } else {
          operation = 'merge'
          destructiveness = 3
        }
        break
      }

      case 'rebase': {
        targets = this.extractRefs(args)
        if (flags.includes('-i') || flags.includes('--interactive')) {
          operation = 'rebase-interactive'
          destructiveness = 4
        } else {
          operation = 'rebase'
          destructiveness = 3
        }
        break
      }

      case 'clean': {
        if (hasForce || flags.includes('-f')) {
          operation = 'clean-force'
          destructiveness = 5
        } else {
          operation = 'clean'
          destructiveness = 3
        }
        targets = this.extractRefs(args)
        break
      }

      case 'cherry-pick': {
        operation = 'cherry-pick'
        destructiveness = 3
        targets = this.extractRefs(args)
        break
      }

      case 'revert': {
        operation = 'revert'
        destructiveness = 3
        targets = this.extractRefs(args)
        break
      }

      case 'tag': {
        if (hasDelete) {
          operation = 'tag-delete'
          destructiveness = 2
          targets = this.extractRefs(args)
        } else {
          operation = 'tag-create'
          destructiveness = 1
          targets = this.extractRefs(args)
        }
        break
      }

      case 'stash': {
        const stashOp = args[0]?.toLowerCase()
        if (stashOp === 'pop' || stashOp === 'apply') {
          operation = 'stash-pop'
          destructiveness = 2
        } else if (stashOp === 'drop') {
          operation = 'stash-drop'
          destructiveness = 2
        } else {
          operation = 'stash-create'
          destructiveness = 1
        }
        break
      }

      case 'fetch': {
        remote = this.extractRemote(args)
        targets = [remote].filter(Boolean) as string[]
        operation = 'fetch'
        destructiveness = 1
        break
      }

      case 'pull': {
        remote = this.extractRemote(args)
        branch = this.extractBranch(args)
        targets = [remote, branch].filter(Boolean) as string[]
        operation = 'pull'
        destructiveness = 2
        break
      }

      case 'clone': {
        operation = 'clone'
        destructiveness = 1
        targets = this.extractRefs(args)
        break
      }

      case 'status':
      case 'log':
      case 'diff':
      case 'show':
      case 'blame':
      case 'ls-files':
      case 'rev-parse':
      case 'describe': {
        operation = subcommand
        destructiveness = 1
        break
      }

      default: {
        // Unknown git subcommand
        operation = subcommand
        destructiveness = 1
        gitOperation = true
        break
      }
    }

    // Detect destructive flags
    const destructiveFlags = hasForce || hasDelete || hasHard ||
      flags.some(f => DESTRUCTIVE_FLAGS.has(f))

    return {
      family: 'git',
      subcommand,
      operation,
      destructiveness: destructiveness as 0 | 1 | 2 | 3 | 4 | 5,
      destructiveFlags,
      targets,
      flags,
      requiresConfirmation: destructiveness >= 4,
      compound: false,
      gitOperation,
      branch,
      remote,
      targetsSharedBranch,
      rawCommand: rawCommand,
    }
  }

  private parseGitArgs(command: string): string[] {
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

  private extractFlags(args: string[]): string[] {
    const flags: string[] = []
    for (const arg of args) {
      if (arg.startsWith('-')) {
        // Normalize long flags to lowercase, but preserve case for short flags
        // to distinguish between -d (delete) and -D (force delete)
        if (arg.startsWith('--')) {
          flags.push(arg.toLowerCase())
        } else {
          // Short flags: -f, -d, -D, etc. - preserve case
          flags.push(arg)
        }
      }
    }
    return flags
  }

  private extractRemote(args: string[]): string | undefined {
    // First positional arg is usually remote
    for (const arg of args) {
      if (!arg.startsWith('-')) {
        if (KNOWN_REMOTES.test(arg)) {
          return arg
        }
        // Could be a URL or path
        if (arg.includes('/') || arg.includes('.')) {
          return arg
        }
      }
    }
    return undefined
  }

  private extractBranch(args: string[]): string | undefined {
    // Branch is usually the last positional arg or after remote
    const positionalArgs = args.filter(a => !a.startsWith('-'))
    if (positionalArgs.length > 1) {
      // Could be "origin main" or "origin:main"
      const last = positionalArgs[positionalArgs.length - 1]
      // Handle refspec (e.g., HEAD:main)
      if (last.includes(':')) {
        return last.split(':')[1]
      }
      return last
    }
    return positionalArgs[0]
  }

  private extractBranchName(args: string[]): string | undefined {
    // For branch create/checkout, find the branch name
    const positionalArgs = args.filter(a => !a.startsWith('-'))
    // Skip -b flag value if present
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-b' || args[i] === '--create') {
        return args[i + 1]
      }
    }
    return positionalArgs[positionalArgs.length - 1]
  }

  private extractRefs(args: string[]): string[] {
    return args.filter(a => !a.startsWith('-') && !KNOWN_REMOTES.test(a))
  }

  /**
   * 目标是否落在保护分支上。
   *
   * **只剥已知的 ref 前缀，不对任意 `/` 取末段。** 早先的写法是
   * `branch.split('/').pop()`，于是：
   *   - `refs/heads/main` → `main`  ✅ 期望如此
   *   - `backup/main`     → `main`  ❌ **误判**（它是含斜杠的普通分支名）
   *   - `feat/release`    → `release` ❌ **误判**
   *
   * 误判方向不是"更安全"。这条判据喂给 P0 硬拒——而 P0 是**不可配置撤销**的
   * （见 engine.ts 顶部："deterministic, monotonic, never negotiated"）。
   * 漏判还有关键词层与 LLM 层兜底，误判则是"合法工作流被永久挡住且无出口"。
   */
  private isProtectedBranch(branch?: string): boolean {
    if (!branch) return false
    const cleanBranch = branch.replace(/^refs\/(?:heads|tags|remotes\/[^/]+)\//, '')
    return PROTECTED_BRANCHES.test(cleanBranch)
  }
}
