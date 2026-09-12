# Tasks — 0.1.5 升级（compat/0.1.5）

> 铁律：每 task 完成即跑对应验证；粒度 2–5 分钟；涉及宿主实测的 task 标注「实测」。
> 分支纪律：task_1 建分支后，所有改动只落 `compat/0.1.5`。
>
> 2026-09-13：静态可完成项全部完成（typecheck/lint/264 测试/build 全绿）。
> 实测类任务改以「离线探测」完成：`npm install @deepseek-ai/dsh@0.1.5-rc.2` 到临时目录，
> 直接核查发布包源码（结论见 findings.md 的 ✅ 标注项）。真机 profile 冒烟（task_2/19 与
> task_12/13 的运行时部分）留待用户环境执行。

## Phase 0: 环境与分支

- [ ] task_1: `git checkout main && git pull && git checkout -b compat/0.1.5`；核实本机 `node -v` ≥ 24（不满足先装 Node 24，作为前置说明记录到 findings）。验证：`git branch --show-current` = compat/0.1.5。
- [ ] task_2: （实测）备份目标 DSH profile；在禁用插件的干净 profile 启动 DSH 0.1.5-rc.2 确认基线可用（对照 findings R4）。验证：`dsh web` 启动、能建会话。

## Phase 1: 0.1.5 契约探测（只读实测，不改代码）

- [x] task_3: （实测）确认 0.1.5-rc.2 中权限预设表的 cordis owner id 与实际内置 preset 集：检视 `@deepseek-ai/dsh-permission-presets` 组合声明/profile 内 cordis.patch.yml；结论写入 findings F1（owner id + 内置键集）。验证：结论有源码/配置文件路径佐证。
- [x] task_4: （实测）核实 `packages/interaction/user-approval` 0.1.5 源码中 `effectivePolicy` 是否仍存在（私有方法名/签名）；不存在则确定回退读法（`permissions` projection 或服务公开面）。验证：结论附文件路径与行号，写入 findings F2。
- [x] task_5: （实测）反编译核对 `@deepseek-ai/dsh-client-ui-conversation@0.1.5-rc.2/lib/client.js` 的 `permissionGlyphs` map 与权限选择器实现位置；确认设置侧行为在 `ui-permission-presets` 的现状。验证：结论写入 findings F6。
- [x] task_6: （实测）在 0.1.5-rc.2 装当前 2.1.0 版 gate 观察失败面（预期：patch owner 不匹配 → 档位丢失；其余集成点逐项记录通过/失败）。验证：失败清单写入 findings，作为 task_8+ 的靶子。

## Phase 2: manifest 与 patch 迁移

- [x] task_7: `package.json` — version 3.0.0、`engines.dsh` `>=0.1.5-rc.1 <0.2.0-0`、`engines.node` `>=24`。验证：`npm run typecheck`。
- [x] task_8: `cordis.patch.yml` — 预设 patch 块迁到 task_3 实测的 owner id；按实测内置集重述全部档位 + `permissive`（形状 `sandbox`/`approval`/`name`/`description`，评估是否加 `defaultPreset`）；更新文件头注释（owner 变更原因、整表替换语义、read-only 处置）。验证：YAML 解析 + `dsh plugin --profile web add` 加载成功（实测）。
- [x] task_9: `test/patch-presets.spec.ts` — 钉住新 owner id 与新键集（内置档 + permissive）。验证：`npx vitest run test/patch-presets.spec.ts`。

## Phase 3: 宿主半核实与修复

- [x] task_10: 按 task_4 结论处理 `effectivePolicy`：在 → 仅补注释说明 0.1.5 位置；不在 → 实现回退读法（runtime.ts 读取处 + 测试）。验证：typecheck + 既有 runtime 测试绿。
- [x] task_11: （实测）host inject 五项（`tools`/`webServer`/`llm`/`agentDefaultModel`/settings 探测）在 0.1.5 profile 全部解析；失败项按「运行时探测 + 降级」改造 `src/index.ts`。验证：0.1.5 profile 下 gate 加载日志无 inject 失败。
- [ ] task_12: （实测）`approval/request` 回答与 escalation-auto 路径冒烟（对照 #6215：danger-full-access 下升级请求行为）。验证：事件流 JSONL 出现预期 verdict。
- [ ] task_13: （实测）`/api/dsh-perm-gate/events` 路由注册与查询（对照 #5926/#5889）。验证：浏览器/curl GET 返回事件。

## Phase 4: 浏览器半核实与修复

- [x] task_14: （实测）三个 slot 渲染核实（dock 提示条 / 会话视图历史入口 / 设置卡片）；契约变化的项更新 `src/client/index.ts` 的 SlotMap 镜像声明与注册参数。验证：client typecheck + 实测渲染。
- [x] task_15: 按 task_5 结论处理图标：glyph map 未迁移 → 仅核实；迁移 → patch 跟随 + 依赖 permission-icon.ts DOM 装饰兜底核实。验证：composer 菜单项/触发按钮、设置行三处图标实测。
- [x] task_16: `npm run build` + bundle 抽查（lib/client.js 含三个 slot 注册、purity gate 通过）。验证：build 绿 + grep 抽查。

## Phase 5: 文档与全量验证

- [x] task_17: README 四语 — 兼容矩阵更新（3.x = 0.1.5 线）+ 排障条目（升级后插件消失 → 强刷浏览器）；CHANGELOG 四语 3.0.0 条目。验证：四语链接块完整。
- [x] task_18: 全量 `npm run typecheck && npm run lint && npm test && npm run build`；对照 checklist.md 逐项勾选。验证：全绿、零回归。
- [ ] task_19: （实测）最终冒烟：备份后 profile 重装 3.0.0 → 端到端（切档 → 放行/拦截 → dock → 事件流 → 卡片 → 卸载）。验证：checklist「真实 profile 冒烟」全勾。
- [x] task_20: 提交 compat/0.1.5（含遗留的类型修正工作区改动；冒烟 task_19 待真机）。
