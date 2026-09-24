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
    nested: readonly (readonly [string | readonly string[], string])[]
    absentPaths: readonly string[]
    mirrorPaths: readonly string[]
    contentPaths: readonly (readonly [string, string | null])[]
    declarationPaths: readonly string[]
  }
  applyDelta: (pkg: Record<string, unknown>) => Record<string, unknown>
  diffPaths: (before: unknown, after: unknown) => string[]
  checkLine: (input: {
    pkg: Record<string, unknown> | undefined
    mainPkg: Record<string, unknown> | undefined
    present: readonly string[]
    changed: readonly string[]
    content?: Record<string, string | null>
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
    // Present but empty on main's side; the line is what fills them in. Without
    // the empty shells `diffPaths` reports each added object as a single path,
    // and the exactness case below could not see the keys inside it.
    publishConfig: {},
    peerDependencies: {},
    peerDependenciesMeta: {},
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

  it('names the lockfile as a mirror, so its exemption from "nothing else differs" is visible', () => {
    // package-lock.json tracks package.json's version/engines/bin. It is
    // derived, never hand-edited — but "derived" has to be declared somewhere,
    // or the tree check cannot tell it apart from a stray edit.
    expect(LINE_015.mirrorPaths).toContain('package-lock.json')
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
    // Array paths (scoped package names) are compared in the `/`-joined form
    // `diffPaths` reports, which is what makes the two directly comparable.
    const declared = [
      ...LINE_015.fields.map(([key]) => key),
      ...LINE_015.nested.map(([path]) => (Array.isArray(path) ? path.join('/') : path)),
    ].sort()
    // The load-bearing assertion: the delta cannot quietly grow.
    expect(changed).toEqual(declared)
  })

  it('carries a scoped peer through the array form of a path', () => {
    // A `/`-separated path cannot address `@deepseek-ai/dsh-client-locale` at all:
    // splitting on `/` turns one key into two. Without the array form, the line's
    // optional peers would be dropped by the next `apply` instead of re-applied.
    const pkg = applyDelta(mainPkg()) as {
      peerDependencies: Record<string, string>
      peerDependenciesMeta: Record<string, { optional?: boolean }>
    }
    expect(pkg.peerDependencies['@deepseek-ai/dsh-client-locale']).toBe('>=0.1.5-rc.1 <0.2.0-0')
    expect(pkg.peerDependenciesMeta['@deepseek-ai/dsh-client-locale'].optional).toBe(true)
  })

  it('compares a declared sub-object structurally, ignoring key order', () => {
    const pkg = applyDelta(mainPkg()) as { peerDependenciesMeta: Record<string, { optional?: boolean }> }
    // Same entries, reversed insertion order: still exactly the declared value.
    pkg.peerDependenciesMeta = {
      '@deepseek-ai/dsh-client-ui-settings': { optional: true },
      '@deepseek-ai/dsh-client-ui-renderer': { optional: true },
      '@deepseek-ai/dsh-client-ui-conversation': { optional: true },
      '@deepseek-ai/dsh-client-locale': { optional: true },
    }
    expect(checkLine({
      pkg,
      mainPkg: mainPkg(),
      present: [],
      changed: LINE_015.contentPaths.map(([p]) => p),
      content: Object.fromEntries(LINE_015.contentPaths),
    })).toEqual([])
    // ...and a different shape is still reported.
    pkg.peerDependenciesMeta = { '@deepseek-ai/dsh-client-locale': { optional: false } }
    expect(checkLine({ pkg, mainPkg: mainPkg(), present: [], changed: [] }).join('\n'))
      .toContain('peerDependenciesMeta/@deepseek-ai/dsh-client-locale')
  })

  it('produces a tree the checker accepts', () => {
    // `changed` has to name every live content pin: a pin that no longer differs
    // is reported, so a green check also means the pins are current.
    expect(checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: [],
      changed: [...LINE_015.contentPaths.map(([path]) => path), 'package.json'],
      content: Object.fromEntries(LINE_015.contentPaths),
    })).toEqual([])
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
    expect(checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: ['src/index.ts'],
      // Every live pin has to be named: a declared content path that no longer
      // differs is reported, which is what keeps the list from rotting.
      changed: ['package.json', 'package-lock.json', 'tasks.md', ...LINE_015.contentPaths.map(([path]) => path)],
      content: Object.fromEntries(LINE_015.contentPaths),
    })).toEqual([])
  })

  it('rejects a declared field holding the wrong value', () => {
    const pkg = applyDelta(mainPkg())
    ;(pkg.engines as Record<string, unknown>).node = '>=22'
    const problems = checkLine({ pkg, mainPkg: mainPkg(), present: [], changed: [] })
    expect(problems.join('\n')).toContain('engines/node')
    expect(problems.join('\n')).toContain('declared ">=24"')
  })

  it('rejects a difference from the sync point that nobody declared', () => {
    const pkg = applyDelta(mainPkg())
    pkg.dependencies = { yaml: '^2.5.0', chokidar: '^5.0.0' }
    const problems = checkLine({ pkg, mainPkg: mainPkg(), present: [], changed: [] })
    expect(problems.join('\n')).toContain('dependencies')
    expect(problems.join('\n')).toContain('not part of the declared difference')
  })

  it('rejects a repository that still tracks an asset which must live outside it', () => {
    const problems = checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: ['src/index.ts', 'tasks.md'],
      changed: [],
    })
    expect(problems.join('\n')).toContain('tasks.md')
    expect(problems.join('\n')).toContain('must live outside it')
  })

  it('rejects a tracked file that differs from the sync point but was never declared', () => {
    // The blind spot this exists to close: sections 1-2 only ever read
    // package.json, so before `changed` existed, an edited src/ file on the
    // 0.1.5 line still printed "carries exactly the declared difference" and
    // exited 0. Only a tree-level diff can see that.
    const problems = checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: ['src/runtime.ts'],
      changed: ['package.json', 'src/runtime.ts'],
    })
    expect(problems.join('\n')).toContain('src/runtime.ts')
    expect(problems.join('\n')).toContain('not part of the declared difference')
  })

  it('pins a line-owned path to its blob, not merely to "may differ"', () => {
    const withBlob = LINE_015.contentPaths.find(([, pinned]) => pinned !== null)
    if (withBlob === undefined) throw new Error('no blob-pinned content path declared')
    const [path, id] = withBlob
    const changed = LINE_015.contentPaths.map(([p]) => p)
    const base = { pkg: applyDelta(mainPkg()), mainPkg: mainPkg(), present: [], changed }
    expect(checkLine({ ...base, content: Object.fromEntries(LINE_015.contentPaths) })).toEqual([])
    // The same path with different bytes is drift: the pin is a claim about
    // content, not a licence to differ however one likes.
    const problems = checkLine({ ...base, content: { ...Object.fromEntries(LINE_015.contentPaths), [path]: 'deadbeefdead' } })
    expect(problems.join('\n')).toContain(`declared at ${id}`)
    expect(problems.join('\n')).toContain(path)
  })

  it('reports a path the declaration says must be absent on the line', () => {
    const absent = LINE_015.contentPaths.find(([, pinned]) => pinned === null)
    if (absent === undefined) throw new Error('no declared-absent content path')
    const problems = checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: [],
      changed: LINE_015.contentPaths.map(([p]) => p),
      content: { ...Object.fromEntries(LINE_015.contentPaths), [absent[0]]: 'feedfacecafe' },
    })
    expect(problems.join('\n')).toContain('declared absent')
  })

  it('reports a pin that no longer differs, so the list cannot rot', () => {
    const problems = checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: [],
      changed: ['package.json'],
      content: {},
    })
    expect(problems.join('\n')).toContain('no longer differs')
  })

  it('permits the declaration file itself, which can never match its own pin', () => {
    expect(checkLine({
      pkg: applyDelta(mainPkg()),
      mainPkg: mainPkg(),
      present: [],
      changed: [...LINE_015.contentPaths.map(([p]) => p), ...LINE_015.declarationPaths, 'package.json'],
      content: Object.fromEntries(LINE_015.contentPaths),
    })).toEqual([])
  })

  it('rejects a scoped peer whose declared version drifted', () => {
    const pkg = applyDelta(mainPkg()) as { peerDependencies: Record<string, string> }
    pkg.peerDependencies['@deepseek-ai/dsh-client-locale'] = '>=0.1.4-rc.1 <0.2.0-0'
    const problems = checkLine({ pkg, mainPkg: mainPkg(), present: [], changed: [] })
    expect(problems.join('\n')).toContain('peerDependencies/@deepseek-ai/dsh-client-locale')
  })

  it('reports an unreadable side instead of silently passing', () => {
    expect(checkLine({ pkg: undefined, mainPkg: mainPkg(), present: [], changed: [] }).join()).toContain('package.json is missing')
    expect(checkLine({ pkg: mainPkg(), mainPkg: undefined, present: [], changed: [] }).join()).toContain('unreadable')
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
