/**
 * credWriteExempt —— 凭据阶梯 readwrite 档的引擎刀：豁免**只**落在
 * credential-store 写判据一条上。族外路径、读地板、受保护破坏目标、
 * 自定义 credentialPaths（无族归属）在任何豁免清单下都照常硬拦——
 * 这就是 readwrite 不等于「随便写」的实现级定义。
 */
import { describe, expect, it } from 'vitest'
import { hardDenyReason } from '../src/engine'
import { familyOfPath } from '../src/cred-families'
import type { ToolCallContext } from '../src/evaluate'

const HOME = 'C:/Users/joshua'
const write = (file_path: string, credWriteExempt?: string[]): ToolCallContext => ({
  tool: 'write', args: { file_path }, cwd: 'E:/w', home: 'E:/w', userHome: HOME, credWriteExempt,
})

describe('familyOfPath — 族归属解析', () => {
  it.each([
    [`${HOME}/.ssh/id_ed25519`, 'ssh'],
    [`${HOME}/.aws/credentials`, 'cloud'],
    [`${HOME}/.npmrc`, 'package'],
    [`${HOME}/.git-credentials`, 'gitcreds'],
    ['E:/w/.env', 'env'],
    ['E:/w/config/.env.production', 'env'],
    [`${HOME}/.config/gh/hosts.yml`, 'cli'],
    [`${HOME}/.pgpass`, 'db'],
  ])('%s → %s', (path, family) => {
    expect(familyOfPath(path)).toBe(family)
  })

  it('普通源码与无凭据语义的路径没有族', () => {
    for (const p of ['E:/w/src/app.ts', `${HOME}/Documents/notes.md`, 'E:/w/ambient.txt']) {
      expect(familyOfPath(p)).toBeUndefined()
    }
  })
})

describe('hardDenyReason — credential-store 写判据的族豁免', () => {
  it('默认（无豁免清单）：内置凭据 store 写入硬拦', () => {
    expect(hardDenyReason(write(`${HOME}/.npmrc`))).toContain('credential store')
    expect(hardDenyReason(write(`${HOME}/.ssh/authorized_keys`))).toContain('credential store')
    // 既有排除：.env 是项目本地 dev 配置，不在内置 store 名单——
    // 它的 readwrite 豁免只体现在读面（cred.env 条目），写面本就放行。
    expect(hardDenyReason(write('E:/w/.env'))).toBeUndefined()
  })

  it('readwrite 族豁免生效：清单内族的 store 写入放行', () => {
    expect(hardDenyReason(write(`${HOME}/.npmrc`, ['package']))).toBeUndefined()
  })

  it('豁免按族精确：解 package 不解 ssh，解 env 不解 gitCreds', () => {
    expect(hardDenyReason(write(`${HOME}/.ssh/authorized_keys`, ['package']))).toContain('credential store')
    expect(hardDenyReason(write(`${HOME}/.git-credentials`, ['env']))).toContain('credential store')
  })

  it('自定义 credentialPaths 条目无族 ⇒ 永不被清单豁免', () => {
    const ctx: ToolCallContext = {
      ...write('/opt/myco/vault.token', ['env']),
      credentialPaths: ['/opt/myco/vault.token'],
    }
    expect(hardDenyReason(ctx)).toContain('credential store')
  })

  it('豁免不扩散：受保护破坏目标在 readwrite 下仍拦', () => {
    // 破坏性工具改写系统账户文件走的是 protected-destructive 判据（非 store 判据），清单对它无效
    const delCtx: ToolCallContext = {
      tool: 'delete_file', args: { file_path: '/etc/passwd' }, cwd: 'E:/w', home: 'E:/w',
      userHome: HOME, credWriteExempt: ['env', 'ssh', 'cloud', 'package', 'gitcreds', 'cli', 'db'],
    }
    expect(hardDenyReason(delCtx)).toBeDefined()
    const shellCtx: ToolCallContext = {
      tool: 'shell', args: { command: 'echo x > /etc/passwd' }, commandText: 'echo x > /etc/passwd',
      cwd: 'E:/w', home: 'E:/w', userHome: HOME, credWriteExempt: ['env', 'ssh', 'cloud', 'package', 'gitcreds', 'cli', 'db'],
    }
    expect(hardDenyReason(shellCtx)).toContain('protected path')
  })

  it('读地板不分档：工作区外敏感路径读取在任何豁免清单下仍 deny', () => {
    const readCtx: ToolCallContext = {
      tool: 'read', args: { file_path: `${HOME}/.ssh/id_rsa` }, cwd: 'E:/w', home: 'E:/w',
      userHome: HOME, credWriteExempt: ['ssh'],
    }
    // 命中哪条读判据（凭据材料/敏感路径）不重要：任何读地板都不因写豁免清单而让位。
    expect(hardDenyReason(readCtx)).toBeDefined()
  })
})
