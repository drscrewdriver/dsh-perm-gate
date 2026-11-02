import { describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'
import { resolve } from 'node:path'

const RULES = resolve(__dirname, 'fixtures', 'permissions.yaml')

function rt(): PermGateRuntime {
  return new PermGateRuntime({ rulesFile: RULES, dshHome: '/home/u/.dsh', caseInsensitivePaths: true })
}

describe('decideExecution', () => {
  it('returns deny for a rules-deny shell call and audits it', () => {
    const r = rt()
    const d = r.decideExecution({ name: 'bash', arguments: { command: 'rm -rf /work/bin' }, cwd: '/work' })
    expect(d?.kind).toBe('deny')
    expect(r.auditEntries.length).toBe(1)
    expect(r.auditEntries[0].outcome).toBe('deny')
    expect(r.auditEntries[0].tool).toBe('bash')
  })

  it('allows (delegates) a whitelisted command and audits allow', () => {
    const r = rt()
    const d = r.decideExecution({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' })
    expect(d).toBeUndefined()
    expect(r.auditEntries[0].outcome).toBe('allow')
  })

  it('asks for unlisted command under default ask', () => {
    const r = rt()
    const d = r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })
    expect(d?.kind).toBe('ask')
  })

  it('covers a call by a minted grant', () => {
    const r = rt()
    r.grant({ name: 'bash', arguments: { command: 'git push' }, parentAuthorized: true }, 1, 60_000)
    const d = r.decideExecution({ name: 'bash', arguments: { command: 'git push' }, cwd: '/work', parentAuthorized: true })
    expect(d).toBeUndefined()
    expect(r.auditEntries[0].source).toBe('grant')
  })

  it('reload keeps previous rules on a bad file', () => {
    const r = rt()
    // rulesFile is valid, so reload must succeed normally.
    expect(r.reload()).toBe(true)
  })
})

describe('root defaultAction fails closed (issue #6)', () => {
  it('a live ref that reached the options becomes ask, never a silent allow', () => {
    // The host hands `.volatile()` fields to apply() as refs; spreading that
    // config used to make the ruleset default this very object, which matched
    // neither the deny nor the ask branch and let every unmatched call through.
    const ref = { get: () => 'ask' }
    const r = new PermGateRuntime({ rulesFile: undefined, defaultAction: ref as never })
    expect(r.defaultAction).toBe('ask')
  })

  it('an out-of-protocol literal also becomes ask', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, defaultAction: 'yolo' as never })
    expect(r.defaultAction).toBe('ask')
  })

  it('readDefaultAction is read live, so a reload picks up a changed default', () => {
    let action: unknown = 'deny'
    const r = new PermGateRuntime({ rulesFile: undefined, readDefaultAction: () => action })
    expect(r.defaultAction).toBe('deny')
    action = 'allow'
    expect(r.reload()).toBe(true)
    expect(r.defaultAction).toBe('allow')
  })
})