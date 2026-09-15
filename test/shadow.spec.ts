import { describe, expect, it } from 'vitest'
import { detectShadows } from '../src/shadow.js'
import { compileDocument, parsePermissionsDocument } from '../src/rule.js'

function makeRuleset(yaml: string) {
  return compileDocument(parsePermissionsDocument(yaml))
}

describe('detectShadows', () => {
  it('returns empty for simple rules', () => {
    const ruleset = makeRuleset(`
deny:
  - tools: [bash]
    command: [rm]
allow:
  - tools: [read]
`)
    const report = detectShadows(ruleset)
    expect(report.shadowed).toEqual([])
  })

  it('detects shadowed rule when earlier rule has no tools constraint', () => {
    const ruleset = makeRuleset(`
deny:
  - tools: []          # matches ALL tools
    command: [rm]
  - tools: [bash]      # shadowed: earlier rule already covers all tools
    command: [rm]
`)
    const report = detectShadows(ruleset)
    expect(report.shadowed).toContain(1) // second rule (index 1)
  })

  it('does NOT flag when earlier rule is stricter on tools', () => {
    const ruleset = makeRuleset(`
deny:
  - tools: [bash]
    command: [rm]
  - tools: [bash, pwsh]
    command: [rm]
`)
    const report = detectShadows(ruleset)
    // First rule is stricter (fewer tools), so second is NOT shadowed
    expect(report.shadowed).toEqual([])
  })

  it('detects shadow when earlier rule has no command constraint', () => {
    const ruleset = makeRuleset(`
deny:
  - tools: [bash]
  - tools: [bash]
    command: [rm]
`)
    const report = detectShadows(ruleset)
    expect(report.shadowed).toContain(1)
  })

  it('skips disabled rules', () => {
    const ruleset = makeRuleset(`
deny:
  - tools: []
    enabled: false
  - tools: [bash]
    command: [rm]
`)
    const report = detectShadows(ruleset)
    // First rule is disabled, so second is NOT shadowed
    expect(report.shadowed).toEqual([])
  })
})
