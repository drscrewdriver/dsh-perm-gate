/**
 * The rule-test endpoint. Two things are asserted beyond "it answers":
 *
 * 1. It is **read-only**: there is no write form, and unknown body keys are
 *    dropped rather than forwarded — so a caller cannot smuggle a rules edit
 *    through the endpoint that exists to test rules.
 * 2. It degrades quietly without a webServer service (the plugin must load in
 *    harnesses that have none).
 */
import { describe, expect, it } from 'vitest'
import { DRY_RUN_ROUTE, registerDryRunRoute, type DryRunRequest } from '../src/events.js'

/** A webServer-like service that records the registered path and replays calls. */
function makeServer() {
  let path = ''
  let handler: ((req: unknown, res: unknown) => unknown) | undefined
  return {
    get path() {
      return path
    },
    register(route: { path: string; handler: (req: unknown, res: unknown) => unknown }): () => void {
      path = route.path
      handler = route.handler
      return () => { handler = undefined }
    },
    /** Drive one request; `raw` is emitted verbatim as the request body. */
    async callRaw(method: string, raw?: string): Promise<{ code: number; body: unknown }> {
      const out = { code: 0, body: undefined as unknown }
      const listeners = new Map<string, (chunk?: unknown) => void>()
      const req = {
        method,
        url: DRY_RUN_ROUTE,
        on(event: string, cb: (chunk?: unknown) => void) {
          listeners.set(event, cb)
          return req
        },
      }
      const res = {
        writeHead(code: number, headers?: Record<string, string>) { out.code = code; void headers },
        end(payload?: string) { out.body = payload === undefined ? undefined : JSON.parse(payload) },
      }
      const done = Promise.resolve(handler?.(req, res))
      if (raw !== undefined) listeners.get('data')?.(raw)
      listeners.get('end')?.()
      await done
      // The handler answers from an async IIFE, so let its microtasks settle.
      await new Promise((resolve) => setTimeout(resolve, 0))
      return out
    },
    call(method: string, body?: unknown): Promise<{ code: number; body: unknown }> {
      return this.callRaw(method, body === undefined ? undefined : JSON.stringify(body))
    },
  }
}

function collector(): { seen: DryRunRequest[]; run: (request: DryRunRequest) => unknown } {
  const seen: DryRunRequest[] = []
  return {
    seen,
    run: (request) => {
      seen.push(request)
      return { verdict: 'deny' }
    },
  }
}

describe('registerDryRunRoute', () => {
  it('registers the dry-run path and returns the provider report', async () => {
    const server = makeServer()
    const provider = collector()
    registerDryRunRoute(server, provider)
    expect(server.path).toBe(DRY_RUN_ROUTE)

    const res = await server.call('POST', { tool: 'shell', args: { command: 'curl https://x' } })
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ ok: true, result: { verdict: 'deny' } })
    expect(provider.seen).toEqual([{ tool: 'shell', args: { command: 'curl https://x' } }])
  })

  it('defaults args to an empty object', async () => {
    const server = makeServer()
    const provider = collector()
    registerDryRunRoute(server, provider)
    const res = await server.call('POST', { tool: 'read' })
    expect(res.code).toBe(200)
    expect(provider.seen[0]?.args).toEqual({})
  })

  it('forwards an explicit permissive flag and nothing else', async () => {
    const server = makeServer()
    const provider = collector()
    registerDryRunRoute(server, provider)
    await server.call('POST', {
      tool: 'shell',
      args: {},
      permissive: true,
      // A smuggled write: the endpoint has no write form, so this must be dropped.
      rulesFile: 'C:\\somewhere\\else.yml',
      allowlist: ['rm'],
    })
    expect(provider.seen[0]).toEqual({ tool: 'shell', args: {}, permissive: true })
  })

  it('ignores a non-boolean permissive flag', async () => {
    const server = makeServer()
    const provider = collector()
    registerDryRunRoute(server, provider)
    await server.call('POST', { tool: 'shell', permissive: 'yes' })
    expect(provider.seen[0]).toEqual({ tool: 'shell', args: {} })
  })

  it('rejects non-POST methods', async () => {
    const server = makeServer()
    registerDryRunRoute(server, collector())
    expect((await server.call('GET')).code).toBe(405)
  })

  it('rejects a missing tool and a non-object args', async () => {
    const server = makeServer()
    registerDryRunRoute(server, collector())
    expect((await server.call('POST', {})).code).toBe(400)
    expect((await server.call('POST', { tool: '' })).code).toBe(400)
    expect((await server.call('POST', { tool: 'shell', args: [1, 2] })).code).toBe(400)
  })

  it('reports a provider failure as 500 instead of crashing the route', async () => {
    const server = makeServer()
    registerDryRunRoute(server, {
      run: () => { throw new Error('rules file is unreadable') },
    })
    const res = await server.call('POST', { tool: 'shell' })
    expect(res.code).toBe(500)
    expect((res.body as { error: string }).error).toContain('rules file is unreadable')
  })

  it('reports a malformed body as 500, never as a silent ok', async () => {
    const server = makeServer()
    registerDryRunRoute(server, collector())
    const res = await server.callRaw('POST', '{not json')
    expect(res.code).toBe(500)
    expect((res.body as { ok: boolean }).ok).toBe(false)
  })

  it('returns undefined when the webServer service is unavailable', () => {
    expect(registerDryRunRoute(undefined, collector())).toBeUndefined()
    expect(registerDryRunRoute({}, collector())).toBeUndefined()
    expect(registerDryRunRoute({ register: 'not-a-function' }, collector())).toBeUndefined()
  })
})
