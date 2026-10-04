/**
 * exempt.ts —— AppContainer 回环豁免（CheckNetIsolation LoopbackExempt）。
 *
 * 背景：AppContainer 进程默认连 127.0.0.1 都不可达（WFP 回环隔离）。豁免以
 * 容器 SID 为键，与本插件的**稳定派生 SID**（sid.ts）配合——全机只需做一次，
 * 之后每个会话直接复用。豁免写入 HKLM 防火墙策略区，非提权进程可能被拒；
 * 被拒不致命（沙盒内进程只是够不到 127.0.0.1 的代理/宿主服务），但要把
 * 手工提权命令原样告诉用户。
 *
 * 幂等：`-s` 子命令列出已豁免 SID，命中即跳过；避免每次会话都打一次
 * CheckNetIsolation（它也不便宜）。
 */
import { execFile } from 'node:child_process'

function checkNetIsolationPath(): string {
  const windir = process.env['WINDIR'] ?? 'C:\\Windows'
  return `${windir}\\System32\\CheckNetIsolation.exe`
}

function run(exe: string, args: readonly string[], timeoutMs = 30_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(exe, args, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      const code = error === undefined || error === null ? 0 : (error as { code?: number }).code ?? 1
      resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
}

export type LoopbackExemptResult =
  | { readonly status: 'exempt' | 'already-exempt' }
  | { readonly status: 'failed'; readonly message: string }
  | { readonly status: 'unsupported'; readonly message: string }

/**
 * Ensure the container SID is on the machine's loopback-exempt list.
 *
 * `elevate` (default false): when true and the non-elevated add is denied, one
 * UAC elevation prompt is offered via PowerShell Start-Process -Verb RunAs.
 */
export async function ensureLoopbackExempt(sid: string, options: { elevate?: boolean } = {}): Promise<LoopbackExemptResult> {
  if (process.platform !== 'win32') {
    return { status: 'unsupported', message: 'loopback exemption is Windows-only (AppContainer)' }
  }
  const exe = checkNetIsolationPath()
  const list = await run(exe, ['LoopbackExempt', '-s'])
  if (list.code !== 0 && list.stdout === '' && list.stderr !== '') {
    return { status: 'failed', message: `CheckNetIsolation -s failed: ${list.stderr.trim().slice(0, 200)}` }
  }
  if (list.stdout.includes(sid)) return { status: 'already-exempt' }
  const add = await run(exe, ['LoopbackExempt', '-a', `-p=${sid}`])
  if (add.code === 0) return { status: 'exempt' }
  const denied = /denied|administrator|elevation/i.test(`${add.stderr}${add.stdout}`)
  if (denied && options.elevate === true) {
    const elevated = await elevate(exe, sid)
    if (elevated !== undefined) return elevated
  }
  return {
    status: 'failed',
    message:
      `loopback exemption needs elevation (win32 exit ${add.code}). Run once from an elevated prompt:\n`
      + `  ${exe} LoopbackExempt -a -p=${sid}\n`
      + `The SID is stable per machine, so this is a one-time step.`,
  }
}

async function elevate(exe: string, sid: string): Promise<LoopbackExemptResult | undefined> {
  const command = `${exe} LoopbackExempt -a -p=${sid}`
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', `Start-Process -Verb RunAs -Wait -WindowStyle Hidden '${command}'`],
      { windowsHide: true, timeout: 120_000 },
      (error) => {
        if (error === undefined || error === null) {
          resolve({ status: 'exempt' })
        } else {
          resolve(undefined) // caller falls back to the manual-guidance message
        }
      },
    )
  })
}
