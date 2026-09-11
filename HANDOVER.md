# dsh-perm-gate — 交接文档（HANDOVER.md）

> 版本线：v0.2.1-beta.3（`package.json`）
> 仓库：`E:\test\rewrite-agently\mine-dsh-plugins\dsh-perm-gate`
> 安装：`dsh plugin --profile web add dsh-perm-gate`
> 目标读者：续接会话 / 新协作者 — 15 分钟理解全貌，30 分钟开始贡献。

---

## 0. 一句话背景

`dsh-perm-gate` 是一个 **DSH Web 插件**：为 DeepSeek Harness 提供 P0–P4 五层权限门控——P0 硬拒绝凭据/保护路径/危险 shell、P1 会话级精确放行 grant、P2 静态规则链（deny→allow→ask）、P3 可选 LLM 风险分级裁决、P4 人工确认缝。独立 "Permissive" 档位与只读/完全权限/白名单平行，前端仅一个开关 + 三策略组合。

---

## 1. 项目目录

```
dsh-perm-gate/
├── src/
│   ├── index.ts              # host 半入口：cordis apply / settings 注册 / pre-execute 水闸
│   ├── config.ts             # Schemastery schema + resolveDataDir / resolveDshHome
│   ├── runtime.ts            # PermGateRuntime 门控引擎（全生命周期）
│   ├── engine.ts             # P0–P2 纯决策引擎（hard-deny / grant / rule）
│   ├── classifier.ts         # LLM classifier transport（OpenAI-compatible POST）
│   ├── risk.ts               # 风险分级协议（safe / risky:category / neutral）
│   ├── evaluate.ts           # 静态规则匹配（deny-first allow/ask chain）
│   ├── rule.ts               # permissions YAML 解析 + RegExp 编译（含 ReDoS bound）
│   ├── grant.ts              # 会话级 grant：canonical fingerprint + TTL + maxUses
│   ├── allowlist.ts          # rulesFile allow 段增删改
│   ├── path.ts               # 路径归一化 + 敏感/受保护检测 + ArtifactRegistry
│   ├── shell.ts              # argv 分解（pipeline/redirects/sh -c 递归/force 识别）
│   ├── audit.ts              # 审计条目 + MemoryAuditMirror
│   ├── events.ts             # 决策事件 JSONL 日志 + diff/revert/snapshot API
│   ├── deny-defaults.ts      # 预设黑名单关键词（继承自 dsh-approval-gate）
│   ├── host-llm.ts           # DSH host llm service 调用封装
│   ├── learning.ts           # 判决学习（riskLearning / riskSediment）
│   ├── grant.ts              # SessionGrant / GrantRegistry
│   ├── host-llm.ts           # DSH host model group receiver
│   ├── cli.ts                # 独立 dry-run CLI（dsh-perm-gate --rules ... --tool ... --args ...）
│   └── client/
│       ├── index.ts          # browser 半：locales 注册 + slot 注册（tab / input.dock / view）
│       ├── card.tsx          # Permissive 设置卡（805 行，主 UI）
│       ├── history.tsx       # 审批历史视图（tab 页，时间线 + diff + snapshot 条）
│       ├── notice.tsx        # 通知条（conversation.input.dock）
│       ├── feed.ts           # Feed 组件 + session 解析 + diff/revert 网络层
│       ├── locales.ts        # 四语字典（zh 源 + en/ja/ko Record<keyof typeof zh>）
│       ├── sediment.tsx      # 沉淀学习可视化子组件
│       ├── permission-icon.ts # permission-picker 盾牌图标装饰
│       └── sediments.tsx     # SedimentSection 子组件
├── test/                     # vitest：23 文件 / 199 测试
│   ├── engine.spec.ts        # P0/P1/P2 决策路径
│   ├── runtime.spec.ts       # PermGateRuntime 生命周期
│   ├── manual-approval.spec.ts # 手动批准/拒绝/取消
│   ├── deny-keywords.spec.ts # 黑名单词匹配
│   ├── deny-keywords-scope.spec.ts # 黑名单作用域（跳过 content 字段）
│   ├── learning.spec.ts      # 判决学习
│   ├── review.spec.ts        # 审批历史页
│   ├── grant.spec.ts         # SessionGrant/GrantRegistry
│   ├── sediments.spec.ts     # 沉淀学习
│   └── ... （共 23 文件）
├── lib/                      # 构建产物（git 跟踪；link 模式服务 lib/）
│   ├── index.js              # host 半
│   ├── client.js             # browser 半（~102 kB）
│   └── *.d.ts                # TypeScript 声明
├── cordis.patch.yml          # DSH profile 补丁（presets + 插件插入）
├── AGENTS.md                 # 开发规范（合约/原则/构建/文档）
├── eslint.config.mjs         # ESLint 配置
├── vitest.config.ts          # vitest 配置
├── tsconfig.json             # host 半
├── tsconfig.client.json      # browser 半
├── tsdown.config.ts          # browser 半构建（tsdown）
└── LICENSE                   # MIT
```

---

## 2. DSH 契约点

### 2.1 cordis 插件合约

| 契约点 | 值 | 说明 |
|--------|-----|------|
| `name` | `'dsh-perm-gate'` | 固定 ID |
| `inject` | `['tools', 'webServer', 'llm', 'agentDefaultModel']` | host 依赖 |
| 导出 | `name` / `inject` / `Config` / `apply`，**无 default export** | DSH Loader 解包 `exports.default ?? exports` |

### 2.2 settings 注册

| 契约点 | 值 | 说明 |
|--------|-----|------|
| `settings` API | 双 API 回退：`installSection`（0.1.2+）→ `register`（所有版本） | 见 `DSH-PLUGIN-COMPATIBILITY-GUIDE.md` |
| 命名空间 | `'dsh-perm-gate'`（`PERMISSIVE_NAMESPACE` / `PERMISSIVE_NS`） | host 半 `index.ts:29` + browser 半 `index.ts:24` |
| Schema | `Config`（Schemastery `z.object()`） | `config.ts` |

### 2.3 slot 注册

| slot 名 | key/id | 组件 | 行号 |
|---------|--------|------|------|
| `settings.plugins.tab` | key: `'dsh-perm-gate'` | `PermissiveCard` | `client/index.ts:105–118` |
| `conversation.input.dock` | id: `'dsh-perm-gate.notice'` | `NoticeStrip` | `client/index.ts:78–86` |
| `conversation.view` | id: `'dsh-perm-gate.history'` | `HistoryView` | `client/index.ts:91–99` |

### 2.4 宿主 API

| API | 调用位置 | 说明 |
|-----|---------|------|
| `ctx.settings.installSection()` / `register()` | `index.ts:80` | settings namespace 注册 |
| `ctx.slots.inject()` / `slots.register()` | `client/index.ts` | slot 注册 |
| `ctx.locale.register()` | `client/index.ts:69` | 四语字典注册 |
| `ctx.get('webServer')` | `index.ts:302` | HTTP 路由（best effort） |
| `ctx.get('llm')` | `index.ts:202` | host model group（best effort） |
| `ctx.get('agentDefaultModel')` | `index.ts:206` | 当前模型组选择 |
| `ctx.get('typertGateway')` | `index.ts:132` | 会话消息投递（fallback 通道） |
| `ctx.get('agents').get(sessionId).followup()` | `index.ts:142` | 会话消息投递（第二个通道） |

### 2.5 HTTP API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| `GET` | `/api/dsh-perm-gate/events?sessionId=&since=` | 决策事件 JSONL |
| `GET` | `/api/dsh-perm-gate/diff` | unified diff |
| `POST` | `/api/dsh-perm-gate/revert` | 撤销文件改动 |
| `GET` | `/api/dsh-perm-gate/snapshots-stats` | 快照统计 |
| `POST` | `/api/dsh-perm-gate/snapshots-clear` | 清理快照 |
| `GET` | `/api/dsh-perm-gate/learning` | 学习状态 |
| `POST` | `/api/dsh-perm-gate/learning` | 学习重置 |
| `POST` | `/api/dsh-perm-gate/health` | health test |
| `GET` | `/api/dsh-perm-gate/receiver` | llmAssist receiver 元数据 |

### 2.6 水闸事件

| 事件名 | 监听方式 | 说明 |
|--------|---------|------|
| `tools/pre-execute` | `ctx.on()` | 水闸入口：返回 `deny`/`ask` 或 `next()` |
| `tools/result` | `ctx.on()` | 结果回传：settle 学习/ask |
| `approval/request` | `ctx.inject(['approval'], ...)` | 被动观察：settle 手动批准结果 |

### 2.7 语义 token

| Token | 用途 |
|-------|------|
| `--dsw-alias-label-primary` | 主文字色 |
| `--dsw-alias-label-secondary` | 次要文字色 |
| `--dsw-alias-label-tertiary` | 辅助文字色 |
| `--dsw-alias-label-caption` | 说明文字色 |
| `--dsw-alias-bg-layer-3` | 背景层 |
| `--dsw-alias-border-l2` | 边框色 |
| `--dsw-alias-state-business-primary` | 品牌/强调色 |
| `--dsw-alias-bg-surface` | 表面色 |
| `--ds-font-family-code` | 代码字体 |

---

## 3. 代码结构速查（以 v0.2.0 行号为参考）

### `src/index.ts`（411 行）

| 区域 | 内容 |
|------|------|
| ~1–60 | 模块头 + 类型声明（SettingsScope, EventContextLike） |
| ~68–90 | `installSettingsSection()` — inline settings 注册器 |
| ~92–121 | `PermissiveSurface` interface + `asSurface()` 转换器 |
| ~128–156 | `buildSessionSender()` — 撤销消息投递 |
| ~165–178 | `makeApprovalAnswerer()` — 审批应答门：先尝试用门禁已放行的裁决直接批准沙箱提权（`answerEscalation`，免弹窗），否则 `next()` 转发并记录人工裁决 |
| ~194–213 | `makePreExecuteListener()` — 水闸：**先 await `refineAsk`** 再返回决策（safe→`next()` 不弹面板 / 硬类别→deny / neutral·unresolved→ask） |
| ~215–483 | `apply()` 主入口：config → runtime → settings → routes → watergate → approval |

### `src/runtime.ts`（932 行）

| 区域 | 内容 |
|------|------|
| ~1–25 | 模块头 + 全部类型导入 |
| ~28–54 | `ToolExecutionLike` / `ToolResultLike` 类型声明 |
| ~57–68 | `sessionIdOf()` / `cwdOf()` — 会话/cwd 解析 |
| ~85–93 | `PendingAsk` 类型 |
| ~95–147 | `PermGateRuntimeOptions` + 回调接口 |
| ~166–198 | `constructor`：规则编译、grants、learning、events 初始化 |
| ~200–230 | `compileInline()` / `reload()` — 规则热重载 |
| ~282–292 | `ctxFor()` — 构建决策上下文 |
| ~338–348 | `denyKeywordHit()` — 黑名单扫描 |
| ~355–383 | `recordEvent()` — 事件写入 |
| ~427–486 | `decideExecution()` — 核心决策入口 |
| ~496–504 | `applyPermissive()` — Permissive 档位调制 |
| ~515–608 | `refineAsk()` — LLM 风险分级精化 |
| ~620–705 | `settleAskOutcome()` / `settleExecution()` / `recordAskOutcome` — 终端结算 |
| ~707–805 | 学习管理 API（learningSnapshot, learningReset, healthCheck） |
| ~758–805 | grant API（grant, approveRepeat, approveAllowEverywhere, allowlist, setAllowlist） |
| ~828–864 | `eventFiles()` — 文件路径提取 |
| ~872–928 | 黑名单词匹配工具（CONTENT_ARG_KEYS, keywordMatcher, denyScanText） |

### `src/engine.ts`（99 行）

| 区域 | 内容 |
|------|------|
| ~17–18 | `DESTRUCTIVE_TOOL` / `READ_TOOLS` 常量 |
| ~20–31 | `serialized()` / `containsCredentialMaterial()` |
| ~33–39 | `pathArgument()` |
| ~45–76 | `hardDenyReason()` — P0 硬拒绝判定 |
| ~87–99 | `decide()` — P0→P1→P2 决策链路 |

### `src/events.ts`（800+ 行）

| 区域 | 内容 |
|------|------|
| ~19–49 | `GateEvent` 类型 + kind 枚举 |
| ~51–100 | `EventLog` 类：append / read / since 过滤 |
| ~100–250 | snapshot 管理（save / load / list / clear） |
| ~250–450 | diff 生成（diffLines, resolveAbsPath） |
| ~450–800+ | HTTP 路由注册（DIFF_ROUTE, REVERT_ROUTE, SNAPSHOTS_STATS_ROUTE, SNAPSHOTS_CLEAR_ROUTE） |

### `src/client/card.tsx`（805 行）

| 区域 | 内容 |
|------|------|
| ~1–57 | 模块头 + 接口声明 |
| ~66–98 | CSS 常量 |
| ~104–805 | `PermissiveCard` React 组件 |

### `src/client/locales.ts`（439 行）

| 区域 | 内容 |
|------|------|
| ~1–9 | NS + PermissiveKey 类型 |
| ~10–117 | `zh` 字典（源，68+ key） |
| ~118–225 | `en` 字典 |
| ~226–333 | `ja` 字典 |
| ~334–439 | `ko` 字典 |

---

## 4. 重要设计原则

1. **P0 硬拒绝单调性**
   - 凭据/保护路径/危险 shell 的硬拒绝从不协商、从不被后续阶段覆盖
   - 历史教训：任何 "LLM 判定 safe 就放行" 的设计都不可接受，P0 前 P0 之后
   - 代码：`engine.ts:hardDenyReason()` 始终最先执行

2. **只读内部工具自动放行**
   - 工作区只读查询工具（`read` / `read_image` / `grep` / `glob` / `ls` / `lsp`）
     不可能修改 workspace，且 P0 已保护敏感路径（外部路径读取）。直接 auto-allow
   - DSH 内部协调工具（`agent_teams_*`、`conversation_search`、`memory_*`、
     `get_goal` / `update_goal` / `create_goal`、`taskboard_*`、`job_*`、
     `list_agents` / `interrupt_agent` / `send_message`、`subagent` / `subagent_fork` / `terminal` / `skill`）
     不修改 workspace 文件，自动放行
   - P0 硬拒绝仍然优先：这些工具若携带凭据材料仍会被 P0 拦截
   - 代码：`engine.ts:decide()` 中的 `READ_TOOLS` + `INTERNAL_TOOLS` 预检

3. **deny wins over allow**
   - 静态规则链：deny → allow → ask，首次匹配胜出
   - 黑名单词层在 deny 之前（deny-keyword 也是 deny）
   - 代码：`evaluate.ts:decideRules()` 首次匹配

4. **Fail-closed 默认**
   - LLM 分类器任何错误 → `ask`（不自动放行）
   - 网络超时/解析失败/非 JSON → `ask`
   - 代码：`classifier.ts:155–180` 所有异常路径都返回 `ask`

4. **Grant 精确匹配，绝不跨目标复用**
   - `canonicalizeCall()` 按工具名+排序后参数构建指纹，cosmetic 等价共享、不同目标不共享
   - 代码：`grant.ts:36–39`

5. **事件记录永不影响门控**
   - 事件写入错误被 swallow（`events.ts` append 错误不抛）
   - 事件是 best-effort 审计，不是门控条件
   - 代码：`events.ts:120+` 所有 I/O 错误被捕获

6. **双通道终端结算 + "settle on delete" 去重**
   - 主通道：`approval/request` 观察者（记录手动批准/拒绝/取消）
   - 备通道：`tools/result` 回传（settle 学习/ask）
   - 去重：用 `pendingAsks.delete()` 而非全局 flag，缺 callId 也能工作
   - 代码：`runtime.ts:620–705`

7. **Settings 双半分离**（参考 `01-host-client-settings-separation.md`）
   - Host 半只声明 Schema + 注册命名空间，不渲染 UI
   - Browser 半只渲染组件 + 订阅 scope 变更，不声明 Schema
   - 桥接：同一字符串命名空间 `'dsh-perm-gate'`

8. **文档契约**（参考 `03-multilingual-docs-pattern.md`）
   - English README 是源，zh/ja/ko 镜像
   - 每语 README/INSTALL 顶部有完整互链块 + ja/ko 兼容性说明
   - `locales.ts` 中 zh 是 key 源，en/ja/ko 用 `Record<keyof typeof zh, string>` 编译期保正确

---

## 5. 开发/发布流程

### 开发

```powershell
cd E:\test\rewrite-agently\mine-dsh-plugins\dsh-perm-gate
npm install
npm run build               # → lib/index.js + lib/client.js
# link 注册
dsh plugin --profile web add link:$PWD
# 验证
# F12 Console → 检查 settings → plugins 出现 "Permissive 审批档" 卡片
```

### 发布（固定步骤）

1. `npm run typecheck` — host + client 双 tsconfig
2. `npm run lint` — eslint 0 issues
3. `npm test` — 23 files / 199 tests
4. `npm run build` — tsc + tsdown → lib/
5. 更新 package.json version + CHANGELOG + README
6. `git add . ; git commit -m "..." ; git push origin main`
7. `git tag -a vX.Y.Z && git push origin vX.Y.Z`
8. `npm publish --access public` — ⚠️ 必须带 `--access public`

### HMR 热更新

- **node 半区变更**：重启 dsh（`dsh web` → stop → start）
- **client 半区变更**：刷新页面（Ctrl+F5），无需重启 dsh
- **规则文件变更**（`rulesFile`）：自动热重载（`runtime.reload()`），无需重启

---

## 6. 测试速查

### 自动化

```powershell
cd E:\test\rewrite-agently\mine-dsh-plugins\dsh-perm-gate
npm test           # vitest run — 23 files, 199 tests
npm run typecheck  # tsc --noEmit (host) + tsc -p tsconfig.client.json --noEmit
npm run lint       # eslint src test tsdown.config.ts eslint.config.mjs
```

### 回归用例（新增功能时）

1. **P0 硬拒绝** — 凭据/保护路径/危险 shell 仍被拒绝
2. **Permissive 档位** — off 时行为不变，on 时策略生效
3. **学习沉淀** — `riskLearning` off → on → sediment 仍正确
4. **黑名单词** — 边界匹配不误伤（`format` 不匹配 `formatFile` 等）
5. **审批历史** — manual-approved/rejected/cancelled 记录正确
6. **四语 locales** — 新增 key 编译期报 `Record<keyof typeof zh>` 错误

### 常规目检

1. 官方明/暗主题下卡片可读
2. Permissive 开关 + 三策略组合
3. 审批历史 tab 正确加载
4. 通知条样式
5. diff 面板 + 撤销
6. settings 面板 whitelist 增删
7. deny-keyword 预设 + 自定义增删

---

## 7. 待办/路线图

### 近期

- **内部只读工具白名单**：`read` / `read_image` / `grep` / `glob` / `ls` / `lsp` 等纯只读工具应自动放行
- **`rulesFile` 默认路径**：当前 `cordis.patch.yml` 无 `config.rulesFile` → 需要 profile 级默认值
- **`data-home` 配置**：`cordis.patch.yml` 无 `config.dshHome` → 事件/快照/学习需默认解析到 `$DSH_HOME/perm-gate/`

### 中期

- **AgentTeams 集成**：`agent_teams_*` 工具群应有明确的权限策略（内部只读工具放行）
- **学习沉淀 UI**：沉淀区的数据可视化 + 键级管理
- **快照压缩**：大量 diff 快照的磁盘空间管理

### 推迟

- **CI/CD**：无 GitHub Actions 配置
- **npm registry 发布**：尚未发布到 npm

---

## 8. 社区与 issue 现状

- **issue**：无公开 issue tracker（内部项目）
- **PR**：无外部 PR
- **贡献者**：内部开发
- **投稿状态**：未投稿至 awesome-dsh-plugin

---

*创建日期：2026-09-09*
*参照标准：`improve-dsh-plugins/02-handover-markdown-pattern.md`*
