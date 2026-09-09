# Spec: dsh-perm-gate 增强(学习 dsh-approval-gate 方式)

## 需求

1. **风险分级判定(升级现有 `llmAssist` 策略)**:llmAssist 开启时,自定义 LLM API 按
   `{"risk":"safe"}` / `{"risk":"risky","category":...}` 协议判定一次 ask 请求:
   - `safe` → 自动放行;`risky` + 硬类别(deletion/credential/remote/system/bulk)→ **永远转人工**(不学习、不放行);
   - `risky` + `neutral` → 进入裁决学习;协议违规/超时/失败 → 维持 ask(fail-closed),且**不学习**;
   - LLM 调用带超时(默认 20s,可配)+ 失败重试 1 次。
2. **裁决学习闭环**(默认关闭,卡片可开):neutral 类 ask 被人工放行并实际执行后
   (经 `tools/result` 感知),确认计数 +1 并记录操作指纹样本;同一 `tool|category`
   计数 ≥ 阈值(默认 3,1–10 可配)且本次指纹命中已确认样本 → 自动放行。
   学习状态持久化为独立 JSON(`$DSH_HOME/perm-gate/learning.json`),不写入用户 YAML 规则文件。
3. **权限模式图标**:保留现有 Permissive 菜单项图标,增强为同时装饰权限选择器的
   触发按钮(`button[aria-haspopup="menu"]` 文案匹配时),与 dsh-approval-gate 的"无图标"形成差异。
4. **简化版事件流**:
   - host:每次裁决追加一条 JSONL 事件到 `$DSH_HOME/perm-gate/events.jsonl`,
     并注册 `GET /api/dsh-perm-gate/events?sessionId=&since=`(webServer 服务,不可用时静默降级);
   - client:`conversation.input.dock`(order=30)提示条,2s 轮询,auto/deny 自动收起、ask 常驻。
5. **工程约束**:全部为重写实现(仅学习设计思路,不复制代码);**不做任何 git commit**,
   只留工作区改动;走完整 typecheck / lint / vitest / build 验证。

## 技术方案

新增 3 个纯模块 + 1 个 client 组件,对既有 P0–P4 瀑布零侵入(只在 ask 决策后精炼):

```
src/risk.ts        风险协议:classifyRisk(cfg, req) → safe | risky:<category> | unresolved
src/learning.ts    RiskLearning(learning.json 读写、确认计数、指纹样本、shouldAutoAllow) + operationFingerprint
src/events.ts      EventLog(events.jsonl 追加 + since/sessionId 查询) + registerEventsRoute
src/client/notice.tsx  conversation.input.dock 提示条(轮询 + 展示)
```

改动点:
- `classifier.ts`:抽出共享 `chatCompletion()`(单次 POST + AbortController 超时,`{ok:true,content}`/`{ok:false}`);
  `classifyWithLLM` 与 `classifyRisk` 共用,并都获得"失败重试 1 次"。
- `runtime.ts`:新方法 `refineAsk(exec, askDecision)`(替代原 llmAssist 三值精炼;
  内含硬类别守卫、学习查询、pending 登记)与 `settleExecution(exec)`(tools/result 结算 pending);
  原 `applyPermissive` 中 sync llmAssist 分支移除(统一走异步 refineAsk)。
- `index.ts`:listener 改用 refineAsk;注册 `tools/result` → settleExecution;
  `inject` 增加 `webServer`(存在性守卫),注册事件查询路由。
- `config.ts` + settings namespace:`riskLearning: boolean`(默认 false)、`riskThreshold: number`(默认 3)、
  `riskTimeoutMs: number`(默认 20000)、`learningFile`/`eventsFile`(组合入口可选,不入卡片)。
- `client/card.tsx` + `locales.ts`:llmAssist 区块内新增 riskLearning 开关 + 阈值输入 + 协议说明(zh/en/ja/ko)。
- `permission-icon.ts`:新增 trigger 装饰(`button[aria-haspopup="menu"]`,文案匹配 Permissive 标签,`data-*='trigger'` 小尺寸)。
- 文档:README.{md,zh,ja,ko} 增补章节;CHANGELOG(.ja/.ko)Unreleased;package.json 0.2.0。

## 决策记录

| 选项 | 选择 | 理由 |
|------|------|------|
| 风险协议接入 | 升级现有 llmAssist | 策略组合不爆炸,UI 改动最小;旧三值行为被协议严格超集覆盖 |
| 学习闭环 | 纳入,默认关闭 | approval-gate 核心特色;默认关闭符合本仓库 fail-closed 保守基调 |
| 审查 UI | 简化版事件流(dock 提示条) | 用户选定;不做 diff/撤销/历史 tab(YAGNI) |
| 学习持久化 | 独立 JSON,不写 rulesFile | 用户 YAML 是人所有的确定性层,学习是插件自有状态,分离避免互相污染 |
| 人工确认感知 | `tools/result` 结算 pending | dsh-auto-mode 已验证该事件契约;exec+result 到达即代表调用被放行并执行 |
| 拒绝学习 | 不做自动升级拦截 | ask 返回后无法区分"拒绝/取消/未执行",误升级违背 fail-closed;保留显式 deny 规则路径 |
| 指纹来源 | 结构化 args(命令词+路径基名) | 我们有真实参数,优于 approval-gate 对 justification 文本的正则挖掘 |
| LLM 端点 | 沿用 classifierEndpoint/Model/ApiKey | 需求 2 的"自定义 LLM API"已存在,直接复用并增强协议 |
| git | 工作区改动,不 commit | 用户硬性要求 |

## 约束

- client 半区零 `@deepseek-ai/*` 值导入(tsdown purity gate),全部经 cordis services/type-only。
- locales 以 zh 为 key 源,en/ja/ko 镜像;运行时仅 zh/en 可选(ja/ko 照发)。
- P0 hard-deny / deny 规则 / grant 决策永不 Learning 或 LLM 精炼触碰。
- 事件/学习文件 IO 一切失败吞掉并降级(内存态),绝不影响门禁主流程。
- 学习文件路径缺省派生:`dshHome` 存在 → `$DSH_HOME/perm-gate/*.jsonl|json`;否则仅内存。
- 水 fail-close 不变:unresolved/无配置/异常一律维持 ask。
