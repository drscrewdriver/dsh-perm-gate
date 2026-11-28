import { describe, expect, it } from 'vitest'
import { DEFAULT_DENY_KEYWORDS } from '../src/deny-defaults.js'
import { PermGateRuntime } from '../src/runtime.js'

const EXEC = (command: string) => ({ name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1' })

describe('preset deny-keyword layer (inherited from dsh-approval-gate)', () => {
  it('applies the preset list when the namespace carries no override', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const decision = r.decideExecution(EXEC('rm -rf /work/build'))
    expect(decision?.kind).toBe('deny')
    expect(decision?.reason).toContain('rm -rf')
  })

  it('matches case-insensitively and inside longer command text', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(EXEC('git push --force origin main'))?.kind).toBe('deny')
    expect(r.decideExecution(EXEC('echo DROP TABLE users;'))?.kind).toBe('deny')
  })

  it('lets innocent calls through to the normal chain (defaultAction ask)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const decision = r.decideExecution(EXEC('npm install left-pad'))
    expect(decision?.kind).not.toBe('deny')
  })

  it('an explicit override replaces the preset (deny side stays additive: can deny, never widen)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywords: () => ['terraform destroy'] })
    expect(r.decideExecution(EXEC('rm -rf /work/build'))?.kind).not.toBe('deny')
    expect(r.decideExecution(EXEC('terraform destroy -auto-approve'))?.kind).toBe('deny')
  })

  it('an empty override is treated as unset and applies the preset (blacklist stays on)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywords: () => [] })
    expect(r.decideExecution(EXEC('rm -rf /work/build'))?.kind).toBe('deny')
  })

  /**
   * The point of this case is that a call without a visible command string is not
   * thereby unread: its arguments still describe the act. The tool used to be `edit`,
   * which issue #2 showed is wrong — a file tool's prose key is data, and vetoing it
   * made the model learn to reword documents to get past the gate. An unfamiliar tool
   * name keeps the original promise: the shape decides, the name does not.
   */
  it('also scans serialized arguments when there is no command text', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const decision = r.decideExecution({ name: 'pash', arguments: { note: 'please sudo rm the cache' }, sessionId: 's1' })
    expect(decision?.kind).toBe('deny')
  })

  /**
   * B6 wiring. The point of scanning decoded layers is the encoded blob, not the
   * plain one: `-EncodedCommand` is invisible to every keyword otherwise. The
   * payload chosen is one P0 does *not* deny (a force push to a non-protected
   * branch), so a deny here can only have come from this layer.
   */
  it('matches a keyword that only exists inside an encoded layer', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const blob = Buffer.from('git push --force origin feature/x', 'utf16le').toString('base64')
    const command = `powershell -EncodedCommand ${blob}`
    const decision = r.decideExecution({ name: 'pwsh', arguments: { command }, commandText: command, cwd: '/work', sessionId: 's1' })
    expect(decision?.kind).toBe('deny')
    expect(decision?.reason).toContain('push --force')
    // The reason names the keyword and never the decoded blob (no secret replay).
    expect(decision?.reason).not.toContain(blob)
  })

  it('does not treat base64 that is merely data, not input to an execution primitive, as an act', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const blob = Buffer.from('git push --force origin main').toString('base64')
    const decision = r.decideExecution({
      name: 'bash', arguments: { command: `git commit -m "stored payload ${blob}"` },
      commandText: `git commit -m "stored payload ${blob}"`, cwd: '/work', sessionId: 's1',
    })
    expect(decision?.kind).not.toBe('deny')
  })

  it('keeps the preset list non-empty and deny-shaped', () => {
    expect(DEFAULT_DENY_KEYWORDS.length).toBeGreaterThan(20)
    expect(DEFAULT_DENY_KEYWORDS).toContain('rm -rf')
    expect(DEFAULT_DENY_KEYWORDS).toContain('git reset --hard')
    expect(DEFAULT_DENY_KEYWORDS).toContain('docker system prune')
  })

  /**
   * S6 finding (cc-safety-net issue #368 family), kept as a regression mirror:
   * a python -c one-liner destroying a tree via shutil.rmtree carries none of
   * the shell keywords. The word-boundary layer CANNOT take this token —
   * `grep -R "shutil.rmtree" src/` (an ordinary code review) matches the exact
   * same scalar argument and would be denied (measured 2026-11-22; see
   * docs/cc-safety-net-parity-audit.md). Closing this gap needs an engine-side
   * interpreter-argument semantic screen, not a data token — the residual risk
   * rides the LLM grader / default ask as before.
   */
  it('documents the known interpreter-destruction gap (not keyword-fixable)', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    const oneLiner = `python -c "import shutil; shutil.rmtree('/work/cache')"`
    // The one-liner is NOT denied by the keyword layer (no token, by design).
    expect(r.decideExecution(EXEC(oneLiner))?.reason).not.toContain('deny-keyword')
    // And an innocent search of the same phrase is likewise untouched — the
    // property that makes the data-token approach unshippable.
    expect(r.decideExecution(EXEC(`grep -R "shutil.rmtree" src/`))?.kind).not.toBe('deny')
  })
})

const WRAPPER = (args: Record<string, unknown>) => ({ name: 'run_code', arguments: args, cwd: '/work', sessionId: 's1' })

/**
 * issue #11 — a code-mode wrapper (`run_code`) carries other tools' document text in its
 * `code` argument, so a deny-keyword hit on that prose was a false positive. `denyKeywordExemptTools`
 * skips ONLY the keyword layer for listed tools; the preset ships `run_code` so the fix is
 * visible on upgrade, and an explicit [] restores the old scan-everything behaviour.
 */
describe('denyKeywordExemptTools (issue #11)', () => {
  it('预置名单：run_code 的文档文本不再被关键词拦', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(WRAPPER({ code: 'grep "rm -rf" docs' }))?.kind).not.toBe('deny')
  })
  it('显式空名单恢复旧行为', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, denyKeywordExemptTools: [] })
    expect(r.decideExecution(WRAPPER({ code: 'grep "rm -rf" docs' }))?.kind).toBe('deny')
  })
  it('自定义名单可加减', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, denyKeywordExemptTools: ['my_wrapper'] })
    // run_code 不在自定义名单里 → 照旧被拦
    expect(r.decideExecution(WRAPPER({ code: 'grep "rm -rf" docs' }))?.kind).toBe('deny')
    // my_wrapper 被豁免
    expect(r.decideExecution({ name: 'my_wrapper', arguments: { code: 'grep "rm -rf" docs' }, cwd: '/work', sessionId: 's1' })?.kind).not.toBe('deny')
  })
  it('豁免只作用于关键词层：显式 deny: 规则对 run_code 仍拦', () => {
    // R3 / checklist “显式 deny 规则对豁免工具仍生效”: a rule-layer deny keyed on the
    // tool name must still veto run_code even though it is exempt from the keyword layer.
    // (P0 and the credential pre-screen key on real shell/file inputs, not a wrapper's
    // `code` prose, so they never fired on run_code bodies to begin with — the exemption
    // does not change them. The rule layer is the correct later-floor to prove.
    const r = new PermGateRuntime({
      rulesFile: undefined,
      readRulesDocument: () => ({
        defaultAction: 'ask',
        deny: [{ tools: ['run_code'], reason: 'rule floor' }],
        allow: [],
        ask: [],
      }) as never,
    })
    const decision = r.decideExecution(WRAPPER({ code: 'echo hello' }))
    expect(decision?.kind).toBe('deny')
    // The deny came from the rule floor, never the keyword layer (run_code is exempt there).
    expect(decision?.reason).not.toContain('deny-keyword')
  })
  it('普通执行工具照旧被拦', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(EXEC('rm -rf /work/build'))?.kind).toBe('deny')
  })
  it('热生效：reader 变化立即不同', () => {
    let list: readonly string[] | undefined = undefined
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywordExemptTools: () => list })
    // reader undefined → 回退预置 → run_code 豁免
    expect(r.decideExecution(WRAPPER({ code: 'grep "rm -rf" docs' }))?.kind).not.toBe('deny')
    // reader 显式 [] → 关闭豁免 → 回到旧行为
    list = []
    expect(r.decideExecution(WRAPPER({ code: 'grep "rm -rf" docs' }))?.kind).toBe('deny')
  })
})
