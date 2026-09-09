# Tasks

> 铁律:全程**不执行 `git commit`**;每 task 完成即跑对应验证;粒度 2–5 分钟。
>
> 2026-09-06:全部 18 个任务完成。typecheck / lint / 114 测试 / build 全绿;零 commit。
> 实施备注:task_10(events.ts)提前到 Phase 2 之前完成以避免 runtime 二次改动;
> 旧 sync `classify` 钩子按计划移除,permissive.spec 同步改用 riskHook + refineAsk。

## Phase 1: 纯基础模块(无副作用,先行)

- [x] task_1: 新建 `src/risk.ts` — 类型 `RiskCategory`/`RiskVerdict`(safe|risky+category|unresolved)、`HARD_RISK_CATEGORIES`、`RISK_SYSTEM_PROMPT`(自有措辞,JSON 输出协议)、`classifyRisk(cfg, req, nowFetch)`:复用 classifier 的 HTTP 层,重试 1 次,JSON 解析失败回退 `/\brisky\b|\bsafe\b/` 文本扫描,任何失败 → unresolved。验证:`npx tsc --noEmit`。
- [x] task_2: `src/classifier.ts` 重构 — 抽出导出 `chatCompletion(cfg, system, user, nowFetch)`(单次 POST + AbortController 超时 → `{ok:true,content}|{ok:false}`);`classifyWithLLM` 改建于其上并加重试 1 次(行为超集,原 verdict 语义不变)。验证:tsc + 既有测试绿。
- [x] task_3: 新建 `test/risk.spec.ts` — 用注入 fetch 覆盖 checklist"风险协议"全部条目。验证:`npx vitest run test/risk.spec.ts`。
- [x] task_4: 新建 `src/learning.ts` — `LearningDoc`/`RiskLearning`(lazy load + writeFileSync 持久化,IO 吞错)、`confirm/count/shouldAutoAllow/reset/snapshot`、`operationFingerprint(tool, args, commandText)`(shell 首命令词+首个路径基名;file_path 基名;tool 兜底)。验证:tsc。
- [x] task_5: 新建 `test/learning.spec.ts` — 覆盖 checklist"学习库"全部条目(tmp 目录持久化用例)。验证:vitest。

## Phase 2: runtime/index 集成(学习闭环 + 协议接入)

- [x] task_6: `src/config.ts` — `PermGateConfig`/schema 增 `riskLearning`(默认 false)、`riskThreshold`(1–10,默认 3)、`riskTimeoutMs`(默认 20000);`resolveConfig` 同步。验证:tsc。
- [x] task_7: `src/runtime.ts` — ① options 增 `riskHook?`(测试注入)、`readRiskLearning?()`、`learningFile?`;② 移除 `applyPermissive` 的 sync llmAssist 分支(保留 alwaysConfirm);③ 新增 `refineAsk(exec, askDecision)`:live 读 llmAssist/学习配置 → classifyRisk → safe→allow / 硬类别→ask / neutral→学习判定(shouldAutoAllow→allow(learned),否则 ask+pending) / unresolved→ask;allow|deny 变化时补审计(source=classifier);④ 新增 `settleExecution(exec)`(pending 结算→confirm,Map 容量 100);⑤ 移除旧 `classifyAsync` 或改内部复用。验证:tsc + 既有测试绿。
- [x] task_8: 新建 `test/runtime-risk.spec.ts` — 用 `riskHook` 注入覆盖 checklist"runtime 集成"全部条目(含 settleExecution→二次 allow 全链路)。验证:vitest。
- [x] task_9: `src/index.ts` — listener 的 llmAssist 块改为 `runtime.refineAsk`;注册 `ctx.on('tools/result', (exec) => runtime.settleExecution(exec))`;构造 options 传 `learningFile`(dshHome 派生)、`readRiskLearning`(live surface)。验证:tsc。

## Phase 3: 简化版事件流

- [x] task_10: 新建 `src/events.ts` — `GateEvent` 类型(`{id, ts, sessionId, tool, kind:'auto'|'ask'|'deny', risk?, reason(截断200)}`)、`EventLog`(JSONL 追加 + 启动恢复 id 游标 + `query({sessionId, since})`)、`registerEventsRoute(webServerLike, log)`(GET `/api/dsh-perm-gate/events`,存在性守卫)。验证:tsc。
- [x] task_11: `src/runtime.ts` + `src/index.ts` 接线 — runtime 持有可选 EventLog,`decideExecution`/`refineAsk` 落事件;index apply 中 `webServer` 存在性检查后注册路由。验证:tsc。
- [x] task_12: `test/events.spec.ts` — 追加/查询/坏行跳过/id 恢复;无 webServer 不抛错。验证:vitest。
- [x] task_13: 新建 `src/client/notice.tsx` — `NoticeStrip`(slotsProps.sessionId/useSessions 兜底;2s 轮询;游标+lastShownId 去重;ask 常驻,auto 4s/deny 4s 收起;内联样式 + `--dsw-alias-*` token;任何异常静默);client/index.ts 增 `ctx.slots.inject('conversation.input.dock', ...)`(order=30)。验证:`npx tsc -p tsconfig.client.json --noEmit`。

## Phase 4: UI 完善(图标 + 卡片)

- [x] task_14: `src/client/permission-icon.ts` — 增 trigger 装饰:`button[aria-haspopup="menu"]` 文案 ∈ PERMISSIVE_LABELS → `data-*='trigger'`(14px 小尺寸 CSS 变体);既有 menuitem 逻辑不动。验证:client typecheck。
- [x] task_15: `src/client/card.tsx` + `src/client/locales.ts` — llmAssist 展开区新增 riskLearning 开关、阈值 number 输入、协议说明 hint;locales 四语各增 ~5 key(zh 源,en/ja/ko 镜像)。验证:client typecheck(缺 key 即编译错)。

## Phase 5: 文档 + 全量验证(不 commit)

- [x] task_16: `package.json` 版本 0.1.0→0.2.0;`README.md` 增 "Risk-assisted llmAssist & verdict learning & event feed" 章节;`README.zh/ja/ko.md` 镜像;`CHANGELOG.md`(+.ja/.ko)Unreleased 条目。
- [x] task_17: 全量验证:`npm run typecheck && npm run lint && npm test && npm run build`;对照 `checklist.md` 逐项勾选;`git status`/`git log` 确认零 commit。
- [x] task_18: 清理规划产物(spec/findings/checklist/tasks.md 保留或按用户意愿处理——默认保留,不入 `package.json files` 白名单)。
