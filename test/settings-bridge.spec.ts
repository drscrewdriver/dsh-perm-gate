/**
 * settings bridge — T12 泛化（T20-b，2026-10-08）。
 *
 * 三块断言：
 * 1. 服务端路由派生：bridgeRoutesFor(ns) 对 dsh-perm-gate 产出的路径与泛化前的
 *    硬编码常量逐字符一致（行为零变化回归钉）；不同 ns 各得一对端点，同进程
 *    双 ns 注册互不串线。
 * 2. 服务端语义守卫：POST-only、settings-unavailable、ns-not-registered、
 *    malformed ops、乐观并发冲突映射（T12 原语义在派生化后原样保留）。
 * 3. client BridgeDocHandle(ns)：派生式与 server 侧逐字符一致（两半各自持有、
 *    测试钉死——client tsconfig include 仅 src/client，不跨目录 import）；
 *    pending→ready 快照迁移、set() 携 ops+expectedRevision 落派生 mutate 路径、
 *    冲突即回拉权威值。
 */
import { describe, expect, it, vi } from 'vitest'
import { bridgeRoutesFor, registerSettingsBridgeRoutes } from '../src/bridge.js'
import { BridgeDocHandle } from '../src/client/bridge-scope.js'

/** 记录全部注册路由（按 path 索引）并可驱动请求的 webServer 桩。 */
function makeServer() {
  const routes = new Map<string, { handler: (req: unknown, res: unknown) => unknown }>()
  return {
    register(route: { path: string; handler: (req: unknown, res: unknown) => unknown }): () => void {
      routes.set(route.path, route)
      return () => { routes.delete(route.path) }
    },
    paths(): string[] {
      return [...routes.keys()].sort()
    },
    /** 驱动一条 POST/GET；`raw` 作为请求体逐字发出。 */
    async call(path: string, method: string, raw?: string): Promise<{ code: number; body: unknown }> {
      const route = routes.get(path)
      if (route === undefined) throw new Error(`route not registered: ${path}`)
      const out = { code: 0, body: undefined as unknown }
      const listeners = new Map<string, (chunk?: unknown) => void>()
      const req = {
        method,
        url: path,
        on(event: string, cb: (chunk?: unknown) => void) { listeners.set(event, cb); return req },
      }
      const res = {
        writeHead(code: number) { out.code = code },
        end(payload?: string) { out.body = payload === undefined ? undefined : JSON.parse(payload) },
      }
      const done = Promise.resolve(route.handler(req, res))
      if (raw !== undefined) listeners.get('data')?.(Buffer.from(raw))
      listeners.get('end')?.()
      await done
      await new Promise((resolve) => setTimeout(resolve, 0))
      return out
    },
  }
}

/** describe/mutate 双能力的 settings 服务桩，可注入故障。 */
function makeSvc(options: { nsList?: string[]; conflict?: boolean } = {}) {
  const calls: Array<{ kind: string; ns: string; ops?: unknown }> = []
  return {
    calls,
    describe(o?: { redactSecrets?: boolean }) {
      void o
      return (options.nsList ?? ['dsh-perm-gate']).map((ns) => ({ ns, value: { enabled: true }, revision: 3 }))
    },
    async mutate(ns: string, ops: unknown) {
      calls.push({ kind: 'mutate', ns, ops })
      if (options.conflict) throw new Error('settings revision conflict: expected 3 got 2')
    },
  }
}

describe('bridgeRoutesFor（T20-b 路由派生）', () => {
  it('dsh-perm-gate 派生路径与泛化前硬编码常量逐字符一致', () => {
    expect(bridgeRoutesFor('dsh-perm-gate')).toEqual({
      describe: '/api/dsh-perm-gate/settings/describe',
      mutate: '/api/dsh-perm-gate/settings/mutate',
    })
  })

  it('不同 ns 派生各自的路由对', () => {
    const a = bridgeRoutesFor('dsh-session-steward')
    const b = bridgeRoutesFor('dsh-search-index')
    expect(a.describe).toBe('/api/dsh-session-steward/settings/describe')
    expect(b.describe).toBe('/api/dsh-search-index/settings/describe')
    expect(a.mutate).not.toBe(b.mutate)
  })
})

describe('registerSettingsBridgeRoutes（多 ns 注册）', () => {
  it('同进程双 ns 注册得四条互异路由，describe 各回各 ns', async () => {
    const server = makeServer()
    const svc = makeSvc({ nsList: ['dsh-session-steward', 'dsh-search-index'] })
    const offs = [
      ...registerSettingsBridgeRoutes(server, () => svc, 'dsh-session-steward'),
      ...registerSettingsBridgeRoutes(server, () => svc, 'dsh-search-index'),
    ]
    expect(offs).toHaveLength(4)
    expect(server.paths()).toEqual([
      '/api/dsh-search-index/settings/describe',
      '/api/dsh-search-index/settings/mutate',
      '/api/dsh-session-steward/settings/describe',
      '/api/dsh-session-steward/settings/mutate',
    ])
    const a = await server.call('/api/dsh-session-steward/settings/describe', 'POST')
    expect(a.body).toMatchObject({ ok: true, value: { descriptor: { ns: 'dsh-session-steward' } } })
    const b = await server.call('/api/dsh-search-index/settings/describe', 'POST')
    expect(b.body).toMatchObject({ ok: true, value: { descriptor: { ns: 'dsh-search-index' } } })
    for (const off of offs) off()
    expect(server.paths()).toEqual([])
  })

  it('GET 一律 405', async () => {
    const server = makeServer()
    registerSettingsBridgeRoutes(server, () => makeSvc(), 'dsh-perm-gate')
    expect((await server.call('/api/dsh-perm-gate/settings/describe', 'GET')).code).toBe(405)
    expect((await server.call('/api/dsh-perm-gate/settings/mutate', 'GET')).code).toBe(405)
  })

  it('settings 服务缺席 → settings-unavailable；ns 未注册 → ns-not-registered', async () => {
    const server = makeServer()
    registerSettingsBridgeRoutes(server, () => undefined, 'dsh-perm-gate')
    const d = '/api/dsh-perm-gate/settings/describe'
    expect(await server.call(d, 'POST')).toMatchObject({ body: { ok: false, code: 'settings-unavailable' } })

    const server2 = makeServer()
    registerSettingsBridgeRoutes(server2, () => makeSvc({ nsList: ['other-ns'] }), 'dsh-perm-gate')
    expect(await server2.call(d, 'POST')).toMatchObject({ body: { ok: false, code: 'ns-not-registered' } })
  })

  it('mutate 成功即 describe 回填；冲突映射 settings-conflict；坏 ops 映射 settings-rejected', async () => {
    const m = '/api/dsh-perm-gate/settings/mutate'
    const svc = makeSvc()
    const server = makeServer()
    registerSettingsBridgeRoutes(server, () => svc, 'dsh-perm-gate')
    const ok = await server.call(m, 'POST', JSON.stringify({ ops: [{ op: 'set', path: ['enabled'], value: false }], expectedRevision: 3 }))
    expect(ok.body).toMatchObject({ ok: true, value: { descriptor: { revision: 3 } } })
    expect(svc.calls[0]).toMatchObject({ kind: 'mutate', ns: 'dsh-perm-gate' })

    const conflicted = makeSvc({ conflict: true })
    const server2 = makeServer()
    registerSettingsBridgeRoutes(server2, () => conflicted, 'dsh-perm-gate')
    expect(await server2.call(m, 'POST', JSON.stringify({ ops: [{ op: 'set', path: ['x'], value: 1 }] })))
      .toMatchObject({ body: { ok: false, code: 'settings-conflict' } })

    const server3 = makeServer()
    registerSettingsBridgeRoutes(server3, () => makeSvc(), 'dsh-perm-gate')
    expect(await server3.call(m, 'POST', JSON.stringify({ ops: [{ op: 'nope' }] })))
      .toMatchObject({ body: { ok: false, code: 'settings-rejected' } })
  })

  it('无 webServer 服务（或形状不符）时静默返回空卸载表', () => {
    expect(registerSettingsBridgeRoutes(undefined, () => undefined, 'dsh-perm-gate')).toEqual([])
    expect(registerSettingsBridgeRoutes({}, () => undefined, 'dsh-perm-gate')).toEqual([])
  })
})

describe('BridgeDocHandle（client 半，T20-b ns 派生）', () => {
  /** fetch 桩：记录 (path, body)，按脚本应答。 */
  function stubFetch(respond: (path: string, body: unknown) => unknown) {
    const seen: Array<{ path: string; body: unknown }> = []
    const fetchMock = vi.fn(async (path: string, init?: { method?: string; body?: string }) => {
      seen.push({ path, body: init?.body === undefined ? undefined : JSON.parse(init.body) })
      return respond(path, seen[seen.length - 1]?.body) as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    return { seen, fetchMock }
  }

  const descriptorBody = (ns: string) => ({
    ok: true,
    value: { descriptor: { ns, value: { enabled: true }, revision: 7 }, writable: true },
  })

  it('client 派生式与 server bridgeRoutesFor 逐字符一致（两半漂移钉）', async () => {
    const { seen } = stubFetch(() => ({ ok: true, json: async () => descriptorBody('dsh-perm-gate') }))
    for (const ns of ['dsh-perm-gate', 'dsh-session-steward', 'dsh-search-index']) {
      seen.length = 0
      const handle = new BridgeDocHandle(ns)
      await vi.waitFor(() => expect(handle.getSnapshot().status).toBe('ready'))
      expect(seen[0]?.path).toBe(bridgeRoutesFor(ns).describe)
    }
    vi.unstubAllGlobals()
  })

  it('构造即拉派生 describe；快照 pending→ready；set() 落派生 mutate 并携带 expectedRevision', async () => {
    const { seen } = stubFetch((path) => {
      if (path === '/api/dsh-search-index/settings/describe') return { ok: true, json: async () => descriptorBody('dsh-search-index') }
      if (path === '/api/dsh-search-index/settings/mutate') {
        return { ok: true, json: async () => descriptorBody('dsh-search-index') }
      }
      return { ok: false, json: async () => ({}) }
    })
    const handle = new BridgeDocHandle('dsh-search-index')
    expect(handle.getSnapshot().status).toBe('pending')
    await vi.waitFor(() => expect(handle.getSnapshot().status).toBe('ready'))
    expect(handle.getSnapshot().value).toEqual({ enabled: true })
    expect(seen[0]?.path).toBe('/api/dsh-search-index/settings/describe')

    await handle.set('enabled', false)
    expect(seen.at(-1)?.path).toBe('/api/dsh-search-index/settings/mutate')
    expect(seen.at(-1)?.body).toMatchObject({
      ops: [{ op: 'set', path: ['enabled'], value: false }],
      expectedRevision: 7,
    })
    vi.unstubAllGlobals()
  })

  it('冲突应答触发权威值回拉，不抛错', async () => {
    const { seen } = stubFetch((path) => {
      if (path.endsWith('/mutate')) return { ok: true, json: async () => ({ ok: false, code: 'settings-conflict' }) }
      return { ok: true, json: async () => descriptorBody('dsh-perm-gate') }
    })
    const handle = new BridgeDocHandle('dsh-perm-gate')
    await vi.waitFor(() => expect(handle.getSnapshot().status).toBe('ready'))
    const pulls = seen.filter((s) => s.path.endsWith('/describe')).length
    await handle.set('enabled', false)
    expect(seen.filter((s) => s.path.endsWith('/describe')).length).toBeGreaterThan(pulls)
    expect(handle.getSnapshot().status).toBe('ready')
    vi.unstubAllGlobals()
  })
})
