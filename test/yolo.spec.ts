import { describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'
import { makePreExecuteListener } from '../src/index.js'
import type { PreToolDecisionLike, ToolExecutionLike } from '../src/runtime.js'

const RULES = undefined // no rules file: everything defaults to ask

function exec(command: string, preset?: string): ToolExecutionLike {
  // The YOLO implementation now owns one preset (`permissive-yolo`) and nothing else, so a
  // call that should be taken over by it has to say which tier its session is in.
  const events = preset === undefined ? [] : [{ type: 'permission/preset', data: { preset } }]
  return { name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1', events } as ToolExecutionLike
}

function yoloRuntime(riskHook?: (command: string) => Promise<{ kind: 'safe' } | { kind: 'risky'; category: string }>): PermGateRuntime {
  return new PermGateRuntime({
    rulesFile: RULES,
    yolo: true,
    ...(riskHook === undefined ? {} : { riskHook: async (req) => riskHook(String((req.args as { command?: string })?.command ?? '')) as never }),
  })
}

describe('YOLO resolveYolo — never human-confirm, block only on danger', () => {
  it('allows a benign ask when the grader says neutral (no human)', async () => {
    const r = yoloRuntime(async () => ({ kind: 'risky', category: 'neutral' }))
    const ask = r.decideExecution(exec('npm install left-pad'))
    expect(ask?.kind).toBe('ask')
    expect(await r.resolveYolo(exec('npm install left-pad'), ask as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
  })

  it('blocks when the grader reports a hard-risk category', async () => {
    const r = yoloRuntime(async () => ({ kind: 'risky', category: 'credential' }))
    const e = exec('cat ~/.npmrc')
    const ask = r.decideExecution(e)
    const y = await r.resolveYolo(e, ask as never)
    expect(y?.kind).toBe('deny')
    expect(y?.displayReason?.zh).toContain('已拦截危险命令')
    expect(r.auditEntries.at(-1)?.outcome).toBe('deny')
  })

  it('blocks an opaque payload deterministically, with no grader at all', async () => {
    const r = yoloRuntime() // no riskHook → classifier unusable
    const e = exec('pwsh -EncodedCommand UgBlAG0AbwB2AGUALQBJAHQAZQBtACAALQBSAGUAYwB1AHIAcwBlACAALQBGAG8AcgBjAGUAIABDADoAXAA=')
    const ask = r.decideExecution(e)
    const y = await r.resolveYolo(e, ask as never)
    // U tier: unreadable payload is danger, so YOLO blocks (fail-closed-to-block, not human).
    expect(y?.kind).toBe('deny')
  })

  it('allows an ordinary write with no grader and no danger signal', async () => {
    const r = yoloRuntime()
    const e = exec('echo hi > out.txt')
    const ask = r.decideExecution(e)
    expect(await r.resolveYolo(e, ask as never)).toBeUndefined()
  })

  it('isYolo reads the live switch', () => {
    expect(new PermGateRuntime({ rulesFile: RULES, yolo: true }).isYolo()).toBe(true)
    expect(new PermGateRuntime({ rulesFile: RULES }).isYolo()).toBe(false)
    expect(new PermGateRuntime({ rulesFile: RULES, readYolo: () => true }).isYolo()).toBe(true)
  })
})

describe('YOLO pre-execute listener — allow runs, block feeds back 工具审核意见', () => {
  it('runs an allowed call and does not feed back', async () => {
    const r = yoloRuntime(async () => ({ kind: 'risky', category: 'neutral' }))
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    const out = await listener(exec('npm install left-pad', 'permissive-yolo'), async () => 'RAN')
    expect(out).toBe('RAN')
    expect(seen).toHaveLength(0)
  })

  it('blocks a dangerous call and invokes feedback once', async () => {
    const r = yoloRuntime(async () => ({ kind: 'risky', category: 'deletion' }))
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    // Not a deny-keyword command, so the path exercised is resolveYolo's model-driven
    // block (which carries the 已拦截 displayReason), not the deterministic deny-keyword.
    const out = await listener(exec('cat ~/.npmrc', 'permissive-yolo'), async () => 'RAN')
    expect((out as PreToolDecisionLike).kind).toBe('deny')
    expect(seen).toHaveLength(1)
    expect(seen[0].displayReason?.zh).toContain('已拦截危险命令')
  })

  it('a grader that throws fails open to allow (never a human prompt)', async () => {
    const r = new PermGateRuntime({
      rulesFile: RULES,
      yolo: true,
      riskHook: async () => { throw new Error('grader down') },
    })
    const listener = makePreExecuteListener(r, () => { /* no feedback expected */ })
    const out = await listener(exec('npm install left-pad', 'permissive-yolo'), async () => 'RAN')
    expect(out).toBe('RAN')
  })
})
