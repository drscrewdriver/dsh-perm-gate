import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveDataDir, resolveDshHome, resolveRulesFile } from '../src/config.js'

const original = process.env.DSH_HOME
afterEach(() => {
  if (original === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = original
})

describe('resolveDshHome', () => {
  it('prefers an explicit value over the environment', () => {
    process.env.DSH_HOME = join('/', 'env', 'home')
    expect(resolveDshHome(join('/', 'explicit'))).toBe(join('/', 'explicit'))
  })

  it('falls back to DSH_HOME, treating an empty string as unset', () => {
    process.env.DSH_HOME = join('/', 'env', 'home')
    expect(resolveDshHome(undefined)).toBe(join('/', 'env', 'home'))
    expect(resolveDshHome('')).toBe(join('/', 'env', 'home'))
  })

  it('falls back to ~/.dsh when nothing is configured', () => {
    delete process.env.DSH_HOME
    expect(resolveDshHome(undefined)).toBe(join(homedir(), '.dsh'))
  })
})

describe('resolveDataDir', () => {
  it('always yields a plugin-owned directory (never undefined)', () => {
    delete process.env.DSH_HOME
    expect(resolveDataDir(undefined)).toBe(join(homedir(), '.dsh', 'perm-gate'))
    expect(resolveDataDir(join('/', 'custom'))).toBe(join('/', 'custom', 'perm-gate'))
  })
})

describe('resolveRulesFile', () => {
  const dataDir = join('/', 'data', 'perm-gate')

  it('prefers an explicit rulesFile over the data-dir default', () => {
    expect(resolveRulesFile(join('/', 'etc', 'permissions.yaml'), dataDir)).toBe(join('/', 'etc', 'permissions.yaml'))
  })

  it('defaults to <dataDir>/rules.yml so a dropped-in rules file is loaded', () => {
    expect(resolveRulesFile(undefined, dataDir)).toBe(join(dataDir, 'rules.yml'))
    expect(resolveRulesFile('', dataDir)).toBe(join(dataDir, 'rules.yml'))
  })
})
