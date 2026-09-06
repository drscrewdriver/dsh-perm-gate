/**
 * dsh-perm-gate — browser half.
 *
 * Registers the `dsh-perm-gate` dictionaries and one `settings.plugins.tab`
 * page keyed by the plugin's settings namespace, so the Plugins section of the
 * settings panel renders an editable page: the single Permissive tier switch
 * plus the three combinable backend approval strategies.
 *
 * All @deepseek-ai/* imports are type-only at the value level: collaboration
 * happens through cordis services (`slots`, `locale`, `settingsScope`) and slot
 * registration only (client bundle purity). The `LocaleNamespaceMap`
 * augmentation below is a type-only merge so the `locale:` seat type-checks.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { NS, en, zh, type PermissiveKey } from './locales.ts'
import { PermissiveCard, type PermissiveCardInjected, type PermissiveCardValue } from './card.tsx'
import { installPermissivePermissionIcon } from './permission-icon.ts'
import { NoticeStrip } from './notice.tsx'

/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
const PERMISSIVE_NS = 'dsh-perm-gate'

// Declare the plugin's dictionary namespace in the locale key domain so the
// slot `locale:` seat and `ctx.locale.bind` are typed to our key union.
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'dsh-perm-gate': PermissiveKey
  }
  // The conversation dock slot is declared at runtime by the conversation UI
  // package (not a dev dependency here); mirror its contract so the typed
  // `slots.register` accepts our notice-strip entry. Approval-gate's client
  // demonstrates the runtime accepts this slot name with id/order/label options.
  interface SlotMap {
    'conversation.input.dock': {
      kind: 'list'
      scope: 'session-maybe'
      owner: {
        /** Current conversation id (may be absent outside a session). */
        sessionId?: string
        /** Session-store selector hook supplied by the conversation shell. */
        useSessions?: (selector: (state: unknown) => unknown) => unknown
      }
    }
  }
}

/** Services required by the browser half. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Client plugin body: dictionaries plus the settings page registration.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-perm-gate: dictionaries')

  // Decorate the Permissive permission-picker item with a shield glyph, matching
  // the Auto tier's icon. Guarded in case `document` is unavailable in a
  // non-browser build (tsdown targets the browser; the guard keeps typecheck green).
  ctx.effect(() => installPermissivePermissionIcon(globalThis.document), 'dsh-perm-gate: permission icon')

  // Decision notice strip above the conversation input: polls the host's
  // event feed so auto-allows / asks / denies are visible without opening logs.
  ctx.slots.inject('conversation.input.dock', function* () {
    yield ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'dsh-perm-gate.notice',
      order: 30,
      label: () => t('notice.label'),
      locale: NS,
    }, NoticeStrip)
  }) as unknown

  // A localized tab label (re-evaluated per read so it follows the active locale).
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.plugins.tab', function* () {
    yield ctx.slots.register({
      name: 'settings.plugins.tab',
      // List-slot cell identity + nav position + localized tab text.
      id: PERMISSIVE_NS,
      order: 50,
      label: () => t('card.title'),
      locale: NS,
      inject: (): PermissiveCardInjected => {
        const scope = ctx.settingsScope.bind<PermissiveCardValue>({ namespace: PERMISSIVE_NS })
        return { scope }
      },
    }, PermissiveCard)
  }) as unknown
}