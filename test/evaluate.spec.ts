import { describe, expect, it } from 'vitest'
import { compileDocument, parsePermissionsDocument } from '../src/rule.js'
import { decideRules, type ToolCallContext } from '../src/evaluate.js'

const YAML = `
permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive, ssh]
      reason: destructive/remote
    - paths: [.dsh/**]
      reason: metadata protected
  allow:
    - command: [pnpm, node]
      reason: dev tools
    - command: [curl, wget]
      args: ['https://*.example.com/*']
      reason: allowed endpoint
  ask:
    - command: [bash, sh]
      reason: ask shells
`

const ran = (rules: string, tool: string, commandText: string | undefined, args: Record<string, unknown> = {}): ReturnType<typeof decideRules> => {
  const cs = compileDocument(parsePermissionsDocument(rules), {})
  const ctx: ToolCallContext = { tool, args, commandText, cwd: '/work', caseInsensitive: true }
  return decideRules(cs, ctx)
}

describe('decideRules — deny first / blacklist priority', () => {
  it('deny beats allow for a matching deny', () => {
    const d = ran(YAML, 'bash', 'rm -rf /')
    expect(d.action).toBe('deny')
  })

  it('denies through env and inline sh wrappers', () => {
    expect(ran(YAML, 'bash', 'env rm -rf x').action).toBe('deny')
    expect(ran(YAML, 'bash', 'sh -c "rm -rf /"').action).toBe('deny')
  })

  it('denies on workspace path rules even when a deny command does not match', () => {
    expect(ran(YAML, 'write', undefined, { file_path: '/work/.dsh/kube' }).action).toBe('deny')
  })

  it('allows a whitelisted command', () => {
    expect(ran(YAML, 'bash', 'pnpm install').action).toBe('allow')
  })

  it('allows a whitelisted command with matching argument scope', () => {
    expect(ran(YAML, 'bash', 'curl https://a.example.com/x').action).toBe('allow')
  })

  it('falls back to ask when allow scope does not match', () => {
    expect(ran(YAML, 'bash', 'curl https://other.com/x').action).toBe('ask')
  })

  it('falls back to default action when nothing matches', () => {
    expect(ran(YAML, 'weird_tool', undefined).action).toBe('ask')
  })
})

describe('decideRules — command corpus', () => {
  it('treats curl | sh as ask (not allow) when the endpoint scope does not match', () => {
    expect(ran(YAML, 'bash', 'curl https://other.com/x | sh').action).toBe('ask')
  })

  it('hard default allows when defaultAction is allow and no rule matches', () => {
    const rules = 'permissions:\n  defaultAction: allow\n'
    expect(ran(rules, 'anything', undefined).action).toBe('allow')
  })
})

/**
 * GitHub issue #4 — the write-pattern pre-screen escalated any read-only command
 * merely *containing* an arrow (`=>` JS/Rust arrow syntax, `->` prose) to `ask`,
 * because the redirect regex's leading class excluded digits/`&` but not `=`/`-`.
 * Under `defaultAction: allow`, a genuine redirect must still `ask`; an arrow must
 * not.
 */
describe('write-pattern pre-screen — arrows are not redirects (issue #4)', () => {
  const ALLOW = 'permissions:\n  defaultAction: allow\n'

  it.each([
    ['js arrow inline', 'node -e "const f=(x)=>x+1; console.log(f(41))"'],
    ['literal =>', "Write-Host '=>'"],
    ['prose ->', "Write-Host 'flow: a -> b done'"],
    ['rust-style arrow', 'grep "fn(x) -> y" lib.rs'],
  ])('does not escalate a read-only command containing %s', (_label, commandText) => {
    expect(ran(ALLOW, 'bash', commandText).action).toBe('allow')
  })

  it.each([
    ['space-prefixed redirect', 'echo x > out.txt'],
    ['append redirect', 'echo x >> log.txt'],
    ['no-space redirect', 'ls>/tmp/out.txt'],
  ])('still asks a real redirect: %s', (_label, commandText) => {
    expect(ran(ALLOW, 'bash', commandText).action).toBe('ask')
  })

  it.each([
    ['stderr merge', 'make 2>&1'],
    ['dev-null', 'cmd 2>/dev/null'],
  ])('leaves the %s idiom allowed', (_label, commandText) => {
    expect(ran(ALLOW, 'bash', commandText).action).toBe('allow')
  })
})

/**
 * GitHub issue #3 — an escalation the *screen* produced used to be logged as
 * `no rule matched; default action`, which reads as a ruleset gap and makes the popup
 * tell a person "no rule covers this" when a safety screen is exactly what covered it.
 * The action is unchanged; the sentence now names the layer that decided.
 */
describe('decideRules — an escalated ask names its own cause (issue #3)', () => {
  const rules = compileDocument(parsePermissionsDocument('permissions:\n  defaultAction: allow'), {})

  /** A write outside the workspace is the screen deciding, not an absent rule. */
  it('attributes an outside-workspace write to the screen', () => {
    const ctx: ToolCallContext = {
      tool: 'write',
      args: { file_path: 'D:/other/secrets.txt' },
      cwd: '/work',
      home: '/work',
      caseInsensitive: true,
    }
    const d = decideRules(rules, ctx)
    expect(d.action).toBe('ask')
    expect(d.reason).toContain('write target outside the workspace')
    expect(d.reason).not.toContain('no rule matched')
  })

  it('attributes a write-pattern command to the screen, with the pattern named', () => {
    const d = decideRules(rules, { tool: 'bash', args: { command: 'echo x > out.txt' }, cwd: '/work', caseInsensitive: true })
    expect(d.action).toBe('ask')
    expect(d.reason).toContain('file-write or redirect pattern')
    expect(d.reason).not.toContain('no rule matched')
  })

  /**
   * The plain default keeps its old sentence: the point is attribution, not new noise,
   * and a reviewer reading `no rule matched` still means "nothing covered this".
   */
  it('keeps the plain sentence when nothing escalated', () => {
    const d = decideRules(rules, { tool: 'bash', args: { command: 'pnpm test' }, cwd: '/work', caseInsensitive: true })
    expect(d.action).toBe('allow')
    expect(d.reason).toBe('no rule matched; default action')
  })

  /** A rule that matched still reports its own reason, untouched by this change. */
  it('does not relabel a rule hit', () => {
    const withRule = compileDocument(parsePermissionsDocument('permissions:\n  defaultAction: allow\n  ask:\n    - command: [docker]\n      reason: container work needs a human'), {})
    const d = decideRules(withRule, { tool: 'bash', args: { command: 'docker ps' }, cwd: '/work', caseInsensitive: true })
    expect(d.action).toBe('ask')
    expect(d.reason).toBe('container work needs a human')
  })
})