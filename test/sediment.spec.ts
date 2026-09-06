import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { RiskLearning } from '../src/learning.js'
import { PermGateRuntime } from '../src/runtime.js'
import type { PermissiveState } from '../src/runtime.js'
import type { RiskVerdict } from '../src/risk.js'

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-sediment-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const EXEC = { name: 'bash', arguments: { command: 'npm install left-pad' }, cwd: '/work', sessionId: 's1' }
const NEUTRAL: RiskVerdict = { kind: 'risky', category: 'neutral' }

describe('learning sediment view (RiskLearning)', () => {
  it('exposes threshold-reached samples as sedimented rules and supports removal', () => {
    const file = join(tmpDir(), 'perm-gate', 'learning.json')
    const learning = new RiskLearning(file, { threshold: 2 })
    learning.confirm('bash|neutral', 'npm|left-pad', 'npm install left-pad')
    expect(learning.sedimented()).toEqual([]) // below threshold: nothing sedimented
    learning.confirm('bash|neutral', 'npm|left-pad', 'npm install left-pad')
    expect(learning.sedimented()).toHaveLength(1)
    expect(learning.sedimented()[0]).toMatchObject({ key: 'bash|neutral', fp: 'npm|left-pad' })

    learning.dropSample('bash|neutral', 'npm|left-pad')
    expect(learning.sedimented()).toEqual([])
    expect(learning.snapshot().samples['bash|neutral']).toBeUndefined()

    learning.confirm('bash|neutral', 'npm|left-pad', 'x')
    learning.confirm('bash|neutral', 'npm|other', 'y')
    learning.resetKey('bash|neutral')
    expect(learning.snapshot().confirmed['bash|neutral']).toBeUndefined()
    expect(learning.sedimented()).toEqual([])
  })

  it('persists and re-loads the sediment view across restarts', () => {
    const file = join(tmpDir(), 'perm-gate', 'learning.json')
    const first = new RiskLearning(file, { threshold: 1 })
    first.confirm('edit|neutral', 'package.json', 'edit package.json')
    const second = new RiskLearning(file, { threshold: 1 })
    expect(second.sedimented()).toHaveLength(1)
  })
})

describe('sediment auto-allow in the gate (llmAssist-independent)', () => {
  it('auto-allows a sedimented fingerprint with llmAssist OFF, before any LLM work', async () => {
    const learningFile = join(tmpDir(), 'perm-gate', 'learning.json')
    let strategies: PermissiveState['strategies'] = { trustAutoAllow: true, alwaysConfirm: false, llmAssist: true }
    let llmOff = false
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      riskHook: async () => {
        if (llmOff) throw new Error('LLM must not be reached for sedimented calls')
        return NEUTRAL
      },
      readPermissive: () => ({ enabled: true, strategies }),
      readRiskLearning: () => ({ enabled: true, threshold: 2 }),
      readRiskSediment: () => true,
      learningFile,
    })

    // Build up learning: two human-approved executions of the same call.
    for (let i = 0; i < 2; i += 1) {
      const ask = r.decideExecution(EXEC)
      expect(ask?.kind).toBe('ask')
      expect((await r.refineAsk(EXEC, ask as never))?.kind).toBe('ask')
      r.settleExecution(EXEC)
    }
    expect(r.learningSnapshot().confirmed['bash|neutral']).toBe(2)

    // Turn llmAssist off: the sedimented rule still auto-allows (no hook call,
    // the throwing riskHook above proves it is never reached).
    strategies = { trustAutoAllow: true, alwaysConfirm: false, llmAssist: false }
    llmOff = true
    const ask = r.decideExecution(EXEC)
    expect(ask?.kind).toBe('ask')
    expect(await r.refineAsk(EXEC, ask as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
    expect(r.auditEntries.at(-1)?.reason).toContain('sediment')
  })

  it('riskSediment off restores the llm-gated learning path', async () => {
    const learningFile = join(tmpDir(), 'perm-gate', 'learning.json')
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => NEUTRAL,
      readRiskLearning: () => ({ enabled: true, threshold: 1 }),
      readRiskSediment: () => false,
      learningFile,
    })
    const ask = r.decideExecution(EXEC)
    await r.refineAsk(EXEC, ask as never)
    r.settleExecution(EXEC)
    // Threshold reached and sample confirmed, but sedimentation is off: the
    // llm-gated shouldAutoAllow path inside the neutral branch still allows.
    const ask2 = r.decideExecution(EXEC)
    expect(await r.refineAsk(EXEC, ask2 as never)).toBeUndefined()
  })

  it('a different target never reuses the sedimented authority', async () => {
    const learningFile = join(tmpDir(), 'perm-gate', 'learning.json')
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: false },
      readRiskLearning: () => ({ enabled: true, threshold: 1 }),
      readRiskSediment: () => true,
      learningFile,
    })
    // Seed the store directly: bash|neutral confirmed with a different target.
    mkdirSync(dirname(learningFile), { recursive: true })
    writeFileSync(learningFile, JSON.stringify({
      version: 1,
      confirmed: { 'bash|neutral': 3 },
      samples: { 'bash|neutral': [{ fp: 'npm|left-pad', ctx: 'x', at: 1 }] },
    }), 'utf8')
    const other = { name: 'bash', arguments: { command: 'npm install right-pad' }, cwd: '/work', sessionId: 's1' }
    const ask = r.decideExecution(other)
    expect(ask?.kind).toBe('ask')
    expect((await r.refineAsk(other, ask as never))?.kind).toBe('ask')
  })

  it('learningReset removes a key or a single sample through the management seam', async () => {
    const learningFile = join(tmpDir(), 'perm-gate', 'learning.json')
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => NEUTRAL,
      readRiskLearning: () => ({ enabled: true, threshold: 1 }),
      readRiskSediment: () => true,
      learningFile,
    })
    const ask = r.decideExecution(EXEC)
    await r.refineAsk(EXEC, ask as never)
    r.settleExecution(EXEC)
    expect(r.learningSnapshot().confirmed['bash|neutral']).toBe(1)

    r.learningReset('bash|neutral', 'npm|left-pad')
    expect(r.learningSnapshot().samples['bash|neutral']).toBeUndefined()
    expect(r.learningSnapshot().confirmed['bash|neutral']).toBe(1)

    r.learningReset('bash|neutral')
    expect(r.learningSnapshot().confirmed['bash|neutral']).toBeUndefined()
    expect(readFileSync(learningFile, 'utf8')).toContain('"version": 1')
  })
})
