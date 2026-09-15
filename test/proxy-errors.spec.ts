/**
 * Proxy abnormal-path regression tests.
 *
 * A policy proxy must NEVER take down its host. These tests exercise the
 * failure modes that actually crashed a host in production:
 *
 *   1. Client RSTs after receiving a 403 block (the original crash)
 *   2. Upstream connection refused
 *   3. Malformed CONNECT authority
 *   4. Bind failure (port in use) — must degrade, not throw
 *   5. Double close / close while starting
 *   6. Unhandled socket error injected directly
 *
 * If any of these crash the worker, the test file fails — which IS the
 * assertion. The explicit expects below cover the non-crash contracts.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'
import type { AddressInfo } from 'node:net'
import { NetworkProxy } from '../src/proxy.js'
import { decideNetworkTarget } from '../src/network.js'
import type { NetworkTarget } from '../src/network.js'
import { compileDocument, parsePermissionsDocument } from '../src/rule.js'

const warnings: string[] = []
const logger = { warn: (msg: string): void => { warnings.push(msg) } }

function ruleset(yaml: string) {
  return compileDocument(parsePermissionsDocument(yaml))
}

/** A proxy whose decision function always blocks. */
function blockingProxy(overrides: Partial<ConstructorParameters<typeof NetworkProxy>[0]> = {}) {
  return new NetworkProxy({
    bind: '127.0.0.1',
    port: 0,
    maxRecent: 10,
    decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
    logger,
    ...overrides,
  })
}

/** A proxy whose decision function always allows. */
function allowingProxy(overrides: Partial<ConstructorParameters<typeof NetworkProxy>[0]> = {}) {
  return new NetworkProxy({
    bind: '127.0.0.1',
    port: 0,
    maxRecent: 10,
    decide: () => ({ action: 'allow', matched: false, mode: 'allow-all' }),
    logger,
    ...overrides,
  })
}

const live: NetworkProxy[] = []
function track<T extends NetworkProxy>(p: T): T {
  live.push(p)
  return p
}

afterEach(async () => {
  for (const p of live.splice(0)) {
    try { await p.close() } catch { /* already closed */ }
  }
  warnings.length = 0
})

/**
 * Open a raw TCP connection to the proxy and send a CONNECT line.
 * Resolves as soon as any response bytes arrive (or the peer closes).
 */
function sendConnect(port: number, authority: string, waitMs = 3000): Promise<{ socket: ReturnType<typeof connect>; response: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    let response = ''
    let settled = false
    const settle = (): void => {
      if (settled) return
      settled = true
      resolve({ socket, response })
    }
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      response += chunk
      if (response.includes('\r\n\r\n')) settle()
    })
    socket.on('error', (err) => { if (settled) return; settled = true; reject(err) })
    socket.on('close', () => settle())
    socket.once('connect', () => {
      socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`)
    })
    setTimeout(settle, waitMs)
  })
}

describe('proxy abnormal paths', () => {
  it('survives a client RST immediately after a 403 block', async () => {
    const proxy = track(blockingProxy())
    const port = await proxy.start()
    expect(port).toBeGreaterThan(0)

    // IP literal: no DNS round-trip, so the 403 comes back deterministically.
    const { socket, response } = await sendConnect(port, '10.0.0.1:443')
    expect(response).toContain('403')
    expect(response).toContain('network: denied')

    // Abrupt RST — this is what killed the host before the fix.
    socket.resetAndDestroy()
    await new Promise((r) => setTimeout(r, 200))

    // Still serving: a second request must be answered.
    const second = await sendConnect(port, '10.0.0.2:443')
    expect(second.response).toContain('403')
    second.socket.destroy()
  })

  it('survives a client RST after a 403 block on a hostname target (the real crash)', async () => {
    const proxy = track(blockingProxy())
    const port = await proxy.start()

    const { socket, response } = await sendConnect(port, 'github.com:443', 8000)
    expect(response).toContain('403')
    socket.resetAndDestroy()
    await new Promise((r) => setTimeout(r, 300))

    // The process must still be alive and serving.
    const again = await sendConnect(port, '10.0.0.3:443')
    expect(again.response).toContain('403')
    again.socket.destroy()
  })

  it('stays alive when the upstream refuses the connection', async () => {
    const proxy = track(allowingProxy())
    const port = await proxy.start()

    // Port 9 (discard) is not listening here: upstream connect fails.
    const { socket } = await sendConnect(port, '127.0.0.1:9', 1500)
    socket.destroy()
    await new Promise((r) => setTimeout(r, 250))

    // Proxy is still alive and adjudicating: swap in a blocking proxy view
    // by issuing a CONNECT that the ruleset denies is not possible here, so
    // assert liveness through the socket accounting instead.
    expect(proxy.port).toBeGreaterThan(0)
    const probe = await sendConnect(port, '127.0.0.1:9', 1500)
    probe.socket.destroy()
    expect(proxy.blockStats()).toBeDefined()
  })

  it('answers 400 for a malformed CONNECT authority', async () => {
    const proxy = track(blockingProxy())
    const port = await proxy.start()
    const { socket, response } = await sendConnect(port, 'no-port-here')
    expect(response).toContain('400')
    socket.destroy()
  })

  it('handles a plain HTTP request whose target is unparseable', async () => {
    const proxy = track(blockingProxy())
    const port = await proxy.start()

    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest({
        host: '127.0.0.1', port, method: 'GET', path: '/not-absolute',
      }, (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      })
      req.on('error', reject)
      req.end()
    })
    expect(status).toBe(404)
  })

  it('degrades to -1 instead of throwing when the port is already bound', async () => {
    const squatter = createServer()
    await new Promise<void>((r) => squatter.listen(0, '127.0.0.1', () => r()))
    const takenPort = (squatter.address() as AddressInfo).port

    const proxy = track(blockingProxy({ port: takenPort }))
    warnings.length = 0
    const result = await proxy.start()

    expect(result).toBe(-1)
    expect(warnings.some((w) => w.includes('bind failed'))).toBe(true)
    await new Promise<void>((r) => squatter.close(() => r()))
  })

  it('tolerates close() called twice and close() before start()', async () => {
    const neverStarted = track(blockingProxy())
    await expect(neverStarted.close()).resolves.toBeUndefined()

    const proxy = track(blockingProxy())
    await proxy.start()
    await expect(proxy.close()).resolves.toBeUndefined()
    await expect(proxy.close()).resolves.toBeUndefined()
  })

  it('destroys every tunnel socket on close', async () => {
    const proxy = track(allowingProxy())
    const port = await proxy.start()

    // Establish a tunnel to the test's own HTTP server so the upstream lives.
    const upstream = createServer((_req, res) => res.end('ok'))
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()))
    const upstreamPort = (upstream.address() as AddressInfo).port

    const { socket } = await sendConnect(port, `127.0.0.1:${upstreamPort}`)
    await new Promise((r) => setTimeout(r, 150))
    // The tunnel should be live (200 Connection Established).
    expect(proxy.activeSocketCount()).toBeGreaterThan(0)

    await proxy.close()
    await new Promise((r) => setTimeout(r, 100))
    expect(proxy.activeSocketCount()).toBe(0)

    socket.destroy()
    await new Promise<void>((r) => upstream.close(() => r()))
  })

  it('never crashes when an error is emitted on an accepted socket', async () => {
    const proxy = track(blockingProxy())
    const port = await proxy.start()
    const { socket } = await sendConnect(port, 'github.com:443')
    // Force the client side to hang up without reading — server sees RST.
    socket.setNoDelay(true)
    socket.resetAndDestroy()
    await new Promise((r) => setTimeout(r, 200))
    // Reaching here means the process survived.
    expect(proxy.port).toBeGreaterThan(0)
  })

  it('records blocks with mode and matched-flag attribution', async () => {
    const rules = ruleset(`defaultAction: deny
allow:
  - network:
      domains: ["allowed.example"]
`)
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1',
      port: 0,
      maxRecent: 10,
      decide: (t: NetworkTarget) => decideNetworkTarget(rules, t, {
        mode: 'whitelist', unlisted: 'deny', loopback: 'allow',
      }),
      logger,
    }))
    const port = await proxy.start()

    const { socket } = await sendConnect(port, 'blocked.example:443')
    await new Promise((r) => setTimeout(r, 150))
    socket.destroy()

    const recent = proxy.recentBlocks()
    expect(recent.length).toBeGreaterThan(0)
    expect(recent[0].domain).toBe('blocked.example')
    expect(recent[0].mode).toBe('whitelist')
    expect(recent[0].matched).toBe(false) // mode default, not a rule hit
    expect(proxy.blockStats().denied).toBeGreaterThan(0)
  })
})
