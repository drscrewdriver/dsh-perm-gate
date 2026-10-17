import { describe, expect, it } from 'vitest'
import { INTENT_ADVICE, composeReviewOpinion, intentForDeny, ruleIdOf } from '../src/feedback.js'

/**
 * The review opinion is what the main LLM reads when a call is blocked, so it must be
 * classified from the *reason the gate already produces* — the preset table's
 * `[deny-rule:<id>] …` strings and the deterministic layers' `[hard-deny]` /
 * `no rule matched` text. These cases use verbatim preset wording on purpose: a reason
 * reworded in the table that no longer classifies is the regression to catch here.
 */
describe('intentForDeny — classification from real gate reasons', () => {
  it.each([
    // an explicit safer alternative is offered → take it, do not retry the form
    ['git.reset-hard', '[deny-rule:git.reset-hard] Hard reset discards uncommitted changes. Use git reset --soft/--mixed, or git stash first.', 'use_alternative'],
    ['git.clean-force', '[deny-rule:git.clean-force] git clean permanently deletes untracked files. Dry-run first: git clean -nd.', 'use_alternative'],
    ['find.delete', '[deny-rule:find.delete] find -delete removes everything selected. Enumerate with plain find first.', 'use_alternative'],
    // the payload cannot be read at all → only a human can run it
    ['pwsh-non-literal', '[deny-rule:powershell.nested-recursive-delete-unread] A delete handed to pwsh/powershell in a non-literal form cannot be verified before it runs.', 'manual_only'],
    ['git.ssh-env', '[deny-rule:git.ssh-env] Git network ops with an SSH env override execute unanalyzable code.', 'manual_only'],
    ['git.alias-config', '[deny-rule:git.alias-config] Command-line Git aliases run arbitrary shell and cannot be analyzed.', 'manual_only'],
    ['git.push-delete', '[deny-rule:git.push-delete] Deleting remote refs is visible to collaborators and needs explicit consent.', 'manual_only'],
    // nothing recoverable and no alternative named → stop, do not negotiate
    ['dd', '[deny-rule:dd.device-write] dd writing to a block device destroys the disk.', 'hard_stop'],
    ['shred', '[deny-rule:shred.target] shred irreversibly destroys files (even --help/--version reach it).', 'hard_stop'],
    ['credential-store', '[hard-deny] mutation targets a credential store: C:/Users/u/.ssh/authorized_keys', 'hard_stop'],
    ['home-var', 'yolo: block [yolo-danger:irreversible-op] — [hard-deny] forced recursive deletion targets the profile root via a home variable', 'hard_stop'],
    // a YOLO block keeps the signal that fired: unreadable payload → hand it to the human
    ['yolo-opaque', 'yolo: block [yolo-danger:opaque-payload] — no rule matched; default action', 'manual_only'],
    ['yolo-model-risk', 'yolo: block [yolo-danger:model-risk.deletion] — no rule matched; default action', 'hard_stop'],
  ])('routes %s to its disposition', (_id, reason, intent) => {
    expect(intentForDeny(reason)).toBe(intent)
  })

  /**
   * A broad-but-recoverable action is the one case the agent may fix by itself: the
   * advice is to narrow the target, not to stop. Hard/irreversible wording must win
   * over the scope signal, or every destructive delete would read as "just narrow it".
   */
  it('sees a scope problem as scope_down, unless it is also irreversible', () => {
    expect(intentForDeny('deleting everything under a wildcard target, scope beyond the task')).toBe('scope_down')
    expect(intentForDeny('targets the whole directory and is unrecoverable')).toBe('hard_stop')
  })

  it('falls back to stop_and_explain for an unrecognized reason', () => {
    expect(intentForDeny('no rule matched; default action')).toBe('stop_and_explain')
  })
})

describe('ruleIdOf — the opinion names the layer that fired', () => {
  it('extracts the deny-rule id', () => {
    expect(ruleIdOf('[deny-rule:git.reset-hard] Hard reset discards uncommitted changes.')).toBe('deny-rule:git.reset-hard')
  })

  it('recognizes the P0 layer, the YOLO danger tag, and nothing else', () => {
    expect(ruleIdOf('[hard-deny] mutation targets protected path: /etc')).toBe('hard-deny')
    expect(ruleIdOf('yolo: block [yolo-danger:model-risk.deletion] — no rule matched')).toBe('yolo-danger:model-risk.deletion')
    expect(ruleIdOf('no rule matched; default action')).toBeUndefined()
  })
})

describe('composeReviewOpinion — one line the listener can deliver', () => {
  const reason = '[deny-rule:git.reset-hard] Hard reset discards uncommitted changes. Use git reset --soft/--mixed, or git stash first.'

  it('carries rule, reason and disposition, and strips the internal tag', () => {
    const out = composeReviewOpinion({ command: 'git reset --hard HEAD~3', reason, locale: 'zh' })
    expect(out.intent).toBe('use_alternative')
    expect(out.text).toContain('deny-rule:git.reset-hard')
    expect(out.text).toContain('Hard reset discards uncommitted changes')
    expect(out.text).toContain(INTENT_ADVICE.use_alternative.zh)
    // The `[deny-rule:…]` marker is gate plumbing; it must not ship twice.
    expect(out.text.match(/\[deny-rule:/g)).toBeNull()
    expect(out.text).not.toContain('[deny-rule:')
  })

  it('localizes to the requested locale', () => {
    const en = composeReviewOpinion({ command: 'git reset --hard', reason, locale: 'en' })
    expect(en.text.startsWith('Blocked.')).toBe(true)
    expect(en.text).toContain(INTENT_ADVICE.use_alternative.en)
    const zh = composeReviewOpinion({ command: 'git reset --hard', reason })
    expect(zh.text.startsWith('已拦截。')).toBe(true)
  })

  /**
   * The opinion is fed into the conversation as a *user* message. Whatever the reason
   * string carries, the line must not leak the raw tag syntax or an empty reason.
   */
  it('keeps a bare deterministic deny readable', () => {
    const out = composeReviewOpinion({
      command: 'pwsh -EncodedCommand ZQByAHIALQByAG0A',
      reason: '[hard-deny] mutation targets a credential store: C:/Users/u/.npmrc',
    })
    expect(out.intent).toBe('hard_stop')
    expect(out.text).toContain('hard-deny')
    expect(out.text).toContain('mutation targets a credential store')
  })

  /**
   * A YOLO block names *which* danger signal fired, and the internal tag syntax must
   * not survive into the message the main LLM reads.
   */
  it('names the YOLO danger signal without shipping the tag syntax', () => {
    const out = composeReviewOpinion({
      command: 'bash ./clean-home.sh',
      reason: 'yolo: block [yolo-danger:opaque-payload] — no rule matched; default action',
    })
    expect(out.intent).toBe('manual_only')
    expect(out.text).toContain('yolo-danger:opaque-payload')
    expect(out.text).toContain('no rule matched; default action')
    expect(out.text).not.toContain('[yolo-danger:')
  })
})
