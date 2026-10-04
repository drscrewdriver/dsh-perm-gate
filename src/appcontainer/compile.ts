/**
 * compile.ts —— launcher.exe 的按需编译（csc.exe，.NET Framework 自带）。
 *
 * 产物按 launcher.cs 的 sha256 缓存在 `os.tmpdir()/dsh-perm-gate-ac/`——
 * 源码不变则编译一次终身复用；换版本自动重编。C# 源码随包发布
 * （`assets/appcontainer-launcher.cs`），插件本体零原生依赖。
 *
 * csc 定位：`%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`（Win10/
 * 11/24H2 全系自带 .NET Framework 4.x），缺失时回退 Framework（32 位）。
 * 找不到 csc → 返回 undefined，上层按 fail-closed 处理（沙盒开启时该调用
 * 硬拒绝，绝不回退到容器外执行）。
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** The shipped C# launcher source (read-only asset). */
export const LAUNCHER_SOURCE = fileURLToPath(new URL('../../assets/appcontainer-launcher.cs', import.meta.url))

/** Compile-cache root (also swept by the controller's housekeeping). */
export const CACHE_DIR = path.join(os.tmpdir(), 'dsh-perm-gate-ac')

function cscCandidates(): string[] {
  const windir = process.env['WINDIR'] ?? 'C:\\Windows'
  return [
    path.join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    path.join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe'),
  ]
}

/** Locate the .NET Framework C# compiler, or undefined when absent. */
export function locateCsc(): string | undefined {
  for (const candidate of cscCandidates()) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

export interface CompiledLauncher {
  readonly exePath: string
  readonly hash: string
  readonly cached: boolean
}

async function run(cwd: string, exe: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(exe, args, { cwd, windowsHide: true, timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error !== undefined && error !== null) {
        reject(new Error(`csc failed: ${String(stderr ?? error.message).slice(-400)}`))
      } else resolve()
    })
  })
}

/**
 * Compile (or reuse) the launcher for the current source hash. Returns the exe
 * path; undefined means the platform cannot provide one (no csc) — callers
 * must treat sandbox mode as unavailable (fail-closed), never run unwrapped.
 */
export async function ensureLauncher(): Promise<CompiledLauncher | undefined> {
  const csc = locateCsc()
  if (csc === undefined) return undefined
  const source = await readFile(LAUNCHER_SOURCE, 'utf8')
  const hash = createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 16)
  const exePath = path.join(CACHE_DIR, `appcontainer-launcher-${hash}.exe`)
  const marker = `${exePath}.ok`
  if (existsSync(exePath) && existsSync(marker)) return { exePath, hash, cached: true }
  await mkdir(CACHE_DIR, { recursive: true })
  await run(CACHE_DIR, csc, [
    '/nologo', '/target:exe', '/optimize+',
    '/r:System.Web.Extensions.dll',
    `/out:${exePath}`,
    LAUNCHER_SOURCE,
  ])
  await writeFile(marker, String(process.pid), 'utf8')
  return { exePath, hash, cached: false }
}
