/**
 * The permissions-YAML endpoint.
 *
 * Two things are asserted beyond "it answers":
 *
 * 1. It is **read-only**: the only accepted verb is GET, and there is no body to
 *    smuggle a rules edit through. The panel that shows the document must not be
 *    able to change it, or "let me look at the rules" becomes a mutation.
 * 2. It degrades quietly without a webServer service (the plugin must load in
 *    harnesses that have none).
 */
import { describe, expect, it } from 'vitest'
import { RULES_ROUTE, registerRulesRoute } from '../src/events.js'
import type { RulesView } from '../src/rules-view.js'

const VIEW: RulesView = {
  path: 'C:\\dsh\\rules.yml',
  exists: true,
  bytes: 128,
  hash: 'abc123',
  lines: 9,
  raw: 'permissions:\n  defaultAction: ask\n',
  truncated: false,
  defaultAction: 'ask',
  counts: { allow: 1, deny: 2, ask: 0 },
}

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
    async callRaw(method: string, raw?: string): Promise<{ code: number; body: unknown }> {
      const out = { code: 0, body: undefined as unknown }
      const listeners = new Map<string, (chunk?: unknown) => void>()
      const req = {
        method,
        url: RULES_ROUTE,
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
      await new Promise((resolve) => setTimeout(resolve, 0))
      return out
    },
    call(method: string, body?: unknown): Promise<{ code: number; body: unknown }> {
      return this.callRaw(method, body === undefined ? undefined : JSON.stringify(body))
    },
  }
}

describe('registerRulesRoute', () => {
  it('registers the rules path and returns the provider view', async () => {
    const server = makeServer()
    registerRulesRoute(server, { view: () => VIEW })
    expect(server.path).toBe(RULES_ROUTE)

    const res = await server.call('GET')
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ ok: true, result: VIEW })
  })

  it('surfaces an absent or uncompilable file as a rendered result, not an error', async () => {
    // A viewer that only works when the thing it views is healthy is useless:
    // the broken file is exactly what the operator came to look at.
    const broken: RulesView = {
      ...VIEW, exists: true, raw: 'permissions:\n  defaultAction: maybe\n',
      error: 'does not compile: invalid defaultAction', defaultAction: undefined,
      counts: { allow: 0, deny: 0, ask: 0 },
    }
    const server = makeServer()
    registerRulesRoute(server, { view: () => broken })

    const res = await server.call('GET')
    expect(res.code).toBe(200)
    expect((res.body as { ok: boolean }).ok).toBe(true)
    expect((res.body as { result: RulesView }).result.error).toContain('does not compile')
  })

  it('accepts GET only — there is no write form to smuggle a rules edit through', async () => {
    const server = makeServer()
    let calls = 0
    registerRulesRoute(server, { view: () => { calls++; return VIEW } })

    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await server.call(method, { raw: 'permissions: {}', path: 'C:\\evil.yml' })
      expect(res.code).toBe(405)
    }
    // A rejected verb must not have reached the provider at all.
    expect(calls).toBe(0)
  })

  it('reports a provider failure as 500 instead of crashing the route', async () => {
    const server = makeServer()
    registerRulesRoute(server, { view: () => { throw new Error('rules file is unreadable') } })
    const res = await server.call('GET')
    expect(res.code).toBe(500)
    expect((res.body as { error: string }).error).toContain('rules file is unreadable')
  })

  it('returns undefined when the webServer service is unavailable', () => {
    expect(registerRulesRoute(undefined, { view: () => VIEW })).toBeUndefined()
    expect(registerRulesRoute({}, { view: () => VIEW })).toBeUndefined()
    expect(registerRulesRoute({ register: 'not-a-function' }, { view: () => VIEW })).toBeUndefined()
  })
})
