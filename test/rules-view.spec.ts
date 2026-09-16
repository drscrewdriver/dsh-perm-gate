/**
 * Reading a permissions document for the panel that displays it.
 *
 * The point of these cases is the failure modes: a missing, unreadable or
 * uncompilable file has to come back as a *rendered state*, not as a throw.
 * A viewer that blanks out whenever the thing it is viewing is broken is worse
 * than no viewer at all — the broken file is exactly what you wanted to see.
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRulesView } from '../src/rules-view.js'
import { documentHash } from '../src/rule.js'

const VALID = `permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive]
      reason: no recursive rm
  allow:
    - command: [pnpm, node]
      reason: routine project development
  ask:
    - command: [bash]
      reason: stateful shell
`

function scratch(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-rules-view-'))
  const path = join(dir, name)
  writeFileSync(path, body, 'utf8')
  return path
}

describe('readRulesView', () => {
  it('shows a compilable document, with its counts and default action', () => {
    const path = scratch('rules.yml', VALID)
    const view = readRulesView(path)

    expect(view.error).toBeUndefined()
    expect(view.path).toBe(path)
    expect(view.exists).toBe(true)
    expect(view.raw).toBe(VALID)
    expect(view.truncated).toBe(false)
    expect(view.bytes).toBe(Buffer.byteLength(VALID, 'utf8'))
    expect(view.lines).toBe(VALID.split('\n').length)
    expect(view.defaultAction).toBe('ask')
    expect(view.counts).toEqual({ allow: 1, deny: 1, ask: 1 })
    // The hash must be over the file's own text, not over the truncated view.
    expect(view.hash).toBe(documentHash(VALID))
  })

  it('reports a missing file instead of throwing', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'perm-gate-rules-view-')), 'absent.yml')
    const view = readRulesView(path)

    expect(view.exists).toBe(false)
    expect(view.raw).toBe('')
    expect(view.counts).toEqual({ allow: 0, deny: 0, ask: 0 })
    expect(view.error).toContain('does not exist')
  })

  it('shows an uncompilable document as text, and says why it did not compile', () => {
    const broken = 'permissions:\n  defaultAction: maybe\n  deny: []\n'
    const view = readRulesView(scratch('rules.yml', broken))

    // The text is still there — that is the whole point of the viewer.
    expect(view.raw).toBe(broken)
    expect(view.exists).toBe(true)
    expect(view.hash).toBe(documentHash(broken))
    expect(view.error).toContain('does not compile')
    expect(view.defaultAction).toBeUndefined()
    expect(view.counts).toEqual({ allow: 0, deny: 0, ask: 0 })
  })

  it('says so when the gate has no rules file at all', () => {
    const view = readRulesView('')

    expect(view.path).toBe('')
    expect(view.exists).toBe(false)
    expect(view.error).toBe('no rules file is configured')
  })

  it('counts an empty document as zero rules rather than failing', () => {
    const view = readRulesView(scratch('rules.yml', ''))

    expect(view.raw).toBe('')
    expect(view.lines).toBe(0)
    expect(view.counts).toEqual({ allow: 0, deny: 0, ask: 0 })
  })
})
