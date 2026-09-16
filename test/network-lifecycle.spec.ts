/**
 * NetworkLifecycle tests.
 *
 * The lifecycle owns the proxy AND the subprocess environment rewrite, so the
 * contracts under test are:
 *
 *   - disabled  => nothing binds, process.env is untouched
 *   - enabled   => proxy live and env routed (unless injectEnv is off)
 *   - detach    => proxy closed AND env restored byte-for-byte
 *   - rebind    => old closed, new live; toggling off fully unwinds
 *   - dispose   => the host effect tears everything down
 *   - snapshot  => reports the truth (active, port, counters, env state)
 *
 * Every test restores the proxy env vars it touched.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { NetworkLifecycle, type NetworkConfigSnapshot } from '../src/network-lifecycle.js'
import { PROXY_ENV_NAMES, NO_PROXY_ENV_NAMES } from '../src/proxy.js'

const PROXY_ENV = [...PROXY_ENV_NAMES, ...NO_PROXY_ENV_NAMES]

const warnings: string[] = []
const logger = {
  warn: (msg: string): void => { warnings.push(msg) },
  info: (msg: string): void => { warnings.push(msg) },
}

/** The env values as they were before each test, restored afterwards. */
const envBefore = new Map<string, string | undefined>()

function snapshotEnv(): void {
  for (const name of PROXY_ENV) envBefore.set(name, process.env[name])
}
function restoreEnv(): void {
  for (const [name, value] of envBefore) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

function baseConfig(overrides: Partial<NetworkConfigSnapshot> = {}): NetworkConfigSnapshot {
  return {
    enabled: true,
    mode: 'whitelist',
    unlisted: 'deny',
    loopback: 'allow',
    bind: '127.0.0.1',
    port: 0,
    noProxy: 'clear',
    injectEnv: true,
    ...overrides,
  }
}

/** Collects registered disposers so a test can simulate a host dispose. */
function makeEffectRegistry(): { effect: (f: () => () => void, label: string) => void; disposeAll: () => void; labels: string[] } {
  const disposers: Array<() => void> = []
  const labels: string[] = []
  return {
    effect: (factory, label) => { disposers.push(factory()); labels.push(label) },
    disposeAll: () => { for (const d of disposers.splice(0)) d() },
    labels,
  }
}

const live: NetworkLifecycle[] = []

afterEach(async () => {
  for (const lc of live.splice(0)) {
    try { await lc.detach() } catch { /* already detached */ }
  }
  restoreEnv()
  warnings.length = 0
})

describe('NetworkLifecycle', () => {
  it('binds nothing and leaves process.env untouched when disabled', async () => {
    snapshotEnv()
    const cfg = baseConfig({ enabled: false })
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()

    const snap = lc.snapshot()
    expect(snap.enabled).toBe(false)
    expect(snap.proxyActive).toBe(false)
    expect(snap.envInjected).toBe(false)
    expect(process.env.HTTP_PROXY).toBe(envBefore.get('HTTP_PROXY'))
    expect(process.env.HTTPS_PROXY).toBe(envBefore.get('HTTPS_PROXY'))
  })

  it('binds a proxy and routes the environment when enabled', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()

    const snap = lc.snapshot()
    expect(snap.proxyActive).toBe(true)
    expect(snap.port).toBeGreaterThan(0)
    expect(snap.envInjected).toBe(true)
    // Every proxy env name points at the bound port.
    expect(process.env.HTTP_PROXY).toBe(`http://127.0.0.1:${snap.port}`)
    expect(process.env.HTTPS_PROXY).toBe(`http://127.0.0.1:${snap.port}`)
    // NO_PROXY is cleared so the policy cannot be bypassed.
    expect(process.env.NO_PROXY).toBe('')
  })

  it('restores the environment byte-for-byte on detach', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()
    await lc.detach()

    for (const name of PROXY_ENV) {
      expect(process.env[name]).toBe(envBefore.get(name))
    }
    const snap = lc.snapshot()
    expect(snap.proxyActive).toBe(false)
    expect(snap.envInjected).toBe(false)
  })

  it('does not touch the environment when injectEnv is false', async () => {
    snapshotEnv()
    const cfg = baseConfig({ injectEnv: false })
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()

    const snap = lc.snapshot()
    expect(snap.proxyActive).toBe(true) // the listener is up
    expect(snap.envInjected).toBe(false) // but nothing was rewritten
    for (const name of PROXY_ENV) {
      expect(process.env[name]).toBe(envBefore.get(name))
    }
  })

  it('rebinds onto a new port and keeps exactly one live proxy', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()
    const first = lc.snapshot().port
    expect(first).toBeGreaterThan(0)

    await lc.rebind()
    const second = lc.snapshot().port
    expect(second).toBeGreaterThan(0)
    // The old env value must not linger: it points at the new port.
    expect(process.env.HTTP_PROXY).toBe(`http://127.0.0.1:${second}`)
  })

  it('rebind to disabled fully unwinds (proxy + env)', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()
    expect(lc.snapshot().proxyActive).toBe(true)

    cfg.enabled = false
    await lc.rebind()

    const snap = lc.snapshot()
    expect(snap.enabled).toBe(false)
    expect(snap.proxyActive).toBe(false)
    expect(snap.envInjected).toBe(false)
    for (const name of PROXY_ENV) {
      expect(process.env[name]).toBe(envBefore.get(name))
    }
  })

  it('is a no-op when attach is called twice', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()
    const first = lc.snapshot().port
    await lc.attach()
    expect(lc.snapshot().port).toBe(first)
  })

  it('serializes concurrent rebinds without leaking a listener', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()
    // Fire several rebinds at once; the queue must serialize them.
    await Promise.all([lc.rebind(), lc.rebind(), lc.rebind()])

    const snap = lc.snapshot()
    expect(snap.proxyActive).toBe(true)
    expect(process.env.HTTP_PROXY).toBe(`http://127.0.0.1:${snap.port}`)
  })

  it('tears down through the host effect disposer', async () => {
    snapshotEnv()
    const cfg = baseConfig()
    const registry = makeEffectRegistry()
    const lc = new NetworkLifecycle({
      ...registry,
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await lc.attach()
    expect(lc.snapshot().proxyActive).toBe(true)
    expect(registry.labels).toContain('dsh-perm-gate: network proxy')

    registry.disposeAll()
    // The disposer kicks off an async detach; give it a tick.
    await new Promise((r) => setTimeout(r, 150))

    expect(lc.snapshot().proxyActive).toBe(false)
    expect(process.env.HTTP_PROXY).toBe(envBefore.get('HTTP_PROXY'))
  })

  it('degrades (no throw) when the port is already in use', async () => {
    snapshotEnv()
    const { createServer } = await import('node:http')
    const squatter = createServer()
    await new Promise<void>((r) => squatter.listen(0, '127.0.0.1', () => r()))
    const taken = (squatter.address() as { port: number }).port

    const cfg = baseConfig({ port: taken })
    const lc = new NetworkLifecycle({
      ...makeEffectRegistry(),
      readConfig: () => cfg,
      decide: () => ({ action: 'deny', matched: false, mode: 'deny-all' }),
      attribution: () => undefined,
      logger,
    })
    live.push(lc)

    await expect(lc.attach()).resolves.toBeUndefined()
    const snap = lc.snapshot()
    expect(snap.proxyActive).toBe(false)
    expect(snap.envInjected).toBe(false) // nothing injected on a failed bind
    expect(warnings.some((w) => w.includes('bind failed'))).toBe(true)

    await new Promise<void>((r) => squatter.close(() => r()))
  })
})
