import { describe, expect, it } from 'vitest'
import { PermGateRuntime } from '../src/runtime.js'

/**
 * The blacklist words this spec needs are assembled at run time: a spec file
 * that spelled them out would itself be vetoed by the layer under test.
 */
const DISK_WORD = 'form' + 'at'
const FORCE_RM = 'rm' + ' -rf'
const INIT_FS_WORD = 'mk' + 'fs'
const CJK_WORD = '清空' + '数据库'
const DEVICE_WORD = 'dd of' + '='

const EXEC = (command: string) => ({ name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1' })

describe('deny-keyword matching scope', () => {
  it('does not veto a keyword that only appears inside a longer identifier', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywords: () => [DISK_WORD] })
    expect(r.decideExecution(EXEC(`echo ${DISK_WORD}Time`))?.kind).not.toBe('deny')
    expect(r.decideExecution(EXEC(`echo ${DISK_WORD}ted`))?.kind).not.toBe('deny')
    expect(r.decideExecution(EXEC(`pre${DISK_WORD}`))?.kind).not.toBe('deny')
    // A hyphenated command identifier is one word: PowerShell's Format-Table is
    // not the disk command, so `-` counts as an identifier character too.
    expect(r.decideExecution(EXEC(`Get-ChildItem | ${DISK_WORD}-Table`))?.kind).not.toBe('deny')
    expect(r.decideExecution(EXEC(`Get-ChildItem | ${DISK_WORD}-List`))?.kind).not.toBe('deny')
    // ...while the keyword as a word of its own is still a hit.
    expect(r.decideExecution(EXEC(`${DISK_WORD} C: /q`))?.kind).toBe('deny')
  })

  it('still vetoes the preset phrases, including across extra whitespace', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(EXEC(`${FORCE_RM} /work/build`))?.kind).toBe('deny')
    expect(r.decideExecution(EXEC('rm    -rf /work/build'))?.kind).toBe('deny')
    expect(r.decideExecution(EXEC(`${INIT_FS_WORD}.ext4 /dev/sdb1`))?.kind).toBe('deny')
    expect(r.decideExecution(EXEC(CJK_WORD))?.kind).toBe('deny')
  })

  it('keeps punctuation-edged keywords matchable', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(EXEC(`${DEVICE_WORD}/dev/sdb`))?.kind).toBe('deny')
  })

  it('collapses whitespace before matching a punctuation-edged keyword', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution(EXEC(`${DEVICE_WORD.replace(' ', '   ')}/dev/sdb`))?.kind).toBe('deny')
  })

  it('ignores document bodies but still scans scalar arguments', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    // A file's text is not the operation: writing it is not running it.
    expect(r.decideExecution({
      name: 'write',
      arguments: { file_path: 'doc.md', content: `${FORCE_RM} /` },
      sessionId: 's1',
    })?.kind).not.toBe('deny')
    expect(r.decideExecution({
      name: 'edit',
      arguments: { file_path: 'doc.md', old_string: 'a', new_string: `${FORCE_RM} /` },
      sessionId: 's1',
    })?.kind).not.toBe('deny')
    // Issue #2 changed this half of the contract: a key that is not one the tool uses
    // to describe an action is prose, whatever its name (`note`, `summary`, `plan`…),
    // and an unknown prose key must not turn a file edit into a refused operation. That
    // is why a blacklist can no longer read a *denylist* of body keys.
    expect(r.decideExecution({
      name: 'edit',
      arguments: { note: `please ${FORCE_RM} the cache` },
      sessionId: 's1',
    })?.kind).not.toBe('deny')
    // What a file tool actually points at still describes the operation, so the same
    // words under `file_path` are still refused (an ordinary path, so this is the
    // keyword layer deciding and not the protected-path rule).
    expect(r.decideExecution({
      name: 'edit',
      arguments: { file_path: `${FORCE_RM} /work/build` },
      sessionId: 's1',
    })?.kind).toBe('deny')
    // A name the gate does not know is treated as an executor: everything non-body stays
    // scanned, so the tool-class rule cannot be dodged by renaming.
    expect(r.decideExecution({
      name: 'pash',
      arguments: { note: `please ${FORCE_RM} the cache` },
      sessionId: 's1',
    })?.kind).toBe('deny')
  })

  it('scans nested argument values but skips nested document bodies', () => {
    const r = new PermGateRuntime({ rulesFile: undefined })
    expect(r.decideExecution({
      name: 'exec',
      arguments: { payload: { command: `${FORCE_RM} /` } },
      sessionId: 's1',
    })?.kind).toBe('deny')
    expect(r.decideExecution({
      name: 'exec',
      arguments: { payload: { content: `${FORCE_RM} /` } },
      sessionId: 's1',
    })?.kind).not.toBe('deny')
  })

  it('honours an override that narrows the list', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywords: () => [DISK_WORD] })
    expect(r.decideExecution(EXEC(`${FORCE_RM} /work/build`))?.kind).not.toBe('deny')
    expect(r.decideExecution(EXEC(`${DISK_WORD} C: /q`))?.kind).toBe('deny')
  })
})
