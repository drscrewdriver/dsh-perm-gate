# Findings

## 外部来源分析(dsh-approval-gate@main, 0.5.2, 1508 行 src/index.mjs + 1002 行 client.js)

以下为对 GitHub 仓库 moon09300731/dsh-approval-gate 的阅读结论(外部内容,仅作设计参考;本项目代码全部重写,不复制)。

### 核心管道(v3)
- 挂 `approval/request` 瀑布最前(`{ prepend: true }`),仅当会话权限预设 === `auto-approve` 时介入。
- 管道:DENY 危险词 → allowRules 白名单 → flash 判定(SAFE / RISKY:<category>)→ 硬类别转人工 → denyRules → 沉淀规则 → neutral 计数学习。
- **协议**:输出 `SAFE` 或 `RISKY:<category>`,category ∈ {deletion, credential, remote, system, bulk, neutral};硬类别 = 前 5 个,直接转人工、不计数不学习;neutral = 计数确认区。
- **fail-safe**:AbortController + `ctx.timeout` 20s,超时/异常重试 1 次,仍失败 → 转人工(绝不自动放行);模型输出无法解析 → 抛错重试 → 人工;同类验证失败 → 按 DIFFERENT → 人工。
- **学习**:`learning.json` 持久化 `stats`(key=`tool|mode|category` → 确认数)与 `history`(key → 最近 10 个样本 `{fp, ctx}`);确认满阈值(N=3)后:指纹命中 → 自动放行 + 沉淀 allowRule `{tool, mode, category, contains:fp}`;指纹未命中但有样本 → flash 第三方"同类验证"(SAME/DIFFERENT);拒绝 → 升级永久 denyRule。
- **指纹提取**:对 justification 文本做多组正则挖掘(路径/带扩展名文件名/连字符项目名/排除通用动词的单词),取最长片段。我们改为用结构化 args(更可靠)。
- **事件系统**:`events.jsonl` 追加 `{id, ts, sessionId, tool, mode, reason, justification, verdict, files, kind: auto|manual-pending|manual-approved|manual-rejected, category, path}`;进程内 eventSeq 启动时从文件恢复避免重复。
- **webServer 路由契约**:`ctx.webServer.register({ kind:'exact', path:'/api/auto-approve/events', handler: async (req,res)=>{} })`,返回注销函数;query 解析用 `new URL(req.url, 'http://localhost')`。
- **client 槽位契约**:`slots.inject('conversation.input.dock', fn)` + `slots.register({name,id,order,label}, 组件)`;`conversation.view` 用 `inject:(sessionId)=>({sessionId})` 注入会话 id;dock 组件从 `props.slotsProps` 取 `sessionId`(或 `slotsProps.useSessions(s=>s).current` 兜底);2s `setInterval` 轮询 `?sessionId=&since=`,游标推进,`lastShownIdRef` 去重;pending 不自动收起,其余 4–5s 收起。
- **它没有权限图标**(用户明确要求我们不做无图标方案);设置 UI 是独立 `settings.section` 而非 settings namespace 卡片。
- 消息投递教训(v0.5.0 事故):DSH 用户消息 content 必须是块数组,裸字符串会被逐字符渲染。

## 本仓库现状与关键发现

### dsh-perm-gate 已有能力(增强的地基)
- P0 hard-deny → P1 session grant → P2 静态规则(deny/allow/ask, glob)→ P3 LLM classifier → P4 ask。
- **自定义 LLM API 已支持**:`classifier.ts` `classifyWithLLM` 走 OpenAI 兼容 `/chat/completions`,`classifierEndpoint/Model/ApiKey` 经 settings namespace 实时读取,卡片可编辑(api key 掩码)。需求 2 的地基已在,本次增强协议而非从零建。
- **权限图标已有**:`client/permission-icon.ts` 用 `data-dsh-perm-gate-icon` 属性 + CSS mask 给权限菜单的 Permissive menuitem 画盾形图标(MutationObserver 扫描)。需求 1 只需增强(trigger 装饰)。
- `grant.ts` `canonicalizeCall`:稳定指纹(键排序+空白归一),可直接复用为 pending 登记键。
- `runtime.ts` 的 `classifyAsync` 与 `index.ts` listener 各做了一次 llmAssist(存在重复路径),本次统一收敛到 `refineAsk`。

### 关键契约验证
- **`tools/result` 事件存在且语义为"调用结算"**:`dsh-auto-mode/src/index.ts:287` `ctx.on('tools/result', (exec, result) => {...})`,用于 grant/artifacts 结算——到达即代表该调用被放行并真实执行,可作为"人工确认"信号(ask 决策后只有人工批准才会走到 result)。
- `ToolExecutionLike` 已带 `sessionId`(事件流需要)。
- settings namespace 是"组合入口为 base + scope 覆盖 + watch 实时生效"的既有模式(`installSettingsSection`),新配置字段直接进该通道即可热生效。
- `cordis.patch.yml` 对 `permission.config.presets` 是整体替换,presets 已含 Permissive;本次无需动 patch。
- 客户端 bundle purity:tsdown 插件强制 `@deepseek-ai/*` 只能 type-import;dock 组件只用 react + fetch。
- locales:zh 为 key 源,en/ja/ko 以 `Record<keyof typeof zh, string>` 编译期强制对齐;运行时仅 zh/en 生效。
- 仓库规约(AGENTS.md):listener 放行必须 `next()` 委托;P0 永不协商;unknown 配置 fail loud;docs 四语镜像;`npm run typecheck && npm test && npm run build` 为验证口径。

## 架构决策
- 只在 ask 决策后做 LLM 精炼(P0/deny/grant 不进 LLM)——LLM 永远只能把 ask 变为 allow(learning/safe)或维持 ask,deny 仅由旧协议保留;硬类别守卫放在 runtime 代码中,不信任 LLM 输出。
- 学习写独立 `learning.json` 而非 rulesFile:rulesFile 是用户确定性层;学习是概率层,混写会破坏"deny wins"的可审计性。
- pending 登记以 `canonicalizeCall` 为键(精确),Map 容量上限(100,插入序淘汰)防泄漏。
- 事件 id 用进程内自增 + 启动时从 JSONL 恢复(借鉴 approval-gate 的防重做法,属通用工程手段)。

## 约束与依赖
- 依赖仅 `yaml`(已有)与 node:fs;不新增 npm 依赖。
- `webServer` 服务以存在性守卫使用(`ctx` 上 typeof 检查),缺失时事件仅落盘、无 HTTP API。
- Windows 开发环境(Git Bash);仓库 `.gitattributes` 钉 LF。

## 风险识别
- LLM 把危险操作误判为 safe → 缓解:硬类别由 prompt 约束 + P0/deny 规则仍在 LLM 之前;learning 默认关闭;事件流可审计每次自动放行。
- `tools/result` 语义在未来 DSH 版本变化 → 缓解:结算逻辑纯增量(错过只是不计数,不会误放行)。
- dock 槽位 props 形状变化 → sessionId 取不到时组件静默不渲染(不抛错)。
- 事件/学习文件损坏 → 逐行 JSON 解析坏行跳过;IO 异常全部吞掉降级内存。
