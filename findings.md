# Findings

> 2026-09-13 重写：0.1.5 升级适配调研。旧 findings（dsh-approval-gate 外部分析）已完成使命，见 git 历史。

## F1. 0.1.5 权限预设表归属变更（patch 迁移的直接依据）

- **✅ 2026-09-13 实测（`npm install @deepseek-ai/dsh@0.1.5-rc.2` 离线核查）**：cordis patch owner id **仍是 `permission`**（`dsh-base/cordis.patch.yml:229` → `name: '@deepseek-ai/dsh-permission-presets'`），即 0.1.5 只换了 id 背后的包，**插件 patch 无需改 id**。
- **内置预设集不变**：dsh-base patch 仍声明 read-only / workspace-write / danger-full-access 三档（与 0.1.2 相同）。
- 服务配置 schema（`dsh-permission-presets/lib/index.js` `PermissionPresetService.Config`）：`presets: dict({ sandbox: union(SANDBOX_MODES).required(), approval: union(APPROVAL_POLICIES).required(), name: string, description: string })` + 可选 `defaultPreset`；`custom` 保留字（表项命中即构造抛错）；宿主自己走 `ctx.inject(['settings'])` + `installSection` 注册 defaultPreset 设置节 —— 与 gate 的写法同构。
- 服务还要求 `ctx.shell.sandboxMode` 存在（非隔离 executor 组合即抛错）——宿主 profile 由 dsh-base 保证，插件无需处理。
- 非法 preset 配置在 0.1.5 会**构造函数抛错**（`defaultPreset` 不匹配组合 / `custom` 命中）→ 配合已知 bug（F9）必须形状正确。

## F2. 0.1.5 权限事件模型（gate 读取路径的影响）

- 新增 `permission/preset` 事件（log-only 用户意图）+ `permissions` session projection（`stateVersion: 2`，含 `preset`/`sandbox`/`approval`/`seeded`，折叠三个事件 + `session/end-seed` 边界）。
- `set()` 只写值变化的 knob，避免冗余事件；`current(session)` 从投影派生有效预设，不匹配组合返回 `'custom'`（保留字，不能作为表项）。
- 对 gate 的影响：gate 现经 `approvalService.effectivePolicy`（**私有方法**）读审批策略。**✅ 实测：0.1.5-rc.2 的 `dsh-user-approval/lib/types/index.js:145` 仍有 `effectivePolicy(session)`**；`approval/request` waterfall 事件名、闭集结果 `['allowed-once','rejected','cancelled','unavailable']`（types/index.js:15）、沙箱升级文案 `` `escalate sandbox to ${mode}: ${justification}` ``（dsh-sandbox/lib/index.js:102）全部与 0.1.2 一致 —— **gate 的应答路径与 escalation 正则零改动可用**。
- **✅ 实测：`permission/preset` 事件 payload 仍为 `{ preset: name }`**（dsh-permission-presets/lib/index.js:282 `session.append("permission/preset", { preset: name })`）——gate 的 `preset.ts` fold（`event.data.preset`）匹配。
- **✅ 实测：`snapshotEvents()` / `ownEvents()` 在 0.1.5 `dsh-session/lib/index.js:1107/1118` 仍存在** —— gate 的 `sessionEventsOf` 探测链可用。

## F3. 0.1.5 已知 bug 与 gate 的交集（讨论区 #5886–#6442 实证）

- **#6215**：`approveEscalation` 在 effectiveMode 为 `danger-full-access` 时拒绝同级/降级升级 → 模型死锁循环。gate 的 escalation-auto 路径（`SANDBOX_ESCALATION_REASON` 正则应答）在 0.1.5 上要冒烟核实。
- **#6100**：审批层 fail-closed 时文案 "user rejected" 使模型误归因。gate 的拒绝 reason 措辞保持自带（已与宿主文案分离）。
- **#6415**：非法 preset 配置 → cordis 无限 reload + ~2GB 泄漏 OOM，完全静默 → patch 形状必须有 spec 钉住。
- **#6124/#6115/#6373**：Node < 24 / `import.meta.main` 守卫静默失败 → engines.node 声明 + 不用 main 守卫（插件构建脚本已是显式调用，核实即可）。
- **#5999/#6374**：升级后 client combo 缓存陈旧 → 插件"全部消失"；冒烟时先强制刷新浏览器再下结论；README 排障章节补充。
- **#5926/#5889**：第三方插件注册 HTTP 通道时 `owner.webServer` 未声明崩溃（0.1.3-rc 引入）→ gate 的 `webServer.register('/api/dsh-perm-gate/events')` 路径在 rc.2 实测。
- **#6337**：`connection.rpc.handle()` 通道 405 静默失效（rc.1/rc.2）——gate 不用 connection.rpc，无影响，记录备查。

## F4. 插件现状盘点（devDeps 已半只脚在 0.1.5）

- devDependencies 已是 `@deepseek-ai/dsh-client-*@^0.1.5-rc.2`（locale/ui-renderer/ui-settings/ui-slots）；`engines.dsh` 仍 `>=0.1.2-alpha.1 <0.2.0-0`，`engines.node >=20`。
- settings 已是 0.1.3+ 兼容写法：字符串命名空间 `'dsh-perm-gate'` + `ctx.inject(['settings'])` + `installSection`（0.1.5 无需改）。
- client inject = `['slots','locale','settingsScope']`，三个 slot（`conversation.input.dock` / `conversation.view` / `settings.plugins.tab`）契约镜像自 conversation UI 包。
- host inject = `['tools','webServer','llm','agentDefaultModel']`，settings 经 `SettingsAwareCtx.inject` 探测。
- **✅ 0.1.5-rc.2 实测核对**：
  - `webServer` 服务在 `dsh-host-webserver`（`register(route)` 于 lib/index.js:176）✅；`agentDefaultModel`（dsh-agent-default-model）、`tools`（dsh-tools）均在 ✅。
  - `conversation.input.dock` 与 `conversation.view` 在 0.1.5 `dsh-client-ui-conversation/lib/client.js` 仍声明为 `{ kind: 'list', scope: 'session' }`，`conversation.view` 的 inject 签名 `(sessionId, actions) => …` 兼容 gate 的 `(sessionId) => ({ sessionId })` ✅。
  - `settings.plugins.tab` 归属 0.1.5 新包 `dsh-client-ui-settings-plugins`，契约 `{ kind: 'list', scope: 'root' }`，条目需 `id/order/label/locale` —— gate 的注册参数吻合 ✅。
  - 本插件 client 不做权限选择器装饰（`src/client/index.ts:79` 注释明示 icon-free）；图标来自**可选的手动宿主侧 patch** `patches/add-permissive-glyph.patch`（图示性 hunk，需按实际构建重锚行号）。**✅ 0.1.5-rc.2 核对：`permissionGlyphs` map 结构不变（read-only / workspace-write / FULL_ACCESS 三键 + `shieldOutline` 变量），但从 0.1.2 的 ~15070 行移到 15559 行**，且新增 `BUILT_IN_PERMISSION_NAMES` 标签映射（`permissionLabel` 对插件档仍原样渲染宿主提供的 `name`）。

## F5. 版本线策略（决策依据）

- 仓库既有惯例：`legacy` 分支 = 0.1.1 线；`main` = 2.x（0.1.2+ 线，"fix: keep the gate active on DSH 0.1.2" 提交可证）。
- 预设 patch owner id 两线不同（`permission` vs 0.1.5 owner）→ 单 branch 双兼容不可行（cordis.patch.yml 静态），必须分线。
- 3.0.0 语义：engines 收窄为破坏性变更。

## F6. 客户端包面（0.1.5 新增包）

- 0.1.5 新增 `ui-permission-presets`（权限预设 UI）、`ui-dockkit`、`ui-sidebar-*` 等。**✅ 实测：composer 侧 `permissionGlyphs` map 仍在 0.1.5 `dsh-client-ui-conversation/lib/client.js`**（按三内置值键控）；设置侧 `dsh-client-ui-permission-presets/lib/client.js` 无 glyph 表（纯文本渲染）。插件不带装饰，故两处均无适配需求。
- `dsh-client-store` 在 0.1.5-alpha.2 曾漏 Zustand/Immer 运行时依赖（#6082）→ 插件如直接依赖须自查 peer 声明（当前无直接依赖，无影响）。

## F7. 冒烟验证口径

- 备份 profile → 干净 profile 起 0.1.5-rc.2 → 装 gate → 验证：预设选择器出现「自动审查」档（含图标）→ 切档生效（sandbox=workspace-write + approval=ask）→ 触发一次应放行/应转人工的 shell 调用 → dock 提示条与事件路由 `/api/dsh-perm-gate/events` → 设置卡片可编辑 → 卸载无残留。

## 约束与依赖

- 知识来源：`dsh-docs-deliverables`（official-repo/docs 为 0.1.5-rc.2 文档镜像、source-analysis/v0.1.5-rc.2、upgrade-pitfalls.md、dsh-015-notes.md）；**文档结论不能替代源码/运行时实测**，F1 owner id、F2 effectivePolicy、F4 slot 契约均为「待实测核实」项，已排入 tasks。
- 开发环境 Windows/Git Bash，Node 版本需 ≥ 24 才能跑 0.1.5 宿主（本机先核实 `node -v`）。

## 风险识别

- R1：0.1.5 preset owner id 与预期不符 / patch 结构变化 → tasks task_3 先探测后改，patch-presets.spec 钉住，失败时按实测调整。
- R2：conversation 重写导致 slot 契约变化 → notice/history 组件静默降级设计已内置（props 缺失不渲染），最坏情况 UI 暂缺、门禁功能不受影响（host 半独立）。
- R3：glyph map 位置迁移 → 有 DOM MutationObserver 装饰兜底（permission-icon.ts），图标缺失是外观问题非功能问题。
- R4：0.1.5 宿主级 bug（fork 继承队列、/compact 破坏等）与 gate 无关但会污染冒烟判断 → 冒烟前在禁用插件的干净 profile 复测基线。
