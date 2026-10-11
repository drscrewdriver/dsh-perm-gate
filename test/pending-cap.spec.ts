import { describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'

/**
 * Capacity of the pending-ask map. Eviction used to be silent: the oldest ask was
 * dropped, its call later settled against nothing, and the loss looked identical to
 * an approval the human never received. Now it is counted and audited.
 */
function runtime(): PermGateRuntime {
  return new PermGateRuntime({ rulesFile: undefined, permissive: true })
}

describe('pending-ask capacity is observable', () => {
  it('reports size, cap and zero evictions while under pressure', () => {
    const r = runtime()
    const exec = { name: 'bash', arguments: { command: 'git status' }, cwd: '/work', sessionId: 's1' }
    r.decideExecution(exec)
    const stats = r.pendingAskStats()
    expect(stats.size).toBe(1)
    expect(stats.evictions).toBe(0)
    expect(stats.cap).toBeGreaterThan(1)
    expect(stats.lastEviction).toBeUndefined()
  })

  it('counts and audits every ask evicted past the cap', () => {
    const r = runtime()
    const cap = r.pendingAskStats().cap
    // One command per call, so each gets its own pending key.
    for (let i = 0; i < cap + 5; i += 1) {
      r.decideExecution({ name: 'bash', arguments: { command: `npm test -- case-${i}` }, cwd: '/work', sessionId: 's2' })
    }
    const stats = r.pendingAskStats()
    expect(stats.size).toBe(cap) // never grows past the cap
    expect(stats.evictions).toBe(5)
    expect(stats.lastEviction?.tool).toBe('bash')
    expect(stats.lastEviction?.key).toMatch(/^fp:/)

    const noted = r.auditEntries.filter((e) => /pending-ask capacity/.test(e.reason))
    expect(noted).toHaveLength(5)
    expect(noted[0]?.outcome).toBe('ask')
    // Eviction must never be recorded as an allow, on the feed or in the audit.
    expect(noted.every((e) => e.outcome === 'ask')).toBe(true)
    expect(r.auditEntries.some((e) => /pending-ask capacity/.test(e.reason) && e.outcome === 'allow')).toBe(false)
  })

  it('still settles a live ask after evictions happened', () => {
    const r = runtime()
    const cap = r.pendingAskStats().cap
    for (let i = 0; i < cap + 2; i += 1) {
      r.decideExecution({ name: 'bash', arguments: { command: `pnpm install --case-${i}` }, cwd: '/work', sessionId: 's3' })
    }
    const survivor = { name: 'bash', arguments: { command: 'pnpm install --case-last' }, cwd: '/work', sessionId: 's3' }
    r.decideExecution(survivor)
    expect(r.pendingAskCount()).toBe(cap)
    expect(r.pendingAskStats().evictions).toBe(3)
  })
})
