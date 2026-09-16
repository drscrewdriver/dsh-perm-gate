/**
 * The declared 0.1.5-line difference, and the machinery that guards it.
 *
 * Background: how `compat/0.1.5` differs from `main` used to be knowledge in a
 * person's head. Re-deriving it cost a dozen commands and nothing caught a new
 * difference appearing. `scripts/sync-0.1.5-line.mjs` declares it;
 * these cases guard the declaration's own machinery.
 *
 * Deliberately NOT tested here: whether the live `compat/0.1.5` branch is
 * currently in sync. That is an operational question about a branch, not a
 * property of this code — asserting it would turn "the line has not been synced
 * yet" into a red main suite. `npm run check:line` answers it on demand.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The shape of the tool's exports; it is plain ESM with no emitted types. */
interface LineDeltaModule {
  LINE_015: {
    branch: string
    syncedFrom: string
    fields: readonly (readonly [string, string])[]
    nested: readonly (readonly [string, string])[]
    absentPaths: readonly string[]
  }
  applyDelta: (pkg: Record<string, unknown>) => Record<string, unknown>
  diffPaths: (before: unknown, after: unknown) => string[]
  checkLine: (input: {
    pkg: Record<string, unknown> | undefined
    mainPkg: Record<string, unknown> | undefined
    present: readonly string[]
    label?: string
  }) => string[]
}

// Imported by URL so TypeScript does not try to resolve types for a plain .mjs
// tool. The path is resolved at runtime by the test runner.
const mod = await import(
  /* @vite-ignore */ new URL('../scripts/sync-0.1.5-line.mjs', import.meta.url).href
) as LineDeltaModule

const { LINE_015, applyDelta, diffPaths, checkLine } = mod

/** A stand-in for main's package.json, carrying every declared key. */
function mainPkg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'dsh-perm-gate',
    version: '2.6.0',
    description: 'DSH permission-gate for the DeepSeek Harness 0.1.2+ line: ...',
    engines: { node: '>=20', dsh: '>=0.1.2-alpha.1 <0.2.0-0' },
    scripts: { 'release:latest': 'npm publish --tag latest' },
    dependencies: { yaml: '^2.5.0' },
    ...overrides,
  }
}

describe('LINE_015 declaration', () => {
  it('names a branch and pins the sync point to a full SHA, never a moving ref', () => {
    expect(LINE_015.branch).toBe('compat/0.1.5')
    // A branch name here would report "drift" every time main moved.
    expect(LINE_015.syncedFrom).toMatch(/^[0-9a-f]{40}$/)
  })

  it('declares every absent path that must live outside the repository', () => {
    expect(LINE_015.absentPaths).toContain('spec.md')
    expect(LINE_015.absentPaths).toContain('patches/add-permissive-glyph.patch')
  })
})

describe('applyDelta', () => {
  it('is pure — the input object is not mutated', () => {
    const before = mainPkg()
    const snapshot = structuredClone(before)
    applyDelta(before)
    expect(before).toEqual(snapshot)
  })

  it('changes exactly the declared paths and nothing else', () => {
    const before = mainPkg()
    const changed = diffPaths(before, applyDelta(before))
    const declared = [
      ...LINE_015.fields.map(([key]) => key),
      ...LINE_015.nested.map(([path]) => path),
    ].sort()
    // The load-bearing assertion: the delta cannot quietly grow.
    expect(changed).toEqual(declared)
  })

  it('produces a tree the checker accepts', () => {
    expect(checkLine({ pkg: applyDelta(mainPkg()), mainPkg: mainPkg(), present: [] })).toEqual([])
  })
})

describe('diffPaths', () => {
  it('reports nested paths, additions and removals', () => {
    expect(diffPaths({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } })).toEqual(['b/c'])
    expect(diffPaths({ a: 1 }, { a: 1, b: 2 })).toEqual(['b'])
    expect(diffPaths({ a: 1, b: 2 }, { a: 1 })).toEqual(['b'])
    expect(diffPaths({ a: 1 }, { a: 1 })).toEqual([])
  })

  it('compares arrays by value rather than by path', () => {
    expect(diffPaths({ list: [1, 2] }, { list: [1, 2] })).toEqual([])
    expect(diffPaths({ list: [1, 2] }, { list: [2, 1] })).toEqual(['list'])
  })
})

describe('checkLine', () => {
  it('accepts a tree carrying exactly the declaration', () => {
    expect(checkLine({ pkg: applyDelta(mainPkg()), mainPkg: mainPkg(), present: ['src/index.ts'] })).toEqual([])
  })

  it('rejects a declared field holding the wrong value', () => {
    const pkg = applyDelta(mainPkg())
    ;(pkg.engines as Record<string, unknown>).node = '>=22'
    const problems = checkLine({ pkg, mainPkg: mainPkg(), present: [] })
    expect(problems.join('\n')).toContain('engines/node')
    expect(problems.join('\n')).toContain('declared ">=24"')
  })

  it('rejects a difference from the sync point that nobody declared', () => {
    const pkg = applyDelta(mainPkg())
    pkg.dependencies = { yaml: '^2.5.0', chokidar: '^5.0.0' }
    const problems = checkLine({ pkg, mainPkg: mainPkg(), present: [] })
    expect(problems.join('\n')).toContain('dependencies')
    expect(problems.join('\n')).toContain('not part of the declared difference')
  })

  it('rejects a repository that still tracks an asset which must live outside it', () => {
    const problems = checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: ['src/index.ts', 'tasks.md'],
    })
    expect(problems.join('\n')).toContain('tasks.md')
    expect(problems.join('\n')).toContain('must live outside it')
  })

  it('reports an unreadable side instead of silently passing', () => {
    expect(checkLine({ pkg: undefined, mainPkg: mainPkg(), present: [] }).join()).toContain('package.json is missing')
    expect(checkLine({ pkg: mainPkg(), mainPkg: undefined, present: [] }).join()).toContain('unreadable')
  })
})

describe('the CLI entry point', () => {
  it('fails loudly on the wrong ref, so a green exit is meaningful', () => {
    // `main` cannot satisfy a declaration that says "version 3.0.0": comparing
    // main against its own sync point yields no diff to declare, yet the
    // declared values do not hold there. This is the negative control for the
    // positive run in `npm run check:line`.
    const run = spawnSync(process.execPath, ['scripts/sync-0.1.5-line.mjs', 'check', '--ref', 'main'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('version')
  })

  it('prints usage and exits 2 with no subcommand', () => {
    const run = spawnSync(process.execPath, ['scripts/sync-0.1.5-line.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
    expect(run.status).toBe(2)
    expect(run.stderr).toContain('usage')
  })

  it('is wired as an npm script', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    expect(pkg.scripts?.['check:line']).toBe('node scripts/sync-0.1.5-line.mjs check')
  })
})
