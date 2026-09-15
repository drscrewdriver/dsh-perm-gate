import { describe, expect, it } from 'vitest'
import { extractAgentCandidates, type ExecutionLike } from '../src/agent-identity.js'

function makeExec(overrides: Partial<ExecutionLike> = {}): ExecutionLike {
  return { ...overrides }
}

describe('extractAgentCandidates', () => {
  it('returns main when no parentAuthorized', () => {
    const candidates = extractAgentCandidates(makeExec())
    expect(candidates).toContain('main')
  })

  it('returns subagent when parentAuthorized is present', () => {
    const candidates = extractAgentCandidates(makeExec({ parentAuthorized: true }))
    expect(candidates).toContain('subagent')
    expect(candidates).not.toContain('main')
  })

  it('returns subagent when parentAuthorized is false', () => {
    const candidates = extractAgentCandidates(makeExec({ parentAuthorized: false }))
    expect(candidates).toContain('subagent')
  })

  it('extracts preset from session events', () => {
    const candidates = extractAgentCandidates(makeExec({
      agent: {
        session: {
          events: [
            { type: 'tier-select', tier: 'permissive' },
          ],
        },
      },
    }))
    expect(candidates).toContain('preset:permissive')
    expect(candidates).toContain('main')
  })

  it('extracts preset from snapshotEvents accessor', () => {
    const candidates = extractAgentCandidates(makeExec({
      agent: {
        session: {
          snapshotEvents: () => [
            { type: 'preset-switch', preset: 'strict' },
          ],
        },
      },
    }))
    expect(candidates).toContain('preset:strict')
  })

  it('returns main for empty session', () => {
    const candidates = extractAgentCandidates(makeExec({
      agent: { session: {} },
    }))
    expect(candidates).toContain('main')
  })
})
