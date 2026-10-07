/**
 * debug-generation — T10b served 集合诊断端点（临时，上线前删，spec served 七步第 2 步）。
 *
 * GET /api/dsh-perm-gate/debug-generation
 * 返回插件持有的 settings 服务实例自检：全量 describe 的 ns 列表 + 方法面。
 * 判读：ns 列表若同时含 dsh-perm-gate / dsh-session-guard / dsh-free-search-settings
 * 等其他插件命名空间 → 持有的是宿主共享单例（identitySame=TRUE，H3 孤儿假设死）；
 * 若只有自家 ns → 孤儿实例坐实（H3 成立）。
 */
export interface SettingsServiceLike {
  update(ns: string, patch: object): Promise<void>
  register?(ns: string, schema: unknown, options?: { base?: unknown }): unknown
  installSection?(owner: unknown, ns: string, schema: unknown, entry: unknown, hooks: unknown): unknown
  describe?(): Array<{ ns: unknown }>
}

export const DEBUG_GENERATION_ROUTE = '/api/dsh-perm-gate/debug-generation'

interface RouteReq { method?: string; url?: string }
interface RouteRes { writeHead(code: number, headers?: Record<string, string>): unknown; end(body?: string): unknown }
interface RouteServer { register(route: { kind: string; path: string; handler: (req: unknown, res: unknown) => void }): () => void }

export function registerDebugGenerationRoute(server: unknown, getSettingsSvc: () => SettingsServiceLike | undefined): (() => void) | undefined {
  if (typeof server !== 'object' || server === null) return undefined
  const ws = typeof (server as { register?: unknown }).register === 'function' ? (server as RouteServer) : undefined
  if (ws === undefined || typeof ws.register !== 'function') return undefined
  return ws.register({
    kind: 'exact',
    path: DEBUG_GENERATION_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as RouteReq
      const res = rawRes as RouteRes
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
      const svc = getSettingsSvc()
      let namespaces: string[] = []
      let describeError: string | undefined
      if (svc !== undefined && typeof (svc as { describe?: unknown }).describe === 'function') {
        try {
          const descriptors = (svc as unknown as { describe: () => Array<{ ns: unknown }> }).describe()
          namespaces = descriptors.map((d) => String(d.ns))
        } catch (e) { describeError = e instanceof Error ? e.message : String(e) }
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        hasSvc: svc !== undefined,
        describeError,
        namespaces,
        methods: svc === undefined ? null : {
          register: typeof (svc as { register?: unknown }).register === 'function',
          installSection: typeof (svc as { installSection?: unknown }).installSection === 'function',
          update: typeof (svc as { update?: unknown }).update === 'function',
        },
      }, null, 2))
    },
  })
}
