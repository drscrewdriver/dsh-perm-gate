import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.js'
import { PermGateRuntime } from '../src/runtime.js'
import { resolve } from 'node:path'

const RULES = resolve(__dirname, 'fixtures', 'permissions.yaml')

function rt(extra: {
  permissive?: boolean
  alwaysConfirm?: boolean
  llmAssist?: boolean
  trustAutoAllow?: boolean
  classify?: (exec: { name: string; arguments: Record<string, unknown> }) => 'allow' | 'deny' | 'ask'
} = {}): PermGateRuntime {
  return new PermGateRuntime({
    rulesFile: RULES,
    dshHome: '/home/u/.dsh',
    caseInsensitivePaths: true,
    permissive: extra.permissive || undefined,
    permissiveStrategies: {
      trustAutoAllow: extra.trustAutoAllow,
      alwaysConfirm: extra.alwaysConfirm,
      llmAssist: extra.llmAssist,
    },
    classify: extra.classify,
  })
}

describe('Permissive independent tier', () => {
  it('is off by default and leaves the baseline path unchanged', () => {
    const r = rt()
    expect(r.permissive).toBe(false)
    // rule-allow still delegates; unmatched still asks.
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' })).toBeUndefined()
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('ask')
  })

  it('exposes a single switch + combinable backend strategies', () => {
    const r = rt({ permissive: true })
    expect(r.permissive).toBe(true)
    // backend default: trustAutoAllow on, others off (resolved via resolveConfig).
    expect(r.permissiveStrategies).toEqual({ trustAutoAllow: true, alwaysConfirm: false, llmAssist: false })
  })

  it('trustAutoAllow (baseline middle tier) still auto-allows in-scope safe ops', () => {
    const r = rt({ permissive: true, trustAutoAllow: true })
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' })).toBeUndefined()
    expect(r.auditEntries[0].outcome).toBe('allow')
  })

  it('alwaysConfirm escalates a rule-allow to ask', () => {
    const r = rt({ permissive: true, alwaysConfirm: true })
    const d = r.decideExecution({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' })
    expect(d?.kind).toBe('ask')
    expect(d?.reason).toMatch(/permissive always-confirm/)
    expect(r.auditEntries[0].source).toBe('permissive')
  })

  it('never escalates a hard-deny or a minted grant under alwaysConfirm', () => {
    const deny = rt({ permissive: true, alwaysConfirm: true })
    expect(deny.decideExecution({ name: 'bash', arguments: { command: 'rm -rf /work/bin' }, cwd: '/work' })?.kind).toBe('deny')

    const granted = rt({ permissive: true, alwaysConfirm: true })
    granted.grant({ name: 'bash', arguments: { command: 'git push' }, parentAuthorized: true }, 1, 60_000)
    expect(
      granted.decideExecution({ name: 'bash', arguments: { command: 'git push' }, cwd: '/work', parentAuthorized: true }),
    ).toBeUndefined()
    expect(granted.auditEntries[0].source).toBe('grant')
  })

  it('llmAssist can allow an ask via classifier, recorded as classifier source', () => {
    const r = rt({ permissive: true, llmAssist: true, classify: () => 'allow' })
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })).toBeUndefined()
    expect(r.auditEntries[0].outcome).toBe('allow')
    expect(r.auditEntries[0].source).toBe('classifier')
  })

  it('llmAssist can deny an ask via classifier', () => {
    const r = rt({ permissive: true, llmAssist: true, classify: () => 'deny' })
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('deny')
  })

  it('llmAssist without a classifier falls back to the human seam (fail-closed)', () => {
    const r = rt({ permissive: true, llmAssist: true })
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('ask')
    expect(r.auditEntries[0].source).toBe('default')
  })

  it('strategies compose: alwaysConfirm + llmAssist resolve an escalated ask', () => {
    const r = rt({ permissive: true, alwaysConfirm: true, llmAssist: true, classify: () => 'allow' })
    // pnpm install is a rule-allow → escalated to ask by alwaysConfirm → allowed by classifier.
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' })).toBeUndefined()
    expect(r.auditEntries[0].source).toBe('classifier')
  })
})

describe('resolveConfig permissive', () => {
  it('fills backend strategies and the single switch', () => {
    expect(resolveConfig({}).permissive).toBe(false)
    expect(resolveConfig({ permissive: true })).toMatchObject({ permissive: true })
    expect(resolveConfig({ permissiveStrategies: { alwaysConfirm: true } }).permissiveStrategies).toMatchObject({
      trustAutoAllow: true,
      alwaysConfirm: true,
      llmAssist: false,
    })
  })
})