/**
 * compat.ts —— client 半区版本敏感代码的**唯一窄腰**（INDEX §C：版本差异代码
 * 只许出现在窄腰文件，能力探测在严格代理 client ctx 上不可行——inject 清单外
 * 的属性读取直接 throw，故用双 scoped-inject 按代分流）。
 *
 * 已核实的分叉（2026-10-05 六线农场 node_modules 实查 + input-traffic P2 同型
 * 结论）：持久化设置面按代互斥——
 *   - 0.1.7+ 走 `configForms.get(ns)`；
 *   - ≤0.1.5 走 `settingsScope.bind({ namespace })`。
 * 0.1.7-rc.1 的 client-ui-settings 包全文已无 `settingsScope` 字样，两服务
 * 天然不会双触发；缺席线上的 scoped fiber 永久 PENDING，与 family 槽缺席同型，
 * 不阻塞插件其余半区。**插件级 inject 因此只收六线通用服务**（slots/locale），
 * configForms 留在清单里会让 ≤0.1.5 整个 client 半区 PENDING 静默失活
 * （date-wrapper boot-audit 教训的 client 版）。
 *
 * 卡片消费的四个方法（getSnapshot/subscribe/set/unset）在两代都存在：新线的
 * `SettingsScopeSnapshot` 虽然 richer（base/user/revision/mode），但
 * `value`/`writable` 字段保留，`set`/`unset` 退化为 `mutate` 的便利包装
 * （adaptation-reports/dsh-perm-gate.md §1.5）。句柄因此按**本地结构类型**
 * 声明，不做宿主包的类型合并——编译面对每条宿主线的真实类型保持一致
 * （input-traffic compat.ts 同款纪律）。
 *
 * All @deepseek-ai/* imports are type-only (client bundle purity).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'

/** Structural minimum of a durable settings scope — shared by `configForms.get()`
 * (0.1.7+) and `settingsScope.bind()` (≤0.1.5). Declared locally so the compile
 * face stays identical against every host line's real types. */
export interface SettingsDocHandle {
  getSnapshot(): { status: string; value: unknown; writable: boolean }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void> | unknown
  unset(field: string): Promise<void> | unknown
}

/** Which durable-settings service resolved — `configForms` only exists on
 * 0.1.7+, `settingsScope` only on ≤0.1.5. Surfaces that are generation-specific
 * (e.g. the ≤0.1.5 `settings.plugin.item` card) key off this tag. */
export type SettingsGeneration = 'configForms' | 'settingsScope'

/**
 * Resolve the plugin's durable settings scope through whichever service this
 * host line carries, then hand it to `onScope` exactly once.
 *
 * Both variants are scoped sub-injects: on a host without the service the fiber
 * waits forever WITHOUT blocking the plugin's other faces (same posture as the
 * notice strip's slot-inject when its slot holder is absent). session-guard
 * 4.1.0 proves the `settingsScope` branch resolves on 0.1.5-rc.3 (its
 * shell.overlay gear registers inside this callback and renders there).
 */
export function resolveSettingsScope(
  ctx: ClientContext,
  namespace: string,
  onScope: (scope: SettingsDocHandle, generation: SettingsGeneration) => void,
): void {
  // Modern hosts (0.1.7+): configForms owns cross-entry durable scopes.
  ctx.inject(['configForms'], (configForms: unknown) => {
    const scope = (configForms as { get(namespace: string): SettingsDocHandle }).get(namespace)
    onScope(scope, 'configForms')
  })
  // Old hosts (≤0.1.5): namespaced durable scope via bind().
  ctx.inject(['settingsScope'], (settingsScope: unknown) => {
    const scope = (settingsScope as {
      bind(spec: { namespace: string }): SettingsDocHandle
    }).bind({ namespace })
    onScope(scope, 'settingsScope')
  })
}
