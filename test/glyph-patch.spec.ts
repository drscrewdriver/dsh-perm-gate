/**
 * Guard for `scripts/patch-permission-glyph.mjs` — the host-bundle patch that
 * gives `permissive-full` the same composer glyph as `permissive`.
 *
 * Why this test exists: the composer's glyph map is a CLOSED closure variable
 * with no plugin-facing seam, so the only way to give a plugin tier an icon is
 * to splice an entry into the DSH bundle text. A splice done by string index is
 * exactly the kind of code that fails silently — the first version scanned from
 * the wrong bracket and produced a syntactically broken bundle, which only the
 * script's own `node --check` guard caught. These tests pin the two properties
 * that make the splice safe (a bracket-balanced slice, and idempotency) plus
 * every refusal path, so a future edit to the slicer fails here instead of in
 * someone's harness.
 *
 * The script ships inside the package and is exposed as the
 * `dsh-perm-gate-patch-glyph` bin, but it is never run automatically: it edits
 * a **host** package, and a plugin must not rewrite its harness uninvited.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyGlyphPatch,
  candidateBundles,
  findBundle,
  GlyphPatchError,
  sliceEntry,
  SOURCE_KEY,
  TARGET_KEY,
} from '../scripts/patch-permission-glyph.mjs'

/** A stand-in for the real map, mirroring its shape: JSX-ish calls, nested brackets. */
const FIXTURE = [
  '\t\tconst permissionGlyphs = new Map([',
  '\t\t\t["read-only", (0, jsx.jsxs)("svg", { children: [(0, jsx.jsx)("path", { d: "M1 2L3 4H5" })] })],',
  '\t\t\t["permissive", (0, jsx.jsxs)("svg", {',
  '\t\t\t\tchildren: [(0, jsx.jsx)("path", { d: "M8.2 4.5C8.2 4.5 6.5 5.5 6.5 7.5Z" }), (0, jsx.jsx)("circle", { r: "1.2" })],',
  '\t\t\t\t"aria-hidden": true,',
  '\t\t\t})],',
  '\t\t\t["workspace-write", (0, jsx.jsxs)("svg", { children: [] })],',
  '\t\t]);',
  '\t\tfunction permissionGlyph(value) { return permissionGlyphs.get(value); }',
  '',
].join('\n')

/** True when every `[`/`(`/`{` in `source` is matched by its closer. */
function isBalanced(source: string): boolean {
  let depth = 0
  for (const ch of source) {
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth < 0) return false
    }
  }
  return depth === 0
}

describe('candidateBundles', () => {
  const where = { execDir: '/opt/node', cwd: '/work', dshHome: '/home/u/.dsh' }

  it('probes the running node binary first — never a hardcoded install path', () => {
    // Deriving from `process.execPath` is what survives an nvm version change
    // and a re-pointed `C:\nodejs` symlink; a hardcoded path does not.
    const [first] = candidateBundles(where)
    expect(first).toBe(join('/opt/node', 'node_modules', '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js'))
  })

  it('covers every layout a stock install presents', () => {
    const candidates = candidateBundles(where)
    expect(candidates).toHaveLength(4)
    expect(candidates.every(isAbsolute)).toBe(true)
    // The `dsh`-nested scope, the caller's own profile, and the hoisted
    // per-profile scope under DSH_HOME.
    expect(candidates[1]).toContain(join('@deepseek-ai', 'dsh', 'node_modules'))
    expect(candidates[2]).toContain(join('/work'))
    expect(candidates[3]).toContain(join('/home/u/.dsh', 'profiles'))
  })
})

describe('sliceEntry', () => {
  it('returns the whole entry, brackets included', () => {
    const entry = sliceEntry(FIXTURE, SOURCE_KEY)
    expect(entry.startsWith(`["${SOURCE_KEY}",`)).toBe(true)
    expect(entry.endsWith(')]')).toBe(true)
    expect(entry).toContain('circle')
  })

  it('stops at the entry boundary, not at the next one', () => {
    const entry = sliceEntry(FIXTURE, SOURCE_KEY)
    // The following entry must NOT be swallowed — that is the exact failure a
    // wrong starting bracket produces.
    expect(entry).not.toContain('workspace-write')
    expect(isBalanced(entry)).toBe(true)
  })

  it('refuses a missing anchor instead of returning garbage', () => {
    expect(() => sliceEntry(FIXTURE, 'nope')).toThrow(GlyphPatchError)
  })

  it('refuses an unterminated entry', () => {
    expect(() => sliceEntry('\t["permissive", (0, jsx.jsx)("svg", {', SOURCE_KEY)).toThrow(GlyphPatchError)
  })
})

describe('applyGlyphPatch', () => {
  it('clones the permissive entry onto the target key', () => {
    const { changed, source } = applyGlyphPatch(FIXTURE)
    expect(changed).toBe(true)
    expect(source).toContain(`["${TARGET_KEY}",`)
    // The clone is byte-identical to the source entry apart from the key.
    const sourceEntry = sliceEntry(FIXTURE, SOURCE_KEY)
    const clonedEntry = sliceEntry(source, TARGET_KEY)
    expect(clonedEntry).toBe(sourceEntry.replace(`["${SOURCE_KEY}",`, `["${TARGET_KEY}",`))
  })

  it('leaves the bundle syntactically intact', () => {
    // The regression that actually bit: a mis-sliced splice produced an
    // unparseable bundle. Balance is the cheap local proxy for `node --check`.
    const { source } = applyGlyphPatch(FIXTURE)
    expect(isBalanced(source)).toBe(true)
    expect(source).toContain('function permissionGlyph')
    expect(source.split(`["${TARGET_KEY}",`)).toHaveLength(2)
  })

  it('is idempotent — a second run is an exact no-op', () => {
    const once = applyGlyphPatch(FIXTURE).source
    const twice = applyGlyphPatch(once)
    expect(twice.changed).toBe(false)
    expect(twice.source).toBe(once)
  })

  it('refuses an anchor that is not a glyph', () => {
    const notAGlyph = '\t["permissive", { value: 1 }],\n'
    expect(() => applyGlyphPatch(notAGlyph)).toThrow(GlyphPatchError)
  })
})

describe('live host bundle', () => {
  const where = {
    execDir: dirname(process.execPath),
    cwd: process.cwd(),
    dshHome: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  }
  let bundle: string | undefined
  try {
    bundle = findBundle(['node', 'patch-permission-glyph'], where)
  } catch {
    bundle = undefined
  }
  const available = bundle !== undefined && existsSync(bundle)

  it.skipIf(!available)('still exposes the permissive anchor DSH renders the glyph from', () => {
    // If DSH ever renames or drops this entry, the patch silently stops doing
    // anything. On a machine without a DSH install the check is skipped rather
    // than failing the suite.
    const entry = sliceEntry(readFileSync(String(bundle), 'utf8'), SOURCE_KEY)
    expect(entry).toContain('svg')
    expect(isBalanced(entry)).toBe(true)
  })
})
