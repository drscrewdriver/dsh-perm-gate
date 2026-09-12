# Spec: dsh-perm-gate 升级适配 DSH 0.1.5（compat/0.1.5 分支）

> 前一份 spec（dsh-approval-gate 增强）已完成并随 2.1.0 发布，本文件覆盖为新一轮任务。
> 历史记录见 git（main @ 6dfd091）。

## 需求

1. 在新分支 `compat/0.1.5`（自 `main` 切出）上，将插件适配为 DSH 0.1.5 专属版本线，发布为 3.x 系列（沿用仓库版本线惯例：`legacy` = 0.1.1 线，`main` 2.x = 0.1.2+ 线）。
2. `engines` 声明对齐 0.1.5：`dsh >=0.1.5-rc.1 <0.2.0-0`、`node >=24`（0.1.5 在 Node < 24 静默失败，见 findings F10）。
3. `cordis.patch.yml` 的「自动审查」预设档 patch 迁移到 0.1.5 的 `@deepseek-ai/dsh-permission-presets` 服务配置（键形状兼容：`sandbox`/`approval`/`name`/`description`，可评估补 `defaultPreset`），并按 0.1.5 实际内置预设表重述全部必须保留的档位（0.1.5 默认表只有 `workspace-write` 与 `danger-full-access`，见 findings F1）。
4. 权限选择器图标（permissive 档盾形 glyph）在 0.1.5 上继续生效：核实 glyph 装饰在 0.1.5 的落点（`ui-conversation` composer 侧 vs 新增 `ui-permission-presets` 设置侧），patch/DOM 装饰随之调整。
5. 宿主半集成点在 0.1.5-rc.2 上逐项核实并修复：`approval/request` 回答者链、`effectivePolicy` 私有方法读取、`installSection` settings、`webServer.register` HTTP 通道、`inject` 服务可用性。
6. 浏览器半集成点在 0.1.5-rc.2 上逐项核实：slots 契约（`conversation.input.dock` / `conversation.view` / `settings.plugins.tab`）、locale、settingsScope、client bundle purity。
7. 全量测试 + 真实 DSH 0.1.5-rc.2 profile 冒烟验证，README（四语）/CHANGELOG 版本兼容矩阵更新。

## 技术方案

- **分支与版本**：`git checkout -b compat/0.1.5 main`；`package.json` version → `3.0.0`，`engines.dsh` → `>=0.1.5-rc.1 <0.2.0-0`，`engines.node` → `>=24`。devDeps 已在 `^0.1.5-rc.2`，无需改。
- **预设档 patch**：先在 0.1.5-rc.2 环境确认拥有 `presets` 配置的 cordis 插件 id（0.1.5 由 `dsh-permission-presets` 服务承接，配置 `Record<string, PresetSpec>` + 可选 `defaultPreset`），`cordis.patch.yml` 的 `- id: permission` 块改为实际 owner id；`test/patch-presets.spec.ts` 同步钉住新 owner + 键集。patch 值合法性关键——0.1.5 上非法 preset 配置会触发 cordis 无限 reload + OOM（findings F9）。
- **glyph 装饰**：反编译核对 `@deepseek-ai/dsh-client-ui-conversation@0.1.5-rc.2` `lib/client.js` 的 `permissionGlyphs` map 是否仍在原位；composer 侧在 → 现有 patch 不变；若选择器迁至 `ui-permission-presets` → 在该包 lib 上加等价 patch 或依赖既有 DOM 装饰（`permission-icon.ts` MutationObserver）覆盖。
- **宿主半**：核心判定逻辑（P0–P4 瀑布、learning、risk 协议）零改动。仅（a）核实 `effectivePolicy` 私有方法在 0.1.5 `user-approval` 包仍存在（审批缝契约 R1/R2 保留，findings F3）；不在则回退读 `permissions` projection；（b）`tools`/`webServer`/`llm`/`agentDefaultModel` inject 在 0.1.5 profile 下逐项可用性核实，`webServer` 已有存在性守卫，其余按需加探测降级。
- **浏览器半**：重点核实三个 slot 契约在 0.1.5（conversation 重写 + sidebar 重写后）不变；`settingsScope.bind` 行为不变；purity gate 不变。
- **不做**（YAGNI）：不引入 `ctx.permissionPresets.set()/current()` 调用（gate 不切预设，只贡献档位）；不做 0.1.2/0.1.5 双兼容（main 2.x 已承担 0.1.2+ 线）；不改会话数据写入（gate 不写会话日志事件，不涉及 V3 迁移拒载风险）。

## 决策记录

| 选项 | 选择 | 理由 |
|------|------|------|
| 双兼容 vs 0.1.5 专属线 | 0.1.5 专属线（3.x，compat/0.1.5 分支） | 仓库惯例是版本线分支；预设 patch owner id 两线不同，单文件双兼容需双 patch，复杂度不成比例 |
| 预设档 patch 目标 | 迁到 `dsh-permission-presets` 实际 owner id | 0.1.5 preset 表由该服务配置承接，键形状完全兼容 |
| gate 是否改用 `permissionPresets` API | 否，保持 `effectivePolicy` + 回退 | gate 只读审批策略不写；减少对新 API 的硬依赖 |
| node engines | `>=24` | DSH 0.1.5 自身要求（#6124/#6115 静默失败） |
| 判定逻辑 | 零改动 | 0.1.5 审批缝契约（`approval/request` 回答者链、闭集结果、fail-closed）与 0.1.2 一致，无需动 |

## 约束

- 分支基线：`main` @ 6dfd091（2.1.0）。
- 验证环境：本机 DSH 0.1.5-rc.2 profile（`dsh plugin --profile web add`）；冒烟前备份 profile（0.1.5 会话迁移/升级损坏问题高发，findings F11）。
- 全程不改 `src/risk.ts`/`learning.ts`/`engine.ts` 判定语义；改动集中在 manifest、patch、inject、客户端契约核实。
- 测试基线 121/121 全绿；升级后零回归（slot/patch 相关 spec 按 0.1.5 契约更新除外）。
- 仓库规约（AGENTS.md）继续生效：listener 放行必须 `next()`；P0 永不协商；unknown 配置 fail loud；四语文档镜像。
