import { describe, expect, it } from 'vitest'
import { CONTENT_ARG_KEYS, OPERATION_ARG_KEYS, keywordScanText, operationText } from '../src/scan-text.js'
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
