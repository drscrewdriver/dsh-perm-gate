import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { askDoubtKinds, buildAskContext, humanCardLine, toGraderPayload, type AskContext } from '../src/ask-context.js'
import { readScriptContents, scriptRefs } from '../src/script-review.js'
import { PermGateRuntime } from '../src/runtime.js'
import type { RiskRequest } from '../src/risk.js'
import { makePreExecuteListener } from '../src/index.js'
import type { PreToolDecisionLike, ToolExecutionLike } from '../src/runtime.js'

const dirs: string[] = []
function tmp(): string {
  const dir = join(tmpdir(), `perm-gate-attach-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Build the context the way the runtime does: read the named scripts, then freeze. */
function ctxFor(command: string, cwd: string, extra: Record<string, unknown> = {}): AskContext {
  const refs = scriptRefs(command)
  const contents = refs.length === 0 ? [] : readScriptContents(refs, cwd)
  return buildAskContext({
    tool: 'bash',
    args: { command },
    commandText: command,
    cwd,
    workspaceRoot: cwd,
    ruleReason: 'no rule matched; default action',
    scriptContents: contents,
    scriptsCovered: refs.length > 0 && contents.every((c) => c.unreadable === undefined && c.body !== ''),
    ...extra,
  })
}

const WIPE_BODY = '#!/bin/bash\n# 释放空间：清理用户目录隐藏文件\nfor f in ~/.*; do\n  rm -rf "$f"\ndone\n'
const BENIGN_BODY = '#!/bin/bash\necho building\nnpm run build\n'

describe('script bodies change what the gate can see', () => {
  /**
   * The incident, in the shape it really had: `bash ./clean-home.sh` is a filename and
   * says nothing, while the file wipes every dotfile in the profile. With the body
   * attached the deterministic net grades the code itself, so the call is `I` — the tier
   * a grader `safe` cannot clear.
   */
  it('judges a destructive script body as irreversible', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'clean-home.sh'), WIPE_BODY)
    const ctx = ctxFor('bash ./clean-home.sh', dir)
    expect(ctx.irreversible).toBe(true)
    expect(ctx.reversibility).toBe('I')
  })

  it('leaves a benign script body benign', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'build.sh'), BENIGN_BODY)
    const ctx = ctxFor('bash ./build.sh', dir)
    expect(ctx.irreversible).toBe(false)
    expect(ctx.reversibility).not.toBe('I')
  })

  /**
   * The `U` tier existed because nobody could read a script from outside the workspace.
   * Once the file *has* been read, "unknowable" would be a lie: the payload is visible
   * and the verdict is about its content.
   */
  it('lifts an out-of-workspace script out of the opaque tier when its body is read', () => {
    // Two separate directories: one is the workspace, the other is genuinely outside it
    // (the tier depends on that relation, so a path inside the tmp root proves nothing).
    const ws = tmp()
    const other = tmp()
    writeFileSync(join(other, 'tool.sh'), BENIGN_BODY)
    const read = ctxFor(`bash ${join(other, 'tool.sh')}`, ws)
    expect(read.targetResolvable).toBe(true)
    expect(askDoubtKinds(read)).not.toContain('opaque')
    expect(askDoubtKinds(read)).toContain('script-attached')
    expect(humanCardLine(read)).toContain('scripts=1:body-attached')

    // The same call with the file gone: nothing was seen, so the call is unknowable.
    const unread = ctxFor(`bash ${join(other, 'gone.sh')}`, ws)
    expect(unread.targetResolvable).toBe(false)
    expect(unread.reversibility).toBe('U')
    expect(askDoubtKinds(unread)).toContain('opaque')
    expect(askDoubtKinds(unread)).toContain('script-unreadable')
  })

  /**
   * A block is one act: the loop header names the sweep target and its body carries the
   * delete, and neither line alone is irreversible.
   */
  it('catches a destructive loop written across lines', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'sweep.sh'), WIPE_BODY)
    const ctx = ctxFor('bash ./sweep.sh', dir)
    expect(ctx.irreversible).toBe(true)
  })

  /**
   * …while unrelated statements that merely sit next to each other do not collide: the
   * join is keyed on a continuation marker, so `cd "$HOME"` cannot donate its home token
   * to the `rm -rf ./node_modules` on the following line.
   */
  it('does not collide unrelated statements in a real build script', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'setup.sh'), '#!/bin/bash\ncd "$HOME"\nnpm ci\nrm -rf ./node_modules\nnpx vite build\n')
    const ctx = ctxFor('bash ./setup.sh', dir)
    expect(ctx.irreversible).toBe(false)
    expect(ctx.reversibility).not.toBe('I')
  })

  it('redacts and bounds the body before it leaves the host', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'deploy.sh'), `#!/bin/bash\nexport TOKEN=AKIAIOSFODNN7EXAMPLE\necho deploying ${'x'.repeat(30_000)}\n`)
    const payload = toGraderPayload(ctxFor('bash ./deploy.sh', dir))
    const body = payload.script_contents?.[0]?.body ?? ''
    expect(body).not.toContain('AKIAIOSFODNN7EXAMPLE')
    expect(payload.script_contents?.[0]?.truncated).toBe(true)
    expect(body.length).toBeLessThan(30_000)
  })

  it('attaches nothing when the call names no script', () => {
    const payload = toGraderPayload(ctxFor('npm install left-pad', tmp()))
    expect(payload.script_contents).toBeUndefined()
  })
})

describe('the runtime puts the body in front of the reviewer it does have', () => {
  function exec(command: string, cwd: string): ToolExecutionLike {
    return { name: 'bash', arguments: { command }, cwd, sessionId: 's1' } as ToolExecutionLike
  }

  it('sends script_contents to the grader', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'clean-home.sh'), WIPE_BODY)
    const seen: RiskRequest[] = []
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async (req) => {
        seen.push(req as RiskRequest)
        return { kind: 'safe' }
      },
    })
    const e = exec(`bash ${join(dir, 'clean-home.sh')}`, dir)
    const ask = r.decideExecution(e)
    expect(ask?.kind).toBe('ask')
    // The I-tier veto fires *before* the model answer is acted on, but the request is
    // still what the grader was shown — including the body.
    await r.refineAsk(e, ask as never)
    expect(seen[0]?.scriptContents?.[0]?.body).toContain('rm -rf')
  })

  /**
   * The regression the feature exists to prevent: an over-confident `safe` clearing a
   * script that wipes the profile. The body makes the act deterministic, and a
   * deterministic `I` is a veto over the model.
   */
  it('keeps asking when the grader calls a wiping script safe', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'clean-home.sh'), WIPE_BODY)
    const r = new PermGateRuntime({
      rulesFile: undefined,
      permissive: true,
      permissiveStrategies: { llmAssist: true },
      riskHook: async () => ({ kind: 'safe' }),
    })
    const e = exec(`bash ${join(dir, 'clean-home.sh')}`, dir)
    const out = await r.refineAsk(e, r.decideExecution(e) as never)
    expect(out?.kind).toBe('ask')
    expect(out?.reason).toMatch(/irreversible by rule/)
  })

  /** With no human either (YOLO), the same body is a block, not a pass. */
  it('blocks a wiping script in YOLO mode', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'clean-home.sh'), WIPE_BODY)
    const r = new PermGateRuntime({ rulesFile: undefined, yolo: true })
    const seen: PreToolDecisionLike[] = []
    const listener = makePreExecuteListener(r, (_exec, decision) => { seen.push(decision) })
    const out = await listener(exec(`bash ${join(dir, 'clean-home.sh')}`, dir), async () => 'RAN')
    expect((out as PreToolDecisionLike).kind).toBe('deny')
    expect(seen[0]?.reason).toContain('yolo-danger')
  })

  it('can be switched off, and then a body is not read', () => {
    const off = new PermGateRuntime({ rulesFile: undefined, scriptReview: false })
    expect(off.isScriptReview()).toBe(false)
    expect(new PermGateRuntime({ rulesFile: undefined }).isScriptReview()).toBe(true)
    expect(new PermGateRuntime({ rulesFile: undefined, readScriptReview: () => false }).isScriptReview()).toBe(false)
  })
})
