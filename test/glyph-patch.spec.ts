/**
 * Guard for `scripts/patch-permission-glyph.mjs` — the host-bundle patch that
 * gives this plugin's two composer tiers the glyphs of the built-in tiers whose
 * file sandbox they share.
 *
 * Why this test exists: the composer's glyph map is a CLOSED closure variable
 * with no plugin-facing seam, so the only way to give a plugin tier an icon is
 * to splice an entry into the DSH bundle text. A splice done by string index is
 * exactly the kind of code that fails silently — the first version scanned from
 * the wrong bracket and produced a syntactically broken bundle, which only the
 * script's own `node --check` guard caught. These tests pin the properties that
 * make the splice safe — a bracket-balanced slice, idempotency, all-or-nothing
 * application, verbatim cloning — plus every refusal path, so a future edit to
 * the slicer fails here instead of in someone's harness.
 *
 * The anchor-resolution cases exist because of a real drift: DSH 0.1.2 keyed a
 * glyph `["permissive",]` and 0.1.5-rc.2 does not carry that value anywhere, so
 * a patch that concatenated its anchor died with "anchor not found" on the very
 * host it was meant to fix. The map now keys `danger-full-access` through the
 * constant `FULL_ACCESS` instead. The live-host case at the bottom is the
 * tripwire for the next such change.
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
  GLYPH_TARGETS,
  glyphKeys,
  GlyphPatchError,
  pageConstants,
  resolveAnchor,
  sliceEntry,
} from '../scripts/patch-permission-glyph.mjs'

/**
 * A stand-in for the 0.1.5-rc.2 map, mirroring its shape: JSX-ish calls, nested
 * brackets, and one entry keyed by an in-page constant rather than a literal.
 */
const FIXTURE = [
  '\t\tconst FULL_ACCESS = "danger-full-access";',
  '\t\tconst permissionGlyphs = new Map([',
  '\t\t\t["read-only", (0, jsx.jsxs)("svg", { children: [(0, jsx.jsx)("path", { d: "M1 2L3 4H5" })] })],',
  '\t\t\t["workspace-write", (0, jsx.jsxs)("svg", {',
  '\t\t\t\tchildren: [(0, jsx.jsx)("path", { d: "M8.2 4.5C8.2 4.5 6.5 5.5 6.5 7.5Z" }), (0, jsx.jsx)("circle", { r: "1.2" })],',
  '\t\t\t\t"aria-hidden": true,',
  '\t\t\t})],',
  '\t\t\t[FULL_ACCESS, (0, jsx.jsxs)("svg", { children: [(0, jsx.jsx)("path", { d: "M9.1 4.5V8.8H7.6V4.5Z" })] })],',
  '\t\t]);',
  '\t\tfunction permissionGlyph(value) { return permissionGlyphs.get(value); }',
  '',
].join('\n')

/** The declared source key for a target, read from the script's own table. */
function sourceKeyOf(target: string): string {
  const entry = GLYPH_TARGETS.find((pair) => pair.target === target)
  if (entry === undefined) throw new Error(`no declared source for "${target}"`)
  return entry.source
}

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

  it('probes the profile scopes before the CLI install', () => {
    // Order is load-bearing on a host with two DSH installs: the profile scope
    // serves the UI, while the global CLI install beside `node` merely exists.
    // Measured: an older order patched the CLI copy, reported success, and left
    // the picker icon-free.
    const candidates = candidateBundles(where)
    expect(candidates[0]).toBe(join('/work', 'node_modules', '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js'))
    expect(candidates[1]).toBe(join('/home/u/.dsh', 'profiles', 'node_modules', '@deepseek-ai', 'dsh-client-ui-conversation', 'lib', 'client.js'))
    expect(candidates[2]).toContain(join('/opt/node', 'node_modules'))
    expect(candidates[3]).toContain(join('@deepseek-ai', 'dsh', 'node_modules'))
  })

  it('covers every layout a stock install presents', () => {
    const candidates = candidateBundles(where)
    expect(candidates).toHaveLength(4)
    expect(candidates.every(isAbsolute)).toBe(true)
    // Derived from the running node binary and the caller's DSH home — never from
    // a hardcoded nvm version or install path. Compared through `join` because the
    // separators are platform-specific.
    const roots = [where.execDir, where.cwd, where.dshHome].map((root) => join(root))
    for (const candidate of candidates) {
      expect(roots.some((root) => candidate.startsWith(root))).toBe(true)
    }
  })
})

describe('pageConstants', () => {
  it('reads an in-page string constant as name -> value', () => {
    expect(pageConstants(FIXTURE).get('FULL_ACCESS')).toBe('danger-full-access')
  })

  it('keeps the first declaration of a name', () => {
    const shadowed = 'const K = "first";\nconst K = "second";\n'
    expect(pageConstants(shadowed).get('K')).toBe('first')
  })
})

describe('glyphKeys', () => {
  it('reports the keys the map renders, resolving constant-keyed entries', () => {
    // The whole point of parsing the map: a refusal must name the keys this host
    // does carry, and `danger-full-access` is spelled `[FULL_ACCESS,` in the text.
    expect(glyphKeys(FIXTURE)).toEqual(['read-only', 'workspace-write', 'danger-full-access'])
  })

  it('refuses a bundle with no glyph map at all', () => {
    expect(() => glyphKeys('const nothing = 1;\n')).toThrow(GlyphPatchError)
  })
})

describe('resolveAnchor', () => {
  it('prefers the string literal when the host keys by value', () => {
    expect(resolveAnchor(FIXTURE, 'workspace-write').anchor).toBe('["workspace-write",')
  })

  it('falls back to the constant alias the bundle actually uses', () => {
    // 0.1.5-rc.2 keys this entry `[FULL_ACCESS,`, so a literal-only probe would
    // report a false "no glyph for danger-full-access".
    expect(resolveAnchor(FIXTURE, 'danger-full-access').anchor).toBe('[FULL_ACCESS,')
  })

  it('names the keys the map does carry when a source key is gone', () => {
    // The 0.1.2 -> 0.1.5 drift, reproduced: `permissive` is no longer a key.
    expect(() => resolveAnchor(FIXTURE, 'permissive')).toThrow(/read-only/)
    expect(() => resolveAnchor(FIXTURE, 'permissive')).toThrow(/danger-full-access/)
  })

  it('refuses a key that maps to a constant the map does not use', () => {
    const orphan = 'const DANGER = "danger-full-access";\nconst p = new Map([["read-only", 1]]);\n'
    expect(() => resolveAnchor(orphan, 'danger-full-access')).toThrow(/anchor not found/)
  })
})

describe('sliceEntry', () => {
  it('returns the whole entry, brackets included', () => {
    const entry = sliceEntry(FIXTURE, '["workspace-write",')
    expect(entry.startsWith('["workspace-write",')).toBe(true)
    expect(entry.endsWith(')]')).toBe(true)
    expect(entry).toContain('circle')
  })

  it('stops at the entry boundary, not at the next one', () => {
    const entry = sliceEntry(FIXTURE, '["workspace-write",')
    // The following entry must NOT be swallowed — that is the exact failure a
    // wrong starting bracket produces.
    expect(entry).not.toContain('FULL_ACCESS')
    expect(isBalanced(entry)).toBe(true)
  })

  it('refuses an unterminated entry', () => {
    expect(() => sliceEntry('\t["workspace-write", (0, jsx.jsx)("svg", {', '["workspace-write",')).toThrow(GlyphPatchError)
  })

  it('refuses a missing anchor instead of returning garbage', () => {
    expect(() => sliceEntry(FIXTURE, '["nope",')).toThrow(GlyphPatchError)
  })
})

describe('applyGlyphPatch', () => {
  it('adds every declared target', () => {
    const { changed, source, added } = applyGlyphPatch(FIXTURE)
    expect(changed).toBe(true)
    expect(added).toEqual(GLYPH_TARGETS.map((pair) => pair.target))
    for (const { target } of GLYPH_TARGETS) expect(source).toContain(`["${target}",`)
  })

  it('clones each target from its declared source, key apart', () => {
    const { source } = applyGlyphPatch(FIXTURE)
    for (const { target, source: sourceKey } of GLYPH_TARGETS) {
      const anchor = resolveAnchor(FIXTURE, sourceKey).anchor
      const sourceEntry = sliceEntry(FIXTURE, anchor)
      const clonedEntry = sliceEntry(source, `["${target}",`)
      expect(clonedEntry).toBe(sourceEntry.replace(anchor, `["${target}",`))
    }
  })

  it('leaves the bundle syntactically intact', () => {
    // The regression that actually bit: a mis-sliced splice produced an
    // unparseable bundle. Balance is the cheap local proxy for `node --check`.
    const { source } = applyGlyphPatch(FIXTURE)
    expect(isBalanced(source)).toBe(true)
    expect(source).toContain('function permissionGlyph')
    expect(source.split('["permissive-full",')).toHaveLength(2)
  })

  it('splices a `$`-bearing entry verbatim', () => {
    // `String.replace` expands `$&`/`$1` in a *string* replacement; the splice
    // uses a function so a glyph whose path data contains `$` survives intact.
    // Built with a function replacement too — a string one expands `$&` here,
    // in the fixture, and then the case proves nothing about the splice.
    const tricky = FIXTURE.replace('M1 2L3 4H5', () => 'M1 2L3 4H5$&$1')
    const { source } = applyGlyphPatch(tricky)
    expect(source).toContain('M1 2L3 4H5$&$1')
  })

  it('is idempotent — a second run is an exact no-op', () => {
    const once = applyGlyphPatch(FIXTURE).source
    const twice = applyGlyphPatch(once)
    expect(twice.changed).toBe(false)
    expect(twice.source).toBe(once)
    expect(twice.already).toEqual(GLYPH_TARGETS.map((pair) => pair.target))
  })

  it('refuses a source entry that is not a glyph', () => {
    const notAGlyph = 'const permissionGlyphs = new Map([["workspace-write", { value: 1 }]]);\n'
    expect(() => applyGlyphPatch(notAGlyph)).toThrow(GlyphPatchError)
  })

  it('applies nothing when one declared source is missing', () => {
    // All-or-nothing: a bundle carrying only one of the two sources must not get
    // a half-glyphed map written to disk.
    const missingWrite = FIXTURE.replace(/^\t\t\t\["workspace-write".*\n/m, '')
    expect(() => applyGlyphPatch(missingWrite)).toThrow(/workspace-write/)
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

  it.skipIf(!available)('still carries a glyph for every declared source key', () => {
    // If DSH ever renames or drops one of these entries, the patch silently stops
    // doing anything. On a machine without a DSH install the check is skipped
    // rather than failing the suite.
    const text = readFileSync(String(bundle), 'utf8')
    for (const { source: sourceKey } of GLYPH_TARGETS) {
      const { anchor } = resolveAnchor(text, sourceKey)
      const entry = sliceEntry(text, anchor)
      expect(entry).toContain('svg')
      expect(isBalanced(entry)).toBe(true)
    }
  })

  it.skipIf(!available)('never carries only one of the declared targets', () => {
    // State-agnostic on purpose: an unpatched host carries none of our keys and a
    // patched one carries all of them. Exactly one is the half-glyphed bundle the
    // all-or-nothing splice exists to prevent — and it is also what a hand edit to
    // the host, or a partially restored backup, would leave behind.
    const text = readFileSync(String(bundle), 'utf8')
    const present = GLYPH_TARGETS.filter(({ target }) => text.includes(`["${target}",`))
    expect([0, GLYPH_TARGETS.length]).toContain(present.length)
  })
})
