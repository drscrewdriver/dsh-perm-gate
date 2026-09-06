import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'
import type { RiskVerdict } from '../src/risk.js'

const RULES = undefined // no rules file: everything defaults to ask
const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-risk-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const EXEC = { name: 'bash', arguments: { command: 'npm install left-pad' }, cwd: '/work', sessionId: 's1' }

describe('verdict learning end-to-end (refineAsk + settleExecution)', () => {
  it('learns a neutral ask after human-approved executions, then auto-allows the same op', async () => {
    const learningFile = join(tmpDir(), 'perm-gate', 'learning.json')
    const risk: RiskVerdict = { kind: 'risky', category: 'neutral' }
    const r = new PermGateRuntime({
      rulesFile: RULES,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => risk,
      readRiskLearning: () => ({ enabled: true, threshold: 2 }),
      learningFile,
    })

    // Round 1: neutral → ask + pending candidate.
    const ask1 = r.decideExecution(EXEC)
    expect(ask1?.kind).toBe('ask')
    expect((await r.refineAsk(EXEC, ask1 as never))?.kind).toBe('ask')
    expect(r.pendingCount()).toBe(1)

    // The human approved and the call executed → one confirmation settled.
    r.settleExecution(EXEC)
    expect(r.pendingCount()).toBe(0)
    expect(r.learningSnapshot().confirmed['bash|neutral']).toBe(1)

    // Round 2: threshold is 2 → still asks and learns.
    const ask2 = r.decideExecution(EXEC)
    expect((await r.refineAsk(EXEC, ask2 as never))?.kind).toBe('ask')
    r.settleExecution(EXEC)
    expect(r.learningSnapshot().confirmed['bash|neutral']).toBe(2)

    // Round 3: threshold reached + exact fingerprint sample → auto-allow.
    const ask3 = r.decideExecution(EXEC)
    expect(ask3?.kind).toBe('ask')
    expect(await r.refineAsk(EXEC, ask3 as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
    expect(r.auditEntries.at(-1)?.source).toBe('classifier')
  })

  it('a different target after learning still asks (no cross-target replay)', async () => {
    const r = new PermGateRuntime({
      rulesFile: RULES,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => ({ kind: 'risky', category: 'neutral' }),
      readRiskLearning: () => ({ enabled: true, threshold: 1 }),
    })
    const ask = r.decideExecution(EXEC)
    await r.refineAsk(EXEC, ask as never)
    r.settleExecution(EXEC)

    const other = { ...EXEC, arguments: { command: 'npm install right-pad' } }
    const ask2 = r.decideExecution(other)
    expect((await r.refineAsk(other, ask2 as never))?.kind).toBe('ask')
  })

  it('learning disabled: neutral asks never register pending candidates', async () => {
    const r = new PermGateRuntime({
      rulesFile: RULES,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => ({ kind: 'risky', category: 'neutral' }),
      readRiskLearning: () => ({ enabled: false, threshold: 1 }),
    })
    const ask = r.decideExecution(EXEC)
    await r.refineAsk(EXEC, ask as never)
    expect(r.pendingCount()).toBe(0)
    r.settleExecution(EXEC) // no-op
    expect(r.learningSnapshot().confirmed).toEqual({})
  })

  it('hard-risk asks are never learned even with learning enabled', async () => {
    const r = new PermGateRuntime({
      rulesFile: RULES,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => ({ kind: 'risky', category: 'credential' }),
      readRiskLearning: () => ({ enabled: true, threshold: 1 }),
    })
    const ask = r.decideExecution(EXEC)
    const refined = await r.refineAsk(EXEC, ask as never)
    expect(refined?.kind).toBe('ask')
    expect(r.pendingCount()).toBe(0)
  })

  it('learning state persists across runtime instances', async () => {
    const dir = tmpDir()
    const learningFile = join(dir, 'perm-gate', 'learning.json')
    const make = () =>
      new PermGateRuntime({
        rulesFile: RULES,
        permissive: true,
        permissiveStrategies: { llmAssist: true },
        riskHook: async () => ({ kind: 'risky', category: 'neutral' }),
        readRiskLearning: () => ({ enabled: true, threshold: 1 }),
        learningFile,
      })
    const first = make()
    const ask = first.decideExecution(EXEC)
    await first.refineAsk(EXEC, ask as never)
    first.settleExecution(EXEC)

    const second = make()
    const ask2 = second.decideExecution(EXEC)
    expect(await second.refineAsk(EXEC, ask2 as never)).toBeUndefined()
  })
})
