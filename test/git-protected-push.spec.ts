/**
 * P0 远端历史改写拦截 —— `git push` 对**保护分支**的强制覆盖 / 删除。
 *
 * 这一组用例守着三件事：
 *   1. parser 能认出 `push --delete`（此前 `hasDelete` 在 push 分支从未被读取）；
 *   2. 保护分支判据不再因 `/` 误伤（`backup/main`、`feat/release`）；
 *   3. P0 的 shell 检查覆盖**全部** shell 工具名（此前漏了 `shell` 本身）。
 *
 * 最后一条不是"顺手补的"：`shell` 是 DSH 的主 shell 工具，漏掉它等于整条 P0
 * shell 检查对日常调用失效。
 */
import { describe, it, expect } from 'vitest'
import { dispatchCommand } from '../src/command-dispatcher'
import { hardDenyReason } from '../src/engine'
import { SHELL_TOOLS } from '../src/evaluate'
import type { ToolCallContext } from '../src/evaluate'

const shellCtx = (tool: string, command: string): ToolCallContext => ({
  tool,
  args: { command },
  cwd: 'E:/test/rewrite-agently',
  dshHome: 'C:/Users/joshua/.dsh',
})

const op = (cmd: string) => dispatchCommand(cmd)!.semantics

describe('Git parser — push 变体识别', () => {
  it('`--delete` / `-d` 产生 `push-delete`，不再落进普通 push', () => {
    // 回归：这两个输入此前都得到 op='push' / dest=4，
    // DESTRUCTIVENESS_MAP 里的 'push-delete': 5 是永远取不到的死条目。
    for (const c of ['git push --delete origin main', 'git push -d origin main']) {
      const s = op(c)
      expect(s.operation, c).toBe('push-delete')
      expect(s.targetsSharedBranch, c).toBe(true)
      expect(s.destructiveness, c).toBe(5)
    }
  })

  it('删非保护分支仍是 push-delete，但破坏度降档', () => {
    const s = op('git push --delete origin feat/x')
    expect(s.operation).toBe('push-delete')
    expect(s.targetsSharedBranch).toBe(false)
    expect(s.destructiveness).toBe(4)
  })

  it('force 系列仍识别为 force-push', () => {
    for (const c of [
      'git push --force origin main',
      'git push -f origin main',
      'git push --force-with-lease origin main',
    ]) {
      expect(op(c).operation, c).toBe('force-push')
    }
  })
})

describe('Git parser — 保护分支判据', () => {
  it('只剥已知 ref 前缀，不对任意 `/` 取末段', () => {
    // 回归：早先 `branch.split('/').pop()` 会把这两个误判成保护分支。
    // 误判方向**不是**更安全——这条判据喂给不可撤销的 P0，
    // 漏判还有关键词/规则/LLM 层兜底，误判是合法工作流被永久挡住。
    for (const b of ['backup/main', 'feat/release', 'origin-notes/master']) {
      expect(op(`git push origin ${b}`).targetsSharedBranch, b).toBe(false)
    }
  })

  it('ref 前缀形式仍正确识别', () => {
    // `refs/heads/main` 确实就是 main；refspec 形式由 extractBranch 解出分支名
    expect(op('git push origin refs/heads/main').targetsSharedBranch).toBe(true)
    expect(op('git push origin HEAD:main').targetsSharedBranch).toBe(true)
    expect(op('git push origin refs/heads/main').branch).toBe('refs/heads/main')
  })

  it('裸分支名的五个保护名都命中', () => {
    for (const b of ['main', 'master', 'production', 'release', 'stable']) {
      expect(op(`git push origin ${b}`).targetsSharedBranch, b).toBe(true)
    }
  })
})

describe('P0 — shell 工具名必须全覆盖', () => {
  it('SHELL_TOOLS 的每一个名字都拦得住受保护路径重定向', () => {
    // 回归：engine.ts 曾自带 `/(?:bash|pwsh|sh|cmd)$/`，漏掉 shell/terminal/powershell。
    // 实测同一句 `echo x > /etc/passwd`：bash 被拦，shell 放行。
    const command = 'echo x > /etc/passwd'
    expect(SHELL_TOOLS.size).toBeGreaterThanOrEqual(7)
    for (const tool of SHELL_TOOLS) {
      const reason = hardDenyReason(shellCtx(tool, command))
      expect(reason, `工具 ${tool} 未拦截`).toBeDefined()
    }
  })

  it('名单来自 SHELL_TOOLS 单一事实源（engine 不再自带副本）', () => {
    for (const tool of ['shell', 'terminal', 'powershell']) {
      expect(SHELL_TOOLS.has(tool), tool).toBe(true)
      expect(hardDenyReason(shellCtx(tool, 'echo x > /etc/passwd')), tool).toBeDefined()
    }
  })
})

describe('P0 — git push 远端历史改写', () => {
  it('强制覆盖 / 删除保护分支被硬拒', () => {
    const denied: Array<[string, RegExp]> = [
      ['git push --force origin main', /force-overwrite protected branch: main/],
      ['git push -f origin master', /force-overwrite protected branch: master/],
      ['git push --force-with-lease origin main', /force-overwrite protected branch: main/],
      ['git push --delete origin main', /delete protected branch: main/],
      ['git push -d origin master', /delete protected branch: master/],
    ]
    for (const [cmd, pattern] of denied) {
      const reason = hardDenyReason(shellCtx('shell', cmd))
      expect(reason, cmd).toBeDefined()
      expect(reason!, cmd).toMatch(pattern)
    }
  })

  it('复合命令里的 push 同样被拦（逐段解析，不是只看首段）', () => {
    const reason = hardDenyReason(shellCtx('shell', 'git status && git push --force origin main'))
    expect(reason).toBeDefined()
    expect(reason!).toMatch(/force-overwrite protected branch: main/)
  })

  it('**刻意放行**的四种情况（P0 不可撤销，得给工作流留口子）', () => {
    const allowed = [
      'git push --force origin feat/x',      // 非保护分支：留给关键词/规则/LLM 层
      'git push --force origin backup/main', // 含斜杠的普通分支名
      'git push origin main',                // 普通 push 不是历史改写
      'git push --force',                    // 没写分支名 → 解析不出目标就不做断言
    ]
    for (const cmd of allowed) {
      expect(hardDenyReason(shellCtx('shell', cmd)), cmd).toBeUndefined()
    }
  })

  it('非 git 命令不受影响（只升不降：没命中就不表态）', () => {
    for (const cmd of ['git status', 'rm -rf /tmp/x', 'echo hello']) {
      expect(hardDenyReason(shellCtx('shell', cmd)), cmd).toBeUndefined()
    }
  })

  it('只升不降：非 shell 工具不会被这条规则波及', () => {
    // 规则只挂在 SHELL_TOOLS 分支内；read/write 等工具的 command 参数不该触发它
    const ctx: ToolCallContext = {
      tool: 'read',
      args: { command: 'git push --force origin main', file_path: 'E:/test/rewrite-agently/x.md' },
      cwd: 'E:/test/rewrite-agently',
      dshHome: 'C:/Users/joshua/.dsh',
    }
    expect(hardDenyReason(ctx)).toBeUndefined()
  })
})
