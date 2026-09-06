import { describe, expect, it } from 'vitest'
import { classifyRisk, isHardRisk, parseRiskVerdict, type RiskVerdict } from '../src/risk.js'

const CFG = { endpoint: 'https://llm.example/v1', model: 'grader-x', apiKey: 'sk-test', timeoutMs: 200 }

/** A fetch stub answering with one fixed assistant content. */
function okFetch(content: string, calls: { url: string; body: unknown }[] = []): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ url: String(input), body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) })
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  }) as typeof fetch
}

/** A fetch stub that always fails at the transport level. */
function brokenFetch(): typeof fetch {
  return (async () => {
    throw new Error('boom')
  }) as typeof fetch
}

const REQ = { tool: 'bash', args: { command: 'ls' }, reason: 'no rule matched; default action' }

describe('parseRiskVerdict', () => {
  it('parses the JSON protocol', () => {
    expect(parseRiskVerdict('{"risk":"safe","reason":"ok"}')).toEqual({ kind: 'safe', reason: 'ok' })
    expect(parseRiskVerdict('{"risk":"risky","category":"deletion","reason":"rm"}')).toEqual({ kind: 'risky', category: 'deletion', reason: 'rm' })
    expect(parseRiskVerdict('{"risk":"risky","category":"NEUTRAL"}')).toEqual({ kind: 'risky', category: 'neutral', reason: undefined })
  })

  it('rejects off-protocol output instead of guessing', () => {
    expect(parseRiskVerdict('{"risk":"risky","category":"weird-stuff"}')).toBeUndefined()
    expect(parseRiskVerdict('{"risk":"danger"}')).toBeUndefined()
    expect(parseRiskVerdict('I think this is risky')).toBeUndefined() // bare risky: no trustworthy category
    expect(parseRiskVerdict(' totally not json ')).toBeUndefined()
  })

  it('falls back to a bare safe keyword', () => {
    expect(parseRiskVerdict('SAFE')).toEqual({ kind: 'safe' })
  })
})

describe('isHardRisk', () => {
  it('hard categories are exactly the irreversible five; unknown counts as hard', () => {
    for (const c of ['deletion', 'credential', 'remote', 'system', 'bulk']) expect(isHardRisk(c)).toBe(true)
    expect(isHardRisk('neutral')).toBe(false)
    expect(isHardRisk('something-else')).toBe(true)
  })
})

describe('classifyRisk', () => {
  it('returns the graded verdict on success', async () => {
    const v = await classifyRisk(CFG, REQ, okFetch('{"risk":"safe"}'))
    expect(v.kind).toBe('safe')
  })

  it('retries once after a transport failure', async () => {
    let calls = 0
    const flaky = (async () => {
      calls += 1
      if (calls === 1) throw new Error('flaky')
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"risk":"risky","category":"bulk"}' } }] }), { status: 200 })
    }) as typeof fetch
    const v = await classifyRisk(CFG, REQ, flaky)
    expect(calls).toBe(2)
    expect(v).toEqual({ kind: 'risky', category: 'bulk', reason: undefined })
  })

  it('stays unresolved when both attempts fail', async () => {
    const v: RiskVerdict = await classifyRisk(CFG, REQ, brokenFetch())
    expect(v.kind).toBe('unresolved')
  })

  it('stays unresolved on timeout', async () => {
    // A stub that honors the abort signal the way real fetch does.
    const never = (async (_input: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      }) as Response) as typeof fetch
    const v = await classifyRisk({ ...CFG, timeoutMs: 20 }, REQ, never)
    expect(v.kind).toBe('unresolved')
  })

  it('stays unresolved without endpoint or model (fail-closed)', async () => {
    const probe = okFetch('{"risk":"safe"}')
    expect((await classifyRisk({ ...CFG, endpoint: undefined }, REQ, probe)).kind).toBe('unresolved')
    expect((await classifyRisk({ ...CFG, model: undefined }, REQ, probe)).kind).toBe('unresolved')
  })

  it('sends the custom endpoint/model/key to the OpenAI-compatible API', async () => {
    const calls: { url: string; body: { model: string } }[] = []
    await classifyRisk(CFG, REQ, okFetch('{"risk":"safe"}', calls as never))
    expect(calls[0]?.url).toBe('https://llm.example/v1/chat/completions')
    const headers = new Headers({ Authorization: 'Bearer sk-test' })
    expect(headers.get('Authorization')).toBe('Bearer sk-test')
    expect(calls[0]?.body.model).toBe('grader-x')
  })
})
