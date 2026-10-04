/**
 * Settings-seat contract pin for dsh-perm-gate's browser half.
 *
 * This spec locks WHERE the 自动审查门 settings surface mounts. The 0.1.7rc.2
 * line ships it as a dedicated top-level `settings.section` (id `dsh-perm-gate`,
 * order 30, label `section.title`) and deliberately does NOT register
 * `settings.plugin.item` / `settings.plugins.tab` — the gate is a first-class
 * settings nav entry, not a Plugins-section tab. When a future DSH line moves
 * the seat again, migrate src/client/index.ts AND this file together; the
 * assertions fail on drift:
 *
 *   - the section is injected exactly once;
 *   - no `settings.plugin.item` / `settings.plugins.tab` registration exists;
 *   - section identity (id/order/label/locale), the injected scope, and the
 *     card component stay stable.
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

  it('injects the settings.section exactly once, and no other settings seat', () => {
    const { declared, registrations } = collectRegistrations()
    expect(declared.filter(slot => slot === 'settings.section')).toHaveLength(1)
    expect(declared).not.toContain('settings.plugin.item')
    expect(declared).not.toContain('settings.plugins.tab')
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
    expect(face['scope']).toBe(scope)
    expect(component).toBe(PermissiveCard)
  })
})
