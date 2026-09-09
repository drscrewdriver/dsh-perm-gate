/**
 * Regression cover for the `tools/pre-execute` waterfall listener: the llmAssist
 * grading must happen BEFORE the decision leaves the gate.
 *
 * An ask handed back to the host is already on its way to the approval
 * answerers and cannot be retracted, so a `safe` verdict learned in the
 * background used to be recorded without ever preventing the panel — the user
 * still had to click. These tests pin the awaited contract instead: `safe`
 * auto-allows (the listener delegates via `next()` and never asks), hard-risk
 * auto-denies, and only the genuinely uncertain verdicts keep the ask.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { makePreExecuteListener } from '../src/index.js'
import type { RiskRequest, RiskVerdict } from '../src/risk.js'
import { PermGateRuntime, type PermGateRuntimeOptions, type ToolExecutionLike } from '../src/runtime.js'

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-preexec-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A permissive runtime whose grader is the injected verdict (one recorded call). */
function setup(verdict: RiskVerdict, overrides: Partial<PermGateRuntimeOptions> = {}) {
  const dir = tmpDir()
  const calls: RiskRequest[] = []
  const runtime = new PermGateRuntime({
    rulesFile: undefined,
    eventsFile: join(dir, 'events.jsonl'),
    permissive: true,
    permissiveStrategies: { llmAssist: true },
    riskLearning: true,
    riskThreshold: 3,
    riskHook: async (req) => {
      calls.push(req)
      return verdict
    },
    ...overrides,
  })
  return { runtime, dir, calls }
}

/** An `edit` call: not a read-only tool, so it reaches the human seam as an ask. */
function execOf(dir: string, callId = 'c1'): ToolExecutionLike {
  return {
    name: 'edit',
    arguments: { file_path: join(dir, 'notes.md'), old_string: 'a', new_string: 'b' },
    sessionId: 's1',
    cwd: dir,
    callId,
  }
}

/** A `next()` stand-in that records whether the gate delegated (allow). */
function nextSpy() {
  const state = { calls: 0 }
  const next = async () => { state.calls += 1; return undefined }
  return { next, state }
}

function eventsOf(runtime: PermGateRuntime) {
  return runtime.eventLog?.query() ?? []
}

describe('pre-execute listener: llmAssist is awaited before the decision is returned', () => {
  it('auto-allows a safe verdict without ever asking the human', async () => {
    const { runtime, dir, calls } = setup({ kind: 'safe', reason: 'reversible in-scope edit' })
    const exec = execOf(dir)
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(exec, next)

    // Delegated (allow) — the host never sees an ask, so no panel can appear.
    expect(decision).toBeUndefined()
    expect(state.calls).toBe(1)
    expect(calls).toHaveLength(1)
    expect(runtime.pendingAskCount()).toBe(0)

    const terminal = eventsOf(runtime).at(-1)
    expect(terminal?.kind).toBe('auto')
    expect(terminal?.verdict).toBe('llm-safe')
    expect(terminal?.risk).toBe('safe')
  })

  it('auto-denies a hard-risk category without asking', async () => {
    const { runtime, dir } = setup({ kind: 'risky', category: 'credential' })
    const exec = execOf(dir)
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(exec, next)

    expect(decision).toMatchObject({ kind: 'deny' })
    expect(state.calls).toBe(0)
    expect(runtime.pendingAskCount()).toBe(0)
    expect(eventsOf(runtime).at(-1)?.verdict).toBe('llm-deny')
  })

  it('keeps the ask for a neutral verdict (the uncertain case)', async () => {
    const { runtime, dir } = setup({ kind: 'risky', category: 'neutral' })
    const exec = execOf(dir)
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(exec, next)

    expect(decision).toMatchObject({ kind: 'ask' })
    expect(String((decision as { reason: string }).reason)).toContain('llm-assist risky:neutral')
    expect(state.calls).toBe(0)
    expect(runtime.pendingAskCount()).toBe(1)
  })

  it('keeps the ask when the grader cannot resolve (fail-closed)', async () => {
    const { runtime, dir } = setup({ kind: 'unresolved' })
    const exec = execOf(dir)
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(exec, next)

    expect(decision).toMatchObject({ kind: 'ask' })
    expect(state.calls).toBe(0)
    expect(runtime.pendingAskCount()).toBe(1)
  })

  it('keeps the ask when grading throws', async () => {
    const dir = tmpDir()
    const runtime = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => { throw new Error('grader blew up') },
    })
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(execOf(dir), next)

    expect(decision).toMatchObject({ kind: 'ask' })
    expect(state.calls).toBe(0)
  })

  it('does not grade a call that is already cancelled', async () => {
    const { runtime, dir, calls } = setup({ kind: 'safe' })
    const controller = new AbortController()
    controller.abort()
    const exec: ToolExecutionLike = { ...execOf(dir), signal: controller.signal }
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(exec, next)

    expect(decision).toMatchObject({ kind: 'ask' })
    expect(calls).toHaveLength(0)
    expect(state.calls).toBe(0)
  })

  it('delegates an already-allowed call without grading it', async () => {
    const { runtime, dir, calls } = setup({ kind: 'safe' })
    // `read` is a built-in read-only tool: allowed before the LLM seam.
    const exec: ToolExecutionLike = { name: 'read', arguments: { file_path: join(dir, 'notes.md') }, sessionId: 's1', cwd: dir, callId: 'c2' }
    const { next, state } = nextSpy()

    const decision = await makePreExecuteListener(runtime)(exec, next)

    expect(decision).toBeUndefined()
    expect(state.calls).toBe(1)
    expect(calls).toHaveLength(0)
  })
})
