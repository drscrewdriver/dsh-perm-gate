import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildAskContext } from '../src/ask-context.js'
import { PermGateRuntime } from '../src/runtime.js'
import type { ToolExecutionLike } from '../src/runtime.js'
import { pathsRealInsideWorkspace } from '../src/workspace-bound.js'

const RULES = undefined // no rules file: everything defaults to ask

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-yolo-exempt-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

interface ExecOpts {
  readonly command?: string
  readonly args?: Record<string, unknown>
  readonly tool?: string
  readonly preset?: string
  readonly files?: readonly string[]
  readonly scriptContents?: readonly { ref: string, path: string, body?: string, truncated?: boolean, unreadable?: string }[]
  readonly scriptsCovered?: boolean
  readonly cwd?: string
}

function toolCall(opts: ExecOpts = {}): ToolExecutionLike {
  const preset = opts.preset ?? 'permissive-yolo'
  return {
    name: opts.tool ?? 'bash',
    arguments: opts.args ?? (opts.command === undefined ? {} : { command: opts.command }),
    ...(opts.command === undefined ? {} : { commandText: opts.command }),
    cwd: opts.cwd ?? '/work',
    sessionId: 's1',
    events: [{ type: 'permission/preset', data: { preset } }],
    ...(opts.files === undefined ? {} : { files: opts.files }),
    ...(opts.scriptContents === undefined ? {} : { scriptContents: opts.scriptContents }),
    ...(opts.scriptsCovered === undefined ? {} : { scriptsCovered: opts.scriptsCovered }),
  } as unknown as ToolExecutionLike
}

function runtime(exempt: boolean | (() => boolean), hookedRisk?: () => Promise<{ kind: 'safe' } | { kind: 'risky', category: string }>): PermGateRuntime {
  return new PermGateRuntime({
    rulesFile: RULES,
    yolo: true,
    ...(typeof exempt === 'boolean' ? { yoloWorkspaceExempt: exempt } : { readYoloWorkspaceExempt: exempt }),
    ...(hookedRisk === undefined ? {} : { riskHook: async () => hookedRisk() as never }),
  })
}

/** The verdict tag of the last recorded event, for the exempt / no-reviewer distinction. */
function lastVerdict(r: PermGateRuntime): string | undefined {
  const entry = r.auditEntries.at(-1)
  return entry === undefined ? undefined : entry.reason
}

describe('yoloWorkspaceExempt — location opacity is relaxed, never content', () => {
  it('a no-argument tool call is allowed once the switch is on, and labelled', async () => {
    const r = runtime(true)
    const e = toolCall({ tool: 'working_directory', args: {} })
    const ask = r.decideExecution(e)
    expect(await r.resolveYolo(e, ask as never)).toBeUndefined()
    expect(r.auditEntries.at(-1)?.outcome).toBe('allow')
    expect(lastVerdict(r)).toContain('[exempt:opaque-location]')
  })

  it('a script outside the workspace whose body was never read is allowed once on', async () => {
    const r = runtime(true)
    const e = toolCall({ command: 'bash /tmp/deploy.sh' })
    const ask = r.decideExecution(e)
    expect(ask?.kind).toBe('ask')
    expect(await r.resolveYolo(e, ask as never)).toBeUndefined()
    expect(lastVerdict(r)).toContain('[exempt:opaque-location]')
  })

  it('with the switch off both of the above are still blocked as opaque', async () => {
    const off = runtime(false)
    const noArgs = toolCall({ tool: 'working_directory', args: {} })
    expect((await off.resolveYolo(noArgs, off.decideExecution(noArgs) as never))?.kind).toBe('deny')
    const script = toolCall({ command: 'bash /tmp/deploy.sh' })
    expect((await off.resolveYolo(script, off.decideExecution(script) as never))?.kind).toBe('deny')
  })

  it('readable content is still blocked even with the switch on (encoded payload)', async () => {
    const r = runtime(true)
    const e = toolCall({ command: 'pwsh -EncodedCommand UgBlAG0AbwB2AGUALQBJAHQAZQBtACAALQBSAGUAYwB1AHIAcwBlACAALQBGAG8AcgBjAGUAIABDADoAXAA=' })
    expect((await r.resolveYolo(e, r.decideExecution(e) as never))?.kind).toBe('deny')
  })

  it('a script body that could not be read is still blocked, switch on or off', async () => {
    // A real 600 KB script outside the workspace: script-review labels it `too-large` and
    // attaches no body, so the chain must treat it as consequence opacity, not location.
    const ws = tmpDir()
    const other = tmpDir()
    const big = join(other, 'big.sh')
    writeFileSync(big, 'echo x\n'.repeat(100_000))

    for (const on of [false, true]) {
      const r = runtime(on)
      const e = toolCall({ command: `bash ${big}`, cwd: ws })
      const blocked = await r.resolveYolo(e, r.decideExecution(e) as never)
      expect(blocked?.kind).toBe('deny')
      expect(r.auditEntries.at(-1)?.reason ?? '').not.toContain('[exempt:opaque-location]')
    }
  })

  it('a workspace-internal script whose body could not be read is still blocked', async () => {
    // The plan's consequence rule has to hold inside the workspace too: a 600 KB script is
    // invisible code, and "invisible" must not be filed under "location unknown".
    const ws = tmpDir()
    writeFileSync(join(ws, 'big.sh'), 'echo x\n'.repeat(100_000))

    for (const on of [false, true]) {
      const r = runtime(on)
      const e = toolCall({ command: 'bash ./big.sh', cwd: ws })
      const blocked = await r.resolveYolo(e, r.decideExecution(e) as never)
      expect(blocked?.kind).toBe('deny')
      expect(r.auditEntries.at(-1)?.reason ?? '').not.toContain('[exempt:opaque-location]')
    }
  })

  it('prose that names no program stays a consequence block', async () => {
    const r = runtime(true)
    const e = toolCall({ command: '把测试数据库清了重新导数据，别问' })
    expect((await r.resolveYolo(e, r.decideExecution(e) as never))?.kind).toBe('deny')
  })
})

describe('yoloWorkspaceExempt — labels and reviewer interplay', () => {
  it('marks the no-reviewer variant when nobody answers', async () => {
    const r = runtime(true) // no riskHook → classifier unusable
    const e = toolCall({ tool: 'working_directory', args: {} })
    expect(await r.resolveYolo(e, r.decideExecution(e) as never)).toBeUndefined()
    const entry = r.auditEntries.at(-1)
    expect(entry?.outcome).toBe('allow')
    // The audit line records both the exemption and the missing reviewer.
    expect(entry?.reason).toContain('[exempt:opaque-location]')
    expect(entry?.reason).toContain('no reviewer answered')
  })

  it('records the exempt verdict in the decision event feed', async () => {
    const dir = tmpDir()
    const r = new PermGateRuntime({
      rulesFile: RULES,
      yolo: true,
      yoloWorkspaceExempt: true,
      eventsFile: join(dir, 'events.jsonl'),
    })
    const e = toolCall({ tool: 'working_directory', args: {} })
    expect(await r.resolveYolo(e, r.decideExecution(e) as never)).toBeUndefined()
    const raw = readFileSync(join(dir, 'events.jsonl'), 'utf8')
    expect(raw).toContain('yolo-allow-opaque-location-exempt-no-reviewer')
  })

  it('reads the switch live, so a settings edit applies to the next call', async () => {
    let on = false
    const r = runtime(() => on)
    const first = toolCall({ tool: 'working_directory', args: {} })
    expect((await r.resolveYolo(first, r.decideExecution(first) as never))?.kind).toBe('deny')
    on = true
    const second = toolCall({ tool: 'working_directory', args: {} })
    expect(await r.resolveYolo(second, r.decideExecution(second) as never)).toBeUndefined()
  })
})

describe('yoloWorkspaceExempt — scope isolation', () => {
  it('does nothing outside the yolo preset', async () => {
    const r = runtime(true, async () => ({ kind: 'risky', category: 'neutral' }))
    const e = toolCall({ tool: 'working_directory', args: {}, preset: 'permissive' })
    const ask = r.decideExecution(e)
    // Not the yolo tier: the ordinary ask pipeline runs, and an opaque payload still forces
    // the human ask even when the grader would call it neutral (the veto in refineAsk).
    expect(ask?.kind).toBe('ask')
    expect((await r.refineAsk(e, ask as never))?.kind).toBe('ask')
    expect(r.auditEntries.at(-1)?.reason ?? '').not.toContain('[exempt:opaque-location]')
  })

  it('an ordinary workspace write is unaffected by the switch', async () => {
    for (const on of [false, true]) {
      const r = runtime(on)
      const e = toolCall({ command: 'echo hi > out.txt' })
      expect(await r.resolveYolo(e, r.decideExecution(e) as never)).toBeUndefined()
      expect(lastVerdict(r) ?? '').not.toContain('[exempt:opaque-location]')
    }
  })
})

describe('yoloWorkspaceExempt — the deterministic floor is never exempted', () => {
  it('a recursive delete above the workspace is denied before YOLO runs', () => {
    const r = runtime(true)
    const e = toolCall({ command: 'cd .. && rm -rf ./x' })
    expect(r.decideExecution(e)?.kind).toBe('deny')
  })

  it('a variable-spelled profile-root delete stays denied', () => {
    const r = runtime(true)
    const e = toolCall({ command: '$home = "$env:TEMP\\x"; Remove-Item $home -Recurse -Force' })
    expect(r.decideExecution(e)?.kind).toBe('deny')
  })

  it('credential reads stay on the ask rung (never auto-allowed)', async () => {
    const outcomes: (string | undefined)[] = []
    for (const on of [false, true]) {
      const r = runtime(on)
      const e = toolCall({ command: 'cat ~/.ssh/id_rsa' })
      expect(r.decideExecution(e)?.kind).toBe('ask')
      outcomes.push((await r.resolveYolo(e, r.decideExecution(e) as never))?.kind)
    }
    // Whatever the yolo tier does with a credential ask is pre-existing behaviour; the point
    // here is that the exemption must not change it in either direction.
    expect(outcomes[0]).toBe(outcomes[1])
  })

  it('a forced push to a protected branch stays denied', () => {
    const r = runtime(true)
    const e = toolCall({ command: 'git push --force origin main' })
    expect(r.decideExecution(e)?.kind).toBe('deny')
  })
})

describe('pathsRealInsideWorkspace — links are resolved before a screen is relaxed', () => {
  it('an empty list is inside, a missing root is not', () => {
    expect(pathsRealInsideWorkspace('/work', [])).toBe(true)
    expect(pathsRealInsideWorkspace(undefined, [])).toBe(false)
    expect(pathsRealInsideWorkspace('', ['x'])).toBe(false)
  })

  it('accepts an existing file inside and rejects one outside', () => {
    const ws = tmpDir()
    const other = tmpDir()
    writeFileSync(join(ws, 'in.txt'), 'x')
    writeFileSync(join(other, 'out.txt'), 'x')
    expect(pathsRealInsideWorkspace(ws, ['in.txt'])).toBe(true)
    expect(pathsRealInsideWorkspace(ws, ['in.txt', join(other, 'out.txt')])).toBe(false)
  })

  it('a path that cannot be resolved is refused', () => {
    const ws = tmpDir()
    expect(pathsRealInsideWorkspace(ws, ['not-there.txt'])).toBe(false)
  })

  it('a link inside the workspace pointing outside is rejected', () => {
    const ws = tmpDir()
    const outside = tmpDir()
    writeFileSync(join(outside, 'a.txt'), 'x')
    const linkDir = join(ws, 'outdir')
    try {
      // A directory junction works without elevation on Windows; elsewhere this is a
      // plain symlink and the type argument is ignored.
      symlinkSync(outside, linkDir, 'junction')
    } catch {
      return // host refuses link creation: the lexical test above still covers the rest
    }
    expect(pathsRealInsideWorkspace(ws, [join(linkDir, 'a.txt')])).toBe(false)
  })
})

describe('ask-context facts — opaqueKind and workspaceBound', () => {
  const base = { tool: 'bash', cwd: '/work', workspaceRoot: '/work' }

  it('a no-argument call is a location opacity that stays inside the workspace', () => {
    const ctx = buildAskContext({ ...base, tool: 'working_directory', args: {} })
    expect(ctx.targetResolvable).toBe(false)
    expect(ctx.opaqueKind).toBe('location')
    expect(ctx.workspaceBound).toBe(true)
  })

  it('a script outside the workspace with no body attached is a location opacity', () => {
    const ctx = buildAskContext({ ...base, commandText: 'bash /tmp/deploy.sh' })
    expect(ctx.targetResolvable).toBe(false)
    expect(ctx.opaqueKind).toBe('location')
  })

  it('an unreadable script body is a consequence, never a location', () => {
    const ctx = buildAskContext({
      ...base,
      commandText: 'bash /tmp/deploy.sh',
      scriptContents: [{ ref: 'deploy.sh', path: '/tmp/deploy.sh', unreadable: 'too-large' }],
      scriptsCovered: false,
    })
    expect(ctx.targetResolvable).toBe(false)
    expect(ctx.opaqueKind).toBe('consequence')
  })

  it('an encoded payload is a consequence', () => {
    const ctx = buildAskContext({ ...base, commandText: 'pwsh -EncodedCommand AAECAwQFBgcICQoLDA0ODw==' })
    expect(ctx.opaqueKind).toBe('consequence')
  })

  it('an unreadable script body inside the workspace is a consequence', () => {
    const ctx = buildAskContext({
      ...base,
      commandText: 'bash ./big.sh',
      scriptContents: [{ ref: 'big.sh', path: '/work/big.sh', unreadable: 'too-large' }],
      scriptsCovered: false,
    })
    expect(ctx.targetResolvable).toBe(false)
    expect(ctx.opaqueKind).toBe('consequence')
  })

  it('files outside the workspace make the call not workspace-bound', () => {
    const ctx = buildAskContext({ ...base, tool: 'working_directory', args: {}, files: ['/etc/passwd'] })
    expect(ctx.workspaceBound).toBe(false)
  })

  it('a sibling directory sharing the prefix is not inside', () => {
    // `/work2/x` must not be accepted as `/work`: the check requires a path separator.
    const ctx = buildAskContext({ ...base, tool: 'working_directory', args: {}, files: ['/work2/x'] })
    expect(ctx.workspaceBound).toBe(false)
  })
})
