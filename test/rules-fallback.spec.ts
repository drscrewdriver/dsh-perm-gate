import { describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'
import { makePreExecuteListener } from '../src/index.js'
import type { PreToolDecisionLike, ToolExecutionLike } from '../src/runtime.js'

const RULES = undefined // no rules file: every call lands on the default ask

function exec(command: string): ToolExecutionLike {
  return { name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1' } as ToolExecutionLike
}

/**
 * Automatic review (`permissive` + `llmAssist`) with an optional grader. With no
 * `riskHook` and no endpoint there is *no reviewer at all* — the shape a headless run
 * hits when nobody configured a model, or the configured one is down.
 */
function reviewRuntime(extra: Record<string, unknown> = {}, unresolved = false): PermGateRuntime {
  return new PermGateRuntime({
    rulesFile: RULES,
    permissive: true,
    permissiveStrategies: { llmAssist: true },
    ...(unresolved ? { riskHook: async () => ({ kind: 'unresolved' }) } : {}),
    ...extra,
  }) as unknown as PermGateRuntime
}

describe('degraded review (rulesFallback) — no reviewer ⇒ rule-only gate', () => {
  /** The baseline this feature replaces: an ungradable ask waits on a human. */
  it('without the switch, an ungraded ask still goes to the human', async () => {
    const r = reviewRuntime()
    const e = exec('npm install left-pad')
    const ask = r.decideExecution(e)
    expect(ask?.kind).toBe('ask')
    expect((await r.refineAsk(e, ask as never))?.kind).toBe('ask')
  })

  it('with the switch, an ordinary ask runs — no human, no model', async () => {
    const r = reviewRuntime({ rulesFallback: true })
    const e = exec('npm install left-pad')
    const ask = r.decideExecution(e)
    expect(await r.refineAsk(e, ask as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
    expect(r.auditEntries.at(-1)?.reason).toContain('rules-fallback: allow')
  })

  /**
   * Danger the deterministic nets can name is what the degraded gate *keeps* catching:
   * an unlearnable data destruction is blocked rather than parked, and the reason tags
   * which signal fired so the feedback layer can classify it.
   */
  it('blocks an unlearnable act and tags the signal', async () => {
    const r = reviewRuntime({ rulesFallback: true })
    const e = exec('docker volume rm myvol')
    const ask = r.decideExecution(e)
    const out = await r.refineAsk(e, ask as never)
    expect(out?.kind).toBe('deny')
    expect(out?.reason).toContain('[rules-fallback-danger:data-destruction]')
    expect(out?.displayReason?.zh).toContain('无可用审查模型')
    expect(r.auditEntries.at(-1)?.outcome).toBe('deny')
  })

  /**
   * A payload nobody could read gets the same treatment without any rule-layer help:
   * built straight from the call, because the same command is *already* a P0 deny on the
   * normal path (`-EncodedCommand` blob) and never needs the degraded branch.
   */
  it('treats an opaque payload as danger (manual_only for the feedback layer)', () => {
    const r = reviewRuntime({ rulesFallback: true })
    const e = exec('pwsh -EncodedCommand UgBlAG0AbwB2AGUALQBJAHQAZQBtACAALQBSAGUAYwB1AHIAcwBlACAALQBGAG8AcgBjAGUAIABDADoAXAA=')
    const out = r.resolveRulesDegrade(e, { kind: 'ask', reason: 'no rule matched; default action' })
    expect(out?.kind).toBe('deny')
    expect(out?.reason).toContain('[rules-fallback-danger:opaque-payload]')
  })

  /**
   * The other half of "无模型": the reviewer *was* configured and gave up (timeout,
   * malformed answer → `unresolved`). The outage must not impersonate a security
   * judgement by stalling on a popup — the nets decide instead.
   */
  it('degrades a reviewer outage the same way', async () => {
    const on = reviewRuntime({ rulesFallback: true }, true)
    const benign = exec('npm install left-pad')
    expect(await on.refineAsk(benign, on.decideExecution(benign) as never)).toBeUndefined()
    const dangerous = exec('docker volume rm myvol')
    expect((await on.refineAsk(dangerous, on.decideExecution(dangerous) as never))?.kind).toBe('deny')

    // Off: the same outage still surfaces as an ask, labelled as unresolved.
    const off = reviewRuntime({}, true)
    const ask = off.decideExecution(benign)
    const kept = await off.refineAsk(benign, ask as never)
    expect(kept?.kind).toBe('ask')
    expect(kept?.reason).toContain('llm-assist unresolved')
  })

  /**
   * Degradation only ever *widens an ask*: a deterministic deny arrives before any
   * grading, so switching the fallback on cannot talk the gate into running `rm -rf /`.
   */
  it('never softens a deterministic deny', () => {
    const r = reviewRuntime({ rulesFallback: true })
    expect(r.decideExecution(exec('rm -rf /'))?.kind).toBe('deny')
  })

  it('isRulesFallback reads the live switch', () => {
    expect(new PermGateRuntime({ rulesFile: RULES, rulesFallback: true }).isRulesFallback()).toBe(true)
    expect(new PermGateRuntime({ rulesFile: RULES }).isRulesFallback()).toBe(false)
    expect(new PermGateRuntime({ rulesFile: RULES, readRulesFallback: () => true }).isRulesFallback()).toBe(true)
  })
})

describe('degraded block feeds 工具审核意见 back like YOLO does', () => {
  it('runs an allowed call without feedback', async () => {
    const r = reviewRuntime({ rulesFallback: true })
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    expect(await listener(exec('npm install left-pad'), async () => 'RAN')).toBe('RAN')
    expect(seen).toHaveLength(0)
  })

  it('blocks and feeds back once for an unlearnable act', async () => {
    const r = reviewRuntime({ rulesFallback: true })
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    const out = await listener(exec('docker volume rm myvol'), async () => 'RAN')
    expect((out as PreToolDecisionLike).kind).toBe('deny')
    expect(seen).toHaveLength(1)
    expect(seen[0].reason).toContain('rules-fallback: block')
  })

  /**
   * A human rejection is an ask the human answered, not a degraded block: only the
   * deny path owes the main LLM an opinion.
   */
  it('does not feed back when the ask survives to the human', async () => {
    const r = reviewRuntime()
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    const out = await listener(exec('docker volume rm myvol'), async () => 'RAN')
    expect((out as PreToolDecisionLike).kind).toBe('ask')
    expect(seen).toHaveLength(0)
  })
})
