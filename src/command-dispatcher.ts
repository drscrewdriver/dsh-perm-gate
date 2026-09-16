/**
 * Command dispatcher - routes commands to appropriate parsers.
 * Runs parsers in priority order, returns first match.
 */

import type { CommandParser, ClassificationResult, CommandSemantics } from './command-semantics.js'
import { GitParser } from './parsers/git.js'
import { ShellDangerousParser } from './parsers/shell-cmds.js'

/** Registered parsers (loaded lazily) */
const parsers: CommandParser[] = []

/** Parser registry flag */
let initialized = false

/**
 * Lazy-load all parsers.
 * Called once on first dispatch.
 */
function initParsers(): void {
  if (initialized) return
  initialized = true

  // P0: Git parser (highest priority)
  parsers.push(new GitParser())

  // P1: Shell dangerous commands
  parsers.push(new ShellDangerousParser())

  // P2: Package managers (TODO: implement)
  // parsers.push(new PkgManagerParser())

  // P3: Docker (TODO: implement)
  // parsers.push(new DockerParser())

  // P4: SQL (TODO: implement)
  // parsers.push(new SqlParser())
}

/**
 * Register a parser manually (for testing or custom parsers).
 */
export function registerParser(parser: CommandParser): void {
  // Insert in priority order (lower priority number = higher priority)
  const idx = parsers.findIndex(p => p.priority > parser.priority)
  if (idx === -1) {
    parsers.push(parser)
  } else {
    parsers.splice(idx, 0, parser)
  }
}

/**
 * Clear all registered parsers (for testing).
 */
export function clearParsers(): void {
  parsers.length = 0
  initialized = false
}

/**
 * Dispatch a command to the appropriate parser.
 * Returns classification result or null if no parser matches.
 */
export function dispatchCommand(command: string): ClassificationResult | null {
  initParsers()

  const startTime = performance.now()

  for (const parser of parsers) {
    if (parser.canParse(command)) {
      const semantics = parser.parse(command)
      if (semantics) {
        const parseTimeMs = performance.now() - startTime
        return {
          semantics,
          confidence: 1.0, // Static parsers have high confidence
          parser: parser.name,
          parseTimeMs,
        }
      }
    }
  }

  // No parser matched - return unknown semantics
  const parseTimeMs = performance.now() - startTime
  return {
    semantics: {
      family: 'unknown',
      destructiveness: 0,
      destructiveFlags: false,
      targets: [],
      flags: [],
      requiresConfirmation: false,
      compound: false,
      gitOperation: false,
      targetsSharedBranch: false,
      rawCommand: command,
    },
    confidence: 0,
    parser: 'none',
    parseTimeMs,
  }
}

/**
 * Get all registered parsers (for inspection/testing).
 */
export function getParsers(): readonly CommandParser[] {
  initParsers()
  return parsers
}
