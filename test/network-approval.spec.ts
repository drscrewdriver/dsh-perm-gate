/**
 * Network approval-escalation tests.
 *
 * The contract has three tiers, and each one is asserted here:
 *
 *   L0  default   — nothing reaches the network without an allow rule
 *   L1  confirm   — an `ask` verdict escalates to the interactive seam, raised
 *                   on behalf of the shell command that opened the connection
 *   L2  review    — approval WIDENS reach but can never override a `deny` rule,
 *                   and unattributable traffic can never be approved at all
 *
 * The escalation callbacks are injected, so every branch (allow / reject /
 * throw / absent / timeout) is exercised without a live approval service.
 */
import { describe, expect, it, afterEach, vi } from 'vitest'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import type { AddressInfo } from 'node:net'
import { PermGateRuntime } from '../src/runtime.js'
import { NetworkProxy } from '../src/proxy.js'
import { decideNetworkTarget, type NetworkDecision, type NetworkTarget } from '../src/network.js'
import { compileDocument, parsePermissionsDocument } from '../src/rule.js'

const warnings: string[] = []
const logger = { warn: (msg: string): void => { warnings.push(msg) } }

function ruleset(yaml: string) {
  return compileDocument(parsePermissionsDocument(yaml))
}

/** Open a raw CONNECT and collect the immediate response status line. */
function sendConnect(port: number, authority: string, waitMs = 2500): Promise<{ socket: ReturnType<typeof connect>; response: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    let response = ''
    let settled = false
    const settle = (): void => { if (!settled) { settled = true; resolve({ socket, response }) } }
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => { response += chunk; if (response.includes('\r\n\r\n')) settle() })
    socket.on('error', (err) => { if (!settled) { settled = true; reject(err) } })
    socket.on('close', () => settle())
    socket.once('connect', () => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`))
    setTimeout(settle, waitMs)
  })
}

const live: NetworkProxy[] = []
function track<T extends NetworkProxy>(p: T): T { live.push(p); return p }

afterEach(async () => {
  for (const p of live.splice(0)) { try { await p.close() } catch { /* closed */ } }
  warnings.length = 0
  vi.restoreAllMocks()
})

// ─── Proxy escalation ──────────────────────────────────────────────────────

describe('proxy escalation', () => {
  const askDecision: NetworkDecision = { action: 'ask', matched: false, mode: 'whitelist' }

  it('lets an approved ask through', async () => {
    const escalate = vi.fn().mockResolvedValue('allow')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: () => askDecision,
      escalate,
      logger,
    }))
    const port = await proxy.start()

    // Loopback is not special-cased here (our decide always asks), so the
    // approval is what decides. Point at a live upstream to see the tunnel.
    const upstream = createServer((_q, r) => r.end('ok'))
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()))
    const upstreamPort = (upstream.address() as AddressInfo).port

    const { socket, response } = await sendConnect(port, `127.0.0.1:${upstreamPort}`)
    expect(escalate).toHaveBeenCalledTimes(1)
    expect(response).toContain('200')
    socket.destroy()
    await new Promise<void>((r) => upstream.close(() => r()))
  })

  it('blocks when the human rejects', async () => {
    const escalate = vi.fn().mockResolvedValue('deny')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: () => askDecision,
      escalate,
      logger,
    }))
    const port = await proxy.start()

    const { socket, response } = await sendConnect(port, '10.1.2.3:443')
    expect(escalate).toHaveBeenCalledTimes(1)
    expect(response).toContain('403')
    expect(proxy.blockStats().askBlocked).toBe(1)
    socket.destroy()
  })

  it('NEVER escalates a deny verdict (rule review is authoritative)', async () => {
    const escalate = vi.fn().mockResolvedValue('allow')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: () => ({ action: 'deny', matched: true, mode: 'whitelist', ruleIndex: 0 }),
      escalate,
      logger,
    }))
    const port = await proxy.start()

    const { socket, response } = await sendConnect(port, '10.9.9.9:443')
    expect(escalate).not.toHaveBeenCalled()
    expect(response).toContain('403')
    socket.destroy()
  })

  it('never escalates an allow verdict', async () => {
    const escalate = vi.fn().mockResolvedValue('deny')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: () => ({ action: 'allow', matched: true, mode: 'whitelist' }),
      escalate,
      logger,
    }))
    const port = await proxy.start()

    const upstream = createServer((_q, r) => r.end('ok'))
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()))
    const upstreamPort = (upstream.address() as AddressInfo).port

    const { socket, response } = await sendConnect(port, `127.0.0.1:${upstreamPort}`)
    expect(escalate).not.toHaveBeenCalled()
    expect(response).toContain('200')
    socket.destroy()
    await new Promise<void>((r) => upstream.close(() => r()))
  })

  it('fails closed when the escalation itself throws', async () => {
    const escalate = vi.fn().mockRejectedValue(new Error('seam exploded'))
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: () => askDecision,
      escalate,
      logger,
    }))
    const port = await proxy.start()

    const { socket, response } = await sendConnect(port, '10.4.4.4:443')
    expect(response).toContain('403')
    expect(warnings.some((w) => w.includes('escalation failed'))).toBe(true)
    socket.destroy()
  })

  it('blocks an ask when no escalation hook is wired', async () => {
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: () => askDecision,
      logger,
    }))
    const port = await proxy.start()

    const { socket, response } = await sendConnect(port, '10.5.5.5:443')
    expect(response).toContain('403')
    socket.destroy()
  })
})

// ─── Runtime attribution + approval ────────────────────────────────────────

describe('runtime network attribution', () => {
  function runtime(overrides: Record<string, unknown> = {}): PermGateRuntime {
    return new PermGateRuntime({ defaultAction: 'allow', ...overrides })
  }

  it('attributes an in-flight shell execution', () => {
    const r = runtime()
    const exec = { name: 'bash', arguments: { command: 'curl x' }, callId: 'call-1' }
    r.beginShellExecution(exec)
    const a = r.currentAttribution()
    expect(a?.tool).toBe('bash')
    expect(a?.callId).toBe('call-1')
  })

  it('drops the attribution once the call settles', () => {
    const r = runtime()
    const exec = { name: 'bash', arguments: { command: 'curl x' }, callId: 'call-1' }
    r.beginShellExecution(exec)
    expect(r.currentAttribution()).toBeDefined()
    r.endShellExecution(exec)
    expect(r.currentAttribution()).toBeUndefined()
  })

  it('ignores non-shell tools', () => {
    const r = runtime()
    r.beginShellExecution({ name: 'read', arguments: { file_path: 'a' } })
    expect(r.currentAttribution()).toBeUndefined()
  })

  it('drops an aborted execution (it will never run)', () => {
    const r = runtime()
    const controller = new AbortController()
    r.beginShellExecution({ name: 'bash', arguments: {}, signal: controller.signal })
    expect(r.currentAttribution()).toBeDefined()
    controller.abort()
    expect(r.currentAttribution()).toBeUndefined()
  })

  it('reports the newest in-flight execution', () => {
    const r = runtime()
    r.beginShellExecution({ name: 'bash', arguments: {}, callId: 'old' })
    r.beginShellExecution({ name: 'pwsh', arguments: {}, callId: 'new' })
    expect(r.currentAttribution()?.callId).toBe('new')
  })

  it('denies without asking when nothing is attributable', async () => {
    const requestApproval = vi.fn().mockResolvedValue('allowed-once')
    const r = runtime({ requestApproval })
    const verdict = await r.askNetwork({ host: 'example.com', ips: [] }, 'why', 1000)
    expect(verdict).toBe('deny')
    expect(requestApproval).not.toHaveBeenCalled()
  })

  it('allows on allowed-once and remembers it for the session', async () => {
    const requestApproval = vi.fn().mockResolvedValue('allowed-once')
    const r = runtime({ requestApproval })
    r.beginShellExecution({ name: 'bash', arguments: {}, agent: { session: {} }, sessionId: 's1' })

    const target: NetworkTarget = { host: 'example.com', port: 443, scheme: 'https', ips: [] }
    expect(await r.askNetwork(target, 'why', 1000)).toBe('allow')
    expect(requestApproval).toHaveBeenCalledTimes(1)

    // Second connection to the same target: the session grant answers it.
    expect(await r.askNetwork(target, 'why', 1000)).toBe('allow')
    expect(requestApproval).toHaveBeenCalledTimes(1)
  })

  it('denies on rejected / cancelled / unavailable', async () => {
    for (const outcome of ['rejected', 'cancelled', 'unavailable']) {
      const requestApproval = vi.fn().mockResolvedValue(outcome)
      const r = runtime({ requestApproval })
      r.beginShellExecution({ name: 'bash', arguments: {}, agent: {}, sessionId: 's1' })
      const verdict = await r.askNetwork({ host: `h-${outcome}.example`, ips: [] }, 'why', 1000)
      expect(verdict).toBe('deny')
    }
  })

  it('denies when the approval seam throws', async () => {
    const requestApproval = vi.fn().mockRejectedValue(new Error('no open turn'))
    const r = runtime({ requestApproval })
    r.beginShellExecution({ name: 'bash', arguments: {}, agent: {}, sessionId: 's1' })
    expect(await r.askNetwork({ host: 'example.com', ips: [] }, 'why', 1000)).toBe('deny')
  })

  it('denies when the approval times out', async () => {
    // Never resolves: the gate's own timeout must settle it closed.
    const requestApproval = vi.fn().mockImplementation(() => new Promise(() => {}))
    const r = runtime({ requestApproval })
    r.beginShellExecution({ name: 'bash', arguments: {}, agent: {}, sessionId: 's1' })
    const verdict = await r.askNetwork({ host: 'slow.example', ips: [] }, 'why', 80)
    expect(verdict).toBe('deny')
  })

  it('does not share a session grant across different targets', async () => {
    const requestApproval = vi.fn().mockResolvedValue('allowed-once')
    const r = runtime({ requestApproval })
    r.beginShellExecution({ name: 'bash', arguments: {}, agent: {}, sessionId: 's1' })
    await r.askNetwork({ host: 'a.example', ips: [] }, 'why', 1000)
    await r.askNetwork({ host: 'b.example', ips: [] }, 'why', 1000)
    expect(requestApproval).toHaveBeenCalledTimes(2)
  })

  it('does not share a session grant across sessions', async () => {
    const requestApproval = vi.fn().mockResolvedValue('allowed-once')
    const r = runtime({ requestApproval })
    const target: NetworkTarget = { host: 'shared.example', ips: [] }

    r.beginShellExecution({ name: 'bash', arguments: {}, agent: {}, sessionId: 's1' })
    await r.askNetwork(target, 'why', 1000)
    r.clearShellExecutions()
    r.beginShellExecution({ name: 'bash', arguments: {}, agent: {}, sessionId: 's2' })
    await r.askNetwork(target, 'why', 1000)

    expect(requestApproval).toHaveBeenCalledTimes(2)
  })
})

// ─── Rule review stays authoritative end-to-end ────────────────────────────

describe('rule review is never bypassed by approval', () => {
  it('a deny rule blocks even when the escalation would approve', async () => {
    const rules = ruleset(`defaultAction: ask
deny:
  - network:
      domains: ["blocked.example"]
`)
    const escalate = vi.fn().mockResolvedValue('allow')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: (t: NetworkTarget) => decideNetworkTarget(rules, t, {
        mode: 'whitelist', unlisted: 'ask', loopback: 'policy',
      }),
      escalate,
      logger,
    }))
    const port = await proxy.start()

    const denied = await sendConnect(port, 'blocked.example:443')
    expect(denied.response).toContain('403')
    denied.socket.destroy()
    // The escalation hook is never consulted for a deny.
    expect(escalate).not.toHaveBeenCalled()
  })

  it('an unlisted target escalates, and an approval lets it through', async () => {
    const rules = ruleset(`defaultAction: ask
deny: []
allow:
  - network:
      domains: ["allowed.example"]
`)
    const escalate = vi.fn().mockResolvedValue('allow')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: (t: NetworkTarget) => decideNetworkTarget(rules, t, {
        mode: 'whitelist', unlisted: 'ask', loopback: 'policy',
      }),
      escalate,
      logger,
    }))
    const port = await proxy.start()

    // A live upstream on loopback, evaluated by policy (unlisted -> ask).
    const upstream = createServer((_q, r) => r.end('ok'))
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()))
    const upstreamPort = (upstream.address() as AddressInfo).port

    const { socket, response } = await sendConnect(port, `127.0.0.1:${upstreamPort}`)
    expect(escalate).toHaveBeenCalledTimes(1)
    expect(response).toContain('200')
    socket.destroy()
    await new Promise<void>((r) => upstream.close(() => r()))
  })

  it('an allow rule passes without ever escalating', async () => {
    const rules = ruleset(`defaultAction: ask
deny: []
allow:
  - network:
      domains: ["127.0.0.1"]
`)
    const escalate = vi.fn().mockResolvedValue('deny')
    const proxy = track(new NetworkProxy({
      bind: '127.0.0.1', port: 0, maxRecent: 10,
      decide: (t: NetworkTarget) => decideNetworkTarget(rules, t, {
        mode: 'whitelist', unlisted: 'ask', loopback: 'policy',
      }),
      escalate,
      logger,
    }))
    const port = await proxy.start()

    const upstream = createServer((_q, r) => r.end('ok'))
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()))
    const upstreamPort = (upstream.address() as AddressInfo).port

    const { socket, response } = await sendConnect(port, `127.0.0.1:${upstreamPort}`)
    expect(escalate).not.toHaveBeenCalled()
    expect(response).toContain('200')
    socket.destroy()
    await new Promise<void>((r) => upstream.close(() => r()))
  })
})
