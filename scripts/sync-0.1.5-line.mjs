#!/usr/bin/env node
/**
 * The 0.1.5 line's difference from `main`, declared as executable text.
 *
 * Why this exists: how `compat/0.1.5` (the 3.x line) differs from `main` used to
 * live only in a person's head. Re-deriving it meant diffing tens of commits by
 * hand — which is exactly what happened once, at a cost of a dozen commands —
 * and nothing stopped a fifth difference from appearing unnoticed. This file
 * declares the difference; `test/line-delta.spec.ts` asserts reality matches it.
 *
 * The declaration is small because the two lines are close. Measured: their DSH
 * client devDependencies are byte-identical (`@deepseek-ai/dsh-client-*` all
 * `^0.1.5-rc.2`). The 0.1.5 line is a **packaging variant**, not an API fork —
 * so the difference fits in `package.json`.
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
 *
 * `fields` is the complete list of `package.json` values the line may differ in.
 * Anything else that differs is drift, and `check` reports it.
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
   */
  syncedFrom: '9f27f885a04106ba56695b65ff43df45bb8e5f07',
  /** `package.json` top-level scalars, as `[key, expected]`. */
  fields: [
    ['version', '3.0.0'],
    ['description', 'DSH permission-gate for the DeepSeek Harness 0.1.5 line: a single self-sufficient, deterministic-first, fail-closed gate covering P0 hard-deny -> P1 session grant -> P2 static rule (allow/deny) chain -> P3 optional LLM semantic classifier -> P4 ask, with command whitelist/blacklist.'],
  ],
  /**
   * Nested scalars, as `[path, expected]` with `/`-separated paths — the same
   * separator `diffPaths` reports, so a declared path can be compared against a
   * detected one directly. Mixing separators here silently turns a legitimate
   * difference into a reported one.
   */
  nested: [
    ['engines/node', '>=24'],
    ['engines/dsh', '>=0.1.5-rc.1 <0.2.0-0'],
    ['scripts/release:3x', 'npm publish --tag dsh-0.1.5'],
  ],
  /**
   * Paths the repository must NOT carry. Plan artifacts are assets and live
   * outside the repo; the manual glyph patch is superseded by
   * `scripts/patch-permission-glyph.mjs` (which has 11 tests behind it), and a
   * hand-maintained patch rots silently as the host changes.
   */
  absentPaths: ['spec.md', 'tasks.md', 'checklist.md', 'findings.md', 'patches/add-permissive-glyph.patch'],
  /**
   * Tracked files the 0.1.5 line DELIBERATELY rewrites, beyond `package.json`:
   * the README/INSTALL/CHANGELOG docs speak of the 0.1.5 line instead of the
   * 0.1.2+ one, and `dsh.plugin.json` mirrors the manifest's version/engines
   * for the host's plugin loader. Without this list the tree check would call
   * the line's own docs drift.
   */
  deltaPaths: ['CHANGELOG.md', 'INSTALL.md', 'INSTALL.ja.md', 'INSTALL.ko.md', 'INSTALL.zh.md', 'README.md', 'dsh.plugin.json'],
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
}

/** Read a nested value by `a/b/c` path. */
function at(object, path) {
  return path.split('/').reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), object)
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
    const parts = path.split('/')
    const key = parts.pop()
    let node = next
    for (const part of parts) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {}
      node = node[part]
    }
    node[key] = value
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
 * Every problem with one 0.1.5-line tree, as human-readable strings.
 * An empty array means the tree carries exactly the declared difference.
 * @param {{ pkg: Record<string, unknown> | undefined, mainPkg: Record<string, unknown> | undefined, present: readonly string[], changed: readonly string[], label?: string }} input - the tree under test.
 * @returns {string[]} problems; empty when the tree is correct.
 */
export function checkLine({ pkg, mainPkg, present, changed, label = LINE_015.branch }) {
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
    if (actual !== value) {
      problems.push(`${label}: package.json ${path} is ${JSON.stringify(actual)}, declared ${JSON.stringify(value)}`)
    }
  }

  // 2. Nothing ELSE may differ — this is the drift this whole file exists for.
  const declared = new Set([
    ...LINE_015.fields.map(([key]) => key),
    ...LINE_015.nested.map(([path]) => path.split('/')[0]),
  ])
  const unexpected = diffPaths(mainPkg, pkg).filter((path) => !declared.has(path.split('/')[0]))
  for (const path of unexpected) {
    problems.push(`${label}: package.json ${path} differs from main but is not part of the declared difference`)
  }

  // 3. Nothing else in the TREE may differ from the sync point. Sections 1-2
  // read `package.json` and nothing else, so without this an edited `src/` file
  // on the 0.1.5 line passed with "carries exactly the declared difference"
  // printed over it. `package.json` is always permitted because its contents
  // were already judged above; mirrors are permitted because they are derived.
  const permitted = new Set(['package.json', ...LINE_015.mirrorPaths, ...LINE_015.deltaPaths, ...LINE_015.absentPaths])
  for (const path of changed) {
    if (!permitted.has(path)) {
      problems.push(`${label}: ${path} differs from the sync point but is not part of the declared difference`)
    }
  }

  // 4. The repo must not carry the assets that belong outside it.
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
    ...LINE_015.nested.map(([path]) => path),
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
  console.error('usage: node scripts/sync-0.1.5-line.mjs <check|apply> [--ref R] [--main R] [--dir D]')
  return 2
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main()
}
