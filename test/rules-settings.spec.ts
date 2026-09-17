import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isRulesConfigured, readRulesFromSettings, type RulesConfig } from '../src/config.js'
import { compileRulesObject, parsePermissionsDocument, parsePermissionsObject, RuleError } from '../src/rule.js'
import { decideRules, type ToolCallContext } from '../src/evaluate.js'
import { appendAllowToSettings, listAllowFromRulesDoc, replaceAllowInSettings, type SettingsRulesScope } from '../src/allowlist.js'
import { readRulesViewFromSettings, SETTINGS_RULES_VIEW_PATH } from '../src/rules-view.js'
import { PermGateRuntime } from '../src/runtime.js'
import { parse } from 'yaml'

const WORKSPACE = 'E:/test/rewrite-agently'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function shellCtx(command: string): ToolCallContext {
  return { tool: 'shell', args: { command }, cwd: WORKSPACE, home: WORKSPACE, caseInsensitive: true }
}

function writeCtx(filePath: string): ToolCallContext {
  return { tool: 'write', args: { file_path: filePath, content: 'x' }, cwd: WORKSPACE, home: WORKSPACE, caseInsensitive: true }
}

/** An in-memory stand-in for the host settings scope (arrays replace on update). */
function fakeScope(initial: unknown = {}): SettingsRulesScope & { store: Record<string, unknown> } {
  const store: Record<string, unknown> = { ...(initial as Record<string, unknown>) }
  return {
    store,
    get: () => ({ ...store }),
    update: (patch: object) => {
      Object.assign(store, patch)
      return Promise.resolve()
    },
  }
}

const BARE_DOC = {
  defaultAction: 'ask',
  deny: [],
  allow: [{ command: ['git'], reason: 'settings allow' }],
  ask: [],
} as const

describe('parsePermissionsObject / compileRulesObject (settings input path)', () => {
  it('compiles the bare settings form', () => {
    const ruleset = compileRulesObject(BARE_DOC)
    expect(ruleset.defaultAction).toBe('ask')
    expect(ruleset.allow).toHaveLength(1)
    expect(decideRules(ruleset, shellCtx('git push origin main')).action).toBe('allow')
  })

  it('compiles the permissions-wrapped form (a migrated file document)', () => {
    const ruleset = compileRulesObject({
      permissions: { deny: [{ paths: ['src/secret.ts'], reason: 'secret' }] },
    })
    expect(ruleset.deny).toHaveLength(1)
    expect(decideRules(ruleset, writeCtx('src/secret.ts')).action).toBe('deny')
  })

  it('agrees with the YAML path for equivalent documents', () => {
    const yaml = `permissions:\n  defaultAction: ask\n  allow:\n    - command: [git push]\n      reason: settings allow\n`
    const fromYaml = parsePermissionsDocument(yaml)
    const fromObject = parsePermissionsObject(parse(yaml))
    expect(fromObject).toEqual(fromYaml)
  })

  it('treats null/undefined as an empty document', () => {
    expect(parsePermissionsObject(null)).toEqual({ defaultAction: 'ask', deny: [], allow: [], ask: [] })
  })

  it('fails loud on malformed input', () => {
    expect(() => compileRulesObject('nope')).toThrow(RuleError)
    expect(() => compileRulesObject({ allow: [{ bogus: true }] })).toThrow(/unknown field/)
    expect(() => compileRulesObject({ defaultAction: 'maybe' })).toThrow(/defaultAction/)
  })

  it('round-trips a raw file document with dimension mappings', () => {
    const raw = parse(`permissions:\n  deny:\n    - params:\n        command: ['*--force*']\n      reason: no force\n`)
    const ruleset = compileRulesObject(raw)
    expect(ruleset.deny).toHaveLength(1)
  })
})

describe('isRulesConfigured / readRulesFromSettings (dual-source predicate)', () => {
  it('bare schema defaults are NOT configured', () => {
    expect(isRulesConfigured(undefined)).toBe(false)
    expect(isRulesConfigured({})).toBe(false)
    expect(isRulesConfigured({ defaultAction: 'ask', deny: [], allow: [], ask: [] })).toBe(false)
  })

  it('entries or a non-default defaultAction ARE configured', () => {
    expect(isRulesConfigured({ allow: [{ command: ['x'] }] })).toBe(true)
    expect(isRulesConfigured({ deny: [{}] })).toBe(true)
    expect(isRulesConfigured({ defaultAction: 'deny' })).toBe(true)
  })

  it('readRulesFromSettings returns the doc only when configured', () => {
    expect(readRulesFromSettings(undefined)).toBeUndefined()
    expect(readRulesFromSettings({ get: () => ({ defaultAction: 'ask', deny: [], allow: [], ask: [] }) })).toBeUndefined()
    const doc = { allow: [{ command: ['x'] }] } as unknown as RulesConfig
    expect(readRulesFromSettings({ get: () => doc })).toBe(doc)
  })
})

describe('readRulesViewFromSettings', () => {
  it('renders counts, defaultAction, the structured object and YAML raw', () => {
    const view = readRulesViewFromSettings(BARE_DOC)
    expect(view.source).toBe('settings')
    expect(view.path).toBe(SETTINGS_RULES_VIEW_PATH)
    expect(view.exists).toBe(true)
    expect(view.defaultAction).toBe('ask')
    expect(view.counts).toEqual({ allow: 1, deny: 0, ask: 0 })
    expect(view.rules).toBe(BARE_DOC)
    expect(view.raw).toContain('git')
    expect(view.hash).not.toBe('')
    expect(view.truncated).toBe(false)
    expect(view.error).toBeUndefined()
  })

  it('reports a doc that does not compile instead of throwing', () => {
    const view = readRulesViewFromSettings({ allow: [{ bogus: true }] })
    expect(view.error).toContain('does not compile')
    expect(view.counts).toEqual({ allow: 0, deny: 0, ask: 0 })
    expect(view.source).toBe('settings')
  })
})

describe('allowlist settings writers', () => {
  const FILE_DOC = parse(
    `permissions:\n  defaultAction: ask\n  deny:\n    - paths: [src/secret.ts]\n      reason: secret\n  allow:\n    - command: [pnpm]\n      reason: file allow\n`,
  )

  it('append seeds the file document on the first write (deny survives)', async () => {
    const scope = fakeScope()
    expect(await appendAllowToSettings(scope, 'npm test', 'permissive allow-everywhere', FILE_DOC)).toBe(true)
    expect(isRulesConfigured(scope.get())).toBe(true)
    expect(listAllowFromRulesDoc(scope.get())).toEqual(['pnpm', 'npm test'])
    const compiled = compileRulesObject(scope.get())
    expect(compiled.deny).toHaveLength(1) // the file's deny rule migrated along
  })

  it('append accepts a bare (unwrapped) seed', async () => {
    const scope = fakeScope()
    expect(await appendAllowToSettings(scope, 'npm test', undefined, {
      defaultAction: 'ask',
      deny: [{ paths: ['src/secret.ts'], reason: 'secret' }],
      allow: [{ command: ['pnpm'], reason: 'file allow' }],
      ask: [],
    })).toBe(true)
    expect(listAllowFromRulesDoc(scope.get())).toEqual(['pnpm', 'npm test'])
    expect(compileRulesObject(scope.get()).deny).toHaveLength(1)
  })

  it('append without seed starts from bare defaults', async () => {
    const scope = fakeScope()
    expect(await appendAllowToSettings(scope, 'npm test')).toBe(true)
    expect(listAllowFromRulesDoc(scope.get())).toEqual(['npm test'])
    expect(compileRulesObject(scope.get()).defaultAction).toBe('ask')
  })

  it('append on a configured namespace only touches the allow section', async () => {
    const scope = fakeScope({ defaultAction: 'deny', deny: [{ paths: ['x'], reason: 'd' }], allow: [{ command: ['a'] }], ask: [] })
    expect(await appendAllowToSettings(scope, 'b', undefined, FILE_DOC)).toBe(true)
    const doc = scope.get() as Record<string, unknown>
    expect(doc['defaultAction']).toBe('deny') // seed NOT applied — namespace already configured
    expect(listAllowFromRulesDoc(doc)).toEqual(['a', 'b'])
  })

  it('replace swaps the allow whitelist and preserves deny', async () => {
    const scope = fakeScope()
    expect(await replaceAllowInSettings(scope, ['a', 'b'], 'permissive allowlist', FILE_DOC)).toBe(true)
    expect(listAllowFromRulesDoc(scope.get())).toEqual(['a', 'b'])
    expect(compileRulesObject(scope.get()).deny).toHaveLength(1)

    expect(await replaceAllowInSettings(scope, [], 'permissive allowlist')).toBe(true)
    expect(listAllowFromRulesDoc(scope.get())).toEqual([])
  })

  it('returns false when the scope rejects the write', async () => {
    const badScope: SettingsRulesScope = {
      get: () => ({}),
      update: () => Promise.reject(new Error('readonly')),
    }
    expect(await appendAllowToSettings(badScope, 'x')).toBe(false)
    expect(await replaceAllowInSettings(badScope, ['x'])).toBe(false)
  })
})

describe('PermGateRuntime dual-source rules (settings first, file fallback)', () => {
  const FILE_YAML = `permissions:\n  defaultAction: ask\n  allow:\n    - command: [pnpm]\n      reason: file allow pnpm\n`
  const SETTINGS_DOC: RulesConfig = {
    defaultAction: 'ask',
    deny: [],
    allow: [{ command: ['git'], reason: 'settings allow git' }],
    ask: [],
  }

  function runtimeWith(doc: unknown, extra: Record<string, unknown> = {}): PermGateRuntime {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-rules-settings-'))
    dirs.push(dir)
    const rulesFile = join(dir, 'rules.yml')
    writeFileSync(rulesFile, FILE_YAML, 'utf8')
    return new PermGateRuntime({
      rulesFile,
      dshHome: dir,
      caseInsensitivePaths: true,
      readRulesDocument: () => (isRulesConfigured(doc) ? doc as RulesConfig : undefined),
      ...extra,
    })
  }

  it('a configured settings document overrides the file', () => {
    const r = runtimeWith(SETTINGS_DOC)
    expect(r.compiledRuleset.allow).toHaveLength(1)
    expect(r.compiledRuleset.allow[0].reason).toBe('settings allow git')
    expect(r.allowlist()).toEqual(['git'])
  })

  it('bare defaults fall back to the file', () => {
    const r = runtimeWith({ defaultAction: 'ask', deny: [], allow: [], ask: [] })
    expect(r.compiledRuleset.allow).toHaveLength(1)
    expect(r.compiledRuleset.allow[0].reason).toBe('file allow pnpm')
    expect(r.allowlist()).toEqual(['pnpm'])
  })

  it('an unconfigured namespace leaves the file paths unchanged', () => {
    const r = runtimeWith(undefined)
    expect(r.compiledRuleset.allow).toHaveLength(1)
    expect(r.compiledRuleset.allow[0].reason).toBe('file allow pnpm')
  })

  it('reload() picks up a changed settings document', () => {
    let doc: unknown = undefined
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-rules-settings-'))
    dirs.push(dir)
    const rulesFile = join(dir, 'rules.yml')
    writeFileSync(rulesFile, FILE_YAML, 'utf8')
    const r = new PermGateRuntime({
      rulesFile,
      dshHome: dir,
      caseInsensitivePaths: true,
      readRulesDocument: () => (isRulesConfigured(doc) ? doc as RulesConfig : undefined),
    })
    expect(r.compiledRuleset.allow[0].reason).toBe('file allow pnpm')
    doc = SETTINGS_DOC
    expect(r.reload()).toBe(true)
    expect(r.compiledRuleset.allow[0].reason).toBe('settings allow git')
    doc = undefined
    expect(r.reload()).toBe(true)
    expect(r.compiledRuleset.allow[0].reason).toBe('file allow pnpm')
  })

  it('a malformed settings document fails loud at construction', () => {
    expect(() => runtimeWith({ allow: [{ bogus: true }] })).toThrow(/unknown field/)
  })

  it('approveAllowEverywhere / setAllowlist prefer the settings writer', () => {
    const appended: string[] = []
    let replaced: readonly string[] | undefined
    const r = runtimeWith(undefined, {
      allowlistWriter: {
        append: (pattern) => {
          appended.push(pattern)
          return true
        },
        replace: (patterns) => {
          replaced = patterns
          return true
        },
      },
    })
    expect(r.approveAllowEverywhere('git push')).toBe(true)
    expect(appended).toEqual(['git push'])
    expect(r.setAllowlist(['a', 'b'])).toBe(true)
    expect(replaced).toEqual(['a', 'b'])
  })

  it('a rejecting writer falls back to the file path', () => {
    const r = runtimeWith(undefined, {
      allowlistWriter: {
        append: () => false,
        replace: () => false,
      },
    })
    expect(r.setAllowlist(['pnpm', 'git'])).toBe(true)
    expect(r.allowlist()).toEqual(['pnpm', 'git']) // reloaded from the rewritten file
  })
})
