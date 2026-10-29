/**
 * cred 路由端到端（假 webServer）：GET 报档位、POST 落档并成对持久化——
 * 验证「两存储一条 update」的写缝语义与非法入参的拒绝面。
 */
import { describe, expect, it } from 'vitest'
import { registerCredRoute } from '../src/events'
import { mergePresetIntoRaw } from '../src/preset-rules'

interface RouteDef { path: string; handler: (req: unknown, res: unknown) => void }

function harness() {
  const routes = new Map<string, RouteDef>()
  let doc: unknown = mergePresetIntoRaw({}).doc
  let exempt: string[] = []
  const persisted: Array<{ doc: Record<string, unknown>; exempt: string[] }> = []
  const off = registerCredRoute(
    { register: (def: RouteDef) => { routes.set(def.path, def); return () => routes.delete(def.path) } },
    {
      read: () => ({ doc, exempt }),
      persist: async (d, e) => { doc = d; exempt = [...e]; persisted.push({ doc: d, exempt: [...e] }) },
    },
  )
  expect(off).toBeDefined()
  const call = async (method: string, body?: unknown) => {
    let status = 0
    let payload: Record<string, unknown> = {}
    const req = { method }
    const res = {
      writeHead: (code: number) => { status = code },
      end: (s: string) => { payload = JSON.parse(s) as Record<string, unknown> },
    }
    const def = routes.get('/api/dsh-perm-gate/cred')
    expect(def).toBeDefined()
    if (body !== undefined) {
      // readBody 走 stream：桩以 Internals 不便，改走注入式——路由 handler 内 readBody(req)
      // 对 req 只取 stream 事件；此处用 Readable 假流喂 JSON。
      const { Readable } = await import('node:stream')
      const stream = Readable.from([JSON.stringify(body)]) as unknown as Record<string, unknown>
      Object.assign(stream as object, { method })
      def!.handler(stream, res)
    } else {
      def!.handler(req, res)
    }
    await new Promise((r) => setTimeout(r, 30))
    return { status, payload }
  }
  return { call, persisted, getDoc: () => doc, getExempt: () => exempt, callRaw: async (reqObj: unknown) => {
    let status = 0
    let payload: Record<string, unknown> = {}
    const res = {
      writeHead: (code: number) => { status = code },
      end: (s: string) => { payload = JSON.parse(s) as Record<string, unknown> },
    }
    routes.get('/api/dsh-perm-gate/cred')!.handler(reqObj, res)
    await new Promise((r) => setTimeout(r, 30))
    return { status, payload }
  } }
}

describe('GET /api/dsh-perm-gate/cred', () => {
  it('reports the seeded rungs (every family at ask)', async () => {
    const { call } = harness()
    const { status, payload } = await call('GET')
    expect(status).toBe(200)
    expect(payload.ok).toBe(true)
    const rungs = payload.rungs as Record<string, string>
    expect(rungs.ssh).toBe('ask')
    expect(rungs.package).toBe('ask')
    expect(rungs.gitcreds).toBe('ask')
  })
})

describe('POST /api/dsh-perm-gate/cred', () => {
  it('applies a rung and persists doc + exempt in ONE update', async () => {
    const { call, persisted } = harness()
    const { status, payload } = await call('POST', { family: 'package', rung: 'readwrite' })
    expect(status).toBe(200)
    expect((payload.rungs as Record<string, string>).package).toBe('readwrite')
    expect(persisted.length).toBe(1)
    expect(persisted[0]!.exempt).toEqual(['package'])
  })

  it('rejects unknown family and unknown rung without persisting', async () => {
    const { call, persisted } = harness()
    const bad1 = await call('POST', { family: 'nope', rung: 'ask' })
    expect(bad1.status).toBe(400)
    const bad2 = await call('POST', { family: 'ssh', rung: 'yolo' })
    expect(bad2.status).toBe(400)
    expect(persisted.length).toBe(0)
  })

  it('GET after POST reflects the applied rung (single source: the two stores)', async () => {
    const { call } = harness()
    await call('POST', { family: 'env', rung: 'deny' })
    const { payload } = await call('GET')
    expect((payload.rungs as Record<string, string>).env).toBe('deny')
  })

  it('a stream-less, body-less req fails with 400 — never hangs (desktop webServer regression)', async () => {
    const { callRaw, persisted } = harness()
    const { status, payload } = await callRaw({ method: 'POST' })
    expect(status).toBe(400)
    expect(String(payload.error)).toContain('body stream unavailable')
    expect(persisted.length).toBe(0)
  })

  it('a pre-parsed body object (embedded server shape) is taken without a stream', async () => {
    const { callRaw, persisted } = harness()
    const { status } = await callRaw({ method: 'POST', body: { family: 'ssh', rung: 'deny' } })
    expect(status).toBe(200)
    expect(persisted.length).toBe(1)
  })
})
