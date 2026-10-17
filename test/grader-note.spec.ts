import { describe, expect, it } from 'vitest'
import { graderNote } from '../src/risk.js'
import { PermGateRuntime } from '../src/runtime.js'
import { makePreExecuteListener } from '../src/index.js'
import { ruleIdOf } from '../src/feedback.js'
import type { PreToolDecisionLike, ToolExecutionLike } from '../src/runtime.js'

/**
 * Issue #3 asked for the model's own fields to reach the reasons rather than being
 * dropped on the floor: a confirmation that only says "a rule asked" wastes the sentence
 * the grader already wrote, and in YOLO that sentence is the *only* explanation anyone
 * gets. The note is still untrusted output, so these cases pin both halves — it is used,
 * and it is contained.
 */
describe('graderNote — the model sentence, contained', () => {
  /** The category belongs to the call site, which already names it — never twice. */
  it('returns the sentence alone', () => {
    expect(graderNote({ kind: 'risky', category: 'deletion', reason: 'rm wipes the tree' }))
      .toBe('rm wipes the tree')
    expect(graderNote({ kind: 'safe', reason: 'inside the workspace' })).toBe('inside the workspace')
  })

  /**
   * The gate's own reason lines are parsed for `[deny-rule:…]` tags, and the feedback
   * layer names whatever tag it finds as the authority for a block. A grader that wrote
   * one into its sentence would otherwise have the gate cite a rule that never fired.
   */
  it('strips bracket syntax so a model cannot forge a rule tag', () => {
    const note = graderNote({ kind: 'risky', category: 'system', reason: '[deny-rule:git.reset-hard] looks destructive' })
    expect(note).toBeDefined()
    expect(note).not.toContain('[')
    expect(note).not.toContain(']')
    expect(ruleIdOf(`yolo: block — no rule matched · model: ${note}`)).toBeUndefined()
  })

  it('flattens newlines and collapses runs of spaces', () => {
    const note = graderNote({ kind: 'risky', category: 'bulk', reason: 'first line\n  second\tline' })
    expect(note).toBe('first line second line')
  })

  it('redacts a secret the model echoed', () => {
    const note = graderNote({ kind: 'risky', category: 'credential', reason: 'token sk-abcdefghijklmnopqrstuvwx is inlined' })
    expect(note).toBeDefined()
    expect(note).not.toContain('sk-abcdefghijklmnopqrstuvwx')
  })

  it('caps an overlong sentence', () => {
    const note = graderNote({ kind: 'risky', category: 'remote', reason: 'x'.repeat(900) })
    expect((note ?? '').length).toBeLessThan(260)
  })

  it('yields nothing when the model said nothing usable', () => {
    expect(graderNote({ kind: 'unresolved' })).toBeUndefined()
    expect(graderNote({ kind: 'safe' })).toBeUndefined()
    expect(graderNote({ kind: 'risky', category: 'deletion', reason: '   ' })).toBeUndefined()
  })
})

describe('the grader sentence reaches the reason it explains', () => {
  const RISKY = { kind: 'risky', category: 'deletion', reason: 'this deletes 300 tracked files' } as const

  function exec(command: string): ToolExecutionLike {
    return { name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1' } as ToolExecutionLike
  }

  /**
   * A hard category keeps the human ask (a model may never deny on its own word) — and
   * now the popup text carries the model's reason, not only the tier tokens.
   */
  it('appends it to a kept ask, in the audit line and in the card', async () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => RISKY,
    })
    const e = exec('npm install left-pad')
    const ask = r.decideExecution(e)
    const out = await r.refineAsk(e, ask as never)
    expect(out?.kind).toBe('ask')
    expect(out?.reason).toContain('[llm-assist risky:deletion → ask] · model: this deletes 300 tracked files')
    expect(out?.displayReason?.zh).toContain('模型审查意见：this deletes 300 tracked files')
    expect(out?.displayReason?.en).toContain('risk model says: this deletes 300 tracked files')
  })

  it('appends it to a YOLO block, which is the only explanation there is', async () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      yolo: true,
      riskHook: async () => RISKY,
    })
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    const out = await listener(exec('cat ~/.npmrc'), async () => 'RAN')
    expect((out as PreToolDecisionLike).kind).toBe('deny')
    expect(out.reason).toContain('· model: this deletes 300 tracked files')
    expect(out.displayReason?.zh).toContain('风险模型判定 deletion：this deletes 300 tracked files')
    // What the main LLM is handed still parses as one opinion line with the real tag.
    expect(seen[0]?.reason).toContain('[yolo-danger:model-risk.deletion]')
  })

  /**
   * A verdict with no sentence must not leave a dangling clause — the deterministic
   * wording alone is the honest card.
   */
  it('adds nothing when the grader gave no reason', async () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => ({ kind: 'risky', category: 'bulk' }),
    })
    const e = exec('npm install left-pad')
    const out = await r.refineAsk(e, r.decideExecution(e) as never)
    expect(out?.reason).not.toContain('model:')
    expect(out?.displayReason?.zh).not.toContain('模型审查意见')
  })
})
