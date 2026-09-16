import { describe, expect, it } from 'vitest'
import { completeViaHost, DEFAULT_HOST_MODEL, type HostLlmChunk, type HostLlmLike } from '../src/host-llm.js'
import { LLM_PRESETS } from '../src/llm-presets.js'
import { buildReceiverInfo, resolveHostSelection } from '../src/receiver-info.js'
import { PermGateRuntime } from '../src/runtime.js'

const EXEC = { name: 'bash', arguments: { command: 'npm install left-pad' }, cwd: '/work', sessionId: 's1' }

/** A fake host llm service answering with the given text chunks. */
function fakeLlm(chunks: HostLlmChunk[], calls: unknown[] = []): HostLlmLike {
  return {
    async *stream(request) {
      calls.push(request)
      for (const chunk of chunks) yield chunk
    },
  }
}

describe('host llm transport (completeViaHost)', () => {
  it('accumulates text deltas into the assistant answer', async () => {
    const llm = fakeLlm([
      { type: 'text-delta', text: '{"risk":' },
      { type: 'reasoning-delta', text: '"safe"}' },
      { type: 'finish', reason: { kind: 'stop' } },
    ])
    const r = await completeViaHost(llm, DEFAULT_HOST_MODEL, 'sys', 'user', 1000)
    expect(r).toEqual({ ok: true, content: '{"risk":"safe"}' })
  })

  it('surfaces a failed finish as ok:false (fail-closed)', async () => {
    const llm = fakeLlm([{ type: 'finish', reason: { kind: 'error', failure: { message: 'boom' } } }])
    const r = await completeViaHost(llm, DEFAULT_HOST_MODEL, 'sys', 'user', 1000)
    expect(r).toEqual({ ok: false, error: 'boom' })
  })

  it('an empty answer is a failure', async () => {
    const llm = fakeLlm([{ type: 'finish', reason: { kind: 'stop' } }])
    const r = await completeViaHost(llm, DEFAULT_HOST_MODEL, 'sys', 'user', 1000)
    expect(r.ok).toBe(false)
  })

  it('a throwing stream is captured, never propagated', async () => {
    const llm: HostLlmLike = { stream: () => ({ async *[Symbol.asyncIterator]() { throw new Error('kaboom') } }) }
    const r = await completeViaHost(llm, DEFAULT_HOST_MODEL, 'sys', 'user', 1000)
    expect(r).toEqual({ ok: false, error: 'kaboom' })
  })
})

describe('host receiver in refineAsk + healthCheck', () => {
  it('grades the ask through the host llm service when classifierSource is host', async () => {
    const calls: unknown[] = []
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      hostLlm: fakeLlm([{ type: 'text-delta', text: '{"risk":"safe","reason":"ok"}' }], calls),
      readClassifySource: () => 'host',
      readHostModel: () => ({ provider: 'xiaomi-mimo', model: 'mimo-v2.5' }),
      readClassifyConfig: () => ({ endpoint: undefined, model: undefined, apiKey: undefined, timeoutMs: 5000 }),
    })
    const ask = r.decideExecution(EXEC)
    expect(ask?.kind).toBe('ask')
    expect(await r.refineAsk(EXEC, ask as never)).toBeUndefined() // safe → allow
    const req = calls[0] as { provider: string; model: string }
    expect(req.provider).toBe('xiaomi-mimo')
    expect(req.model).toBe('mimo-v2.5')
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
  })

  it('a host failure stays fail-closed (ask, no learning)', async () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      hostLlm: fakeLlm([{ type: 'finish', reason: { kind: 'error', failure: { message: 'down' } } }]),
      readClassifySource: () => 'host',
      readHostModel: () => ({ provider: 'p', model: 'm' }),
    })
    const ask = r.decideExecution(EXEC)
    expect((await r.refineAsk(EXEC, ask as never))?.kind).toBe('ask')
  })

  it('falls back to the default model selection when none is provided', async () => {
    const calls: unknown[] = []
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      hostLlm: fakeLlm([{ type: 'text-delta', text: '{"risk":"risky","category":"deletion"}' }], calls),
      readClassifySource: () => 'host',
    })
    const ask = r.decideExecution(EXEC)
    const refined = await r.refineAsk(EXEC, ask as never)
    expect(refined?.kind).toBe('ask')
    expect(refined?.reason).toContain('deletion')
    const req = calls[0] as { provider: string; model: string }
    expect(req.provider).toBe('deepseek-official')
    expect(req.model).toBe('deepseek-v4-flash')
  })

  it('healthCheck reports ok + latency through the host receiver', async () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      hostLlm: fakeLlm([{ type: 'text-delta', text: 'OK' }]),
      readClassifySource: () => 'host',
      readHostModel: () => ({ provider: 'xiaomi-mimo', model: 'mimo-v2.5' }),
    })
    const result = await r.healthCheck()
    expect(result.ok).toBe(true)
    expect(result.ms).toBeGreaterThanOrEqual(0)
    expect(result.detail).toContain('xiaomi-mimo/mimo-v2.5')
  })

  it('healthCheck reports a missing custom receiver as not-ok (no throw)', async () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const result = await r.healthCheck()
    expect(result.ok).toBe(false)
    expect(result.detail).toContain('not configured')
  })
})

describe('endpoint presets', () => {
  it('includes the Xiaomi MiMo OpenAI-compatible endpoint', () => {
    const mimo = LLM_PRESETS.find((p) => p.id === 'xiaomi-mimo')
    expect(mimo?.endpoint).toBe('https://api.xiaomimimo.com/v1')
    expect(mimo?.model).toContain('mimo')
  })
})

describe('receiver projection (buildReceiverInfo)', () => {
  it('lists live provider groups with their models; one broken group never blanks the rest', async () => {
    const llm = {
      listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }, { id: 'local-35b', name: 'local-35b' }],
      listModels: async (id: string) => (id === 'local-35b'
        ? Promise.reject(new Error('unreachable'))
        : [{ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }]),
    }
    const info = await buildReceiverInfo({
      source: 'host',
      llm,
      currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }),
      overrideProvider: '',
      overrideModel: '',
      customModel: '',
    })
    expect(info.selection).toEqual({ provider: 'deepseek-official', model: 'deepseek-v4-flash' })
    expect(info.providers[0]?.models[0]?.id).toBe('deepseek-v4-flash')
    expect(info.providers[1]?.error).toContain('unreachable')
  })

  it('falls back to route discovery when listModels is missing or empty (configured custom groups)', async () => {
    const calls: string[] = []
    const llm = {
      listProviders: () => [{ id: 'local-35b', name: 'local-35b' }, { id: 'deepseek-official', name: 'DeepSeek' }],
      // a build without listModels (or one answering empty) — discovery must step in
      listConfigurableProviders: () => [{ provider: 'local-35b', settingsNs: 'models.local' }],
      discoverModels: async (settingsNs: string, request: { provider?: string }) => {
        calls.push(`${settingsNs}:${request.provider ?? ''}`)
        return [{ id: 'local-35b-q4', name: 'Local 35B Q4' }]
      },
    }
    const info = await buildReceiverInfo({
      source: 'host',
      llm,
      currentSelection: () => undefined,
      overrideProvider: '',
      overrideModel: '',
      customModel: '',
    })
    expect(calls).toEqual(['models.local:local-35b']) // deepseek-official has no configurable entry
    expect(info.providers[0]?.models).toEqual([{ id: 'local-35b-q4', name: 'Local 35B Q4' }])
    expect(info.providers[0]?.error).toBeUndefined()
    expect(info.providers[1]?.error).toBe('no models advertised')
  })

  it('marks a provider with neither listModels nor discovery results as empty', async () => {
    const info = await buildReceiverInfo({
      source: 'host',
      llm: { listProviders: () => [{ id: 'local-35b', name: 'local-35b' }] },
      currentSelection: () => undefined,
      overrideProvider: '',
      overrideModel: '',
      customModel: '',
    })
    expect(info.providers[0]?.models).toEqual([])
    expect(info.providers[0]?.error).toBe('no models advertised')
  })

  it('custom source exposes only the configured model, no providers', async () => {
    const info = await buildReceiverInfo({ source: 'custom', customModel: 'mimo-v2.5' })
    expect(info.providers).toEqual([])
    expect(info.selection).toEqual({ provider: 'custom', model: 'mimo-v2.5' })
  })

  it('overrides beat the session selection; defaults apply when both are absent', () => {
    expect(resolveHostSelection({
      source: 'host',
      currentSelection: () => ({ provider: 'a', model: 'b' }),
      overrideProvider: 'c',
      overrideModel: 'd',
    })).toEqual({ provider: 'c', model: 'd' })
    expect(resolveHostSelection({ source: 'host' })).toEqual({ provider: 'deepseek-official', model: 'deepseek-v4-flash' })
  })
})
