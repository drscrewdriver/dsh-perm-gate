/**
 * unattended.spec.ts — 「一个开关 = 一套实现 = 一档」的路由契约。
 *
 * 钉住五件事：
 * ① 三套实现各自拥有一个预设，互不重叠（预设不串）；
 * ② 开关关掉 = 实现不存在，那一档退回普通人工流，而不是偷偷变成别的档；
 * ③ `permissive-mech`（safenet-pass）接管 ask：机械点名的拦+回喂，其余放行，**零模型调用**；
 * ④ `permissive-snet`（safenet-ask）只过滤危险、**仍然问人**，即使 llmAssist 开着、模型可用，
 *    也不叫模型 —— 这是它和「自动审查」的唯一分界；
 * ⑤ `permissive-yolo` 必须有模型：良性残局必叫模型；模型没答上时 verdict 明说
 *    `yolo-allow-no-reviewer`，不许和机械档混成一个标签。
 */
import { describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'
import { makePreExecuteListener } from '../src/index.js'
import type { PreToolDecisionLike, ToolExecutionLike } from '../src/runtime.js'
import { isHumanFree, MODE_PRESETS, resolveTierMode, UNATTENDED_MODES } from '../src/unattended.js'

const RULES = undefined // no rules file: everything defaults to ask

/** An unlearnable data destruction: reaches an ask, and the mechanical screen names it. */
const MECH = 'docker volume rm myvol'
/** A call that reaches an ask with no deterministic danger signal at all. */
const BENIGN = 'echo hi > out.txt'

/** One shell call, optionally carrying the session log that names its permission preset. */
function exec(command: string, preset?: string): ToolExecutionLike {
  // `sessionEventsOf` probes `exec.agent.session` and `exec` itself — the array goes on the
  // call, which is also how the older host lines hand it over.
  const events = preset === undefined ? [] : [{ type: 'permission/preset', data: { preset } }]
  return { name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1', events } as unknown as ToolExecutionLike
}

/** A runtime with the three switches injected live, plus an optional grader spy. */
function tierRuntime(
  switches: Record<string, unknown>,
  grader?: (command: string) => Promise<{ kind: 'safe' } | { kind: 'risky'; category: string }>,
): { runtime: PermGateRuntime; calls: () => number } {
  let hits = 0
  const runtime = new PermGateRuntime({
    rulesFile: RULES,
    ...(grader === undefined
      ? {}
      : {
        riskHook: async (req) => {
          hits += 1
          return grader(String((req.args as { command?: string })?.command ?? '')) as never
        },
      }),
    ...switches,
  })
  return { runtime, calls: () => hits }
}

describe('开关 → 实现 → 预设 的归属', () => {
  it('三套实现各占一个预设，互不重叠', () => {
    const owners = UNATTENDED_MODES.map((mode) => MODE_PRESETS[mode])
    expect(new Set(owners).size).toBe(3)
    expect(MODE_PRESETS['safety-net-ask']).toBe('permissive-snet')
    expect(MODE_PRESETS['safety-net-passthrough']).toBe('permissive-mech')
    expect(MODE_PRESETS.yolo).toBe('permissive-yolo')
  })

  it('只有 pass 与 yolo 把人请出去；ask 档是来留人的', () => {
    expect(isHumanFree('safety-net-ask')).toBe(false)
    expect(isHumanFree('safety-net-passthrough')).toBe(true)
    expect(isHumanFree('yolo')).toBe(true)
  })

  it('开关开了才存在：关掉实现退回 null（普通人工流）', () => {
    expect(resolveTierMode('permissive-mech', { safenetPass: true })).toBe('safety-net-passthrough')
    expect(resolveTierMode('permissive-mech', { safenetPass: false })).toBeNull()
    expect(resolveTierMode('permissive-snet', { safenetAsk: true })).toBe('safety-net-ask')
    expect(resolveTierMode('permissive-snet', {})).toBeNull()
    expect(resolveTierMode('permissive-yolo', { yolo: true })).toBe('yolo')
    expect(resolveTierMode('permissive-yolo', {})).toBeNull()
  })

  it('预设不串：一颗开关只动它自己那一档', () => {
    // 三颗全开时，普通 自动审查 档必须仍然返回 null —— 它不该被任何无人值守实现接管。
    const all = { yolo: true, safenetPass: true, safenetAsk: true }
    expect(resolveTierMode('permissive', all)).toBeNull()
    expect(resolveTierMode('permissive-full', all)).toBeNull()
    expect(resolveTierMode('workspace-write', all)).toBeNull()
    // 反过来：只开 pass 不能把 yolo 档点亮。
    expect(resolveTierMode('permissive-yolo', { safenetPass: true })).toBeNull()
    expect(resolveTierMode('permissive-snet', { safenetPass: true })).toBeNull()
  })

  it('会话没记录预设时不猜档', () => {
    expect(resolveTierMode(undefined, { yolo: true, safenetPass: true, safenetAsk: true })).toBeNull()
  })
})

describe('runtime 按预设 + 开关取实现', () => {
  it('读的是 live 开关，不是启动期快照', () => {
    let pass = false
    const { runtime } = tierRuntime({ readSafenetPass: () => pass })
    const e = exec(BENIGN, 'permissive-mech')
    expect(runtime.unattendedModeOf(e)).toBeNull()
    pass = true
    expect(runtime.unattendedModeOf(e)).toBe('safety-net-passthrough')
    expect(runtime.isSafetyNet(e)).toBe(true)
  })

  it('mech 档：机械拦不可沉淀的销毁，一次模型都不叫', async () => {
    const { runtime, calls } = tierRuntime({ safenetPass: true }, async () => ({ kind: 'safe' }))
    const hit = exec(MECH, 'permissive-mech')
    const decision = runtime.decideExecution(hit) as PreToolDecisionLike
    expect(decision.kind).toBe('ask')
    const settled = runtime.resolveSafetyNet(hit, decision)
    expect(settled?.kind).toBe('deny')
    expect(settled?.reason).toContain('[safety-net-danger:data-destruction]')
    expect(settled?.displayReason?.zh).toContain('无人值守机械审查已拦截')
    expect(calls()).toBe(0)
    expect(runtime.auditEntries.at(-1)?.outcome).toBe('deny')
  })

  it('mech 档：机械没点名的直接放行，即使模型会报 risky', async () => {
    const { runtime, calls } = tierRuntime({ safenetPass: true }, async () => ({ kind: 'risky', category: 'deletion' }))
    const benign = exec(BENIGN, 'permissive-mech')
    expect(runtime.resolveSafetyNet(benign, runtime.decideExecution(benign) as PreToolDecisionLike)).toBeUndefined()
    expect(calls()).toBe(0)
    expect(runtime.auditEntries.at(-1)?.outcome).toBe('allow')
  })

  it('snet-ask 档：llmAssist 开着、模型可用，也不叫模型，ask 原样留给人', async () => {
    const { runtime, calls } = tierRuntime({
      safenetAsk: true,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
    }, async () => ({ kind: 'safe' }))
    const e = exec(BENIGN, 'permissive-snet')
    expect(runtime.isSafetyNetAsk(e)).toBe(true)
    const ask = runtime.decideExecution(e) as PreToolDecisionLike
    expect(ask.kind).toBe('ask')
    expect(await runtime.refineAsk(e, ask)).toBe(ask)
    // 这一档存在的全部理由：不花 token，且拿不准时人来定。
    expect(calls()).toBe(0)
  })

  it('yolo 档：良性残局必叫模型（与 mech 档的实质差别就是这次调用）', async () => {
    const { runtime, calls } = tierRuntime({ yolo: true }, async () => ({ kind: 'safe' }))
    const benign = exec(BENIGN, 'permissive-yolo')
    expect(await runtime.resolveYolo(benign, runtime.decideExecution(benign) as PreToolDecisionLike)).toBeUndefined()
    expect(calls()).toBe(1)
  })

  it('yolo 档：模型报 risky 才拦，并回喂理由', async () => {
    const { runtime } = tierRuntime({ yolo: true }, async () => ({ kind: 'risky', category: 'deletion' }))
    const e = exec(BENIGN, 'permissive-yolo')
    const settled = await runtime.resolveYolo(e, runtime.decideExecution(e) as PreToolDecisionLike)
    expect(settled?.kind).toBe('deny')
    expect(settled?.reason).toContain('[yolo-danger:model-risk.deletion]')
  })

  it('yolo 档：模型没答上仍不问人，但标签必须说清是机械在处置', async () => {
    const { runtime } = tierRuntime({ yolo: true })
    const benign = exec(BENIGN, 'permissive-yolo')
    expect(await runtime.resolveYolo(benign, runtime.decideExecution(benign) as PreToolDecisionLike)).toBeUndefined()
    expect(runtime.auditEntries.at(-1)?.reason).toContain('no reviewer answered')
    const hit = exec(MECH, 'permissive-yolo')
    expect((await runtime.resolveYolo(hit, runtime.decideExecution(hit) as PreToolDecisionLike))?.kind).toBe('deny')
  })

  it('同一把尺：机械点名的销毁在 mech 与 yolo 两档都拦，且都不为此花模型调用', async () => {
    const yolo = tierRuntime({ yolo: true }, async () => ({ kind: 'safe' }))
    const mech = tierRuntime({ safenetPass: true }, async () => ({ kind: 'safe' }))
    const hit = exec(MECH, 'permissive-yolo')
    const hit2 = exec(MECH, 'permissive-mech')
    expect((await yolo.runtime.resolveYolo(hit, yolo.runtime.decideExecution(hit) as PreToolDecisionLike))?.kind).toBe('deny')
    expect(mech.runtime.resolveSafetyNet(hit2, mech.runtime.decideExecution(hit2) as PreToolDecisionLike)?.kind).toBe('deny')
    expect(yolo.calls()).toBe(0)
    expect(mech.calls()).toBe(0)
  })

  it('确定性 deny 优先于档位：P0 已拒的调用不会被重新包装成档位结论', () => {
    const { runtime } = tierRuntime({ safenetPass: true })
    const decision = runtime.decideExecution(exec('rm -rf ~', 'permissive-mech')) as PreToolDecisionLike
    expect(decision.kind).toBe('deny')
    expect(decision.reason).toMatch(/deny-keyword|hard-deny/)
  })
})

describe('监听器的档位路由', () => {
  it('mech 档把良性 ask 变成执行，不问人', async () => {
    const { runtime } = tierRuntime({ safenetPass: true })
    let ran = false
    await makePreExecuteListener(runtime)(exec(BENIGN, 'permissive-mech'), async () => { ran = true; return 'ok' })
    expect(ran).toBe(true)
  })

  it('mech 档拦下机械点名的销毁并把意见回喂', async () => {
    const { runtime } = tierRuntime({ safenetPass: true })
    const fed: string[] = []
    const out = await makePreExecuteListener(runtime, (_e, decision) => { fed.push(decision.reason) })(
      exec(MECH, 'permissive-mech'), async () => 'ok')
    expect((out as PreToolDecisionLike).kind).toBe('deny')
    expect(fed.join(' ')).toContain('safety-net-passthrough: block')
  })

  it('snet-ask 档不进无人值守分支：ask 留给人', async () => {
    const { runtime } = tierRuntime({ safenetAsk: true, permissive: true })
    let ran = false
    const out = await makePreExecuteListener(runtime)(exec(BENIGN, 'permissive-snet'), async () => { ran = true; return 'ok' })
    expect(ran).toBe(false)
    expect((out as PreToolDecisionLike).kind).toBe('ask')
  })

  it('开关关掉的档 = 实现不存在：那一档退回普通人工流', async () => {
    // 关掉 mech 档的实现，即使会话选着 permissive-mech，也不会有任何东西接管那个 ask ——
    // 它回到人面前。这一档不会“静默变成另一个档”，正是这组开关存在的理由。
    const { runtime } = tierRuntime({ safenetPass: false })
    let ran = false
    const out = await makePreExecuteListener(runtime)(exec(MECH, 'permissive-mech'), async () => { ran = true; return 'ok' })
    expect(ran).toBe(false)
    expect((out as PreToolDecisionLike).kind).toBe('ask')
  })

  it('yolo 与 mech 两档互不接管：开着 yolo 不会让 mech 档自动放行', async () => {
    const { runtime, calls } = tierRuntime({ yolo: true }, async () => ({ kind: 'safe' }))
    let ran = false
    await makePreExecuteListener(runtime)(exec(BENIGN, 'permissive-mech'), async () => { ran = true; return 'ok' })
    // mech 档的实现没开 → 走普通瀑布 → ask 留给人（不执行、不叫模型）。
    expect(ran).toBe(false)
    expect(calls()).toBe(0)
  })
})
