import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { learnKey, operationFingerprint, RiskLearning } from '../src/learning.js'

const dirs: string[] = []
function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-learn-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'perm-gate'), { recursive: true })
  return join(dir, 'perm-gate', 'learning.json')
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('operationFingerprint', () => {
  it('uses the shell command word plus target basename', () => {
    expect(operationFingerprint('bash', { command: 'npm install --save foo' })).toBe('npm|foo')
    expect(operationFingerprint('bash', { command: 'git push origin main' })).toBe('git|main')
  })

  it('falls back to the bare command word when no target token exists', () => {
    expect(operationFingerprint('bash', { command: 'ls   -la' })).toBe('ls')
  })

  it('uses the commandText for shell tools when args lack a command', () => {
    expect(operationFingerprint('bash', {}, 'pnpm build')).toBe('pnpm|build')
  })

  it('uses the structured target basename for file tools', () => {
    expect(operationFingerprint('write', { file_path: 'E:\\repo\\src\\a.ts' })).toBe('a.ts')
    expect(operationFingerprint('edit', { path: '/work/pkg/index.js' })).toBe('index.js')
  })

  it('falls back to the tool name', () => {
    expect(operationFingerprint('grep', { pattern: 'x' })).toBe('grep')
  })

  it('distinguishes different targets (a different target never reuses authority)', () => {
    const a = operationFingerprint('bash', { command: 'rm -rf dist' })
    const b = operationFingerprint('bash', { command: 'rm -rf src' })
    expect(a).not.toBe(b)
  })
})

describe('RiskLearning', () => {
  it('stays in memory without a file path', () => {
    const l = new RiskLearning(undefined, { threshold: 2 })
    const key = learnKey('bash', 'neutral')
    l.confirm(key, 'npm|foo', 'install foo')
    expect(l.count(key)).toBe(1)
    expect(l.shouldAutoAllow(key, 'npm|foo')).toBe(false)
    l.confirm(key, 'npm|foo', 'install foo')
    expect(l.shouldAutoAllow(key, 'npm|foo')).toBe(true)
  })

  it('requires both threshold and an exact sample match', () => {
    const l = new RiskLearning(undefined, { threshold: 1 })
    const key = learnKey('write', 'neutral')
    l.confirm(key, 'a.ts', 'write a.ts')
    expect(l.shouldAutoAllow(key, 'a.ts')).toBe(true)
    expect(l.shouldAutoAllow(key, 'b.ts')).toBe(false) // different target: keep asking
    expect(l.shouldAutoAllow(learnKey('bash', 'neutral'), 'a.ts')).toBe(false)
  })

  it('persists across instances', () => {
    const file = tmpFile()
    const first = new RiskLearning(file, { threshold: 3 })
    const key = learnKey('bash', 'neutral')
    first.confirm(key, 'git|origin', 'push origin')
    first.confirm(key, 'git|origin', 'push origin')

    const second = new RiskLearning(file, { threshold: 3 })
    expect(second.count(key)).toBe(2)
    expect(second.shouldAutoAllow(key, 'git|origin')).toBe(false)
    second.confirm(key, 'git|origin', 'push origin')
    expect(second.shouldAutoAllow(key, 'git|origin')).toBe(true)

    const raw = JSON.parse(readFileSync(file, 'utf8')) as { version: number; confirmed: Record<string, number> }
    expect(raw.version).toBe(1)
    expect(raw.confirmed[key]).toBe(3)
  })

  it('degrades to memory when the file path is unusable', () => {
    const file = tmpFile()
    // `blocker` is an existing FILE, so the learning path below it cannot be created.
    const blocker = join(file, '..', 'blocker')
    writeFileSync(blocker, 'x', 'utf8')
    const badFile = join(blocker, 'learning.json')
    const l = new RiskLearning(badFile, { threshold: 1 })
    expect(() => l.confirm(learnKey('bash', 'neutral'), 'x', 'ctx')).not.toThrow()
    expect(l.shouldAutoAllow(learnKey('bash', 'neutral'), 'x')).toBe(true)
    rmSync(blocker, { force: true })
  })

  it('tolerates a corrupt file and starts clean', () => {
    const file = tmpFile()
    writeFileSync(file, '{not json', 'utf8')
    const l = new RiskLearning(file, { threshold: 1 })
    expect(l.count(learnKey('bash', 'neutral'))).toBe(0)
  })

  it('evicts the oldest samples beyond maxSamples and dedupes by fingerprint', () => {
    const l = new RiskLearning(undefined, { threshold: 10, maxSamples: 2 })
    const key = learnKey('bash', 'neutral')
    l.confirm(key, 'a', 'one')
    l.confirm(key, 'b', 'two')
    l.confirm(key, 'a', 'one refreshed')
    const samples = l.snapshot().samples[key]
    expect(samples.map((s) => s.fp)).toEqual(['b', 'a'])
    expect(samples[1].ctx).toBe('one refreshed')
  })

  it('reset clears counts and samples', () => {
    const l = new RiskLearning(undefined, { threshold: 1 })
    const key = learnKey('bash', 'neutral')
    l.confirm(key, 'x', 'ctx')
    l.reset()
    expect(l.snapshot().confirmed).toEqual({})
    expect(l.shouldAutoAllow(key, 'x')).toBe(false)
  })
})
