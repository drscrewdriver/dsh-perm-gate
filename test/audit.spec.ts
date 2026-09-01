import { describe, expect, it } from 'vitest'
import { assertInvariant, makeEntry, MemoryAuditMirror, probeHost } from '../src/audit.js'

describe('audit', () => {
  it('makeEntry enforces marker and kind', () => {
    const e = makeEntry({ callId: 'c1', tool: 'bash', outcome: 'deny', source: 'rule', reason: 'x', at: 1 })
    expect(e.kind).toBe('permissionGate/decision')
    expect(e.marker).toBe('ignorable')
  })

  it('invariant pairs model-visible reason to logged event', () => {
    const e = makeEntry({ callId: 'c1', tool: 'bash', outcome: 'deny', source: 'rule', reason: 'x', at: 1 })
    expect(assertInvariant({ callId: 'c1' }, e)).toBe(true)
    expect(assertInvariant({ callId: 'other' }, e)).toBe(false)
  })

  it('MemoryAuditMirror records and counts', () => {
    const m = new MemoryAuditMirror()
    m.append(makeEntry({ callId: 'c1', tool: 'bash', outcome: 'deny', source: 'rule', reason: 'x', at: 1 }))
    m.append(makeEntry({ callId: 'c2', tool: 'write', outcome: 'allow', source: 'rule', reason: 'x', at: 1 }))
    expect(m.count('deny')).toBe(1)
    expect(m.count()).toBe(2)
  })

  it('probeHost detects an unsupported host', () => {
    expect(probeHost(() => ({ markerSupported: false }))).toBe(false)
    expect(probeHost(() => ({ markerSupported: true }))).toBe(true)
    expect(probeHost(() => { throw new Error('boom') })).toBe(false)
  })
})