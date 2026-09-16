/**
 * The dry-run surface: one call evaluated against a rules file, reported so both
 * the CLI and the settings-card "rule test" panel can show it.
 *
 * Two properties are load-bearing here and each gets its own case below:
 *
 * 1. The reported `ruleIndex` / `matchedDimensions` come from the RULE LAYER
 *    only. A P0 hard-deny or a preset deny-keyword fires before it and carries
 *    no index, so the dry-run must not invent one.
 * 2. A dry-run is read-only. It must not append to the live audit feed, write an
 *    event, or create any file — the panel calls it on every keystroke.
 */
import { existsSync, mkdtempSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDryRunRuntime, runDryRun } from '../src/dry-run.js'
import { PermGateRuntime } from '../src/runtime.js'

const tempDirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-dryrun-'))
  tempDirs.push(dir)
  return dir
}

/** Write a rules file into a fresh temp dir and return its path. */
function rulesFile(yaml: string): { dir: string; file: string } {
  const dir = tempDir()
  const file = join(dir, 'rules.yml')
  writeFileSync(file, yaml, 'utf8')
  return { dir, file }
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true })
  }
})

const RULES = `
permissions:
  defaultAction: ask
  deny:
    - tools: [webfetch]
      reason: no outbound fetches
    - tools: [shell]
      command: [curl]
      reason: no piped downloads
  allow:
    - tools: [inspect]
      reason: safe inspector
`

describe('runDryRun — rule-layer reporting', () => {
  it('reports the deny rule that matched, with its index and dimensions', () => {
    const { file } = rulesFile(RULES)
    const result = runDryRun({ tool: 'webfetch', args: {}, rulesFile: file })

    expect(result.verdict).toBe('deny')
    expect(result.ruleLayer.action).toBe('deny')
    expect(result.ruleLayer.ruleIndex).toBe(0)
    expect(result.ruleLayer.matchedDimensions).toEqual(['tools'])
    expect(result.ruleLayer.source?.reason).toBe('no outbound fetches')
  })

  it('reports every dimension a multi-dimension rule constrains', () => {
    const { file } = rulesFile(RULES)
    const result = runDryRun({ tool: 'shell', args: { command: 'curl https://example.com' }, rulesFile: file })

    expect(result.verdict).toBe('deny')
    expect(result.ruleLayer.ruleIndex).toBe(1)
    // Both dimensions are constrained by the entry; the report lists what the
    // rule constrains, not a single "cause" (dimensions are ANDed, so no single
    // one of them can be blamed without lying).
    expect(result.ruleLayer.matchedDimensions).toEqual(['tools', 'command'])

    // And the AND is real: the same tool without the named command does NOT match.
    const noCommand = runDryRun({ tool: 'shell', args: { command: 'ls -la' }, rulesFile: file })
    expect(noCommand.ruleLayer.ruleIndex).toBeUndefined()
  })

  it('reports the allow rule that matched', () => {
    const { file } = rulesFile(RULES)
    const result = runDryRun({ tool: 'inspect', args: {}, rulesFile: file })

    expect(result.verdict).toBe('allow')
    expect(result.ruleLayer.action).toBe('allow')
    // Indices are chain-wide: the two deny entries come first.
    expect(result.ruleLayer.ruleIndex).toBe(2)
    expect(result.ruleLayer.matchedDimensions).toEqual(['tools'])
  })

  it('falls back to defaultAction with no matched rule', () => {
    const { file } = rulesFile(RULES)
    const result = runDryRun({ tool: 'nonexistent_tool', args: {}, rulesFile: file })

    expect(result.verdict).toBe('ask')
    expect(result.defaultAction).toBe('ask')
    expect(result.ruleLayer.ruleIndex).toBeUndefined()
    expect(result.ruleLayer.matchedDimensions).toEqual([])
    expect(result.ruleCount).toBe(3)
  })

  it('does not attribute a rule index to a verdict that came from an earlier layer', () => {
    const { file } = rulesFile(RULES)
    // `rm -rf` is caught by the preset deny-keyword blacklist, which runs BEFORE
    // the rule chain — so there is no rule to name, and naming one would be a
    // fabrication. The rule layer's own answer is still reported separately.
    const result = runDryRun({ tool: 'shell', args: { command: 'rm -rf build' }, rulesFile: file })

    expect(result.verdict).toBe('deny')
    expect(result.reason).toContain('deny-keyword')
    expect(result.ruleLayer.ruleIndex).toBeUndefined()
  })
})

describe('runDryRun — loading rules', () => {
  it('fails loud on a malformed rules file', () => {
    const { file } = rulesFile('permissions:\n  deny: [ this is not a rule entry\n')
    expect(() => runDryRun({ tool: 'webfetch', args: {}, rulesFile: file })).toThrow()
  })

  it('resolves the default rules file from the chain root when none is given', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'rules.yml'), RULES, 'utf8')

    // No `rulesFile`: the chain resolver looks for `rules.yml` under the cwd it
    // is given. This is the shape the host route uses (a session workspace).
    const gate = new PermGateRuntime({ cwd: dir, searchUp: true })
    const result = runDryRun({ tool: 'webfetch', args: {}, cwd: dir }, gate)

    expect(result.ruleCount).toBe(3)
    expect(result.ruleLayer.ruleIndex).toBe(0)
  })

  it('reports an empty ruleset rather than throwing when nothing is found', () => {
    const dir = tempDir()
    const result = runDryRun({ tool: 'webfetch', args: {}, cwd: dir }, new PermGateRuntime({ cwd: dir, searchUp: true }))

    // A missing file is not a malformed one: ruleCount 0 is the signal the UI
    // needs to say "no rules loaded" instead of "nothing matched".
    expect(result.ruleCount).toBe(0)
    expect(result.defaultAction).toBe('ask')
  })

  it('accepts an injected runtime, so a caller can evaluate the LIVE ruleset', () => {
    const { file } = rulesFile(RULES)
    const result = runDryRun({ tool: 'inspect', args: {} }, createDryRunRuntime({ rulesFile: file }))
    expect(result.ruleLayer.ruleIndex).toBe(2)
  })
})

describe('runDryRun — read-only', () => {
  it('creates no file and records no event', () => {
    const { dir, file } = rulesFile(RULES)
    const result = runDryRun({ tool: 'webfetch', args: {}, rulesFile: file })

    // No host view was requested, so nothing ran the side-effecting path.
    expect(result.host).toBeUndefined()
    expect(existsSync(join(dir, 'events.jsonl'))).toBe(false)
    expect(readdirSync(dir)).toEqual(['rules.yml'])
  })

  it("leaves the runtime's audit mirror untouched", () => {
    const { file } = rulesFile(RULES)
    const gate = createDryRunRuntime({ rulesFile: file })
    expect(gate.auditEntries.length).toBe(0)

    // A call the host-facing path WOULD record an entry for (it denies).
    const result = runDryRun({ tool: 'webfetch', args: {} }, gate)

    expect(result.verdict).toBe('deny')
    // The property that matters: a read-only caller running on a live runtime
    // must not append a single audit entry or decision event.
    expect(gate.auditEntries.length).toBe(0)
  })

  it('reports the policy verdict even when the session could not deliver an ask', () => {
    const { file } = rulesFile(RULES)
    // A runtime whose session cannot answer an ask (`approval: never`). The
    // host-facing path degrades that ask to a passthrough and reports "allow";
    // the policy answer is still "ask". Showing the degraded form in the panel
    // states the opposite of the truth for every rule a human opens it to
    // review — measured on the live host: `shell ls -la` reported `allow` while
    // the rule layer said `ask`.
    const gate = createDryRunRuntime({ rulesFile: file })
    const internals = gate as unknown as { options: Record<string, unknown> }
    internals.options = { ...internals.options, readApprovalPolicy: () => 'never' }

    const result = runDryRun({ tool: 'unknown_tool', args: {}, hostView: true }, gate)

    expect(result.verdict).toBe('ask')
    expect(result.reason).toContain('no rule matched')
    // The host view stays available and still disagrees — both are reported
    // rather than one silently replacing the other.
    expect(result.host?.verdict).toBe('allow')
    expect(result.host?.reason).toBe('(default/passthrough)')
  })

  it('is repeatable — the same input yields the same report', () => {
    const { file } = rulesFile(RULES)
    const first = runDryRun({ tool: 'webfetch', args: {}, rulesFile: file })
    const second = runDryRun({ tool: 'webfetch', args: {}, rulesFile: file })
    expect(second).toEqual(first)
  })
})
