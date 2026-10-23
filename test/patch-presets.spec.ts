/**
 * Guard for `cordis.patch.yml`'s `permission.config.presets` map.
 *
 * Why this test exists: the DSH bundle patch REPLACES that whole map rather
 * than merging per key, so a tier missing from this file silently disappears
 * from the permission picker on the next profile load. These assertions pin
 * the exact key set and the built-in knobs, so an accidental drop (or the
 * reintroduction of a retired tier) fails here instead of in the UI.
 *
 * They also pin the cross-check between the two sources of truth: `src/preset.ts`
 * declares which tiers the gate acts in and which modes those tiers ship with, and
 * this file declares that the tiers exist at all. Either half drifting alone leaves a
 * dropdown option that silently does nothing.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { DEFAULT_GATE_PRESETS } from '../src/preset.js'
import { MODE_PRESETS, UNATTENDED_MODES } from '../src/unattended.js'

/** One loader patch entry as far as this file cares. */
interface PatchEntry {
  id?: string
  config?: { presets?: Record<string, { sandbox?: string; approval?: string; name?: string; description?: string }> }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const PATCH_PATH = join(HERE, '..', 'cordis.patch.yml')

const entries = parse(readFileSync(PATCH_PATH, 'utf8')) as PatchEntry[]
const permission = entries.find((entry) => entry.id === 'permission')
const presets = permission?.config?.presets ?? {}

describe('cordis.patch.yml permission presets', () => {
  it('declares the permission entry with a presets map', () => {
    expect(permission).toBeDefined()
    expect(Object.keys(presets).length).toBeGreaterThan(0)
  })

  it('restates every built-in tier of @deepseek-ai/dsh-base', () => {
    // dsh-base/cordis.patch.yml (`id: permission`) is the authoritative set.
    expect(presets['read-only']).toMatchObject({ sandbox: 'read-only', approval: 'ask' })
    expect(presets['workspace-write']).toMatchObject({ sandbox: 'workspace-write', approval: 'ask' })
    expect(presets['danger-full-access']).toMatchObject({ sandbox: 'danger-full-access', approval: 'never' })
  })

  it('adds the 自动审查 tier with a label and description', () => {
    expect(presets['permissive']).toMatchObject({
      sandbox: 'workspace-write',
      approval: 'ask',
      name: '自动审查（dsh沙箱中）',
    })
    expect(presets['permissive']?.description).toBeTruthy()
  })

  it('adds the full-access 自动审查 tier: same approval, no sandbox restriction', () => {
    // `sandbox` and `approval` are independent knobs. `permissive` keeps the
    // file sandbox, which also denies the named pipes a child needs — git
    // clone, MSYS2 sh.exe and ConPTY fail under it. This tier lifts only the
    // sandbox, keeping the approval behaviour identical.
    expect(presets['permissive-full']).toMatchObject({
      sandbox: 'danger-full-access',
      approval: 'ask',
      name: '自动审查（高权限）',
    })
    expect(presets['permissive-full']?.description).toBeTruthy()
  })

  it('keeps approval: ask on every gate tier (never would defeat the gate)', () => {
    // Under `approval: never` the DSH seam rejects every ask before any
    // answerer runs, so this gate's asks would degrade to passthrough. Any
    // tier the gate claims must therefore stay answerable.
    //
    // Driven off DEFAULT_GATE_PRESETS rather than a literal list: a tier added to the
    // gate's scope without a patch entry (or vice versa) is exactly the drift that makes
    // a dropdown option silently do nothing.
    for (const key of DEFAULT_GATE_PRESETS) {
      expect(presets[key], `cordis.patch.yml is missing the gate tier "${key}"`).toBeDefined()
      expect(presets[key]?.approval, `"${key}" must keep approval: ask`).toBe('ask')
    }
    expect(presets['permissive']?.approval).toBe('ask')
    expect(presets['permissive-full']?.approval).toBe('ask')
  })

  it('gives every unattended implementation a preset to own, and only one', () => {
    // One switch, one implementation, one tier — the mapping is the design. A preset shared
    // by two implementations would make the switches cross no matter what the labels say,
    // and a mode without a declared preset is a switch that does nothing.
    const owners = Object.values(MODE_PRESETS)
    expect(new Set(owners).size).toBe(UNATTENDED_MODES.length)
    for (const mode of UNATTENDED_MODES) {
      const preset = MODE_PRESETS[mode]
      expect(presets[preset], `mode "${mode}" owns an undeclared preset "${preset}"`).toBeDefined()
      expect(DEFAULT_GATE_PRESETS, `"${preset}" is outside the gate's scope`).toContain(preset)
      expect(presets[preset]?.approval).toBe('ask')
    }
  })

  it('lifts the label into the product string while the key stays machine-stable', () => {
    // The 0.1.2 permission surfaces render a host-supplied `name` verbatim and
    // simply title-case a kebab-case name, so the localized label can only come
    // from this one string; the KEY stays `permissive` because `gatePresets`
    // matches keys and the permission projection reports them.
    for (const key of [...DEFAULT_GATE_PRESETS]) {
      const name = presets[key]?.name ?? ''
      expect(name).not.toBe('')
      expect(name).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
    expect(presets['permissive']?.name).toBe('自动审查（dsh沙箱中）')
  })

  it('never uses the reserved `custom` key', () => {
    // Ported from the DSH 0.1.5 line, where the `permission` id is backed by
    // @deepseek-ai/dsh-permission-presets and its PermissionPresetService
    // rejects `custom` as a reserved key. A preset map that grows a `custom`
    // entry therefore throws on load there while staying silent on 0.1.2 —
    // so the reservation is pinned here, on the line both branches share.
    expect(Object.keys(presets)).not.toContain('custom')
  })

  it('does not resurrect the retired auto tier', () => {
    // dsh-auto-mode contributed it; that plugin is uninstalled, its knobs were
    // identical to workspace-write, and this gate is inactive in it.
    expect(Object.keys(presets)).not.toContain('auto')
    expect(Object.keys(presets).sort()).toEqual([
      'danger-full-access',
      'permissive',
      'permissive-full',
      'permissive-mech',
      'permissive-snet',
      'permissive-yolo',
      'read-only',
      'workspace-write',
    ])
  })
})
