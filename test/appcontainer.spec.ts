/**
 * AppContainer sandbox (goal 2) unit cover: SID derivation, command wrapping,
 * the controller's decision table, and the pre-execute seam wiring. The real
 * launcher.exe behavior (LowBox token, WFP egress block, loopback exemption,
 * proxy filtering) is proven by scripts/smoke-appcontainer.mjs on a real
 * Windows box — unit tests keep the pure logic honest.
 */
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { APPCONTAINER_NAME, isAppContainerSid } from '../src/appcontainer/sid.js'
import { buildWrappedCommand, decodeCommand, encodeCommand, writeLaunchConfig } from '../src/appcontainer/wrap.js'
import { SandboxController, type SandboxSettings } from '../src/appcontainer/index.js'
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
    value: async () => {
      // mimic ensure()'s memoization contract for the tests that call wrap()
      return { exePath: 'C:\\fake\\launcher.exe', cached: true }
    },
  })
  return controller
}

describe('container SID face', () => {
  it('keeps a fixed container name and validates SID shapes', () => {
    expect(APPCONTAINER_NAME).toBe('dsh-perm-gate.ac')
    // The real SID comes from DeriveAppContainerSidFromName (launcher --print-sid);
    // here we pin the validator only.
    expect(isAppContainerSid('S-1-15-2-618189880-1985978965-2420074952-4071639634')).toBe(true)
    expect(isAppContainerSid('S-1-15-2-1-2-3')).toBe(false) // too few authorities
    expect(isAppContainerSid('S-1-5-21-1-2-3-4')).toBe(false) // wrong authority
    expect(isAppContainerSid('S-1-15-2-4-2-3-4')).toBe(false) // not increasing
    expect(isAppContainerSid('S-1-15-2-1-2-3-x')).toBe(false)
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

  it('fails closed on a shell call without command text', async () => {
    const controller = fakeLauncherController()
    const verdict = await controller.wrap(ON, { name: 'shell', arguments: {} })
    expect(verdict?.kind).toBe('deny')
  })

  it('wraps an allowed shell command and injects the builtin proxy', async () => {
    const controller = fakeLauncherController()
    const verdict = await controller.wrap(ON, { name: 'shell', arguments: { command: 'npm test' } })
    expect(verdict?.kind).toBe('wrap')
    if (verdict?.kind !== 'wrap') return
    const b64 = verdict.command.slice(verdict.command.lastIndexOf(' ') + 1)
    expect(decodeCommand(b64)).toBe('npm test')
    const configMatch = /--config "([^"]+)"/.exec(verdict.command)
    expect(configMatch).not.toBeNull()
    const config = JSON.parse(readFileSync(configMatch![1], 'utf8')) as Record<string, unknown>
    expect(config['proxyEnv']).toEqual({
      HTTP_PROXY: 'http://127.0.0.1:18080', HTTPS_PROXY: 'http://127.0.0.1:18080', ALL_PROXY: 'http://127.0.0.1:18080',
      http_proxy: 'http://127.0.0.1:18080', https_proxy: 'http://127.0.0.1:18080', all_proxy: 'http://127.0.0.1:18080',
    })
    expect(config['mode']).toBe('workspace-write')
  })

  it('respects an explicit loopback proxy parameter and rejects non-loopback ones', () => {
    const controller = fakeLauncherController()
    expect(controller.resolveProxyUrl({ ...ON, proxy: 'http://127.0.0.1:9999' })).toBe('http://127.0.0.1:9999')
    expect(controller.resolveProxyUrl({ ...ON, proxy: 'http://proxy.lan:9999' })).toBeUndefined()
    expect(controller.resolveProxyUrl({ ...ON, proxy: '' })).toBe('http://127.0.0.1:18080')
  })

  it('reuses one scratch dir and cleans it on dispose', async () => {
    const controller = fakeLauncherController()
    const first = await controller.wrap(ON, { name: 'shell', arguments: { command: 'a' } })
    const second = await controller.wrap(ON, { name: 'shell', arguments: { command: 'b' } })
    const dirOf = (verdict: { kind: string; command?: string } | undefined): string | undefined => {
      const m = verdict?.kind === 'wrap' ? /--config "([^"]+)"/.exec(verdict.command ?? '') : undefined
      return m?.[1]
    }
    expect(dirOf(first)?.split('\\ac-')[0]).toBe(dirOf(second)?.split('\\ac-')[0])
    const dir = dirOf(first)!
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
