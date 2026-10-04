/**
 * wrap.ts —— 允许调用 → AppContainer 启动器命令行的重写（纯逻辑，可单测）。
 *
 * 关键决策：原命令 **base64 编码**后交给启动器，外层 shell 只见
 * `<launcher> --config <cfg> --exec-b64 <b64>` 一个普通进程调用——管道/
 * `&&`/重定向是外层 shell 语法，若把原命令裸拼在后面，它们会在**容器外**
 * 被解析执行，沙盒即被绕过。base64 字母表（A-Za-z0-9+/=）在 cmd 与 POSIX
 * shell 里都是惰性字符，无需再转义。
 *
 * 配置文件每次调用落盘一份（JSON），启动器读它拿 workspace/temp/代理环境；
 * 与命令行传参相比少一层引就地狱。env 覆盖采用宿主 windows-acl 验证过的
 * 形态：**启动器先改自身环境再 CreateProcess（继承），不传显式 env block**
 * （koffi 实测显式 env 在 CreateProcessAsUserW 上报 ERROR_INVALID_PARAMETER；
 * C# 路径虽然标准，继承形态少一层封送，风险为零）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** One sandboxed-execution plan: everything the launcher needs, on disk. */
export interface SandboxLaunchConfig {
  /** The session workspace the command runs in (cwd + ACL grant root). */
  readonly workspace: string
  /** Per-call scratch dir created by the Node side; the launcher gets it via env. */
  readonly tempDir: string
  /** 'read-only' grants RX on the workspace; 'workspace-write' adds Modify. */
  readonly mode: 'read-only' | 'workspace-write'
  /** Exact env overrides for the child (HTTPS_PROXY etc.). Empty keys delete. */
  readonly proxyEnv: Readonly<Record<string, string>>
}

/** Serialize + persist one launch config, returning the path to hand the launcher. */
export async function writeLaunchConfig(config: SandboxLaunchConfig, configDir: string): Promise<string> {
  await mkdir(configDir, { recursive: true })
  const file = path.join(configDir, `ac-${randomUUID()}.json`)
  await writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8')
  return file
}

/** base64url-free standard base64 of the UTF-8 command text. */
export function encodeCommand(command: string): string {
  return Buffer.from(command, 'utf8').toString('base64')
}

export function decodeCommand(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8')
}

/**
 * The command line the outer shell executes instead of the original one.
 * Single quoted-exe invocation; `=` padding and the alnum base64 body are
 * inert in cmd.exe and POSIX shells alike.
 */
export function buildWrappedCommand(launcherPath: string, configPath: string, command: string): string {
  return `"${launcherPath}" --config "${configPath}" --exec-b64 ${encodeCommand(command)}`
}
