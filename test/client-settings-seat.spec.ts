/**
 * Settings-seat contract pin for dsh-perm-gate's browser half.
 *
 * This spec locks WHERE the 自动审查 tier settings card mounts. The 0.1.5
 * line ships it as a dedicated `settings.plugins.tab` page (id `dsh-perm-gate`,
 * order 50) and deliberately does NOT register `settings.plugin.item` — the
 * gate's own namespace would then appear both as a tab and as a card in the
 * configurable list. When a future DSH line moves the seat again, migrate
 * src/client/index.ts AND this file together; the assertions fail on drift:
 *
 *   - the Plugins tab is injected exactly once;
 *   - no `settings.plugin.item` / `settings.section` registration exists;
 *   - tab identity (id/order/label/locale), the injected scope, and the card
 *     component stay stable.
 */
import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.ts'
import { PermissiveCard } from '../src/client/card.tsx'

interface CapturedRegistration {
  readonly slot: string
  readonly options: Record<string, unknown>
  readonly component: unknown
}

/** Drive apply against a stub host and capture every slot registration. */
function collectRegistrations(): { declared: string[]; registrations: CapturedRegistration[] } {
  const declared: string[] = []
  const registrations: CapturedRegistration[] = []
  const ctx = {
    effect: (build: () => unknown) => { void build(); return () => {} },
    locale: { register: () => () => {}, bind: () => (key: string) => key },
    settingsScope: { bind: () => ({}) },
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
  return { declared, registrations }
}

/** The one registration targeting a settings seat (any of the known ones). */
function settingsRegistrationOf(registrations: readonly CapturedRegistration[]): CapturedRegistration | undefined {
  return registrations.find(r =>
    r.slot === 'settings.plugins.tab' || r.slot === 'settings.plugin.item' || r.slot === 'settings.section')
}

describe('settings-seat contract (dedicated settings.plugins.tab page)', () => {
  it('injects the Plugins tab exactly once, and no other settings seat', () => {
    const { declared, registrations } = collectRegistrations()
    expect(declared.filter(slot => slot === 'settings.plugins.tab')).toHaveLength(1)
    expect(declared).not.toContain('settings.plugin.item')
    expect(declared).not.toContain('settings.section')
    expect(settingsRegistrationOf(registrations)!.slot).toBe('settings.plugins.tab')
  })

  it('pins the tab identity (id/order/label/locale) and the card component', () => {
    const { registrations } = collectRegistrations()
    const { options, component } = settingsRegistrationOf(registrations)!
    expect(options['id']).toBe('dsh-perm-gate')
    expect(options['order']).toBe(50)
    expect(options['locale']).toBe('dsh-perm-gate')
    // Read-time label thunk: follows the active locale without re-registration.
    expect((options['label'] as () => string)()).toBe('card.title')
    expect(typeof options['inject']).toBe('function')
    const face = (options['inject'] as () => Record<string, unknown>)()
    expect(Object.keys(face)).toEqual(['scope'])
    expect(component).toBe(PermissiveCard)
  })
})
