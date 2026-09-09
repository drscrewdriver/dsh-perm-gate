# Checklist

> 2026-09-06 验收记录。验证口径:`npm run typecheck && npm run lint && npm test && npm run build` 全绿(121/121 测试)。

## Must Pass

### 构建/静态
- [x] `npm run typecheck`(node 半区 + client 半区)零错误
- [x] `npm run lint` 零错误
- [x] `npm run build` 产出 lib/*.js + lib/client.js,purity gate 无报错(lib/risk|learning|events.d.ts 均存在)
- [x] `git status` 确认无新 commit(HEAD 停在 2a7a156,仅工作区改动)

### 风险协议(src/risk.ts,test/risk.spec.ts 10 例)
- [x] safe / risky+已知类别 / risky+未知类别 / 非 JSON 输出 / 两次失败 → safe / risky / unresolved / unresolved / unresolved
- [x] 超时(短 timeoutMs)→ unresolved,不挂起
- [x] 第一次失败第二次成功 → 正常返回(重试 1 次)
- [x] 无 endpoint/model → unresolved(fail-closed)
- [x] 硬类别常量集 = deletion/credential/remote/system/bulk;未知类别按硬风险处理

### 学习库(src/learning.ts,test/learning.spec.ts 8 例)
- [x] operationFingerprint:shell 末位目标基名(`npm install foo`→`npm|foo`)/ file_path 基名 / 纯 tool 兜底
- [x] 确认计数达阈值 + 指纹命中样本 → shouldAutoAllow=true;指纹未命中 → false
- [x] 阈值未满 → false;reset 可清空
- [x] 持久化:新实例从同一路径读回;路径不可用(父级是文件)时降级内存不抛错
- [x] 坏 JSON 文件 → 起始干净;maxSamples 淘汰旧样本并按指纹去重

### runtime 集成(test/runtime-risk.spec.ts 5 例 + test/permissive.spec.ts)
- [x] llmAssist+safe → allow 且审计 source=classifier
- [x] llmAssist+risky 硬类别(credential/deletion)→ 自动拒绝(auto-deny),不产生 pending
- [x] llmAssist+risky neutral → ask + pending 登记;settleExecution 后计数 +1
- [x] 阈值满足 + 同指纹 → 直接 allow(learned);跨运行时实例持久化生效
- [x] 不同目标(`npm install right-pad`)仍 ask —— 无跨目标复用
- [x] riskLearning=false → neutral 也只 ask 不学习
- [x] 协议失败/未配置 → 维持原 ask,永不 deny/allow
- [x] P0/deny/grant 决策不进 refineAsk(仅 ask 进入精炼;alwaysConfirm 升级的 ask 亦可被精炼)

### pre-execute 水闸(test/pre-execute.spec.ts 7 例)
- [x] safe → listener 返回 undefined 并调用 next():宿主收不到 ask,面板不出现(pendingAskCount=0,事件 verdict=llm-safe)
- [x] 硬类别 → 返回 deny 且不调 next(auto-deny 真正到达宿主)
- [x] risky:neutral → 返回 ask(reason 含 `llm-assist risky:neutral`)且不调 next,pending 登记
- [x] unresolved / 判定抛错 → 保留原 ask(fail-closed,不调 next)
- [x] 已取消的调用(exec.signal.aborted)→ 不调 LLM,保留 ask
- [x] 非 ask 决策(read 只读工具)→ 直接 next(),不调 LLM

### 事件流(src/events.ts,test/events.spec.ts 8 例)
- [x] 每次裁决追加 JSONL 一行(id 单调,重启恢复游标);since/sessionId 过滤正确
- [x] webServer 缺失时 registerEventsRoute 返回 false 静默降级(仅落盘),插件不崩
- [x] 非 GET/POST → 405;GET 带查询参数正常应答
- [x] client dock 已入 bundle(lib/client.js 含 conversation.input.dock / 事件轮询 / riskLearning 控件 / aria-haspopup 装饰)

### UI
- [x] 权限菜单 Permissive menuitem 图标逻辑保留(回归:原 decorate 分支未变)
- [x] 触发按钮(`button[aria-haspopup="menu"]` 文案匹配)装饰 `data-*='trigger'`(14px 小号);不匹配的按钮不受影响(静态核对 bundle;DOM 实测需在 DSH 环境手动确认)
- [x] 卡片新增 riskLearning 开关 + 阈值输入(1–10),四语 key 编译期对齐(typecheck 通过即证明 en/ja/ko 缺 key 会报编译错)

### 自定义 LLM 配置路(test/custom-llm.spec.ts 7 例,真实 HTTP 服务,无注入 hook)
- [x] 设置面形状的 readClassifyConfig → refineAsk 真实打到自定义端点:Bearer key、model、消息体正确,路径 `/v1/chat/completions`
- [x] safe 判定 → 自动放行(审计 source=classifier);risky 硬类别 → 保持人工 ask
- [x] 网关拒绝 `response_format`(400)→ 自动去参降级重试一次,仍能拿到判定
- [x] 用户粘贴完整路径 `…/v1/chat/completions` → 不重复拼接(chatCompletionsUrl 归一化)
- [x] 端点不可达 → 回落人工 ask(审计 source=default,fail-closed)
- [x] 非 JSON 纯文本响应(如 `SAFE - …`)→ 关键词回退解析成功
- [x] host 半区 timeoutMs 实时读取补默认值(20s);refineAsk 单次读取分类器配置

## Should Pass
- [x] 事件/学习文件坏行、路径不可用均不抛错(单测覆盖)
- [x] 新增导出(risk/learning/events)进入 lib/*.d.ts
- [x] README 四语新增章节,语言切换链接块完整(四文件头部链接未改动)
