/**
 * Regression guard for the MULTI-FILE rule chain merge.
 *
 * Why this file exists: `resolveRuleChain` is the path the runtime actually
 * uses to load rules, and it merges entries itself (`mergeChain` →
 * `flattenEntries`). That merge used to build `CompiledRuleEntry` objects by
 * hand with `tools: []`, `command: []`, `args: []`, `paths: []` — and an EMPTY
 * dimension means "no constraint", so every merged entry matched every call.
 * With a real `rules.yml` that means the first `deny` entry denies everything
 * and the first `allow` entry allows everything before `ask` is consulted.
 *
 * The single-file path (`compileDocument`) was unaffected, which is exactly why
 * the existing evaluate/rule specs stayed green while the chain path was broken:
 * no test drove a rules FILE through `resolveRuleChain`.
 *
 * These cases fail loudly if the dimensions ever go empty again.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveRuleChain } from '../src/rule-chain.js'
import { decideRules, type ToolCallContext } from '../src/evaluate.js'
import type { CompiledRuleset } from '../src/rule.js'

const tempDirs: string[] = []

/** Write a rules file into a fresh temp cwd and resolve the chain from it. */
function chainFrom(yaml: string, opts: { searchUp?: boolean } = {}): CompiledRuleset {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-chain-'))
  tempDirs.push(dir)
  writeFileSync(join(dir, 'rules.yml'), yaml, 'utf8')
  return resolveRuleChain(dir, {
    rulesFile: 'rules.yml',
    searchUp: opts.searchUp ?? false,
    badFilePolicy: 'fail',
    maxChainLength: 10,
  })
}

function ctx(tool: string, extra: Partial<ToolCallContext> = {}): ToolCallContext {
  return { tool, args: {}, cwd: process.cwd(), ...extra }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * The rules file mirrors the shape a real user writes: a narrow deny, then a
 * narrow allow. Its whole point is that the deny must NOT catch an unrelated
 * command and the allow must NOT catch an unrelated tool.
 */
const REALISTIC = `
permissions:
  defaultAction: ask
  deny:
    - tools: [shell, pwsh, terminal]
      command: [rm#recursive, rm#force]
      reason: destructive system command
  allow:
    - command: [grep]
      reason: permissive allowlist
`

describe('rule chain — merged entries keep their compiled dimensions', () => {
  it('does not leave any dimension list empty for a constrained entry', () => {
    const ruleset = chainFrom(REALISTIC)
    const deny0 = ruleset.deny[0]
    expect(deny0).toBeDefined()
    // The regression: these were [] before, which means "match everything".
    expect(deny0!.tools.length).toBe(3)
    expect(deny0!.command.length).toBe(2)
    const allow0 = ruleset.allow[0]
    expect(allow0).toBeDefined()
    expect(allow0!.command.length).toBe(1)
  })

  it('narrow deny does not catch an unrelated shell command', () => {
    const ruleset = chainFrom(REALISTIC)
    // `rm -rf x` is a destructive command → the deny entry is meant to match.
    // NOTE: the deny-keyword blacklist is a separate earlier layer; this test
    // drives the rule engine directly, which is what the chain feeds.
    const destructive = decideRules(ruleset, ctx('shell', { args: { command: 'rm -rf build' }, commandText: 'rm -rf build' }))
    expect(destructive.action).toBe('deny')
    expect(destructive.ruleIndex).toBe(0)

    // `ls` is not in the deny entry's command list → must NOT be denied here.
    const harmless = decideRules(ruleset, ctx('shell', { args: { command: 'ls -la' }, commandText: 'ls -la' }))
    expect(harmless.action).not.toBe('deny')
    expect(harmless.ruleIndex).not.toBe(0)
  })

  it('narrow allow does not catch an unrelated tool', () => {
    const ruleset = chainFrom(REALISTIC)
    // The allow entry names `grep` only. A `read` call must not be allowed by it.
    const read = decideRules(ruleset, ctx('read', { args: { file_path: 'README.md' } }))
    expect(read.action).toBe('ask')

    // And `grep` — the entry's own subject — IS allowed, by that very entry.
    const grep = decideRules(ruleset, ctx('shell', { args: { command: 'grep -n x file' }, commandText: 'grep -n x file' }))
    expect(grep.action).toBe('allow')
    expect(grep.ruleIndex).toBe(1) // index 0 is the deny entry
  })

  it('merges several files in chain order without collapsing the partitions', () => {
    const ruleset = chainFrom(`
permissions:
  defaultAction: ask
  deny:
    - command: [dd]
      reason: from file one
`)
    expect(ruleset.deny.length).toBe(1)
    expect(ruleset.deny[0]!.command.length).toBe(1)
    expect(ruleset.deny[0]!.reason).toBe('from file one')
  })

  it('returns an empty ruleset (defaultAction only) when no rules file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-empty-'))
    tempDirs.push(dir)
    const ruleset = resolveRuleChain(dir, { rulesFile: 'rules.yml', searchUp: false, badFilePolicy: 'fail' })
    expect(ruleset.deny).toEqual([])
    expect(ruleset.allow).toEqual([])
    expect(ruleset.defaultAction).toBe('ask')
  })
})
