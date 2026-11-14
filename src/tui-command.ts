/**
 * tui-command.ts — `/gate`：权限门（perm-gate）的 dsh-tui 终端面。
 *
 * 背景：dsh-tui 不加载 client 半边（history 卡片 / 规则页不执行），工具审批只显示
 * `toolName` 一行。于是「这条命令为什么被拦 / 规则文件长什么样」在终端里无从查证。
 * 命令面只读 + 干跑：
 *   status = 规则文件路径/默认动作
 *   rules  = allow/deny/ask 计数
 *   why    = 对一条命令跑 dry-run，输出判定链（不执行命令）
 *
 * 契约（.agents/plans/dsh-tui-faces/spec.md §3）：单行 <=100、总行 <=40、无 ANSI、--json 单行。
 */

import type { Context } from '@deepseek-ai/cordis'

export type CommandKind = 'success' | 'error'
export interface CommandResult { kind: CommandKind; text: string }

export interface GateRulesView {
  path: string
  exists: boolean
  bytes: number
  lines: number
  truncated: boolean
  defaultAction?: string
  counts: { allow: number; deny: number; ask: number }
}

export interface GateVerdict {
  decision?: string
  reason?: string
  layers?: Array<{ name?: string; decision?: string; reason?: string }>
  [key: string]: unknown
}

export interface GateCommandDeps {
  rules(): GateRulesView
  evaluate(command: string): GateVerdict
  /** 最近的审计环条目（只读；宿主把审批/判定写进 MemoryAuditMirror）。 */
  history(limit: number): Array<{ at?: number; tool?: string; decision?: string; reason?: string }>
  /** 会话级授权清单（只读）。 */
  grants(): Array<{ tool: string; expiresAt: number; remaining: number }>
}

const MAX_LINES = 40
const MAX_WIDTH = 100

export function clip(text: string, width = MAX_WIDTH): string {
  const value = String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+$/, '')
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}

export function renderLines(lines: string[], limit = MAX_LINES): string {
  const clipped = lines.map((line) => clip(line))
  if (clipped.length <= limit) return clipped.join('\n')
  const kept = clipped.slice(0, limit - 1)
  return [...kept, `… 还有 ${clipped.length - kept.length} 行，加 --all 查看`].join('\n')
}

const ok = (lines: string[]): CommandResult => ({ kind: 'success', text: renderLines(lines) })
const fail = (reason: string, next?: string): CommandResult =>
  ({ kind: 'error', text: renderLines([reason, ...(next ? [`  ${next}`] : [])]) })

function parse(rawInput: string): { argv: string[]; json: boolean; limit: number } {
  const argv: string[] = []
  let json = false
  let limit = 10
  for (const token of String(rawInput ?? '').trim().split(/\s+/).filter(Boolean)) {
    if (token === '--json') json = true
    else if (/^--n=\d+$/.test(token)) limit = Math.min(40, Math.max(1, Number(token.slice(4))))
    else if (!token.startsWith('--')) argv.push(token)
  }
  return { argv, json, limit }
}

const HELP = [
  'gate — 权限门的只读终端面（判定链 / 规则计数 / 审计环）',
  '  /gate                规则文件路径与默认动作',
  '  /gate rules          allow / deny / ask 计数',
  '  /gate why <command>  对一条命令干跑判定链（不执行）',
  '  /gate history        最近 10 条判定/审批（--n=20）',
  '  /gate grants         当前会话级授权（工具/到期/剩余次数）',
  '  flags                --json 单行 JSON',
]

/** 纯函数入口。 */
export function runGateCommand(rawInput: string, deps: GateCommandDeps): CommandResult {
  const { argv, json, limit } = parse(rawInput)
  const sub = (argv[0] ?? 'status').toLowerCase()

  const wrap = (result: CommandResult, data: unknown): CommandResult => {
    if (!json) return result
    const body = result.kind === 'error'
      ? { ok: false, cmd: 'gate', error: { message: result.text.split('\n')[0] ?? result.text } }
      : { ok: true, cmd: 'gate', data }
    return { kind: result.kind, text: JSON.stringify(body) }
  }

  if (sub === 'help' || sub === '?') return wrap(ok(HELP), { help: true })

  if (sub === 'status' || sub === 'rules') {
    const view = deps.rules()
    const lines = sub === 'status'
      ? [
          `gate — 规则文件 ${view.exists ? '已加载' : '缺失'}  默认动作 ${view.defaultAction ?? '—'}`,
          `  path       ${view.path || '(未配置)'}`,
          `  bytes      ${view.bytes}  lines ${view.lines}${view.truncated ? '  (truncated)' : ''}`,
          `  counts     allow ${view.counts.allow}  deny ${view.counts.deny}  ask ${view.counts.ask}`,
          '  use        /gate why <command>   或   /gate rules',
        ]
      : [
          `gate rules — allow ${view.counts.allow}  deny ${view.counts.deny}  ask ${view.counts.ask}`,
          `  path       ${view.path || '(未配置)'}`,
          `  default    ${view.defaultAction ?? '—'}`,
        ]
    return wrap(ok(lines), view)
  }

  if (sub === 'why') {
    const command = argv.slice(1).join(' ').trim()
    if (command === '') return wrap(fail('gate why: 缺少命令', 'next: /gate why "<command>"'), {})
    const verdict = deps.evaluate(command)
    const decision = String(verdict.decision ?? verdict.reason ?? 'unknown')
    const lines = [`gate why — ${decision}`]
    if (verdict.reason) lines.push(`  reason     ${clip(String(verdict.reason), 80)}`)
    for (const layer of (verdict.layers ?? []).slice(0, 8)) {
      lines.push(`  ${clip(String(layer.name ?? 'layer'), 14).padEnd(14)}  ${clip(String(layer.decision ?? '—'), 12)}  ${clip(String(layer.reason ?? ''), 50)}`)
    }
    if ((verdict.layers ?? []).length === 0) lines.push('  layers     （干跑未返回分层，只给最终判定）')
    lines.push(`  cmd        ${clip(command, 80)}`)
    return wrap(ok(lines), verdict)
  }

  if (sub === 'history') {
    const rows = deps.history(limit)
    if (rows.length === 0) return wrap(ok(['gate history — 审计环为空（本会话还没有判定记录）']), { rows: 0 })
    const lines = [`gate history — 最近 ${rows.length} 条`]
    for (const row of rows) {
      const stamp = typeof row.at === 'number' ? new Date(row.at).toISOString().replace('T', ' ').slice(0, 16) : '—'
      lines.push(`  ${stamp}  ${clip(row.decision ?? '—', 10).padEnd(10)}  ${clip(row.tool ?? '', 18).padEnd(18)}  ${clip(row.reason ?? '', 30)}`)
    }
    return wrap(ok(lines), { rows })
  }

  if (sub === 'grants') {
    const rows = deps.grants()
    if (rows.length === 0) return wrap(ok(['gate grants — 当前没有会话级授权']), { rows: 0 })
    const lines = [`gate grants — ${rows.length} 条活跃授权`]
    for (const row of rows.slice(0, limit)) {
      const stamp = new Date(row.expiresAt).toISOString().replace('T', ' ').slice(0, 16)
      lines.push(`  ${clip(row.tool, 24).padEnd(24)}  until ${stamp}  left ${row.remaining}`)
    }
    if (rows.length > limit) lines.push(`  … 还有 ${rows.length - limit} 条，加 --n=40`)
    return wrap(ok(lines), { rows })
  }

  return wrap(fail(`gate: 未知子命令 "${sub}"`, 'next: /gate help'), {})
}

/** 注册 `/gate`：无 commands 服务时静默跳过（老线安全）。 */
export function registerGateCommand(ctx: Context, deps: GateCommandDeps): void {
  const registry = (ctx as unknown as { commands?: { register(definition: unknown): unknown } }).commands
  if (!registry || typeof registry.register !== 'function') return
  registry.register({
    definitionId: 'dsh-perm-gate',
    name: 'gate',
    description: 'Permission gate console: rules counts / dry-run why <command> (never executes)',
    input: { hint: '[status|rules|why <command>|history|grants] [--n=20] [--json]' },
    handler: (invocation: { rawInput?: string }) => runGateCommand(invocation?.rawInput ?? '', deps),
  })
}
