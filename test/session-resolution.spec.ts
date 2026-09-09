import { describe, expect, it } from 'vitest'
import { resolveSessionId } from '../src/client/feed.js'

describe('resolveSessionId', () => {
  it('reads the top-level standard props a conversation view receives', () => {
    expect(resolveSessionId({ sessionId: 's1' })).toBe('s1')
  })

  it('falls back to nested slotsProps', () => {
    expect(resolveSessionId({ slotsProps: { sessionId: 's2' } })).toBe('s2')
  })

  it('falls back to the useSessions hook on either level', () => {
    const hook = (selector: (state: { current?: unknown }) => unknown): unknown => selector({ current: 's3' })
    expect(resolveSessionId({ useSessions: hook })).toBe('s3')
    expect(resolveSessionId({ slotsProps: { useSessions: hook } })).toBe('s3')
  })

  it('returns null when nothing carries a session id', () => {
    expect(resolveSessionId(undefined)).toBeNull()
    expect(resolveSessionId({ sessionId: '' })).toBeNull()
    expect(resolveSessionId({ useSessions: () => undefined })).toBeNull()
    expect(resolveSessionId({ slotsProps: {} })).toBeNull()
  })

  it('survives a throwing hook', () => {
    const hook = (): unknown => { throw new Error('no store') }
    expect(resolveSessionId({ useSessions: hook })).toBeNull()
  })
})
