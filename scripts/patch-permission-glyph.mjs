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
 * THIS IS A PATCH OVER A HOST PACKAGE. It is lost whenever DSH is reinstalled
 * or upgraded. Re-run it afterwards. The script is idempotent (a second run is
 * a no-op), backs the file up once, and refuses to write if it cannot find the
 * anchor, so it can never half-apply.
 *
 * USAGE
 *   node scripts/patch-permission-glyph.mjs [path/to/client.js]
 *
 * With no argument it probes the usual global-install locations.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

/** The map key whose entry is cloned, and the key it is cloned onto. */
const SOURCE_KEY = 'permissive'
const TARGET_KEY = 'permissive-full'

/** Relative path from a DSH package root to the bundle holding the map. */
const BUNDLE = join('@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js')

/** Candidate roots for the DSH install, in probe order. */
function candidates() {
  const out = []
  // 1. Sibling of the running node binary (covers `C:\nodejs\node.exe`).
  out.push(join(dirname(process.execPath), 'node_modules'))
  // 2. This package's own node_modules (when DSH is a local dependency).
  out.push(join(process.cwd(), 'node_modules'))
  // 3. The dsh package's nested @deepseek-ai scope.
  out.push(join(dirname(process.execPath), 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai'))
  return out
}

/** Resolve the bundle to patch, or exit with an explanation. */
function findBundle(argv) {
  const explicit = argv[2]
  if (explicit !== undefined && explicit !== '') {
    const p = resolve(explicit)
    if (!existsSync(p)) fail(`no such file: ${p}`)
    return p
  }
  for (const root of candidates()) {
    // `root` may be a node_modules dir, or already the @deepseek-ai scope.
    const direct = join(root, BUNDLE)
    if (existsSync(direct)) return direct
    const scoped = join(root, '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js')
    if (existsSync(scoped)) return scoped
  }
  fail(
    'could not locate @deepseek-ai/dsh-client-ui-conversation.\n' +
    'Pass the bundle path explicitly:\n' +
    '  node scripts/patch-permission-glyph.mjs <…>/dsh-client-ui-conversation/lib/client.js',
  )
}

function fail(message) {
  process.stderr.write(`patch-permission-glyph: ${message}\n`)
  process.exit(1)
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
 */
function sliceEntry(source, key) {
  const start = source.indexOf(`["${key}",`)
  if (start === -1) fail(`anchor not found: ["${key}",`)
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  fail(`unterminated entry for ["${key}",`)
}

const bundle = findBundle(process.argv)
const original = readFileSync(bundle, 'utf8')

if (original.includes(`["${TARGET_KEY}",`)) {
  process.stdout.write(`patch-permission-glyph: ["${TARGET_KEY}",] already present — nothing to do.\n`)
  process.exit(0)
}

const sourceEntry = sliceEntry(original, SOURCE_KEY)
if (!sourceEntry.includes('svg')) fail(`the ["${SOURCE_KEY}",] entry does not look like a glyph`)

const clonedEntry = sourceEntry.replace(`["${SOURCE_KEY}",`, `["${TARGET_KEY}",`)
const patched = original.replace(sourceEntry, `${sourceEntry},\n\t\t\t${clonedEntry}`)

// Back up once, then write.
const backup = `${bundle}.bak-permgate-glyph`
if (!existsSync(backup)) copyFileSync(bundle, backup)
writeFileSync(bundle, patched, 'utf8')

// Fail loudly rather than leaving a broken bundle behind.
try {
  execFileSync(process.execPath, ['--check', bundle], { stdio: 'pipe' })
} catch (error) {
  copyFileSync(backup, bundle)
  fail(`syntax check failed; restored the backup.\n${String(error?.stderr ?? error)}`)
}

process.stdout.write(
  `patch-permission-glyph: added ["${TARGET_KEY}",] to ${bundle}\n` +
  `  backup: ${backup}\n` +
  '  NOTE: this edits a DSH package — re-run after any DSH upgrade or reinstall.\n',
)
