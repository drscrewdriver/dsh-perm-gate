/**
 * READ 预询（凭据阶梯读面的引擎刀）：decide() 对 READ 工具先问规则层——
 * ask/deny 表态生效，无命中保持原自动放行（零噪音）；INTERNAL 工具不预询
 * （宿主协调/会话工具读自己的库是工作方式，不是风险面）。
 */
import { describe, expect, it } from 'vitest'
import { decide } from '../src/engine'
import { compileDocument, parsePermissionsDocument } from '../src/rule'
import { decideRules, type ToolCallContext } from '../src/evaluate'

const DOC = parsePermissionsDocument(`defaultAction: allow
ask:
  - tools: [read]
    args: ["*/.env"]
    reason: "[deny-rule:cred.env] env read asks."
deny:
  - tools: [read]
    args: ["*/id_rsa"]
    reason: "[deny-rule:test.rsa-deny] ssh key read denied."
`)
const RULESET = compileDocument(DOC, { maxGlobStars: 2, caseInsensitivePaths: true })
const harness = { decide: (c: ToolCallContext) => decideRules(RULESET, c) }
const grants = () => 'no-match' as const

const read = (file_path: string): ToolCallContext => ({ tool: 'read', args: { file_path }, cwd: '/w', home: '/w' })

// 工作区内的路径：P0 读地板只判「工作区外敏感路径」，区内路径留给规则层预询表态。
describe('decide — READ 预询', () => {
  it('规则 ask 表态把读调用转 ask（stage default，进正常 ask 链）', () => {
    const d = decide(read('/w/config/.env'), harness, grants)
    expect(d.action).toBe('ask')
    expect(d.stage).toBe('default')
    expect(d.reason).toContain('cred.env')
  })

  it('规则 deny 表态把读调用转 deny（stage rule）', () => {
    const d = decide(read('/w/scratch/id_rsa'), harness, grants)
    expect(d.action).toBe('deny')
    expect(d.stage).toBe('rule')
  })

  it('无命中读保持原样自动放行（零噪音不变量）', () => {
    const d = decide(read('/w/src/app.ts'), harness, grants)
    expect(d.action).toBe('allow')
    expect(d.reason).toBe('read-only internal tool')
    expect(d.stage).toBe('grant')
  })

  it('INTERNAL 工具永不被预询（即便规则点名其路径参数）', () => {
    const internalDoc = compileDocument(
      parsePermissionsDocument(`defaultAction: allow
ask:
  - tools: ["agent_teams_*", memory_*]
    args: ["*/.env"]
    reason: "would-hit-internal"
`),
      { maxGlobStars: 2, caseInsensitivePaths: true },
    )
    const h = { decide: (c: ToolCallContext) => decideRules(internalDoc, c) }
    const d = decide({ tool: 'agent_teams_status', args: { file_path: '/w/.env' }, cwd: '/w' }, h, grants)
    expect(d.action).toBe('allow')
  })

  it('autoAllowExtra 名单同样先过规则层', () => {
    const d = decide({ tool: 'read', args: { file_path: '/w/a/.env' }, cwd: '/w' }, harness, grants, new Set(['read']))
    expect(d.action).toBe('ask')
  })
})
