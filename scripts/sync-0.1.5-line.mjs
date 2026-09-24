#!/usr/bin/env node
/**
 * The 0.1.5 line's difference from `main`, declared as executable text.
 *
 * Why this exists: how `compat/0.1.5` (the 3.x/4.x line) differs from `main` used
 * to live only in a person's head. Re-deriving it meant diffing tens of commits by
 * hand — which is exactly what happened once, at a cost of a dozen commands —
 * and nothing stopped a fifth difference from appearing unnoticed. This file
 * declares the difference; `test/line-delta.spec.ts` asserts reality matches it.
 *
 * The declaration has four kinds of member, because there are four honest answers
 * to "how may this differ from main":
 *
 *   `fields` / `nested`  — `package.json` values the line SETS, pinned by value.
 *   `contentPaths`       — files the line OWNS, pinned by line-side blob id.
 *   `mirrorPaths`        — files DERIVED from `package.json`, exempt by nature.
 *   `declarationPaths`   — this file, which cannot agree with its own pin.
 *
 * Usage:
 *   node scripts/sync-0.1.5-line.mjs check [--ref <ref>] [--base <ref>]
 *     Verify a ref's tree carries exactly the declared difference. Defaults:
 *     `--ref compat/0.1.5`, `--base` = the pinned `syncedFrom` commit — never a
 *     moving `main`, because main moving ahead is "behind", not "drifted".
 *     Exits non-zero on any problem, and reports how far main has moved since.
 *
 *   node scripts/sync-0.1.5-line.mjs apply [--dir <path>] [--main <ref>]
 *     Align a checked-out 0.1.5-line worktree to `main` and re-apply the delta.
 *     Refuses to run unless the worktree is clean and on the declared branch.
 *     It never commits and never pushes — review, gate, then commit yourself.
 *
 *   node scripts/sync-0.1.5-line.mjs pin [--ref <ref>] [--base <ref>]
 *     Print the `contentPaths` entries this tree would need, plus the pins that no
 *     longer differ, for pasting into the declaration after a re-pin. Print-only:
 *     the declaration stays a reviewed edit, never a generated file.
 *
 * What the difference is NOT allowed to contain: the plan artifacts
 * (`spec.md` / `tasks.md` / `checklist.md` / `findings.md`) and the manual glyph
 * patch. Those must be absent from the repository; `absentPaths` below enforces
 * it. The plan artifacts are assets, kept outside the repo.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The declared difference between the 0.1.5 line and `main`.
 */
export const LINE_015 = {
  branch: 'compat/0.1.5',
  /**
   * The `main` commit this line was last synced from.
   *
   * The comparison baseline, and it must be a PINNED SHA rather than `main`:
   * `main` is allowed to move ahead — that is not drift, it is the line being
   * behind, which is expected and intended. Comparing against a moving ref would
   * report "drift" on every main-side dependency bump and make the guard noise.
   * Pinning the sync point makes the two cases distinguishable: a difference
   * from THIS commit is an undeclared edit to the line, while commits after it
   * are simply newer work waiting to be synced.
   *
   * A release that bumps `version` moves the line ahead of its own pin. That is
   * deliberate: the pin records the last real sync, and `fields.version` below is
   * what makes the bump visible. Re-pinning is a sync-time act, not a release one.
   */
  syncedFrom: '1f15c6ecd6e1dc633975c11634036f1d91f13be1',
  /** `package.json` top-level scalars, as `[key, expected]`. */
  fields: [
    ['version', '4.1.2'],
    ['description', 'DSH permission-gate for the DeepSeek Harness 0.1.5 line: a single self-sufficient, deterministic-first, fail-closed gate covering P0 hard-deny -> P1 session grant -> P2 static rule (allow/deny) chain -> P3 optional LLM semantic classifier -> P4 ask, with command whitelist/blacklist.'],
  ],
  /**
   * Nested scalars, as `[path, expected]` — the same separator `diffPaths`
   * reports, so a declared path can be compared against a detected one directly.
   * Mixing separators here silently turns a legitimate difference into a reported
   * one.
   *
   * A path may also be an ARRAY of keys. That form exists for keys containing a
   * slash — a scoped package name like `@deepseek-ai/dsh-client-locale` cannot be
   * addressed through a `/`-separated string at all, and reading it back needs
   * the array form to round-trip. Both forms feed `apply` as well as `check`, so
   * the line's optional peers survive a sync instead of being silently dropped.
   *
   * A declared VALUE may be a sub-object; it is then compared structurally, with
   * key order ignored. That is what lets a whole entry be pinned where the tree
   * adds it whole (`peerDependenciesMeta`), instead of pinning an inner scalar the
   * diff never reaches.
   */
  nested: [
    ['engines/node', '>=24'],
    ['engines/dsh', '>=0.1.5-rc.1 <0.2.0-0'],
    ['scripts/release:3x', 'npm publish --tag dsh-0.1.5'],
    ['publishConfig/registry', 'https://registry.npmjs.org'],
    ['publishConfig/access', 'public'],
    ['publishConfig/tag', 'dsh-0.1.5'],
    [['peerDependencies', '@deepseek-ai/cordis'], '^4.0.1'],
    [['peerDependencies', '@deepseek-ai/dsh-client-locale'], '>=0.1.5-rc.1 <0.2.0-0'],
    [['peerDependencies', '@deepseek-ai/dsh-client-ui-conversation'], '>=0.1.5-rc.1 <0.2.0-0'],
    [['peerDependencies', '@deepseek-ai/dsh-client-ui-renderer'], '>=0.1.5-rc.1 <0.2.0-0'],
    [['peerDependencies', '@deepseek-ai/dsh-client-ui-settings'], '>=0.1.5-rc.1 <0.2.0-0'],
    [['peerDependenciesMeta', '@deepseek-ai/dsh-client-locale'], { optional: true }],
    [['peerDependenciesMeta', '@deepseek-ai/dsh-client-ui-conversation'], { optional: true }],
    [['peerDependenciesMeta', '@deepseek-ai/dsh-client-ui-renderer'], { optional: true }],
    [['peerDependenciesMeta', '@deepseek-ai/dsh-client-ui-settings'], { optional: true }],
  ],
  /**
   * Files the line owns outright: they differ from the sync point by design, and
   * each one is pinned to the blob id the line is supposed to carry. "May differ"
   * is too weak a claim — with that, any of these could be edited on the line
   * without a trace. Pinning the blob means the tree has to differ in exactly the
   * declared way, and editing one of them is drift until the pin is renewed
   * (`pin` prints the entries; renewing it is a reviewed edit).
   *
   * `null` means the path is tracked on `main` and deliberately absent here.
   */
  contentPaths: [
    ['CHANGELOG.ja.md', '4800c71f6b97'],
    ['CHANGELOG.ko.md', 'a04afccc20d9'],
    ['CHANGELOG.md', '92a03c5d7d91'],
    ['INSTALL.ja.md', '9b1ef53a63db'],
    ['INSTALL.ko.md', 'a034d153d61b'],
    ['INSTALL.md', '16987e2b20cb'],
    ['INSTALL.zh.md', 'dc67460165cb'],
    ['README.ja.md', 'b681a1a4641b'],
    ['README.ko.md', '25a0f7174690'],
    ['README.md', 'ff43c4520e75'],
    ['README.zh.md', 'e538c8de8052'],
    ['dsh.plugin.json', '01fc21c1ed56'],
    ['lib/client.js', 'beae9473799c'],
    ['lib/client.js.map', '7a7e0a9abe74'],
    ['lib/config.d.ts', 'bde16e60b663'],
    ['lib/config.js', '4576600428e6'],
    ['lib/events.d.ts', '2dbf08d79f9e'],
    ['lib/events.js', '11f9adae21e7'],
    ['lib/index.js', 'ae82a210fd8f'],
    ['src/client/feed.ts', 'fe032e52841a'],
    ['src/client/history.tsx', '1b3cf569110c'],
    ['src/client/locales.ts', '772c513e97dd'],
    ['src/client/notice.tsx', '2de179280cab'],
    ['src/client/sediment.tsx', '72d12b2b3382'],
    ['src/config.ts', 'ff6c08b371a1'],
    ['src/events.ts', 'f7fe41f7f715'],
    ['src/index.ts', 'c407bcf3dd9a'],
    ['test/events.spec.ts', 'fdbee547747f'],
    // Tracked on main, deliberately not tracked on this line: its package manager
    // is npm (`package-lock.json` is the mirror), and the plan doc is a main-side
    // artifact the line never carried.
    ['docs/plan-rules-to-settings.md', null],
    ['pnpm-lock.yaml', null],
  ],
  /**
   * Paths the repository must NOT carry. Plan artifacts are assets and live
   * outside the repo; the manual glyph patch is superseded by
   * `scripts/patch-permission-glyph.mjs` (which has a test suite behind it), and a
   * hand-maintained patch rots silently as the host changes.
   */
  absentPaths: ['spec.md', 'tasks.md', 'checklist.md', 'findings.md', 'patches/add-permissive-glyph.patch'],
  /**
   * Tracked files that MIRROR `package.json` and therefore may differ from the
   * sync point without being a hand edit — the lockfile's `version`, `engines`
   * and `bin` follow the package manifest by construction.
   *
   * They are exempt from the tree rule in `checkLine`, and named here so the
   * exemption is declared rather than implicit. Nothing in this file keeps a
   * mirror honest; `npm install` does, which is why the sync procedure ends by
   * running it.
   */
  mirrorPaths: ['package-lock.json'],
  /**
   * Files whose JOB is to describe the delta, and which therefore can never agree
   * with the delta's own pin: this file is edited whenever the line syncs, so it
   * is always one edit ahead of the commit `syncedFrom` names. Hashing it here
   * would be circular — the hash would have to include itself.
   *
   * It is still covered: `test/line-delta.spec.ts` exercises the machinery, and
   * any change here is a reviewed edit to the guard itself.
   */
  declarationPaths: ['scripts/sync-0.1.5-line.mjs'],
}

/** Human-readable form of a declared path (string or array of keys). */
function pathLabel(path) {
  return Array.isArray(path) ? path.join('/') : path
}

/** The keys a declared path names: split a string, copy an array. */
function pathKeys(path) {
  return Array.isArray(path) ? [...path] : path.split('/')
}

/** Read a nested value by path — `a/b/c`, or an array of literal keys. */
function at(object, path) {
  const keys = pathKeys(path)
  return keys.reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), object)
}

/**
 * Apply the declared difference to a `package.json` object, purely.
 * @param {Record<string, unknown>} pkg - the `main`-side package.json.
 * @returns {Record<string, unknown>} a new object carrying the declaration.
 */
export function applyDelta(pkg) {
  const next = structuredClone(pkg)
  for (const [key, value] of LINE_015.fields) next[key] = value
  for (const [path, value] of LINE_015.nested) {
    const keys = pathKeys(path)
    const leaf = keys.pop()
    let node = next
    for (const key of keys) {
      if (typeof node[key] !== 'object' || node[key] === null || Array.isArray(node[key])) node[key] = {}
      node = node[key]
    }
    node[leaf] = value
  }
  return next
}

/**
 * The `a/b` paths where two objects differ (including added/removed keys).
 * Only walks plain objects; arrays and scalars compare by value.
 * @param {unknown} before - original.
 * @param {unknown} after - changed.
 * @param {string} [prefix] - internal.
 * @returns {string[]} differing paths, sorted.
 */
export function diffPaths(before, after, prefix = '') {
  const out = []
  const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
  if (!isMap(before) || !isMap(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix]
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const path = prefix === '' ? key : `${prefix}/${key}`
    out.push(...diffPaths(before[key], after[key], path))
  }
  return out.sort()
}

/**
 * A value's comparable form: objects with their keys sorted, so two objects that
 * differ only in insertion order compare equal.
 */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value === 'object' && value !== null) {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key])
    return out
  }
  return value
}

/**
 * Whether a declared value holds. Scalars compare by identity; an object or array
 * declaration compares structurally, which is how a whole sub-object is pinned.
 */
function sameValue(actual, expected) {
  if (actual === expected) return true
  if (typeof expected !== 'object' || expected === null) return false
  return JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected))
}

/**
 * Every problem with one 0.1.5-line tree, as human-readable strings.
 * An empty array means the tree carries exactly the declared difference.
 * @param {{ pkg: Record<string, unknown> | undefined, mainPkg: Record<string, unknown> | undefined, present: readonly string[], changed: readonly string[], content?: Record<string, string | null>, label?: string }} input - the tree under test.
 * @returns {string[]} problems; empty when the tree is correct.
 */
export function checkLine({ pkg, mainPkg, present, changed, content = {}, label = LINE_015.branch }) {
  const problems = []
  if (pkg === undefined) return [`${label}: package.json is missing`]
  if (mainPkg === undefined) return [`${label}: main's package.json is unreadable — cannot compare`]

  // 1. Every declared field must actually differ from main in the declared way.
  for (const [key, value] of LINE_015.fields) {
    if (pkg[key] !== value) {
      problems.push(`${label}: package.json ${key} is ${JSON.stringify(pkg[key])}, declared ${JSON.stringify(value)}`)
    }
  }
  for (const [path, value] of LINE_015.nested) {
    const actual = at(pkg, path)
    if (!sameValue(actual, value)) {
      problems.push(`${label}: package.json ${pathLabel(path)} is ${JSON.stringify(actual)}, declared ${JSON.stringify(value)}`)
    }
  }

  // 2. Nothing ELSE may differ — this is the drift this whole file exists for.
  const declared = new Set([
    ...LINE_015.fields.map(([key]) => key),
    ...LINE_015.nested.map(([path]) => pathKeys(path)[0]),
  ])
  const unexpected = diffPaths(mainPkg, pkg).filter((path) => !declared.has(path.split('/')[0]))
  for (const path of unexpected) {
    problems.push(`${label}: package.json ${path} differs from main but is not part of the declared difference`)
  }

  // 3. Nothing else in the TREE may differ from the sync point. Sections 1-2
  // read `package.json` and nothing else, so without this an edited `src/` file
  // on the 0.1.5 line passed with "carries exactly the declared difference"
  // printed over it. `package.json` is always permitted because its contents
  // were already judged above; mirrors are permitted because they are derived;
  // the declaration file because it cannot agree with its own pin.
  const permitted = new Set([
    'package.json',
    ...LINE_015.mirrorPaths,
    ...LINE_015.absentPaths,
    ...LINE_015.declarationPaths,
  ])
  const pinned = new Map(LINE_015.contentPaths)
  for (const path of changed) {
    if (permitted.has(path)) continue
    if (!pinned.has(path)) {
      problems.push(`${label}: ${path} differs from the sync point but is not part of the declared difference`)
      continue
    }
    const expected = pinned.get(path)
    const actual = content[path] ?? null
    if (expected === null) {
      if (actual !== null) {
        problems.push(`${label}: ${path} is declared absent on this line but is tracked (${actual})`)
      }
    } else if (actual !== expected) {
      problems.push(`${label}: ${path} is declared at ${expected} but the line carries ${actual ?? 'nothing'}`)
    }
  }

  // 4. A declared content pin that no longer differs is a stale pin: harmless to
  // the tree, but it means the declaration is describing a difference that has
  // been synced away. Reported so the list cannot quietly rot.
  for (const [path] of LINE_015.contentPaths) {
    if (!changed.includes(path)) {
      problems.push(`${label}: ${path} is declared as line-owned content but no longer differs from the sync point`)
    }
  }

  // 5. The repo must not carry the assets that belong outside it.
  for (const path of LINE_015.absentPaths) {
    if (present.includes(path)) problems.push(`${label}: ${path} is tracked in the repository but must live outside it`)
  }

  return problems
}

/** Read `package.json` at a ref, or from disk when `ref` is undefined. */
function readPkg(ref, cwd) {
  try {
    const text = ref === undefined
      ? readFileSync(join(cwd, 'package.json'), 'utf8')
      : execFileSync('git', ['show', `${ref}:package.json`], { cwd, encoding: 'utf8' })
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Tracked paths at a ref, or on disk when `ref` is undefined. */
function readPaths(ref, cwd) {
  try {
    const out = ref === undefined
      ? execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8' })
      : execFileSync('git', ['ls-tree', '-r', '--name-only', ref], { cwd, encoding: 'utf8' })
    return out.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  } catch {
    return []
  }
}

/**
 * Paths that differ from the sync point — the tree-level fact `readPkg` cannot
 * see. A ref that does not resolve yields no paths; `checkLine`'s
 * unreadable-side checks are what fail loudly in that case.
 */
function readChanged(baseRef, ref, cwd) {
  try {
    const args = ref === undefined
      ? ['diff', '--name-only', baseRef, '--', '.']
      : ['diff', '--name-only', baseRef, ref]
    const out = execFileSync('git', args, { cwd, encoding: 'utf8' })
    return out.split('\n').map((l) => l.trim()).filter((l) => l !== '')
  } catch {
    return []
  }
}

/**
 * The line-side blob id of each path, shortened to the 12 characters the
 * declaration pins. `null` when the path is not tracked there, which is how a
 * declared-absent path is told apart from a missing one.
 */
function readContent(ref, cwd, paths) {
  const out = {}
  for (const path of paths) {
    try {
      out[path] = execFileSync('git', ['rev-parse', `${ref ?? 'HEAD'}:${path}`], {
        cwd,
        encoding: 'utf8',
        // A declared-absent path is an expected miss; its stderr is not a finding.
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().slice(0, 12)
    } catch {
      out[path] = null
    }
  }
  return out
}

/** `check` subcommand. */
function cmdCheck(argv) {
  const ref = argv.ref ?? LINE_015.branch
  // Baseline defaults to the pinned sync point, never to a moving `main`.
  const baseRef = argv.base ?? LINE_015.syncedFrom
  const problems = checkLine({
    pkg: readPkg(ref, ROOT),
    mainPkg: readPkg(baseRef, ROOT),
    present: readPaths(ref, ROOT),
    changed: readChanged(baseRef, ref, ROOT),
    content: readContent(ref, ROOT, LINE_015.contentPaths.map(([path]) => path)),
    label: ref,
  })

  // Informational: how far main has moved since the sync point. This is the
  // line being behind, not drift, so it never fails the check.
  let behind = '0'
  try {
    behind = execFileSync('git', ['rev-list', '--count', `${baseRef}..main`], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch { /* main not resolvable here; the count is informational anyway */ }

  if (problems.length === 0) {
    console.log(`${ref} carries exactly the declared difference from ${baseRef}.`)
    if (behind !== '0') {
      console.log(`note: main is ${behind} commit(s) ahead of that sync point — the line is behind, not drifted. Re-sync when you want those changes; update syncedFrom when you do.`)
    }
    return 0
  }
  for (const p of problems) console.error(`✗ ${p}`)
  console.error(`\n${problems.length} problem(s). The declaration lives in scripts/sync-0.1.5-line.mjs.`)
  return 1
}

/**
 * `pin` subcommand: print the `contentPaths` entries this tree needs, and the
 * pins it no longer needs. Print-only on purpose — the declaration stays a
 * reviewed edit, and a generator that rewrote it could mask a real drift.
 */
function cmdPin(argv) {
  const ref = argv.ref ?? 'HEAD'
  const baseRef = argv.base ?? LINE_015.syncedFrom
  const declared = new Set([
    'package.json',
    ...LINE_015.mirrorPaths,
    ...LINE_015.absentPaths,
    ...LINE_015.declarationPaths,
  ])
  const changed = readChanged(baseRef, ref, ROOT).filter((path) => !declared.has(path))
  const content = readContent(ref, ROOT, changed)

  console.log(`// LINE_015.contentPaths for ${ref} against ${baseRef}`)
  for (const path of changed) {
    const id = content[path]
    console.log(`    ['${path}', ${id === null ? 'null' : `'${id}'`}],`)
  }

  const stale = LINE_015.contentPaths.map(([path]) => path).filter((path) => !changed.includes(path))
  if (stale.length > 0) {
    console.log('\n// no longer differ — drop these pins:')
    for (const path of stale) console.log(`//   ${path}`)
  }
  console.log('\n// then: node scripts/sync-0.1.5-line.mjs check')
  return 0
}

/** `apply` subcommand: align a worktree and re-apply the delta, without committing. */
function cmdApply(argv) {
  const dir = resolve(argv.dir ?? '.')
  const mainRef = argv.main ?? 'main'

  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trim()
  if (dirty !== '') throw new Error(`${dir} has uncommitted changes; refusing to align over them`)
  if (branch !== LINE_015.branch && !branch.startsWith('sync/')) {
    throw new Error(`${dir} is on "${branch}"; expected ${LINE_015.branch} or a sync/* branch`)
  }

  console.log(`aligning ${branch} to ${mainRef} in ${dir}`)
  execFileSync('git', ['checkout', mainRef, '--', '.'], { cwd: dir, stdio: 'inherit' })

  for (const path of LINE_015.absentPaths) {
    try {
      execFileSync('git', ['rm', '-f', '-q', '--ignore-unmatch', path], { cwd: dir, stdio: 'inherit' })
    } catch { /* already absent */ }
  }

  const before = readPkg(undefined, dir)
  const after = applyDelta(before)
  const changed = diffPaths(before, after)
  const declared = new Set([
    ...LINE_015.fields.map(([key]) => key),
    ...LINE_015.nested.map(([path]) => pathLabel(path)),
  ])
  const stray = changed.filter((path) => !declared.has(path) && !declared.has(path.split('/')[0]))
  if (stray.length > 0) throw new Error(`refusing to write: the delta would also change ${stray.join(', ')}`)

  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(after, null, 2)}\n`, 'utf8')
  console.log(`re-applied ${changed.length} declared field(s): ${changed.join(', ')}`)
  console.log('now run: npm install && npm run typecheck && npm run lint && npm test && npm run build')
  return 0
}

/** Parse `--key value` pairs. */
function parseFlags(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { out[argv[i].slice(2)] = argv[i + 1]; i++ }
  }
  return out
}

function main() {
  const [sub, ...rest] = process.argv.slice(2)
  const flags = parseFlags(rest)
  if (sub === 'check') return cmdCheck(flags)
  if (sub === 'apply') return cmdApply(flags)
  if (sub === 'pin') return cmdPin(flags)
  console.error('usage: node scripts/sync-0.1.5-line.mjs <check|apply|pin> [--ref R] [--main R] [--base R] [--dir D]')
  return 2
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main()
}
