import { describe, expect, it } from 'vitest'
import { CONTENT_ARG_KEYS, OPERATION_ARG_KEYS, keywordScanText, mergeScanKeys, operationText } from '../src/scan-text.js'
import { hardDenyReason } from '../src/engine.js'
import { PermGateRuntime } from '../src/runtime.js'

/**
 * One rule for which argument text a protective screen may read, shared by the P0
 * credential screen and the deny-keyword blacklist. GitHub issue #2 is the reason it
 * exists as a module: both layers kept a *denylist* of document-body keys, so every
 * body key the list had never heard of (`plan`, and next week `notes`) became a way to
 * refuse a call for describing work it was about to ask about.
 */
describe('operationText — tool class decides what counts as an operation', () => {
  const WORDS = 'please rm -rf the cache and git push --force'

  /** `plan` is the key that made the denylist obviously wrong. */
  it('skips plan and other document bodies for a document tool', () => {
    expect(operationText({ plan: WORDS }, 'exit_plan_mode')).toBe('')
    expect(CONTENT_ARG_KEYS.has('plan')).toBe(true)
    expect(operationText({ content: WORDS }, 'write')).toBe('')
  })

  /**
   * The structural half of the fix: an unknown prose key is not an operation either.
   * Enumerating body keys could never converge — `note`/`summary`/`rationale` are one
   * bug report each.
   */
  it('treats an unlisted key as prose for a non-executing tool', () => {
    for (const key of ['note', 'summary', 'description', 'rationale', 'steps']) {
      expect(operationText({ [key]: WORDS }, 'exit_plan_mode'), key).toBe('')
      expect(operationText({ [key]: WORDS }, 'todo_write'), key).toBe('')
    }
  })

  /** What such a tool *points at* is still its operation. */
  it('still reads commands, urls, target paths and queries for a non-executing tool', () => {
    expect(operationText({ file_path: 'C:/secrets/id_rsa' }, 'read')).toContain('id_rsa')
    expect(operationText({ url: 'https://x?token=sk-abcdefghijklmnop' }, 'web_search')).toContain('token')
    expect(operationText({ query: 'rm -rf / etc' }, 'web_search')).toContain('rm -rf')
    expect(operationText({ command: WORDS }, 'exit_plan_mode')).toContain('rm -rf')
    for (const key of ['command', 'url', 'path', 'file_path', 'query', 'pattern']) {
      expect(OPERATION_ARG_KEYS.has(key), key).toBe(true)
    }
  })

  /**
   * A name the gate does not know is an executor: the class rule must not become a way
   * to dodge a screen by calling the tool something unfamiliar.
   */
  it('keeps scanning everything non-body for executors and unknown names', () => {
    expect(operationText({ note: WORDS }, 'pash')).toContain('rm -rf')
    expect(operationText({ note: WORDS }, 'bash')).toContain('rm -rf')
    expect(operationText({ note: WORDS }, undefined)).toContain('rm -rf')
    // A body key is skipped even for an executor: a command tool carrying a document is
    // still carrying a document.
    expect(operationText({ content: WORDS }, 'bash')).toBe('')
  })

  it('walks nested bags under operation and container keys only', () => {
    expect(operationText({ params: { command: WORDS } }, 'exit_plan_mode')).toContain('rm -rf')
    expect(operationText({ payload: { note: WORDS } }, 'exit_plan_mode')).toBe('')
    expect(operationText({ payload: { note: WORDS } }, 'exec')).toContain('rm -rf')
  })

  it('collapses whitespace and folds the visible command first', () => {
    const text = keywordScanText('bash', { target: '/work' }, 'rm    -rf   /work/build')
    expect(text).toBe('rm -rf /work/build /work')
  })
})

describe('issue #2 end-to-end — a plan naming a step is not the step', () => {
  const PLAN = 'Plan: 1) delete the stale build cache with `rm -rf /work/build`; 2) git push --force origin feat/x after rebase.'

  /** Before the fix this was `deny` — the plan text hit the destructive blacklist. */
  it('does not refuse exit_plan_mode for describing the work it will ask about', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution({ name: 'exit_plan_mode', arguments: { plan: PLAN }, cwd: '/work', sessionId: 's1' }))
      .toBeUndefined()
  })

  /**
   * The refusal still happens where the act is real: the same words in a command the
   * tool will run. This is the half that must not regress while the prose half is
   * loosened — otherwise this fix is just a bypass.
   */
  it('still refuses the same command when a tool means to run it', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'rm -rf /work/build' }, cwd: '/work', sessionId: 's1' })?.kind)
      .toBe('deny')
    expect(r.decideExecution({ name: 'pash', arguments: { note: 'rm -rf /work/build' }, cwd: '/work', sessionId: 's1' })?.kind)
      .toBe('deny')
  })

  it('keeps a credential written into a document body out of P0, but not its path', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    // Quoting a private key inside a file the user asked for is a write, not a theft.
    expect(r.decideExecution({
      name: 'write',
      arguments: { file_path: 'notes/key-recovery.md', content: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnZzaA\n' },
      cwd: '/work',
      sessionId: 's1',
    })?.kind).not.toBe('deny')
    // Writing that key into an auth store is.
    expect(r.decideExecution({
      name: 'write',
      arguments: { file_path: 'C:/Users/u/.ssh/authorized_keys', content: 'ssh-ed25519 AAAA… user@host' },
      cwd: '/work',
      sessionId: 's1',
    })?.kind).toBe('deny')
  })
})

/**
 * The configurable half of the same rule: which keys count as prose and which as an
 * operation, on top of the built-in lists.
 *
 * Additive by construction, and the precedence is the contract — a key named in both lists
 * is an operation, because that is an explicit statement that the field's content gets
 * executed, and a heuristic must not outvote an author.
 */
describe('extraContentArgKeys / extraOperationArgKeys — additive key lists', () => {
  const RUN = 'please rm -rf the cache'
  const exec = (name: string, args: Record<string, unknown>) => ({ name, arguments: args, cwd: '/work', sessionId: 's1' })
  const gate = (content: string[] = [], operation: string[] = []) => new PermGateRuntime({
    rulesFile: undefined,
    readExtraContentArgKeys: () => content,
    readExtraOperationArgKeys: () => operation,
  })

  it('merges without replacing, and ignores blanks', () => {
    const keys = mergeScanKeys({ content: ['  ', 'steps'], operation: ['workflowYaml'] })
    expect(keys.content.has('content')).toBe(true)
    expect(keys.content.has('plan')).toBe(true)
    expect(keys.content.has('steps')).toBe(true)
    expect(keys.operation.has('command')).toBe(true)
    expect(keys.operation.has('workflowYaml')).toBe(true)
    // Nothing configured ⇒ the built-in objects themselves, no Set churn per call.
    expect(mergeScanKeys()).toBe(mergeScanKeys())
    expect(mergeScanKeys({ content: [], operation: undefined }).content).toBe(CONTENT_ARG_KEYS)
    expect(mergeScanKeys({ operation: [] }).operation).toBe(OPERATION_ARG_KEYS)
  })

  it('a declared prose key stops being scanned for an executor', () => {
    // Unknown names are executors: everything outside the prose list is read.
    expect(gate().decideExecution(exec('pash', { steps: RUN }))?.kind).toBe('deny')
    expect(gate(['steps']).decideExecution(exec('pash', { steps: RUN }))?.kind).not.toBe('deny')
    // …and the same text under a key that stays an operation is still refused.
    expect(gate(['steps']).decideExecution(exec('pash', { note: RUN }))?.kind).toBe('deny')
  })

  it('a declared operation key is scanned even for a document tool', () => {
    const call = exec('workflow', { workflowYaml: RUN })
    expect(gate().decideExecution(call)?.kind).not.toBe('deny')
    expect(gate([], ['workflowYaml']).decideExecution(call)?.kind).toBe('deny')
  })

  it('resolves a key named in both lists as an operation', () => {
    expect(operationText({ steps: RUN }, 'pash', { content: ['steps'] })).toBe('')
    expect(operationText({ steps: RUN }, 'pash', { content: ['steps'], operation: ['steps'] })).toContain('rm -rf')
  })

  /**
   * The invariant that makes these lists safe to expose: they steer the *flattened* text
   * only. The executed command and the mutated path are read by their own judgements, so
   * naming `command` or `file_path` prose cannot switch the gate off.
   */
  it('cannot be used to disarm the command or path judgements', () => {
    const disarmed = gate(['command', 'file_path', 'path', 'url'])
    expect(disarmed.decideExecution(exec('bash', { command: 'rm -rf /' }))?.kind).toBe('deny')
    expect(disarmed.decideExecution(exec('write', { file_path: 'C:/Users/u/.ssh/authorized_keys', content: 'ssh-rsa AAAA x' })))
      .toMatchObject({ kind: 'deny' })
    expect(disarmed.decideExecution(exec('bash', { command: 'diskpart /s x.txt' }))?.kind).toBe('deny')
  })

  it('routes the same policy through the P0 credential pre-screen', () => {
    const KEY_BODY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpA\n'
    expect(gate().decideExecution(exec('pash', { note: KEY_BODY }))?.kind).toBe('deny')
    expect(gate(['note']).decideExecution(exec('pash', { note: KEY_BODY }))?.kind).not.toBe('deny')
  })

  it('applies on the next call, without a reload', () => {
    let prose: string[] = []
    const r = new PermGateRuntime({ rulesFile: undefined, readExtraContentArgKeys: () => prose })
    const call = exec('pash', { steps: RUN })
    expect(r.decideExecution(call)?.kind).toBe('deny')
    prose = ['steps']
    expect(r.decideExecution(call)?.kind).not.toBe('deny')
  })

  it('walks declared operation keys through nested bags and array elements', () => {
    expect(operationText({ params: { workflowYaml: RUN } }, 'workflow', { operation: ['workflowYaml'] }))
      .toContain('rm -rf')
    expect(operationText({ notes: [RUN] }, 'pash', { content: ['notes'] })).toBe('')
    // An undeclared key under a document tool stays prose even when nested.
    expect(operationText({ payload: { steps: RUN } }, 'workflow')).toBe('')
  })

  it('leaves the built-in behaviour untouched when nothing is configured', () => {
    expect(keywordScanText('exit_plan_mode', { plan: RUN })).toBe('')
    expect(keywordScanText('bash', { command: 'echo hi' }, 'echo hi')).toBe('echo hi echo hi')
    expect(keywordScanText('pash', { steps: RUN })).toContain('rm -rf')
  })

  /**
   * These lists come out of the host settings namespace, which has been observed to
   * deliver an object where an array belongs (the `allowlist: {}` passthrough). Junk
   * must degrade to "nothing declared" — a scan rule that throws takes the whole gate
   * down with it, and a scan rule that reads a `{}` as keys would widen.
   */
  it.each([
    ['an object', {}],
    ['null', null],
    ['a string', 'steps'],
    ['an array with junk', ['steps', 42, null, '']],
  ])('tolerates a malformed value (%s)', (_label, value) => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      readExtraContentArgKeys: () => value as never,
      readExtraOperationArgKeys: () => value as never,
    })
    const call = { name: 'pash', arguments: { steps: RUN }, cwd: '/work', sessionId: 's1' }
    expect(() => r.decideExecution(call)).not.toThrow()
    // Only the well-formed string survived the filter.
    const declared = r.decideExecution(call)?.kind
    expect(declared === 'deny' || declared === undefined).toBe(true)
    expect(r.decideExecution({ name: 'pash', arguments: { note: RUN }, cwd: '/work', sessionId: 's1' })?.kind).toBe('deny')
  })

  it('applies from static config too, for an embedder with no settings namespace', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, extraContentArgKeys: ['steps'] })
    expect(r.decideExecution({ name: 'pash', arguments: { steps: RUN }, cwd: '/work', sessionId: 's1' })?.kind).not.toBe('deny')
  })

  /** The context field is public: an embedder or a dry run must be able to set it alone. */
  it('is honoured by the engine when handed straight to hardDenyReason', () => {
    const KEY_BODY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpA\n'
    const base = { tool: 'pash', args: { note: KEY_BODY }, cwd: '/work' }
    expect(hardDenyReason(base as never)).toContain('credential')
    expect(hardDenyReason({ ...base, scanKeys: { content: ['note'] } } as never)).toBeUndefined()
    expect(hardDenyReason({ ...base, tool: 'exit_plan_mode', scanKeys: { operation: ['note'] } } as never))
      .toContain('credential')
  })
})
