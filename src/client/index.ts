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
    // （settings.plugin.item 槽型镜像已随 2026-10-08 席位移除一并删除——
    // 注册面收拢进 dsh-family.tab，见下方 family.tab 注释。）
    // 家族节子席位（TL `dsh-family` 顶级节声明；session-guard/IT/steward 等同款）：
    // 2026-10-08 用户定案——设置面收拢进家族 in-section tab，本插件的顶级
    // settings.section / 插件页 settings.plugins.tab / settings.plugin.item
    // 三席位全部让位（与宿主原生节重复的导航面逐一消失），自动审查门卡只从
    // 这里出。壳（TL）缺席时该注入静默 pending——五格实证 TL 常驻，可接受。
    'dsh-family.tab': { kind: 'list'; scope: 'root' }
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

  // 家族节 contributor tab（2026-10-08 设置面收拢定案）：自动审查门卡唯一入口 =
  // 起子插件设置（TL `dsh-family` 节）里的「自动审查门」tab。原三个面——顶级
  // settings.section（侧栏节）、settings.plugins.tab（插件页 tab，0.1.0 实测也
  // 渲染）、settings.plugin.item（≤0.1.5 插件配置卡）——全部移除，与宿主原生节
  // 重复的导航面不再出现。卡组件与数据臂（原生句柄优先 + 桥兜底）原样复用；
  // server 侧数据面（installSection 三代 + 桥路由）不动。
  safe('dsh-family.tab', () => {
    ctx.slots.inject('dsh-family.tab', () => ctx.slots.register({
      name: 'dsh-family.tab',
      id: PERMISSIVE_NS,
      order: 45,
      label: () => t('section.title'),
      locale: NS,
      inject: cardInjected,
    }, PermissiveCard)) as unknown
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

  // 0.1.7+/0.2.0「内置插件」页的插件 tab（T14）已于 2026-10-08 移除：插件页
  // tab 行与家族节 tab 重复（0.1.0 实测两处都渲染），设置面收拢进家族节。

  // ≤0.1.5 设置面板「插件配置」tab 的派发卡（settings.plugin.item）已于
  // 2026-10-08 移除：与家族节 tab 重复。server 侧 installSection 数据面保留
  // ——它同时是桥 describe/mutate 与 served ns 的来源。

  // 0.1.0/0.1.1 等无设置页宿主的兜底入口:壳级 overlay 浮窗齿轮承载审批门卡
  // (数据层与上方几个面共用同一 scope;宿主有设置页的线上与既有入口并存)。
  // shell.overlay 席位在 0.1.0-0.1.5 的壳布局里无条件渲染(AppFrame
  // overlayLayer,list 槽),但不在 0.2.0 槽型联合里(该线上无渲染宿主=无害
  // 空操作)——用松类型别名注册;t 经 inject 显式直传。
  safe('shell.overlay', () => {
    const overlaySlots = ctx.slots as unknown as {
      inject: (name: string, factory: () => unknown) => unknown
      register: (options: { name: string; id?: string; inject: () => PermissiveCardProps }, component: (props: PermissiveCardProps) => JSX.Element) => unknown
    }
    overlaySlots.inject('shell.overlay', () => overlaySlots.register({
      name: 'shell.overlay',
      id: PERMISSIVE_NS,
      inject: (): PermissiveCardProps => ({ t, scope: scopeRef.scope ?? bridgeScope }) as PermissiveCardProps,
    }, FloatingPermissiveGate))
  })
}