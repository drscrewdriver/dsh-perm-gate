import { describe, expect, it } from 'vitest'
import { compileGlob, compileLiteral, hashText, PatternError } from '../src/compiler.js'

describe('compileGlob', () => {
  it('matches a literal', () => {
    expect(compileGlob('git').re.test('git')).toBe(true)
    expect(compileGlob('git').re.test('gitx')).toBe(false)
  })

  it('matches a star across any chars', () => {
    expect(compileGlob('npm#*').re.test('npm#install')).toBe(true)
  })

  it('segments mode stops at path separators', () => {
    const g = compileGlob('.dsh/*', { segments: true })
    expect(g.re.test('.dsh/cred') ).toBe(true)
    expect(g.re.test('.dsh/a/cred')).toBe(false)
    expect(compileGlob('.dsh/**', { segments: true }).re.test('.dsh/a/b')).toBe(true)
  })

  it('rejects patterns exceeding maxStars (ReDoS bound)', () => {
    expect(() => compileGlob('a*b*c', { maxStars: 1 })).toThrow(PatternError)
    expect(() => compileGlob('a*b*c', { maxStars: 2 })).not.toThrow()
  })

  it('collapses consecutive stars into one run', () => {
    const g = compileGlob('**', { maxStars: 1 })
    expect(g.re.test('anything')).toBe(true)
  })

  it('preserves char classes', () => {
    expect(compileGlob('[abc]').re.test('b')).toBe(true)
    expect(compileGlob('[abc]').re.test('d')).toBe(false)
  })
})

describe('compileLiteral', () => {
  it('escapes regex metacharacters', () => {
    expect(compileLiteral('file(1).txt').re.test('file(1).txt')).toBe(true)
    expect(compileLiteral('file(1).txt').re.test('file1txt')).toBe(false)
  })
})

describe('hashText', () => {
  it('is stable and distinct', () => {
    expect(hashText('a')).toBe(hashText('a'))
    expect(hashText('a')).not.toBe(hashText('b'))
    expect(hashText('a')).toMatch(/^[0-9a-f]{64}$/)
  })
})