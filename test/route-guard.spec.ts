/**
 * The route choke point. These assertions are the security contract, not a
 * smoke test:
 *
 * 1. Capability probing picks host / pass in the documented order, and a host
 *    that offers neither still lands on the cookie fence (never silent pass).
 * 2. In host mode a non-empty admission verdict answers 401 and the handler is
 *    NOT called; a probe that throws fails closed.
 * 3. In pass mode the registration carries auth 'required'; a host that refuses
 *    the key is downgraded to the cookie fence instead of losing the route.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MODE_ENV,
  guardedRegister,
  fenceMode,
  resetGuardWarnings,
  type GuardDeps,
  type GuardRoute,
} from '../src/route-guard.js'

/** A webServer that records exactly what it was registered with. */
function makeServer(options: { rejectAuth?: boolean } = {}) {
  const registrations: Array<GuardRoute & { auth?: string }> = []
  return {
    registrations,
    register(route: GuardRoute): () => void {
      if (options.rejectAuth === true && route.auth !== undefined) {
        throw new Error('unknown option: auth')
      }
      registrations.push(route as GuardRoute & { auth?: string })
      return () => undefined
    },
    get last() {
      return registrations[registrations.length - 1]
    },
  }
}

/** Drive one request through the registered handler. */
async function call(route: GuardRoute, req: Record<string, unknown>) {
  const out = { code: 0, body: undefined as unknown }
  const res = {
    writeHead(code: number) { out.code = code },
    end(payload?: string) { out.body = payload === undefined ? undefined : JSON.parse(payload) },
  }
  const handler = route.handler as (r: unknown, s: unknown) => unknown
  await handler(req, res)
  return out
}

const ROUTE: GuardRoute = {
  kind: 'exact',
  path: '/api/dsh-perm-gate/events',
  methodKind: 'read',
  handler: () => undefined,
}

beforeEach(() => {
  resetGuardWarnings()
})
describe('fenceMode capability probing', () => {
  it('picks host when the connection service exposes requestRejection', () => {
    const deps: GuardDeps = { connection: { requestRejection: () => undefined }, env: {} }
    expect(fenceMode(deps)).toBe('host')
  })

  it('picks pass when there is no connection service at all', () => {
    expect(fenceMode({ env: {} })).toBe('pass')
  })

  it('picks pass when the connection service exists without requestRejection', () => {
    expect(fenceMode({ connection: {}, env: {} })).toBe('pass')
  })

  it('honours an explicit env override, including off', () => {
    const withConn: GuardDeps = { connection: { requestRejection: () => undefined }, env: { [MODE_ENV]: 'cookie' } }
    expect(fenceMode(withConn)).toBe('cookie')
    expect(fenceMode({ env: { [MODE_ENV]: 'off' } })).toBe('off')
  })

  it('ignores a bogus env value and falls back to probing', () => {
    const log = vi.fn()
    const deps: GuardDeps = { connection: { requestRejection: () => undefined }, env: { [MODE_ENV]: 'nonsense' }, log }
    expect(fenceMode(deps)).toBe('host')
    expect(log).toHaveBeenCalledTimes(1)
  })
})

describe('host fence', () => {
  const deps = (verdict: () => unknown, log = vi.fn()): GuardDeps => ({
    mode: 'host',
    env: {},
    log,
    connection: { requestRejection: verdict },
  })

  it('answers 401 and never runs the handler when the host rejects', async () => {
    const server = makeServer()
    const handler = vi.fn()
    guardedRegister(server, { ...ROUTE, handler }, deps(() => 'unauthenticated'))
    const out = await call(server.last, { method: 'GET', headers: {} })
    expect(out.code).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    expect((out.body as { fence: string }).fence).toBe('auth')
  })

  it('reaches the handler when the host admits the request', async () => {
    const server = makeServer()
    const handler = vi.fn()
    guardedRegister(server, { ...ROUTE, handler }, deps(() => undefined))
    const out = await call(server.last, { method: 'GET', headers: { cookie: 'dsh-auth-x=1' } })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(out.code).toBe(0)
  })

  it('fails closed when the admission probe throws', async () => {
    const server = makeServer()
    const handler = vi.fn()
    guardedRegister(server, { ...ROUTE, handler }, deps(() => { throw new Error('service down') }))
    const out = await call(server.last, { method: 'GET', headers: {} })
    expect(out.code).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('pass fence', () => {
  it("declares auth 'required' on the registration", () => {
    const server = makeServer()
    guardedRegister(server, ROUTE, { mode: 'pass', env: {} })
    expect(server.last.auth).toBe('required')
    expect(server.last.path).toBe(ROUTE.path)
  })

  it('downgrades to the cookie fence when the host refuses the unknown option', async () => {
    const server = makeServer({ rejectAuth: true })
    const handler = vi.fn()
    guardedRegister(server, { ...ROUTE, handler }, { mode: 'pass', env: {}, log: vi.fn() })
    expect(server.registrations).toHaveLength(1)
    expect(server.last.auth).toBeUndefined()
    const denied = await call(server.last, { method: 'GET', headers: {} })
    expect(denied.code).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    const admitted = await call(server.last, { method: 'GET', headers: { cookie: 'a=b; dsh-auth-session=abc' } })
    expect(admitted.code).toBe(0)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('cookie fence', () => {
  it('401s a request with no dsh-auth cookie', async () => {
    const server = makeServer()
    const handler = vi.fn()
    guardedRegister(server, { ...ROUTE, handler }, { mode: 'cookie', env: {} })
    const out = await call(server.last, { method: 'GET', headers: { cookie: 'theme=dark' } })
    expect(out.code).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('passes a request that carries the host cookie', async () => {
    const server = makeServer()
    const handler = vi.fn()
    guardedRegister(server, { ...ROUTE, handler }, { mode: 'cookie', env: {} })
    const out = await call(server.last, { method: 'GET', headers: { Cookie: 'dsh-auth-token=abc' } })
    expect(out.code).toBe(0)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('off escape hatch', () => {
  it('registers bare but warns exactly once', () => {
    const log = vi.fn()
    const server = makeServer()
    guardedRegister(server, ROUTE, { mode: 'off', env: {}, log })
    guardedRegister(server, ROUTE, { mode: 'off', env: {}, log })
    expect(server.registrations).toHaveLength(2)
    expect(server.last.auth).toBeUndefined()
    expect(log).toHaveBeenCalledTimes(1)
    expect(String(log.mock.calls[0]?.[0])).toContain('DISABLED')
  })
})
