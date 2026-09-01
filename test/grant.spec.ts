import { describe, expect, it } from 'vitest'
import { canonicalizeCall, GrantRegistry, withExpiry } from '../src/grant.js'

describe('canonicalizeCall', () => {
  it('is stable across key order', () => {
    expect(canonicalizeCall('write', { a: 1, b: 2 })).toBe(canonicalizeCall('write', { b: 2, a: 1 }))
  })

  it('normalizes whitespace inside a command', () => {
    expect(
      canonicalizeCall('bash', { command: 'rm -rf  /work' }),
    ).toBe(canonicalizeCall('bash', { command: 'rm -rf /work' }))
  })

  it('keeps different targets distinct (no cross-target reuse)', () => {
    expect(canonicalizeCall('bash', { command: 'rm a.txt' })).not.toBe(canonicalizeCall('bash', { command: 'rm b.txt' }))
  })
})

function reg(now: () => number = () => 0): GrantRegistry {
  return new GrantRegistry('sess', now)
}

describe('GrantRegistry', () => {
  it('consumes a minted grant for the exact call', () => {
    const g = reg()
    g.mint({ tool: 'bash', fingerprint: canonicalizeCall('bash', { command: 'rm a.txt' }), decidedBy: 'human', ttlMs: 1000, maxUses: 1 })
    expect(g.decide('bash', { command: 'rm a.txt' })).toBe('allow')
    expect(g.decide('bash', { command: 'rm a.txt' })).toBe('no-match') // one-shot
  })

  it('does NOT reuse the grant for a different target (no-replay)', () => {
    const g = reg()
    g.mint({ tool: 'bash', fingerprint: canonicalizeCall('bash', { command: 'rm a.txt' }), decidedBy: 'human', ttlMs: 1000, maxUses: 1 })
    expect(g.decide('bash', { command: 'rm b.txt' })).toBe('no-match')
  })

  it('does not allow after expiry', () => {
    let t = 0
    const g = new GrantRegistry('sess', () => t)
    g.mint({ tool: 'bash', fingerprint: canonicalizeCall('bash', { command: 'x' }), decidedBy: 'human', ttlMs: 100, maxUses: 1 })
    t = 200
    expect(g.decide('bash', { command: 'x' })).toBe('no-match')
  })
})

describe('SessionGrant / withExpiry', () => {
  it('computes expiry from ttlMs', () => {
    const spec = withExpiry({ tool: 'bash', fingerprint: 'f', decidedBy: 'human', sessionId: 's', parentAuthorized: true, ttlMs: 5000, maxUses: 1 }, () => 1000)
    expect(spec.expiresAt).toBe(6000)
  })
})