/**
 * Learning scope: the store used to key every session into one `tool|fp`
 * bucket, so any session that confirmed an operation lowered the bar for all
 * of them - a rule could be farmed into existence for sessions that never saw
 * it. These tests pin the isolation and the one escape hatch (explicit
 * promotion), and pin that the DEFAULT behaviour did not change.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GLOBAL_PREFIX, RiskLearning, normalizeKey, parseKey, sessionKey } from '../src/learning.js'

const dirs: string[] = []
function store() {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-scope-'))
  dirs.push(dir)
  return join(dir, 'learning.json')
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const KEY = 'shell|npm|left-pad'
const FP = 'fp-1'

describe('key namespaces', () => {
  it('treats an unprefixed key as global (no migration needed)', () => {
    expect(normalizeKey(KEY)).toBe(GLOBAL_PREFIX + KEY)
    expect(parseKey(KEY)).toEqual({ scope: 'global', bare: KEY })
  })

  it('builds and parses a session key', () => {
    expect(sessionKey('s1', KEY)).toBe('session:s1|' + KEY)
    expect(parseKey('session:s1|' + KEY)).toEqual({ scope: 'session', sessionId: 's1', bare: KEY })
  })

  it('is idempotent on an already-prefixed key', () => {
    expect(normalizeKey(GLOBAL_PREFIX + KEY)).toBe(GLOBAL_PREFIX + KEY)
  })
})

describe('global scope keeps today behaviour', () => {
  it('shares counts across sessions', () => {
    const file = store()
    const a = new RiskLearning(file, { threshold: 2, sessionId: 's1' })
    const b = new RiskLearning(file, { threshold: 2, sessionId: 's2' })
    a.confirm(KEY, FP, 'ctx')
    b.confirm(KEY, FP, 'ctx')
    const c = new RiskLearning(file, { threshold: 2, sessionId: 's3' })
    expect(c.count(KEY)).toBe(2)
    expect(c.shouldAutoAllow(KEY, FP)).toBe(true)
  })

  it('writes the historical bare key so the file stays byte-compatible', () => {
    const file = store()
    new RiskLearning(file, { threshold: 1 }).confirm(KEY, FP, 'ctx')
    const doc = JSON.parse(readFileSync(file, 'utf8')) as { confirmed: Record<string, number> }
    expect(Object.keys(doc.confirmed)).toEqual([KEY])
  })
})

describe('session scope isolates', () => {
  it('does not let session A reach the threshold for session B', () => {
    const file = store()
    const a = new RiskLearning(file, { threshold: 2, scope: 'session', sessionId: 's1' })
    a.confirm(KEY, FP, 'ctx')
    a.confirm(KEY, FP, 'ctx')
    expect(a.shouldAutoAllow(KEY, FP)).toBe(true)
    const b = new RiskLearning(file, { threshold: 2, scope: 'session', sessionId: 's2' })
    expect(b.count(KEY)).toBe(0)
    expect(b.shouldAutoAllow(KEY, FP)).toBe(false)
  })

  it('stops a pre-existing global rule from auto-allowing', () => {
    const file = store()
    // Seeded by the old (global) behaviour.
    const legacy = new RiskLearning(file, { threshold: 1 })
    legacy.confirm(KEY, FP, 'ctx')
    const scoped = new RiskLearning(file, { threshold: 1, scope: 'session', sessionId: 's9' })
    expect(scoped.shouldAutoAllow(KEY, FP)).toBe(false)
  })

  it('reports the blocked global rule as a pending promotion instead of hiding it', () => {
    const file = store()
    new RiskLearning(file, { threshold: 1 }).confirm(KEY, FP, 'ctx')
    const scoped = new RiskLearning(file, { threshold: 1, scope: 'session', sessionId: 's9' })
    const global = scoped.sedimented().find((e) => e.scope === 'global')
    expect(global?.promoted).toBe(false)
  })
})

describe('explicit promotion', () => {
  it('moves one session rule into the global namespace on request', () => {
    const file = store()
    const a = new RiskLearning(file, { threshold: 1, scope: 'session', sessionId: 's1' })
    a.confirm(KEY, FP, 'ctx')
    const stored = sessionKey('s1', KEY)
    a.promoteToGlobal(stored, FP)
    const global = new RiskLearning(file, { threshold: 1, scope: 'global', sessionId: 's2' })
    expect(global.shouldAutoAllow(KEY, FP)).toBe(true)
  })

  it('does nothing for an unknown sample', () => {
    const file = store()
    const a = new RiskLearning(file, { threshold: 1, scope: 'session', sessionId: 's1' })
    a.promoteToGlobal(sessionKey('s1', KEY), 'nope')
    expect(a.snapshot().confirmed).toEqual({})
  })
})

describe('legacy files', () => {
  it('reads a pre-namespace document in both scopes', () => {
    const file = store()
    const legacy = new RiskLearning(file, { threshold: 1 })
    legacy.confirm(KEY, FP, 'ctx')
    const globalReader = new RiskLearning(file, { threshold: 1 })
    expect(globalReader.shouldAutoAllow(KEY, FP)).toBe(true)
    // ...and the scoped reader still SEES the row (as not-in-force), so the
    // explicit promotion is offered rather than the rule silently vanishing.
    const scopedReader = new RiskLearning(file, { threshold: 1, scope: 'session', sessionId: 's1' })
    expect(scopedReader.sedimented()).toHaveLength(1)
  })
})
