import { describe, expect, it } from 'vitest'
import { decide, hardDenyReason, type GrantResolver } from '../src/engine.js'
import type { ToolCallContext } from '../src/evaluate.js'

function ctx(p: Partial<ToolCallContext>): ToolCallContext {
  return { tool: 'bash', args: {}, cwd: '/work', dshHome: '/home/u/.dsh', ...p }
}
function neverGrant(): GrantResolver {
  return () => 'no-match'
}

describe('hardDenyReason (P0)', () => {
  it('denies credential material (Bearer or token) in outgoing calls', () => {
    expect(hardDenyReason(ctx({ tool: 'web_fetch', args: { url: 'https://x.com', authorization: 'Bearer abc12345' } })))
      .toContain('credential')
    expect(hardDenyReason(ctx({ tool: 'web_fetch', args: { url: 'https://x.com?token=sk-abc12345xxxxx' } })))
      .toContain('credential')
  })

  it('denies shell redirect to a protected path', () => {
    expect(hardDenyReason(ctx({ args: { command: 'cat a > /etc/passwd' } }))).toContain('protected path')
  })

  it('denies mutation of a protected root', () => {
    expect(hardDenyReason(ctx({ tool: 'write', args: { file_path: '/home/u/.dsh/creds' } }))).toContain('protected path')
  })

  it('allows benign calls', () => {
    expect(hardDenyReason(ctx({ args: { command: 'pnpm test' } }))).toBeUndefined()
  })
})

describe('decide (P0->P2->P4)', () => {
  it('hard-deny wins over a grant', () => {
    const d = decide(
      ctx({ args: { command: 'cat a > /etc/passwd' } }),
      { decide: () => ({ action: 'allow', reason: 'x', ruleIndex: undefined as number | undefined }) },
      () => 'allow',
    )
    expect(d.action).toBe('deny')
    expect(d.stage).toBe('hard-deny')
  })

  it('grant resolves to allow (P1)', () => {
    const d = decide(ctx({ args: {} }), { decide: () => ({ action: 'ask', reason: 'r', ruleIndex: undefined as number | undefined }) }, () => 'allow')
    expect(d.action).toBe('allow')
    expect(d.stage).toBe('grant')
  })

  it('rule decision passes through (P2)', () => {
    const d = decide(ctx({ args: {} }), { decide: () => ({ action: 'deny', reason: 'rule', ruleIndex: 0 as number | undefined }) }, neverGrant())
    expect(d.action).toBe('deny')
    expect(d.stage).toBe('rule')
  })

  it('default ask (P4) when rules say ask', () => {
    const d = decide(ctx({ args: {} }), { decide: () => ({ action: 'ask', reason: 'ask', ruleIndex: undefined as number | undefined }) }, neverGrant())
    expect(d.action).toBe('ask')
  })
})