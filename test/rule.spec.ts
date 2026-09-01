import { describe, expect, it } from 'vitest'
import { compileDocument, documentHash, parsePermissionsDocument, RuleError } from '../src/rule.js'

const VALID = `
permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive]
      reason: no recursive rm
    - paths: [.dsh/**]
      reason: protect metadata
  allow:
    - command: [pnpm, node]
      reason: dev tools
  ask:
    - command: [bash, sh]
      reason: ask shells
`

describe('parsePermissionsDocument', () => {
  it('parses a valid document', () => {
    const doc = parsePermissionsDocument(VALID)
    expect(doc.defaultAction).toBe('ask')
    expect(doc.deny.length).toBe(2)
    expect(doc.allow[0].command).toEqual(['pnpm', 'node'])
  })

  it('rejects unknown preset fields loudly', () => {
    expect(() => parsePermissionsDocument('permissions:\n  nope: 1\n')).toThrow(RuleError)
  })

  it('rejects unknown rule fields loudly', () => {
    expect(() => parsePermissionsDocument('permissions:\n  deny:\n    - spam: true\n')).toThrow(RuleError)
  })

  it('rejects invalid YAML loudly', () => {
    expect(() => parsePermissionsDocument('permissions:\n  deny: [')).toThrow(RuleError)
  })

  it('defaults to empty rule lists when empty', () => {
    const doc = parsePermissionsDocument('')
    expect(doc.deny.length).toBe(0)
    expect(doc.defaultAction).toBe('ask')
  })
})

describe('compileDocument', () => {
  it('compiles command#flag entries into command specs', () => {
    const doc = parsePermissionsDocument(VALID)
    const cs = compileDocument(doc, {})
    expect(cs.deny[0].command[0].flag).toBe('recursive')
    expect(cs.deny[0].command[0].word.re.test('rm')).toBe(true)
  })

  it('assigns global indices across lists', () => {
    const doc = parsePermissionsDocument(VALID)
    const cs = compileDocument(doc, {})
    expect(cs.deny[0].index).toBe(0)
    expect(cs.allow[0].index).toBe(2)
  })
})

describe('documentHash', () => {
  it('hashes the source text', () => {
    expect(documentHash(VALID)).toMatch(/^[0-9a-f]{64}$/)
    expect(documentHash(VALID)).not.toBe(documentHash('permissions: {}'))
  })
})