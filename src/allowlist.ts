/**
 * Durable allowlist (whitelist) writes for dsh-perm-gate.
 *
 * The "allow everywhere" approval action appends a matched command pattern to
 * the rules file's `allow` list and reloads, so a human-approved command is
 * persistently whitelisted across sessions — not just granted once.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parse, stringify } from 'yaml'

/**
 * Append one command pattern as a new `allow` entry in the rules file.
 * Returns false (leaving the file untouched) on any I/O or shape error.
 * @param rulesFile - absolute or relative path to the permissions YAML.
 * @param pattern - command word (glob) to whitelist, e.g. `git push`.
 * @param reason - human-readable reason recorded on the allow entry.
 */
export function appendAllowCommand(rulesFile: string, pattern: string, reason = 'permissive allow-everywhere'): boolean {
  try {
    const text = readFileSafe(rulesFile)
    const root = text === '' ? undefined : parse(text)
    const doc = root ?? {}
    const perms = (doc as Record<string, unknown>)['permissions'] as Record<string, unknown> | undefined
    const section = (perms === undefined ? doc : perms) as Record<string, unknown>
    if (typeof section !== 'object' || section === null || Array.isArray(section)) return false
    const allow = Array.isArray(section['allow']) ? section['allow'] as unknown[] : []
    allow.push({ command: [pattern], reason })
    section['allow'] = allow
    writeFileSync(rulesFile, stringify(doc), 'utf8')
    return true
  } catch {
    return false
  }
}

/** The allow-list command patterns currently in the rules file (read-only). */
export function listAllowCommands(rulesFile: string): string[] {
  try {
    const text = readFileSafe(rulesFile)
    if (text === '') return []
    const root = parse(text) as Record<string, unknown>
    const perms = root['permissions'] as Record<string, unknown> | undefined
    const section = perms === undefined ? root : perms
    const allow = Array.isArray(section['allow']) ? section['allow'] as unknown[] : []
    const out: string[] = []
    for (const entry of allow) {
      if (typeof entry !== 'object' || entry === null) continue
      const command = (entry as Record<string, unknown>)['command']
      if (!Array.isArray(command)) continue
      for (const c of command) if (typeof c === 'string') out.push(c)
    }
    return out
  } catch {
    return []
  }
}

/**
 * Replace the rules file's `allow` whitelist with exactly the given command
 * patterns (one allow entry per pattern). Other sections (deny / ask /
 * defaultAction) are preserved. Returns false on any I/O or shape error.
 * @param rulesFile - absolute or relative path to the permissions YAML.
 * @param patterns - exact command-pattern list to set; empty clears the whitelist.
 * @param reason - reason recorded on each generated allow entry.
 */
export function replaceAllowCommands(rulesFile: string, patterns: readonly string[], reason = 'permissive allowlist'): boolean {
  try {
    if (rulesFile === '') return false
    const text = readFileSafe(rulesFile)
    const root = text === '' ? undefined : parse(text)
    const doc = root ?? {}
    const perms = (doc as Record<string, unknown>)['permissions'] as Record<string, unknown> | undefined
    const section = (perms === undefined ? doc : perms) as Record<string, unknown>
    if (typeof section !== 'object' || section === null || Array.isArray(section)) return false
    section['allow'] = patterns.map((pattern) => ({ command: [pattern], reason }))
    writeFileSync(rulesFile, stringify(doc), 'utf8')
    return true
  } catch {
    return false
  }
}

function readFileSafe(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}