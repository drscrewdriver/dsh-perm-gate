import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadEventSnapshots } from '../src/events.js'
import { makeApprovalObserver } from '../src/index.js'
import { PermGateRuntime, type PermGateRuntimeOptions, type ToolExecutionLike } from '../src/runtime.js'

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-manual-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A runtime with an event feed (and snapshots) on disk, no rules file. */
function setup(options: Partial<PermGateRuntimeOptions> = {}) {
  const dir = tmpDir()
  const snapshotsDir = join(dir, 'snapshots')
  const runtime = new PermGateRuntime({
    rulesFile: undefined,
    eventsFile: join(dir, 'events.jsonl'),
    snapshotsDir,
    ...options,
  })
  return { runtime, dir, snapshotsDir }
}

function execOf(dir: string, callId?: string): ToolExecutionLike {
  return {
    name: 'write',
    arguments: { file_path: join(dir, 'a.txt') },
    sessionId: 's1',
    cwd: dir,
    ...(callId === undefined ? {} : { callId }),
  }
}

function eventsOf(runtime: PermGateRuntime) {
  return runtime.eventLog?.query() ?? []
}

function terminalOf(runtime: PermGateRuntime) {
  const events = eventsOf(runtime)
  return events[events.length - 1]
}

describe('manual approval terminal records', () => {
  it('records an approval with the snapshotted session and files', () => {
    const { runtime, dir } = setup()
    const exec = execOf(dir, 'c1')
    expect(runtime.decideExecution(exec)?.kind).toBe('ask')
    expect(runtime.pendingAskCount()).toBe(1)

    expect(runtime.settleAskOutcome('c1', 'allowed-once')).toBe(true)
    expect(runtime.pendingAskCount()).toBe(0)

    const terminal = terminalOf(runtime)
    expect(terminal?.kind).toBe('manual-approved')
    expect(terminal?.verdict).toBe('human-approved')
    expect(terminal?.sessionId).toBe('s1')
    expect(terminal?.tool).toBe('write')
    expect(terminal?.files).toEqual([join(dir, 'a.txt')])
  })

  it('records a rejection and a cancellation with their own labels', () => {
    const rejected = setup()
    rejected.runtime.decideExecution(execOf(rejected.dir, 'c1'))
    rejected.runtime.settleAskOutcome('c1', 'rejected')
    expect(terminalOf(rejected.runtime)?.kind).toBe('manual-rejected')
    expect(terminalOf(rejected.runtime)?.verdict).toBe('human-rejected')

    const cancelled = setup()
    cancelled.runtime.decideExecution(execOf(cancelled.dir, 'c2'))
    cancelled.runtime.settleAskOutcome('c2', 'cancelled')
    expect(terminalOf(cancelled.runtime)?.kind).toBe('manual-cancelled')
    expect(terminalOf(cancelled.runtime)?.verdict).toBe('human-cancelled')
  })

  it('records a degraded ask as a denial, never as a human decision', () => {
    const { runtime, dir } = setup()
    runtime.decideExecution(execOf(dir, 'c1'))
    runtime.settleAskOutcome('c1', 'unavailable')
    const terminal = terminalOf(runtime)
    expect(terminal?.kind).toBe('deny')
    expect(terminal?.verdict).toBe('no-approval-channel')
  })

  it('is idempotent: a settled ask is never recorded twice', () => {
    const { runtime, dir } = setup()
    runtime.decideExecution(execOf(dir, 'c1'))
    expect(runtime.settleAskOutcome('c1', 'allowed-once')).toBe(true)
    const countAfterFirst = eventsOf(runtime).length
    expect(runtime.settleAskOutcome('c1', 'rejected')).toBe(false)
    expect(eventsOf(runtime).length).toBe(countAfterFirst)
  })

  it('ignores an unknown or empty call id', () => {
    const { runtime, dir } = setup()
    runtime.decideExecution(execOf(dir, 'c1'))
    expect(runtime.settleAskOutcome('', 'allowed-once')).toBe(false)
    expect(runtime.settleAskOutcome('other', 'allowed-once')).toBe(false)
    expect(runtime.pendingAskCount()).toBe(1)
  })

  it('tracks by fingerprint when the call carries no id', () => {
    const { runtime, dir } = setup()
    const exec = execOf(dir)
    runtime.decideExecution(exec)
    expect(runtime.pendingAskCount()).toBe(1)
    // An observer keyed by call id cannot correlate it...
    expect(runtime.settleAskOutcome('c1', 'allowed-once')).toBe(false)
    expect(runtime.pendingAskCount()).toBe(1)
    // ...so the fallback channel settles it from the result.
    runtime.settleExecution(exec, { isError: false })
    expect(runtime.pendingAskCount()).toBe(0)
    expect(terminalOf(runtime)?.kind).toBe('manual-approved')
  })

  it('reads the session id and cwd from the agent when the execution omits them', () => {
    const { runtime } = setup()
    // DSH's ToolExecution carries the session on `agent`, not on `sessionId`.
    const exec: ToolExecutionLike = {
      name: 'write',
      arguments: { file_path: 'a.txt' },
      callId: 'c9',
      agent: { session: { id: 'sess-9', header: { cwd: '/work' } } },
    }
    expect(runtime.decideExecution(exec)?.kind).toBe('ask')
    runtime.settleAskOutcome('c9', 'allowed-once')
    const terminal = terminalOf(runtime)
    expect(terminal?.sessionId).toBe('sess-9')
    expect(terminal?.kind).toBe('manual-approved')
  })
})

describe('approval observer', () => {
  it('forwards the waterfall outcome unchanged and records it', async () => {
    const { runtime, dir } = setup()
    runtime.decideExecution(execOf(dir, 'c1'))
    const observer = makeApprovalObserver(runtime)

    await expect(observer({ callId: 'c1' }, async () => 'allowed-once')).resolves.toBe('allowed-once')
    expect(terminalOf(runtime)?.kind).toBe('manual-approved')
  })

  it('never changes the outcome when recording throws', async () => {
    const observer = makeApprovalObserver({
      settleAskOutcome: () => { throw new Error('recording blew up') },
    })
    await expect(observer({ callId: 'c1' }, async () => 'rejected')).resolves.toBe('rejected')
    await expect(observer(undefined, async () => 'cancelled')).resolves.toBe('cancelled')
  })

  it('does not consume an ask it cannot correlate', async () => {
    const { runtime, dir } = setup()
    const exec = execOf(dir)
    runtime.decideExecution(exec)
    const observer = makeApprovalObserver(runtime)
    await observer({ callId: 'unknown' }, async () => 'allowed-once')
    expect(runtime.pendingAskCount()).toBe(1)
    runtime.settleExecution(exec, { isError: false })
    expect(terminalOf(runtime)?.kind).toBe('manual-approved')
  })
})

describe('settlement fallback (tools/result)', () => {
  function asked(callId = 'c1') {
    const { runtime, dir } = setup()
    const exec = execOf(dir, callId)
    runtime.decideExecution(exec)
    return { runtime, exec }
  }

  it('classifies a successful result as an approval', () => {
    const { runtime, exec } = asked()
    runtime.settleExecution(exec, { isError: false })
    expect(terminalOf(runtime)?.kind).toBe('manual-approved')
  })

  it('classifies the rejection and cancellation messages', () => {
    const rejected = asked()
    rejected.runtime.settleExecution(rejected.exec, { isError: true, error: { message: 'the user rejected tool "write"' } })
    expect(terminalOf(rejected.runtime)?.kind).toBe('manual-rejected')

    const cancelled = asked()
    cancelled.runtime.settleExecution(cancelled.exec, { isError: true, error: { message: 'approval for tool "write" was cancelled' } })
    expect(terminalOf(cancelled.runtime)?.kind).toBe('manual-cancelled')
  })

  it('classifies a missing approval channel as a denial', () => {
    const { runtime, exec } = asked()
    runtime.settleExecution(exec, { isError: true, error: { message: 'tool "write" requires approval, but no approval channel is available' } })
    const terminal = terminalOf(runtime)
    expect(terminal?.kind).toBe('deny')
    expect(terminal?.verdict).toBe('no-approval-channel')
  })

  it('treats a failure after the approval as an approval', () => {
    const { runtime, exec } = asked()
    runtime.settleExecution(exec, { isError: true, error: { message: 'EACCES: permission denied' } })
    expect(terminalOf(runtime)?.kind).toBe('manual-approved')
  })
})

describe('llmAssist auto-allow', () => {
  const permissiveOptions: Partial<PermGateRuntimeOptions> = {
    permissive: true,
    permissiveStrategies: { llmAssist: true },
    riskLearning: true,
    riskThreshold: 1,
  }

  it('does not leave a terminal record when the grader auto-allows', async () => {
    const { runtime, dir } = setup({ ...permissiveOptions, riskHook: async () => ({ kind: 'safe' }) })
    const exec = execOf(dir, 'c1')
    const decision = runtime.decideExecution(exec)
    expect(decision?.kind).toBe('ask')
    expect(runtime.pendingAskCount()).toBe(1)

    await expect(runtime.refineAsk(exec, decision as { kind: 'ask'; reason: string })).resolves.toBeUndefined()
    expect(runtime.pendingAskCount()).toBe(0)

    const before = eventsOf(runtime).length
    runtime.settleExecution(exec, { isError: false })
    expect(eventsOf(runtime).length).toBe(before)
  })

  it('reports learning progress on an approved learned ask', async () => {
    const { runtime, dir } = setup({ ...permissiveOptions, riskHook: async () => ({ kind: 'risky', category: 'neutral' }) })
    const exec = execOf(dir, 'c1')
    const decision = runtime.decideExecution(exec)
    await runtime.refineAsk(exec, decision as { kind: 'ask'; reason: string })

    runtime.settleAskOutcome('c1', 'allowed-once')
    const terminal = terminalOf(runtime)
    expect(terminal?.kind).toBe('manual-approved')
    expect(terminal?.learningCount).toBe(1)
    expect(terminal?.threshold).toBe(1)

    // The executed call settles the learning candidate itself.
    runtime.settleExecution(exec, { isError: false })
    expect(runtime.learningSnapshot().confirmed['write|a.txt']).toBe(1)
  })
})

describe('snapshots', () => {
  it('is not overwritten by the terminal event', () => {
    const { runtime, dir, snapshotsDir } = setup()
    const file = join(dir, 'a.txt')
    writeFileSync(file, 'one\n', 'utf8')
    const exec: ToolExecutionLike = {
      name: 'edit',
      arguments: { file_path: file },
      sessionId: 's1',
      cwd: dir,
      callId: 'c1',
    }
    runtime.decideExecution(exec)
    // Snapshots are keyed by a synthetic ID in pendingAsks (no 'ask' event recorded).
    const pendingAsk = runtime.getPendingAsk('id:c1')
    expect(pendingAsk).toBeDefined()
    expect(pendingAsk!.snapshotId).toBeGreaterThan(0)
    const askId = pendingAsk!.snapshotId
    expect(loadEventSnapshots(snapshotsDir, askId).length).toBe(1)

    writeFileSync(file, 'two\n', 'utf8')
    runtime.settleAskOutcome('c1', 'allowed-once')
    expect(loadEventSnapshots(snapshotsDir, askId)[0]?.content).toBe('one\n')
  })
})
