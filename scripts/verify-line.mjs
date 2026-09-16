#!/usr/bin/env node
/**
 * Compatibility-line verification gate for dsh-perm-gate.
 *
 * dsh-perm-gate supports two DSH lines from two branches, each carrying its own
 * version series and its own `engines.dsh`:
 *
 *   legacy — branch `legacy`, version series 1.x, DSH up to 0.1.1-rc.2, where
 *            `@deepseek-ai/dsh-client-runtime` still ships and `ctx.slots`
 *            reaches `Context` through it.
 *   new    — branch `main`, version series 0.2.x, DSH from 0.1.2-alpha.1 on
 *            (current 0.1.5-rc.2), where that package is gone and the same
 *            declarations live in `@deepseek-ai/dsh-client-ui-renderer/client`.
 *
 * Each branch pins its own line in `package.json` (`verify:line`) and installs
 * that line's client packages before building, so a build always compiles against
 * the packages the branch actually ships for.
 *
 * Usage:
 *   node scripts/verify-line.mjs new      # this branch's line
 *   node scripts/verify-line.mjs legacy
 *   node scripts/verify-line.mjs both     # drift check: build on both lines and
 *                                         # compare the client bundle hashes
 *
 * `both` is an opt-in maintainer check, not a release gate: the branches are
 * allowed to diverge, so differing hashes are reported without failing. While the
 * two branches are still in sync the hashes should match, which is the signal that
 * the version-specific edges are still type-only and no code branch was needed.
 *
 * The script rewrites node_modules with `npm install --no-save` and restores the
 * package.json dependency set at the end. It never edits package.json or
 * package-lock.json.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Client packages whose published version tracks the DSH version number. */
const CLIENT_PACKAGES = [
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-slots',
]

/** One DSH compatibility line: its DSH version, packages, and owning branch. */
const LINES = {
  legacy: {
    dsh: '0.1.1-rc.2',
    branch: 'legacy',
    note: 'DSH < 0.1.2-alpha.1 — dsh-client-runtime present',
  },
  new: {
    dsh: '0.1.5-rc.2',
    branch: 'main',
    note: 'DSH >= 0.1.2-alpha.1 — dsh-client-runtime removed',
  },
}

/**
 * The npm executable for this platform. On Windows npm is a `.cmd` shim, which
 * `spawnSync` refuses to launch without a shell (Node 20+ hardening), so `run`
 * goes through the shell there.
 */
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'

/** Windows needs a shell to launch the npm `.cmd` shim. */
const SHELL = process.platform === 'win32'

/**
 * Run one command in the repo root, streaming its output; a non-zero exit throws.
 * @param {string} command - executable to run.
 * @param {readonly string[]} args - its arguments.
 */
function run(command, args) {
  execFileSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: SHELL })
}

/**
 * Run the full gate for one compatibility line.
 * @param {string} name - the line name.
 * @returns {{ line: string, dsh: string, hash: string }} the recorded bundle hash.
 */
function verifyLine(name) {
  const line = LINES[name]
  if (line === undefined) throw new Error(`unknown line "${name}" (expected: ${Object.keys(LINES).join(', ')})`)
  console.log(`\n=== ${name} line — DSH ${line.dsh}, branch ${line.branch} (${line.note}) ===`)
  run(NPM, [
    'install', '--no-save', '--no-audit', '--no-fund',
    ...CLIENT_PACKAGES.map((pkg) => `${pkg}@${line.dsh}`),
  ])
  run(NPM, ['run', 'typecheck'])
  run(NPM, ['test'])
  run(NPM, ['run', 'build'])
  const hash = createHash('sha256')
    .update(readFileSync(join(ROOT, 'lib', 'client.js')))
    .digest('hex')
  console.log(`${name}: lib/client.js sha256 ${hash}`)
  return { line: name, dsh: line.dsh, hash }
}

/** Restore the package.json-declared dependency set. */
function restore() {
  console.log('\n=== restoring the package.json dependency set ===')
  run(NPM, ['install', '--no-audit', '--no-fund'])
}

const requested = process.argv[2]
if (requested === undefined) {
  console.error('usage: node scripts/verify-line.mjs <legacy|new|both>')
  process.exit(2)
}
const names = requested === 'both' ? ['legacy', 'new'] : [requested]

const results = []
for (const name of names) results.push(verifyLine(name))
restore()

console.log('\n=== result ===')
for (const r of results) console.log(`${r.line.padEnd(7)} DSH ${r.dsh.padEnd(12)} ${r.hash}`)

if (results.length === 2 && results[0].hash !== results[1].hash) {
  console.log('\nNote: the two branches build different client bundles. That is expected once the')
  console.log('lines diverge — it only matters while they are still meant to be in sync.')
}
