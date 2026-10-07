/**
 * Settings-seat contract pin for dsh-perm-gate's browser half.
 *
 * Multi-seat reality (2026-10-07 T10b/T12/T13b 定案, all lines verified live):
 *   - `settings.section`      — top-level nav entry (0.1.5 renders via the
 *     settings bridge, 0.1.7 renders via native configForms, 0.2.0 silently
 *     idle — the slot has no consumer there, verified against host source).
 *   - `settings.plugin.item`  — ≤0.1.5 插件配置 tab dispatch card (key=ns ∩
 *     served set; card data falls back to the settings bridge).
 *   - `settings.plugins.tab`  — 0.1.7+/0.2.0「内置插件」page tab (the ONLY
 *     plugin-page entry on 0.2.0, whose shell has no settings.section consumer).
 * All seats render the same PermissiveCard with the same dual-source scope
 * (native handle first, BridgeDocHandle fallback). Migrate src/client/index.ts
 * AND this file together when a DSH line moves a seat; assertions fail on drift.
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

/** The one registration targeting a settings seat (any of the known ones). */
function settingsRegistrationOf(registrations: readonly CapturedRegistration[]): CapturedRegistration | undefined {
  return registrations.find(r =>
    r.slot === 'settings.section' || r.slot === 'settings.plugins.tab' || r.slot === 'settings.plugin.item')
}

describe('settings-seat contract (dedicated top-level settings.section)', () => {
  it('declares generation-neutral plugin-level inject only (no durable-settings face)', () => {
    // configForms (0.1.7+) / settingsScope (≤0.1.5) are generation-exclusive:
    // keeping either in the plugin-level inject list silently kills the whole
    // browser half on the other line. They resolve via scoped sub-injects.
    expect(declaredInject).toEqual(['slots', 'locale'])
  })

  it('injects every per-line seat exactly once (section + plugin.item + plugins.tab)', () => {
    const { declared, registrations } = collectRegistrations()
    for (const seat of ['settings.section', 'settings.plugin.item', 'settings.plugins.tab']) {
      expect(declared.filter(slot => slot === seat)).toHaveLength(1)
    }
    // All three seats present, all rendering the same card component.
    const seats = new Set(['settings.section', 'settings.plugins.tab', 'settings.plugin.item'])
    const seatRegs = registrations.filter(r => seats.has(r.slot))
    expect(seatRegs.map(r => r.slot).sort()).toEqual([...seats].sort())
    for (const reg of seatRegs) expect(reg.component).toBe(PermissiveCard)
    expect(settingsRegistrationOf(registrations)!.slot).toBe('settings.section')
  })

  it('pins the section identity (id/order/label/locale) and the card component', () => {
    const { registrations, scope } = collectRegistrations()
    const { options, component } = settingsRegistrationOf(registrations)!
    expect(options['id']).toBe('dsh-perm-gate')
    expect(options['order']).toBe(30)
    expect(options['locale']).toBe('dsh-perm-gate')
    // Read-time label thunk: follows the active locale without re-registration.
    expect((options['label'] as () => string)()).toBe('section.title')
    expect(typeof options['inject']).toBe('function')
    const face = (options['inject'] as () => Record<string, unknown>)()
    expect(Object.keys(face)).toEqual(['scope'])
    // The scope is the compat-resolved durable-settings handle, closure-captured
    // at resolution time (registration happens inside the resolution callback).
    // Dual-source scope: with configForms present the native handle wins; the
    // BridgeDocHandle fallback only engages when neither face resolves (0.1.5
    // settingsScope never resolves — see T10b verdict in the plan docs).
    expect(face['scope']).toBe(scope)
    expect(component).toBe(PermissiveCard)
  })
})
