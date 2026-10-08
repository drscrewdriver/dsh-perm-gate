/**
 * Settings-seat contract pin for dsh-perm-gate's browser half.
 *
 * Consolidated-seat reality (2026-10-08 family-insection 定案, replaces the
 * 2026-10-07 three-seat spread):
 *   - `dsh-family.tab`        — the ONLY settings seat: a contributor tab inside
 *     the 起子插件设置 family section (TL `dsh-family`). The former top-level
 *     `settings.section` (sidebar), `settings.plugins.tab` (plugins-page tab,
 *     rendered on 0.1.0 too) and `settings.plugin.item` (≤0.1.5 dispatch card)
 *     duplicated that surface three times and are all removed — the family tab
 *     is the single entry. Kept non-settings seats: `plugins.bundle.config`
 *     (0.2.0 bundle detail page) and `shell.overlay` (0.1.0/0.1.1 gear fallback).
 *   - The tab renders the same PermissiveCard with the same dual-source scope
 *     (native handle first, BridgeDocHandle fallback). Migrate src/client/index.ts
 *     AND this file together when a DSH line moves a seat; assertions fail on drift.
 */
import { describe, expect, it } from 'vitest'
import { apply, inject as declaredInject } from '../src/client/index.ts'
import { PermissiveCard } from '../src/client/card.tsx'

interface CapturedRegistration {
  readonly slot: string
  readonly options: Record<string, unknown>
  readonly component: unknown
}

/** Drive apply against a stub host and capture every slot registration. */
function collectRegistrations(): { declared: string[]; registrations: CapturedRegistration[]; scope: unknown } {
  const declared: string[] = []
  const registrations: CapturedRegistration[] = []
  // Modern-line posture only (configForms present, settingsScope absent — the
  // two durable-settings faces are generation-exclusive, see src/client/compat.ts).
  const scope = { getSnapshot: () => ({ status: 'ready', value: {}, writable: true }), subscribe: () => () => {}, set: () => {}, unset: () => {} }
  const services: Record<string, unknown> = { configForms: { get: () => scope } }
  const ctx = {
    effect: (build: () => unknown) => { void build(); return () => {} },
    inject: (names: readonly string[], fn: (resolved: unknown) => void) => {
      const resolved = names.map((n) => services[n])
      if (resolved.some((r) => r === undefined)) return () => {} // absent service: fiber waits, nothing fires
      fn(resolved.length === 1 ? resolved[0] : resolved)
      return () => {}
    },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    slots: {
      inject: (slot: string, factory: () => (() => void) | Generator<() => void>) => {
        declared.push(slot)
        const result = factory()
        const steps: Iterable<() => void> = typeof (result as IteratorObject)?.[Symbol.iterator] === 'function'
          ? (result as Generator<() => void>)
          : [result as () => void]
        for (const step of steps) { void step }
        return () => {}
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ slot: String(options['name']), options, component })
        return () => {}
      },
    },
  }
  apply(ctx as never)
  return { declared, registrations, scope }
}

describe('settings-seat contract (single family in-section tab)', () => {
  it('declares generation-neutral plugin-level inject only (no durable-settings face)', () => {
    // configForms (0.1.7+) / settingsScope (≤0.1.5) are generation-exclusive:
    // keeping either in the plugin-level inject list silently kills the whole
    // browser half on the other line. They resolve via scoped sub-injects.
    expect(declaredInject).toEqual(['slots', 'locale'])
  })

  it('registers dsh-family.tab once and none of the removed seats', () => {
    const { declared, registrations } = collectRegistrations()
    expect(declared.filter(slot => slot === 'dsh-family.tab')).toHaveLength(1)
    // The three former seats must stay gone — they duplicated the family tab
    // (sidebar 自动审查门 + plugins-page tab + ≤0.1.5 dispatch card).
    for (const gone of ['settings.section', 'settings.plugins.tab', 'settings.plugin.item']) {
      expect(declared).not.toContain(gone)
      expect(registrations.find(r => r.slot === gone)).toBeUndefined()
    }
  })

  it('keeps the non-settings seats (bundle detail card + shell overlay)', () => {
    const { registrations } = collectRegistrations()
    expect(registrations.find(r => r.slot === 'plugins.bundle.config')).toBeDefined()
    expect(registrations.find(r => r.slot === 'shell.overlay')).toBeDefined()
  })

  it('pins the family-tab identity (id/order/label/locale) and the card component', () => {
    const { registrations, scope } = collectRegistrations()
    const reg = registrations.find(r => r.slot === 'dsh-family.tab')!
    const { options, component } = reg
    expect(options['id']).toBe('dsh-perm-gate')
    expect(options['order']).toBe(45)
    expect(options['locale']).toBe('dsh-perm-gate')
    // Read-time label thunk: follows the active locale without re-registration.
    expect((options['label'] as () => string)()).toBe('section.title')
    expect(typeof options['inject']).toBe('function')
    const face = (options['inject'] as () => Record<string, unknown>)()
    expect(Object.keys(face)).toEqual(['scope'])
    // Dual-source scope: with configForms present the native handle wins; the
    // BridgeDocHandle fallback only engages when neither face resolves (0.1.5
    // settingsScope never resolves — see T10b verdict in the plan docs).
    expect(face['scope']).toBe(scope)
    expect(component).toBe(PermissiveCard)
  })
})
