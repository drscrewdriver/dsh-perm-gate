# Checklist — 0.1.5 升级（compat/0.1.5）

> 验证口径：`npm run typecheck && npm run lint && npm test && npm run build` 全绿 + DSH 0.1.5-rc.2 真实 profile 冒烟。

## Must Pass

### 分支与 manifest
- [ ] `compat/0.1.5` 分支自 main@6dfd091 切出；`package.json` version=3.0.0、`engines.dsh`=`>=0.1.5-rc.1 <0.2.0-0`、`engines.node`=`>=24`
- [ ] dist 发布元数据沿用 2.0.0 流程（dist-tag `next`），README 四语兼容矩阵更新为 3.x = 0.1.5 线

### 预设档 patch（核心）
- [ ] 已在 0.1.5-rc.2 实测确认 `presets` 配置的 cordis owner id，`cordis.patch.yml` patch 落在该 owner
- [ ] patch 重述 0.1.5 实际内置预设集（默认表仅 workspace-write / danger-full-access；read-only 是否需要保留按实测决定）
- [ ] `permissive` 档：sandbox=workspace-write + approval=ask + name=自动审查 + description 完整
- [ ] `test/patch-presets.spec.ts` 钉住新 owner id + 新键集（防漂移）
- [ ] patch 值形状 100% 合法（非法 preset 配置在 0.1.5 触发无限 reload OOM）

### 宿主半集成
- [ ] `approval/request` 回答者链在 0.1.5 生效：应放行调用走 gate、应拦截调用转人工
- [ ] `effectivePolicy` 读取核实：私有方法在则直用；不在则回退实现（读 projection/服务）且测试覆盖
- [ ] escalation-auto 路径冒烟通过（对照 #6215 场景）
- [ ] `/api/dsh-perm-gate/events` 路由注册成功且可查询（对照 #5926/#5889）
- [ ] `tools`/`llm`/`agentDefaultModel` inject 在 0.1.5 profile 全部解析成功

### 浏览器半集成
- [ ] 三个 slot（`conversation.input.dock` / `conversation.view` / `settings.plugins.tab`）在 0.1.5 渲染正常
- [ ] settings 卡片可编辑且实时生效（字符串命名空间 + installSection 路径）
- [ ] permissive 档图标：composer 菜单项 + 触发按钮两处装饰生效（glyph map 迁移则 patch 跟随）
- [ ] client bundle purity gate 通过（`@deepseek-ai/*` 仅 type-import）

### 静态与回归
- [ ] typecheck / lint / 121+ 测试全绿，零回归（patch-presets.spec 等按新契约更新者除外）
- [ ] `src/risk.ts` / `learning.ts` / `engine.ts` 判定语义零改动（git diff 核实）

### 真实 profile 冒烟
- [ ] 冒烟前备份 profile；先在禁用插件的干净 profile 确认 0.1.5-rc.2 基线可用
- [ ] 安装 gate 后重启 → 加载无 `Failed to load plugins`；升级场景先强刷浏览器（client combo 缓存）
- [ ] 端到端：切「自动审查」档 → shell 放行/拦截行为正确 → dock 提示条出没 → 事件流可查 → 卸载无残留

## Should Pass
- [ ] README 排障章节补充「升级后插件消失 → 强刷浏览器」条目
- [ ] CHANGELOG（四语）3.0.0 条目：engines 收窄、patch owner 迁移、0.1.5 适配说明
- [ ] 本机 `node -v` ≥ 24（跑 0.1.5 宿主的前提，不符合先升 Node）
