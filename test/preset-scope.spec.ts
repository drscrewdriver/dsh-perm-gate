import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.js'
import { permissionPresetOf, presetInScope } from '../src/preset.js'
import { PermGateRuntime, type ToolExecutionLike } from '../src/runtime.js'

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-preset-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** The `permission/preset` event dsh-permission-presets pins per session. */
const PRESET_EVENTS = (preset: string) => [{ type: 'permission/preset', data: { preset } }]

function execOf(preset: string | undefined, command = 'git status', callId?: string): ToolExecutionLike {
  return {
    name: 'shell',
    arguments: { command },
    cwd: '/work',
    sessionId: 's1',
    ...(callId === undefined ? {} : { callId }),
    ...(preset === undefined ? {} : { agent: { session: { id: 's1', events: PRESET_EVENTS(preset) } } }),
  }
}

describe('permission-preset fold', () => {
  it('folds the last selected preset', () => {
    expect(permissionPresetOf([...PRESET_EVENTS('read-only'), ...PRESET_EVENTS('permissive')])).toBe('permissive')
    expect(permissionPresetOf(undefined)).toBeUndefined()
    expect(permissionPresetOf([{ type: 'turn/start' }])).toBeUndefined()
    expect(permissionPresetOf([{ type: 'permission/preset', data: {} }])).toBeUndefined()
  })

  it('scopes a preset list, with `*` meaning every preset', () => {
    expect(presetInScope('permissive', ['permissive'])).toBe(true)
    expect(presetInScope('danger-full-access', ['permissive'])).toBe(false)
    expect(presetInScope(undefined, ['permissive'])).toBe(false)
    expect(presetInScope(undefined, ['*'])).toBe(true)
  })

  it('defaults the product scope to the gate\'s own tier', () => {
    expect(resolveConfig({}).gatePresets).toEqual(['permissive'])
    expect(resolveConfig({ gatePresets: ['permissive', 'workspace-write'] }).gatePresets)
      .toEqual(['permissive', 'workspace-write'])
    expect(resolveConfig({ gatePresets: [] }).gatePresets).toEqual(['permissive'])
  })
})

describe('gate scoping', () => {
  it('acts inside a preset that opts into the gate', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, gatePresets: ['permissive'] })
    expect(r.decideExecution(execOf('permissive'))?.kind).toBe('ask')
    expect(r.decideExecution(execOf('permissive', 'rm -rf /work/build'))?.kind).toBe('deny')
    expect(r.pendingAskCount()).toBe(1)
  })

  it('stands down completely outside it — including the hard-deny layer', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, gatePresets: ['permissive'] })
    for (const preset of ['danger-full-access', 'workspace-write', 'read-only', undefined]) {
      expect(r.decideExecution(execOf(preset))).toBeUndefined()
      // `danger-full-access` means full access without prompts: the gate must
      // not overrule it with a deny either.
      expect(r.decideExecution(execOf(preset, 'rm -rf /work/build'))).toBeUndefined()
      expect(r.decideExecution(execOf(preset, 'cat ~/.ssh/id_rsa'))).toBeUndefined()
    }
    expect(r.pendingAskCount()).toBe(0)
  })

  it('records nothing while standing down', () => {
    const dir = tmpDir()
    const runtime = new PermGateRuntime({
      rulesFile: undefined,
      gatePresets: ['permissive'],
      eventsFile: join(dir, 'events.jsonl'),
    })
    expect(runtime.decideExecution(execOf('danger-full-access', 'rm -rf /work/build'))).toBeUndefined()
    expect(runtime.eventLog?.query() ?? []).toHaveLength(0)
  })

  it('degrades an ask when the approval policy cannot reach a human', () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      gatePresets: ['permissive'],
      readApprovalPolicy: () => 'never',
    })
    expect(r.decideExecution(execOf('permissive'))).toBeUndefined()
    expect(r.pendingAskCount()).toBe(0)
    // A deny is still a deny: it does not need a human.
    expect(r.decideExecution(execOf('permissive', 'rm -rf /work/build'))?.kind).toBe('deny')
  })

  it('keeps the ask when the approval policy is ask', () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      gatePresets: ['permissive'],
      readApprovalPolicy: () => 'ask',
    })
    expect(r.decideExecution(execOf('permissive'))?.kind).toBe('ask')
  })

  it('keeps the ask when the approval-policy probe throws', () => {
    // The reader probes a PRIVATE approval-service method that exists in both
    // DSH 0.1.1-rc.2 and 0.1.2-rc.1. A throwing (or absent) probe means
    // "policy unknown" and must not kill the decision path.
    const r = new PermGateRuntime({
      rulesFile: undefined,
      gatePresets: ['permissive'],
      readApprovalPolicy: () => { throw new Error('approval service probe failed') },
    })
    expect(r.decideExecution(execOf('permissive'))?.kind).toBe('ask')
    expect(r.pendingAskCount()).toBe(1)
  })

  it('acts in every preset when the scope is `*`', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, gatePresets: ['*'] })
    expect(r.decideExecution(execOf('danger-full-access'))?.kind).toBe('ask')
    expect(r.decideExecution(execOf('danger-full-access', 'rm -rf /work/build'))?.kind).toBe('deny')
  })

  it('keeps the legacy always-on behaviour when no scope is configured', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(execOf('danger-full-access'))?.kind).toBe('ask')
  })

  it('records no escalation clearance outside the gate scope', () => {
    // The `trustEscalation` answer can only fire for a call THIS gate cleared, so
    // the scope is what keeps the other tiers' approval behaviour untouched: with
    // no clearance, `answerEscalation` is a no-op and stock DSH asks the human.
    const dir = tmpDir()
    const rulesFile = join(dir, 'rules.yml')
    writeFileSync(rulesFile, 'permissions:\n  allow:\n    - tools:\n        - shell\n      reason: test allow\n', 'utf8')
    const runtime = new PermGateRuntime({
      rulesFile,
      gatePresets: ['permissive'],
      permissive: true,
      permissiveStrategies: { trustEscalation: true },
    })
    const escalation = 'escalate sandbox to danger-full-access: need it'

    // Inside the gate's own tier the allow is remembered...
    expect(runtime.decideExecution(execOf('permissive', 'git status', 'c1'))).toBeUndefined()
    expect(runtime.clearedCallCount()).toBe(1)
    expect(runtime.answerEscalation({ toolName: 'shell', callId: 'c1', reason: escalation })).toBe('allowed-once')

    // ...and outside it the gate stands down and remembers nothing, so the very
    // same escalation still reaches the human. `danger-full-access` cannot even
    // escalate (nothing is strictly wider), and `read-only` is out of scope too.
    for (const preset of ['workspace-write', 'read-only', 'danger-full-access', undefined]) {
      expect(runtime.decideExecution(execOf(preset, 'git status', 'c2'))).toBeUndefined()
      expect(runtime.answerEscalation({ toolName: 'shell', callId: 'c2', reason: escalation })).toBeUndefined()
    }
    // Only the in-scope call was ever remembered.
    expect(runtime.clearedCallCount()).toBe(1)
  })
})
