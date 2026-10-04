/**
 * appcontainer/index.ts —— 沙盒控制器：把门控放行的 shell 调用重写进
 * Windows AppContainer（目标 2 的编排层）。
 *
 * 出网模型（设计定案，见 README「AppContainer 沙盒」一节）：
 *   - LowBox token **零能力** → 非回环出网被 WFP 物理封死（不是环境变量那种
 *     可绕过的软约束）；
 *   - 稳定派生容器 SID（sid.ts）→ 回环豁免做一次终身有效（exempt.ts）；
 *   - 代理来自配置参数 `sandboxProxy`：空 = 跟随本插件的内置过滤代理
 *     （NetworkLifecycle 实际绑定的 127.0.0.1:<port>）；显式 URL 逐字注入
 *     （必须是回环地址——容器只可达回环）。出网对象过滤由代理完成，
 *     代理的裁决面就是 P2 规则链的 network 维度。
 *
 * fail-closed：沙盒开启但启动器不可用 / 命令文本缺失 → 返回 deny 而不是
 * 放行裸执行——这是权限闸门，不是便利贴。
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { SHELL_TOOLS } from '../evaluate.js'
import { PROXY_ENV_NAMES } from '../proxy.js'
import { ensureLauncher, type CompiledLauncher } from './compile.js'
import { ensureLoopbackExempt } from './exempt.js'
import { buildWrappedCommand, writeLaunchConfig } from './wrap.js'

/** Sandbox-relevant settings, resolved from the volatile config each read. */
export interface SandboxSettings {
  readonly enabled: boolean
  readonly mode: 'read-only' | 'workspace-write'
  /** '' = follow the builtin filtered proxy; otherwise an explicit loopback URL. */
  readonly proxy: string
  readonly loopback: 'exempt' | 'off'
}

/** What the gate should do with an allowed shell call. */
export type SandboxRewriteResult =
  | { readonly kind: 'wrap'; readonly command: string }
  | { readonly kind: 'deny'; readonly reason: string }

/** The call face the controller needs (subset of ToolExecutionLike). */
export interface SandboxCall {
  readonly name: string
  readonly arguments: Record<string, unknown>
  readonly cwd?: string
}

export interface SandboxControllerDeps {
  /** Default workspace when the call carries no cwd (the host process cwd). */
  readonly cwdRoot: () => string
  /** The builtin filtered proxy's actually-bound port, when it is up. */
  readonly builtinProxyPort: () => number | undefined
  readonly log: (message: string) => void
}

export class SandboxController {
  private launcher: CompiledLauncher | undefined
  private launcherPromise: Promise<CompiledLauncher | undefined> | undefined
  private tempRoot: string | undefined
  private exemptKey: string | undefined
  private sid: string | undefined

  constructor(private readonly deps: SandboxControllerDeps) {}

  /** Comparison key for change detection (settings-edit → re-ensure). */
  static keyOf(settings: SandboxSettings, sid: string): string {
    return JSON.stringify([sid, settings.enabled, settings.mode, settings.proxy, settings.loopback])
  }

  /**
   * Compile the launcher once per source hash, ask it once for the OS-derived
   * container SID (`--print-sid`), and record the loopback exemption once per
   * (sid, loopback setting). Memoized; failures are NOT cached (a missing csc
   * may appear after a .NET install — retry next call).
   */
  async ensure(settings: SandboxSettings): Promise<CompiledLauncher | undefined> {
    this.launcherPromise ??= ensureLauncher().then(async (compiled) => {
      this.launcher = compiled
      if (compiled === undefined) {
        this.deps.log('[dsh-perm-gate] sandbox: csc.exe not found — install .NET Framework 4.x; sandboxed calls will be DENIED (fail-closed)')
        return undefined
      }
      this.sid = await launcherSid(compiled.exePath)
      if (this.sid === undefined) {
        this.deps.log('[dsh-perm-gate] sandbox: launcher --print-sid failed — sandboxed calls will be DENIED (fail-closed)')
      }
      return compiled
    }, (error: unknown) => {
      this.launcherPromise = undefined // transient compile failure: retry next call
      this.deps.log(`[dsh-perm-gate] sandbox: launcher compile failed: ${String(error)}`)
      return undefined
    })
    const launcher = await this.launcherPromise
    if (launcher !== undefined && settings.loopback === 'exempt' && this.exemptKey !== settings.loopback) {
      if (this.sid === undefined) await this.launcherPromise
      if (this.sid !== undefined) {
        const result = await ensureLoopbackExempt(this.sid, { elevate: false })
        if (result.status === 'failed') this.deps.log(`[dsh-perm-gate] sandbox: ${result.message}`)
        this.exemptKey = settings.loopback
      }
    }
    return launcher
  }

  /** The proxy URL injected into sandboxed processes, if any. */
  resolveProxyUrl(settings: SandboxSettings): string | undefined {
    if (settings.proxy !== '') {
      let parsed: URL | undefined
      try { parsed = new URL(settings.proxy) } catch { parsed = undefined }
      const loopback = parsed !== undefined
        && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]' || parsed.hostname === '::1')
      if (!loopback) {
        this.deps.log(`[dsh-perm-gate] sandbox: proxy "${settings.proxy}" is not loopback-bound — the container cannot reach it; ignored`)
        return undefined
      }
      return settings.proxy
    }
    const port = this.deps.builtinProxyPort()
    return port !== undefined && port > 0 ? `http://127.0.0.1:${port}` : undefined
  }

  /**
   * Gate-aware rewrite of one allowed shell call: undefined (not applicable —
   * disabled / not a shell tool), wrap (the rewritten command), or deny
   * (fail-closed when the sandbox is on but cannot be honored).
   */
  async wrap(settings: SandboxSettings, exec: SandboxCall): Promise<SandboxRewriteResult | undefined> {
    if (!settings.enabled) return undefined
    if (!SHELL_TOOLS.has(exec.name)) return undefined
    const raw = exec.arguments['command']
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { kind: 'deny', reason: 'sandbox: shell call carries no command text — refusing to run it unconfined' }
    }
    const launcher = await this.ensure(settings)
    if (launcher === undefined) {
      return { kind: 'deny', reason: 'sandbox: launcher unavailable (compile failed or csc missing) — failing closed' }
    }
    const workspace = exec.cwd !== undefined && exec.cwd !== '' ? exec.cwd : this.deps.cwdRoot()
    const proxyUrl = this.resolveProxyUrl(settings)
    const proxyEnv: Record<string, string> = {}
    if (proxyUrl !== undefined) {
      for (const name of PROXY_ENV_NAMES) proxyEnv[name] = proxyUrl
    }
    const tempDir = await this.ensureTempDir()
    const configPath = await writeLaunchConfig({
      workspace,
      tempDir,
      mode: settings.mode,
      proxyEnv,
    }, tempDir)
    const wrapped = buildWrappedCommand(launcher.exePath, configPath, raw)
    this.deps.log(`[dsh-perm-gate] sandbox(appcontainer): ${raw.split('\n')[0].slice(0, 120)}`)
    return { kind: 'wrap', command: wrapped }
  }

  /** One standing scratch dir per plugin process, removed on dispose. */
  private async ensureTempDir(): Promise<string> {
    this.tempRoot ??= await mkdtemp(path.join(tmpdir(), 'dsh-perm-gate-ac-'))
    return this.tempRoot
  }

  /** Best-effort scratch cleanup at plugin dispose. */
  async dispose(): Promise<void> {
    if (this.tempRoot !== undefined) {
      await rm(this.tempRoot, { recursive: true, force: true }).catch(() => undefined)
      this.tempRoot = undefined
    }
  }
}

/** Ask the launcher for its OS-derived container SID (deterministic per name). */
function launcherSid(exePath: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(exePath, ['--print-sid'], { windowsHide: true, timeout: 30_000 }, (error, stdout) => {
      const sid = String(stdout ?? '').trim()
      resolve(error === undefined || error === null ? (sid !== '' ? sid : undefined) : undefined)
    })
  })
}
