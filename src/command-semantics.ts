/**
 * Unified command semantics output from all classifiers.
 * Every parser (git, shell-dangerous, docker, sql, pkg-manager)
 * returns this interface — the evaluator does one matching pass.
 */

/** Command families supported by static parsers */
export type CommandFamily = 'git' | 'shell-dangerous' | 'docker' | 'sql' | 'pkg-manager' | 'unknown'

/** Destructiveness rating (0=safe, 5=extremely destructive) */
export type DestructivenessLevel = 0 | 1 | 2 | 3 | 4 | 5

/** Unified semantics output */
export interface CommandSemantics {
  /** Command family (git, shell-dangerous, docker, sql, pkg-manager, unknown) */
  family: CommandFamily
  /** Subcommand (e.g. 'push', 'rm', 'run') */
  subcommand?: string
  /** Specific operation (e.g. 'force-push', 'recursive-delete') */
  operation?: string
  /** Destructiveness level 0-5 */
  destructiveness: DestructivenessLevel
  /** Whether destructive flags are present (--force, --recursive, etc.) */
  destructiveFlags: boolean
  /** Target identifiers (branch names, file paths, container IDs, table names, package names) */
  targets: string[]
  /** All parsed flags (normalized) */
  flags: string[]
  /** Whether the command requires explicit confirmation */
  requiresConfirmation: boolean
  /** Whether the command is compound (contains &&, ||, |) */
  compound: boolean
  /** Whether the command involves git operations */
  gitOperation: boolean
  /** Branch name (extracted from git commands) */
  branch?: string
  /** Remote name (for git push/fetch) */
  remote?: string
  /** Whether the command targets shared/protected branches */
  targetsSharedBranch: boolean
  /** Raw command string */
  rawCommand?: string
}

/** Classification result with confidence */
export interface ClassificationResult {
  /** The semantics object */
  semantics: CommandSemantics
  /** Parser confidence (0-1) */
  confidence: number
  /** Parser used */
  parser: string
  /** Parse time in milliseconds */
  parseTimeMs: number
}

/** Parser interface - all parsers implement this */
export interface CommandParser {
  /** Parser name */
  readonly name: string
  /** Priority (lower = runs first) */
  readonly priority: number
  /** Try to parse the command. Return null if not applicable. */
  parse(command: string): CommandSemantics | null
  /** Check if this parser can handle the command */
  canParse(command: string): boolean
}
