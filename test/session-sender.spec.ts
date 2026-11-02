import { describe, expect, it } from 'vitest'
import { BLOCK_NOTE_SOURCE_KIND, buildBlockNoteSender, buildSessionSender } from '../src/index.js'

/**
 * The gate's own `工具审核意见` must ride the **steering lane**, not the next-turn
 * queue: a block happens mid-turn, so the opinion belongs beside the refused tool
 * result (next-step) instead of behind the user's pending input. These cases pin the
 * two lanes apart — a regression here puts the gate's note back into the user's queue,
 * where it reads as if the person had typed it and only reaches the model one full
 * turn later.
 */

interface Invocation {
  readonly namespace: string
  readonly method: string
  readonly args: { readonly sessionId: string; readonly mode: string; readonly content: unknown[] }
}

function fakeGateway(calls: Invocation[], fail = false): unknown {
  return {
    invoke: async (req: unknown) => {
      calls.push(req as Invocation)
      if (fail) throw new Error('gateway down')
    },
  }
}

function fakeAgents(pushes: { followup: unknown[]; steer: unknown[] }): unknown {
  return {
    get: (id: string) => ({
      id,
      followup: (msg: unknown) => { pushes.followup.push(msg) },
      steer: (msg: unknown) => { pushes.steer.push(msg) },
    }),
  }
}

describe('buildSessionSender — lane selection', () => {
  it('sends a block opinion as steer, never as a queued turn', async () => {
    const calls: Invocation[] = []
    const pushes = { followup: [] as unknown[], steer: [] as unknown[] }
    const send = buildSessionSender((name) => (name === 'typertGateway' ? fakeGateway(calls) : undefined), 'steer')
    await expect(send('s1', '工具审核意见: "已拦截"')).resolves.toEqual({ ok: true, via: 'gateway' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.namespace).toBe('session')
    expect(calls[0]?.method).toBe('prompt')
    expect(calls[0]?.args.mode).toBe('steer')
    expect(calls[0]?.args.sessionId).toBe('s1')
    expect(pushes.steer).toHaveLength(0)
  })

  it('falls back to agent.steer on the same lane and never degrades to followup', async () => {
    const pushes = { followup: [] as unknown[], steer: [] as unknown[] }
    const send = buildSessionSender(
      (name) => (name === 'agents' ? fakeAgents(pushes) : undefined),
      'steer',
    )
    await expect(send('s1', 'note')).resolves.toEqual({ ok: true, via: 'steer' })
    expect(pushes.steer).toHaveLength(1)
    expect(pushes.followup).toHaveLength(0)
    expect(pushes.steer[0]).toMatchObject({ role: 'user', source: { kind: 'user' } })
  })

  it('a failed gateway steer falls through to the agent instead of dropping the note', async () => {
    const calls: Invocation[] = []
    const pushes = { followup: [] as unknown[], steer: [] as unknown[] }
    const send = buildSessionSender((name) => {
      if (name === 'typertGateway') return fakeGateway(calls, true)
      if (name === 'agents') return fakeAgents(pushes)
      return undefined
    }, 'steer')
    await expect(send('s1', 'note')).resolves.toEqual({ ok: true, via: 'steer' })
    expect(calls).toHaveLength(1)
    expect(pushes.steer).toHaveLength(1)
    expect(pushes.followup).toHaveLength(0)
  })

  it('keeps the review page revert instruction on the next-turn queue', async () => {
    const calls: Invocation[] = []
    const pushes = { followup: [] as unknown[], steer: [] as unknown[] }
    const send = buildSessionSender((name) => {
      if (name === 'typertGateway') return fakeGateway(calls)
      if (name === 'agents') return fakeAgents(pushes)
      return undefined
    })
    await expect(send('s1', '请撤销这次改动')).resolves.toEqual({ ok: true, via: 'gateway' })
    expect(calls[0]?.args.mode).toBe('queue')
  })

  it('reports the missing channel instead of throwing', async () => {
    const send = buildSessionSender(() => undefined, 'steer')
    await expect(send('s1', 'note')).resolves.toEqual({ ok: false, error: '没有可用的消息投递通道' })
  })
})

describe('buildBlockNoteSender — the gate speaks as context, not as the user', () => {
  it('injects a sourced context note instead of a user message', async () => {
    const injected: Record<string, unknown>[] = []
    const plan = {
      get: (id: string) => ({ id, inject: (msg: unknown) => { injected.push(msg as Record<string, unknown>) } }),
    }
    const gate = { invoke: async () => { throw new Error('gateway must not be used') } }
    const send = buildBlockNoteSender((name) => (name === 'agents' ? plan : name === 'typertGateway' ? gate : undefined))
    await expect(send('s1', '工具审核意见: "已拦截"')).resolves.toEqual({ ok: true, via: 'inject' })
    expect(injected).toHaveLength(1)
    expect(injected[0]).toMatchObject({
      role: 'user',
      source: { kind: BLOCK_NOTE_SOURCE_KIND },
      content: [{ type: 'text', text: '工具审核意见: "已拦截"' }],
    })
    // The human's identity is exactly what must not be borrowed: no `user` kind,
    // no rpcId — the waiting area keys on those to list a person's own input.
    expect((injected[0]?.source as { kind: string }).kind).not.toBe('user')
  })

  it('falls back to the steering lane when no live agent exposes inject', async () => {
    const calls: Invocation[] = []
    const send = buildBlockNoteSender((name) => (name === 'typertGateway' ? fakeGateway(calls) : undefined))
    await expect(send('s1', 'note')).resolves.toEqual({ ok: true, via: 'gateway' })
    expect(calls[0]?.args.mode).toBe('steer')
  })

  it('falls back when inject itself throws', async () => {
    const calls: Invocation[] = []
    const plan = { get: (id: string) => ({ id, inject: () => { throw new Error('inbox closed') } }) }
    const send = buildBlockNoteSender((name) => {
      if (name === 'agents') return plan
      if (name === 'typertGateway') return fakeGateway(calls)
      return undefined
    })
    await expect(send('s1', 'note')).resolves.toEqual({ ok: true, via: 'gateway' })
    expect(calls[0]?.args.mode).toBe('steer')
  })
})
