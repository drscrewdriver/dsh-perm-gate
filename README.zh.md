# dsh-perm-gate

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

> **兼容性说明：** v0.1.0 自带 `ja` / `ko` 字典，但官方 DSH 的 `LocaleRuntime`
> 只暴露 `zh` / `en`（`LOCALE_IDS = ["zh", "en"]`）。在原版 DSH 上选择 `ja` / `ko`
> 会报 `locale "<id>" is not registered`。请使用更新了 `LOCALE_IDS`
> （locale-settings.ts）与 `LOCALES` 标签（client/index.ts）的 DSH fork 并重新构建。

版本 **0.1.0** —— 变更见 [Changelog](./CHANGELOG.md)。

一个**单一自足、确定性优先、fail-closed** 的 DeepSeek Harness 权限门插件。

对每个工具调用按固定优先级链裁决：

| 阶段 | 决策 | 含义 |
| ---- | ---- | ---- |
| **P0** | `deny` | 确定性硬拒：凭据材料 / 受保护路径改写 / 危险 shell |
| **P1** | `allow` | 精确、有界的**会话放行** grant |
| **P2** | `deny/allow/ask` | 静态规则链：黑名单优先，其次 allow，再 ask |
| **P3** | `allow/deny/ask` | 可选 LLM 语义分类器（默认**关闭**） |
| **P4** | `ask` | 官方 approval seam |

严格 fail-closed：P0 永不因 grant / 规则 / 分类器 / 人工而放行。

## 特性

- **命令白/黑名单** — 基于 **argv 分解**匹配（非裸字符串），递归下钻 `sh -c`/`bash -c`、识别管道、重定向目标、递归/强制（`rm -rf`）。
- **deny 优先** — 命中黑名单即拒绝，胜过任何 allow。
- **会话放行** — 精确的 `(工具, 规范化 fingerprint)` grant，带 `TTL` + `maxUses`；换目标绝不复用。子代理继承但不可自授。
- **纯函数规则引擎** — glob/regex 编译 + ReDoS 上限、坏规则 loud fail、按源内容哈希缓存。
- **审计** — 每次决策写为 `{ignorable:true}` 事件并带 `callId`；模型可见理由与记录一致。
- **Permissive 档位** — 一个**独立审批模式**（区别于只读、完全权限与白名单档），既不是"自动审批"，也不授予泛化权限。前端只暴露**一个开关**（`permissive`），后台三个审批策略**可组合**、由插件设置决定——仍对 P0 保持 fail-closed。

## 安装

需要先安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

```sh
dsh plugin --profile web add dsh-perm-gate
```

完整的安装、升级、迁移与排查步骤见[中文安装指南](./INSTALL.zh.md)（另有
[English](./INSTALL.md) / [日本語](./INSTALL.ja.md) / [한국어](./INSTALL.ko.md)）。

## 配置

`cordis.yml`：

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml
    dshHome: $DSH_HOME
    defaultAction: ask
```

规则示例：见 [examples/permissions.example.yaml](./examples/permissions.example.yaml)。

## Permissive 档位

Permissive 是权限下拉框里一个**独立审批档**，与 Read Only / Workspace Write / Full access /
Whitelist 平行。它**不叫"自动审批"**、也不授予泛化权限：只会在人类/LLM 接缝**之前**收窄或放宽决策，
P0 硬拒绝始终单调且不可协商。

`cordis.yml`：

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml
    defaultAction: ask
    permissive: true            # 前端唯一的开关（启用独立档）
    permissiveStrategies:        # 后台策略，可组合
      trustAutoAllow: true       # 作用域内安全操作自动放行；危险/未知转 ask
      alwaysConfirm: false       # 一律逐次 ask；允许控件附带重复允许/迁白名单按钮
      llmAssist: false           # 先由 LLM 分类裁决；ask/无分类器时回退到人工
```
(llmAssist 的真实接收 LLM 在设置页填 `classifierEndpoint` / `classifierModel`，OpenAI 兼容的自定义 API
均可。)

`trustAutoAllow` 是中间档基线（rule-allow 自动放行）。`alwaysConfirm` 让每次越界都走审批面板，其
「允许控件」含两个扩展按钮：**本会话重复允许该类**（会话限次 grant，`approveRepeat`）与
**允许所有类型**（把命令词持久写进 `permissions.yaml` 的 allow 白名单，`approveAllowEverywhere`）。
`llmAssist` 调用配置的真实 LLM（任意 OpenAI 兼容 API）自动裁决 `ask`，结果不确定/出错时回退人工
接缝——始终 fail-closed。`permissive` 关闭时，门禁行为与之前完全一致。

### 权限下拉里可选档位

`cordis.patch.yml` 通过扩展 DSH 的 `permission.config.presets` 加入了 `permissive` preset
（`sandbox: workspace-write`、`approval: ask`、名称 **Permissive**），位于 Workspace Write 与
Full access 之间——与 Auto 档同一机制。因此会话权限下拉里会出现 Permissive 这个**独立可选审批档**，
而不是"auto-approval"档。

### 在 UI 里可配置

该档位也可在运行时从 **设置 → 插件 → Permissive 审批档** 调整（插件浏览器端渲染的
`settings.plugins.tab` 页面）：一个开关切换 `permissive`，三个开关编辑后台
`permissiveStrategies`。host 端 live 读取该命名空间，改动对下一条工具调用即时生效，无需重启。
这是一个独立审批类，**不是** DSH 的"auto-approval"档。

## CLI（独立 dry-run）

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
```

## 开发

```sh
npm run typecheck
npm test
npm run build
```

## 许可证

[MIT](./LICENSE)