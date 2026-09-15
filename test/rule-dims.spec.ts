import { describe, expect, it } from 'vitest'
import { parseParamsDimension, parseAbsentDimension, parseAgentsDimension, parseWhenDimension, parseArgvDimension, parseNetworkDimension } from '../src/rule-dims.js'
import { RuleError } from '../src/rule.js'

describe('parseParamsDimension', () => {
  it('returns empty array for undefined', () => {
    expect(parseParamsDimension(undefined, 'test')).toEqual([])
  })

  it('parses key→value mapping', () => {
    const result = parseParamsDimension({ command: ['*--force*'], mode: ['prod'] }, 'test')
    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('command')
    expect(result[0].patterns).toEqual(['*--force*'])
    expect(result[0].negated).toBe(false)
  })

  it('detects negated pattern', () => {
    const result = parseParamsDimension({ flag: ['!*--dry-run*'] }, 'test')
    expect(result[0].negated).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(() => parseParamsDimension('bad', 'test')).toThrow(RuleError)
    expect(() => parseParamsDimension([], 'test')).toThrow(RuleError)
  })

  it('rejects empty key', () => {
    expect(() => parseParamsDimension({ '': ['val'] }, 'test')).toThrow(RuleError)
  })
})

describe('parseAbsentDimension', () => {
  it('returns empty array for undefined', () => {
    expect(parseAbsentDimension(undefined, 'test')).toEqual([])
  })

  it('parses string list', () => {
    expect(parseAbsentDimension(['dry_run', 'verbose'], 'test')).toEqual(['dry_run', 'verbose'])
  })

  it('parses single string', () => {
    expect(parseAbsentDimension('key', 'test')).toEqual(['key'])
  })

  it('rejects empty string', () => {
    expect(() => parseAbsentDimension([''], 'test')).toThrow(RuleError)
  })
})

describe('parseAgentsDimension', () => {
  it('returns empty array for undefined', () => {
    expect(parseAgentsDimension(undefined, 'test')).toEqual([])
  })

  it('accepts valid patterns', () => {
    expect(parseAgentsDimension(['main', 'subagent', 'preset:permissive'], 'test')).toEqual(['main', 'subagent', 'preset:permissive'])
  })

  it('rejects invalid patterns', () => {
    expect(() => parseAgentsDimension(['invalid'], 'test')).toThrow(RuleError)
    expect(() => parseAgentsDimension(['preset:'], 'test')).toThrow(RuleError)
  })
})

describe('parseWhenDimension', () => {
  it('returns undefined for undefined', () => {
    expect(parseWhenDimension(undefined, 'test')).toBeUndefined()
  })

  it('parses env and platform', () => {
    const result = parseWhenDimension({ env: { NODE_ENV: ['production'] }, platform: ['linux'] }, 'test')
    expect(result).toBeDefined()
    expect(result!.env!.NODE_ENV).toEqual(['production'])
    expect(result!.platform).toEqual(['linux'])
  })

  it('rejects non-object', () => {
    expect(() => parseWhenDimension('bad', 'test')).toThrow(RuleError)
  })

  it('returns undefined for empty when', () => {
    expect(parseWhenDimension({}, 'test')).toBeUndefined()
  })
})

describe('parseArgvDimension', () => {
  it('returns undefined for undefined', () => {
    expect(parseArgvDimension(undefined, 'test')).toBeUndefined()
  })

  it('parses pipeline patterns', () => {
    const result = parseArgvDimension({ pipeline: ['curl|sh'] }, 'test')
    expect(result).toBeDefined()
    expect(result!.pipeline).toEqual(['curl|sh'])
  })
})

describe('parseNetworkDimension', () => {
  it('returns undefined for undefined', () => {
    expect(parseNetworkDimension(undefined, 'test')).toBeUndefined()
  })

  it('parses all sub-dimensions', () => {
    const result = parseNetworkDimension({
      domains: ['github.com'],
      ips: ['10.0.0.0/8'],
      ports: ['443'],
      schemes: ['https'],
    }, 'test')
    expect(result).toBeDefined()
    expect(result!.domains).toEqual(['github.com'])
    expect(result!.ips).toEqual(['10.0.0.0/8'])
    expect(result!.ports).toEqual(['443'])
    expect(result!.schemes).toEqual(['https'])
  })

  it('rejects non-object', () => {
    expect(() => parseNetworkDimension('bad', 'test')).toThrow(RuleError)
  })
})
