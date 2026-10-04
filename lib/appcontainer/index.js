/**
 * appcontainer/index.ts —— 沙盒控制器：把门控放行的 shell 调用重写进
 * Windows AppContainer（目标 2 的编排层）。
 *
 * 出网模型（设计定案，见 README「AppContainer 沙盒」一节）：
 *   - 属性列表启动 **零能力** → 非回环出网被 WFP 物理封死（不是环境变量那种
 *     可绕过的软约束）；
 *   - 容器 SID 由 OS 派生（launcher `--print-sid`），回环豁免做一次终身有效
 *     （exempt.ts，失败带退避重试——只缓存成功）；
 *   - 代理来自配置参数 `sandboxProxy`：空 = 跟随本插件的内置过滤代理
 *     （NetworkLifecycle 实际绑定的 127.0.0.1:<port>）；显式 URL 逐字注入
 *     （必须是回环地址——容器只可达回环）。注入时**同时置空 NO_PROXY**，
 *     否则继承的 NO_PROXY 会让容器绕开过滤代理直连回环（R4）。
 *
 * fail-closed：沙盒开启但启动器不可用 / 命令文本缺失 / 工作区越禁 / POSIX
 * 方言工具 → 返回 deny 而不是放行裸执行——这是权限闸门，不是便利贴。
 */
import { execFile } from 'node:child_process';
import { readdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { SHELL_TOOLS } from '../evaluate.js';
import { NO_PROXY_ENV_NAMES, PROXY_ENV_NAMES } from '../proxy.js';
import { ensureLauncher, locateCsc } from './compile.js';
import { ensureLoopbackExempt } from './exempt.js';
import { runProbe } from './probe.js';
import { buildWrappedCommand, writeLaunchConfig } from './wrap.js';
/** Tools whose command text is POSIX shell dialect — cmd.exe cannot honor it. */
const POSIX_DIALECT_TOOLS = new Set(['bash', 'sh']);
/** Retry cadence for a FAILED loopback exemption (successes settle permanently). */
const EXEMPT_RETRY_MS = 60_000;
/**
 * Workspace roots that must never receive container ACEs: granting the whole
 * user profile / a drive root / the OS directory turns "workspace-write" into
 * a machine-wide write grant (R3). Returns the denial reason or undefined.
 */
export function isForbiddenWorkspace(workspace, home = homedir(), winDir = process.env['WINDIR'] ?? 'C:\\Windows') {
    const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
    const target = norm(workspace);
    if (path.parse(target).root === target && target.endsWith(':'))
        return 'workspace is a drive root';
    if (target === norm(home))
        return 'workspace is the user home directory (would grant a whole-home ACE)';
    if (target === norm(winDir))
        return 'workspace is the Windows directory';
    return undefined;
}
export class SandboxController {
    deps;
    launcherPromise;
    probe;
    tempRoot;
    configRoot;
    exemptSettled = false;
    exemptLastAttempt = 0;
    sid;
    swept = false;
    constructor(deps) {
        this.deps = deps;
    }
    get platform() {
        return this.deps.platform ? this.deps.platform() : process.platform;
    }
    get now() {
        return this.deps.now ? this.deps.now() : Date.now();
    }
    /** Comparison key for change detection (settings-edit → re-ensure). */
    static keyOf(settings, sid) {
        return JSON.stringify([sid, settings.enabled, settings.mode, settings.proxy, settings.loopback]);
    }
    /**
     * Compile the launcher once per source hash, ask it for the OS-derived
     * container SID, and run the one-shot `--probe` verdict. Failures are NOT
     * cached (a missing csc may appear after a .NET install — retry next call);
     * the loopback exemption settles only on success (a failure retries with
     * backoff — a transient denial must not disable loopback for the process
     * lifetime).
     */
    async ensure(settings) {
        this.launcherPromise ??= ensureLauncher().then(async (compiled) => {
            if (compiled === undefined) {
                this.deps.log('[dsh-perm-gate] sandbox: csc.exe not found — install .NET Framework 4.x; sandboxed calls will be DENIED (fail-closed)');
                return undefined;
            }
            // OS-derived container SID (opaque; both era shapes accepted).
            this.sid = await launcherSid(compiled.exePath);
            if (this.sid === undefined) {
                this.deps.log('[dsh-perm-gate] sandbox: launcher --print-sid failed — sandboxed calls will be DENIED (fail-closed)');
                return undefined;
            }
            // One-shot probe verdict (diagnostics/attribution ONLY — never a
            // pass-through basis; per-launch resolution stays the trust anchor).
            this.probe = await runProbe(compiled.exePath);
            if (this.probe !== undefined) {
                this.deps.log(`[dsh-perm-gate] sandbox probe: era=${this.probe.era} sidSubAuthorities=${this.probe.sidSubAuthorities} registered=${this.probe.registered.state} tryLaunch.win32Err=${this.probe.tryLaunch.win32Err}`);
            }
            // Fire-and-forget housekeeping (orphan scratch + stale compile cache).
            void this.sweep().catch(() => undefined);
            return { exePath: compiled.exePath, hash: compiled.hash };
        }, (error) => {
            this.launcherPromise = undefined; // transient compile failure: retry next call
            this.deps.log(`[dsh-perm-gate] sandbox: launcher compile failed: ${String(error)}`);
            return undefined;
        });
        const compiled = await this.launcherPromise;
        if (compiled !== undefined && settings.loopback === 'exempt' && !this.exemptSettled && this.now - this.exemptLastAttempt >= EXEMPT_RETRY_MS) {
            if (this.sid === undefined)
                await this.launcherPromise;
            if (this.sid !== undefined) {
                this.exemptLastAttempt = this.now;
                const result = await ensureLoopbackExempt(this.sid, { elevate: false });
                // Only successes settle: a transient elevation denial must not
                // disable loopback for the whole process lifetime (B finding).
                if (result.status === 'exempt' || result.status === 'already-exempt' || result.status === 'unsupported') {
                    this.exemptSettled = true;
                    if (result.status === 'exempt')
                        this.deps.log(`[dsh-perm-gate] sandbox: loopback exempted for ${this.sid}`);
                }
                else if (result.status === 'failed') {
                    this.deps.log(`[dsh-perm-gate] sandbox: ${result.message}`);
                }
            }
        }
        return compiled;
    }
    /** The proxy URL injected into sandboxed processes, if any. */
    resolveProxyUrl(settings) {
        if (settings.proxy !== '') {
            let parsed;
            try {
                parsed = new URL(settings.proxy);
            }
            catch {
                parsed = undefined;
            }
            const loopback = parsed !== undefined
                && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]' || parsed.hostname === '::1');
            if (!loopback) {
                this.deps.log(`[dsh-perm-gate] sandbox: proxy "${settings.proxy}" is not loopback-bound — the container cannot reach it; ignored`);
                return undefined;
            }
            return settings.proxy;
        }
        const port = this.deps.builtinProxyPort();
        return port !== undefined && port > 0 ? `http://127.0.0.1:${port}` : undefined;
    }
    /**
     * Gate-aware rewrite of one allowed shell call: undefined (not applicable —
     * disabled / not a shell tool / non-Windows), wrap (the rewritten command),
     * or deny (fail-closed when the sandbox is on but cannot be honored).
     */
    async wrap(settings, exec) {
        if (!settings.enabled)
            return undefined;
        if (this.platform !== 'win32')
            return undefined; // feature is Windows-only: silently off (apply() warns)
        if (!SHELL_TOOLS.has(exec.name))
            return undefined;
        // POSIX-dialect tools cannot be honored by the container's cmd.exe —
        // running them anyway would silently reinterpret the command (R9).
        if (POSIX_DIALECT_TOOLS.has(exec.name)) {
            return { kind: 'deny', reason: `sandbox: "${exec.name}" is a POSIX-dialect tool the AppContainer wrapper cannot honor (cmd.exe semantics) — run it via a Windows shell tool or disable sandboxEnabled` };
        }
        const raw = exec.arguments['command'];
        if (typeof raw !== 'string' || raw.trim() === '') {
            return { kind: 'deny', reason: 'sandbox: shell call carries no command text — refusing to run it unconfined' };
        }
        const workspace = exec.cwd !== undefined && exec.cwd !== '' ? exec.cwd : this.deps.cwdRoot();
        const forbidden = isForbiddenWorkspace(workspace);
        if (forbidden !== undefined) {
            return { kind: 'deny', reason: `sandbox: ${forbidden} — refusing to grant container ACEs there` };
        }
        const launcher = await this.ensure(settings);
        if (launcher === undefined) {
            const hint = this.probe !== undefined ? ` (probe: ${this.probe.era})` : '';
            return { kind: 'deny', reason: `sandbox: launcher unavailable (compile failed or csc missing)${hint} — failing closed` };
        }
        const proxyUrl = this.resolveProxyUrl(settings);
        const proxyEnv = {};
        if (proxyUrl !== undefined) {
            for (const name of PROXY_ENV_NAMES)
                proxyEnv[name] = proxyUrl;
            // Clear inherited NO_PROXY: otherwise hosts with NO_PROXY=127.0.0.1,…
            // bypass the filtering proxy straight to loopback services (R4).
            for (const name of NO_PROXY_ENV_NAMES)
                proxyEnv[name] = '';
        }
        const tempDir = await this.ensureTempDir();
        // The launch config lives OUTSIDE the container-writable scratch dir: a
        // resident container process must never be able to rewrite a future
        // call's config into granting ACEs elsewhere (R5 TOCTOU).
        const configDir = await this.ensureConfigDir();
        const configPath = await writeLaunchConfig({
            workspace,
            tempDir,
            mode: settings.mode,
            proxyEnv,
        }, configDir);
        const wrapped = buildWrappedCommand(launcher.exePath, configPath, raw);
        this.deps.log(`[dsh-perm-gate] sandbox(appcontainer): ${raw.split('\n')[0].slice(0, 120)}`);
        return { kind: 'wrap', command: wrapped };
    }
    /** One standing scratch dir per plugin process, removed on dispose. */
    async ensureTempDir() {
        this.tempRoot ??= await mkdtemp(path.join(tmpdir(), 'dsh-perm-gate-ac-'));
        return this.tempRoot;
    }
    /** Private config dir — NOT container-writable (R5). */
    async ensureConfigDir() {
        this.configRoot ??= await mkdtemp(path.join(tmpdir(), 'dsh-perm-gate-ac-cfg-'));
        return this.configRoot;
    }
    /** Best-effort scratch cleanup at plugin dispose. */
    async dispose() {
        for (const dir of [this.tempRoot, this.configRoot]) {
            if (dir !== undefined) {
                await rm(dir, { recursive: true, force: true }).catch(() => undefined);
            }
        }
        this.tempRoot = undefined;
        this.configRoot = undefined;
    }
    /**
     * One-shot housekeeping: orphan scratch dirs (crashed processes leak them —
     * 6 found on this machine) older than 24h, and stale compile-cache exes
     * older than 7 days. Best effort, once per process.
     */
    async sweep() {
        if (this.swept)
            return;
        this.swept = true;
        const dayMs = 24 * 60 * 60_000;
        const now = this.now;
        let entries = [];
        try {
            entries = await readdir(tmpdir());
        }
        catch {
            return;
        }
        for (const name of entries) {
            if (!name.startsWith('dsh-perm-gate-ac-'))
                continue;
            const full = path.join(tmpdir(), name);
            try {
                const info = await stat(full);
                if (now - info.mtimeMs > dayMs)
                    await rm(full, { recursive: true, force: true });
            }
            catch { /* racing with another process's sweep is fine */ }
        }
        // Compile cache: csc writes launcher-<hash>.exe (+ .ok); keep only recent
        // artifacts — stale hashes are dead once the source moved on.
        const csc = locateCsc();
        if (csc === undefined)
            return;
        const { CACHE_DIR } = await import('./compile.js');
        let cached = [];
        try {
            cached = await readdir(CACHE_DIR);
        }
        catch {
            return;
        }
        for (const name of cached) {
            if (!name.startsWith('appcontainer-launcher-'))
                continue;
            const full = path.join(CACHE_DIR, name);
            try {
                const info = await stat(full);
                if (now - info.mtimeMs > 7 * dayMs)
                    await rm(full, { force: true });
            }
            catch { /* ignore */ }
        }
    }
}
/** Ask the launcher for its OS-derived container SID (deterministic per name). */
function launcherSid(exePath) {
    return new Promise((resolve) => {
        execFile(exePath, ['--print-sid'], { windowsHide: true, timeout: 30_000 }, (error, stdout) => {
            const sid = String(stdout ?? '').trim();
            resolve(error === undefined || error === null ? (sid !== '' ? sid : undefined) : undefined);
        });
    });
}
