import { describe, expect, it } from 'vitest'
import { GRADER_RULES, graderRulesText } from '../src/grader-rules.js'

/**
 * Both graders must be graded against one standard. These assertions pin the
 * rules that the two divergent prompts used to disagree about.
 */
describe('grader-rules — one standard for every grader', () => {
  const text = graderRulesText()

  it('separates reading a secret from sending one', () => {
    expect(text).toMatch(/Reading a local credential is not itself the act/i)
    expect(text).toMatch(/only when its content leaves this machine/)
  })

  it('refuses to read an opaque payload as proven-safe', () => {
    expect(text).toMatch(/encoded or unreadable payload is unknown, not proven safe/i)
    expect(text).toMatch(/never guess safe/)
  })

  it('gives the scope anchor its deletion exclusions depend on', () => {
    expect(text).toMatch(/workspace_root/)
    expect(text).toMatch(/treat the scope as unknown, not as inside/)
  })

  it('keeps regenerable cleanup safe', () => {
    expect(text).toMatch(/node_modules/)
    expect(text).toMatch(/always regenerable/)
  })

  it('is a single copy: risk.ts and classifier.ts both reference it', async () => {
    const { readFile } = await import('node:fs/promises')
    const risk = await readFile(new URL('../src/risk.ts', import.meta.url), 'utf8')
    const cls = await readFile(new URL('../src/classifier.ts', import.meta.url), 'utf8')
    expect(risk).toMatch(/graderRulesText\(\)/)
    expect(cls).toMatch(/graderRulesText\(\)/)
    // The old divergent wording must be gone, not left behind as a second copy.
    expect(cls).not.toMatch(/exfiltration-adjacent/)
    expect(cls).not.toMatch(/allow only for clearly safe, in-scope operations/)
  })

  /**
   * T7.3. `classifyWithLLM` still answers allow/deny/ask because six published
   * tests and the shipped `lib/` depend on it — but a *deny* from a probabilistic
   * source must never reach the decision path, because a deny cannot be appealed.
   * Pinned at the source level so rewiring it back in is a visible decision.
   */
  it('the deprecated allow/deny classifier is not wired into the decision path', async () => {
    const { readFile } = await import('node:fs/promises')
    const runtime = await readFile(new URL('../src/runtime.ts', import.meta.url), 'utf8')
    const engine = await readFile(new URL('../src/engine.ts', import.meta.url), 'utf8')
    expect(runtime).not.toMatch(/classifyWithLLM/)
    expect(engine).not.toMatch(/classifyWithLLM/)
    const cls = await readFile(new URL('../src/classifier.ts', import.meta.url), 'utf8')
    expect(cls).toMatch(/@deprecated/)
  })

  it('stays inside the measured latency budget (terse by design)', () => {
    // The first draft cost +42ms of p50 on a prefill-dominated path. These lines
    // are the guard against re-bloating the prompt with rules the runtime already
    // enforces deterministically.
    expect(text.length).toBeLessThan(2100)
    expect(GRADER_RULES.filter((l) => l.includes('exclusion') || l.includes('SAFE')).length).toBeLessThanOrEqual(6)
  })

  it('exposes the rules as ordered lines', () => {
    expect(Array.isArray(GRADER_RULES)).toBe(true)
    expect(GRADER_RULES[0]).toBe('Rules:')
    expect(graderRulesText().split('\n').length).toBe(GRADER_RULES.length)
  })
})
