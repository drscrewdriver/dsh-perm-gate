/**
 * dsh-perm-gate — browser half.
 *
 * Registers the `dsh-perm-gate` dictionaries and one `settings.plugins.tab`
 * page keyed by the plugin's settings namespace, so the Plugins section of the
 * settings panel renders an editable page: the single 自动审查 tier switch
 * plus the four combinable backend approval strategies.
 *
 * All @deepseek-ai/* imports are type-only at the value level: collaboration
 * happens through cordis services (`slots`, `locale`, `configForms`) and slot
 * registration only (client bundle purity). The `LocaleNamespaceMap`
 * augmentation below is a type-only merge so the `locale:` seat type-checks.
 *
 * `ClientContext` comes from cordis directly. DSH 0.1.1 exported the identical
 * alias from `@deepseek-ai/dsh-client-runtime/client` (`export type ClientContext
 * = Context`), but that package was removed in 0.1.2-alpha.1 — cordis is the one
 * source that names the same type on both lines.
 */
import type { JSX } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Declaration merge for `ctx.slots`. On the 0.1.2+ line the slot registry service
// is declared by the renderer's client entry; on 0.1.1 it came from
// `dsh-client-runtime/client` (via the settings client's peer), which is why the
// renderer entry declares nothing there. Importing it is a no-op on the old line.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { NS, dictionaries, type PermissiveKey } from './locales.ts'
import { FloatingPermissiveGate, PermissiveCard, type PermissiveCardInjected, type PermissiveCardProps } from './card.tsx'
import { NoticeStrip } from './notice.tsx'
import { HistoryView } from './history.tsx'
import { resolveSettingsScope } from './compat.ts'

/** The profile entry id of this plugin — the `configForms` key (kept in lockstep with cordis.patch.yml). */
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
    // The conversation view slot (tab row next to the conversation timeline) is
    // declared at runtime by the conversation UI package; mirror its contract
    // so the typed `slots.register` accepts our approval-history entry.
    'conversation.view': {
      kind: 'list'
      scope: 'session-maybe'
      owner: {
        sessionId?: string
        useSessions?: (selector: (state: unknown) => unknown) => unknown
      }
    }
    // Plugins-page configuration card (official ui-plugin-manager contract):
    // the host's Plugins page does not render volatile config forms on its
    // own — the page draws a config card on the bundle's detail page only when
    // a client claims this seat, keyed by the bundle's package name. Declared
    // here (the declaring page package is not a dev dependency), mirroring the
    // contract the page renders with (`{ view: 'page', form }` owner props).
    'plugins.bundle.config': { kind: 'keyed'; scope: 'root'; owner: Record<string, unknown> }
  }
}

/** Services required by the browser half — generation-neutral only.
 *
 * `configForms` (0.1.7+) / `settingsScope` (≤0.1.5) are generation-exclusive
 * durable-settings faces: keeping either in the plugin-level inject list would
 * leave the WHOLE browser half fiber PENDING on the other line (strict ctx
 * proxy throws on undeclared service reads; pending fiber = silent death).
 * They resolve through scoped sub-injects in compat.ts instead, and the card
 * registrations below move into the resolution callback. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: dictionaries plus the settings page registration.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  if (ctx.locale) ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-perm-gate: dictionaries')

  // No permission-picker decoration: the tier's label is the Chinese product
  // string supplied by cordis.patch.yml, and the composer draws glyphs only for
  // the three built-in values, so a plugin-contributed tier is icon-free on
  // every surface.

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

  // Approval-history page: a conversation-view tab listing every gate decision
  // of the session, newest first (the review-page pattern approval-gate
  // demonstrates; our data is the same events feed the notice strip polls).
  ctx.slots.inject('conversation.view', function* () {
    yield ctx.slots.register({
      name: 'conversation.view',
      id: 'dsh-perm-gate.history',
      order: 20,
      label: () => t('history.label'),
      locale: NS,
      inject: (sessionId: string | undefined) => ({ sessionId }),
    }, HistoryView)
  }) as unknown

  // A localized tab label (re-evaluated per read so it follows the active locale).
  const t = ctx.locale.bind(NS)

  // 设置卡注册收进 settings scope 解析回调（input-traffic P2 范式）：卡片
  // inject 值闭包捕获已解析的句柄，注册体只在回调里跑一次——两代服务按代
  // 互斥，天然不双触发。旧线 ≤0.1.5 经 settingsScope.bind 解析（此时
  // `plugins.bundle.config` 席位在裸宿主上不存在，shadow-inject 为惰性
  // no-op，注册体不执行）；0.1.7+ 经 configForms.get 解析。
  resolveSettingsScope(ctx, PERMISSIVE_NS, (scope) => {
    // 独立顶级设置节（范式 A）：自动审查门，不再挂在「插件」节的 tab 下。
    ctx.slots.inject('settings.section', function* () {
      yield ctx.slots.register({
        name: 'settings.section',
        id: PERMISSIVE_NS,
        order: 30,
        label: () => t('section.title'),
        locale: NS,
        inject: (): PermissiveCardInjected => ({ scope }),
      }, PermissiveCard)
    }) as unknown

    // 插件页配置卡：Plugins 页不会自动渲染 volatile 配置表单——只有客户端注册
    // `plugins.bundle.config` 席位（key = package.json 的 name 字段），页面才会
    // 在 bundle 详情页渲染配置卡。注册同一个 PermissiveCard、传同一份 inject 值
    // （configForms 里的插件作用域），与上面的设置节共用一个事实来源；卡片自带
    // 展开壳，不依赖 tab 容器上下文，可独立渲染。
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: 'dsh-perm-gate',
      locale: NS,
      inject: (): PermissiveCardInjected => ({ scope }),
    }, PermissiveCard)) as unknown

    // 0.1.0/0.1.1 等无设置页宿主的兜底入口:壳级 overlay 浮窗齿轮承载审批门卡
    // (数据层与上方两个面共用同一 scope;宿主有设置页的线上与既有入口并存)。
    // shell.overlay 在 0.1.0/0.1.1 宿主槽位实测存在,但不在 0.2.0 槽型联合里
    // (该线上无渲染宿主=无害空操作)——用松类型别名注册;t 经 inject 显式直传。
    const overlaySlots = ctx.slots as unknown as {
      inject: (name: string, factory: () => unknown) => unknown
      register: (options: { name: string; id?: string; inject: () => PermissiveCardProps }, component: (props: PermissiveCardProps) => JSX.Element) => unknown
    }
    overlaySlots.inject('shell.overlay', () => overlaySlots.register({
      name: 'shell.overlay',
      id: PERMISSIVE_NS,
      inject: (): PermissiveCardProps => ({ t, scope }),
    }, FloatingPermissiveGate))
  })
}