/**
 * Preset deny table (cc-safety-net port) — table shape, per-rule example
 * hits, whitelist non-disturbance, and one-shot seed semantics.
 *
 * Every example string is the cc rule's own `example` (or its closest form
 * this plugin's glob vocabulary can express — deviations are documented in
 * preset-rules.ts). The whitelist block is the disturbance mirror: everyday
 * commands must not touch ANY preset entry (A3 lesson: measure before ship).
 */
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { compileDocument } from '../src/rule.js'
import { decideRules, type ToolCallContext } from '../src/evaluate.js'
import {
  PRESET_RULES_YAML,
  parsePresetDoc,
  presetRuleIds,
  presetRuleId,
  mergePresetIntoRaw,
  ensurePresetRulesFile,
} from '../src/preset-rules.js'

const RULESET = compileDocument(parsePresetDoc(), { maxGlobStars: 2, caseInsensitivePaths: true })

function shell(command: string): ToolCallContext {
  return { tool: 'shell', args: { command }, commandText: command, cwd: process.cwd() }
}

function toolCall(tool: string, args: Record<string, unknown>): ToolCallContext {
  return { tool, args, cwd: process.cwd() }
}

function verdict(command: string) {
  return decideRules(RULESET, shell(command))
}

describe('preset table — document shape', () => {
  it('parses and compiles with defaultAction ask (never widens, never loosens)', () => {
    expect(RULESET.defaultAction).toBe('ask')
    expect(RULESET.deny.length).toBeGreaterThan(40)
    expect(RULESET.ask.length).toBeGreaterThan(6)
  })

  it('tags every entry with a unique [deny-rule:<id>]', () => {
    const ids = presetRuleIds()
    expect(ids.length).toBeGreaterThan(40)
    expect(ids.every((id) => id !== '')).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('exposes the YAML as the single source (round-trips through the file parser)', () => {
    const doc = parsePresetDoc()
    expect(doc.deny.length + doc.ask.length).toBe(presetRuleIds().length)
    expect(PRESET_RULES_YAML).toContain('[deny-rule:git.reset-hard]')
  })
})

const DENY_CASES: readonly (readonly [string, string])[] = [
  ['git reset --hard', 'git.reset-hard'],
  // N1 regression: the guarded segment hides behind the join without per-segment matching.
  ['cd repo && git reset --hard HEAD', 'git.reset-hard'],
  ['git reset --merge', 'git.reset-merge'],
  ['git clean -fd', 'git.clean-force'],
  ['git push --delete origin old-branch', 'git.push-delete'],
  ['git push --mirror origin', 'git.push-mirror'],
  ['git branch -D old-branch', 'git.branch-force-delete'],
  ['git stash drop stash@{0}', 'git.stash-drop'],
  ['git stash clear', 'git.stash-clear'],
  ['git tag -d v1.0.0', 'git.tag-delete'],
  ['git reflog expire --expire=now --all', 'git.reflog-delete'],
  ['git rebase --abort', 'git.rebase-abort'],
  ['git merge --abort', 'git.merge-abort'],
  ['git rm -rf .', 'git.rm-force'],
  ['git checkout --force main', 'git.checkout-force'],
  ['git checkout -f main', 'git.checkout-force'],
  ['git checkout -- src/app.ts', 'git.checkout-double-dash'],
  ['git checkout HEAD -- src/app.ts', 'git.checkout-ref-path'],
  ['git checkout --pathspec-from-file=paths.txt', 'git.checkout-pathspec-from-file'],
  ['git switch --discard-changes main', 'git.switch-discard-changes'],
  ['git switch -f main', 'git.switch-force'],
  ['git restore --worktree src/app.ts', 'git.restore-worktree'],
  ['git worktree remove --force ../feature', 'git.worktree-remove-force'],
  ["git -c alias.wipe='!rm -rf /' wipe", 'git.alias-config'],
  ['GIT_SSH_COMMAND=./ssh-wrapper git push', 'git.ssh-env'],
  ['rm -rf .git', 'rm.git-metadata'],
  ['rm -rf /home/user/repo/.git', 'rm.git-metadata'],
  ['find . -delete', 'find.delete'],
  ['find .git -delete', 'find.delete-git-metadata'],
  ['find . -exec rm -rf {} +', 'find.exec-rm-recursive-force'],
  ['rsync -a --delete ./src/ ./dst/', 'rsync.delete'],
  ['rsync --delete-after ./src/ ./dst/', 'rsync.delete'],
  ['dd if=/dev/zero of=/dev/sda', 'dd.device-write'],
  ['mkfs.ext4 /dev/sda1', 'mkfs.device'],
  ['wipefs -a /dev/sda1', 'disk.erase'],
  ['shred -u secret.txt', 'shred.target'],
  ['cat disk.img > /dev/sda', 'redirect.block-device'],
  ['Remove-Item .git -Recurse -Force', 'powershell.remove-item-git-metadata'],
  ['Remove-Item . -Recurse -Force', 'powershell.remove-item-recursive-force-cwd-self'],
  ['powershell -ep bypass Remove-Item -Recurse -Force build', 'powershell.nested-recursive-delete-unread'],
  ['rmdir /s /q .git', 'cmd.recursive-delete-git-metadata'],
  ['echo TOKEN=x > .env', 'secret.write-overwrite-env'],
  ['rm -rf ~/.ssh', 'secret.delete-credential-path'],
]

describe.each(DENY_CASES)('deny example %s', (command, id) => {
  it(`is denied and tagged ${id}`, () => {
    const v = verdict(command)
    expect(v.action).toBe('deny')
    expect(presetRuleId(v.reason)).toBe(id)
  })
})

const ASK_CASES: readonly (readonly [string, string])[] = [
  ['git push --force origin main', 'git.push-force'],
  // Accepted adjacency (user ruling 2026-10-13): the lease form shares the ask.
  ['git push --force-with-lease origin main', 'git.push-force'],
  ['rm -rf "$target"', 'rm.recursive-force-dynamic-target'],
  ['find . -name x.log | xargs rm -rf', 'xargs.rm-recursive-force-dynamic'],
  ['parallel rm -rf ::: dir', 'parallel.rm-recursive-force-dynamic'],
  ['awk "BEGIN{system(\\"id\\")}"', 'awk.system-dynamic'],
  ['cmd /c rmdir /s /q build', 'cmd.recursive-delete-nested'],
  ['cat .env', 'secret.read-credential-file'],
  ['ls ~/.aws', 'secret.read-home-credential-dirs'],
]

describe.each(ASK_CASES)('ask example %s', (command, id) => {
  it(`escalates with tag ${id}`, () => {
    const v = verdict(command)
    expect(v.action).toBe('ask')
    expect(presetRuleId(v.reason)).toBe(id)
  })
})

describe('self-protection entry', () => {
  it('asks when an edit tool targets the gate rules file', () => {
    const v = decideRules(RULESET, toolCall('edit', { file_path: '/home/u/.dsh/perm-gate/rules.yml' }))
    expect(v.action).toBe('ask')
    expect(presetRuleId(v.reason)).toBe('gate.self-protection')
  })
})

// cred.* rows: the READ-tool side of the family ladder (the shell side stays on
// secret.* rows). One hit per family proves the row compiles and tags; the
// whitelist block below proves it does not eat ordinary reads.
const CRED_ASK_CASES: readonly (readonly [string, string])[] = [
  ['/home/u/.ssh/id_ed25519', 'cred.ssh'],
  ['/home/u/.aws/credentials', 'cred.cloud'],
  ['/home/u/.npmrc', 'cred.package'],
  ['/home/u/.git-credentials', 'cred.gitcreds'],
  ['E:/proj/config/.env.production', 'cred.env'],
  ['/home/u/.claude/settings.json', 'cred.cli'],
  ['/home/u/.pgpass', 'cred.db'],
]

describe('cred family rows — file-tool reads are named per family', () => {
  it.each(CRED_ASK_CASES)('read %s asks with tag %s', (file_path, id) => {
    const v = decideRules(RULESET, { tool: 'read', args: { file_path }, cwd: 'E:/proj' })
    expect(v.action).toBe('ask')
    expect(presetRuleId(v.reason)).toBe(id)
  })

  it('rows are tool-restricted: an unrelated tool name is not swept by cred globs', () => {
    // tools:[read...] rows must not match a non-read tool carrying the same arg shape
    // (the un-restricted secret.* row may still name it — that is pre-existing behavior,
    // the assertion is only that no *cred* row reaches a non-read tool).
    const v = decideRules(RULESET, toolCall('web_fetch_impl', { url: 'https://x/.npmrc' }))
    expect(presetRuleId(v.reason) ?? '').not.toMatch(/^cred\./)
  })
})

// Disturbance mirror: routine commands must not carry ANY preset tag.
const WHITELIST: readonly string[] = [
  'git status',
  'git push origin main',
  'git checkout main',
  'git checkout -b feature/x',
  'git restore --staged README.md',
  'git branch -d merged-branch',
  'git stash list',
  'git log --oneline',
  'git add .',
  'npm publish --tag beta',
  'ls dist',
  'rm -rf ./build',
  'find . -name "*.log"',
  'rsync -av ./src/ ./dst/',
  'dd if=a.img of=b.img',
  'grep -R pattern src',
  'git worktree list',
  'git worktree remove ../clean-tree',
]

// File-tool reads of ordinary project files must not carry a cred tag either —
// the ladder is scoped to credential shapes, not to "every read".
const CRED_WHITELIST: readonly string[] = ['E:/proj/src/app.ts', 'E:/proj/package.json', 'E:/proj/README.md', 'E:/proj/data/env-report.csv']
describe('cred family rows — ordinary project reads untouched', () => {
  it.each(CRED_WHITELIST)('read %s carries no cred tag', (file_path) => {
    const v = decideRules(RULESET, { tool: 'read', args: { file_path }, cwd: 'E:/proj' })
    expect(presetRuleId(v.reason) ?? '').not.toMatch(/^cred\./)
  })
})

describe('whitelist — routine commands untouched by the preset table', () => {
  it.each(WHITELIST)('%s carries no preset tag', (command) => {
    const v = verdict(command)
    expect(presetRuleId(v.reason)).toBeUndefined()
    expect(v.reason).not.toContain('[deny-rule:')
  })
})

describe('mergePresetIntoRaw — idempotent, revocation-preserving', () => {
  it('appends the whole table to an empty doc exactly once', () => {
    const first = mergePresetIntoRaw({})
    expect(first.added).toBe(presetRuleIds().length)
    const second = mergePresetIntoRaw(first.doc)
    expect(second.added).toBe(0)
  })

  it('keeps user entries and does not re-add disabled ones', () => {
    const userDoc = { defaultAction: 'allow', deny: [{ command: ['npm'], reason: 'user rule' }] }
    const merged = mergePresetIntoRaw(userDoc)
    expect(merged.added).toBe(presetRuleIds().length)
    // Flip one preset entry to enabled:false, then merge again: the id exists,
    // revocation stands and nothing is re-added.
    const flipped = { ...merged.doc }
    flipped.deny = (merged.doc.deny as Record<string, unknown>[]).map((e) =>
      presetRuleId(e.reason) === 'git.reset-hard' ? { ...e, enabled: false } : e,
    )
    const again = mergePresetIntoRaw(flipped)
    expect(again.added).toBe(0)
    expect((again.doc.deny as Record<string, unknown>[]).some((e) => e.enabled === false && presetRuleId(e.reason) === 'git.reset-hard')).toBe(true)
    expect(again.doc.defaultAction).toBe('allow')
  })

  it('accepts the permissions:-wrapped file form', () => {
    const merged = mergePresetIntoRaw({ permissions: { defaultAction: 'ask', deny: [] } })
    expect(merged.added).toBe(presetRuleIds().length)
    expect(Array.isArray((merged.doc.permissions as Record<string, unknown>).deny)).toBe(true)
  })
})

describe('ensurePresetRulesFile — one-shot seed with a marker', () => {
  it('creates the file and never re-seeds after full revocation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-preset-'))
    const rulesFile = join(dir, 'rules.yml')
    const marker = join(dir, '.preset-rules-seeded')

    const created = ensurePresetRulesFile(rulesFile, marker)
    expect(created.action).toBe('created')
    expect(readFileSync(rulesFile, 'utf8')).toContain('[deny-rule:git.reset-hard]')
    expect(existsSync(marker)).toBe(true)

    // Full revocation: user deletes every preset entry (marker keeps it gone).
    writeFileSync(rulesFile, 'defaultAction: ask\ndeny: []\nask: []\n', 'utf8')
    expect(ensurePresetRulesFile(rulesFile, marker).action).toBe('already-seeded')
    expect(readFileSync(rulesFile, 'utf8')).not.toContain('[deny-rule:')
  })

  it('merges missing entries into a pre-existing user file once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-preset2-'))
    const rulesFile = join(dir, 'rules.yml')
    writeFileSync(rulesFile, 'permissions:\n  defaultAction: ask\n  deny:\n    - command: [npm]\n      reason: user rule\n', 'utf8')
    const res = ensurePresetRulesFile(rulesFile)
    expect(res.action).toBe('merged')
    expect(res.added).toBe(presetRuleIds().length)
    const text = readFileSync(rulesFile, 'utf8')
    expect(text).toContain('user rule')
    expect(text).toContain('[deny-rule:git.reset-hard]')
  })
})
