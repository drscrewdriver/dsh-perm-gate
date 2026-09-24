#!/usr/bin/env node
/**
 * Give this plugin's own permission tiers the composer glyphs the host will not
 * draw for them.
 *
 * WHY THIS EXISTS
 * ---------------
 * The composer's permission picker renders an icon per preset, looked up in a
 * CLOSED map inside `@deepseek-ai/dsh-client-ui-conversation`:
 *
 *     const permissionGlyphs = new Map([
 *       ["read-only", <svg …/>],
 *       ["workspace-write", <svg …/>],
 *       [FULL_ACCESS, <svg …/>],      // const FULL_ACCESS = "danger-full-access"
 *     ]);
 *     function permissionGlyph(value) { return permissionGlyphs.get(value); }
 *
 * The source comment states the rule: "host-configured names outside the design
 * set get none." There is no plugin-facing seam — the option objects the host
 * supplies carry only `{value, name, description}`, and the map itself is a
 * closure variable. So a plugin-contributed tier renders with no icon in the
 * dropdown and falls back to plain text in the trigger.
 *
 * The only way to give our tiers the same glyph is to add entries to that map.
 * This script does exactly that — one glyph per tier, copied from the built-in
 * tier whose file sandbox the plugin tier shares:
 *
 *     permissive       sandbox: workspace-write    <- the ["workspace-write",] entry
 *     permissive-full  sandbox: danger-full-access <- the [FULL_ACCESS,] entry
 *
 * WHY THE SOURCES ARE DECLARED AND THE ANCHOR IS RESOLVED
 * -------------------------------------------------------
 * DSH 0.1.2 shipped four glyphs, `permissive` among them; 0.1.5-rc.2 ships three
 * (`read-only` / `workspace-write` / `danger-full-access`) and the string
 * `permissive` no longer occurs anywhere in the bundle — so a splice anchored on
 * `["permissive",` dies with "anchor not found" on the current host. Two
 * properties keep this working across such a design-set change:
 *
 *   1. the source key is a declaration (`GLYPH_TARGETS`) rather than a literal
 *      buried in the splice, so re-pointing a tier is a one-line edit; and
 *   2. the anchor for a key is RESOLVED, not assumed to be a string literal:
 *      `["<key>",` first, then the constant alias the bundle may use instead
 *      (`[FULL_ACCESS,` for `"danger-full-access"`).
 *
 * When a declared source key is gone, the refusal names the keys the map DOES
 * carry, so the next drift is diagnosed from the error text alone.
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
 * With no argument it probes the profile scopes first and the CLI install second,
 * and lists any other DSH install that carries the same bundle — on a host with
 * both, only one of them serves the UI, so the explicit-path form is the answer
 * when the probe picks the wrong one. The script is idempotent (a second run is a
 * no-op), backs the file up once, applies every target or none, and refuses to
 * write a bundle it cannot slice correctly, so it can never half-apply.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Relative path from a package root to the bundle holding the map. */
const BUNDLE = join('@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js')

/**
 * The glyphs to add: each plugin tier, and the built-in tier it copies.
 *
 * The pairing is by file-sandbox meaning, not by name similarity — `permissive`
 * runs in the same sandbox as `workspace-write`, `permissive-full` in the same
 * sandbox as `danger-full-access` — so the icon a user sees matches the access
 * the tier actually grants. A tier listed here gets that built-in's entry
 * verbatim apart from its key.
 */
export const GLYPH_TARGETS = [
  { target: 'permissive', source: 'workspace-write' },
  { target: 'permissive-full', source: 'danger-full-access' },
]

/** Thrown for every refusal; the CLI turns it into an exit code 1. */
export class GlyphPatchError extends Error {}

/**
 * Candidate bundle paths, most specific first. Pure: no filesystem access, so
 * the probe order is unit-testable.
 *
 * Profile scope before CLI-install scope, and that order is load-bearing on a
 * machine with more than one DSH: a profile's UI is served by the profile's own
 * dependency scope, not by whichever global CLI install happens to sit beside the
 * running `node`. Measured on this project's own host — a global install under
 * `dirname(node)` existed and shadowed the profile's bundle under an older probe
 * order, so the patch reported success while the picker stayed icon-free. On a
 * stock single-install machine every candidate is one inode, so the order decides
 * nothing there; it only matters exactly when guessing wrong is silent.
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
    // 1. Whatever profile the caller is standing in.
    join(cwd, 'node_modules', BUNDLE),
    // 2. The hoisted scope every profile under DSH_HOME shares.
    join(dshHome, 'profiles', 'node_modules', BUNDLE),
    // 3. `@deepseek-ai` scope hoisted beside the running node binary.
    join(execDir, 'node_modules', BUNDLE),
    // 4. The same scope nested inside the `dsh` package itself.
    join(execDir, 'node_modules', '@deepseek-ai', 'dsh', 'node_modules', BUNDLE),
  ]
}

/**
 * In-page string constants (`const FULL_ACCESS = "danger-full-access"`), as
 * name -> value. First declaration wins, so a later reassignment cannot shadow
 * the spelling the map was built with above it.
 *
 * The bundle may key a map entry by such a name rather than by a literal, which
 * is the whole reason the anchor is resolved instead of concatenated.
 *
 * @param {string} source
 * @returns {Map<string, string>} constant name -> its string value
 */
export function pageConstants(source) {
  const constants = new Map()
  for (const match of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    if (!constants.has(match[1])) constants.set(match[1], match[2])
  }
  return constants
}

/**
 * The `permissionGlyphs` map's text, brackets included.
 *
 * Parsed rather than assumed: the map is a `new Map([ … ])` closure variable, so
 * its extent is found by bracket depth from its `[`. Reading the map (instead of
 * only probing for one anchor inside it) is what lets a refusal report the keys
 * the host actually renders.
 *
 * @param {string} source
 * @returns {string} the map array text, from `[` to the matching `]`
 */
export function glyphMapText(source) {
  const start = source.search(/permissionGlyphs\s*=\s*new Map\(\s*\[/)
  if (start === -1) throw new GlyphPatchError('permissionGlyphs map not found in this bundle')
  const open = source.indexOf('[', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  throw new GlyphPatchError('unterminated permissionGlyphs map')
}

/**
 * The preset values the map renders a glyph for — literals as-is, and entries
 * keyed by an in-page constant resolved to that constant's value.
 *
 * @param {string} source
 * @returns {string[]} e.g. `['read-only', 'workspace-write', 'danger-full-access']`
 */
export function glyphKeys(source) {
  const constants = pageConstants(source)
  const keys = []
  for (const match of glyphMapText(source).matchAll(/\[\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*,/g)) {
    if (match[1] !== undefined) keys.push(match[1])
    else keys.push(constants.get(match[2]) ?? match[2])
  }
  return keys
}

/**
 * Resolve the anchor text of one map entry, literal first, constant alias second.
 *
 * @param {string} source the bundle's text
 * @param {string} key the preset value, e.g. `danger-full-access`
 * @returns {{ anchor: string, index: number }}
 * @throws {GlyphPatchError} when the host renders no glyph for `key`
 */
export function resolveAnchor(source, key) {
  for (const anchor of [`["${key}",`, `['${key}',`]) {
    const index = source.indexOf(anchor)
    if (index !== -1) return { anchor, index }
  }
  const name = [...pageConstants(source)].find(([, value]) => value === key)?.[0]
  if (name !== undefined) {
    const anchor = `[${name},`
    const index = source.indexOf(anchor)
    if (index !== -1) return { anchor, index }
    throw new GlyphPatchError(
      `anchor not found: ${anchor} (the alias for "${key}")`,
    )
  }
  throw new GlyphPatchError(
    `this host renders no glyph for "${key}" — the map carries: ` +
    `${glyphKeys(source).map((k) => `"${k}"`).join(', ')}\n` +
    '  Re-point GLYPH_TARGETS at a key the map does carry.',
  )
}

/**
 * Extract the full `["<key>", …]` (or `[CONST, …]`) map entry, by bracket depth.
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
 * @param {string} anchor the text returned by {@link resolveAnchor}
 * @returns {string} the entry, brackets included
 */
export function sliceEntry(source, anchor) {
  const start = source.indexOf(anchor)
  if (start === -1) throw new GlyphPatchError(`anchor not found: ${anchor}`)
  let depth = 0
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new GlyphPatchError(`unterminated entry for ${anchor}`)
}

/**
 * Splice every declared glyph into the map.
 *
 * All or nothing: a source key this host does not carry throws before the caller
 * can write anything, so a partially-glyphed bundle is impossible. Idempotent
 * per target — a target already present is left untouched and reported as such.
 *
 * @param {string} source the bundle's text
 * @returns {{ changed: boolean, source: string, added: string[], already: string[] }}
 */
export function applyGlyphPatch(source) {
  let next = source
  const added = []
  const already = []

  for (const { target, source: sourceKey } of GLYPH_TARGETS) {
    if (next.includes(`["${target}",`)) {
      already.push(target)
      continue
    }
    const { anchor } = resolveAnchor(next, sourceKey)
    const sourceEntry = sliceEntry(next, anchor)
    if (!sourceEntry.includes('svg')) {
      throw new GlyphPatchError(`the ${anchor} entry does not look like a glyph`)
    }
    const clonedEntry = sourceEntry.replace(anchor, `["${target}",`)
    // A function replacement: the entry is spliced verbatim, `$` never expanded.
    next = next.replace(sourceEntry, () => `${sourceEntry},\n\t\t\t${clonedEntry}`)
    added.push(target)
  }

  return { changed: added.length > 0, source: next, added, already }
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

/**
 * A warning block naming the other DSH installs that carry this bundle.
 *
 * Reported rather than patched: on a host with a global CLI install and a
 * launcher-managed runtime, only one of them serves the UI in front of the user,
 * and picking the wrong one is invisible — the patch succeeds and the picker
 * stays icon-free. Naming the others turns that into a one-line fix (pass the
 * path explicitly).
 *
 * @param {string[]} others bundle paths that exist but were not chosen
 * @returns {string} an empty string when there is nothing to report
 */
function describeOtherInstalls(others) {
  if (others.length === 0) return ''
  return `  note: ${others.length} other DSH install(s) carry this bundle — NOT patched:\n` +
    others.map((path) => `    ${path}\n`).join('') +
    '  If the tier still has no icon, the UI is served by one of those; re-run with\n' +
    '  that path as the argument.\n'
}

function main(argv) {
  const check = argv.includes('--check')
  const explicit = argv.slice(2).find((arg) => !arg.startsWith('-'))
  const where = {
    execDir: dirname(process.execPath),
    cwd: process.cwd(),
    dshHome: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  }

  const bundle = findBundle(argv, where)
  const others = explicit === undefined
    ? candidateBundles(where).filter((candidate) => candidate !== bundle && existsSync(candidate))
    : []
  const otherNote = describeOtherInstalls(others)
  const original = readFileSync(bundle, 'utf8')
  const { changed, source: patched, added, already } = applyGlyphPatch(original)

  if (!changed) {
    process.stdout.write(
      `patch-permission-glyph: all glyphs already present in\n  ${bundle}\n` +
      `  present: ${already.map((key) => `["${key}",]`).join(' ')}\n` +
      otherNote,
    )
    return 0
  }
  if (check) {
    process.stdout.write(
      `patch-permission-glyph: MISSING ${added.map((key) => `["${key}",]`).join(' ')} from\n  ${bundle}\n` +
      `  present: ${already.length > 0 ? already.map((key) => `["${key}",]`).join(' ') : '(none)'}\n` +
      '  (--check: nothing written; re-run without --check to apply)\n' +
      otherNote,
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
    `patch-permission-glyph: added ${added.map((key) => `["${key}",]`).join(' ')} to\n  ${bundle}\n` +
    already.map((key) => `  already present: ["${key}",]\n`).join('') +
    `  backup: ${backup}\n` +
    '  NOTE: this edits a DSH package — re-run after any DSH upgrade or reinstall.\n' +
    otherNote,
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
