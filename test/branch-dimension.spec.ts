/**
 * `branch` dimension — git branch / remote / protected-branch matching.
 *
 * The dimension exists because the `args` dimension is OR-over-tokens: it can
 * ask "does `--force` appear?" but never "does `--force` appear ON A PUSH to a
 * protected branch?". The decisive case is telling
 * `git push --force origin main` (dangerous) apart from
 * `git checkout --force main` (routine) — the two share every token `args`
 * can see.
 *
 * Candidates come from the shared command dispatcher, so refspec forms are
 * split by the parser rather than re-derived here.
 */
import { describe, expect, it } from 'vitest'
import { compileDocument, parsePermissionsDocument, RuleError } from '../src/rule.js'
import { decideRules, type ToolCallContext } from '../src/evaluate.js'

/** Compile a permissions document from a YAML body. */
function compile(body: string) {
  return compileDocument(parsePermissionsDocument(body), {})
}

/** A shell call context whose command text drives the command/branch layers. */
function shell(command: string): ToolCallContext {
  return {
    tool: 'shell',
    args: { command },
    commandText: command,
    cwd: process.cwd(),
    caseInsensitive: true,
  }
}

/** Decide one shell command against a rules body. */
function verdict(body: string, command: string) {
  return decideRules(compile(body), shell(command))
}

const FORCE_PUSH_RULE = `
permissions:
  defaultAction: ask
  deny:
    - command: [git]
      branch:
        target: [main, master]
        shared: true
      reason: force push to a protected branch
`

describe('branch dimension — parsing', () => {
  it('accepts target / remote / shared', () => {
    const doc = parsePermissionsDocument(`
permissions:
  deny:
    - branch:
        target: [main]
        remote: [origin]
        shared: true
`)
    expect(doc.deny[0]!.branch).toEqual({ target: ['main'], remote: ['origin'], shared: true })
  })

  it('accepts a single sub-dimension', () => {
    const doc = parsePermissionsDocument(`
permissions:
  deny:
    - branch:
        target: ["release*"]
`)
    expect(doc.deny[0]!.branch).toEqual({ target: ['release*'] })
  })

  it('rejects a non-boolean shared', () => {
    expect(() =>
      parsePermissionsDocument(`
permissions:
  deny:
    - branch:
        shared: "yes"
`),
    ).toThrow(RuleError)
  })

  it('rejects an unknown sub-field instead of ignoring it', () => {
    expect(() =>
      parsePermissionsDocument(`
permissions:
  deny:
    - branch:
        target: [main]
        branch: main
`),
    ).toThrow(RuleError)
  })

  it('rejects a non-mapping branch value', () => {
    expect(() =>
      parsePermissionsDocument(`
permissions:
  deny:
    - branch: main
`),
    ).toThrow(RuleError)
  })

  it('is listed in VALID_KEYS (a typo would otherwise be an unknown field)', () => {
    expect(() =>
      parsePermissionsDocument(`
permissions:
  deny:
    - tools: [shell]
      branch:
        target: [main]
`),
    ).not.toThrow()
  })
})

describe('branch dimension — matching', () => {
  it('matches a protected-branch push and reports the deny entry', () => {
    const d = verdict(FORCE_PUSH_RULE, 'git push --force origin main')
    expect(d.action).toBe('deny')
    expect(d.ruleIndex).toBe(0)
  })

  it('does NOT match the same tokens on a non-push command', () => {
    // `git checkout --force main` carries every token `args` could see, which
    // is precisely why the branch dimension is needed.
    const d = verdict(FORCE_PUSH_RULE, 'git checkout --force main')
    expect(d.action).not.toBe('deny')
  })

  it('does NOT match a push to an unprotected branch', () => {
    const d = verdict(FORCE_PUSH_RULE, 'git push --force origin feature/x')
    expect(d.action).not.toBe('deny')
  })

  it('reads a refspec as a branch, not as a remote', () => {
    const d = verdict(FORCE_PUSH_RULE, 'git push origin HEAD:main')
    expect(d.action).toBe('deny')
  })

  it('does not match a non-git command even when it carries the same words', () => {
    const d = verdict(FORCE_PUSH_RULE, 'echo git push --force origin main')
    expect(d.action).not.toBe('deny')
  })

  it('does not throw on a non-git command (dispatcher reports family unknown)', () => {
    expect(() => verdict(FORCE_PUSH_RULE, 'ls -la')).not.toThrow()
  })
})

describe('branch dimension — globs and remote', () => {
  const RELEASE_RULE = `
permissions:
  defaultAction: ask
  deny:
    - branch:
        target: ["release*"]
      reason: release branch
  allow:
    - branch:
        remote: [origin]
      reason: origin remote
    - tools: [nothing-matches-this]
`

  it('matches a branch glob across a separator', () => {
    expect(verdict(RELEASE_RULE, 'git push origin release/1.0').action).toBe('deny')
  })

  it('does not match a non-release branch', () => {
    expect(verdict(RELEASE_RULE, 'git push origin feature/x').action).not.toBe('deny')
  })

  it('matches the remote sub-dimension', () => {
    const d = verdict(RELEASE_RULE, 'git fetch origin')
    expect(d.action).toBe('allow')
  })
})

describe('branch dimension — no effect on rules without it', () => {
  const NO_BRANCH = `
permissions:
  defaultAction: ask
  deny:
    - command: [dd]
      reason: dd is always denied
`

  it('leaves other dimensions untouched', () => {
    expect(verdict(NO_BRANCH, 'dd if=/dev/zero of=x').action).toBe('deny')
    expect(verdict(NO_BRANCH, 'ls -la').action).toBe('ask')
  })

  it('compiles a ruleset with no branch dimension at all', () => {
    const ruleset = compile(NO_BRANCH)
    expect(ruleset.deny[0]!.branch).toBeUndefined()
  })
})
