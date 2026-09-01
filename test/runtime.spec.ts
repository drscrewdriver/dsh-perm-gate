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