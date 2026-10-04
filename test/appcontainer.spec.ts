/**
 * AppContainer sandbox (goal 2) unit cover: SID face, command wrapping, the
 * controller's decision table (incl. the R3/R4/R5/R9 fixes), probe verdict
 * parsing, and the pre-execute seam wiring. The real launcher.exe behavior
 * (OS SID derivation, WFP egress block, loopback exemption, proxy filtering)
 * is proven by scripts/smoke-appcontainer.mjs on a real Windows box — unit
 * tests keep the pure logic honest.
 */
import { mkdtempSync, readFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { APPCONTAINER_NAME, isAppContainerSid } from '../src/appcontainer/sid.js'
import { buildWrappedCommand, decodeCommand, encodeCommand, writeLaunchConfig } from '../src/appcontainer/wrap.js'
import { parseProbeJson, probeAttribution, probeCacheKey } from '../src/appcontainer/probe.js'
import { SandboxController, isForbiddenWorkspace, type SandboxSettings } from '../src/appcontainer/index.js'
import { makePreExecuteListener } from '../src/index.js'
import type { ToolExecutionLike } from '../src/runtime.js'

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-ac-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const OFF: SandboxSettings = { enabled: false, mode: 'workspace-write', proxy: '', loopback: 'off' }
const ON: SandboxSettings = { enabled: true, mode: 'workspace-write', proxy: '', loopback: 'off' }

/** A controller whose launcher always resolves (no real csc involvement). */
function fakeLauncherController(log: string[] = []): SandboxController {
  const controller = new SandboxController({
    cwdRoot: () => 'C:\\fake-workspace',
    builtinProxyPort: () => 18080,
    log: (message: string) => { log.push(message) },
  })
  Object.defineProperty(controller, 'ensure', {
    value: async () => ({ exePath: 'C:\\fake\\launcher.exe', hash: 'deadbeef', cached: true }),
  })
  return controller
}

describe('container SID face', () => {
  it('keeps a fixed container name and validates SID shapes as opaque handles', () => {
    expect(APPCONTAINER_NAME).toBe('dsh-perm-gate.ac')
    // The real SID comes from OS derivation (launcher --print-sid); both era
    // shapes must pass: classic 4-authority and modern 7-authority (26200
    // real package SIDs are 7-authority and NOT monotonic).
    expect(isAppContainerSid('S-1-15-2-618189880-1985978965-2420074952-4071639634')).toBe(true)
    expect(isAppContainerSid('S-1-15-2-634029143-3669758489-4275030389-1209502868-323016476-3321753635-1116034227')).toBe(true)
    expect(isAppContainerSid('S-1-15-2-4-2-3-4')).toBe(true) // shape only; ordering is not ours to judge
    expect(isAppContainerSid('S-1-15-2-1-2-3')).toBe(false) // too few authorities
    expect(isAppContainerSid('S-1-5-21-1-2-3-4')).toBe(false) // wrong authority
    expect(isAppContainerSid('S-1-15-2-1-2-3-x')).toBe(false)
  })

  it('keeps the TS container name in lockstep with the launcher source (T1.14)', () => {
    // A silent name drift derives a brand-new SID and strands every standing
    // exemption/ACE. The launcher source is a shipped asset — pin the pair.
    const cs = readFileSync(join(__dirname, '..', 'assets', 'appcontainer-launcher.cs'), 'utf8')
    const m = /const string CONTAINER_NAME = "([^"]+)"/.exec(cs)
    expect(m?.[1]).toBe(APPCONTAINER_NAME)
  })
})

describe('workspace root guard (R3)', () => {
  it('denies home, drive root, and the Windows directory', () => {
    expect(isForbiddenWorkspace(join(tmpdir(), 'fine'))).toBeUndefined()
    expect(isForbiddenWorkspace(process.env['USERPROFILE'] ?? 'C:\\Users\\x')).toMatch(/home directory/)
    expect(isForbiddenWorkspace('C:\\')).toMatch(/drive root/)
    expect(isForbiddenWorkspace('C:\\Windows')).toMatch(/Windows directory/)
  })
})

describe('probe verdict parsing (T1.6)', () => {
  const good = JSON.stringify({
    era: 'moniker',
    derive: { name: 'AppContainerDeriveSidFromMoniker', module: 'KernelBase', hr: 0 },
    sid: 'S-1-15-2-634029143-3669758489-4275030389-1209502868-323016476-3321753635-1116034227',
    sidSubAuthorities: 7,
    registered: { state: 'no', lookupHr: -2147024894, mappingMoniker: null },
    tryLaunch: { attempted: true, win32Err: 87, childExit: null },
    osBuild: 26200,
    capabilities: { lookup: true, register: true, createToken: false },
    mxc: { present: false },
  }) + '\n'

  it('parses the single-line verdict and builds an attribution line', () => {
    const probe = parseProbeJson(good)
    expect(probe?.era).toBe('moniker')
    expect(probe?.sidSubAuthorities).toBe(7)
    expect(probe?.tryLaunch.win32Err).toBe(87)
    expect(probeCacheKey('deadbeef', probe!)).toBe('deadbeef@26200')
    expect(probeAttribution(probe!)).toContain('era=moniker')
    expect(probeAttribution(probe!)).toContain('win32Err=87')
  })

  it('rejects non-verdict output (crash text, truncated JSON)', () => {
    expect(parseProbeJson('dsh-perm-gate-appcontainer: 42: boom')).toBeUndefined()
    expect(parseProbeJson('{"era": "moniker"')).toBeUndefined()
    expect(parseProbeJson('')).toBeUndefined()
  })
})

describe('command wrapping', () => {
  it('round-trips unicode commands through base64', () => {
    const command = 'git push origin "main" && echo 中文 ✓ | tee log.txt'
    expect(decodeCommand(encodeCommand(command))).toBe(command)
  })

  it('emits a single quoted-exe invocation the outer shell cannot split', () => {
    const wrapped = buildWrappedCommand('C:\\cache\\launcher.exe', 'C:\\cache\\cfg.json', 'dir | findstr x')
    expect(wrapped).toContain('"C:\\cache\\launcher.exe" --config "C:\\cache\\cfg.json" --exec-b64 ')
    const b64 = wrapped.slice(wrapped.lastIndexOf(' ') + 1)
    expect(decodeCommand(b64)).toBe('dir | findstr x')
    expect(wrapped).not.toContain('|') // the pipe stays inside the payload
  })

  it('persists the launch config for the launcher', async () => {
    const dir = tmpDir()
    const configPath = await writeLaunchConfig({
      workspace: 'C:\\ws', tempDir: 'C:\\t',
      mode: 'workspace-write', proxyEnv: { HTTP_PROXY: 'http://127.0.0.1:18080' },
    }, dir)
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
    expect(parsed['workspace']).toBe('C:\\ws')
    expect(parsed['mode']).toBe('workspace-write')
    expect((parsed['proxyEnv'] as Record<string, string>)['HTTP_PROXY']).toBe('http://127.0.0.1:18080')
  })
})

describe('sandbox controller decision table', () => {
  it('passes through when disabled or not a shell tool', async () => {
    const controller = fakeLauncherController()
    const exec = { name: 'shell', arguments: { command: 'dir' } }
    expect(await controller.wrap(OFF, exec)).toBeUndefined()
    expect(await controller.wrap(ON, { name: 'read_file', arguments: { path: 'x' } })).toBeUndefined()
  })

  it('is silently off on non-Windows platforms (apply() carries the warning, T1.13)', async () => {
    const controller = fakeLauncherController()
    Object.defineProperty(controller, 'platform', { get: () => 'linux' })
    expect(await controller.wrap(ON, { name: 'shell', arguments: { command: 'dir' } })).toBeUndefined()
  })

  it('fails closed on a shell call without command text', async () => {
    const controller = fakeLauncherController()
    const verdict = await controller.wrap(ON, { name: 'shell', arguments: {} })
    expect(verdict?.kind).toBe('deny')
  })

  it('denies POSIX-dialect tools instead of reinterpreting them under cmd.exe (R9 / T1.11)', async () => {
    const controller = fakeLauncherController()
    for (const tool of ['bash', 'sh']) {
      const verdict = await controller.wrap(ON, { name: tool, arguments: { command: 'echo $HOME' } })
      expect(verdict?.kind).toBe('deny')
      if (verdict?.kind === 'deny') expect(verdict.reason).toContain('POSIX-dialect')
    }
    expect((await controller.wrap(ON, { name: 'pwsh', arguments: { command: 'Get-Location' } }))?.kind).toBe('wrap')
  })

  it('denies forbidden workspace roots before touching the launcher (R3 / T1.10)', async () => {
    const controller = fakeLauncherController()
    const home = process.env['USERPROFILE'] ?? 'C:\\Users\\x'
    const verdict = await controller.wrap(ON, { name: 'shell', arguments: { command: 'dir' }, cwd: home })
    expect(verdict?.kind).toBe('deny')
    if (verdict?.kind === 'deny') expect(verdict.reason).toContain('home directory')
  })

  it('wraps an allowed shell command, injects the builtin proxy, and clears NO_PROXY (R4 / T1.8)', async () => {
    const controller = fakeLauncherController()
    const verdict = await controller.wrap(ON, { name: 'shell', arguments: { command: 'npm test' } })
    expect(verdict?.kind).toBe('wrap')
    if (verdict?.kind !== 'wrap') return
    const b64 = verdict.command.slice(verdict.command.lastIndexOf(' ') + 1)
    expect(decodeCommand(b64)).toBe('npm test')
    const configMatch = /--config "([^"]+)"/.exec(verdict.command)
    expect(configMatch).not.toBeNull()
    const config = JSON.parse(readFileSync(configMatch![1], 'utf8')) as Record<string, unknown>
    const env = config['proxyEnv'] as Record<string, string>
    expect(env['HTTP_PROXY']).toBe('http://127.0.0.1:18080')
    expect(env['https_proxy']).toBe('http://127.0.0.1:18080')
    expect(env['NO_PROXY']).toBe('')
    expect(env['no_proxy']).toBe('')
    expect(config['mode']).toBe('workspace-write')
  })

  it('keeps the launch config OUTSIDE the container-writable scratch dir (R5 / T1.9)', async () => {
    const controller = fakeLauncherController()
    const verdict = await controller.wrap(ON, { name: 'shell', arguments: { command: 'npm test' } })
    if (verdict?.kind !== 'wrap') return
    const configMatch = /--config "([^"]+)"/.exec(verdict.command)
    expect(configMatch).not.toBeNull()
    const configFile = configMatch![1]
    expect(configFile).toContain('dsh-perm-gate-ac-cfg-')
    // The container-writable temp dir is a DIFFERENT tree from the config dir.
    const tempDir = (JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>)['tempDir'] as string
    expect(tempDir).toContain('dsh-perm-gate-ac-')
    expect(tempDir.startsWith(configFile.slice(0, configFile.lastIndexOf('\\')))).toBe(false)
    expect(statSync(configFile).isFile()).toBe(true)
  })

  it('respects an explicit loopback proxy parameter and rejects non-loopback ones', () => {
    const controller = fakeLauncherController()
    expect(controller.resolveProxyUrl({ ...ON, proxy: 'http://127.0.0.1:9999' })).toBe('http://127.0.0.1:9999')
    expect(controller.resolveProxyUrl({ ...ON, proxy: 'http://proxy.lan:9999' })).toBeUndefined()
    expect(controller.resolveProxyUrl({ ...ON, proxy: '' })).toBe('http://127.0.0.1:18080')
  })

  it('reuses one config dir across calls and cleans it (with scratch) on dispose (R5)', async () => {
    const controller = fakeLauncherController()
    const first = await controller.wrap(ON, { name: 'shell', arguments: { command: 'a' } })
    const second = await controller.wrap(ON, { name: 'shell', arguments: { command: 'b' } })
    const configFileOf = (verdict: { kind: string; command?: string } | undefined): string | undefined => {
      const m = verdict?.kind === 'wrap' ? /--config "([^"]+)"/.exec(verdict.command ?? '') : undefined
      return m?.[1]
    }
    const dirOf = (file: string | undefined): string => file!.slice(0, file!.lastIndexOf('\\'))
    expect(dirOf(configFileOf(first))).toBe(dirOf(configFileOf(second)))
    const dir = dirOf(configFileOf(first))
    expect(existsSync(dir)).toBe(true)
    await controller.dispose()
    expect(existsSync(dir)).toBe(false)
  })
})

describe('pre-execute seam', () => {
  const baseExec = (): ToolExecutionLike => ({ name: 'shell', arguments: { command: 'git status' } }) as ToolExecutionLike

  it('rewrites an allowed call before next()', async () => {
    let called = false
    const runtime = {
      decideExecution: () => undefined,
      beginShellExecution: () => {},
      sandboxRewrite: async () => ({ kind: 'wrap' as const, command: 'WRAPPED-CMD' }),
    }
    const listener = makePreExecuteListener(runtime)
    const exec = baseExec()
    await listener(exec, async () => { called = true; return 'ok' })
    expect(called).toBe(true)
    expect(exec.arguments['command']).toBe('WRAPPED-CMD')
  })

  it('denies without calling next() when the sandbox fails closed', async () => {
    let called = false
    const runtime = {
      decideExecution: () => undefined,
      beginShellExecution: () => {},
      sandboxRewrite: async () => ({ kind: 'deny' as const, reason: 'sandbox: launcher unavailable' }),
    }
    const listener = makePreExecuteListener(runtime)
    const verdict = await listener(baseExec(), async () => { called = true; return 'ok' })
    expect(called).toBe(false)
    expect(verdict).toEqual({ kind: 'deny', reason: 'sandbox: launcher unavailable' })
  })

  it('leaves the call untouched when the hook is absent or inert', async () => {
    const exec = baseExec()
    const runtime = {
      decideExecution: () => undefined,
      beginShellExecution: () => {},
      sandboxRewrite: async () => undefined,
    }
    const listener = makePreExecuteListener(runtime)
    await listener(exec, async () => 'ok')
    expect(exec.arguments['command']).toBe('git status')
  })
})
