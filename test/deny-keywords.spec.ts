import { describe, expect, it } from 'vitest'
import { DEFAULT_DENY_KEYWORDS } from '../src/deny-defaults.js'
import { PermGateRuntime } from '../src/runtime.js'

const EXEC = (command: string) => ({ name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1' })

describe('preset deny-keyword layer (inherited from dsh-approval-gate)', () => {
  it('applies the preset list when the namespace carries no override', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const decision = r.decideExecution(EXEC('rm -rf /work/build'))
    expect(decision?.kind).toBe('deny')
    expect(decision?.reason).toContain('rm -rf')
  })

  it('matches case-insensitively and inside longer command text', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(EXEC('git push --force origin main'))?.kind).toBe('deny')
    expect(r.decideExecution(EXEC('echo DROP TABLE users;'))?.kind).toBe('deny')
  })

  it('lets innocent calls through to the normal chain (defaultAction ask)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const decision = r.decideExecution(EXEC('npm install left-pad'))
    expect(decision?.kind).not.toBe('deny')
  })

  it('an explicit override replaces the preset (deny side stays additive: can deny, never widen)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywords: () => ['terraform destroy'] })
    expect(r.decideExecution(EXEC('rm -rf /work/build'))?.kind).not.toBe('deny')
    expect(r.decideExecution(EXEC('terraform destroy -auto-approve'))?.kind).toBe('deny')
  })

  it('an empty override is treated as unset and applies the preset (blacklist stays on)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywords: () => [] })
    expect(r.decideExecution(EXEC('rm -rf /work/build'))?.kind).toBe('deny')
  })

  it('also scans serialized arguments when there is no command text', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const decision = r.decideExecution({ name: 'edit', arguments: { note: 'please sudo rm the cache' }, sessionId: 's1' })
    expect(decision?.kind).toBe('deny')
  })

  /**
   * B6 wiring. The point of scanning decoded layers is the encoded blob, not the
   * plain one: `-EncodedCommand` is invisible to every keyword otherwise. The
   * payload chosen is one P0 does *not* deny (a force push to a non-protected
   * branch), so a deny here can only have come from this layer.
   */
  it('matches a keyword that only exists inside an encoded layer', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const blob = Buffer.from('git push --force origin feature/x', 'utf16le').toString('base64')
    const command = `powershell -EncodedCommand ${blob}`
    const decision = r.decideExecution({ name: 'pwsh', arguments: { command }, commandText: command, cwd: '/work', sessionId: 's1' })
    expect(decision?.kind).toBe('deny')
    expect(decision?.reason).toContain('push --force')
    // The reason names the keyword and never the decoded blob (no secret replay).
    expect(decision?.reason).not.toContain(blob)
  })

  it('does not treat base64 that is merely data, not input to an execution primitive, as an act', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const blob = Buffer.from('git push --force origin main').toString('base64')
    const decision = r.decideExecution({
      name: 'bash', arguments: { command: `git commit -m "stored payload ${blob}"` },
      commandText: `git commit -m "stored payload ${blob}"`, cwd: '/work', sessionId: 's1',
    })
    expect(decision?.kind).not.toBe('deny')
  })

  it('keeps the preset list non-empty and deny-shaped', () => {
    expect(DEFAULT_DENY_KEYWORDS.length).toBeGreaterThan(20)
    expect(DEFAULT_DENY_KEYWORDS).toContain('rm -rf')
    expect(DEFAULT_DENY_KEYWORDS).toContain('git reset --hard')
    expect(DEFAULT_DENY_KEYWORDS).toContain('docker system prune')
  })
})
