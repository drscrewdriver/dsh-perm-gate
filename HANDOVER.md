# dsh-perm-gate — 交接文档（HANDOVER.md）

> 版本线：**v2.4.1**（`package.json`）· 分支 `main`（DSH ≥ 0.1.2-alpha.1）
> 仓库：`E:\test\rewrite-agently\mine-dsh-plugins\dsh-perm-gate`
> 安装：`dsh plugin --profile web add dsh-perm-gate`
> 目标读者：续接会话 / 新协作者 — 15 分钟理解全貌，30 分钟开始贡献。
> **本文所有数字均为 2026-09-17 实测值**（`npm test` 实跑 / 目录枚举 / `package.json` 读取）。

---

## 0. 一句话背景

`dsh-perm-gate` 是一个 **DSH Web 插件**：为 DeepSeek Harness 提供 P0–P4 五层权限门控——P0 硬拒绝凭据/保护路径/危险 shell、P1 会话级精确放行 grant、P2 静态规则链（deny→allow→ask）、P3 可选 LLM 风险分级裁决（**只升不降**）、P4 人工确认缝。独立「自动审查」档位（机器值 `permissive` / `permissive-full`）与只读/完全权限/白名单平行。

---

## 1. 项目目录（2026-09-17 实测行数）

```
dsh-perm-gate/
├── src/                                    # 42 个文件
│   ├── index.ts                    756 行  # host 半入口：cordis apply / settings 注册 / pre-execute 水闸 / 路由装配
│   ├── config.ts                   349 行  # Schemastery schema + resolveConfig / resolveDataDir / resolveDshHome
│   ├── runtime.ts                 1741 行  # PermGateRuntime 门控引擎（全生命周期，本仓库最大模块）
│   ├── engine.ts                   214 行  # P0 硬拒绝判定（hardDenyReason）+ P0→P1→P2 决策链路
│   ├── evaluate.ts                 377 行  # 静态规则匹配 ruleMatches（10+1 维度，deny-first）
│   ├── rule.ts                     319 行  # permissions YAML 解析 + VALID_KEYS + RegExp 编译（含 ReDoS bound）
│   ├── rule-dims.ts                275 行  # 6 个扩展维度的类型与解析（params/absent/agents/when/argv/network）
│   ├── rule-chain.ts               281 行  # 多文件规则链解析与合并（searchUp / fallback / badFilePolicy）
│   ├── shadow.ts                   167 行  # 阴影检测（被完全遮蔽的规则序号）
│   ├── compiler.ts                 241 行  # glob/literal/CIDR/端口/域名/参数模式 → RegExp 编译器
│   ├── network.ts                  270 行  # 网络纯策略层（NetworkMode / decideNetworkTarget / 回环判定）
│   ├── network-lifecycle.ts        233 行  # 代理生命周期（启动/重绑/销毁/环境注入快照恢复）
│   ├── proxy.ts                    603 行  # NetworkProxy：HTTP 转发 + CONNECT 隧道 + 403 阻断 + socket 加固
│   ├── watch.ts                    203 行  # chokidar 规则文件监听（防抖 / 链级联动 / LRU 回收）
│   ├── parsers/git.ts              502 行  # git 命令语义解析（子命令 / 分支 / 远程 / 标志 / 破坏性评级）
│   ├── parsers/shell-cmds.ts       326 行  # 危险 shell 命令解析（rm/mv/chmod/… + 路径与标志提取）
│   ├── command-semantics.ts         67 行  # CommandSemantics / CommandParser 接口
│   ├── command-dispatcher.ts       112 行  # 分类器调度（按命令族路由到对应 parser）
│   ├── shell.ts                    200 行  # argv 分解（pipeline / 重定向 / sh -c 递归 / force 识别）
│   ├── classifier.ts               181 行  # LLM classifier transport（OpenAI 兼容 POST + 超时/重试）
│   ├── risk.ts                     174 行  # 风险分级协议（safe / risky:category / unresolved）
│   ├── host-llm.ts                  86 行  # DSH host llm 服务调用封装
│   ├── learning.ts                 253 行  # 判决学习（风险确认计数 + 指纹 + 沉淀）
│   ├── grant.ts                    140 行  # 会话级 grant（canonical fingerprint + TTL + maxUses）
│   ├── allowlist.ts                 89 行  # rulesFile allow 段增删改
│   ├── path.ts                     115 行  # 路径归一化 + 敏感/受保护检测 + ArtifactRegistry
│   ├── agent-identity.ts           107 行  # 从会话 header 提取 main/subagent/preset:<name> 候选
│   ├── preset.ts                    62 行  # 会话权限档位读取（gatePresets 作用域判定）
│   ├── session-sweep.ts            167 行  # 清理已归档/已死会话的门控事件与快照
│   ├── events.ts                   837 行  # 决策事件 JSONL + snapshot/diff/revert + 9 条 HTTP 路由注册
│   ├── audit.ts                     64 行  # 审计条目 + MemoryAuditMirror
│   ├── risk 配套: deny-defaults.ts  20 行 · llm-presets.ts 22 行 · receiver-info.ts 112 行
│   ├── cli.ts                       77 行  # 独立 dry-run CLI（薄壳，逻辑在 dry-run.ts）
│   ├── dry-run.ts                  164 行  # 规则测试的共享判定层 + 只读规则层报告
│   └── client/                             # browser 半（tsdown 打包为 lib/client.js）
│       ├── card.tsx               1073 行  # 自动审查设置卡（主 UI：四策略 + 网络开关 + 学习/阈值 + 规则测试）
│       ├── history.tsx             633 行  # 审批历史视图（时间线 + diff + snapshot）
│       ├── locales.ts              564 行  # 四语字典，zh 为键集源，**135 key**
│       ├── feed.ts                 257 行  # Feed 组件 + session 解析 + diff/revert 网络层
│       ├── notice.tsx              154 行  # 通知条（conversation.input.dock）
│       ├── sediment.tsx            141 行  # 沉淀学习可视化子组件
│       └── index.ts                128 行  # locales 注册 + 3 个 slot 注册
├── test/                                   # vitest：45 文件 / 511 测试
├── scripts/
│   ├── patch-permission-glyph.mjs          # opt-in：为两个自动审查档补 composer 图标（含 bin）
│   ├── verify-line.mjs                     # 双线校验
│   └── sync-0.1.5-line.mjs                 # 0.1.5 线差量声明 + check/apply
├── lib/                                    # 构建产物（**git 跟踪**，71 个文件；github 安装免构建）
├── examples/permissions.example.yaml       # 规则示例
├── docs/                                   # 见 §7 文档地图
├── cordis.patch.yml                        # DSH profile 补丁（presets 5 键 + 插件插入）
├── dsh.plugin.json                         # 插件描述符（id/version/engines/components）
├── AGENTS.md                               # 开发规范（合约/铁律/构建/文档）
├── CHANGELOG.md (+.ja/.ko) · README.md (+.zh/.ja/.ko) · INSTALL.md (+.zh/.ja/.ko)
├── eslint.config.mjs · vitest.config.ts · tsconfig{,.build,.client}.json · tsdown.config.ts
└── LICENSE (MIT)
```

---

## 2. DSH 契约点

### 2.1 cordis 插件合约

| 契约点 | 值 | 位置 |
|--------|-----|------|
| `name` | `'dsh-perm-gate'` | `src/index.ts:21` |
| `inject` | `['tools', 'webServer', 'llm', 'agentDefaultModel']` | `src/index.ts:29` |
| 导出 | `name` / `inject` / `Config` / `apply`，**无 default export** | DSH Loader 解包 `exports.default ?? exports` |

### 2.2 settings 注册

| 契约点 | 值 |
|--------|-----|
| API | 双 API 回退：`installSection`（0.1.2+）→ `settings.register`（所有版本） |
| 命名空间 | `'dsh-perm-gate'`（`PERMISSIVE_NAMESPACE`，`src/index.ts:37`） |
| Schema | `Config`（Schemastery `z.object()`，`src/config.ts`） |
| 装配 | `src/index.ts:502` 调 `installSettingsSection(...)` |

### 2.3 slot 注册（`src/client/index.ts`）

| slot 名 | id | 组件 | order |
|---------|-----|------|-------|
| `settings.plugins.tab` | key `dsh-perm-gate` | `PermissiveCard` | — |
| `conversation.input.dock` | `dsh-perm-gate.notice` | `NoticeStrip` | 30 |
| `conversation.view` | `dsh-perm-gate.history` | `HistoryView` | 20 |

### 2.4 HTTP 端点（10 条，全部 `/api/dsh-perm-gate/*`）

| 方法 | 路径 | 功能 |
|------|------|------|
| `GET` | `/events?sessionId=&since=` | 决策事件 JSONL |
| `GET` | `/diff` | unified diff |
| `POST` | `/revert` | 撤销文件改动 |
| `GET` | `/snapshots-stats` | 快照统计 |
| `POST` | `/snapshots-clear` | 清理快照 |
| `GET` / `POST` | `/learning` | 学习状态读 / 重置 |
| `POST` | `/health` | health test |
| `GET` | `/receiver` | llmAssist receiver 元数据 |
| `GET` | `/network` | 网络诊断（模式 / 代理端口 / 绑定状态） |
| `POST` | `/dry-run` | **只读**规则测试：`{tool, args?, permissive?}` → 裁决 + 规则层命中 |

定义集中在 `src/events.ts`；注册入口 `registerEventsRoute` / `registerReviewRoutes` / `registerLearningRoute` / `registerHealthRoute` / `registerNetworkRoute` / `registerReceiverRoute` / **`registerDryRunRoute`**。

> `/dry-run` **没有写形态**：它不碰规则、授权、学习状态与 settings 命名空间，未知 body 字段直接丢弃。
> 测试规则的动作本身不能改变规则。
>
> **复核路由是否存在的方法（实测得出，别再用错）**：宿主对**未注册路径**一律回 **401**，而不是 404；
> 已注册的插件路由则**完全可达**（`GET /network` → 200、`POST /network` → 405、`POST /learning` → 400）。
> 因此 **401 是「路由未注册」的信号，不是鉴权**。判定某路由是否生效：`GET` 它——注册了会走本插件的
> method 检查（GET 不被接受时回 405），未注册则回 401。

### 2.5 水闸事件

| 事件名 | 监听方式 | 说明 |
|--------|---------|------|
| `tools/pre-execute` | `ctx.on()` | 水闸入口：返回 `deny`/`ask` 或 `next()` |
| `tools/result` | `ctx.on()` | 结算：学习/ask 落账 |
| `approval/request` | `ctx.inject(['approval'], …)` | 被动观察手动批准结果 |

### 2.6 语义 token

`--dsw-alias-label-primary` / `-secondary` / `-tertiary` / `-caption`、`--dsw-alias-bg-layer-3`、`--dsw-alias-bg-surface`、`--dsw-alias-border-l2`、`--dsw-alias-state-business-primary`、`--ds-font-family-code`。

---

## 3. 匹配维度总表（11 个维度 + 3 个通用字段）

`src/rule.ts` 的 `VALID_KEYS` 是权威清单，逐字如下：
`tools` / `command` / `args` / `paths` / `params` / `absent` / `agents` / `when` / `argv` / `network` / `branch` / `action` / `reason` / `enabled`。

| 维度 | 语义 | 逻辑 | 实现 |
|---|---|---|---|
| `tools` | 工具名 glob | OR | `evaluate.ts` |
| `command` | 命令词 `word#recursive\|force` | OR | `parsers/git.ts` + `parsers/shell-cmds.ts` |
| `args` | 参数 token 扫描 | **OR**（非 AND——见 `docs/ui-gap-analysis-and-branch-permissions.md` §3.3） | `evaluate.ts` |
| `paths` | 工作区相对路径 glob | OR | `path.ts` |
| `params` | 键→值 glob | **AND over keys**，`!` 前缀取反 | `rule-dims.ts` |
| `absent` | 必须不存在的参数键 | AND（全部缺失） | `rule-dims.ts` |
| `agents` | `main` / `subagent` / `preset:<name>` | OR | `agent-identity.ts` |
| `when` | 环境/平台条件 | AND | `rule-dims.ts` |
| `argv` | 额外 argv 模式（`pipeline` 等） | OR | `evaluate.ts:112` |
| `network` | 域名 / IP / 端口 / scheme | OR + CIDR | `network.ts` + `compiler.ts` |
| `branch` | git 分支 / 远程 / 保护分支（**仅 git 命令**） | 子维度 AND，内部 OR | `command-dispatcher.ts` + `parsers/git.ts` |

完整格式规范见 `docs/rules-format.md`（中）/ `docs/rules-format.en.md`（英）。

---

## 4. 重要设计原则

1. **P0 硬拒绝单调性** —— 凭据/保护路径/危险 shell 的硬拒绝从不协商、从不被后续阶段覆盖。代码：`engine.ts::hardDenyReason()` 始终最先执行。
2. **只有确定性层可以 deny** —— P0 硬拒绝、deny 关键词黑名单、显式 `deny:` 规则。**P3 LLM 分类器 escalate-only**：可自动放行（`safe`）、可维持/提升 ask，**永不产生 deny**。实测教训：分类器把一条良性 `git commit -F …` 判成 `remote` → 自动拒绝 → 既无面板可批、也无 grant 可复用。
3. **只读内部工具自动放行** —— `read` / `read_image` / `grep` / `glob` / `ls` / `lsp` 及 `agent_teams_*` / `memory_*` / `job_*` / `taskboard_*` 等内部工具；P0 仍优先（携带凭据材料照样拦）。代码：`engine.ts::decide()` 的 `READ_TOOLS` + `INTERNAL_TOOLS` 预检。
4. **deny wins over allow** —— deny → allow → ask，首次匹配胜出；黑名单词层在 deny 之前。
5. **fail-closed 默认** —— LLM 分类器任何错误/超时/非 JSON → `ask`，绝不自动放行。
6. **Grant 精确匹配** —— `canonicalizeCall()` 按工具名 + 排序后参数构建指纹；cosmetic 等价共享，不同目标绝不共享。
7. **stand-down 永不静默** —— 作用域外（会话档位不在 `gatePresets`）整门停用（含 P0），但每个 (session, preset) 转换记一条 `stand-down` 事件，客户端显示常驻 `GATE OFF` 条。
8. **事件记录永不影响门控** —— 事件写入错误被 swallow，是 best-effort 审计而非门控条件。
9. **Settings 双半分离** —— host 半只声明 Schema + 注册命名空间；browser 半只渲染 + 订阅。
10. **文档契约** —— English `README.md` 是源，zh/ja/ko 镜像；`locales.ts` 中 `zh` 是键集源，其余用 `Record<keyof typeof zh, string>` 编译期强制对齐。

---

## 5. 开发 / 发布流程

```powershell
cd E:\test\rewrite-agently\mine-dsh-plugins\dsh-perm-gate
npm install
npm run typecheck   # tsc --noEmit + tsc -p tsconfig.client.json --noEmit
npm run lint        # eslint src test scripts tsdown.config.ts eslint.config.mjs
npm test            # vitest run —— 45 文件 / 511 用例
npm run build       # tsc -p tsconfig.build.json && tsdown → lib/
```

**发布固定步骤**：① 四项门禁全绿 → ② 更新 `package.json` version + `dsh.plugin.json` version + CHANGELOG（三语）+ README 版本行 → ③ `git add . ; git commit ; git push origin main` → ④ `npm run release:latest`（`npm publish --tag latest`）。

**装机纪律**：先 `remove` 再 `add`，ref **钉死 SHA**（防增量覆盖与混合状态）。

**HMR**：node 半区改动 → 重启 `dsh web`；client 半区改动 → 刷新页面（Ctrl+F5）；规则文件改动 → 由 `watch.ts` 自动热重载。

**注意**：仓库**无 CI**（`.github/` 不存在），全部验证在本地执行。

---

## 6. 测试速查

```powershell
npm test                              # 全量
npx vitest run test/proxy-errors.spec.ts   # 单文件
```

45 个测试文件，按主题分：

| 主题 | 文件 |
|---|---|
| P0/P1/P2 决策 | `engine` · `evaluate` · `rule` · `rule-dims` · `compiler` · `shadow` · `shell` |
| 规则链 / 维度 | `rule-chain` · `branch-dimension` · `pipeline-dimension` |
| 规则测试（dry-run） | `dry-run`（判定层） · `dry-run-route`（只读路由契约） |
| 门控运行时 | `runtime` · `runtime-risk` · `permissive` · `pre-execute` · `preset-scope` · `session-resolution` |
| 网络 | `network` · `network-approval` · `network-lifecycle` · `proxy-errors` |
| 命令解析 | `command-parsers` · `git-protected-push` |
| LLM/学习 | `risk` · `custom-llm` · `host-llm` · `learning` · `sediment` · `auto-allow-tools` |
| 事件/审计 | `events` · `audit` · `review` · `manual-approval` |
| 授权/白名单 | `grant` · `write-path` |
| 会话清理 | `session-sweep` · `session-sweep-apply` |
| 打包/契约 | `patch-presets` · `glyph-patch` · `data-home` · `feature` · `agent-identity` |
| 规则链与维度 | `rule-chain`（链合并回归） · `branch-dimension` · `pipeline-dimension` |

**回归要点**（新增功能时）：P0 硬拒绝仍拒绝 · `permissive` off 时行为不变 · 学习沉淀正确 · 黑名单词边界不误伤 · 审批历史记录正确 · 四语 key 编译期对齐。

---

## 7. 文档地图

| 文件 | 内容 | 状态 |
|---|---|---|
| `README.md` (+zh/ja/ko) | 项目介绍、P0–P4、规则格式、自动审查档位、CLI | 与代码同步 |
| `INSTALL.md` (+zh/ja/ko) | 安装 / 升级 / 迁移 / 验证 / 排障 | 与代码同步 |
| `CHANGELOG.md` (+ja/ko) | Keep-a-Changelog | 与代码同步 |
| `docs/rules-format.md` / `.en.md` | **规则格式权威规范（11 维度全表 + 3 个通用字段）** | 本计划新增 |
| `docs/baseline-guard.md` | 能力吸收前的 30 文件回归护栏（「不得改既有用例来适配新行为」） | 由 `.agents/` 迁入 |
| `docs/ui-gap-analysis-and-branch-permissions.md` | UI 缺口分析 + branch 维度可行性（需求出处） | 草案，2026-09-16 |
| `docs/repair-log.md` | 历史修复台账 | 归档 |
| `HANDOVER.md` | 本文 | 2026-09-17 重写 |
| `AGENTS.md` | 开发铁律 | 持续维护 |
| `tasks.md` / `findings.md` / `checklist.md`（仓库根） | 2026-09-06 建线记录 | **已归档**，见文件顶部指针 |

> 兼容线：`compat/0.1.5` = DSH 0.1.5 专用线（3.x 系列），由主线经 PR 同步。当前该线落后主线，且**未承诺 0.1.5 100% 可用**。
> 2026-09-17：其 `lib/` 被 `.gitignore` 排除、导致 `github:` 安装得到空包的问题**已修复**（`91d0752`，产物入库，
> 全新 clone 的 `lib/` = 48 文件；该分支 `npm test` = 30 文件 / 279 用例全绿）。宿主兼容性仍**未验证**。

---

## 8. 待办 / 路线图

### 近期（有明确规划）
- **`compat/0.1.5` 收口** —— 落后主线；`lib/` 无法 `github:` 安装的问题已修（`91d0752`），宿主兼容性待验
- **规则链的绝对路径缺陷** —— `findChainEntries` 把 `rulesFile` 直接 `join` 到每个目录上，而 `resolveRulesFile` 永远给绝对路径，
  于是 `searchUp: true` 下**静默得到空规则集**。文档宣传的「多文件规则链」在现有接线方式下不可用（待裁定）

### 中期
- 可视化规则编辑器（`docs/ui-gap-analysis-and-branch-permissions.md` Phase 1–3）
- 快照压缩与磁盘管理
- 规则变更历史与回滚

### 明确不做（已裁定）
- **branch 运行时 git 查询**（`git branch -r --contains`）：与低延迟静态拦截冲突
- Docker / SQL / 包管理器命令解析器

### 推迟
- CI（当前无 GitHub Actions）
- npm registry 发布（`release:latest` 脚本已备，尚未执行）

---

## 9. 社区与 issue 现状

- **issue**：无公开 issue tracker（内部项目）
- **PR**：无外部 PR
- **贡献者**：内部开发
- **投稿状态**：未投稿至 awesome-dsh-plugin
- **GitHub topics**（发布时设置）：`dsh`、`dsh-plugin`、`deepseek-harness`、`permission`、`permission-gate`、`allowlist`、`sandbox`、`ai-safety`

---

*初版：2026-09-09 · 本次重写：2026-09-17（版本 2.0.0 → 2.6.0；用例 23/199 → 45/511；补网络执行面、热重载、11 维度、命令分类器、规则测试 UI）*
*参照标准：`improve-dsh-plugins/02-handover-markdown-pattern.md`*
