/**
 * dsh-perm-gate — browser half.
 *
 * Registers the `dsh-perm-gate` dictionaries and one top-level `settings.section`
 * entry (自动审查门) so the settings sidebar renders a standalone editable
 * section: the single 自动审查 tier switch plus the four combinable backend
 * approval strategies.
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
import { PermissiveCard, type PermissiveCardInjected, type PermissiveCardProps } from './card.tsx'
import { NoticeStrip } from './notice.tsx'
import { HistoryView } from './history.tsx'
import { resolveSettingsScope } from './compat.ts'
import { BridgeDocHandle } from './bridge-scope.ts'

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
    // （settings.plugin.item 槽型镜像已随该席位退役一并删除——与顶级独立节
    // 重复的 ≤0.1.5 派发卡不再出现。settings.section 的槽型由
    // @deepseek-ai/dsh-client-ui-settings/client 的声明提供，无需本地镜像。）
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
  // 互斥，天然不双触发。旧线 ≤0.1.5 经 settingsScope.bind 解析（session-guard
  // 4.1.0 在 0.1.5-rc.3 实证该分支会 resolve：它的浮窗齿轮就注册在同一回调里）；
  // 0.1.7+ 经 configForms.get 解析。
  //
  // 每个面独立 safe()（free-search/session-guard 同款纪律）：未知槽名在个别
  // 宿主线上可能同步抛错，cordis inject 回调抛错会静默吞掉整段 apply——绝不能
  // 让一个面的失败带走其它面（0.1.5 上浮窗齿轮曾因前面 plugins.bundle.config
  // 抛错而被连带吞掉的教训）。
  const safe = (tag: string, fn: () => void): void => {
    try {
      fn()
    } catch (e) {
      // 诊断通道：农场 IAB 拿不到 console，失败面写入 window.__pgSurf 供
      // evaluate 直接读取（失败才初始化——页面侧读到 undefined 即零失败）。
      const surf = ((globalThis as Record<string, unknown>).__pgSurf ??= []) as string[]
      surf.push(`${tag}: ${(e as Error)?.message ?? String(e)}`)
      console.warn(`[dsh-perm-gate] client surface '${tag}' failed:`, e)
    }
  }
  // 2026-10-07 农场 0.1.5 实测定案：0.1.5 上 ctx.inject(['settingsScope']) 的
  // scoped fiber 永不解（free-search 记忆「≤0.1.5 卡片派发 settingsScope 镜像
  // 未证实」的反面坐实），把注册关进回调 = 卡片永不出。同线实证：free-search
  // 的卡注册在 apply 顶层（回调只管数据 bind）所以能出；session-guard 露出的
  // 卡是宿主按 describe 原生渲染的，不是它的回调卡。因此改为 free-search 形态：
  // 注册全部顶层执行，scope 走活引用——回调解到就填，卡片 inject 每次现读。
  const scopeRef: { scope?: PermissiveCardInjected['scope'] } = {}
  resolveSettingsScope(ctx, PERMISSIVE_NS, (scope, _generation) => {
    scopeRef.scope = scope
  })

  // T13b 双轨数据源的桥轨：settingsScope（≤0.1.5）不解、且 configForms（0.1.7+）
  // 也没有的线上，卡片数据走自家 webServer 桥（free-search 同架构）。原生句柄
  // 优先——解到就用原生（0.2.0 实测可解），桥只在原生缺席时兜底。
  const bridgeScope: PermissiveCardInjected['scope'] = new BridgeDocHandle(PERMISSIVE_NS)

  // 卡片 inject 读活引用：注册先于 scope 解析也不空窗（未解析时回落桥轨，
  // 桥首拉 pending 期间卡片呈现加载态）。
  const cardInjected = (): PermissiveCardInjected => ({ scope: scopeRef.scope ?? bridgeScope }) as PermissiveCardInjected

  // 独立顶级设置节（范式 A；2026-10-08 回退定案：本插件不在家族 tab 化范围内
  // ——自动审查门是独立 insection，与「权限/上下文优化独立分节」的参考样本
  // 一致）。卡组件与数据臂（原生句柄优先 + 桥兜底）原样复用；server 侧数据面
  // （installSection 三代 + 桥路由）不动。与插件页 tab / ≤0.1.5 派发卡的
  // 去重取舍见下方注释。
  safe('settings.section', () => {
    ctx.slots.inject('settings.section', function* () {
      yield ctx.slots.register({
        name: 'settings.section',
        id: PERMISSIVE_NS,
        order: 30,
        label: () => t('section.title'),
        locale: NS,
        inject: cardInjected,
      }, PermissiveCard)
    }) as unknown
  })

  // 插件页配置卡：Plugins 页不会自动渲染 volatile 配置表单——只有客户端注册
  // `plugins.bundle.config` 席位（key = package.json 的 name 字段），页面才会
  // 在 bundle 详情页渲染配置卡。
  safe('plugins.bundle.config', () => {
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config',
      key: 'dsh-perm-gate',
      locale: NS,
      inject: cardInjected,
    }, PermissiveCard)) as unknown
  })

  // 0.1.7+/0.2.0「内置插件」页的插件 tab（T14）已于 2026-10-08 移除：0.1.0
  // 实测它与顶级 settings.section 同时渲染，同一张卡出现两次；顶级独立节是
  // 唯一设置导航入口（同日家族 tab 收拢已回退——本插件不在 tab 化范围内）。

  // ≤0.1.5 设置面板「插件配置」tab 的派发卡（settings.plugin.item）同批退役：
  // 与顶级独立节重复。server 侧 installSection 数据面保留——它同时是桥
  // describe/mutate 与 served ns 的来源。

}