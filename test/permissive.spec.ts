import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.js'
import { PermGateRuntime } from '../src/runtime.js'
import type { RiskVerdict } from '../src/risk.js'
import { resolve } from 'node:path'

const RULES = resolve(__dirname, 'fixtures', 'permissions.yaml')

function rt(extra: {
  permissive?: boolean
  alwaysConfirm?: boolean
  llmAssist?: boolean
  trustAutoAllow?: boolean
  risk?: RiskVerdict
  riskLearning?: boolean
  riskThreshold?: number
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
    riskHook: extra.risk === undefined ? undefined : async () => extra.risk as RiskVerdict,
    readRiskLearning: () => ({ enabled: extra.riskLearning ?? false, threshold: extra.riskThreshold ?? 3 }),
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
    // backend default: trustAutoAllow and trustEscalation on, the two confirm paths off.
    expect(r.permissiveStrategies).toEqual({ trustAutoAllow: true, alwaysConfirm: false, llmAssist: false, trustEscalation: true })
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
    // ask is tracked in pending asks (not in audit anymore)
    expect(r.pendingAskCount()).toBe(1)
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

  it('llmAssist risk-safe allows an ask, recorded as classifier source', async () => {
    const r = rt({ permissive: true, llmAssist: true, risk: { kind: 'safe' } })
    const ask = r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })
    expect(ask?.kind).toBe('ask')
    expect(await r.refineAsk({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }, ask as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
    expect(r.auditEntries.at(-1)?.source).toBe('classifier')
  })

  it('llmAssist risky hard category auto-denies without popup', async () => {
    const r = rt({ permissive: true, llmAssist: true, risk: { kind: 'risky', category: 'deletion' } })
    const ask = r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }) as never
    const refined = await r.refineAsk({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }, ask)
    expect(refined?.kind).toBe('deny')
    expect(refined?.reason).toMatch(/risky:deletion/)
    expect(r.pendingCount()).toBe(0) // untracked: no human answer needed
  })

  it('llmAssist without classifier config falls back to the human seam (fail-closed)', async () => {
    const r = rt({ permissive: true, llmAssist: true })
    const ask = r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }) as never
    expect((await r.refineAsk({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }, ask))?.kind).toBe('ask')
    // ask is tracked in pending asks (not in audit anymore)
    expect(r.pendingAskCount()).toBe(1)
  })

  it('llmAssist unresolved verdict keeps the ask and learns nothing', async () => {
    const r = rt({ permissive: true, llmAssist: true, risk: { kind: 'unresolved' }, riskLearning: true, riskThreshold: 1 })
    const ask = r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }) as never
    expect((await r.refineAsk({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' }, ask))?.kind).toBe('ask')
    expect(r.pendingCount()).toBe(0)
  })

  it('strategies compose: alwaysConfirm + llmAssist resolve an escalated ask', async () => {
    const r = rt({ permissive: true, alwaysConfirm: true, llmAssist: true, risk: { kind: 'safe' } })
    // pnpm install is a rule-allow → escalated to ask by alwaysConfirm → allowed by the risk grader.
    const ask = r.decideExecution({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' })
    expect(ask?.kind).toBe('ask')
    expect(await r.refineAsk({ name: 'bash', arguments: { command: 'pnpm install' }, cwd: '/work' }, ask as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.source).toBe('classifier')
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

  it('fills the risk-learning defaults', () => {
    expect(resolveConfig({})).toMatchObject({ riskLearning: true, riskThreshold: 1, riskTimeoutMs: 20_000 })
    expect(resolveConfig({ riskLearning: true, riskThreshold: 5 })).toMatchObject({ riskLearning: true, riskThreshold: 5 })
  })
})
