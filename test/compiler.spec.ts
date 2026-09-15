import { describe, expect, it } from 'vitest'
import { compileGlob, compileLiteral, hashText, PatternError, compileCidr, compilePortSpec, compileDomainPattern, compileParamPatterns } from '../src/compiler.js'

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

describe('compileCidr', () => {
  it('matches address within CIDR range', () => {
    const match = compileCidr('10.0.0.0/8')
    expect(match('10.1.2.3')).toBe(true)
    expect(match('10.255.255.255')).toBe(true)
    expect(match('11.0.0.1')).toBe(false)
    expect(match('192.168.1.1')).toBe(false)
  })

  it('handles /32 (single host)', () => {
    const match = compileCidr('192.168.1.100/32')
    expect(match('192.168.1.100')).toBe(true)
    expect(match('192.168.1.101')).toBe(false)
  })

  it('handles /0 (matches everything)', () => {
    const match = compileCidr('0.0.0.0/0')
    expect(match('1.2.3.4')).toBe(true)
    expect(match('255.255.255.255')).toBe(true)
  })

  it('rejects invalid CIDR format', () => {
    expect(() => compileCidr('10.0.0.0')).toThrow(PatternError)
    expect(() => compileCidr('/8')).toThrow(PatternError)
    expect(() => compileCidr('10.0.0.0/33')).toThrow(PatternError)
    expect(() => compileCidr('10.0.0.0/abc')).toThrow(PatternError)
    expect(() => compileCidr('999.0.0.0/8')).toThrow(PatternError)
  })

  it('non-IPv4 inputs return false', () => {
    const match = compileCidr('10.0.0.0/8')
    expect(match('not-an-ip')).toBe(false)
    expect(match('')).toBe(false)
  })
})

describe('compilePortSpec', () => {
  it('matches exact port', () => {
    const match = compilePortSpec('443')
    expect(match(443)).toBe(true)
    expect(match(80)).toBe(false)
  })

  it('matches port range', () => {
    const match = compilePortSpec('8000-9000')
    expect(match(8000)).toBe(true)
    expect(match(8500)).toBe(true)
    expect(match(9000)).toBe(true)
    expect(match(7999)).toBe(false)
    expect(match(9001)).toBe(false)
  })

  it('rejects invalid specs', () => {
    expect(() => compilePortSpec('abc')).toThrow(PatternError)
    expect(() => compilePortSpec('9000-8000')).toThrow(PatternError) // reversed
    expect(() => compilePortSpec('70000')).toThrow(PatternError) // out of range
  })
})

describe('compileDomainPattern', () => {
  it('literal domain matches itself and subdomains', () => {
    const m = compileDomainPattern('github.com')
    expect(m.re.test('github.com')).toBe(true)
    expect(m.re.test('api.github.com')).toBe(true)
    expect(m.re.test('raw.github.com')).toBe(true) // real subdomain
    expect(m.re.test('notgithub.com')).toBe(false)
    expect(m.re.test('evil-github.com')).toBe(false)
    expect(m.re.test('raw.githubusercontent.com')).toBe(false) // different domain, not a subdomain
  })

  it('glob pattern uses glob compilation', () => {
    const m = compileDomainPattern('*.example.com')
    expect(m.re.test('sub.example.com')).toBe(true)
    expect(m.re.test('example.com')).toBe(false) // *. doesn't match bare domain
  })
})

describe('compileParamPatterns', () => {
  it('compiles normal patterns', () => {
    const result = compileParamPatterns(['*--force*', '*--dry-run*'])
    expect(result).toHaveLength(2)
    expect(result[0].negated).toBe(false)
    expect(result[0].compiled.re.test('--force')).toBe(true)
    expect(result[1].negated).toBe(false)
  })

  it('compiles negated patterns', () => {
    const result = compileParamPatterns(['!*--dry-run*'])
    expect(result).toHaveLength(1)
    expect(result[0].negated).toBe(true)
    expect(result[0].pattern).toBe('!*--dry-run*')
    expect(result[0].compiled.re.test('--dry-run')).toBe(true) // inner pattern matches; caller negates
  })
})