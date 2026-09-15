#!/usr/bin/env node
/**
 * Add `permissive-full` to the DSH composer's permission-glyph map.
 *
 * WHY THIS EXISTS
 * ---------------
 * The composer's permission picker renders an icon per preset, looked up in a
 * CLOSED map inside `@deepseek-ai/dsh-client-ui-conversation`:
 *
 *     const permissionGlyphs = new Map([
 *       ["read-only", <svg …/>],
 *       ["permissive", <svg …/>],          // the 自动审查 tier's shield+eye
 *       ["workspace-write", <svg …/>],
 *       ["danger-full-access", <svg …/>],
 *     ]);
 *     function permissionGlyph(value) { return permissionGlyphs.get(value); }
 *
 * The source comment states the rule: "host-configured names outside the design
 * set get none." There is no plugin-facing seam — the option objects the host
 * supplies carry only `{value, name, description}`, and the map itself is a
 * closure variable. So a plugin-contributed tier such as `permissive-full`
 * renders with no icon in the dropdown and falls back to plain text in the
 * trigger, while the built-in `permissive` tier shows the shield+eye.
 *
 * The only way to give our tier the same glyph is to add an entry to that map.
 * This script does exactly that: it duplicates the `permissive` entry under the
 * `permissive-full` key, so the two tiers of one plugin look alike.
 *
 * VOLUNTARY, NOT AUTOMATIC
 * ------------------------
 * This edits a **host** package. It is deliberately NOT wired to `postinstall`:
 * a plugin must not rewrite the harness it is installed into without being
 * asked. Run it yourself, and re-run it after every DSH upgrade — a DSH
 * upgrade replaces the file and the patch is gone. Reinstalling this plugin
 * does NOT bring it back: `dsh plugin --profile web add …` writes only the
 * profile's own `node_modules`, and on a stock install the DSH package, the
 * profile's `node_modules` entry and this bundle are three paths to ONE file
 * (a symlink and a junction into the same inode).
 *
 * USAGE
 *   npx dsh-perm-gate-patch-glyph              # patch the bundle it finds
 *   npx dsh-perm-gate-patch-glyph --check      # report only; exit 1 if missing
 *   node scripts/patch-permission-glyph.mjs <path/to/client.js>
 *
 * With no argument it probes the usual global-install locations. The script is
 * idempotent (a second run is a no-op), backs the file up once, and refuses to
 * write a bundle it cannot slice correctly, so it can never half-apply.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The map key whose entry is cloned, and the key it is cloned onto. */
export const SOURCE_KEY = 'permissive'
export const TARGET_KEY = 'permissive-full'

/** Relative path from a package root to the bundle holding the map. */
const BUNDLE = join('@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js')

/** Thrown for every refusal; the CLI turns it into an exit code 1. */
export class GlyphPatchError extends Error {}

/**
 * Candidate bundle paths, most specific first. Pure: no filesystem access, so
 * the probe order is unit-testable.
 *
 * `execDir` is `dirname(process.execPath)`. Deriving from the running node
 * binary — never from a hardcoded nvm version or install path — is what keeps
 * the script working across node upgrades and re-pointed install symlinks.
 *
 * @param {{ execDir: string, cwd: string, dshHome: string }} where
 * @returns {string[]} absolute candidate paths
 */
export function candidateBundles({ execDir, cwd, dshHome }) {
  return [
    // 1. `@deepseek-ai` scope hoisted beside the running node binary.
    join(execDir, 'node_modules', BUNDLE),
    // 2. The same scope nested inside the `dsh` package itself.
    join(execDir, 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', BUNDLE),
    // 3. Whatever profile the caller is standing in.
    join(cwd, 'node_modules', BUNDLE),
    // 4. The hoisted scope shared by every profile under DSH_HOME.
    join(dshHome, 'profiles', 'node_modules', BUNDLE),
  ]
}

/**
 * Extract the full `["<key>", …]` map entry, by bracket depth.
 *
 * The scan starts ON the entry's opening `[` (the one immediately before the
 * key), so depth returns to zero exactly at that entry's closing `]`. Starting
 * anywhere else — e.g. at the first `(` of the value expression — ends the
 * slice in the wrong place and yields a broken bundle.
 *
 * Safe here because the entry's only string literals (svg path `d` attributes)
 * contain no brackets.
 *
 * @param {string} source
 * @param {string} key
 * @returns {string} the entry, brackets included
 */
export function sliceEntry(source, key) {
  const start = source.indexOf(`["${key}",`)
  if (start === -1) throw new GlyphPatchError(`anchor not found: ["${key}",`)
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new GlyphPatchError(`unterminated entry for ["${key}",`)
}

/**
 * Clone the `permissive` glyph entry onto the `permissive-full` key.
 *
 * @param {string} source the bundle's text
 * @returns {{ changed: boolean, source: string, entry: string | null }}
 *   `changed: false` means the target key was already present (idempotent no-op).
 */
export function applyGlyphPatch(source) {
  if (source.includes(`["${TARGET_KEY}",`)) return { changed: false, source, entry: null }
  const sourceEntry = sliceEntry(source, SOURCE_KEY)
  if (!sourceEntry.includes('svg')) {
    throw new GlyphPatchError(`the ["${SOURCE_KEY}",] entry does not look like a glyph`)
  }
  const clonedEntry = sourceEntry.replace(`["${SOURCE_KEY}",`, `["${TARGET_KEY}",`)
  return { changed: true, source: source.replace(sourceEntry, `${sourceEntry},\n\t\t\t${clonedEntry}`), entry: clonedEntry }
}

/** Resolve the bundle to patch, or throw with an explanation. */
export function findBundle(argv, where) {
  const explicit = argv.slice(2).find((arg) => !arg.startsWith('-'))
  if (explicit !== undefined && explicit !== '') {
    const p = resolve(explicit)
    if (!existsSync(p)) throw new GlyphPatchError(`no such file: ${p}`)
    return p
  }
  for (const candidate of candidateBundles(where)) {
    if (existsSync(candidate)) return candidate
  }
  throw new GlyphPatchError(
    'could not locate @deepseek-ai/dsh-client-ui-conversation.\n' +
    'Pass the bundle path explicitly:\n' +
    `  ${argv[1] ?? 'dsh-perm-gate-patch-glyph'} <…>/dsh-client-ui-conversation/lib/client.js`,
  )
}

function main(argv) {
  const check = argv.includes('--check')
  const where = {
    execDir: dirname(process.execPath),
    cwd: process.cwd(),
    dshHome: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  }

  const bundle = findBundle(argv, where)
  const original = readFileSync(bundle, 'utf8')
  const { changed, source: patched } = applyGlyphPatch(original)

  if (!changed) {
    process.stdout.write(`patch-permission-glyph: ["${TARGET_KEY}",] already present in\n  ${bundle}\n`)
    return 0
  }
  if (check) {
    process.stdout.write(
      `patch-permission-glyph: ["${TARGET_KEY}",] is MISSING from\n  ${bundle}\n` +
      '  (--check: nothing written; re-run without --check to apply)\n',
    )
    return 1
  }

  // Back up once, then write.
  const backup = `${bundle}.bak-permgate-glyph`
  if (!existsSync(backup)) copyFileSync(bundle, backup)
  writeFileSync(bundle, patched, 'utf8')

  // Fail loudly rather than leaving a broken bundle behind.
  try {
    execFileSync(process.execPath, ['--check', bundle], { stdio: 'pipe' })
  } catch (error) {
    copyFileSync(backup, bundle)
    throw new GlyphPatchError(`syntax check failed; restored the backup.\n${String(error?.stderr ?? error)}`)
  }

  process.stdout.write(
    `patch-permission-glyph: added ["${TARGET_KEY}",] to\n  ${bundle}\n` +
    `  backup: ${backup}\n` +
    '  NOTE: this edits a DSH package — re-run after any DSH upgrade or reinstall.\n',
  )
  return 0
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv)
  } catch (error) {
    process.stderr.write(`patch-permission-glyph: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
