/**
 * Guard for `cordis.patch.yml`'s `permission.config.presets` map.
 *
 * Why this test exists: the DSH bundle patch REPLACES that whole map rather
 * than merging per key, so a tier missing from this file silently disappears
 * from the permission picker on the next profile load. These assertions pin
 * the exact key set and the built-in knobs, so an accidental drop (or the
 * reintroduction of a retired tier) fails here instead of in the UI.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

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

  it('adds the Permissive tier with a label and description', () => {
    expect(presets['permissive']).toMatchObject({
      sandbox: 'workspace-write',
      approval: 'ask',
      name: 'Permissive',
    })
    expect(presets['permissive']?.description).toBeTruthy()
  })

  it('does not resurrect the retired auto tier', () => {
    // dsh-auto-mode contributed it; that plugin is uninstalled, its knobs were
    // identical to workspace-write, and this gate is inactive in it.
    expect(Object.keys(presets)).not.toContain('auto')
    expect(Object.keys(presets).sort()).toEqual([
      'danger-full-access',
      'permissive',
      'read-only',
      'workspace-write',
    ])
  })
})
