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

> **▼ DSH 版本适配**
>
> | DSH 版本 | 加载 | 设置注册 | 宿主门 | 客户端半 |
> | --- | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | ✅ | `ctx.settings.register(ns, schema, { base })` | ✅ `tools/pre-execute` 一致 | ✅ 仅类型导入 |
> | 0.1.2-alpha.2+ / 0.1.2-rc.1 | ✅ | `register` 仍保留（另加 `installSection`） | ✅ `tools/pre-execute` 一致 | ✅ 仅类型导入 |
>
> 一份产物同时支持两版本。两处版本敏感点都用**能力探测**而非版本号判断：
> ① 设置注册走 `register`，它在所有目标版本都存在（`installSection` 是 0.1.2 的
> **新增**而非替代）；② `effectivePolicy` 在**两版本**中都是 user-approval 服务的
> **私有**方法，故只在 `typeof` 探测后调用，缺失或抛错时降级为「策略未知」。
> 客户端 bundle 对 `@deepseek-ai/*` 无任何值导入，因此 0.1.2 的
> `dsh-client-runtime` → `dsh-client-store` 改名不会影响它。

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
    rulesFile: ./permissions.yaml   # 可选；默认 $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME
    defaultAction: ask
    gatePresets: [permissive]       # 门禁生效的档位（默认值）
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
均可。设置页可选择接收来源：**自定义 API**（任何 OpenAI 兼容端点，内置小米 MiMo `https://api.xiaomimimo.com/v1` 等预设）或**宿主模型组**（复用 DSH 会话已配置的 `llm` 服务与当前模型组，可用 `classifierProvider` / `classifierModel` 覆盖）；并提供**健康测试**按钮，一键验证接收 LLM 的连通性与延迟。)

`trustAutoAllow` 是中间档基线（rule-allow 自动放行）。`alwaysConfirm` 让每次越界都走审批面板，其
「允许控件」含两个扩展按钮：**本会话重复允许该类**（会话限次 grant，`approveRepeat`）与
**允许所有类型**（把命令词持久写进 `permissions.yaml` 的 allow 白名单，`approveAllowEverywhere`）。
`llmAssist` 调用配置的真实 LLM（任意 OpenAI 兼容 API）自动裁决 `ask`，结果不确定/出错时回退人工
接缝——始终 fail-closed。`permissive` 关闭时，门禁行为与之前完全一致。

### 权限下拉里可选档位

`cordis.patch.yml` 在 DSH 的 `permission.config.presets` 里新增了 `permissive` preset
（`sandbox: workspace-write`、`approval: ask`、名称 **Permissive**），位于 Workspace Write 与
Full access 之间。DSH 的 bundle patch 对这个 map 是**整表替换**而非逐键合并，所以该文件还必须重述三个内置档
（`read-only` / `workspace-write` / `danger-full-access`，取自
`@deepseek-ai/dsh-base/cordis.patch.yml`）；`test/patch-presets.spec.ts` 固定了这份键集合。因此会话权限
下拉里会出现 Permissive 这个**独立可选审批档**，而不是"auto-approval"档。

门禁**只在 `gatePresets` 列出的档位里生效**（默认 `['permissive']`，即本插件新增的那一档）。在其余任何档位
（Read Only、Workspace Write、Full access、`custom`）里，门禁的判定流程**完全不运行**：不放行、不弹审批、
不拒绝、不执行 P0 硬拒绝、不做黑名单关键词拦截，也不写审计事件——该档位自己的策略说了算。这正是重点所在：
`danger-full-access` 的定义就是"全权限、不弹审批"，用 ask 去覆盖它毫无意义（该档 `approval: never` 会让审批接缝
**在任何 answerer 运行之前**直接返回 `rejected`，被转发的 ask 只能得到 `the user rejected tool "..."`，面板根本不会
弹出），用硬拒绝去覆盖它则等于悄悄推翻用户选定的档位。`gatePresets: ['*']` 可让门禁重新全局生效（含硬拒绝层）；
在生效档位内，若会话生效的审批策略为 `never`，ask 仍会降级为放行。

### 在 UI 里可配置

该档位也可在运行时从 **设置 → 插件 → Permissive 审批档** 调整（插件浏览器端渲染的
`settings.plugins.tab` 页面）：一个开关切换 `permissive`，三个开关编辑后台
`permissiveStrategies`。host 端 live 读取该命名空间，改动对下一条工具调用即时生效，无需重启。
这是一个独立审批类，**不是** DSH 的"auto-approval"档。

### 风险分级 llmAssist、裁决学习与事件流

开启 `llmAssist` 后，接收 LLM（自定义 OpenAI 兼容端点，或 DSH 宿主模型组——见上文）按结构化协议逐条评估 `ask`：

- `safe` → 自动放行（审计来源为 `classifier`）。
- `risky` + **硬风险类别**（`deletion`、`credential`、`remote`、`system`、`bulk`）→ 一律转人工；硬风险永不自动放行、也永不进入学习。
- `risky:neutral` → 若开启 `riskLearning`（设置卡片内，默认关闭），人工批准且真实执行的 neutral 风险会按 `tool|类别` 计数；计数达到 `riskThreshold`（默认 3）且新调用的操作指纹（命令词 + 目标基名）命中已确认样本时，**同一操作**自动放行。不同目标永不复用该放行。开启学习沉淀（`riskSediment`，默认开）后，满阈值 key 的确认样本会成为**确定性放行规则**：指纹精确命中即直接放行、无需再过 LLM——即使关闭 llmAssist 也继续生效；沉淀规则在设置卡片中可见、可管理（终止学习 / 删除样本）。
- 超时（`riskTimeoutMs`，默认 20s，重试 1 次）、传输失败与协议外输出均维持原 `ask`——门禁绝不猜测。

学习状态持久化在插件自有 JSON（`$DSH_HOME/perm-gate/learning.json` 或 `learningFile`），不写入你的 YAML 规则文件。每次决策都会追加到 `$DSH_HOME/perm-gate/events.jsonl`（或 `eventsFile`），并经 `GET /api/dsh-perm-gate/events?sessionId=&since=` 提供；浏览器端轮询该接口，在输入框上方以提示条展示最新决策（ask 常驻至下一条事件），并在对话视图的「审批记录」页签按时间倒序列出本会话的全部判定。

每次决策涉及的文件都会在改动落地前快照（每事件 ≤5 个文件、单文件 ≤256 KB）到 `$DSH_HOME/perm-gate/snapshots/`；「审批记录」页签中每个文件 chip 可点开行级改动对比（`GET /api/dsh-perm-gate/diff`），并可**撤销**该改动——向会话投递恢复指令（`POST /api/dsh-perm-gate/revert`）。快照管理条支持按会话或全量清理（`GET /api/dsh-perm-gate/snapshots-stats` / `POST /api/dsh-perm-gate/snapshots-clear`）。

转人工的 `ask` 会被跟踪到人工给出答复为止：一个**被动** `approval/request` 观察者记录封闭结果（`allowed-once` → **人工通过**、`rejected` → **人工拒绝**、`cancelled` → **人工取消**、`unavailable` → 拒绝，因为不存在审批通道）；当观察者无法关联该 ask 时（缺 `callId`、无 approval 服务、上游监听者短路），由 `tools/result` 兜底结算同一个 ask。人工通过会显示通过后的学习进度（`n`/阈值），通知条也会为三种终态分别打标。

插件还内置一份**预置黑名单关键词**（继承自 dsh-approval-gate 的 `DEFAULT_DENY_KEYWORDS`：
`rm -rf`、`push --force`、`drop table`、`mkfs`、`git reset --hard`、`docker system prune` 等），
调用文本命中任一关键词（大小写不敏感子串）即直接拒绝，且先于白名单 / 授权 / LLM。黑名单在设置
卡片中按列表查看与增删（预置条目带标签，可一键恢复预置）；未设置或为空时应用预置列表——黑名单
不会静默关闭。
Permissive 档在权限选择器中保留盾形图标——菜单项与折叠触发按钮均有图标。


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