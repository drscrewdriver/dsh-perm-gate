window.__ModuleLoader__.load({
	id: "dsh-perm-gate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/client/locales.ts
		/** `dsh-perm-gate` client dictionaries (zh / en / ja / ko / fr / de / it / ru / es / pt). */
		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-perm-gate";
		/**
		* Combined dictionary map for all 10 active languages, registered in ONE
		* `locale.register(NS, dictionaries)` call. The map form is deliberately left
		* with its inferred literal type instead of a loose
		* `Record<string, Record<string, string>>` annotation: `dsh-perm-gate` is a
		* declared namespace in `LocaleNamespaceMap`, so the locale service resolves
		* the TYPED `register(ns, dicts)` overload, which requires the built-in
		* `zh`/`en` keys to be statically present (an index signature would not
		* guarantee them and fails the assignment). The runtime still iterates every
		* entry of the map and accepts any BCP 47-style locale id, so the eight
		* extension languages activate through the very same call.
		*/
		const dictionaries = {
			zh: {
				"card.title": "自动审查",
				"section.title": "自动审查门",
				"card.description": "独立审批档位：与只读 / 完全权限 / 白名单平行，在会话权限下拉中显示为「自动审查」。前端只暴露一个开关；后台四个审批策略可组合、由此处设置决定，仍对 P0 硬拒绝保持 fail-closed。",
				"card.permissive": "启用自动审查档位",
				"card.permissiveHint": "关闭时门禁行为与此前完全一致。",
				"card.unattended": "无人值守档位",
				"card.unattendedHint": "三颗开关，每颗只管它旁边标着的那一档：关掉即实现不存在，那一档退回普通人工流，不会偷偷变成别的档。",
				"card.mode.ask": "保留人工",
				"card.mode.pass": "机械直通",
				"card.askHint": "（危险/不确定才人工确认）仍接回沙箱组：作用域内的安全操作照由 trustAutoAllow 自动静默放行、不弹确认；确定性机械审查器只对运行前的危险（破坏性 Git 与文件系统命令、SSH 密钥/.env 等机密访问）与未知残局列出疑点、交人工确认，一次审查模型都不叫——不触发确认的安全操作照常执行。适用于无审查 LLM 可用、或不值当花 token 的运行。",
				"card.passHint": "（检查通过直接放行、不问人）只跑确定性机械审查器：运行前命中不可逆 / 不可沉淀 / 读不懂的载荷（含破坏性 Git 与文件系统命令、SSH 密钥/.env 等机密访问）就拦截并把理由回喂主模型，检查后无问题的其余照常直接执行。零模型调用——相当于 approval: never 的有审查版，也是 yolo 拿掉 LLM 后的劣化形态。",
				"card.testing": "测试与诊断",
				"card.lists": "放行与拦截清单",
				"card.credentials": "凭据保护",
				"card.networkOps": "网络与热重载",
				"card.summaryOn": "开",
				"card.summaryOff": "关",
				"card.summaryNone": "无",
				"card.summaryStrategies": "%n 项启用",
				"card.summaryLists": "放行 %a 项 · 拦截 %d 项",
				"card.summaryCredRw": "readwrite：%n 族",
				"card.summaryNetwork": "网络 %net · 热重载 %w",
				"card.denylistPresetCollapse": "内置词（%n）",
				"card.denylistCustom": "自定义词",
				"card.yolo": "YOLO — 永不人工确认：危险才拦，其余放行",
				"card.yoloExempt": "YOLO：工作区内「落点未知」也放行",
				"card.yoloExemptHint": "只在 YOLO 档生效。打开后，仅「位置判不清」的调用（无参数工具、工作区外脚本未读到正文）不再按「看不见」拦截；编码载荷、读不到正文的脚本、删除与远端写仍然拦，P0/凭据/不可逆一律不变。",
				"card.yoloHint": "命中不可逆 / 不可沉淀 / 读不懂的载荷，或模型报硬风险时拦截，并把理由以「工具审核意见」回喂主模型；其余照常执行。没有可用模型时只靠确定性规则网拦截。",
				"card.rulesFallback": "无模型时降级成规则闸门（cc-safety-net 级）",
				"card.rulesFallbackHint": "只在审查模型未配置、或模型未能给出裁决时生效：按确定性规则拦危险、放行其余，不再把调用挂在没人应答的确认框上。模型正常回答时行为与之前完全一致。",
				"card.allowProtectedBranchPush": "允许强推保护分支（默认关＝保留地板）",
				"card.allowProtectedBranchPushHint": "默认用 P0 地板拦下针对 main/master/production/release/stable 的 git push --force/--force-with-lease/--delete（模型不可降级）。开启后地板让位，并豁免黑名单里三条扁平 push 词；调用落到预设的 git.push-force 规则——它仍会问人，除非你撤销该条或加白名单。不放宽任何其他面：删除、重定向、凭据地板照常。",
				"card.credFamily": "凭据类型阶梯",
				"card.credFamilyHint": "每类凭据一个档位：deny=读写全拦；ask=读需人工确认（默认）；readonly=读放行、写删仍被 P0 硬拦；readwrite=本族内置路径的凭据 store 写判据退让（npm login 类工作流），其余地板（根盘、受保护路径、.dsh、外发）任何档位都不让。档位状态存在规则文档条目与写豁免清单两处，由本卡成对写回。",
				"card.credFamilyLoading": "正在读取凭据档位…",
				"card.credFamilyFootnote": "无人值守档（机械直通/YOLO）会把 ask 残局放行；需要硬挡请选 deny。自定义 credentialPaths 不参与写豁免；readwrite 不影响任何非凭据判据。",
				"card.credReadwriteConfirm": "readwrite 将放行对该类凭据文件的写入/修改（如重写 ~/.npmrc）；这是唯一会退让部分 P0 的档位。确认？",
				"card.credConfirmYes": "确认",
				"card.credConfirmNo": "取消",
				"card.credRung.deny": "拦截",
				"card.credRung.ask": "确认",
				"card.credRung.readonly": "只读",
				"card.credRung.readwrite": "读写",
				"card.scriptReview": "脚本正文随审查一并送审（默认开）",
				"card.scriptReviewHint": "调用运行脚本文件时读取它的正文：审查模型与人看的是同一份代码，规则层也按正文判定不可逆（文件名看不出危险的删除正是这么漏掉的）。正文出境前脱敏并截断；关掉它就不会让文件内容离开本机，代价是工作区外的脚本回到「看不清」档位。",
				"card.credentialPaths": "自定义凭据路径（长尾）",
				"card.autoAllowTools": "白名单工具（完全放行）",
				"card.autoAllowToolsHint": "列表中的工具名与 read/grep 同档：弹框和模型审查跳过，但凭据路径硬拒和规则层 deny 仍生效。用于自定义插件注册的安全工具名。",
				"card.autoAllowToolsPlaceholder": "工具名，如 my_safe_tool",
				"card.credentialPathsHint": "插件内置清单之外的机密文件。写法是路径 glob：双星跨目录、单星与问号只在一段内；不含通配符时按路径片段匹配（token 不会命中 ambient.txt）；行首 ~/ 会展开为你的 home；相对写法也在任意深度匹配（secrets/*.env 覆盖 a/b/secrets/prod.env）。命中后与 .ssh 同档：工作区外读取被硬拒、被文件工具改写被硬拒（这一档不可申诉，也不会被审查模型放行），所以只写确实需要保护的路径。",
				"card.credentialPathsPlaceholder": "新路径，如 ~/.myco/vault.token 或 secrets/*.env",
				"card.denyKeywordsExtra": "追加黑名单关键词（不替换预置）",
				"card.denyKeywordsExtraHint": "在你自己的命令词上加一道确定性拦截，例如公司内部 CLI 的吊销/清库子命令或自有令牌前缀。这里只做追加：无论上面「黑名单」是预置还是你替换过，这些词都会并进去。",
				"card.listRemove": "移除该条目",
				"card.extraContentArgKeys": "追加正文键（这些参数不被当操作读）",
				"card.extraContentArgKeysHint": "内置清单（content/text/plan…）之外的文档字段名，例如某个自有工具的 steps/notes：加进来后，它的文字不再进入危险词与凭据形态的扁平扫描。只追加、不替换内置表——漏写一个内置键就会重现“把计划当操作拒掉”的静默失效。被执行的命令本身与被改写的路径走各自判据，这张表关不掉它们。",
				"card.extraContentArgKeysPlaceholder": "新参数名，如 steps",
				"card.extraOperationArgKeys": "追加操作键（把该字段当会执行的代码读）",
				"card.extraOperationArgKeysHint": "给「正文其实会被执行」的字段开口子（如 workflowYaml）：它的文本会进入黑名单与凭据预筛；与上一张表撞名时本表获胜。代价：把真正的文档字段写进来，就等于让「计划里提到 rm -rf」重新变成拒绝理由。",
				"card.scopeNote": "档位作用域：本门禁仅在会话权限档位为 %scope 时生效。其他档位下整个门禁停用（含 P0 硬拒绝），由所选档位自身的策略接管；停用时会写入一条 stand-down 事件，并在输入框上方常驻一条提示条。",
				"card.strategies": "后台审批策略（至少一个生效；可组合）",
				"card.strategy.trustAutoAllow": "trustAutoAllow — 作用域内安全操作自动放行，危险/未知转 ask（中间档基线）",
				"card.strategy.alwaysConfirm": "alwaysConfirm — 一律逐次 ask；审批面板「允许控件」含两个扩展按钮：「本会话重复允许该类」（会话语限次 grant）与「允许所有类型」（命令词持久迁入 rulesFile 白名单）",
				"card.strategy.llmAssist": "llmAssist — 自定义 LLM 按风险分级裁决：safe 自动放行；deletion/credential/remote/system/bulk 硬风险维持人工确认（分类器永不拒绝，只负责升级判断）；neutral 进入确认学习；失败/超时回退人工",
				"card.strategy.trustEscalation": "trustEscalation — 沙箱升级免确认：本门禁已放行的调用，其工具内部发起的沙箱提权（shell / pwsh / edit 的 sandbox_permissions）由门禁直接批准，不再弹窗",
				"card.strategy.trustEscalationHint": "沙箱提权审批发生在 tools/pre-execute 之后、工具体内部，门禁原本看不到它，因此「LLM 判安全已自动放行」的调用仍会弹窗要求你批准提权。开启后，仅对门禁确实放行过的那一次调用（按 callId 精确匹配）免确认，其余一律照旧走人工；目标模式非 workspace-write / danger-full-access 或理由无法识别时同样回退人工。关闭后提权保持人工把关。",
				"card.readonly": "只读",
				"card.unavailable": "设置命名空间不可用：请确认 dsh-perm-gate 已装配进 profile。",
				"card.llmReceiver": "llmAssist 接收 LLM（OpenAI 兼容，可用自定义 API）",
				"card.llmEndpoint": "Endpoint（BaseURL，如 https://api.openai.com/v1）",
				"card.llmModel": "Model（模型 id，如 deepseek-chat）",
				"card.llmEffort": "推理强度（仅 host 模式）",
				"card.llmEffortHost": "跟随宿主默认",
				"card.llmEffortHint": "留空＝不干预，由宿主模型配置决定；被宿主拒绝时改 low 或 off。",
				"card.llmKey": "API Key（保密）",
				"card.llmKeyHidden": "未设置 · 首次输入后以 * 显示",
				"card.llmKeyMasked": "已设置 · 输入新值覆盖",
				"card.llmKeyOverwrite": "已设置保密值，输入新值并失焦即可覆盖。",
				"card.llmKeyClear": "清除",
				"card.allowlist": "白名单（allow，rulesFile 同步）",
				"card.allowlistHint": "命中 allow 段的命令模式直接放行；逐条添加或删除，实时写入 rulesFile 并重载。",
				"card.allowlistPresetNote": "预置白名单的等价物是 trustAutoAllow 策略（工作区内安全操作自动放行），在上方策略区开启；本列表镜像你的 rulesFile allow 段，初始为空属正常。",
				"card.allowlistEmpty": "无白名单规则",
				"card.allowlistPlaceholder": "新命令模式，如 npm test*",
				"card.allowlistAdd": "添加",
				"card.allowlistRemove": "删除该模式",
				"card.allowlistBulk": "批量编辑",
				"card.allowlistBulkHide": "收起批量编辑",
				"card.allowlistSave": "保存白名单",
				"card.riskLearning": "riskLearning — 裁决学习：neutral 风险操作经人工确认并执行后计数，满阈值且操作指纹一致时自动放行",
				"card.riskLearningHint": "学习状态为插件自有数据（$DSH_HOME/perm-gate/learning.json），不写入你的 YAML 规则文件；不同目标永不复用放行。默认关闭。",
				"card.riskThreshold": "自动放行所需人工确认次数（1–10）",
				"notice.label": "权限门禁动态",
				"history.label": "审批记录",
				"history.title": "权限审批记录",
				"history.subtitle": "本会话中门禁的每次判定轨迹（最新在上）",
				"history.loading": "加载中…",
				"history.empty": "本会话暂无审批记录",
				"history.error": "加载失败：",
				"history.tag.auto": "自动放行",
				"history.tag.ask": "转人工",
				"history.tag.deny": "拒绝",
				"card.denylistRestore": "恢复预置黑名单",
				"card.denylist": "黑名单（deny 关键词，插件预置）",
				"card.denylistHint": "命中关键词（大小写不敏感子串）的调用直接拒绝，先于白名单/授权/LLM。预置列表继承自 dsh-approval-gate，安装即生效；可增删，清空或删除后可用「恢复预置黑名单」一键还原（空列表等同预置，黑名单常开）。",
				"card.denylistEmpty": "黑名单为空（所有调用都不会被关键词层拒绝）",
				"card.denylistPlaceholder": "新关键词，如 drop database",
				"card.denylistAdd": "添加",
				"card.denylistRemove": "删除该关键词",
				"card.denylistTagPreset": "预置",
				"card.denylistTagCustom": "自定义",
				"card.riskSediment": "riskSediment — 学习沉淀：满阈值的确认样本成为确定性放行规则",
				"card.riskSedimentHint": "开启后，同一「工具|类别」确认满阈值，其样本指纹即沉淀为放行规则——同工具同目标精确命中时直接放行，不再过 LLM（关闭 llmAssist 也继续生效）。",
				"card.sediment": "学习沉淀（确定性放行规则）",
				"card.sedimentHint": "来自人工确认的沉淀规则：样本指纹命中才放行，不同目标永不复用。可终止单个学习或删除单条样本。",
				"card.learningScope": "学习数据作用域",
				"card.learningScopeGlobal": "全局（默认）",
				"card.learningScopeSession": "按会话隔离",
				"card.learningScopeHint": "全局：任一会话确认过的操作会降低所有会话的门槛（历史行为）。按会话隔离：只认本会话自己的确认，此前的全局规则需在沉淀列表里显式提升才会生效。",
				"attention.title": "审批提醒",
				"attention.hint": "请求确认到达时如何提醒你。两项各自独立：默认只显示决策条（与今天一致），开启提示音后即使不在对话里也能听到。",
				"attention.toast": "显示决策条",
				"attention.sound": "提示音",
				"attention.gap": "同一会话最短间隔（毫秒）",
				"attention.test": "试听",
				"card.sedimentEmpty": "暂无沉淀规则（确认满阈值的样本会出现在这里）",
				"card.sedimentCount": "已确认 %n/%t",
				"card.sedimentStop": "终止",
				"card.sedimentStopTitle": "终止该学习（删除计数与样本）",
				"card.sedimentStopConfirm": "终止「%k」的学习？将删除其确认计数与全部样本。",
				"card.sedimentSampleRemove": "删除该沉淀样本",
				"card.llmSource": "接收 LLM 来源",
				"card.llmSourceCustom": "自定义 API（OpenAI 兼容）",
				"card.llmSourceHost": "使用会话当前默认模型（DSH llm 服务）",
				"card.llmSourceHostHint": "默认使用 DSH 会话当前选中的模型组执行审批判定（下方显示当前生效值）；Provider / Model 留空即跟随会话，也可从下拉选择或手动输入固定下来——你在 DSH 里配置的自定义组（如 local-35b）会自动出现在下拉中。",
				"card.llmProvider": "Provider（留空 = 跟随会话当前选择）",
				"card.llmProviderPlaceholder": "跟随会话当前选择",
				"card.llmModelHostPlaceholder": "留空 = 跟随会话当前选择",
				"card.llmResolved": "当前生效：%p / %m",
				"card.llmPreset": "预置端点（选择后自动填充，可再编辑）",
				"card.llmPresetChoose": "选择预置…",
				"card.llmPresetPublic": "公共 API 预置",
				"card.llmPresetHost": "DSH 模型组（选择后自动切换为会话模式）",
				"card.networkEnabled": "网络拦截（networkEnabled）",
				"card.networkEnabledHint": "开启后启动本地代理拦截子进程出站连接，按规则放行/阻断。关闭则零行为变更。",
				"card.watch": "规则热重载（watch）",
				"card.watchHint": "开启后自动监听规则文件变更并即时生效，无需手动 reload。",
				"card.networkRebindNote": "切换后立即生效（自动重绑，无需重载插件）。",
				"card.networkInjectEnv": "注入代理环境变量（networkInjectEnv）",
				"card.networkInjectEnvHint": "开启后为子进程写入 HTTP(S)_PROXY / ALL_PROXY（并清空 NO_PROXY）。关闭则只启动监听、不改变任何进程环境。",
				"card.healthStale": "宿主路由不可用（404）——node 半区仍是旧版本，请完全重启 dsh（而非仅刷新页面）后重试。",
				"card.healthTest": "健康测试",
				"card.healthRunning": "测试中…",
				"card.healthOk": "正常（%ms ms）",
				"card.healthFail": "失败：",
				"history.tag.learned": "学习沉淀",
				"history.tag.manualApproved": "人工通过",
				"history.tag.manualRejected": "人工拒绝",
				"history.tag.manualCancelled": "人工取消",
				"history.tag.standDown": "门禁停用",
				"history.learnedProgress": "学习 %n/%t",
				"history.snapshots": "diff 快照",
				"history.clearSession": "仅清本会话",
				"history.clearAll": "清空全部",
				"history.clearSessionTitle": "仅清除本会话的 diff 快照（不影响其他会话）",
				"history.clearAllTitle": "清空全部会话（含其他会话未查看过的）diff 快照，需二次确认",
				"history.clearSessionConfirm": "确定清除【本会话】的 diff 快照？仅删除本会话审批产生的改动对比数据，不影响审批记录本身。",
				"history.clearAllConfirm": "确定清除【全部会话】的 diff 快照？这可能删除其他会话还没看过的改动对比记录，且不可恢复。",
				"history.diffTitle": "文件改动对比",
				"history.diffClose": "关闭",
				"history.diffLoading": "加载中…",
				"history.diffEmpty": "该文件无内容变化（或文件不可读）",
				"history.diffLoadFail": "加载 diff 失败：",
				"history.diffRevert": "撤销此改动",
				"history.diffReverting": "发送中…",
				"history.diffRevertDone": "已发送撤销指令",
				"history.diffRevertSent": "撤销指令已发送到对话框，AI 将按指令恢复文件",
				"history.diffRevertFail": "发送失败：",
				"history.diffNoSnapshot": "该事件没有此文件的快照",
				"history.diffChipTitle": "查看该文件改动对比",
				"history.diffStats": "+%a / -%r 行变更 · %c 行未变",
				"history.diffGone": "（文件当前已不存在）",
				"history.diffHidden": "%n 行未修改",
				"card.dryRun": "规则测试",
				"card.dryRunHint": "用当前生效的规则判定一次调用，不执行任何工具、不写入任何规则。改规则前先在这里验一遍。",
				"card.dryRunTool": "工具名",
				"card.dryRunCommand": "命令 / 参数",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "测试",
				"card.dryRunRunning": "判定中…",
				"card.dryRunEmpty": "尚未测试。填入工具名与命令，点「测试」查看会怎么裁决。",
				"card.dryRunVerdict": "裁决",
				"card.dryRunAllow": "放行",
				"card.dryRunAsk": "人工确认",
				"card.dryRunDeny": "拒绝",
				"card.dryRunRule": "命中规则",
				"card.dryRunRuleNone": "无规则命中，走 defaultAction：%d",
				"card.dryRunDimensions": "约束维度",
				"card.dryRunReason": "原因",
				"card.dryRunNote": "「命中规则」来自规则层。若裁决由更早的硬拒绝或关键词黑名单产生，则不会有规则序号——那种情况下列出的维度仅供参考。",
				"card.dryRunNoRules": "（当前加载了 0 条规则：检查 rulesFile 路径）",
				"card.dryRunFail": "测试失败：",
				"card.dryRunStale": "路由不存在（插件未重启？）",
				"card.rules": "Settings 内置规则",
				"card.rulesHint": "门禁此刻实际加载的规则（来自本插件入口的 rules 配置字段；未配置时回退到规则文件）。只读——这里改不了任何东西。要改规则，用下面的白名单，或在设置页中编辑。",
				"card.rulesRefresh": "刷新",
				"card.rulesLoading": "读取中…",
				"card.rulesPath": "来源",
				"card.rulesNone": "未配置规则",
				"card.rulesCounts": "规则",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b 字节 · %l 行",
				"card.rulesMissing": "规则不存在。门禁会退到内置默认。",
				"card.rulesTruncated": "规则过大，仅显示前 512 KB。",
				"card.rulesError": "加载失败：",
				"card.rulesStale": "路由不存在（插件未重启？）",
				"card.rulesNote": "此处只读：面板无法修改规则；白名单段与“始终允许”会写回本插件的入口配置。",
				"doubt.no-rule": "没有规则覆盖这次调用，按默认策略交给人 — 这不表示它危险",
				"doubt.opaque": "命令载荷读不懂（编码过 / 工作区外的脚本 / 认不出程序名），规则层无法定位目标",
				"doubt.irreversible": "规则判定不可逆：跑完无法撤回",
				"doubt.never-learn": "这类确认不会沉淀，下次同样的操作还会再问",
				"doubt.delete": "会删除内容",
				"doubt.remote-write": "会产生对外可见的副作用（推送 / 发布 / 写请求），撤回需要额外手动操作",
				"doubt.exec-external": "会执行工作区之外的代码，本次调用无法静态看清它做什么",
				"doubt.outside-paths": "涉及工作区之外的路径",
				"doubt.model-flagged": "风险模型认为可疑（它只能升级，不能放行）",
				"doubt.write": "会写入或修改文件",
				"verdict.rule": "规则命中",
				"verdict.grant": "会话授权",
				"verdict.hard-deny": "硬拒绝",
				"verdict.deny-keyword": "黑名单关键词",
				"verdict.default": "默认策略",
				"verdict.ask": "默认策略",
				"verdict.permissive": "自动审查放行",
				"verdict.classifier": "LLM 裁决",
				"verdict.llm-safe": "LLM 判定安全",
				"verdict.llm-learned": "LLM 学习放行",
				"verdict.learned-sediment": "沉淀规则放行",
				"verdict.learned-confirm": "学习确认",
				"verdict.human-approved": "人工通过",
				"verdict.human-rejected": "人工拒绝",
				"verdict.human-cancelled": "人工取消",
				"verdict.no-approval-channel": "无审批通道",
				"verdict.preset-passthrough": "审批策略 never · 已放行",
				"verdict.stand-down": "门禁停用",
				"verdict.yolo-allow": "YOLO 放行",
				"verdict.yolo-allow-no-reviewer": "YOLO 放行（无审查模型·机械处置）",
				"verdict.yolo-block": "YOLO 拦截",
				"verdict.rules-fallback-allow": "无模型规则闸门放行",
				"verdict.rules-fallback-block": "无模型规则闸门拦截",
				"verdict.safety-net-passthrough-allow": "机械审查放行（零模型）",
				"verdict.safety-net-passthrough-block": "机械审查拦截（零模型）",
				"verdict.cleanup-safe": "清理类安全放行",
				"verdict.escalation-auto": "沙箱升级自动放行",
				"verdict.learned-granted": "学习授权放行",
				"verdict.network-ask": "网络审批",
				"card.scopeUnresolved": "（scope 未解析 — 诊断占位）"
			},
			en: {
				"card.title": "自动审查 (Auto review)",
				"section.title": "Auto-Review Gate",
				"card.description": "Independent approval tier, parallel to read-only / full-access / whitelist, shown as 自动审查 in the session permission picker. The front-end exposes a single switch; the four backend approval strategies are combinable via this panel and still fail-closed against P0 hard-deny.",
				"card.permissive": "Enable the 自动审查 tier",
				"card.permissiveHint": "When off, the gate behaves exactly as before.",
				"card.unattended": "Unattended tiers",
				"card.unattendedHint": "Three switches, each governing only the tier named beside it: switching an implementation off returns that tier to the ordinary human flow — it never quietly becomes a different tier.",
				"card.mode.ask": "Keep human",
				"card.mode.pass": "Mechanical pass-through",
				"card.askHint": "(Manual confirmation only for danger / uncertainty) Still on the sandbox group: safe operations inside the scope are auto-allowed silently by trustAutoAllow with no popup; the deterministic mechanical screen lists its doubts and asks a person only for pre-execution danger (destructive Git and filesystem commands, access to SSH keys / .env credentials) and unreadable or unknown residuals, calling no grader at all — anything that does not trigger a confirmation runs as normal. The shape for runs with no reviewer LLM connected, or where the tokens are not worth spending.",
				"card.passHint": "(Auto-allow once the check passes, no human prompt) Runs the deterministic mechanical judge only: before execution an irreversible, unlearnable or unreadable call (including destructive Git and filesystem commands and access to SSH keys / .env credentials) is blocked and the reason fed back to the main model, everything that passes runs directly. No model call — the reviewed form of approval: never, and YOLO with the model taken away.",
				"card.testing": "Testing & diagnostics",
				"card.lists": "Allow & block lists",
				"card.credentials": "Credential protection",
				"card.networkOps": "Network & hot reload",
				"card.summaryOn": "on",
				"card.summaryOff": "off",
				"card.summaryNone": "none",
				"card.summaryStrategies": "%n enabled",
				"card.summaryLists": "%a allow · %d block",
				"card.summaryCredRw": "readwrite: %n families",
				"card.summaryNetwork": "network %net · hot reload %w",
				"card.denylistPresetCollapse": "Built-in keywords (%n)",
				"card.denylistCustom": "Custom keywords",
				"card.yolo": "YOLO — never ask a human: block the dangerous, run the rest",
				"card.yoloExempt": "YOLO: also allow \"unknown location\" inside the workspace",
				"card.yoloExemptHint": "YOLO only. When on, a call whose target simply cannot be pinned down (no-argument tools, a script outside the workspace whose body was not read) is no longer blocked as \"unseen\". Encoded payloads, unreadable script bodies, deletes and remote writes are still blocked; P0, credentials and irreversible acts never change.",
				"card.yoloHint": "Blocks an irreversible / unlearnable / unreadable payload, or a hard-risk verdict from the model, and feeds the reason back to the main LLM as a 工具审核意见 message; everything else executes. With no reviewer available only the deterministic nets catch anything.",
				"card.rulesFallback": "Degrade to a rule-only gate when there is no model (cc-safety-net class)",
				"card.rulesFallbackHint": "Takes effect only when the risk reviewer is not configured or gave no verdict: the deterministic nets block what they can name and let the rest through, instead of parking the call on a popup nobody will answer. While a reviewer answers, behaviour is unchanged.",
				"card.allowProtectedBranchPush": "Allow force-pushing protected branches (default off = floor stands)",
				"card.allowProtectedBranchPushHint": "By default the P0 floor hard-blocks git push --force/--force-with-lease/--delete aimed at main/master/production/release/stable (not downgradable by any model). Turning it on steps the floor aside and exempts the three flat push keywords in the blacklist; the call then falls to the seeded git.push-force rule, which still asks a person unless you revoke that entry or allowlist it. Nothing else widens: wipes, redirects and the credential floor stay armed.",
				"card.credFamily": "Credential family ladder",
				"card.credFamilyHint": "One rung per family: deny = block reads and writes; ask = reads need a person (default); readonly = reads pass, writes stay hard-blocked by P0; readwrite = the credential-store WRITE clause steps aside for that family's built-in paths (npm-login style) — every other floor (roots, protected paths, .dsh, exfil) stays armed at any rung. The rung lives in the rules-document row plus the paired write-exemption list; this card writes both together.",
				"card.credFamilyLoading": "Loading credential rungs…",
				"card.credFamilyFootnote": "Unattended tiers (mechanical pass / YOLO) let ask residuals run — pick deny to hard-block. Custom credentialPaths never join the write exemption; readwrite changes nothing outside credential stores.",
				"card.credReadwriteConfirm": "readwrite lets tools WRITE/modify this family's credential files (e.g. rewrite ~/.npmrc). This is the only rung that steps a piece of P0 aside. Confirm?",
				"card.credConfirmYes": "Confirm",
				"card.credConfirmNo": "Cancel",
				"card.credRung.deny": "deny",
				"card.credRung.ask": "ask",
				"card.credRung.readonly": "readonly",
				"card.credRung.readwrite": "readwrite",
				"card.scriptReview": "Attach script bodies to the review (on by default)",
				"card.scriptReviewHint": "When a call runs a script file, its body is read and given to the risk model and the human alike, and the deterministic nets grade the body too (a delete that only shows up inside the file is exactly what used to slip through). Bodies are redacted and length-capped before leaving the host; switching this off keeps file contents local at the cost of sending out-of-workspace scripts back to the unreadable tier.",
				"card.credentialPaths": "Custom credential paths (the long tail)",
				"card.autoAllowTools": "Auto-allow tools (bypass ask)",
				"card.autoAllowToolsHint": "Tool names in this list are treated like read/grep: no popup, no model review. P0 hard-deny and path rules still fire. Use for safe tools registered by your own plugins.",
				"card.autoAllowToolsPlaceholder": "Tool name, e.g. my_safe_tool",
				"card.credentialPathsHint": "Secret files the built-in list does not know. Entries are path globs: a double star crosses directories, a single star and a question mark stay inside one segment; without a wildcard it matches a whole path fragment (token will not hit ambient.txt); a leading ~/ expands to your home; a relative pattern also matches at any depth (secrets/*.env covers a/b/secrets/prod.env). A hit is held to the same standard as .ssh: reading it outside the workspace is hard-denied, mutating it with a file tool is hard-denied — that tier cannot be appealed or talked past by the reviewer, so declare only paths you truly need protected.",
				"card.credentialPathsPlaceholder": "New path, e.g. ~/.myco/vault.token or secrets/*.env",
				"card.denyKeywordsExtra": "Appended blacklist keywords (never replaces the preset)",
				"card.denyKeywordsExtraHint": "A deterministic block on words of your own — a revoke/wipe subcommand of a company CLI, a token prefix you issue. This list only ever appends: whatever the blacklist above holds (preset or your own replacement), these words are merged in.",
				"card.listRemove": "Remove this entry",
				"card.extraContentArgKeys": "Appended document keys (never read as an operation)",
				"card.extraContentArgKeysHint": "Document field names beyond the built-in list (content/text/plan…): once listed, their text stops entering the flattened scan that the destructive-word blacklist and the credential pre-screen read. Additive only — the built-in list cannot be replaced, because dropping one of its keys would silently re-create the bug where a plan gets refused for describing work. The executed command and the mutated path are judged on their own terms; this list cannot switch them off.",
				"card.extraContentArgKeysPlaceholder": "New argument name, e.g. steps",
				"card.extraOperationArgKeys": "Appended operation keys (read this field as code that runs)",
				"card.extraOperationArgKeysHint": "Opens a route for fields whose body really is executed (workflowYaml and friends): their text enters the blacklist and the credential screen, and this list wins when both name the same key. Cost: naming a genuine document field here makes “the plan mentions rm -rf” a refusal reason again.",
				"card.scopeNote": "Preset scope: this gate only acts while the session permission preset is %scope. Under any other preset the whole gate stands down — P0 hard-deny included — and the selected preset's own policy takes over. A stand-down records one event and leaves a sticky strip above the input.",
				"card.strategies": "Backend approval strategies (at least one effective; combinable)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — safe in-scope ops auto-allow; dangerous/unknown ask (baseline middle tier)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — every crossing asks; the approval \"allow controls\" get two extended buttons: \"repeat-allow this type this session\" (bounded session grant) and \"allow every occurrence\" (persist the command word into the rulesFile whitelist)",
				"card.strategy.llmAssist": "llmAssist — a custom LLM grades risk: safe auto-allows; deletion/credential/remote/system/bulk hard risks keep the human ask (the classifier never denies — it only escalates); neutral enters confirm-learning; failure/timeout falls back to the human",
				"card.strategy.trustEscalation": "trustEscalation — sandbox escalation without a prompt: for a call this gate already allowed, the sandbox widening a shell / pwsh / edit tool raises from inside itself is approved here instead of asking you",
				"card.strategy.trustEscalationHint": "A sandbox escalation is asked from inside the tool body, after tools/pre-execute, so the gate never saw it — a call the LLM graded safe and the gate auto-allowed still prompted you to approve the widening. With this on, only the exact call the gate allowed (matched by callId) skips the prompt; everything else goes to the human as before, as does any unrecognized reason or a target other than workspace-write / danger-full-access. Turn it off to keep widening human-gated.",
				"card.readonly": "Read-only",
				"card.unavailable": "Settings namespace unavailable: make sure dsh-perm-gate is assembled into this profile.",
				"card.llmReceiver": "llmAssist receiving LLM (OpenAI-compatible; any custom API)",
				"card.llmEndpoint": "Endpoint (BaseURL, e.g. https://api.openai.com/v1)",
				"card.llmModel": "Model (model id, e.g. deepseek-chat)",
				"card.llmEffort": "Reasoning effort (host mode only)",
				"card.llmEffortHost": "Follow the host default",
				"card.llmEffortHint": "Empty = send no effort and let the host model config decide; switch to low or off if the host rejects it.",
				"card.llmKey": "API Key (secret)",
				"card.llmKeyHidden": "Unset · shown as * after first entry",
				"card.llmKeyMasked": "Set · type a new value to overwrite",
				"card.llmKeyOverwrite": "A secret is stored; type a new value and blur to overwrite it.",
				"card.llmKeyClear": "Clear",
				"card.allowlist": "Whitelist (allow, synced to rulesFile)",
				"card.allowlistHint": "Patterns in the allow section allow directly; add or remove entries one by one, written to the rulesFile and reloaded live.",
				"card.allowlistPresetNote": "The preset-whitelist equivalent is the trustAutoAllow strategy (safe in-scope ops auto-allow), enabled in the strategies section above; this list mirrors your rulesFile allow section and legitimately starts empty.",
				"card.allowlistEmpty": "No whitelist rules",
				"card.allowlistPlaceholder": "New command pattern, e.g. npm test*",
				"card.allowlistAdd": "Add",
				"card.allowlistRemove": "Remove this pattern",
				"card.allowlistBulk": "Bulk edit",
				"card.allowlistBulkHide": "Hide bulk edit",
				"card.allowlistSave": "Save whitelist",
				"card.riskLearning": "riskLearning — verdict learning: neutral-risk asks that the human approves and that execute count up; the same operation auto-allows at threshold with a matching fingerprint",
				"card.riskLearningHint": "Learning state is plugin-owned ($DSH_HOME/perm-gate/learning.json) and never written into your YAML rules; a different target never reuses authority. Off by default.",
				"card.riskThreshold": "Human confirmations required before auto-allow (1–10)",
				"notice.label": "Permission gate activity",
				"history.label": "Approvals",
				"history.title": "Permission approval records",
				"history.subtitle": "Every gate decision in this conversation, newest first",
				"history.loading": "Loading…",
				"history.empty": "No approval records in this session yet",
				"history.error": "Failed to load: ",
				"history.tag.auto": "Auto-allowed",
				"history.tag.ask": "Asked",
				"history.tag.deny": "Denied",
				"card.denylistRestore": "Restore preset blacklist",
				"card.denylist": "Blacklist (deny keywords, plugin preset)",
				"card.denylistHint": "A call whose text contains a keyword (case-insensitive substring) is denied outright, before whitelist / grants / LLM. The preset list is inherited from dsh-approval-gate and active from install; edit freely — empty or cleared falls back to the preset (one-click restore available), so the blacklist never silently turns off.",
				"card.denylistEmpty": "Blacklist empty (no call is vetoed by the keyword layer)",
				"card.denylistPlaceholder": "New keyword, e.g. drop database",
				"card.denylistAdd": "Add",
				"card.denylistRemove": "Remove this keyword",
				"card.denylistTagPreset": "Preset",
				"card.denylistTagCustom": "Custom",
				"card.riskSediment": "riskSediment — learning sedimentation: threshold-reached samples become deterministic auto-allows",
				"card.riskSedimentHint": "When on, once a tool|category key reaches the threshold its sample fingerprints are sedimented into allow rules — an exact same-tool same-target hit allows outright without another LLM call (keeps working with llmAssist off).",
				"card.sediment": "Learning sediment (deterministic allow rules)",
				"card.sedimentHint": "Rules sedimented from human confirmations: only an exact fingerprint hit allows, never a different target. Terminate one learning or remove one sample.",
				"card.learningScope": "Learning data scope",
				"card.learningScopeGlobal": "Global (default)",
				"card.learningScopeSession": "Per session",
				"card.learningScopeHint": "Global: an operation confirmed in any session lowers the bar for every session (the historical behaviour). Per session: only this session's own confirmations count, and a pre-existing global rule stays inactive until you promote it explicitly in the sediment list.",
				"attention.title": "Approval alerts",
				"attention.hint": "How an ask reaches you. The two switches are independent: by default only the decision strip shows (today's behaviour); with sound on you hear it even when you are not looking at the conversation.",
				"attention.toast": "Show decision strip",
				"attention.sound": "Sound",
				"attention.gap": "Minimum gap per session (ms)",
				"attention.test": "Preview",
				"card.sedimentEmpty": "No sedimented rules yet (samples reaching the threshold appear here)",
				"card.sedimentCount": "confirmed %n/%t",
				"card.sedimentStop": "Terminate",
				"card.sedimentStopTitle": "Terminate this learning (drops the count and samples)",
				"card.sedimentStopConfirm": "Terminate learning for '%k'? Its count and samples are dropped.",
				"card.sedimentSampleRemove": "Remove this sedimented sample",
				"card.llmSource": "Receiver source",
				"card.llmSourceCustom": "Custom API (OpenAI-compatible)",
				"card.llmSourceHost": "Use the session's current default model (DSH llm service)",
				"card.llmSourceHostHint": "By default approval grading runs on the model group the DSH session currently uses (the effective value is shown below); leave Provider / Model empty to follow the session, or pick from the dropdown or type to pin one — custom groups you configured in DSH (e.g. local-35b) appear automatically.",
				"card.llmProvider": "Provider (empty = follow the session selection)",
				"card.llmProviderPlaceholder": "Follow the session selection",
				"card.llmModelHostPlaceholder": "Empty = follow the session selection",
				"card.llmResolved": "Effective now: %p / %m",
				"card.llmPreset": "Endpoint presets (fills the fields; still editable)",
				"card.llmPresetChoose": "Pick a preset…",
				"card.llmPresetPublic": "Public API presets",
				"card.llmPresetHost": "DSH model groups (selecting one switches to the session receiver)",
				"card.networkEnabled": "Network interception (networkEnabled)",
				"card.networkEnabledHint": "When on, starts a local proxy that intercepts outbound subprocess connections and applies allow/deny rules. Off = zero behavior change.",
				"card.watch": "Rule hot-reload (watch)",
				"card.watchHint": "When on, automatically watches rule files for changes and applies them instantly without manual reload.",
				"card.networkRebindNote": "Takes effect immediately — the proxy rebinds automatically, no plugin reload needed.",
				"card.networkInjectEnv": "Inject proxy environment (networkInjectEnv)",
				"card.networkInjectEnvHint": "Writes HTTP(S)_PROXY / ALL_PROXY for subprocesses (and clears NO_PROXY). Off = the listener runs but no process environment is changed.",
				"card.healthStale": "Host route unavailable (404) — the node half is still an old build; fully restart dsh (not just the browser page) and retry.",
				"card.healthTest": "Health test",
				"card.healthRunning": "Testing…",
				"card.healthOk": "OK (%ms ms)",
				"card.healthFail": "Failed: ",
				"history.tag.learned": "Learned",
				"history.tag.manualApproved": "Approved",
				"history.tag.manualRejected": "Rejected",
				"history.tag.manualCancelled": "Cancelled",
				"history.tag.standDown": "Gate off",
				"history.learnedProgress": "learned %n/%t",
				"history.snapshots": "diff snapshots",
				"history.clearSession": "Clear this session",
				"history.clearAll": "Clear all",
				"history.clearSessionTitle": "Clear only this session’s diff snapshots (other sessions untouched)",
				"history.clearAllTitle": "Clear diff snapshots for every session, including ones never reviewed — asks again",
				"history.clearSessionConfirm": "Clear this session’s diff snapshots? Only the change-comparison data produced by this session’s approvals is removed; the approval records stay.",
				"history.clearAllConfirm": "Clear diff snapshots for ALL sessions? This may delete change comparisons other sessions have not reviewed yet, and cannot be undone.",
				"history.diffTitle": "File change comparison",
				"history.diffClose": "Close",
				"history.diffLoading": "Loading…",
				"history.diffEmpty": "No content change (or the file is unreadable)",
				"history.diffLoadFail": "Failed to load diff: ",
				"history.diffRevert": "Revert this change",
				"history.diffReverting": "Sending…",
				"history.diffRevertDone": "Revert instruction sent",
				"history.diffRevertSent": "Revert instruction sent to the conversation; the AI will restore the file accordingly",
				"history.diffRevertFail": "Send failed: ",
				"history.diffNoSnapshot": "This event has no snapshot for that file",
				"history.diffChipTitle": "View this file’s change comparison",
				"history.diffStats": "+%a / -%r lines changed · %c unchanged",
				"history.diffGone": " (file no longer exists)",
				"history.diffHidden": "%n unmodified lines",
				"card.dryRun": "Rule test",
				"card.dryRunHint": "Judge one call against the rules in force. Runs no tool and writes no rule — check a rule here before you change it.",
				"card.dryRunTool": "Tool",
				"card.dryRunCommand": "Command / arguments",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Test",
				"card.dryRunRunning": "Judging…",
				"card.dryRunEmpty": "Nothing tested yet. Fill in a tool and command, then press Test to see how it would be judged.",
				"card.dryRunVerdict": "Verdict",
				"card.dryRunAllow": "allow",
				"card.dryRunAsk": "ask",
				"card.dryRunDeny": "deny",
				"card.dryRunRule": "Matched rule",
				"card.dryRunRuleNone": "no rule matched; defaultAction: %d",
				"card.dryRunDimensions": "Dimensions",
				"card.dryRunReason": "Reason",
				"card.dryRunNote": "\"Matched rule\" comes from the rule layer. When the verdict was produced by an earlier hard-deny or by the keyword blacklist there is no rule index — the dimensions listed are then informational only.",
				"card.dryRunNoRules": "(0 rules loaded — check the rulesFile path)",
				"card.dryRunFail": "Test failed: ",
				"card.dryRunStale": "route missing (plugin not restarted?)",
				"card.rules": "Settings Built-in Rules",
				"card.rulesHint": "The rules the gate is loading right now (from this plugin entry's `rules` config field; falls back to the rules file when unset). Read-only — nothing here can change them. To change rules, use the allowlist below or edit them on the settings page.",
				"card.rulesRefresh": "Refresh",
				"card.rulesLoading": "Reading…",
				"card.rulesPath": "Source",
				"card.rulesNone": "no rules configured",
				"card.rulesCounts": "Rules",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b bytes · %l lines",
				"card.rulesMissing": "Rules not found. The gate falls back to its built-in defaults.",
				"card.rulesTruncated": "Rules are large; showing the first 512 KB only.",
				"card.rulesError": "Load failed: ",
				"card.rulesStale": "route missing (plugin not restarted?)",
				"card.rulesNote": "Read-only: this panel cannot modify the rules. The allowlist section and \"allow always\" write back to this plugin's entry config.",
				"doubt.no-rule": "no rule covers this call, so the default is to ask — that does not mean it is dangerous",
				"doubt.opaque": "the payload cannot be read (encoded, a script outside the workspace, or no recognisable program), so no rule can locate its target",
				"doubt.irreversible": "a rule says this is irreversible: it cannot be undone once run",
				"doubt.never-learn": "this answer will not be learned; the same call will ask again next time",
				"doubt.delete": "it deletes content",
				"doubt.remote-write": "it has an externally visible effect (push / publish / write request); undoing it takes extra manual steps",
				"doubt.exec-external": "it runs code from outside the workspace, which this call cannot inspect",
				"doubt.outside-paths": "it touches paths outside the workspace",
				"doubt.model-flagged": "the risk model flagged it (it can only escalate, never clear)",
				"doubt.write": "it writes or modifies files",
				"verdict.rule": "Rule matched",
				"verdict.grant": "Session grant",
				"verdict.hard-deny": "Hard deny",
				"verdict.deny-keyword": "Denylist keyword",
				"verdict.default": "Default policy",
				"verdict.ask": "Default policy",
				"verdict.permissive": "Auto-reviewed allow",
				"verdict.classifier": "LLM verdict",
				"verdict.llm-safe": "LLM judged safe",
				"verdict.llm-learned": "LLM learned allow",
				"verdict.learned-sediment": "Settled-rule allow",
				"verdict.learned-confirm": "Learning confirm",
				"verdict.human-approved": "Approved by human",
				"verdict.human-rejected": "Rejected by human",
				"verdict.human-cancelled": "Cancelled by human",
				"verdict.no-approval-channel": "No approval channel",
				"verdict.preset-passthrough": "Policy never · allowed",
				"verdict.stand-down": "Gate inactive",
				"verdict.yolo-allow": "YOLO allow",
				"verdict.yolo-allow-no-reviewer": "YOLO allow (no reviewer · mechanical)",
				"verdict.yolo-block": "YOLO block",
				"verdict.rules-fallback-allow": "Model-free rule gate allow",
				"verdict.rules-fallback-block": "Model-free rule gate block",
				"verdict.safety-net-passthrough-allow": "Mechanical review allow (zero-model)",
				"verdict.safety-net-passthrough-block": "Mechanical review block (zero-model)",
				"verdict.cleanup-safe": "Cleanup safe allow",
				"verdict.escalation-auto": "Sandbox escalation auto-allow",
				"verdict.learned-granted": "Learned grant allow",
				"verdict.network-ask": "Network approval",
				"card.scopeUnresolved": " (scope unresolved — diagnostic placeholder)"
			},
			ja: {
				"card.title": "自动审查（自動審査）ティア",
				"section.title": "自動審査ゲート",
				"card.description": "read-only / full-access / whitelist と並ぶ独立の承認モード。セッション権限ピッカーでは「自动审查」と表示されます。フロントは単一スイッチのみ。バックエンドの 4 つの承認戦略はこのパネルで組み合わせ可能で、P0 ハード拒否に対して依然 fail-closed。",
				"card.permissive": "自动审查ティアを有効化",
				"card.permissiveHint": "オフのときは以前と完全に同じ動作です。",
				"card.unattended": "無人確認ティア",
				"card.unattendedHint": "スイッチは三つ。それぞれ脇に書いたティアだけを制御します。実装をオフにするとそのティアは通常の人確認に戻り、別のティアに化けることはありません。",
				"card.mode.ask": "人手確認を残す",
				"card.mode.pass": "機械直通",
				"card.askHint": "機械スクリーニングは引き続き危険を絞り疑点を列挙しますが、確認は人に残り審査モデルは一度も呼びません — 審査 LLM 未接続、またはトークンを費やさない運用の形です。",
				"card.passHint": "決定論的な機械審査器のみを実行：不可逆 / 復元不能 / 読めない処理を検知したら遮断して理由を主モデルへ返し、それ以外は実行します。モデル呼び出しゼロ・人手確認なし。approval: never の審査付き版であり、LLM を外した YOLO の劣化形態でもあります。",
				"card.testing": "テストと診断",
				"card.lists": "許可・ブロックリスト",
				"card.credentials": "資格情報の保護",
				"card.networkOps": "ネットワークとホットリロード",
				"card.summaryOn": "オン",
				"card.summaryOff": "オフ",
				"card.summaryNone": "なし",
				"card.summaryStrategies": "%n 件有効",
				"card.summaryLists": "許可 %a · ブロック %d",
				"card.summaryCredRw": "readwrite: %n ファミリー",
				"card.summaryNetwork": "ネットワーク %net · ホットリロード %w",
				"card.denylistPresetCollapse": "内蔵語（%n）",
				"card.denylistCustom": "カスタム語",
				"card.yolo": "YOLO — 人工確認は決して求めない：危険のみ遮断、他は実行",
				"card.yoloExempt": "YOLO：ワークスペース内の「場所不明」も許可",
				"card.yoloExemptHint": "YOLO 専用。オンのとき、対象の「場所」が特定できないだけの呼び出し（引数なしのツール、本文を読めていない外部スクリプト）は「見えない」としては遮断しません。エンコードされたペイロード、読めないスクリプト本文、削除・リモート書込みは従来通り遮断し、P0/資格情報/不可逆は一切変わりません。",
				"card.yoloHint": "復元不能 / 学習不能 / 読解不能なペイロード、またはモデルの重リスク判定を遮断し、理由を「工具審核意見」メッセージでメイン LLM に返します。それ以外は実行されます。レビューモデルが無い場合は決定論的ネットのみが機能します。",
				"card.rulesFallback": "モデル不在時はルールゲートへ劣化（cc-safety-net 級）",
				"card.rulesFallbackHint": "レビューモデルが未設定、または判定を返せなかったときだけ発効します。決定論的ルールが名指しできる危険を遮断し、残りは通します。誰も答えない確認画面で処理を止めないためです。モデルが答えている間は挙動は変わりません。",
				"card.allowProtectedBranchPush": "保護ブランチへの force push を許可（既定オフ＝床を維持）",
				"card.allowProtectedBranchPushHint": "既定では main/master/production/release/stable を狙った git push --force/--force-with-lease/--delete を P0 床で確定遮断します（モデルで降格不可）。オンにすると床が退き、ブラックリストの3つの扁平 push 語も免除されます。呼び出しはプリセット git.push-force（人間確認が必要）に落ち、該当エントリを取り消すか許可リストに入れるまで毎回確認します。他の面は広がりません：削除・リダイレクト・認証情報の床はそのまま。",
				"card.credFamily": "認証情報ファミリーの階段",
				"card.credFamilyHint": "ファミリーごとに1段：deny=読み書きとも遮断；ask=読みは人間確認（既定）；readonly=読み通過、書き/削除はP0で確定遮断のまま；readwrite=このファミリーの認証情報ストア書き込み判据のみ退く（npm login 系）。その他の床（ルートディスク・保護パス・.dsh・外部送信）はどの段でも動かさない。段の状態はルール文書の条目と書き込み免除リストの2箇所に置かれ、本カードが対で書き戻す。",
				"card.credFamilyLoading": "認証情報の段を読み込み中…",
				"card.credFamilyFootnote": "無人運用モード（機械直通/YOLO）では確認残局がそのまま通ります。硬く止めるには deny を選択してください。カスタム credentialPaths は書き込み免除に参加しません。",
				"card.credReadwriteConfirm": "readwrite はこの種の認証情報ファイルへの書き込み/変更を許可します（~/.npmrc の上書きなど）。P0 の一部を退かす唯一の段です。確認しますか？",
				"card.credConfirmYes": "確認",
				"card.credConfirmNo": "キャンセル",
				"card.credRung.deny": "遮断",
				"card.credRung.ask": "確認",
				"card.credRung.readonly": "読取のみ",
				"card.credRung.readwrite": "読み書き",
				"card.scriptReview": "スクリプト本文をレビューに添付（既定はオン）",
				"card.scriptReviewHint": "呼び出しがスクリプトファイルを実行するとき、その本文を読み取り、レビューモデルと人が同じコードを見ます。決定論的ネットも本文を評価します（ファイル名からは見えない削除がまさに通過していた箇所）。送出前に秘匿化と長さ制限を実施。オフにするとファイル内容が外部へ出ませんが、ワークスペース外のスクリプトは「読解不能」ティアに戻ります。",
				"card.credentialPaths": "カスタム認証情報パス（長尾）",
				"card.autoAllowTools": "自動許可ツール（確認もレビューもスキップ）",
				"card.autoAllowToolsHint": "リストのツール名は read/grep と同格：ポップアップもモデルレビューもスキップされますが、P0 の強制拒否とパスルールは有効です。自作プラグインが登録する安全なツール名用に。",
				"card.autoAllowToolsPlaceholder": "ツール名、例 my_safe_tool",
				"card.credentialPathsHint": "内蔵リスト外の機密ファイル。書き方はパス glob：双アスタリスクはディレクトリを横断、単アスタリスクとはてなは 1 段内。ワイルドカードなしならパス断片として一致（token は ambient.txt に掛からない）。先頭の ~/ は home に展開、相対指定は任意の深さでも一致（secrets/*.env は a/b/secrets/prod.env を覆う）。該当すれば .ssh と同格：ワークスペース外からの読み取りもファイルツールでの書き換えも強制拒否——このティアは異議申立て、レビューモデルの通過も不可なので、本当に守るべきパスだけを宣言してください。",
				"card.credentialPathsPlaceholder": "新しいパス、例：~/.myco/vault.token または secrets/*.env",
				"card.denyKeywordsExtra": "ブラックリスト追加キーワード（プリセットを置き換えない）",
				"card.denyKeywordsExtraHint": "自社 CLI の取消し／消去サブコマンドや自社トークン接頭語など、自分の語彙に決定論的な遮断を一段足します。ここは追加のみ：上のブラックリストがプリセットでも自分で置き換えたものでも、これらの語はマージされます。",
				"card.listRemove": "この項目を削除",
				"card.extraContentArgKeys": "追加のドキュメントキー（操作として読ませない）",
				"card.extraContentArgKeysHint": "内蔵リスト（content/text/plan…）外のドキュメント項目名。追加すると、その文言は危険語と認証情報の平坦スキャンに入らなくなります。追加専用で内蔵表は置き換えません——内蔵キーを一つ落とすと「計画書を書いたという理由で拒否される」不具合が静かに復活します。実行されるコマンド自体と書き換えられるパスはそれぞれの判別経路なので、この表では無効化できません。",
				"card.extraContentArgKeysPlaceholder": "新しい引数名、例：steps",
				"card.extraOperationArgKeys": "追加の操作キー（その項目を実行されるコードとして読む）",
				"card.extraOperationArgKeysHint": "本文が実際に実行される項目（workflowYaml など）用の出口です。その文言はブラックリストと認証情報スクリーンに入り、上の表と同名ならこちらが勝ちます。代償：本物のドキュメント項目を指定すると、「計画に rm -rf と書いた」ことが再び拒否理由になります。",
				"card.scopeNote": "プリセットスコープ: このゲートはセッションの権限プリセットが %scope のときだけ動作します。それ以外のプリセットでは P0 ハード拒否を含むゲート全体が停止し、選択されたプリセット自身のポリシーが引き継ぎます。停止時は stand-down イベントを 1 件記録し、入力欄の上に常駐表示します。",
				"card.strategies": "バックエンド承認戦略（少なくとも 1 つ有効、組み合わせ可）",
				"card.strategy.trustAutoAllow": "trustAutoAllow — スコープ内の安全操作は自動許可、危険/不明は ask（中間ティアのベースライン）",
				"card.strategy.alwaysConfirm": "alwaysConfirm — すべて ask。承認パネルの「許可コントロール」に2つの拡張ボタン：「このセッションで当該種別を繰り返し許可」（セッション限次 grant）と「すべての発生を許可」（コマンド語を rulesFile の許可リストへ永続化）",
				"card.strategy.llmAssist": "llmAssist — カスタム LLM がリスクを判定：safe は自動許可、deletion/credential/remote/system/bulk のハードリスクは人手確認を維持（分類器は決して拒否せず、判断をエスカレートするだけ）、neutral は確認学習へ、失敗/タイムアウトは人手にフォールバック",
				"card.strategy.trustEscalation": "trustEscalation — サンドボックス昇格を確認なしで許可：本ゲートが既に許可した呼び出しについて、shell / pwsh / edit がツール内部から要求するサンドボックス拡張をゲートが承認し、プロンプトを出しません",
				"card.strategy.trustEscalationHint": "サンドボックス昇格の承認要求は tools/pre-execute の後、ツール本体の内部で発行されるためゲートには見えず、LLM が safe と判定して自動許可した呼び出しでも拡張の承認を求められていました。オンにすると、ゲートが実際に許可した同一呼び出し（callId で厳密一致）だけがプロンプトを省略し、それ以外は従来どおり人手に回ります。理由を認識できない場合や対象が workspace-write / danger-full-access 以外の場合も同様です。オフにすると拡張は常に人手の判断となります。",
				"card.readonly": "読み取り専用",
				"card.unavailable": "設定名前空間が利用できません：dsh-perm-gate がこの profile に組み込まれているか確認してください。",
				"card.llmReceiver": "llmAssist 受信 LLM（OpenAI 互換、カスタム API 可）",
				"card.llmEndpoint": "Endpoint（BaseURL、例：https://api.openai.com/v1）",
				"card.llmModel": "Model（モデル id、例：deepseek-chat）",
				"card.llmEffort": "推論強度（host モードのみ）",
				"card.llmEffortHost": "ホスト既定に従う",
				"card.llmEffortHint": "空 = 指定せずホストのモデル設定に任せる。ホストに拒否されたら low か off に変更。",
				"card.llmKey": "API Key（機密）",
				"card.llmKeyHidden": "未設定・初回入力後は * 表示",
				"card.llmKeyMasked": "設定済み・新しい値を入力すると上書き",
				"card.llmKeyOverwrite": "機密値が保存されています。新しい値を入力してフォーカスを外すと上書きします。",
				"card.llmKeyClear": "クリア",
				"card.allowlist": "許可リスト（allow、rulesFile と同期）",
				"card.allowlistHint": "allow セクションに一致したパターンは直接許可。1 件ずつ追加・削除でき、rulesFile に即時書き込み＆再読込します。",
				"card.allowlistPresetNote": "プリセット許可リストの等価物は trustAutoAllow 戦略（スコープ内の安全操作を自動許可）で、上の戦略セクションで有効化します。このリストは rulesFile の allow を反映するため、初期は空で正常です。",
				"card.allowlistEmpty": "許可ルールはありません",
				"card.allowlistPlaceholder": "新しいコマンドパターン、例：npm test*",
				"card.allowlistAdd": "追加",
				"card.allowlistRemove": "このパターンを削除",
				"card.allowlistBulk": "一括編集",
				"card.allowlistBulkHide": "一括編集を閉じる",
				"card.allowlistSave": "許可リストを保存",
				"card.riskLearning": "riskLearning — 裁決学習：neutral リスク操作が人手で承認され実行されるとカウントし、しきい値到達後は同一操作（指紋一致）のみ自動許可",
				"card.riskLearningHint": "学習状態はプラグイン所有（$DSH_HOME/perm-gate/learning.json）で、YAML ルールには書き込みません。別の対象は決して権限を再利用しません。既定はオフ。",
				"card.riskThreshold": "自動許可に必要な人手確認回数（1–10）",
				"notice.label": "権限ゲートの活動",
				"history.label": "承認記録",
				"history.title": "権限承認記録",
				"history.subtitle": "このセッションでのゲート判定のすべて（新しい順）",
				"history.loading": "読み込み中…",
				"history.empty": "このセッションにはまだ承認記録がありません",
				"history.error": "読み込み失敗：",
				"history.tag.auto": "自動許可",
				"history.tag.ask": "人手へ",
				"history.tag.deny": "拒否",
				"card.denylistRestore": "プリセットの拒否キーワードに戻す",
				"card.denylist": "拒否キーワード（deny、プリセット）",
				"card.denylistHint": "キーワード（大小文字を区別しない部分一致）を含む呼び出しは、許可リスト / 許可 / LLM より先に拒否されます。プリセットは dsh-approval-gate から継承し、導入直後から有効。空または未設定ならプリセットを適用（ワンクリック復元対応）し、黑名単が静かに無効化されることはありません。",
				"card.denylistEmpty": "拒否キーワードは空です（キーワード層で拒否される呼び出しはありません）",
				"card.denylistPlaceholder": "新しいキーワード、例：drop database",
				"card.denylistAdd": "追加",
				"card.denylistRemove": "このキーワードを削除",
				"card.denylistTagPreset": "プリセット",
				"card.denylistTagCustom": "カスタム",
				"card.riskSediment": "riskSediment — 学習沈殿：しきい値に達したサンプルが決定論的な自動許可ルールに",
				"card.riskSedimentHint": "オンにすると、tool|category キーの確認がしきい値に達した時点でサンプル指紋が許可ルールとして沈殿します。同一ツール・同一ターゲットの正確一致は LLM を経由せず自動許可（llmAssist オフでも継続）。",
				"card.sediment": "学習沈殿（決定論的許可ルール）",
				"card.sedimentHint": "人手確認から沈殿したルール：指紋が正確に一致したときのみ許可。別の対象は決して再利用しません。学習の終止やサンプル削除ができます。",
				"card.learningScope": "学習データのスコープ",
				"card.learningScopeGlobal": "グローバル（既定）",
				"card.learningScopeSession": "セッション単位",
				"card.learningScopeHint": "グローバル：いずれかのセッションで確認された操作が全セッションの基準を下げます（従来の動作）。セッション単位：そのセッション自身の確認だけを数え、既存のグローバル規則は沈殿リストで明示的に昇格するまで無効です。",
				"attention.title": "承認の通知",
				"attention.hint": "確認要求が届いたときの通知方法。2 つのスイッチは独立しています。既定では決定バーのみ表示（従来どおり）、サウンドを有効にすると会話を見ていなくても聞こえます。",
				"attention.toast": "決定バーを表示",
				"attention.sound": "サウンド",
				"attention.gap": "同一セッションの最短間隔（ミリ秒）",
				"attention.test": "試聴",
				"card.sedimentEmpty": "沈殿ルールはまだありません（しきい値に達したサンプルがここに表示されます）",
				"card.sedimentCount": "確認済み %n/%t",
				"card.sedimentStop": "終止",
				"card.sedimentStopTitle": "この学習を終止する（カウントとサンプルを削除）",
				"card.sedimentStopConfirm": "「%k」の学習を終止しますか？カウントと全サンプルを削除します。",
				"card.sedimentSampleRemove": "この沈殿サンプルを削除",
				"card.llmSource": "受信 LLM のソース",
				"card.llmSourceCustom": "カスタム API（OpenAI 互換）",
				"card.llmSourceHost": "セッションの現在の既定モデルを使用（DSH llm サービス）",
				"card.llmSourceHostHint": "既定では DSH セッションで現在选择中のモデルグループで審査判定を実行します（下に現在の実効値を表示）。Provider / Model を空のままにするとセッションに追従し、ドロップダウンから選ぶか手入力で固定できます——DSH で設定したカスタムグループ（例：local-35b）は自動的にリストに現れます。",
				"card.llmProvider": "Provider（空 = セッションの現在の選択に追従）",
				"card.llmProviderPlaceholder": "セッションの現在の選択に追従",
				"card.llmModelHostPlaceholder": "空 = セッションの現在の選択に追従",
				"card.llmResolved": "現在の実効値：%p / %m",
				"card.llmPreset": "プリセットエンドポイント（選択で自動入力、後から編集可）",
				"card.llmPresetChoose": "プリセットを選択…",
				"card.llmPresetPublic": "公開 API プリセット",
				"card.llmPresetHost": "DSH モデルグループ（選択するとセッション受信へ切替）",
				"card.networkEnabled": "ネットワーク傍受（networkEnabled）",
				"card.networkEnabledHint": "オンにするとローカルプロキシが起動し、サブプロセスの送信接続を傍受して許可/拒否ルールを適用します。オフにすると動作変更なし。",
				"card.watch": "ルールホットリロード（watch）",
				"card.watchHint": "オンにするとルールファイルの変更を自動監視し、手動リロードなしで即座に反映されます。",
				"card.networkRebindNote": "切り替えは即時反映されます（自動で再バインド、プラグイン再読み込み不要）。",
				"card.networkInjectEnv": "プロキシ環境変数の注入（networkInjectEnv）",
				"card.networkInjectEnvHint": "サブプロセスに HTTP(S)_PROXY / ALL_PROXY を書き込みます（NO_PROXY はクリア）。オフの場合はリスナーのみ起動し、プロセス環境は変更しません。",
				"card.healthStale": "ホストルートが利用できません（404）——node 側が旧ビルドです。ページ再読み込みだけでなく dsh を完全に再起動してから再試行してください。",
				"card.healthTest": "健全性テスト",
				"card.healthRunning": "テスト中…",
				"card.healthOk": "正常（%ms ms）",
				"card.healthFail": "失敗：",
				"history.tag.learned": "学習済み",
				"history.tag.manualApproved": "人手承認",
				"history.tag.manualRejected": "人手拒否",
				"history.tag.manualCancelled": "人手キャンセル",
				"history.tag.standDown": "ゲート停止",
				"history.learnedProgress": "学習 %n/%t",
				"history.snapshots": "diff スナップショット",
				"history.clearSession": "このセッションのみ削除",
				"history.clearAll": "すべて削除",
				"history.clearSessionTitle": "このセッションの diff スナップショットのみ削除（他のセッションは対象外）",
				"history.clearAllTitle": "全セッション（未確認のものも含む）の diff スナップショットを削除。再確認あり",
				"history.clearSessionConfirm": "このセッションの diff スナップショットを削除しますか？本セッションの承認で生成された変更比較データのみを削除し、承認記録自体には影響しません。",
				"history.clearAllConfirm": "【全セッション】の diff スナップショットを削除しますか？他のセッションがまだ確認していない変更比較も削除され、復元できません。",
				"history.diffTitle": "ファイル変更の比較",
				"history.diffClose": "閉じる",
				"history.diffLoading": "読み込み中…",
				"history.diffEmpty": "内容の変更なし（またはファイルを読み取れません）",
				"history.diffLoadFail": "diff の読み込みに失敗：",
				"history.diffRevert": "この変更を元に戻す",
				"history.diffReverting": "送信中…",
				"history.diffRevertDone": "取り消し指示を送信しました",
				"history.diffRevertSent": "取り消し指示を会話に送信しました。AI が指示に従ってファイルを復元します",
				"history.diffRevertFail": "送信に失敗：",
				"history.diffNoSnapshot": "このイベントには該当ファイルのスナップショットがありません",
				"history.diffChipTitle": "このファイルの変更比較を表示",
				"history.diffStats": "+%a / -%r 行変更 · %c 行は未変更",
				"history.diffGone": "（ファイルは現在存在しません）",
				"history.diffHidden": "%n 行は未変更",
				"card.dryRun": "ルールテスト",
				"card.dryRunHint": "現在有効なルールで 1 回の呼び出しを判定します。ツールは実行せず、ルールも書き換えません。ルールを変更する前にここで確認してください。",
				"card.dryRunTool": "ツール名",
				"card.dryRunCommand": "コマンド / 引数",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "テスト",
				"card.dryRunRunning": "判定中…",
				"card.dryRunEmpty": "まだテストしていません。ツール名とコマンドを入力し「テスト」を押すと、どう判定されるか確認できます。",
				"card.dryRunVerdict": "判定",
				"card.dryRunAllow": "許可",
				"card.dryRunAsk": "要確認",
				"card.dryRunDeny": "拒否",
				"card.dryRunRule": "一致したルール",
				"card.dryRunRuleNone": "一致するルールなし。defaultAction：%d",
				"card.dryRunDimensions": "制約次元",
				"card.dryRunReason": "理由",
				"card.dryRunNote": "「一致したルール」はルール層の結果です。判定がより前段のハード拒否やキーワードブラックリストによる場合、ルール番号はありません——その場合の次元表示は参考情報です。",
				"card.dryRunNoRules": "（読み込まれたルールは 0 件：rulesFile のパスを確認してください）",
				"card.dryRunFail": "テスト失敗：",
				"card.dryRunStale": "ルートが存在しません（プラグイン未再起動？）",
				"card.rules": "Settings 組み込みルール",
				"card.rulesHint": "ゲートが今読み込んでいるルール（本プラグインエントリの rules 設定フィールドから。未設定時はルールファイルにフォールバック）。読み取り専用 — 変更するには下の許可リストか設定ページを使ってください。",
				"card.rulesRefresh": "再読み込み",
				"card.rulesLoading": "読み込み中…",
				"card.rulesPath": "ソース",
				"card.rulesNone": "ルールが設定されていません",
				"card.rulesCounts": "ルール",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b バイト · %l 行",
				"card.rulesMissing": "ルールが存在しません。ゲートは組み込みの既定値にフォールバックします。",
				"card.rulesTruncated": "ルールが大きいため、先頭 512 KB のみ表示します。",
				"card.rulesError": "読み込みに失敗しました：",
				"card.rulesStale": "ルートが存在しません（プラグイン未再起動？）",
				"card.rulesNote": "読み取り専用：このパネルからルールは変更できません。許可リストと「常に許可」は本プラグインのエントリ設定に書き戻されます。",
				"doubt.no-rule": "この呼び出しを覆うルールがなく、既定で人間に委ねました — 危険という意味ではありません",
				"doubt.opaque": "ペイロードを読み取れません（エンコード済み / ワークスペース外スクリプト / プログラム名不明）、ルールは対象を特定できません",
				"doubt.irreversible": "ルール上 不可逆：実行後は取り消せません",
				"doubt.never-learn": "この承認は学習されません。次回も同じ確認が出ます",
				"doubt.delete": "内容を削除します",
				"doubt.remote-write": "外部から見える変更（push / publish / 書き込みリクエスト）が発生し、取り消しに手作業が必要",
				"doubt.exec-external": "ワークスペース外のコードを実行します。この呼び出しでは内容を抜き取れません",
				"doubt.outside-paths": "ワークスペース外のパ스에接触します",
				"doubt.model-flagged": "风险モデルが疑わしいと判定（エスカレートののみ可能、クリアは不可）",
				"doubt.write": "ファイルを書き込みまたは変更します",
				"verdict.rule": "ルール適用",
				"verdict.grant": "セッション承認",
				"verdict.hard-deny": "強制拒否",
				"verdict.deny-keyword": "拒否リストのキーワード",
				"verdict.default": "既定ポリシー",
				"verdict.ask": "既定ポリシー",
				"verdict.permissive": "自動審査で許可",
				"verdict.classifier": "LLM 判定",
				"verdict.llm-safe": "LLM が安全と判定",
				"verdict.llm-learned": "LLM 学習で許可",
				"verdict.learned-sediment": "定塁ルールで許可",
				"verdict.learned-confirm": "学習の確認",
				"verdict.human-approved": "人が承認",
				"verdict.human-rejected": "人が拒否",
				"verdict.human-cancelled": "人が取消",
				"verdict.no-approval-channel": "承認経路なし",
				"verdict.preset-passthrough": "承認ポリシー never · 許可済み",
				"verdict.stand-down": "ゲート停止中",
				"verdict.yolo-allow": "YOLO 許可",
				"verdict.yolo-allow-no-reviewer": "YOLO 許可（レビュー模型なし·機械処理）",
				"verdict.yolo-block": "YOLO 遮断",
				"verdict.rules-fallback-allow": "モデルなしルールゲートで許可",
				"verdict.rules-fallback-block": "モデルなしルールゲートで遮断",
				"verdict.safety-net-passthrough-allow": "機械審査で許可（モデルなし）",
				"verdict.safety-net-passthrough-block": "機械審査で遮断（モデルなし）",
				"verdict.cleanup-safe": "クリーンアップ系で安全許可",
				"verdict.escalation-auto": "サンドボックス昇格を自動許可",
				"verdict.learned-granted": "学習承認で許可",
				"verdict.network-ask": "ネットワーク承認",
				"card.scopeUnresolved": "（scope 未解決 — 診断用プレースホルダー）"
			},
			ko: {
				"card.title": "自动审查(자동 검토) 티어",
				"section.title": "자동 검토 게이트",
				"card.description": "read-only / full-access / whitelist와 나란한 독립 승인 모드. 세션 권한 선택기에서는 「自动审查」로 표시됩니다. 프론트는 단일 스위치만 노출. 백엔드의 네 가지 승인 전략은 이 패널에서 조합 가능하며 P0 하드 거부에 대해 여전히 fail-closed.",
				"card.permissive": "自动审查 티어 활성화",
				"card.permissiveHint": "꺼져 있으면 이전과 완전히 동일하게 동작합니다.",
				"card.unattended": "무인 등급",
				"card.unattendedHint": "스위치는 셋, 각자 옆에 적힌 등급만 제어합니다. 구현을 끄면 그 등급은 보통의 사람 확인으로 돌아가며, 다른 등급으로 몰래 바뀌지 않습니다.",
				"card.mode.ask": "사람 확인 유지",
				"card.mode.pass": "기계 직통과",
				"card.askHint": "기계 선별로 위험을 걸러 내고 의문점을 적지만, 확인은 그대로 사람에게 남고 심사 모델은 한 번도 부르지 않습니다 — 심사 LLM 미연결이나 토큰을 아끼는 운용에 맞는 형태입니다.",
				"card.passHint": "결정론적 기계 심사기만 실행：되돌릴 수 없음 / 복원 불가 / 읽히지 않는 처리를 감지하면 차단하고 이유를 주모델에 되돌려 보내며, 나머지는 실행합니다. 모델 호출 0회·사람 확인 없음. approval: never 의 심사판이며, LLM 을 뺀 YOLO 의 열화된 형태이기도 합니다.",
				"card.testing": "테스트 및 진단",
				"card.lists": "허용·차단 목록",
				"card.credentials": "자격 증명 보호",
				"card.networkOps": "네트워크 및 핫 리로드",
				"card.summaryOn": "켜짐",
				"card.summaryOff": "꺼짐",
				"card.summaryNone": "없음",
				"card.summaryStrategies": "%n개 활성",
				"card.summaryLists": "허용 %a · 차단 %d",
				"card.summaryCredRw": "readwrite: %n개 패밀리",
				"card.summaryNetwork": "네트워크 %net · 핫 리로드 %w",
				"card.denylistPresetCollapse": "내장 키워드(%n)",
				"card.denylistCustom": "사용자 지정 키워드",
				"card.yolo": "YOLO — 사람 확인은 절대 요구하지 않음: 위험만 차단하고 나머지는 실행",
				"card.yoloExempt": "YOLO: 워크스페이스 내 “위치 불명”도 허용",
				"card.yoloExemptHint": "YOLO 전용. 켜면 대상의 “위치”만 확인할 수 없는 호출(인자 없는 도구, 본문을 읽지 못한 외부 스크립트)은 “보이지 않음”으로 차단하지 않습니다. 인코딩된 페이로드, 읽을 수 없는 스크립트 본문, 삭제·원격 쓰기는 계속 차단되며 P0/자격 증명/비가역 작업은 전혀 바뀌지 않습니다.",
				"card.yoloHint": "복구 불가 / 학습 불가 / 해석 불가 페이로드, 또는 모델이 위험 판정을 내리면 차단하고 이유를 「工具审核意见」 메시지로 메인 LLM에 알려합니다. 나머지는 그대로 실행됩니다. 검토 모델이 없으면 결정론적 규칙망만 작동합니다.",
				"card.rulesFallback": "모델이 없을 때 규칙 게이트로 강등 (cc-safety-net 급)",
				"card.rulesFallbackHint": "검토 모델이 설정되지 않았거나 판정을 내리지 못했을 때만 발동합니다. 결정론적 규칙이 식별한 위험은 차단하고 나머지는 통과시켜, 아무도 응답하지 않는 확인 창에 호출을 대기시키지 않습니다. 모델이 정상 응답하는 동안에는 동작이 변하지 않습니다.",
				"card.allowProtectedBranchPush": "보호 브랜치 force push 허용 (기본 꺼짐 = 바닥 유지)",
				"card.allowProtectedBranchPushHint": "기본에서 main/master/production/release/stable 을 노린 git push --force/--force-with-lease/--delete 를 P0 바닥으로 확정 차단합니다(모델로 강등 불가). 켜면 바닥이 물러나고 블랙리스트의 세 평면 push 키워드도 면제됩니다. 호출은 프리셋 git.push-force(사람 확인 필요) 규칙으로 떨어져, 해당 항목을 취소하거나 허용 목록에 넣기 전엔 매번 확인합니다. 다른 면은 넓어지지 않습니다: 삭제·리다이렉트·자격증명 바닥은 그대로.",
				"card.credFamily": "자격증명 계열 사다리",
				"card.credFamilyHint": "계열별 한 칸: deny=읽기·쓰기 모두 차단; ask=읽기 사람 확인(기본); readonly=읽기 통과, 쓰기·삭제는 P0 확정 차단 유지; readwrite=해당 계열의 자격증명 store 쓰기 판정만 물러남(npm login 계열). 그 외 바닥(루트·보호 경로·.dsh·유출)은 어떤 칸에서도 움직이지 않습니다. 상태는 규칙 문서 항목과 쓰기 면제 목록 두 곳에 저장되며 이 카드가 한 쌍으로 함께 씁니다.",
				"card.credFamilyLoading": "자격증명 단계 로딩 중…",
				"card.credFamilyFootnote": "무인 등급(기계 직통/YOLO)에서는 ask 잔여가 통과합니다. 단단히 막으려면 deny를 선택하세요. 사용자 지정 credentialPaths는 쓰기 면제에 참여하지 않습니다.",
				"card.credReadwriteConfirm": "readwrite는 이 종 자격증명 파일의 쓰기/수정을 허용합니다(~/.npmrc 재작성 등). P0의 일부를 퇴각시키는 유일한 칸입니다. 확인하시겠습니까?",
				"card.credConfirmYes": "확인",
				"card.credConfirmNo": "취소",
				"card.credRung.deny": "차단",
				"card.credRung.ask": "확인",
				"card.credRung.readonly": "읽기 전용",
				"card.credRung.readwrite": "읽기쓰기",
				"card.scriptReview": "스크립트 본문 검토 함께 전송 (기본 켜짐)",
				"card.scriptReviewHint": "호출이 스크립트 파일을 실행하면 본문을 읽어 검토 모델과 사람이 같은 코드를 보게 하고, 결정론적 규칙도 본문을 평가합니다 (파일명으로는 위험이 보이지 않는 삭제가 바로 그 통과 지점이었습니다). 전송 전 마스킹과 길이 제한을 적용합니다. 끄면 파일 내용이 외부로 나가지 않지만, 작업 공간 외부 스크립트는 다시 해석 불가 등급이 됩니다.",
				"card.credentialPaths": "사용자 정의 자격증명 경로 (롱테일)",
				"card.autoAllowTools": "자동 허용 도구 (확인·검토 생략)",
				"card.autoAllowToolsHint": "목록의 도구 이름은 read/grep 와 동일 등급: 팝업도 모델 검토도 건너뜁니다. 다만 P0 경성 거부와 경로 규칙은 계속 적용됩니다. 직접 만든 플러그인이 등록한 안전한 도구 이름용으로 쓰세요.",
				"card.autoAllowToolsPlaceholder": "도구 이름, 예: my_safe_tool",
				"card.credentialPathsHint": "내장 목록이 모르는 비밀 파일입니다. 항목은 경로 glob: 이중 별은 디렉터리를 횡단하고 단별과 물음표는 한 단계 안에서만 동작합니다. 와일드카드가 없으면 경로 단편 전체로 일치 (token 은 ambient.txt 에 걸리지 않음). 선행 ~/ 는 home 으로 확장되고, 상대 지정은 어떤 깊이에서도 일치합니다 (secrets/*.env 는 a/b/secrets/prod.env 를 커버). 걸리면 .ssh 와 동일한 등급: 작업 공간 외부 읽기와 파일 도구 통한 변경 모두 경성 거부입니다—이 등급은 이의 제기나 검토 모델 우회가 불가능하니 정말 보호할 경로만 선언하세요.",
				"card.credentialPathsPlaceholder": "새 경로, 예: ~/.myco/vault.token 또는 secrets/*.env",
				"card.denyKeywordsExtra": "추가 블랙리스트 키워드 (프리셋을 대체하지 않음)",
				"card.denyKeywordsExtraHint": "사내 CLI 의 폐기/삭제 서브커맨드나 자체 토큰 접두사처럼 자신만의 용어에 결정론적 차단을 한 겹 더합니다. 여기는 추가만 합니다: 위의 블랙리스트가 프리셋이든 대체한 것이든 이 단어들은 병합됩니다.",
				"card.listRemove": "이 항목 삭제",
				"card.extraContentArgKeys": "추가 문서 키 (작업으로 읽지 않음)",
				"card.extraContentArgKeysHint": "내장 목록(content/text/plan…) 밖의 문서 필드명입니다. 추가하면 그 텍스트가 위험 단어 · 자격증물 평탄화 스캔에 들어가지 않습니다. 추가 전용이며 내장 표를 대체하지 않습니다 — 내장 키 하나를 빠뜨리면 『계획서를 작성했다는 이유로 거부되는』 결함이 조용히 부활합니다. 실제로 실행되는 명령과 변경되는 경로는 각자의 판정을 따르므로 이 표로는 끌 수 없습니다.",
				"card.extraContentArgKeysPlaceholder": "새 인자 이름, 예: steps",
				"card.extraOperationArgKeys": "추가 작업 키 (해당 필드를 실행되는 코드로 읽음)",
				"card.extraOperationArgKeysHint": "본문이 실제로 실행되는 필드(workflowYaml 등)를 위한 통로입니다. 텍스트가 블랙리스트와 자격증물 스크린에 들어가며 위 표와 같은 키를 지정하면 이쪽이 이깁니다. 대가: 진짜 문서 필드를 지정하면 『계획에 rm -rf 가 적혀 있다』는 다시 거부 이유가 됩니다.",
				"card.scopeNote": "프리셋 범위: 이 게이트는 세션 권한 프리셋이 %scope일 때만 동작합니다. 다른 프리셋에서는 P0 하드 거부를 포함한 게이트 전체가 정지하고, 선택된 프리셋 자체의 정책이 대신합니다. 정지 시 stand-down 이벤트가 1건 기록되고 입력창 위에 상시 표시됩니다.",
				"card.strategies": "백엔드 승인 전략(하나 이상 유효, 조합 가능)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — 범위 내 안전 작업은 자동 허용, 위험/미확인은 ask(중간 티어 기준)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — 모든 경계를 ask. 승인 패널의「허용 컨트롤」에 두 개의 확장 버튼:「이 세션에서 해당 유형 반복 허용」(세션 제한 grant) 과「모든 발생 허용」(명령어를 rulesFile 허용 목록에 영구 추가)",
				"card.strategy.llmAssist": "llmAssist — 사용자 지정 LLM이 위험을 판정: safe는 자동 허용, deletion/credential/remote/system/bulk 하드 위험은 사람 확인 유지(분류기는 결코 거부하지 않고 판단을 에스컬레이션만 합니다), neutral은 확인 학습으로, 실패/시간 초과는 사람에게 폴백",
				"card.strategy.trustEscalation": "trustEscalation — 샌드박스 승격 무확인: 이 게이트가 이미 허용한 호출에 대해 shell / pwsh / edit 이 도구 내부에서 요청하는 샌드박스 확장을 게이트가 승인하고 프롬프트를 띄우지 않습니다",
				"card.strategy.trustEscalationHint": "샌드박스 승격 승인 요청은 tools/pre-execute 이후 도구 본체 내부에서 발생하므로 게이트가 보지 못했고, LLM이 safe로 판정해 자동 허용한 호출에도 확장 승인을 물었습니다. 켜면 게이트가 실제로 허용한 동일 호출(callId 정확 일치)만 프롬프트를 건너뛰고, 나머지는 이전과 같이 사람에게 전달됩니다. 이유를 인식할 수 없거나 대상이 workspace-write / danger-full-access 가 아닌 경우도 마찬가지입니다. 끄면 확장은 항상 사람이 판단합니다.",
				"card.readonly": "읽기 전용",
				"card.unavailable": "설정 네임스페이스를 사용할 수 없습니다: dsh-perm-gate가 이 profile에 조립되었는지 확인하세요.",
				"card.llmReceiver": "llmAssist 수신 LLM (OpenAI 호환, 사용자 지정 API 가능)",
				"card.llmEndpoint": "Endpoint (BaseURL, 예: https://api.openai.com/v1)",
				"card.llmModel": "Model (모델 id, 예: deepseek-chat)",
				"card.llmEffort": "추론 강도 (host 모드 전용)",
				"card.llmEffortHost": "호스트 기본값 따름",
				"card.llmEffortHint": "비움 = 지정하지 않고 호스트 모델 설정을 따름. 호스트가 거부하면 low 나 off 로 변경.",
				"card.llmKey": "API Key (비밀)",
				"card.llmKeyHidden": "미설정 · 최초 입력 후 * 표시",
				"card.llmKeyMasked": "설정됨 · 새 값을 입력하면 덮어씀",
				"card.llmKeyOverwrite": "비밀 값이 저장되어 있습니다. 새 값을 입력하고 포커스를 벗어나면 덮어씁니다.",
				"card.llmKeyClear": "지우기",
				"card.allowlist": "허용 목록(allow, rulesFile과 동기화)",
				"card.allowlistHint": "allow 섹션과 일치하는 패턴은 바로 허용됩니다. 항목을 하나씩 추가·삭제하면 rulesFile에 즉시 기록 후 다시 적재됩니다.",
				"card.allowlistPresetNote": "프리셋 허용 목록의 등가물은 trustAutoAllow 전략(범위 내 안전 작업 자동 허용)으로, 위 전략 섹션에서 활성화합니다. 이 목록은 rulesFile의 allow를 반영하므로 초기에 비어 있는 것이 정상입니다.",
				"card.allowlistEmpty": "허용 규칙이 없습니다",
				"card.allowlistPlaceholder": "새 명령 패턴, 예: npm test*",
				"card.allowlistAdd": "추가",
				"card.allowlistRemove": "이 패턴 삭제",
				"card.allowlistBulk": "일괄 편집",
				"card.allowlistBulkHide": "일괄 편집 접기",
				"card.allowlistSave": "허용 목록 저장",
				"card.riskLearning": "riskLearning — 판정 학습: neutral 위험 요청이 사람의 승인과 실행까지 완료되면 카운트되며, 임계값 도달 후 동일 작업(지문 일치)만 자동 허용",
				"card.riskLearningHint": "학습 상태는 플러그인 소유($DSH_HOME/perm-gate/learning.json)이며 YAML 규칙에는 기록하지 않습니다. 다른 대상은 권한을 재사용하지 않습니다. 기본값은 꺼짐.",
				"card.riskThreshold": "자동 허용 전 필요한 사람 확인 횟수(1–10)",
				"notice.label": "권한 게이트 활동",
				"history.label": "승인 기록",
				"history.title": "권한 승인 기록",
				"history.subtitle": "이 세션에서 게이트가 판정한 모든 기록(최신 순)",
				"history.loading": "불러오는 중…",
				"history.empty": "이 세션에는 아직 승인 기록이 없습니다",
				"history.error": "불러오기 실패: ",
				"history.tag.auto": "자동 허용",
				"history.tag.ask": "사람에게",
				"history.tag.deny": "거부",
				"card.denylistRestore": "프리셋 블랙리스트로 복원",
				"card.denylist": "블랙리스트(deny 키워드, 플러그인 프리셋)",
				"card.denylistHint": "키워드(대소문자 구분 없는 부분 일치)를 포함한 호출은 허용 목록/권한/LLM보다 먼저 거부됩니다. 프리셋은 dsh-approval-gate에서 계승되어 설치 즉시 활성화되며, 비어 있거나 미설정이면 프리셋이 적용됩니다(원클릭 복원 지원). 블랙리스트가 조용히 꺼지는 일은 없습니다.",
				"card.denylistEmpty": "블랙리스트가 비어 있음(키워드 계층에서 거부되는 호출 없음)",
				"card.denylistPlaceholder": "새 키워드, 예: drop database",
				"card.denylistAdd": "추가",
				"card.denylistRemove": "이 키워드 삭제",
				"card.denylistTagPreset": "프리셋",
				"card.denylistTagCustom": "사용자 지정",
				"card.riskSediment": "riskSediment — 학습 침전: 임계값에 도달한 샘플이 결정론적 자동 허용 규칙으로",
				"card.riskSedimentHint": "켜면 tool|category 키의 확인이 임계값에 도달한 시점에 샘플 지문이 허용 규칙으로 침전됩니다. 동일 도구·동일 대상의 정확 일치는 LLM 없이 바로 허용(llmAssist가 꺼져도 유지).",
				"card.sediment": "학습 침전(결정론적 허용 규칙)",
				"card.sedimentHint": "사람의 확인에서 침전된 규칙: 지문이 정확히 일치할 때만 허용되며 다른 대상은 절대 재사용하지 않습니다. 학습 종료 또는 샘플 삭제가 가능합니다.",
				"card.learningScope": "학습 데이터 범위",
				"card.learningScopeGlobal": "전역(기본)",
				"card.learningScopeSession": "세션별",
				"card.learningScopeHint": "전역: 어느 세션에서든 확인된 작업이 모든 세션의 기준을 낮춥니다(기존 동작). 세션별: 해당 세션의 확인만 인정하며, 기존 전역 규칙은 침전 목록에서 명시적으로 승격하기 전까지 적용되지 않습니다.",
				"attention.title": "승인 알림",
				"attention.hint": "확인 요청이 도착했을 때의 알림 방식입니다. 두 스위치는 독립적이며, 기본값은 결정 표시줄만 표시하고(기존 동작), 소리를 켜면 대화를 보고 있지 않아도 들립니다.",
				"attention.toast": "결정 표시줄 표시",
				"attention.sound": "소리",
				"attention.gap": "세션당 최소 간격(ms)",
				"attention.test": "미리 듣기",
				"card.sedimentEmpty": "아직 침전 규칙이 없습니다(임계값에 도달한 샘플이 여기에 표시됩니다)",
				"card.sedimentCount": "확인 %n/%t",
				"card.sedimentStop": "종료",
				"card.sedimentStopTitle": "이 학습 종료(카운트와 샘플 삭제)",
				"card.sedimentStopConfirm": "'%k' 학습을 종료합니까? 카운트와 모든 샘플이 삭제됩니다.",
				"card.sedimentSampleRemove": "이 침전 샘플 삭제",
				"card.llmSource": "수신 LLM 소스",
				"card.llmSourceCustom": "사용자 지정 API(OpenAI 호환)",
				"card.llmSourceHost": "세션의 현재 기본 모델 사용(DSH llm 서비스)",
				"card.llmSourceHostHint": "기본적으로 DSH 세션에서 현재 선택한 모델 그룹으로 승인 판정을 수행합니다(아래에 실제 적용값 표시). Provider / Model을 비우면 세션 선택을 따르며, 드롭다운에서 선택하거나 직접 입력해 고정할 수 있습니다——DSH에 설정한 사용자 지정 그룹(예: local-35b)은 목록에 자동으로 나타납니다.",
				"card.llmProvider": "Provider(비움 = 세션 현재 선택 따름)",
				"card.llmProviderPlaceholder": "세션 현재 선택 따름",
				"card.llmModelHostPlaceholder": "비움 = 세션 현재 선택 따름",
				"card.llmResolved": "현재 적용: %p / %m",
				"card.llmPreset": "프리셋 엔드포인트(선택 시 자동 채움, 이후 편집 가능)",
				"card.llmPresetChoose": "프리셋 선택…",
				"card.llmPresetPublic": "공개 API 프리셋",
				"card.llmPresetHost": "DSH 모델 그룹(선택 시 세션 수신으로 전환)",
				"card.networkEnabled": "네트워크 가로채기 (networkEnabled)",
				"card.networkEnabledHint": "켜면 로컬 프록시가 시작되어 서브프로세스의 아웃바운드 연결을 가로채고 허용/거부 규칙을 적용합니다. 끄면 동작 변경 없음.",
				"card.watch": "규칙 핫 리로드 (watch)",
				"card.watchHint": "켜면 규칙 파일 변경을 자동 감시하여 수동 리로드 없이 즉시 적용됩니다.",
				"card.networkRebindNote": "전환 즉시 적용됩니다(자동 재바인딩, 플러그인 리로드 불필요).",
				"card.networkInjectEnv": "프록시 환경 변수 주입 (networkInjectEnv)",
				"card.networkInjectEnvHint": "서브프로세스에 HTTP(S)_PROXY / ALL_PROXY를 기록합니다(NO_PROXY는 비움). 끄면 리스너만 실행되고 프로세스 환경은 변경되지 않습니다.",
				"card.healthStale": "호스트 라우트를 사용할 수 없음(404)——node 측이 이전 빌드입니다. 페이지 새로고침이 아니라 dsh를 완전히 재시작한 후 다시 시도하세요.",
				"card.healthTest": "상태 테스트",
				"card.healthRunning": "테스트 중…",
				"card.healthOk": "정상(%ms ms)",
				"card.healthFail": "실패: ",
				"history.tag.learned": "학습됨",
				"history.tag.manualApproved": "사람 승인",
				"history.tag.manualRejected": "사람 거부",
				"history.tag.manualCancelled": "사람 취소",
				"history.tag.standDown": "게이트 정지",
				"history.learnedProgress": "학습 %n/%t",
				"history.snapshots": "diff 스냅샷",
				"history.clearSession": "이 세션만 삭제",
				"history.clearAll": "전체 삭제",
				"history.clearSessionTitle": "이 세션의 diff 스냅샷만 삭제(다른 세션은 그대로)",
				"history.clearAllTitle": "모든 세션(아직 확인하지 않은 것 포함)의 diff 스냅샷을 삭제. 재확인 필요",
				"history.clearSessionConfirm": "이 세션의 diff 스냅샷을 삭제합니까? 이 세션의 승인으로 생성된 변경 비교 데이터만 삭제하며 승인 기록 자체는 유지됩니다.",
				"history.clearAllConfirm": "【모든 세션】의 diff 스냅샷을 삭제합니까? 다른 세션이 아직 확인하지 않은 변경 비교도 삭제되며 복구할 수 없습니다.",
				"history.diffTitle": "파일 변경 비교",
				"history.diffClose": "닫기",
				"history.diffLoading": "불러오는 중…",
				"history.diffEmpty": "내용 변경 없음(또는 파일을 읽을 수 없음)",
				"history.diffLoadFail": "diff 불러오기 실패: ",
				"history.diffRevert": "이 변경 되돌리기",
				"history.diffReverting": "전송 중…",
				"history.diffRevertDone": "되돌리기 지시를 보냈습니다",
				"history.diffRevertSent": "되돌리기 지시를 대화로 보냈습니다. AI가 지시에 따라 파일을 복원합니다",
				"history.diffRevertFail": "전송 실패: ",
				"history.diffNoSnapshot": "이 이벤트에는 해당 파일의 스냅샷이 없습니다",
				"history.diffChipTitle": "이 파일의 변경 비교 보기",
				"history.diffStats": "+%a / -%r 행 변경 · %c 행 미변경",
				"history.diffGone": " (파일이 더 이상 존재하지 않음)",
				"history.diffHidden": "%n 행 미변경",
				"card.dryRun": "규칙 테스트",
				"card.dryRunHint": "현재 적용 중인 규칙으로 호출 한 건을 판정합니다. 도구를 실행하지 않고 규칙도 쓰지 않습니다. 규칙을 바꾸기 전에 여기서 먼저 확인하세요.",
				"card.dryRunTool": "도구 이름",
				"card.dryRunCommand": "명령 / 인수",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "테스트",
				"card.dryRunRunning": "판정 중…",
				"card.dryRunEmpty": "아직 테스트하지 않았습니다. 도구 이름과 명령을 입력하고 「테스트」를 누르면 어떻게 판정되는지 볼 수 있습니다.",
				"card.dryRunVerdict": "판정",
				"card.dryRunAllow": "허용",
				"card.dryRunAsk": "확인 필요",
				"card.dryRunDeny": "거부",
				"card.dryRunRule": "일치한 규칙",
				"card.dryRunRuleNone": "일치하는 규칙 없음, defaultAction: %d",
				"card.dryRunDimensions": "제약 차원",
				"card.dryRunReason": "이유",
				"card.dryRunNote": "「일치한 규칙」은 규칙 계층의 결과입니다. 판정이 더 앞선 하드 거부나 키워드 블랙리스트에서 나온 경우 규칙 번호가 없습니다——그때의 차원 표시는 참고용입니다.",
				"card.dryRunNoRules": "(로드된 규칙 0건: rulesFile 경로를 확인하세요)",
				"card.dryRunFail": "테스트 실패: ",
				"card.dryRunStale": "라우트가 없습니다(플러그인 미재시작?)",
				"card.rules": "Settings 내장 규칙",
				"card.rulesHint": "게이트가 지금 불러오는 규칙(이 플러그인 엔트리의 rules 설정 필드에서. 미설정 시 규칙 파일로 폴백). 읽기 전용 — 아래 허용 목록이나 설정 페이지에서 수정하세요.",
				"card.rulesRefresh": "새로 고침",
				"card.rulesLoading": "읽는 중…",
				"card.rulesPath": "소스",
				"card.rulesNone": "규칙이 설정되지 않았습니다",
				"card.rulesCounts": "규칙",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b 바이트 · %l 줄",
				"card.rulesMissing": "규칙이 없습니다. 게이트는 내장 기본값으로 대체합니다.",
				"card.rulesTruncated": "규칙이 커서 앞 512 KB만 표시합니다.",
				"card.rulesError": "불러오기 실패: ",
				"card.rulesStale": "라우트가 없습니다(플러그인 미재시작?)",
				"card.rulesNote": "읽기 전용: 이 패널은 규칙을 수정할 수 없습니다. 허용 목록과 \"항상 허용\"은 이 플러그인의 엔트리 설정에 기록됩니다.",
				"doubt.no-rule": "이 호출을 작용하는 규칙이 없어 기본 전략으로 사람에게 양도합니다 — 위험하다는 의미가 아닙니다",
				"doubt.opaque": "페이로드를 읽을 수 없음 (인코딩됨 / 작업 공간 밖 스크립트 / 프로그램명 불명) → 규칙이 대상을 특정할 수 없음",
				"doubt.irreversible": "규칙상 불가역: 실행 후 채취 불가",
				"doubt.never-learn": "이 승인은 학습되지 않습니다. 다음에도 같은 확인이 나옵니다",
				"doubt.delete": "내용을 삭제합니다",
				"doubt.remote-write": "외부에 보이는 변경(push / publish / 쓰기 요청)이 발생하며, 취소하려면 수동 작업이 필요합니다",
				"doubt.exec-external": "작업 공간 밖의 코드를 실행합니다. 이 호출에서는 내용을 확인할 수 없습니다",
				"doubt.outside-paths": "작업 공간 밖 경로에 접촉합니다",
				"doubt.model-flagged": "위험 모델이 의심됨 (증액만 가능, 해소 불가)",
				"doubt.write": "파일을 쓰거나 수정합니다",
				"verdict.rule": "규칙 적중",
				"verdict.grant": "세션 승인",
				"verdict.hard-deny": "강제 거부",
				"verdict.deny-keyword": "거부 목록 키워드",
				"verdict.default": "기본 정책",
				"verdict.ask": "기본 정책",
				"verdict.permissive": "자동 심사 허용",
				"verdict.classifier": "LLM 판정",
				"verdict.llm-safe": "LLM 안전 판정",
				"verdict.llm-learned": "LLM 학습 허용",
				"verdict.learned-sediment": "정착 규칙 허용",
				"verdict.learned-confirm": "학습 확인",
				"verdict.human-approved": "사람 승인",
				"verdict.human-rejected": "사람 거부",
				"verdict.human-cancelled": "사람 취소",
				"verdict.no-approval-channel": "승인 경로 없음",
				"verdict.preset-passthrough": "승인 정책 never · 허용됨",
				"verdict.stand-down": "게이트 비활성",
				"verdict.yolo-allow": "YOLO 허용",
				"verdict.yolo-allow-no-reviewer": "YOLO 허용(검토 모델 없음·기계 처리)",
				"verdict.yolo-block": "YOLO 차단",
				"verdict.rules-fallback-allow": "모델 없는 규칙 게이트 허용",
				"verdict.rules-fallback-block": "모델 없는 규칙 게이트 차단",
				"verdict.safety-net-passthrough-allow": "기계 심사 허용(모델 없음)",
				"verdict.safety-net-passthrough-block": "기계 심사 차단(모델 없음)",
				"verdict.cleanup-safe": "정리 작업 안전 허용",
				"verdict.escalation-auto": "샌드박스 승격 자동 허용",
				"verdict.learned-granted": "학습 승인 허용",
				"verdict.network-ask": "네트워크 승인",
				"card.scopeUnresolved": "(scope 미해석 — 진단용 자리표시자)"
			},
			fr: {
				"card.title": "Examen automatique",
				"section.title": "Porte d'examen automatique",
				"card.description": "Niveau d'approbation indépendant : parallèle à lecture seule / accès complet / liste blanche, affiché comme « Examen automatique » dans le sélecteur de permissions de session. Le front-end n'expose qu'un seul interrupteur ; les quatre stratégies d'approbation backend sont combinables via ce panneau et restent fail-closed contre le refus dur P0.",
				"card.permissive": "Activer le niveau d'examen automatique",
				"card.permissiveHint": "Lorsqu'il est désactivé, la porte se comporte exactement comme avant.",
				"card.unattended": "Modes sans supervision",
				"card.unattendedHint": "Trois interrupteurs, chacun ne régit que le palier nommé à côté : éteindre une implémentation rend ce palier au flux humain ordinaire — il ne devient jamais un autre palier en secret.",
				"card.mode.ask": "Garder l'humain",
				"card.mode.pass": "Passage mécanique",
				"card.askHint": "Le tamis mécanique filtre toujours et expose ses doutes, mais la demande reste soumise à une personne et aucun évaluateur n'est appelé — la forme qui convient quand aucun LLM relecteur n'est branché, ou quand les jetons ne valent pas la dépense.",
				"card.passHint": "N'exécute que le juge mécanique déterministe : une opération irréversible, irrécupérable ou illisible est bloquée et justifiée en retour au modèle principal, le reste s'exécute. Aucun appel de modèle, aucune demande humaine — la version examinée de approval: never, et le YOLO privé de son modèle.",
				"card.testing": "Tests et diagnostic",
				"card.lists": "Listes d'autorisation et de blocage",
				"card.credentials": "Protection des identifiants",
				"card.networkOps": "Réseau et rechargement à chaud",
				"card.summaryOn": "activé",
				"card.summaryOff": "désactivé",
				"card.summaryNone": "aucun",
				"card.summaryStrategies": "%n activées",
				"card.summaryLists": "%a en autorisation · %d en blocage",
				"card.summaryCredRw": "readwrite : %n familles",
				"card.summaryNetwork": "réseau %net · rechargement %w",
				"card.denylistPresetCollapse": "Mots-clés intégrés (%n)",
				"card.denylistCustom": "Mots-clés personnalisés",
				"card.yolo": "YOLO — ne jamais demander un humain : bloquer le dangereux, exécuter le reste",
				"card.yoloExempt": "YOLO : autoriser aussi « lieu inconnu » dans l’espace de travail",
				"card.yoloExemptHint": "Mode YOLO uniquement. Activé, un appel dont seule la « localisation » est indéterminable (outil sans argument, script hors de l’espace de travail dont le corps n’a pas été lu) n’est plus bloqué comme « invisible ». Les charges encodées, les corps illisibles, les suppressions et les écritures distantes restent bloqués ; P0, identifiants et irréversible ne changent jamais.",
				"card.yoloHint": "Bloque une charge irréversible / inapprenable / illisible, ou un verdict à risque dur du modèle, et renvoie la raison au LLM principal dans un message 工具审核意见 ; tout le reste s'exécute. Sans modèle disponible, seules les filets déterministes bloquent.",
				"card.rulesFallback": "Dégrader vers une porte à règles quand il n'y a pas de modèle (classe cc-safety-net)",
				"card.rulesFallbackHint": "Ne s'applique que lorsque le relecteur de risque n'est pas configuré ou n'a pas rendu de verdict : les filets déterministes bloquent ce qu'ils peuvent nommer et laissent passer le reste, au lieu de immobiliser l'appel sur une popup que personne ne répondra. Tant qu'un relecteur répond, le comportement est inchangé.",
				"card.allowProtectedBranchPush": "Autoriser le force-push sur les branches protégées (par défaut inactif = plancher maintenu)",
				"card.allowProtectedBranchPushHint": "Par défaut, le plancher P0 bloque git push --force/--force-with-lease/--delete visant main/master/production/release/stable (non rétrogradable par un modèle). L'activer écarte le plancher et exempte les trois mots-clés push de la liste noire ; l'appel retombe sur la règle git.push-force intégrée, qui demande toujours un humain sauf si vous révoquez cette entrée ou l'ajoutez en allowlist. Rien d'autre ne s'élargit : suppressions, redirections et le plancher d'identifiants restent armés.",
				"card.credFamily": "Escalier des familles de secrets",
				"card.credFamilyHint": "Un cran par famille : deny = lectures et écritures bloquées ; ask = lecture avec validation humaine (défaut) ; readonly = lectures libres, écritures toujours refusées par le plancher P0 ; readwrite = la clause d'écriture du store de credentials se retire pour cette famille (cas npm login). Les autres planchers (racines, chemins protégés, .dsh, exfiltration) restent armés à tout cran. L'état vit dans la ligne du document de règles plus la liste d'exemption ; la carte écrit les deux ensemble.",
				"card.credFamilyLoading": "Chargement des crans…",
				"card.credFamilyFootnote": "Les paliers sans humain (passage mécanique / YOLO) laissent passer le reliquat des ask — choisir deny pour bloquer. Les credentialPaths personnalisés ne bénéficient jamais de l'exemption d'écriture.",
				"card.credReadwriteConfirm": "readwrite autorise l'écriture/modification des fichiers de secrets de cette famille (réécriture de ~/.npmrc). Seul cran qui écarte une part du P0. Confirmer ?",
				"card.credConfirmYes": "Confirmer",
				"card.credConfirmNo": "Annuler",
				"card.credRung.deny": "bloquer",
				"card.credRung.ask": "demander",
				"card.credRung.readonly": "lecture seule",
				"card.credRung.readwrite": "lecture écriture",
				"card.scriptReview": "Joindre le contenu des scripts à la revue (activé par défaut)",
				"card.scriptReviewHint": "Quand un appel exécute un fichier script, son corps est lu et donné au modèle de risque comme à l'humain, et les filets déterministes évaluent aussi ce corps (une suppression invisible dans le nom de fichier est précisément ce qui passait). Le corps est masqué et borné avant sortie ; le désactiver garde le contenu des fichiers en local, au prix de renvoyer les scripts hors espace de travail dans le palier « illisible ».",
				"card.credentialPaths": "Chemins de credentials personnalisés (la longue traîne)",
				"card.autoAllowTools": "Outils auto-autorisés (sans demande)",
				"card.autoAllowToolsHint": "Les outils de cette liste sont traités comme read/grep : ni popup ni revue par le modèle. Le refus dur P0 et les règles de chemin s’appliquent toujours. Réservé aux noms d’outils sûrs enregistrés par vos propres plugins.",
				"card.autoAllowToolsPlaceholder": "Nom d’outil, ex. my_safe_tool",
				"card.credentialPathsHint": "Des fichiers secrets que la liste intégrée ne connaît pas. Les entrées sont des globs de chemin : une double étoile traverse les répertoires, une étoile simple et un point d'interrogation restent dans un segment ; sans joker, la correspondance se fait sur un fragment de chemin entier (token ne touchera pas ambient.txt) ; un ~/ initial se développe vers votre home ; un motif relatif correspond aussi à n'importe quelle profondeur (secrets/*.env couvre a/b/secrets/prod.env). Une correspondance est tenue au même standard que .ssh : la lecture hors espace de travail et la mutation par un outil de fichier sont refusées durablement — ce niveau n'est ni contestable ni franchissable par le relecteur, ne déclarez donc que les paths à protéger vraiment.",
				"card.credentialPathsPlaceholder": "Nouveau chemin, ex. ~/.myco/vault.token ou secrets/*.env",
				"card.denyKeywordsExtra": "Mots-clés blacklist ajoutés (ne remplace pas le prédéfini)",
				"card.denyKeywordsExtraHint": "Un blocage déterministe sur vos propres termes — une sous-commande de révocation d'un CLI interne, un préfixe de jeton qui vous est propre. Cette liste n'ajoute que des termes : quel que soit le contenu de la blacklist au-dessus (prédéfinie ou remplacée par vous), ces mots sont fusionnés.",
				"card.listRemove": "Retirer cette entrée",
				"card.extraContentArgKeys": "Clés de document ajoutées (jamais lues comme une opération)",
				"card.extraContentArgKeysHint": "Des noms de champs documentaires absents de la liste intégrée (content/text/plan…) : une fois déclarés, leur texte ne participe plus à la lecture à plat des mots dangereux et des formes d'identifiants. Purement additif : la liste intégrée ne peut pas être remplacée, car oublier une de ses clés ferait reparaître en silence le bug où un plan est refusé pour décrire une action. La commande réellement exécutée et le chemin modifié jugés par leurs propres voies, cette liste ne peut pas les éteindre.",
				"card.extraContentArgKeysPlaceholder": "Nouveau nom d'argument, ex. steps",
				"card.extraOperationArgKeys": "Clés d'opération ajoutées (lire ce champ comme du code exécuté)",
				"card.extraOperationArgKeysHint": "Un passage pour les champs dont le corps est réellement exécuté (workflowYaml etc.) : leur texte entre dans la blacklist et l'écran d'identifiants, et cette liste gagne en cas de doublon. Coût : désigner un vrai champ documentaire rend de nouveau « le plan mentionne rm -rf » motif de refus.",
				"card.scopeNote": "Portée du préréglage : cette porte n'agit que lorsque le préréglage de permission de session est %scope. Sous tout autre préréglage, la porte entière se met en veille — y compris le refus dur P0 — et la politique du préréglage sélectionné prend le relais. La mise en veille enregistre un événement et affiche une bande persistante au-dessus de la saisie.",
				"card.strategies": "Stratégies d'approbation backend (au moins une active ; combinables)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — les opérations sûres dans le périmètre sont auto-autorisées ; dangereuses/inconnues → demande (niveau intermédiaire de base)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — chaque passage demande ; les « contrôles d'autorisation » du panneau d'approbation ajoutent deux boutons étendus : « répéter l'autorisation pour ce type cette session » (grant borné de session) et « autoriser toutes les occurrences » (persistance du mot de commande dans la liste blanche rulesFile)",
				"card.strategy.llmAssist": "llmAssist — un LLM personnalisé évalue le risque : safe → auto-autorisation ; deletion/credential/remote/system/bulk → risques durs maintiennent la demande humaine (le classifieur ne refuse jamais — il ne fait qu'escalader) ; neutral → apprentissage par confirmation ; échec/timeout → retour à l'humain",
				"card.strategy.trustEscalation": "trustEscalation — escalade sandbox sans invite : pour un appel déjà autorisé par cette porte, l'élargissement sandbox initié par shell / pwsh / edit depuis l'intérieur de l'outil est approuvé ici au lieu de vous le demander",
				"card.strategy.trustEscalationHint": "L'approbation d'escalade sandbox est demandée depuis l'intérieur du corps de l'outil, après tools/pre-execute, donc la porte ne la voit jamais — un appel que le LLM a jugé sûr et que la porte a auto-autorisé vous demandait quand même d'approuver l'élargissement. Activé, seul l'appel exact que la porte a autorisé (correspondance par callId) ignore l'invite ; tout le reste passe à l'humain comme avant, ainsi que toute raison non reconnue ou cible autre que workspace-write / danger-full-access. Désactivez pour garder l'élargissement sous contrôle humain.",
				"card.readonly": "Lecture seule",
				"card.unavailable": "Espace de noms des paramètres indisponible : assurez-vous que dsh-perm-gate est assemblé dans ce profil.",
				"card.llmReceiver": "LLM récepteur llmAssist (compatible OpenAI ; API personnalisée possible)",
				"card.llmEndpoint": "Endpoint (BaseURL, ex. https://api.openai.com/v1)",
				"card.llmModel": "Model (identifiant du modèle, ex. deepseek-chat)",
				"card.llmEffort": "Effort de raisonnement (mode host)",
				"card.llmEffortHost": "Suivre l’hôte",
				"card.llmEffortHint": "Vide = ne rien imposer, la config du modèle hôte décide ; passer à low ou off si l’hôte refuse.",
				"card.llmKey": "API Key (secret)",
				"card.llmKeyHidden": "Non défini · affiché comme * après la première saisie",
				"card.llmKeyMasked": "Défini · saisir une nouvelle valeur pour écraser",
				"card.llmKeyOverwrite": "Une valeur secrète est stockée ; saisissez une nouvelle valeur et quittez le champ pour l'écraser.",
				"card.llmKeyClear": "Effacer",
				"card.allowlist": "Liste blanche (allow, synchronisée avec rulesFile)",
				"card.allowlistHint": "Les motifs correspondant à la section allow sont directement autorisés ; ajoutez ou supprimez des entrées une par une, écrites dans rulesFile et rechargées en direct.",
				"card.allowlistPresetNote": "L'équivalent de la liste blanche prédéfinie est la stratégie trustAutoAllow (opérations sûres dans le périmètre auto-autorisées), activée dans la section stratégies ci-dessus ; cette liste reflète votre section allow de rulesFile et démarre légitimement vide.",
				"card.allowlistEmpty": "Aucune règle de liste blanche",
				"card.allowlistPlaceholder": "Nouveau motif de commande, ex. npm test*",
				"card.allowlistAdd": "Ajouter",
				"card.allowlistRemove": "Supprimer ce motif",
				"card.allowlistBulk": "Édition groupée",
				"card.allowlistBulkHide": "Masquer l'édition groupée",
				"card.allowlistSave": "Enregistrer la liste blanche",
				"card.riskLearning": "riskLearning — apprentissage de verdict : les opérations à risque neutral approuvées et exécutées sont comptées ; la même opération est auto-autorisée au seuil avec une empreinte correspondante",
				"card.riskLearningHint": "L'état d'apprentissage appartient au plugin ($DSH_HOME/perm-gate/learning.json) et n'est jamais écrit dans vos règles YAML ; une cible différente ne réutilise jamais l'autorité. Désactivé par défaut.",
				"card.riskThreshold": "Confirmations humaines requises avant auto-autorisation (1–10)",
				"notice.label": "Activité de la porte de permission",
				"history.label": "Approbations",
				"history.title": "Historique des approbations de permission",
				"history.subtitle": "Chaque décision de la porte dans cette session, les plus récentes d'abord",
				"history.loading": "Chargement…",
				"history.empty": "Aucun enregistrement d'approbation dans cette session",
				"history.error": "Échec du chargement : ",
				"history.tag.auto": "Auto-autorisé",
				"history.tag.ask": "Demandé",
				"history.tag.deny": "Refusé",
				"card.denylistRestore": "Restaurer la liste noire prédéfinie",
				"card.denylist": "Liste noire (mots-clés deny, prédéfinis par le plugin)",
				"card.denylistHint": "Un appel dont le texte contient un mot-clé (sous-chaîne insensible à la casse) est refusé immédiatement, avant liste blanche / grants / LLM. La liste prédéfinie hérite de dsh-approval-gate et est active dès l'installation ; modifiez librement — vide ou effacée, retour au préréglage (restauration en un clic), donc la liste noire ne se désactive jamais silencieusement.",
				"card.denylistEmpty": "Liste noire vide (aucun appel n'est rejeté par la couche de mots-clés)",
				"card.denylistPlaceholder": "Nouveau mot-clé, ex. drop database",
				"card.denylistAdd": "Ajouter",
				"card.denylistRemove": "Supprimer ce mot-clé",
				"card.denylistTagPreset": "Prédéfini",
				"card.denylistTagCustom": "Personnalisé",
				"card.riskSediment": "riskSediment — sédimentation d'apprentissage : les échantillons ayant atteint le seuil deviennent des règles d'auto-autorisation déterministes",
				"card.riskSedimentHint": "Activé, lorsqu'une clé tool|category atteint le seuil, ses empreintes d'échantillons se sédimentent en règles d'autorisation — une correspondance exacte même outil/même cible autorise directement sans autre appel LLM (continue de fonctionner avec llmAssist désactivé).",
				"card.sediment": "Sédiment d'apprentissage (règles d'autorisation déterministes)",
				"card.sedimentHint": "Règles sédimentées à partir des confirmations humaines : seule une correspondance exacte d'empreinte autorise, jamais une cible différente. Terminez un apprentissage ou supprimez un échantillon.",
				"card.learningScope": "Portée des données d'apprentissage",
				"card.learningScopeGlobal": "Global (par défaut)",
				"card.learningScopeSession": "Par session",
				"card.learningScopeHint": "Global : une opération confirmée dans n'importe quelle session abaisse le seuil de toutes les sessions (comportement historique). Par session : seules les confirmations de cette session comptent, et une règle globale existante reste inactive jusqu'à promotion explicite dans la liste des règles sédimentées.",
				"attention.title": "Alertes d'approbation",
				"attention.hint": "Comment une demande vous atteint. Les deux interrupteurs sont indépendants : par défaut seule la barre de décision s'affiche (comportement actuel) ; avec le son activé, vous l'entendez même sans regarder la conversation.",
				"attention.toast": "Afficher la barre de décision",
				"attention.sound": "Son",
				"attention.gap": "Intervalle minimal par session (ms)",
				"attention.test": "Écouter",
				"card.sedimentEmpty": "Aucune règle sédimentée pour l'instant (les échantillons atteignant le seuil apparaissent ici)",
				"card.sedimentCount": "confirmé %n/%t",
				"card.sedimentStop": "Terminer",
				"card.sedimentStopTitle": "Terminer cet apprentissage (supprime le compteur et les échantillons)",
				"card.sedimentStopConfirm": "Terminer l'apprentissage pour « %k » ? Son compteur et tous ses échantillons seront supprimés.",
				"card.sedimentSampleRemove": "Supprimer cet échantillon sédimenté",
				"card.llmSource": "Source du LLM récepteur",
				"card.llmSourceCustom": "API personnalisée (compatible OpenAI)",
				"card.llmSourceHost": "Utiliser le modèle par défaut actuel de la session (service DSH llm)",
				"card.llmSourceHostHint": "Par défaut, l'évaluation d'approbation utilise le groupe de modèles actuellement sélectionné dans la session DSH (la valeur effective est affichée ci-dessous) ; laissez Provider / Model vide pour suivre la session, ou choisissez dans la liste déroulante ou saisissez pour épingler — vos groupes personnalisés configurés dans DSH (ex. local-35b) apparaissent automatiquement.",
				"card.llmProvider": "Provider (vide = suit la sélection de session)",
				"card.llmProviderPlaceholder": "Suit la sélection de session",
				"card.llmModelHostPlaceholder": "Vide = suit la sélection de session",
				"card.llmResolved": "Effectif actuellement : %p / %m",
				"card.llmPreset": "Préréglages d'endpoint (remplit les champs ; modifiable ensuite)",
				"card.llmPresetChoose": "Choisir un préréglage…",
				"card.llmPresetPublic": "Préréglages d'API publiques",
				"card.llmPresetHost": "Groupes de modèles DSH (la sélection bascule vers le récepteur de session)",
				"card.networkEnabled": "Interception réseau (networkEnabled)",
				"card.networkEnabledHint": "Activé, démarre un proxy local qui intercepte les connexions sortantes des sous-processus et applique les règles d'autorisation/refus. Désactivé = aucun changement de comportement.",
				"card.watch": "Rechargement à chaud des règles (watch)",
				"card.watchHint": "Activé, surveille automatiquement les modifications des fichiers de règles et les applique instantanément sans rechargement manuel.",
				"card.networkRebindNote": "Prend effet immédiatement — le proxy se relie automatiquement, pas besoin de recharger le plugin.",
				"card.networkInjectEnv": "Injecter les variables d'environnement proxy (networkInjectEnv)",
				"card.networkInjectEnvHint": "Écrit HTTP(S)_PROXY / ALL_PROXY pour les sous-processus (et vide NO_PROXY). Désactivé = l'écouteur fonctionne mais aucun environnement de processus n'est modifié.",
				"card.healthStale": "Route hôte indisponible (404) — la moitié node est encore une ancienne version ; redémarrez complètement dsh (pas seulement la page du navigateur) et réessayez.",
				"card.healthTest": "Test de santé",
				"card.healthRunning": "Test en cours…",
				"card.healthOk": "OK (%ms ms)",
				"card.healthFail": "Échec : ",
				"history.tag.learned": "Appris",
				"history.tag.manualApproved": "Approuvé",
				"history.tag.manualRejected": "Rejeté",
				"history.tag.manualCancelled": "Annulé",
				"history.tag.standDown": "Porte inactive",
				"history.learnedProgress": "appris %n/%t",
				"history.snapshots": "instantanés diff",
				"history.clearSession": "Effacer cette session",
				"history.clearAll": "Tout effacer",
				"history.clearSessionTitle": "Effacer uniquement les instantanés diff de cette session (les autres sessions ne sont pas affectées)",
				"history.clearAllTitle": "Effacer les instantanés diff de toutes les sessions, y compris celles jamais consultées — demande une reconfirmation",
				"history.clearSessionConfirm": "Effacer les instantanés diff de cette session ? Seules les données de comparaison produites par les approbations de cette session sont supprimées ; les enregistrements d'approbation restent.",
				"history.clearAllConfirm": "Effacer les instantanés diff de TOUTES les sessions ? Cela peut supprimer des comparaisons que d'autres sessions n'ont pas encore consultées, et c'est irréversible.",
				"history.diffTitle": "Comparaison des modifications de fichier",
				"history.diffClose": "Fermer",
				"history.diffLoading": "Chargement…",
				"history.diffEmpty": "Aucun changement de contenu (ou fichier illisible)",
				"history.diffLoadFail": "Échec du chargement du diff : ",
				"history.diffRevert": "Annuler cette modification",
				"history.diffReverting": "Envoi…",
				"history.diffRevertDone": "Instruction d'annulation envoyée",
				"history.diffRevertSent": "Instruction d'annulation envoyée à la conversation ; l'IA restaurera le fichier en conséquence",
				"history.diffRevertFail": "Échec de l'envoi : ",
				"history.diffNoSnapshot": "Cet événement n'a pas d'instantané pour ce fichier",
				"history.diffChipTitle": "Voir la comparaison des modifications de ce fichier",
				"history.diffStats": "+%a / -%r lignes modifiées · %c inchangées",
				"history.diffGone": " (le fichier n'existe plus)",
				"history.diffHidden": "%n lignes non modifiées",
				"card.dryRun": "Test de règles",
				"card.dryRunHint": "Juge un appel contre les règles en vigueur. N'exécute aucun outil et n'écrit aucune règle — vérifiez ici avant de modifier.",
				"card.dryRunTool": "Outil",
				"card.dryRunCommand": "Commande / arguments",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Tester",
				"card.dryRunRunning": "Évaluation…",
				"card.dryRunEmpty": "Rien de testé pour l'instant. Renseignez un outil et une commande, puis appuyez sur Tester pour voir le verdict.",
				"card.dryRunVerdict": "Verdict",
				"card.dryRunAllow": "autoriser",
				"card.dryRunAsk": "demander",
				"card.dryRunDeny": "refuser",
				"card.dryRunRule": "Règle correspondante",
				"card.dryRunRuleNone": "aucune règle correspondante ; defaultAction : %d",
				"card.dryRunDimensions": "Dimensions",
				"card.dryRunReason": "Raison",
				"card.dryRunNote": "« Règle correspondante » provient de la couche de règles. Quand le verdict est produit par un refus dur antérieur ou par la liste noire de mots-clés, il n'y a pas d'index de règle — les dimensions listées sont alors informatives.",
				"card.dryRunNoRules": "(0 règles chargées — vérifiez le chemin rulesFile)",
				"card.dryRunFail": "Échec du test : ",
				"card.dryRunStale": "route manquante (plugin non redémarré ?)",
				"card.rules": "Règles intégrées des paramètres",
				"card.rulesHint": "Les règles que la porte charge actuellement (depuis le champ de configuration rules de cette entrée de plugin ; retour au fichier de règles si non configuré). Lecture seule — rien ici ne peut les modifier. Pour changer les règles, utilisez la liste blanche ci-dessous ou modifiez-les dans la page des paramètres.",
				"card.rulesRefresh": "Actualiser",
				"card.rulesLoading": "Lecture…",
				"card.rulesPath": "Source",
				"card.rulesNone": "aucune règle configurée",
				"card.rulesCounts": "Règles",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b octets · %l lignes",
				"card.rulesMissing": "Règles introuvables. La porte retombe sur ses valeurs par défaut intégrées.",
				"card.rulesTruncated": "Règles volumineuses ; affichage des 512 Ko premiers uniquement.",
				"card.rulesError": "Échec du chargement : ",
				"card.rulesStale": "route manquante (plugin non redémarré ?)",
				"card.rulesNote": "Lecture seule : ce panneau ne peut pas modifier les règles. La section liste blanche et « toujours autoriser » écrivent dans la configuration d'entrée de ce plugin.",
				"doubt.no-rule": "aucune règle ne couvre cet appel, le défaut est de demander — cela ne signifie pas qu’il est dangereux",
				"doubt.opaque": "le payload est illisible (encodé, script hors workspace, ou programme non reconnu), aucune règle ne peut localiser sa cible",
				"doubt.irreversible": "règle irréversible : après exécution, annulation impossible",
				"doubt.never-learn": "cette réponse ne sera pas mémorisée ; la même question se reposera",
				"doubt.delete": "supprime du contenu",
				"doubt.remote-write": "effet visible de l’extérieur (push / publish / écriture) ; annuler nécessite des étapes manuelles",
				"doubt.exec-external": "exécute du code hors workspace, non inspectable par cet appel",
				"doubt.outside-paths": "accède à des chemins hors workspace",
				"doubt.model-flagged": "le modèle de risque l’a signalé (il peut uniquement escalader, jamais lever)",
				"doubt.write": "écrit ou modifie des fichiers",
				"verdict.rule": "Règle appliquée",
				"verdict.grant": "Autorisation de session",
				"verdict.hard-deny": "Refus strict",
				"verdict.deny-keyword": "Mot-clé de liste noire",
				"verdict.default": "Politique par défaut",
				"verdict.ask": "Politique par défaut",
				"verdict.permissive": "Autorisation après vérification auto",
				"verdict.classifier": "Verdict du LLM",
				"verdict.llm-safe": "LLM : jugé sûr",
				"verdict.llm-learned": "LLM : apprentissage autorisé",
				"verdict.learned-sediment": "Règle consolidée : autorisé",
				"verdict.learned-confirm": "Confirmation d’apprentissage",
				"verdict.human-approved": "Approuvé par un humain",
				"verdict.human-rejected": "Refusé par un humain",
				"verdict.human-cancelled": "Annulé par un humain",
				"verdict.no-approval-channel": "Aucun canal d’approbation",
				"verdict.preset-passthrough": "Politique never · autorisé",
				"verdict.stand-down": "Porte désactivée",
				"verdict.yolo-allow": "YOLO : autorisé",
				"verdict.yolo-allow-no-reviewer": "YOLO : autorisé (sans modèle de revue · traitement mécanique)",
				"verdict.yolo-block": "YOLO : bloqué",
				"verdict.rules-fallback-allow": "Porte de règles sans modèle : autorisé",
				"verdict.rules-fallback-block": "Porte de règles sans modèle : bloqué",
				"verdict.safety-net-passthrough-allow": "Vérification mécanique : autorisé (sans modèle)",
				"verdict.safety-net-passthrough-block": "Vérification mécanique : bloqué (sans modèle)",
				"verdict.cleanup-safe": "Nettoyage : autorisation sûre",
				"verdict.escalation-auto": "Élévation de bac à sable : auto-autorisée",
				"verdict.learned-granted": "Autorisation apprise",
				"verdict.network-ask": "Approbation réseau",
				"card.scopeUnresolved": " (scope non résolu — emplacement de diagnostic)"
			},
			de: {
				"card.title": "Automatische Überprüfung",
				"section.title": "Automatische Prüfschleuse",
				"card.description": "Unabhängige Genehmigungsstufe: parallel zu Nur-Lesen / Vollzugriff / Whitelist, angezeigt als „Automatische Überprüfung\" im Sitzungs-Berechtigungswähler. Das Frontend bietet einen einzigen Schalter; die vier Backend-Genehmigungsstrategien sind über dieses Panel kombinierbar und bleiben fail-closed gegen P0-Hartablehnung.",
				"card.permissive": "Stufe „Automatische Überprüfung\" aktivieren",
				"card.permissiveHint": "Wenn deaktiviert, verhält sich das Gate genau wie zuvor.",
				"card.unattended": "Unbeaufsichtigte Stufen",
				"card.unattendedHint": "Drei Schalter, jeder steuert nur die Stufe daneben: wer die Implementierung abschaltet, lässt diese Stufe zum normalen Menschenablauf zurückkehren — sie wird nie stillschweigend zu einer anderen.",
				"card.mode.ask": "Mensch behalten",
				"card.mode.pass": "Mechanischer Durchlass",
				"card.askHint": "Die mechanische Vorprüfung filtert und nennt ihre Zweifel, aber die Anfrage bleibt bei einem Menschen, und das Bewertungsmodell wird kein einziges Mal aufgerufen — die Form für Läufe ohne verbundenen Reviewer-LLM oder wenn sich die Tokens nicht lohnen.",
				"card.passHint": "Lässt nur den deterministischen mechanischen Prüfer laufen: eine irreversible, nicht rücknehmbare oder unlesbare Anfrage wird blockt und dem Hauptmodell begründet zurückgemeldet, alles andere läuft. Kein Modellaufruf, keine Frage an einen Menschen — die geprüfte Form von approval: never und YOLO ohne Modell.",
				"card.testing": "Tests & Diagnose",
				"card.lists": "Zulassungs- & Blocklisten",
				"card.credentials": "Schutz von Zugangsdaten",
				"card.networkOps": "Netzwerk & Hot-Reload",
				"card.summaryOn": "ein",
				"card.summaryOff": "aus",
				"card.summaryNone": "keine",
				"card.summaryStrategies": "%n aktiv",
				"card.summaryLists": "%a erlaubt · %d blockiert",
				"card.summaryCredRw": "readwrite: %n Familien",
				"card.summaryNetwork": "Netzwerk %net · Hot-Reload %w",
				"card.denylistPresetCollapse": "Eingebaute Schlüsselwörter (%n)",
				"card.denylistCustom": "Benutzerdefinierte Schlüsselwörter",
				"card.yolo": "YOLO — niemals einen Menschen fragen: nur Gefährliches blockieren, Rest ausführen",
				"card.yoloExempt": "YOLO: auch „Ort unbekannt“ im Arbeitsbereich zulassen",
				"card.yoloExemptHint": "Nur YOLO. Aktiviert wird ein Aufruf, bei dem nur der „Ort“ unbestimmbar ist (Werkzeug ohne Argumente, Skript außerhalb des Arbeitsbereichs ohne gelesenen Rumpf), nicht mehr als „unsichtbar“ blockiert. Kodierte Nutzlasten, unlesbare Skriptrümpfe, Löschungen und Remote-Schreibvorgänge bleiben blockiert; P0, Anmeldedaten und Unwiederbringliches ändern sich nie.",
				"card.yoloHint": "Blockiert eine unwiderrufliche / nicht lernbare / unlesbare Last oder ein Hartrisiko-Urteil des Modells und meldet den Grund dem Haupt-LLM als 工具审核意见-Nachricht; alles andere läuft. Ohne erreichbares Review-Modell fangen nur die deterministischen Netze.",
				"card.rulesFallback": "Ohne Modell zu einem Regel-Gate degradieren (cc-safety-net-Klasse)",
				"card.rulesFallbackHint": "Greift nur, wenn das Review-Modell nicht konfiguriert ist oder kein Urteil geliefert hat: die deterministischen Netze blockieren, was sie benennen können, und lassen den Rest durch, statt den Aufruf in einem Popup warten zu lassen, das niemand beantwortet. Solange ein Modell antwortet, bleibt das Verhalten unverändert.",
				"card.allowProtectedBranchPush": "Force-Push auf geschützte Branches erlauben (Standard aus = Boden bleibt)",
				"card.allowProtectedBranchPushHint": "Standardmäßig blockiert der P0-Boden git push --force/--force-with-lease/--delete auf main/master/production/release/stable (per Modell nicht herabstufbar). Beim Einschalten weicht der Boden und die drei flachen push-Schlüsselwörter der Blacklist werden ausgenommen; der Aufruf fällt auf die eingepasste Regel git.push-force, die weiterhin eine Person fragt — solange Sie den Eintrag nicht widerrufen oder auf die Allowlist setzen. Nichts anderes weitet sich: Löschen, Redirects und der Credential-Boden bleiben scharf.",
				"card.credFamily": "Credential-Familien-Stufenleiter",
				"card.credFamilyHint": "Eine Stufe pro Familie: deny = Lesen und Schreiben blockiert; ask = Lesen mit Bestätigung (Standard); readonly = Lesen frei, Schreiben bleibt P0-hart blockiert; readwrite = die Credential-Store-Schreibklausel weicht für diese Familie (npm-login-Fall). Alle anderen Böden (Roots, geschützte Pfade, .dsh, Exfiltration) bleiben in jeder Stufe scharf. Der Zustand lebt in der Regelzeile plus der Schreibausnahme-Liste; diese Karte schreibt beide gepaart zurück.",
				"card.credFamilyLoading": "Stufen werden geladen…",
				"card.credFamilyFootnote": "Unbeaufsichtigte Stufen (mechanischer Durchlass / YOLO) lassen ask-Reste durch — für harte Blockierung deny wählen. Eigene credentialPaths nehmen nie an der Schreibausnahme teil.",
				"card.credReadwriteConfirm": "readwrite erlaubt Schreiben/Ändern der Credential-Datei dieser Familie (z. B. ~/.npmrc überschreiben). Die einzige Stufe, die einen Teil von P0 zurücktritt. Bestätigen?",
				"card.credConfirmYes": "Bestätigen",
				"card.credConfirmNo": "Abbrechen",
				"card.credRung.deny": "blockieren",
				"card.credRung.ask": "fragen",
				"card.credRung.readonly": "nur Lesen",
				"card.credRung.readwrite": "Lesen+Schreiben",
				"card.scriptReview": "Skriptinhalte der Prüfung beifügen (standardmäßig an)",
				"card.scriptReviewHint": "Führt ein Aufruf eine Skriptdatei aus, wird ihr Inhalt gelesen und dem Risikomodell wie dem Menschen gezeigt, und die deterministischen Netze bewerten ebenfalls den Inhalt (ein Löschen, das nur in der Datei sichtbar ist, war genau das, was durchrutschte). Inhalte werden vor dem Verlassen des Rechners maskiert und begrenzt; abschalten hält Dateiinhalte lokal, kostet aber, dass Skripte außerhalb des Arbeitsbereichs wieder als „unlesbar“ gelten.",
				"card.credentialPaths": "Eigene Credential-Pfade (der lange Schwanz)",
				"card.autoAllowTools": "Auto-erlaubte Tools (ohne Rückfrage)",
				"card.autoAllowToolsHint": "Tools in dieser Liste werden wie read/grep behandelt: kein Popup, keine Modellprüfung. P0-Hard-Deny und Pfadregeln greifen weiterhin. Gedacht für sichere Tool-Namen, die eigene Plugins registrieren.",
				"card.autoAllowToolsPlaceholder": "Tool-Name, z. B. my_safe_tool",
				"card.credentialPathsHint": "Geheime Dateien, die die eingebaute Liste nicht kennt. Einträge sind Pfad-Globs: ein Doppelstern überquert Verzeichnisse, ein Einzelstern und ein Fragezeichen bleiben in einem Segment; ohne Joker wird über ein ganzes Pfadfragment verglichen (token trifft nicht ambient.txt); ein führendes ~/ wird zu Ihrem Home aufgelöst; ein relativer Muster passt auch in jeder Tiefe (secrets/*.env deckt a/b/secrets/prod.env ab). Ein Treffer gilt nach demselben Maßstab wie .ssh: Lesen außerhalb des Arbeitsbereichs und Ändern durch ein Dateiwerkzeug werden hart abgelehnt — diese Stufe ist weder anfechtbar noch vom Prüfer umgehbar, erklären Sie also nur Pfade, die wirklich geschützt müssen werden.",
				"card.credentialPathsPlaceholder": "Neuer Pfad, z. B. ~/.myco/vault.token oder secrets/*.env",
				"card.denyKeywordsExtra": "Zusätzliche Blacklist-Schlüsselwörter (ersetzt den Voreinstellung nicht)",
				"card.denyKeywordsExtraHint": "Eine deterministische Blockierung für Ihre eigenen Begriffe — ein Sperr-/Lösch-Unterbefehl einer firmeneigenen CLI, ein von Ihnen ausgegebener Token-Präfix. Diese Liste fügt nur hinzu: was die Blacklist oben enthält (Voreinstellung oder eigene Ersetzung), diese Wörter werden übernommen.",
				"card.listRemove": "Diesen Eintrag entfernen",
				"card.extraContentArgKeys": "Zusätzliche Dokument-Schlüssel (nicht als Operation gelesen)",
				"card.extraContentArgKeysHint": "Feldnamen außerhalb der eingebauten Liste (content/text/plan…): gelistet, gelangt ihr Text nicht mehr in das flache Lesen von Gefahrwörtern und Credential-Formen. Nur ergänzend — die eingebaute Liste ist nicht ersetzbar, denn ein fehlender Schlüssel würde den Fehler leise zurückbringen, dass ein Plan für das bloße Beschreiben einer Arbeit abgelehnt wird. Das tatsächlich ausgeführte Kommando und der geänderte Pfad werden auf eigenen Wegen geprüft; diese Liste kann sie nicht abschalten.",
				"card.extraContentArgKeysPlaceholder": "Neuer Argumentname, z. B. steps",
				"card.extraOperationArgKeys": "Zusätzliche Operations-Schlüssel (Feld als ausgeführten Code lesen)",
				"card.extraOperationArgKeysHint": "Ein Weg für Felder, deren Inhalt wirklich ausgeführt wird (workflowYaml u. ä.): ihr Text erreicht Blacklist und Credential-Prüfung, und bei Namensgleichheit gewinnt diese Liste. Preis: ein echtes Dokumentfeld hier einzutragen macht „der Plan erwähnt rm -rf\" wieder zum Ablehnungsgrund.",
				"card.scopeNote": "Voreinstellungsbereich: Dieses Gate wirkt nur, während die Sitzungsberechtigungsvoreinstellung %scope ist. Unter jeder anderen Voreinstellung tritt das gesamte Gate zurück — einschließlich P0-Hartablehnung — und die Richtlinie der gewählten Voreinstellung übernimmt. Der Rücktritt protokolliert ein Ereignis und zeigt einen dauerhaften Hinweis über der Eingabe.",
				"card.strategies": "Backend-Genehmigungsstrategien (mindestens eine aktiv; kombinierbar)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — sichere Operationen im Bereich werden automatisch erlaubt; gefährliche/unbekannte → Nachfrage (mittlere Baseline-Stufe)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — jeder Übergang fragt; die „Erlaubnis-Steuerelemente\" des Genehmigungspanels erhalten zwei erweiterte Buttons: „Diesen Typ in dieser Sitzung wiederholt erlauben\" (begrenztes Sitzungs-Grant) und „Alle Vorkommen erlauben\" (Befehlswort dauerhaft in die rulesFile-Whitelist aufnehmen)",
				"card.strategy.llmAssist": "llmAssist — ein benutzerdefiniertes LLM bewertet das Risiko: safe → automatische Erlaubnis; deletion/credential/remote/system/bulk → Hartrisiken behalten die menschliche Nachfrage (der Klassifizierer lehnt nie ab — er eskaliert nur); neutral → Bestätigungslernen; Fehler/Timeout → Rückfall auf den Menschen",
				"card.strategy.trustEscalation": "trustEscalation — Sandbox-Eskalation ohne Eingabeaufforderung: Für einen bereits von diesem Gate erlaubten Aufruf wird die Sandbox-Erweiterung, die shell / pwsh / edit intern anfordert, hier genehmigt statt Sie zu fragen",
				"card.strategy.trustEscalationHint": "Die Sandbox-Eskalationsgenehmigung wird nach tools/pre-execute im Tool-Körper angefordert, sodass das Gate sie nie sieht — ein vom LLM als sicher eingestufter und automatisch erlaubter Aufruf fragte Sie dennoch nach der Erweiterung. Aktiviert überspringt nur der exakte vom Gate erlaubte Aufruf (übereinstimmend per callId) die Eingabeaufforderung; alles andere geht wie zuvor zum Menschen, ebenso jeder unerkannte Grund oder ein anderes Ziel als workspace-write / danger-full-access. Deaktivieren, um die Erweiterung unter menschlicher Kontrolle zu halten.",
				"card.readonly": "Nur-Lesen",
				"card.unavailable": "Einstellungs-Namensraum nicht verfügbar: Stellen Sie sicher, dass dsh-perm-gate in diesem Profil zusammengebaut ist.",
				"card.llmReceiver": "llmAssist empfangendes LLM (OpenAI-kompatibel; jede benutzerdefinierte API)",
				"card.llmEndpoint": "Endpoint (BaseURL, z. B. https://api.openai.com/v1)",
				"card.llmModel": "Model (Modell-ID, z. B. deepseek-chat)",
				"card.llmEffort": "Reasoning-Aufwand (nur Host-Modus)",
				"card.llmEffortHost": "Host-Standard folgen",
				"card.llmEffortHint": "Leer = nichts vorgeben, die Host-Modellkonfiguration entscheidet; auf low oder off wechseln, wenn der Host es ablehnt.",
				"card.llmKey": "API Key (geheim)",
				"card.llmKeyHidden": "Nicht gesetzt · nach erster Eingabe als * angezeigt",
				"card.llmKeyMasked": "Gesetzt · neuen Wert eingeben zum Überschreiben",
				"card.llmKeyOverwrite": "Ein geheimer Wert ist gespeichert; geben Sie einen neuen Wert ein und verlassen Sie das Feld zum Überschreiben.",
				"card.llmKeyClear": "Löschen",
				"card.allowlist": "Whitelist (allow, mit rulesFile synchronisiert)",
				"card.allowlistHint": "Muster im allow-Abschnitt werden direkt erlaubt; Einträge einzeln hinzufügen oder entfernen, live in rulesFile geschrieben und neu geladen.",
				"card.allowlistPresetNote": "Das Äquivalent der Voreinstellungs-Whitelist ist die trustAutoAllow-Strategie (sichere Operationen im Bereich automatisch erlaubt), aktiviert im Strategiebereich oben; diese Liste spiegelt Ihren rulesFile-allow-Abschnitt und startet berechtigterweise leer.",
				"card.allowlistEmpty": "Keine Whitelist-Regeln",
				"card.allowlistPlaceholder": "Neues Befehlsmuster, z. B. npm test*",
				"card.allowlistAdd": "Hinzufügen",
				"card.allowlistRemove": "Dieses Muster entfernen",
				"card.allowlistBulk": "Massenbearbeitung",
				"card.allowlistBulkHide": "Massenbearbeitung ausblenden",
				"card.allowlistSave": "Whitelist speichern",
				"card.riskLearning": "riskLearning — Verdiktlernen: neutrale Risikoanfragen, die der Mensch genehmigt und die ausgeführt werden, zählen hoch; dieselbe Operation wird am Schwellenwert mit passendem Fingerabdruck automatisch erlaubt",
				"card.riskLearningHint": "Der Lernzustand gehört dem Plugin ($DSH_HOME/perm-gate/learning.json) und wird nie in Ihre YAML-Regeln geschrieben; ein anderes Ziel nutzt nie die Autorität wieder. Standardmäßig deaktiviert.",
				"card.riskThreshold": "Menschliche Bestätigungen vor automatischer Erlaubnis erforderlich (1–10)",
				"notice.label": "Berechtigungs-Gate-Aktivität",
				"history.label": "Genehmigungen",
				"history.title": "Berechtigungsgenehmigungsprotokolle",
				"history.subtitle": "Jede Gate-Entscheidung in dieser Sitzung, neueste zuerst",
				"history.loading": "Wird geladen…",
				"history.empty": "Noch keine Genehmigungsprotokolle in dieser Sitzung",
				"history.error": "Laden fehlgeschlagen: ",
				"history.tag.auto": "Automatisch erlaubt",
				"history.tag.ask": "Angefragt",
				"history.tag.deny": "Abgelehnt",
				"card.denylistRestore": "Standard-Blacklist wiederherstellen",
				"card.denylist": "Blacklist (deny-Schlüsselwörter, Plugin-Standard)",
				"card.denylistHint": "Ein Aufruf, dessen Text ein Schlüsselwort enthält (Groß-/Kleinschreibung-unempfindliche Teilzeichenkette), wird sofort abgelehnt, vor Whitelist / Grants / LLM. Die Standardliste erbt von dsh-approval-gate und ist ab Installation aktiv; frei bearbeitbar — leer oder geleert fällt auf den Standard zurück (Ein-Klick-Wiederherstellung verfügbar), sodass die Blacklist sich nie stillschweigend abschaltet.",
				"card.denylistEmpty": "Blacklist leer (kein Aufruf wird von der Schlüsselwortschicht abgelehnt)",
				"card.denylistPlaceholder": "Neues Schlüsselwort, z. B. drop database",
				"card.denylistAdd": "Hinzufügen",
				"card.denylistRemove": "Dieses Schlüsselwort entfernen",
				"card.denylistTagPreset": "Standard",
				"card.denylistTagCustom": "Benutzerdefiniert",
				"card.riskSediment": "riskSediment — Lernsedimentation: Proben am Schwellenwert werden zu deterministischen Auto-Erlaubnisregeln",
				"card.riskSedimentHint": "Wenn aktiv, werden bei Erreichen des Schwellenwerts für einen tool|category-Schlüssel dessen Proben-Fingerabdrücke als Erlaubnisregeln sedimentiert — eine exakte Übereinstimmung bei gleichem Tool und gleichem Ziel erlaubt direkt ohne weiteren LLM-Aufruf (funktioniert weiter mit deaktiviertem llmAssist).",
				"card.sediment": "Lernsediment (deterministische Erlaubnisregeln)",
				"card.sedimentHint": "Aus menschlichen Bestätigungen sedimentierte Regeln: Nur eine exakte Fingerabdruckübereinstimmung erlaubt, nie ein anderes Ziel. Beenden Sie ein Lernen oder entfernen Sie eine Probe.",
				"card.learningScope": "Geltungsbereich der Lerndaten",
				"card.learningScopeGlobal": "Global (Standard)",
				"card.learningScopeSession": "Pro Sitzung",
				"card.learningScopeHint": "Global: Eine in irgendeiner Sitzung bestätigte Operation senkt die Schwelle für alle Sitzungen (bisheriges Verhalten). Pro Sitzung: Nur die eigenen Bestätigungen zählen, eine bestehende globale Regel bleibt inaktiv, bis sie in der Sedimentliste ausdrücklich befördert wird.",
				"attention.title": "Genehmigungshinweise",
				"attention.hint": "Wie eine Anfrage Sie erreicht. Die beiden Schalter sind unabhängig: standardmäßig erscheint nur der Entscheidungsstreifen (heutiges Verhalten); mit Ton hören Sie sie auch ohne Blick auf die Unterhaltung.",
				"attention.toast": "Entscheidungsstreifen anzeigen",
				"attention.sound": "Ton",
				"attention.gap": "Mindestabstand pro Sitzung (ms)",
				"attention.test": "Anhören",
				"card.sedimentEmpty": "Noch keine sedimentierten Regeln (Proben am Schwellenwert erscheinen hier)",
				"card.sedimentCount": "bestätigt %n/%t",
				"card.sedimentStop": "Beenden",
				"card.sedimentStopTitle": "Dieses Lernen beenden (Zähler und Proben löschen)",
				"card.sedimentStopConfirm": "Lernen für „%k\" beenden? Zähler und alle Proben werden gelöscht.",
				"card.sedimentSampleRemove": "Diese sedimentierte Probe entfernen",
				"card.llmSource": "Empfängerquelle",
				"card.llmSourceCustom": "Benutzerdefinierte API (OpenAI-kompatibel)",
				"card.llmSourceHost": "Das aktuelle Standardmodell der Sitzung verwenden (DSH-llm-Dienst)",
				"card.llmSourceHostHint": "Standardmäßig läuft die Genehmigungsbewertung auf der Modellgruppe, die die DSH-Sitzung aktuell verwendet (der effektive Wert wird unten angezeigt); Provider / Model leer lassen, um der Sitzung zu folgen, oder aus dem Dropdown wählen bzw. eingeben zum Festlegen — Ihre in DSH konfigurierten benutzerdefinierten Gruppen (z. B. local-35b) erscheinen automatisch.",
				"card.llmProvider": "Provider (leer = folgt der Sitzungsauswahl)",
				"card.llmProviderPlaceholder": "Folgt der Sitzungsauswahl",
				"card.llmModelHostPlaceholder": "Leer = folgt der Sitzungsauswahl",
				"card.llmResolved": "Aktuell wirksam: %p / %m",
				"card.llmPreset": "Endpoint-Voreinstellungen (füllt die Felder; weiter bearbeitbar)",
				"card.llmPresetChoose": "Voreinstellung wählen…",
				"card.llmPresetPublic": "Öffentliche API-Voreinstellungen",
				"card.llmPresetHost": "DSH-Modellgruppen (Auswahl wechselt zum Sitzungsempfänger)",
				"card.networkEnabled": "Netzwerk-Interception (networkEnabled)",
				"card.networkEnabledHint": "Wenn aktiv, startet ein lokaler Proxy, der ausgehende Verbindungen von Unterprozessen abfängt und Erlaubnis-/Ablehnungsregeln anwendet. Deaktiviert = keine Verhaltensänderung.",
				"card.watch": "Regel-Hot-Reload (watch)",
				"card.watchHint": "Wenn aktiv, werden Regeldateien automatisch auf Änderungen überwacht und sofort ohne manuelles Neuladen angewendet.",
				"card.networkRebindNote": "Wirkt sofort — der Proxy bindet sich automatisch neu, kein Plugin-Reload nötig.",
				"card.networkInjectEnv": "Proxy-Umgebungsvariablen injizieren (networkInjectEnv)",
				"card.networkInjectEnvHint": "Schreibt HTTP(S)_PROXY / ALL_PROXY für Unterprozesse (und leert NO_PROXY). Deaktiviert = der Listener läuft, aber keine Prozessumgebung wird geändert.",
				"card.healthStale": "Host-Route nicht verfügbar (404) — die Node-Hälfte ist noch ein alter Build; starten Sie dsh vollständig neu (nicht nur die Browserseite) und versuchen Sie es erneut.",
				"card.healthTest": "Zustandstest",
				"card.healthRunning": "Wird getestet…",
				"card.healthOk": "OK (%ms ms)",
				"card.healthFail": "Fehlgeschlagen: ",
				"history.tag.learned": "Gelernt",
				"history.tag.manualApproved": "Genehmigt",
				"history.tag.manualRejected": "Abgelehnt",
				"history.tag.manualCancelled": "Abgebrochen",
				"history.tag.standDown": "Gate aus",
				"history.learnedProgress": "gelernt %n/%t",
				"history.snapshots": "Diff-Snapshots",
				"history.clearSession": "Diese Sitzung löschen",
				"history.clearAll": "Alle löschen",
				"history.clearSessionTitle": "Nur die Diff-Snapshots dieser Sitzung löschen (andere Sitzungen unberührt)",
				"history.clearAllTitle": "Diff-Snapshots aller Sitzungen löschen, einschließlich nie überprüfter — fragt erneut",
				"history.clearSessionConfirm": "Diff-Snapshots dieser Sitzung löschen? Nur die von dieser Sitzung erzeugten Änderungsvergleichsdaten werden entfernt; die Genehmigungsprotokolle bleiben.",
				"history.clearAllConfirm": "Diff-Snapshots ALLER Sitzungen löschen? Dies kann Änderungsvergleiche löschen, die andere Sitzungen noch nicht überprüft haben, und ist unwiderruflich.",
				"history.diffTitle": "Dateiänderungsvergleich",
				"history.diffClose": "Schließen",
				"history.diffLoading": "Wird geladen…",
				"history.diffEmpty": "Keine Inhaltsänderung (oder Datei unlesbar)",
				"history.diffLoadFail": "Diff-Laden fehlgeschlagen: ",
				"history.diffRevert": "Diese Änderung zurücksetzen",
				"history.diffReverting": "Wird gesendet…",
				"history.diffRevertDone": "Zurücksetzungsanweisung gesendet",
				"history.diffRevertSent": "Zurücksetzungsanweisung an die Konversation gesendet; die KI stellt die Datei entsprechend wieder her",
				"history.diffRevertFail": "Senden fehlgeschlagen: ",
				"history.diffNoSnapshot": "Dieses Ereignis hat keinen Snapshot für diese Datei",
				"history.diffChipTitle": "Änderungsvergleich dieser Datei anzeigen",
				"history.diffStats": "+%a / -%r Zeilen geändert · %c unverändert",
				"history.diffGone": " (Datei existiert nicht mehr)",
				"history.diffHidden": "%n unveränderte Zeilen",
				"card.dryRun": "Regeltest",
				"card.dryRunHint": "Beurteilt einen Aufruf gegen die aktuellen Regeln. Führt kein Tool aus und schreibt keine Regel — prüfen Sie hier, bevor Sie ändern.",
				"card.dryRunTool": "Werkzeug",
				"card.dryRunCommand": "Befehl / Argumente",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Testen",
				"card.dryRunRunning": "Wird bewertet…",
				"card.dryRunEmpty": "Noch nichts getestet. Geben Sie ein Werkzeug und einen Befehl ein und drücken Sie Testen, um das Verdikt zu sehen.",
				"card.dryRunVerdict": "Verdikt",
				"card.dryRunAllow": "erlauben",
				"card.dryRunAsk": "anfragen",
				"card.dryRunDeny": "ablehnen",
				"card.dryRunRule": "Übereinstimmende Regel",
				"card.dryRunRuleNone": "keine Regel gefunden; defaultAction: %d",
				"card.dryRunDimensions": "Dimensionen",
				"card.dryRunReason": "Begründung",
				"card.dryRunNote": "„Übereinstimmende Regel\" stammt aus der Regelebene. Wenn das Verdikt von einer früheren Hartablehnung oder der Schlüsselwort-Blacklist erzeugt wurde, gibt es keinen Regelindex — die aufgelisteten Dimensionen sind dann nur informativ.",
				"card.dryRunNoRules": "(0 Regeln geladen — prüfen Sie den rulesFile-Pfad)",
				"card.dryRunFail": "Test fehlgeschlagen: ",
				"card.dryRunStale": "Route fehlt (Plugin nicht neu gestartet?)",
				"card.rules": "Einstellungen: Integrierte Regeln",
				"card.rulesHint": "Die Regeln, die das Gate gerade lädt (aus dem rules-Konfigurationsfeld dieses Plugin-Eintrags; Fallback auf die Regeldatei, wenn nicht konfiguriert). Nur-Lesen — nichts hier kann sie ändern. Um Regeln zu ändern, verwenden Sie die Whitelist unten oder bearbeiten Sie sie auf der Einstellungsseite.",
				"card.rulesRefresh": "Aktualisieren",
				"card.rulesLoading": "Wird gelesen…",
				"card.rulesPath": "Quelle",
				"card.rulesNone": "keine Regeln konfiguriert",
				"card.rulesCounts": "Regeln",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b Bytes · %l Zeilen",
				"card.rulesMissing": "Regeln nicht gefunden. Das Gate fällt auf seine integrierten Standardwerte zurück.",
				"card.rulesTruncated": "Regeln sind groß; nur die ersten 512 KB werden angezeigt.",
				"card.rulesError": "Laden fehlgeschlagen: ",
				"card.rulesStale": "Route fehlt (Plugin nicht neu gestartet?)",
				"card.rulesNote": "Nur-Lesen: Dieses Panel kann die Regeln nicht ändern. Der Whitelist-Abschnitt und „Immer erlauben\" schreiben in die Konfiguration dieses Plugin-Eintrags zurück.",
				"doubt.no-rule": "keine Regel deckt diesen Aufruf ab, daher wird standardmäßig gefragt — das bedeutet nicht, dass er gefährlich ist",
				"doubt.opaque": "der Payload ist nicht lesbar (kodiert, Script außerhalb des Workspace, oder kein erkennbares Programm), keine Regel kann das Ziel bestimmen",
				"doubt.irreversible": "Regel besagt: irreversibel — nach der Ausführung nicht mehr rückgängig",
				"doubt.never-learn": "diese Antwort wird nicht gelernt; dieselbe Frage wird erneut gestellt",
				"doubt.delete": "es löscht Inhalte",
				"doubt.remote-write": "extern sichtbare Wirkung (push / publish / Schreib-Request); Rückgängig machen erfordert manuelle Schritte",
				"doubt.exec-external": "führt Code außerhalb des Workspaces aus, nicht überprüfbar durch diesen Aufruf",
				"doubt.outside-paths": "berührt Pfade außerhalb des Workspaces",
				"doubt.model-flagged": "das Risikomodell hat es markiert (nur Eskalation möglich, keine Freigabe)",
				"doubt.write": "schreibt oder ändert Dateien",
				"verdict.rule": "Regel greift",
				"verdict.grant": "Sitzungsfreigabe",
				"verdict.hard-deny": "Harte Ablehnung",
				"verdict.deny-keyword": "Sperrlisten-Stichwort",
				"verdict.default": "Standardrichtlinie",
				"verdict.ask": "Standardrichtlinie",
				"verdict.permissive": "Automatisch geprüft erlaubt",
				"verdict.classifier": "LLM-Urteil",
				"verdict.llm-safe": "LLM: als sicher bewertet",
				"verdict.llm-learned": "LLM: gelernt erlaubt",
				"verdict.learned-sediment": "Gesetzte Regel erlaubt",
				"verdict.learned-confirm": "Lernbestätigung",
				"verdict.human-approved": "Von Mensch genehmigt",
				"verdict.human-rejected": "Von Mensch abgelehnt",
				"verdict.human-cancelled": "Von Mensch abgebrochen",
				"verdict.no-approval-channel": "Kein Genehmigungskanal",
				"verdict.preset-passthrough": "Richtlinie never · erlaubt",
				"verdict.stand-down": "Gate deaktiviert",
				"verdict.yolo-allow": "YOLO erlaubt",
				"verdict.yolo-allow-no-reviewer": "YOLO erlaubt (kein Prüfmodell · mechanisch)",
				"verdict.yolo-block": "YOLO blockiert",
				"verdict.rules-fallback-allow": "Regelschleuse ohne Modell erlaubt",
				"verdict.rules-fallback-block": "Regelschleuse ohne Modell blockiert",
				"verdict.safety-net-passthrough-allow": "Mechanische Prüfung erlaubt (ohne Modell)",
				"verdict.safety-net-passthrough-block": "Mechanische Prüfung blockiert (ohne Modell)",
				"verdict.cleanup-safe": "Aufräumen sicher erlaubt",
				"verdict.escalation-auto": "Sandbox-Eskalation automatisch erlaubt",
				"verdict.learned-granted": "Gelernte Freigabe erlaubt",
				"verdict.network-ask": "Netzwerk-Genehmigung",
				"card.scopeUnresolved": " (scope nicht aufgelöst — Diagnose-Platzhalter)"
			},
			it: {
				"card.title": "Revisione automatica",
				"section.title": "Portale di revisione automatica",
				"card.description": "Livello di approvazione indipendente: parallelo a sola lettura / accesso completo / whitelist, mostrato come «Revisione automatica» nel selettore delle autorizzazioni della sessione. Il front-end espone un unico interruttore; le quattro strategie di approvazione backend sono combinabili tramite questo pannello e restano fail-closed contro il rifiuto rigido P0.",
				"card.permissive": "Abilita il livello di revisione automatica",
				"card.permissiveHint": "Quando disattivato, il portale si comporta esattamente come prima.",
				"card.unattended": "Modalità senza supervisione",
				"card.unattendedHint": "Tre interruttori, ciascuno governa solo il livello scritto accanto: spegnere un'implementazione fa tornare quel livello al flusso umano ordinario, senza che diventi di nascosto un altro.",
				"card.mode.ask": "Mantieni umano",
				"card.mode.pass": "Passaggio meccanico",
				"card.askHint": "La selezione meccanica filtra ed elenca i dubbi, ma la richiesta resta a una persona e il modello revisore non viene chiamato nemmeno una volta — la forma adatta quando nessun LLM revisore è collegato o quando i token non valgono la spesa.",
				"card.passHint": "Esegue solo il giudice meccanico deterministico: un'operazione irreversibile, irrecuperabile o illeggibile viene bloccata e motivata al modello principale, il resto esegue. Nessuna chiamata al modello, nessuna richiesta umana: la forma esaminata di approval: never, e YOLO privato del modello.",
				"card.testing": "Test e diagnostica",
				"card.lists": "Elenchi di autorizzazione e blocco",
				"card.credentials": "Protezione delle credenziali",
				"card.networkOps": "Rete e ricarica a caldo",
				"card.summaryOn": "attivo",
				"card.summaryOff": "disattivo",
				"card.summaryNone": "nessuno",
				"card.summaryStrategies": "%n attive",
				"card.summaryLists": "%a consentiti · %d bloccati",
				"card.summaryCredRw": "readwrite: %n famiglie",
				"card.summaryNetwork": "rete %net · ricarica %w",
				"card.denylistPresetCollapse": "Parole integrate (%n)",
				"card.denylistCustom": "Parole personalizzate",
				"card.yolo": "YOLO — non chiedere mai un umano: blocca il pericoloso, esegui il resto",
				"card.yoloExempt": "YOLO: consenti anche “posizione sconosciuta” nel workspace",
				"card.yoloExemptHint": "Solo YOLO. Se attivo, una chiamata di cui è indeterminabile solo la “posizione” (strumento senza argomenti, script fuori dal workspace il cui corpo non è stato letto) non viene più bloccata come “invisibile”. Payload codificati, corpi illeggibili, eliminazioni e scritture remote restano bloccati; P0, credenziali e operazioni irreversibili non cambiano mai.",
				"card.yoloHint": "Blocca un carico irreversibile / non apprendibile / illeggibile, o un verdetto a rischio duro del modello, e restituisce il motivo al LLM principale come messaggio 工具审核意见; tutto il resto viene eseguito. Senza un modello disponibile, solo le reti deterministiche intercettano.",
				"card.rulesFallback": "Degradare a una porta a regole quando non c’è modello (classe cc-safety-net)",
				"card.rulesFallbackHint": "Agisce solo quando il revisore di rischio non è configurato o non ha dato un verdetto: le reti deterministiche bloccano ciò che sanno nominare e lasciano passare il resto, invece di parcheggiare la chiamata su un popup che nessuno risponderà. Finché un modello risponde, il comportamento resta invariato.",
				"card.allowProtectedBranchPush": "Consenti force-push su branch protetti (default off = pavimento attivo)",
				"card.allowProtectedBranchPushHint": "Di default il pavimento P0 blocca git push --force/--force-with-lease/--delete verso main/master/production/release/stable (non declassabile dal modello). Attivandolo il pavimento si fa da parte e le tre parole push piatte della blacklist vengono escluse; la chiamata ricade nella regola git.push-force predefinita, che chiede comunque una persona finché non revochi la voce o la aggiungi all'allowlist. Nient'altro si allarga: cancellazioni, redirect e il pavimento credenziali restano armati.",
				"card.credFamily": "Gradini delle famiglie di credenziali",
				"card.credFamilyHint": "Un gradino per famiglia: deny = lettura e scrittura bloccate; ask = lettura con conferma umana (predefinito); readonly = lettura libera, scrittura ancora bloccata dal pavimento P0; readwrite = la clausola di scrittura del credential store si ritira per questa famiglia (caso npm login). Gli altri pavimenti (root, percorsi protetti, .dsh, esfiltrazione) restano armati a ogni gradino. Lo stato vive nella riga del documento regole più la lista di esenzione; questa scheda scrive entrambe insieme.",
				"card.credFamilyLoading": "Caricamento gradini…",
				"card.credFamilyFootnote": "I livelli senza umano (passaggio meccanico / YOLO) lasciano passare il residuo degli ask — scegliere deny per bloccare. I credentialPaths personalizzati non partecipano mai all'esenzione di scrittura.",
				"card.credReadwriteConfirm": "readwrite consente di scrivere/modificare i file di credenziali di questa famiglia (sovrascrittura di ~/.npmrc). È l’unico gradino che ritira parte del P0. Confermare?",
				"card.credConfirmYes": "Conferma",
				"card.credConfirmNo": "Annulla",
				"card.credRung.deny": "blocca",
				"card.credRung.ask": "chiedi",
				"card.credRung.readonly": "sola lettura",
				"card.credRung.readwrite": "lettura scrittura",
				"card.scriptReview": "Allega il contenuto degli script alla revisione (attivo per impostazione predefinita)",
				"card.scriptReviewHint": "Quando una chiamata esegue uno script, il suo corpo viene letto e mostrato al modello di rischio come all’umano, e le reti deterministiche valutano anch’esse il corpo (un’eliminazione visibile solo dentro il file è esattamente ciò che passava). I corpi sono oscurati e limitati prima di lasciare l’host; disattivarli tiene il contenuto dei file in locale, al prezzo di rimandare gli script fuori dal workspace nel livello «illeggibile».",
				"card.credentialPaths": "Percorsi di credenziali personalizzati (la coda lunga)",
				"card.autoAllowTools": "Strumenti auto-autorizzati (senza richiesta)",
				"card.autoAllowToolsHint": "Gli strumenti in questo elenco sono trattati come read/grep: nessun popup, nessuna revisione del modello. Il diniego duro P0 e le regole sui percorsi restano attivi. Da usare per nomi di strumenti sicuri registrati dai tuoi plugin.",
				"card.autoAllowToolsPlaceholder": "Nome strumento, es. my_safe_tool",
				"card.credentialPathsHint": "File segreti che l’elenco integrato non conosce. Le voci sono glob di percorso: un doppio asterisco attraversa le directory, un asterisco semplice e un punto di domanda restano dentro un segmento; senza jolly si confronta un frammento di percorso intero (token non colpisce ambient.txt); un ~/ iniziale si espande nella tua home; un modello relativo corrisponde anche a qualsiasi profondità (secrets/*.env copre a/b/secrets/prod.env). Una corrispondenza è trattata allo stesso livello di .ssh: la lettura fuori dal workspace e la modifica tramite strumento di file sono rifiutate in modo duro — questo livello non è appellabile né aggirabile dal revisore, dichiara solo percorsi che devi davvero proteggere.",
				"card.credentialPathsPlaceholder": "Nuovo percorso, es. ~/.myco/vault.token o secrets/*.env",
				"card.denyKeywordsExtra": "Parole chiave blacklist aggiunte (non sostituiscono il preset)",
				"card.denyKeywordsExtraHint": "Un blocco deterministico per termini tuoi — un sottocomando di revoca/cancellazione di una CLI aziendale, un prefisso di token che emetti. Questa lista aggiunge soltanto: qualunque cosa contenga la blacklist sopra (preset o tua sostituzione), queste parole vengono unite.",
				"card.listRemove": "Rimuovi questa voce",
				"card.extraContentArgKeys": "Chiavi documento aggiunte (mai lette come operazione)",
				"card.extraContentArgKeysHint": "Nomi di campi documentali fuori dall’elenco integrato (content/text/plan…): una volta dichiarati, il loro testo non entra più nella scansione piatta di parole pericolose e forme di credenziali. Solo in aggiunta: l’elenco integrato non è sostituibile, perché dimenticare una chiave riporterebbe in silenzio il bug per cui un piano viene rifiutato per aver descritto un’azione. Il comando effettivamente eseguito e il percorso modificato sono giudicati sui propri binari; questo elenco non può disattivarli.",
				"card.extraContentArgKeysPlaceholder": "Nuovo nome argomento, es. steps",
				"card.extraOperationArgKeys": "Chiavi operazione aggiunte (leggi il campo come codice eseguito)",
				"card.extraOperationArgKeysHint": "Un passaggio per i campi il cui corpo è davvero eseguito (workflowYaml e simili): il testo raggiunge blacklist e controllo credenziali, e in caso di omonimia questo elenco vince. Costo: indicare un campo documentale reale rende di nuovo «il piano menziona rm -rf» un motivo di rifiuto.",
				"card.scopeNote": "Ambito del preset: questo portale agisce solo quando il preset di autorizzazione della sessione è %scope. Con qualsiasi altro preset l'intero portale si mette in pausa — incluso il rifiuto rigido P0 — e la politica del preset selezionato prende il controllo. La pausa registra un evento e lascia una striscia persistente sopra l'input.",
				"card.strategies": "Strategie di approvazione backend (almeno una attiva; combinabili)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — le operazioni sicure nell'ambito sono auto-consentite; pericolose/sconosciute → richiesta (livello intermedio di base)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — ogni attraversamento chiede; i «controlli di consenso» del pannello di approvazione aggiungono due pulsanti estesi: «ripeti consenso per questo tipo in questa sessione» (grant limitato alla sessione) e «consenti tutte le occorrenze» (persistenza della parola comando nella whitelist rulesFile)",
				"card.strategy.llmAssist": "llmAssist — un LLM personalizzato valuta il rischio: safe → auto-consenso; deletion/credential/remote/system/bulk → rischi rigidi mantengono la richiesta umana (il classificatore non rifiuta mai — scala solo); neutral → apprendimento per conferma; fallimento/timeout → ritorno all'umano",
				"card.strategy.trustEscalation": "trustEscalation — escalation sandbox senza prompt: per una chiamata già consentita da questo portale, l'ampliamento sandbox avviato internamente da shell / pwsh / edit è approvato qui invece di chiedere a te",
				"card.strategy.trustEscalationHint": "L'approvazione dell'escalation sandbox è richiesta dall'interno del corpo dello strumento, dopo tools/pre-execute, quindi il portale non la vede mai — una chiamata che il LLM ha giudicato sicura e che il portale ha auto-consentito ti chiedeva comunque di approvare l'ampliamento. Attivato, solo la chiamata esatta consentita dal portale (corrispondenza per callId) salta il prompt; tutto il resto va all'umano come prima, così come ogni motivo non riconosciuto o un target diverso da workspace-write / danger-full-access. Disattiva per mantenere l'ampliamento sotto controllo umano.",
				"card.readonly": "Sola lettura",
				"card.unavailable": "Namespace delle impostazioni non disponibile: assicurati che dsh-perm-gate sia assemblato in questo profilo.",
				"card.llmReceiver": "LLM ricevente llmAssist (compatibile OpenAI; qualsiasi API personalizzata)",
				"card.llmEndpoint": "Endpoint (BaseURL, es. https://api.openai.com/v1)",
				"card.llmModel": "Model (ID modello, es. deepseek-chat)",
				"card.llmEffort": "Sforzo di ragionamento (solo modalità host)",
				"card.llmEffortHost": "Segui l’host",
				"card.llmEffortHint": "Vuoto = non imporre nulla, decide la configurazione del modello host; passa a low o off se l’host lo rifiuta.",
				"card.llmKey": "API Key (segreta)",
				"card.llmKeyHidden": "Non impostata · mostrata come * dopo il primo inserimento",
				"card.llmKeyMasked": "Impostata · inserisci un nuovo valore per sovrascrivere",
				"card.llmKeyOverwrite": "Un valore segreto è memorizzato; inserisci un nuovo valore e lascia il campo per sovrascriverlo.",
				"card.llmKeyClear": "Cancella",
				"card.allowlist": "Whitelist (allow, sincronizzata con rulesFile)",
				"card.allowlistHint": "I pattern nella sezione allow consentono direttamente; aggiungi o rimuovi voci una alla volta, scritte in rulesFile e ricaricate in tempo reale.",
				"card.allowlistPresetNote": "L'equivalente della whitelist predefinita è la strategia trustAutoAllow (operazioni sicure nell'ambito auto-consentite), attivata nella sezione strategie sopra; questa lista rispecchia la tua sezione allow di rulesFile e inizia legittimamente vuota.",
				"card.allowlistEmpty": "Nessuna regola whitelist",
				"card.allowlistPlaceholder": "Nuovo pattern di comando, es. npm test*",
				"card.allowlistAdd": "Aggiungi",
				"card.allowlistRemove": "Rimuovi questo pattern",
				"card.allowlistBulk": "Modifica in blocco",
				"card.allowlistBulkHide": "Nascondi modifica in blocco",
				"card.allowlistSave": "Salva whitelist",
				"card.riskLearning": "riskLearning — apprendimento del verdetto: le operazioni a rischio neutral approvate ed eseguite vengono conteggiate; la stessa operazione è auto-consentita alla soglia con impronta corrispondente",
				"card.riskLearningHint": "Lo stato di apprendimento appartiene al plugin ($DSH_HOME/perm-gate/learning.json) e non viene mai scritto nelle tue regole YAML; un target diverso non riutilizza mai l'autorità. Disattivato per impostazione predefinita.",
				"card.riskThreshold": "Conferme umane richieste prima dell'auto-consenso (1–10)",
				"notice.label": "Attività del portale autorizzazioni",
				"history.label": "Approvazioni",
				"history.title": "Registro approvazioni autorizzazioni",
				"history.subtitle": "Ogni decisione del portale in questa sessione, più recenti prima",
				"history.loading": "Caricamento…",
				"history.empty": "Nessun record di approvazione in questa sessione",
				"history.error": "Caricamento non riuscito: ",
				"history.tag.auto": "Auto-consentito",
				"history.tag.ask": "Richiesto",
				"history.tag.deny": "Rifiutato",
				"card.denylistRestore": "Ripristina blacklist predefinita",
				"card.denylist": "Blacklist (parole chiave deny, preset plugin)",
				"card.denylistHint": "Una chiamata il cui testo contiene una parola chiave (sottostringa senza distinzione maiuscole/minuscole) è rifiutata immediatamente, prima di whitelist / grant / LLM. La lista predefinita eredita da dsh-approval-gate ed è attiva dall'installazione; modifica liberamente — vuota o cancellata torna al predefinito (ripristino con un clic), quindi la blacklist non si disattiva mai silenziosamente.",
				"card.denylistEmpty": "Blacklist vuota (nessuna chiamata è respinta dal livello parole chiave)",
				"card.denylistPlaceholder": "Nuova parola chiave, es. drop database",
				"card.denylistAdd": "Aggiungi",
				"card.denylistRemove": "Rimuovi questa parola chiave",
				"card.denylistTagPreset": "Preset",
				"card.denylistTagCustom": "Personalizzato",
				"card.riskSediment": "riskSediment — sedimentazione dell'apprendimento: i campioni alla soglia diventano regole deterministiche di auto-consenso",
				"card.riskSedimentHint": "Attivato, quando una chiave tool|category raggiunge la soglia le sue impronte campione si sedimentano in regole di consenso — una corrispondenza esatta stesso strumento/stesso target consente direttamente senza altra chiamata LLM (continua a funzionare con llmAssist disattivato).",
				"card.sediment": "Sedimento di apprendimento (regole deterministiche di consenso)",
				"card.sedimentHint": "Regole sedimentate dalle conferme umane: solo una corrispondenza esatta dell'impronta consente, mai un target diverso. Termina un apprendimento o rimuovi un campione.",
				"card.learningScope": "Ambito dei dati di apprendimento",
				"card.learningScopeGlobal": "Globale (predefinito)",
				"card.learningScopeSession": "Per sessione",
				"card.learningScopeHint": "Globale: un'operazione confermata in qualsiasi sessione abbassa la soglia di tutte le sessioni (comportamento storico). Per sessione: contano solo le conferme di quella sessione e una regola globale esistente resta inattiva finché non viene promossa esplicitamente nell'elenco dei sedimenti.",
				"attention.title": "Avvisi di approvazione",
				"attention.hint": "Come ti raggiunge una richiesta. I due interruttori sono indipendenti: per impostazione predefinita compare solo la barra di decisione (comportamento attuale); con l'audio attivo la senti anche senza guardare la conversazione.",
				"attention.toast": "Mostra la barra di decisione",
				"attention.sound": "Audio",
				"attention.gap": "Intervallo minimo per sessione (ms)",
				"attention.test": "Ascolta",
				"card.sedimentEmpty": "Nessuna regola sedimentata per ora (i campioni che raggiungono la soglia appaiono qui)",
				"card.sedimentCount": "confermato %n/%t",
				"card.sedimentStop": "Termina",
				"card.sedimentStopTitle": "Termina questo apprendimento (elimina conteggio e campioni)",
				"card.sedimentStopConfirm": "Terminare l'apprendimento per «%k»? Il conteggio e tutti i campioni saranno eliminati.",
				"card.sedimentSampleRemove": "Rimuovi questo campione sedimentato",
				"card.llmSource": "Sorgente LLM ricevente",
				"card.llmSourceCustom": "API personalizzata (compatibile OpenAI)",
				"card.llmSourceHost": "Usa il modello predefinito attuale della sessione (servizio DSH llm)",
				"card.llmSourceHostHint": "Per impostazione predefinita la valutazione dell'approvazione usa il gruppo di modelli attualmente selezionato nella sessione DSH (il valore effettivo è mostrato sotto); lascia Provider / Model vuoto per seguire la sessione, oppure scegli dal menu a tendina o digita per fissare — i gruppi personalizzati configurati in DSH (es. local-35b) appaiono automaticamente.",
				"card.llmProvider": "Provider (vuoto = segue la selezione della sessione)",
				"card.llmProviderPlaceholder": "Segue la selezione della sessione",
				"card.llmModelHostPlaceholder": "Vuoto = segue la selezione della sessione",
				"card.llmResolved": "Attualmente effettivo: %p / %m",
				"card.llmPreset": "Preset endpoint (compila i campi; ancora modificabile)",
				"card.llmPresetChoose": "Scegli un preset…",
				"card.llmPresetPublic": "Preset API pubbliche",
				"card.llmPresetHost": "Gruppi modelli DSH (la selezione passa al ricevitore di sessione)",
				"card.networkEnabled": "Intercettazione rete (networkEnabled)",
				"card.networkEnabledHint": "Attivato, avvia un proxy locale che intercetta le connessioni in uscita dei sottoprocessi e applica regole di consenso/rifiuto. Disattivato = nessun cambiamento di comportamento.",
				"card.watch": "Ricaricamento a caldo regole (watch)",
				"card.watchHint": "Attivato, monitora automaticamente le modifiche ai file di regole e le applica istantaneamente senza ricaricamento manuale.",
				"card.networkRebindNote": "Ha effetto immediato — il proxy si ricollega automaticamente, nessun ricaricamento del plugin necessario.",
				"card.networkInjectEnv": "Inietta variabili d'ambiente proxy (networkInjectEnv)",
				"card.networkInjectEnvHint": "Scrive HTTP(S)_PROXY / ALL_PROXY per i sottoprocessi (e svuota NO_PROXY). Disattivato = il listener è in esecuzione ma nessun ambiente di processo viene modificato.",
				"card.healthStale": "Route host non disponibile (404) — la metà node è ancora una build vecchia; riavvia completamente dsh (non solo la pagina del browser) e riprova.",
				"card.healthTest": "Test di salute",
				"card.healthRunning": "Test in corso…",
				"card.healthOk": "OK (%ms ms)",
				"card.healthFail": "Fallito: ",
				"history.tag.learned": "Appreso",
				"history.tag.manualApproved": "Approvato",
				"history.tag.manualRejected": "Rifiutato",
				"history.tag.manualCancelled": "Annullato",
				"history.tag.standDown": "Portale inattivo",
				"history.learnedProgress": "appreso %n/%t",
				"history.snapshots": "snapshot diff",
				"history.clearSession": "Cancella questa sessione",
				"history.clearAll": "Cancella tutto",
				"history.clearSessionTitle": "Cancella solo gli snapshot diff di questa sessione (altre sessioni intatte)",
				"history.clearAllTitle": "Cancella gli snapshot diff di tutte le sessioni, incluse quelle mai revisionate — chiede di nuovo",
				"history.clearSessionConfirm": "Cancellare gli snapshot diff di questa sessione? Solo i dati di confronto prodotti dalle approvazioni di questa sessione sono rimossi; i record di approvazione restano.",
				"history.clearAllConfirm": "Cancellare gli snapshot diff di TUTTE le sessioni? Potrebbe eliminare confronti che altre sessioni non hanno ancora revisionato, ed è irreversibile.",
				"history.diffTitle": "Confronto modifiche file",
				"history.diffClose": "Chiudi",
				"history.diffLoading": "Caricamento…",
				"history.diffEmpty": "Nessuna modifica al contenuto (o file illeggibile)",
				"history.diffLoadFail": "Caricamento diff non riuscito: ",
				"history.diffRevert": "Annulla questa modifica",
				"history.diffReverting": "Invio…",
				"history.diffRevertDone": "Istruzione di ripristino inviata",
				"history.diffRevertSent": "Istruzione di ripristino inviata alla conversazione; l'IA ripristinerà il file di conseguenza",
				"history.diffRevertFail": "Invio non riuscito: ",
				"history.diffNoSnapshot": "Questo evento non ha uno snapshot per quel file",
				"history.diffChipTitle": "Visualizza il confronto modifiche di questo file",
				"history.diffStats": "+%a / -%r righe modificate · %c invariate",
				"history.diffGone": " (il file non esiste più)",
				"history.diffHidden": "%n righe non modificate",
				"card.dryRun": "Test regole",
				"card.dryRunHint": "Giudica una chiamata contro le regole in vigore. Non esegue alcun strumento e non scrive alcuna regola — verifica qui prima di modificare.",
				"card.dryRunTool": "Strumento",
				"card.dryRunCommand": "Comando / argomenti",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Testa",
				"card.dryRunRunning": "Valutazione…",
				"card.dryRunEmpty": "Nulla di testato finora. Inserisci uno strumento e un comando, poi premi Testa per vedere il verdetto.",
				"card.dryRunVerdict": "Verdetto",
				"card.dryRunAllow": "consenti",
				"card.dryRunAsk": "richiedi",
				"card.dryRunDeny": "rifiuta",
				"card.dryRunRule": "Regola corrispondente",
				"card.dryRunRuleNone": "nessuna regola corrispondente; defaultAction: %d",
				"card.dryRunDimensions": "Dimensioni",
				"card.dryRunReason": "Motivo",
				"card.dryRunNote": "«Regola corrispondente» proviene dal livello regole. Quando il verdetto è prodotto da un rifiuto rigido precedente o dalla blacklist di parole chiave non c'è indice di regola — le dimensioni elencate sono solo informative.",
				"card.dryRunNoRules": "(0 regole caricate — controlla il percorso rulesFile)",
				"card.dryRunFail": "Test non riuscito: ",
				"card.dryRunStale": "route mancante (plugin non riavviato?)",
				"card.rules": "Regole integrate delle impostazioni",
				"card.rulesHint": "Le regole che il portale sta caricando ora (dal campo di configurazione rules di questa voce plugin; fallback al file regole se non configurato). Sola lettura — nulla qui può modificarle. Per cambiare le regole, usa la whitelist sotto o modificale nella pagina impostazioni.",
				"card.rulesRefresh": "Aggiorna",
				"card.rulesLoading": "Lettura…",
				"card.rulesPath": "Sorgente",
				"card.rulesNone": "nessuna regola configurata",
				"card.rulesCounts": "Regole",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b byte · %l righe",
				"card.rulesMissing": "Regole non trovate. Il portale ripiega sui suoi valori predefiniti integrati.",
				"card.rulesTruncated": "Regole grandi; mostrati solo i primi 512 KB.",
				"card.rulesError": "Caricamento non riuscito: ",
				"card.rulesStale": "route mancante (plugin non riavviato?)",
				"card.rulesNote": "Sola lettura: questo pannello non può modificare le regole. La sezione whitelist e «consenti sempre» scrivono nella configurazione di questa voce plugin.",
				"doubt.no-rule": "nessuna regola copre questa chiamata, la scelta predefinita è chiedere — non significa che sia pericolosa",
				"doubt.opaque": "il payload non è leggibile (codificato, script fuori dal workspace, o programma non riconosciuto), nessuna regola può individuare il bersaglio",
				"doubt.irreversible": "regola irreversibile: dopo l’esecuzione non si può annullare",
				"doubt.never-learn": "questa risposta non verrà imparata; la stessa domanda si ripresenterà",
				"doubt.delete": "elimina contenuto",
				"doubt.remote-write": "effetto visibile all’esterno (push / publish / richiesta di scrittura); annullare richiede intervento manuale",
				"doubt.exec-external": "esegue codice fuori dal workspace, non ispezionabile da questa chiamata",
				"doubt.outside-paths": "tocca percorsi fuori dal workspace",
				"doubt.model-flagged": "il modello di rischio lo ha segnalato (può solo elevare, non autorizzare)",
				"doubt.write": "scrive o modifica file",
				"verdict.rule": "Regola applicata",
				"verdict.grant": "Autorizzazione di sessione",
				"verdict.hard-deny": "Rifiuto netto",
				"verdict.deny-keyword": "Parola chiave in lista nera",
				"verdict.default": "Criterio predefinito",
				"verdict.ask": "Criterio predefinito",
				"verdict.permissive": "Consentito dopo verifica automatica",
				"verdict.classifier": "Verdetto LLM",
				"verdict.llm-safe": "LLM: giudicato sicuro",
				"verdict.llm-learned": "LLM: appreso consentito",
				"verdict.learned-sediment": "Regola consolidata: consentito",
				"verdict.learned-confirm": "Conferma di apprendimento",
				"verdict.human-approved": "Approvato da umano",
				"verdict.human-rejected": "Rifiutato da umano",
				"verdict.human-cancelled": "Annullato da umano",
				"verdict.no-approval-channel": "Nessun canale di approvazione",
				"verdict.preset-passthrough": "Criterio never · consentito",
				"verdict.stand-down": "Cancello disattivato",
				"verdict.yolo-allow": "YOLO consentito",
				"verdict.yolo-allow-no-reviewer": "YOLO consentito (nessun modello di revisione · gestione meccanica)",
				"verdict.yolo-block": "YOLO bloccato",
				"verdict.rules-fallback-allow": "Cancello a regole senza modello: consentito",
				"verdict.rules-fallback-block": "Cancello a regole senza modello: bloccato",
				"verdict.safety-net-passthrough-allow": "Verifica meccanica consentita (senza modello)",
				"verdict.safety-net-passthrough-block": "Verifica meccanica bloccata (senza modello)",
				"verdict.cleanup-safe": "Pulizia: consentito in sicurezza",
				"verdict.escalation-auto": "Escalation sandbox consentita automaticamente",
				"verdict.learned-granted": "Autorizzazione appresa",
				"verdict.network-ask": "Approvazione di rete",
				"card.scopeUnresolved": " (scope non risolto — segnaposto diagnostico)"
			},
			ru: {
				"card.title": "Автоматическая проверка",
				"section.title": "Шлюз автоматической проверки",
				"card.description": "Независимый уровень одобрения: параллельно с «только чтение» / «полный доступ» / «белый список», отображается как «Автоматическая проверка» в выборе разрешений сессии. Фронтенд предоставляет один переключатель; четыре серверные стратегии одобрения комбинируемы через эту панель и остаются fail-closed против жёсткого отказа P0.",
				"card.permissive": "Включить уровень автоматической проверки",
				"card.permissiveHint": "Когда выключено, шлюз ведёт себя точно так же, как раньше.",
				"card.unattended": "Режимы без подтверждения человеком",
				"card.unattendedHint": "Переключателя три, каждый управляет только тем уровнем, что написан рядом: выключить реализацию — значит вернуть этот уровень обычному человеческому потоку; тайно стать другим он не может.",
				"card.mode.ask": "Оставить человека",
				"card.mode.pass": "Механический пропуск",
				"card.askHint": "Механический отбор фильтрует и перечисляет сомнения, но запрос остаётся человеку, а модель-ревизор не вызывается ни разу — это форма для запусков без подключённого LLM-ревизора или когда токены не стоят затрат.",
				"card.passHint": "Работает только детерминированный механический судья: необратимое, невосстановимое или нечитаемое действие блокируется с причиной обратно основной модели, остальное выполняется. Ни вызова модели, ни вопроса человеку — проверенная форма approval: never и YOLO без модели.",
				"card.testing": "Тесты и диагностика",
				"card.lists": "Списки разрешений и блокировок",
				"card.credentials": "Защита учётных данных",
				"card.networkOps": "Сеть и горячая перезагрузка",
				"card.summaryOn": "вкл",
				"card.summaryOff": "выкл",
				"card.summaryNone": "нет",
				"card.summaryStrategies": "активно: %n",
				"card.summaryLists": "разрешено %a · заблокировано %d",
				"card.summaryCredRw": "readwrite: %n семейств",
				"card.summaryNetwork": "сеть %net · перезагрузка %w",
				"card.denylistPresetCollapse": "Встроенные ключевые слова (%n)",
				"card.denylistCustom": "Пользовательские ключевые слова",
				"card.yolo": "YOLO — никогда не спрашивать человека: блокировать опасное, остальное выполнять",
				"card.yoloExempt": "YOLO: разрешить и «неизвестное расположение» внутри рабочей области",
				"card.yoloExemptHint": "Только для YOLO. Если включено, вызов, у которого неопределимо только «расположение» (инструмент без аргументов, скрипт вне рабочей области, тело которого не прочитано), больше не блокируется как «невидимый». Кодированные полезные нагрузки, нечитаемые тела скриптов, удаления и удалённые записи по-прежнему блокируются; P0, учётные данные и необратимые действия не меняются никогда.",
				"card.yoloHint": "Блокирует необратимую / необучаемую / неразбираемую нагрузку или жёсткий вердикт модели и возвращает причину основной LLM сообщением 工具审核意见; остальное выполняется. Когда доступной модели нет, срабатывают только детерминированные сети.",
				"card.rulesFallback": "Деградировать в шлюз по правилам, когда модели нет (класс cc-safety-net)",
				"card.rulesFallbackHint": "Действует только когда проверяющая модель не настроена или не дала вердикта: детерминированные сети блокируют то, что могут назвать, и пропускают остальное, вместо того чтобы вешать вызов на окно, которое никто не ответит. Пока модель отвечает, поведение не меняется.",
				"card.allowProtectedBranchPush": "Разрешить force-push в защищённые ветки (по умолчанию выкл = пол стоит)",
				"card.allowProtectedBranchPushHint": "По умолчанию пол P0 блокирует git push --force/--force-with-lease/--delete в main/master/production/release/stable (модель не может понизить). При включении пол отступает и три плоских push-ключа из чёрного списка освобождаются; вызов попадает в правило git.push-force, которое всё равно спрашивает человека, пока вы не отзовете запись или не добавите его в allowlist. Ничего другое не расширяется: удаления, редиректы и пол учётных данных остаются взведены.",
				"card.credFamily": "Ступени семей учётных данных",
				"card.credFamilyHint": "Одна ступень на семейство: deny = блокирует чтение и запись; ask = чтение с подтверждением человека (по умолчанию); readonly = чтение свободно, запись по-прежнему твёрдо блокируется полом P0; readwrite = клауза записи credential-store отступает для этого семейства (случай npm login). Остальные полы (корни, защищённые пути, .dsh, эксфильтрация) взведены на любой ступени. Состояние живёт в строке документа правил и в списке изъятий записи; карта пишет оба вместе.",
				"card.credFamilyLoading": "Загрузка ступеней…",
				"card.credFamilyFootnote": "Безчеловечные уровни (механический пропуск / YOLO) пропускают остаток ask — для жёсткой блокировки выберите deny. Свои credentialPaths никогда не участвуют в изъятии записи.",
				"card.credReadwriteConfirm": "readwrite разрешает запись/изменение файлов учётных данных этого семейства (перезапись ~/.npmrc). Единственная ступень, отступающая часть P0. Подтвердить?",
				"card.credConfirmYes": "Подтвердить",
				"card.credConfirmNo": "Отмена",
				"card.credRung.deny": "блок",
				"card.credRung.ask": "спрос",
				"card.credRung.readonly": "только чтение",
				"card.credRung.readwrite": "чтение запись",
				"card.scriptReview": "Прилагать содержимое скриптов к проверке (по умолчанию включено)",
				"card.scriptReviewHint": "Когда вызов запускает скрипт-файл, его тело читается и даётся модели риска и человеку, и детерминированные сети тоже оценивают тело (удаление, видимое только внутри файла, — ровно то, что пропускалось). Тела маскируются и ограничиваются по длине до отправки; отключение оставляет содержимое файлов локально, ценой возврата скриптов вне рабочей области в уровень «неразбираемо».",
				"card.credentialPaths": "Свои пути к учётным данным (длинный хвост)",
				"card.autoAllowTools": "Автоматически разрешённые инструменты (без запроса)",
				"card.autoAllowToolsHint": "Инструменты из этого списка трактуются как read/grep: без всплывающего окна и без проверки моделью. Жёсткий отказ P0 и правила по путям действуют по-прежнему. Предназначено для безопасных инструментов, зарегистрированных вашими плагинами.",
				"card.autoAllowToolsPlaceholder": "Имя инструмента, напр. my_safe_tool",
				"card.credentialPathsHint": "Секретные файлы, которых нет во встроенном списке. Записи — это глобы путей: двойная звёздочка переходит между каталогами, одиночная звёздочка и вопросительный знак остаются внутри одного сегмента; без маска-символов совпадение идёт по целому фрагменту пути (token не попадёт в ambient.txt); ведущий ~/ раскрывается в ваш home; относительный шаблон совпадает и на любой глубине (secrets/*.env покрывает a/b/secrets/prod.env). Совпадение держится по тому же стандарту, что и .ssh: чтение вне рабочей области и изменение файловым инструментом жёстко отклоняются — этот уровень нельзя оспорить и не обходят проверяющей моделью, поэтому объявляйте только те пути, которые действительно нужно защитить.",
				"card.credentialPathsPlaceholder": "Новый путь, напр. ~/.myco/vault.token или secrets/*.env",
				"card.denyKeywordsExtra": "Добавляемые ключевые слова чёрного списка (не заменяют пресет)",
				"card.denyKeywordsExtraHint": "Детерминированная блокировка для ваших собственных терминов — подкоманда отзыва/стирания внутреннего CLI, префикс выдаваемого вами токена. Этот список только добавляет: что бы ни содержал чёрный список выше (пресет или ваша замена), эти слова сливаются с ним.",
				"card.listRemove": "Удалить эту запись",
				"card.extraContentArgKeys": "Дополнительные ключи документов (не читаются как операция)",
				"card.extraContentArgKeysHint": "Имена полей вне встроенного списка (content/text/plan…): после добавления их текст не попадает в плоское чтение опасных слов и форм учётных данных. Только дополняет — встроенный список не заменяется, потому что пропуск одного из его ключей молча вернёт баг, когда план отклоняют за само описание работы. Реально выполняемая команда и изменяемый путь проверяются своими путями; этот список их не отключает.",
				"card.extraContentArgKeysPlaceholder": "Новое имя аргумента, напр. steps",
				"card.extraOperationArgKeys": "Дополнительные ключи операций (читать поле как исполняемый код)",
				"card.extraOperationArgKeysHint": "Канал для полей, чьё тело действительно исполняется (workflowYaml и т. п.): их текст попадает в чёрный список и проверку учётных данных, и при совпадении ключа выигрывает этот список. Цена: вписав сюда настоящий документ, вы снова делаете «в плане упоминается rm -rf» причиной отказа.",
				"card.scopeNote": "Область пресета: этот шлюз действует только когда пресет разрешений сессии — %scope. При любом другом пресете весь шлюз отключается — включая жёсткий отказ P0 — и политика выбранного пресета берёт управление на себя. Отключение записывает событие и оставляет постоянную полоску над полем ввода.",
				"card.strategies": "Серверные стратегии одобрения (хотя бы одна активна; комбинируемы)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — безопасные операции в области автоматически разрешаются; опасные/неизвестные → запрос (базовый средний уровень)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — каждый переход спрашивает; «элементы управления разрешением» панели одобрения получают две расширенные кнопки: «повторно разрешить этот тип в этой сессии» (ограниченный grant сессии) и «разрешить все вхождения» (постоянное добавление слова команды в белый список rulesFile)",
				"card.strategy.llmAssist": "llmAssist — пользовательская LLM оценивает риск: safe → авто-разрешение; deletion/credential/remote/system/bulk → жёсткие риски сохраняют запрос к человеку (классификатор никогда не отказывает — только эскалирует); neutral → обучение подтверждением; сбой/таймаут → возврат к человеку",
				"card.strategy.trustEscalation": "trustEscalation — эскалация песочницы без запроса: для вызова, уже разрешённого этим шлюзом, расширение песочницы, инициированное shell / pwsh / edit изнутри инструмента, одобряется здесь вместо запроса к вам",
				"card.strategy.trustEscalationHint": "Запрос на одобрение эскалации песочницы происходит изнутри тела инструмента после tools/pre-execute, поэтому шлюз его не видит — вызов, который LLM оценила как безопасный и шлюз авто-разрешил, всё равно спрашивал вас об одобрении расширения. При включении только точный вызов, разрешённый шлюзом (совпадение по callId), пропускает запрос; всё остальное идёт к человеку как раньше, равно как и любая нераспознанная причина или цель, отличная от workspace-write / danger-full-access. Выключите, чтобы расширение оставалось под контролем человека.",
				"card.readonly": "Только чтение",
				"card.unavailable": "Пространство имён настроек недоступно: убедитесь, что dsh-perm-gate собран в этом профиле.",
				"card.llmReceiver": "Принимающая LLM для llmAssist (совместимая с OpenAI; любой пользовательский API)",
				"card.llmEndpoint": "Endpoint (BaseURL, напр. https://api.openai.com/v1)",
				"card.llmModel": "Model (идентификатор модели, напр. deepseek-chat)",
				"card.llmEffort": "Усилие рассуждения (только режим host)",
				"card.llmEffortHost": "Как у хоста",
				"card.llmEffortHint": "Пусто = не навязывать, решает конфигурация модели хоста; выберите low или off, если хост отклоняет.",
				"card.llmKey": "API Key (секрет)",
				"card.llmKeyHidden": "Не задан · после первого ввода отображается как *",
				"card.llmKeyMasked": "Задан · введите новое значение для перезаписи",
				"card.llmKeyOverwrite": "Секретное значение сохранено; введите новое значение и покиньте поле для перезаписи.",
				"card.llmKeyClear": "Очистить",
				"card.allowlist": "Белый список (allow, синхронизирован с rulesFile)",
				"card.allowlistHint": "Паттерны в секции allow разрешаются напрямую; добавляйте или удаляйте записи по одной, они записываются в rulesFile и перезагружаются в реальном времени.",
				"card.allowlistPresetNote": "Эквивалент пресетного белого списка — стратегия trustAutoAllow (безопасные операции в области автоматически разрешаются), активируется в секции стратегий выше; этот список отражает вашу секцию allow в rulesFile и закономерно начинается пустым.",
				"card.allowlistEmpty": "Нет правил белого списка",
				"card.allowlistPlaceholder": "Новый паттерн команды, напр. npm test*",
				"card.allowlistAdd": "Добавить",
				"card.allowlistRemove": "Удалить этот паттерн",
				"card.allowlistBulk": "Массовое редактирование",
				"card.allowlistBulkHide": "Скрыть массовое редактирование",
				"card.allowlistSave": "Сохранить белый список",
				"card.riskLearning": "riskLearning — обучение вердиктам: операции с нейтральным риском, одобренные человеком и выполненные, подсчитываются; та же операция автоматически разрешается при достижении порога с совпадающим отпечатком",
				"card.riskLearningHint": "Состояние обучения принадлежит плагину ($DSH_HOME/perm-gate/learning.json) и никогда не записывается в ваши YAML-правила; другая цель никогда не переиспользует полномочие. По умолчанию выключено.",
				"card.riskThreshold": "Подтверждений человеком перед авто-разрешением (1–10)",
				"notice.label": "Активность шлюза разрешений",
				"history.label": "Одобрения",
				"history.title": "Журнал одобрений разрешений",
				"history.subtitle": "Каждое решение шлюза в этой сессии, последние сверху",
				"history.loading": "Загрузка…",
				"history.empty": "В этой сессии пока нет записей одобрения",
				"history.error": "Ошибка загрузки: ",
				"history.tag.auto": "Авто-разрешено",
				"history.tag.ask": "Запрошено",
				"history.tag.deny": "Отклонено",
				"card.denylistRestore": "Восстановить пресетный чёрный список",
				"card.denylist": "Чёрный список (ключевые слова deny, пресет плагина)",
				"card.denylistHint": "Вызов, текст которого содержит ключевое слово (подстрока без учёта регистра), немедленно отклоняется — до белого списка / grants / LLM. Пресетный список наследуется от dsh-approval-gate и активен с момента установки; редактируйте свободно — пустой или очищенный возвращается к пресету (восстановление в один клик), поэтому чёрный список никогда не отключается молча.",
				"card.denylistEmpty": "Чёрный список пуст (ни один вызов не отклоняется на уровне ключевых слов)",
				"card.denylistPlaceholder": "Новое ключевое слово, напр. drop database",
				"card.denylistAdd": "Добавить",
				"card.denylistRemove": "Удалить это ключевое слово",
				"card.denylistTagPreset": "Пресет",
				"card.denylistTagCustom": "Пользовательское",
				"card.riskSediment": "riskSediment — седиментация обучения: образцы, достигшие порога, становятся детерминированными правилами авто-разрешения",
				"card.riskSedimentHint": "При включении, когда ключ tool|category достигает порога, отпечатки его образцов оседают в правила разрешения — точное совпадение тот же инструмент/та же цель разрешает напрямую без нового вызова LLM (продолжает работать с выключенным llmAssist).",
				"card.sediment": "Осадок обучения (детерминированные правила разрешения)",
				"card.sedimentHint": "Правила, осевшие из подтверждений человека: только точное совпадение отпечатка разрешает, никогда другая цель. Завершите одно обучение или удалите один образец.",
				"card.learningScope": "Область данных обучения",
				"card.learningScopeGlobal": "Глобально (по умолчанию)",
				"card.learningScopeSession": "По сессиям",
				"card.learningScopeHint": "Глобально: подтверждённая в любой сессии операция снижает порог для всех сессий (прежнее поведение). По сессиям: учитываются только подтверждения этой сессии, а существующее глобальное правило не действует, пока вы явно не повысите его в списке осадка.",
				"attention.title": "Оповещения о подтверждении",
				"attention.hint": "Как до вас доходит запрос. Два переключателя независимы: по умолчанию показывается только строка решения (как сейчас); со включённым звуком вы услышите запрос, даже не глядя в диалог.",
				"attention.toast": "Показывать строку решения",
				"attention.sound": "Звук",
				"attention.gap": "Минимальный интервал на сессию (мс)",
				"attention.test": "Прослушать",
				"card.sedimentEmpty": "Пока нет осаждённых правил (образцы, достигшие порога, появятся здесь)",
				"card.sedimentCount": "подтверждено %n/%t",
				"card.sedimentStop": "Завершить",
				"card.sedimentStopTitle": "Завершить это обучение (удаляет счётчик и образцы)",
				"card.sedimentStopConfirm": "Завершить обучение для «%k»? Его счётчик и все образцы будут удалены.",
				"card.sedimentSampleRemove": "Удалить этот осаждённый образец",
				"card.llmSource": "Источник принимающей LLM",
				"card.llmSourceCustom": "Пользовательский API (совместимый с OpenAI)",
				"card.llmSourceHost": "Использовать текущую модель по умолчанию сессии (сервис DSH llm)",
				"card.llmSourceHostHint": "По умолчанию оценка одобрения выполняется на группе моделей, выбранной в текущей сессии DSH (эффективное значение показано ниже); оставьте Provider / Model пустым, чтобы следовать за сессией, или выберите из выпадающего списка / введите для фиксации — ваши пользовательские группы, настроенные в DSH (напр. local-35b), появляются автоматически.",
				"card.llmProvider": "Provider (пусто = следует выбору сессии)",
				"card.llmProviderPlaceholder": "Следует выбору сессии",
				"card.llmModelHostPlaceholder": "Пусто = следует выбору сессии",
				"card.llmResolved": "Текущий эффективный: %p / %m",
				"card.llmPreset": "Пресеты эндпоинтов (заполняет поля; далее редактируемо)",
				"card.llmPresetChoose": "Выбрать пресет…",
				"card.llmPresetPublic": "Пресеты публичных API",
				"card.llmPresetHost": "Группы моделей DSH (выбор переключает на приёмник сессии)",
				"card.networkEnabled": "Перехват сети (networkEnabled)",
				"card.networkEnabledHint": "При включении запускается локальный прокси, перехватывающий исходящие соединения подпроцессов и применяющий правила разрешения/отказа. Выключено = никаких изменений поведения.",
				"card.watch": "Горячая перезагрузка правил (watch)",
				"card.watchHint": "При включении автоматически отслеживает изменения файлов правил и применяет их мгновенно без ручной перезагрузки.",
				"card.networkRebindNote": "Вступает в силу немедленно — прокси автоматически перепривязывается, перезагрузка плагина не нужна.",
				"card.networkInjectEnv": "Инъекция переменных окружения прокси (networkInjectEnv)",
				"card.networkInjectEnvHint": "Записывает HTTP(S)_PROXY / ALL_PROXY для подпроцессов (и очищает NO_PROXY). Выключено = слушатель работает, но окружение процессов не изменяется.",
				"card.healthStale": "Маршрут хоста недоступен (404) — половина node всё ещё старой сборки; полностью перезапустите dsh (не только страницу браузера) и повторите.",
				"card.healthTest": "Тест состояния",
				"card.healthRunning": "Тестирование…",
				"card.healthOk": "OK (%ms мс)",
				"card.healthFail": "Ошибка: ",
				"history.tag.learned": "Изучено",
				"history.tag.manualApproved": "Одобрено",
				"history.tag.manualRejected": "Отклонено",
				"history.tag.manualCancelled": "Отменено",
				"history.tag.standDown": "Шлюз выключен",
				"history.learnedProgress": "изучено %n/%t",
				"history.snapshots": "снимки diff",
				"history.clearSession": "Очистить эту сессию",
				"history.clearAll": "Очистить всё",
				"history.clearSessionTitle": "Очистить только снимки diff этой сессии (другие сессии не затрагиваются)",
				"history.clearAllTitle": "Очистить снимки diff всех сессий, включая непросмотренные — запрашивает подтверждение",
				"history.clearSessionConfirm": "Очистить снимки diff этой сессии? Удаляются только данные сравнения, созданные одобрениями этой сессии; записи одобрений остаются.",
				"history.clearAllConfirm": "Очистить снимки diff ВСЕХ сессий? Это может удалить сравнения, которые другие сессии ещё не просмотрели, и необратимо.",
				"history.diffTitle": "Сравнение изменений файла",
				"history.diffClose": "Закрыть",
				"history.diffLoading": "Загрузка…",
				"history.diffEmpty": "Нет изменений содержимого (или файл нечитаем)",
				"history.diffLoadFail": "Ошибка загрузки diff: ",
				"history.diffRevert": "Отменить это изменение",
				"history.diffReverting": "Отправка…",
				"history.diffRevertDone": "Инструкция отмены отправлена",
				"history.diffRevertSent": "Инструкция отмены отправлена в диалог; ИИ восстановит файл соответственно",
				"history.diffRevertFail": "Ошибка отправки: ",
				"history.diffNoSnapshot": "У этого события нет снимка для данного файла",
				"history.diffChipTitle": "Просмотреть сравнение изменений этого файла",
				"history.diffStats": "+%a / -%r строк изменено · %c без изменений",
				"history.diffGone": " (файл больше не существует)",
				"history.diffHidden": "%n неизменённых строк",
				"card.dryRun": "Тест правил",
				"card.dryRunHint": "Оценивает один вызов по действующим правилам. Не выполняет инструмент и не записывает правило — проверьте здесь перед изменением.",
				"card.dryRunTool": "Инструмент",
				"card.dryRunCommand": "Команда / аргументы",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Тестировать",
				"card.dryRunRunning": "Оценка…",
				"card.dryRunEmpty": "Пока ничего не протестировано. Укажите инструмент и команду, затем нажмите «Тестировать», чтобы увидеть вердикт.",
				"card.dryRunVerdict": "Вердикт",
				"card.dryRunAllow": "разрешить",
				"card.dryRunAsk": "запросить",
				"card.dryRunDeny": "отклонить",
				"card.dryRunRule": "Совпавшее правило",
				"card.dryRunRuleNone": "ни одно правило не совпало; defaultAction: %d",
				"card.dryRunDimensions": "Измерения",
				"card.dryRunReason": "Причина",
				"card.dryRunNote": "«Совпавшее правило» происходит из уровня правил. Когда вердикт выработан более ранним жёстким отказом или чёрным списком ключевых слов, индекса правила нет — перечисленные измерения носят справочный характер.",
				"card.dryRunNoRules": "(загружено 0 правил — проверьте путь rulesFile)",
				"card.dryRunFail": "Ошибка теста: ",
				"card.dryRunStale": "маршрут отсутствует (плагин не перезапущен?)",
				"card.rules": "Встроенные правила настроек",
				"card.rulesHint": "Правила, которые шлюз загружает сейчас (из поля конфигурации rules этой записи плагина; откат к файлу правил, если не настроено). Только чтение — ничто здесь не может их изменить. Чтобы изменить правила, используйте белый список ниже или редактируйте на странице настроек.",
				"card.rulesRefresh": "Обновить",
				"card.rulesLoading": "Чтение…",
				"card.rulesPath": "Источник",
				"card.rulesNone": "правила не настроены",
				"card.rulesCounts": "Правила",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b байт · %l строк",
				"card.rulesMissing": "Правила не найдены. Шлюз откатывается к встроенным значениям по умолчанию.",
				"card.rulesTruncated": "Правила большие; показаны только первые 512 КБ.",
				"card.rulesError": "Ошибка загрузки: ",
				"card.rulesStale": "маршрут отсутствует (плагин не перезапущен?)",
				"card.rulesNote": "Только чтение: эта панель не может изменять правила. Секция белого списка и «всегда разрешать» записывают обратно в конфигурацию этой записи плагина.",
				"doubt.no-rule": "ни одно правило не покрывает этот вызов, по умолчанию спрашивается человек — это не значит что он опасен",
				"doubt.opaque": "нагрузка не читается (закодирована, скрипт за пределами рабочей зоны, или не распознаётся программа), правило не может определить цель",
				"doubt.irreversible": "правило: необратимо, отменить после выполнения нельзя",
				"doubt.never-learn": "это решение не запомнится, тот же вызов спросит снова",
				"doubt.delete": "удаляет данные",
				"doubt.remote-write": "видимый снаружи эффект (push / publish / запись); отмена требует ручных действий",
				"doubt.exec-external": "выполняет код за пределами рабочего пространства, не подлежит инспекции",
				"doubt.outside-paths": "затрагивает пути вне рабочего пространства",
				"doubt.model-flagged": "модель риска пометила (только усиливает, не снижает)",
				"doubt.write": "записывает или изменяет файлы",
				"verdict.rule": "Правило сработало",
				"verdict.grant": "Разрешение сеанса",
				"verdict.hard-deny": "Жёсткий отказ",
				"verdict.deny-keyword": "Ключевое слово из чёрного списка",
				"verdict.default": "Политика по умолчанию",
				"verdict.ask": "Политика по умолчанию",
				"verdict.permissive": "Автопроверка разрешила",
				"verdict.classifier": "Вердикт LLM",
				"verdict.llm-safe": "LLM: признано безопасным",
				"verdict.llm-learned": "LLM: обучено — разрешено",
				"verdict.learned-sediment": "Закреплённое правило: разрешено",
				"verdict.learned-confirm": "Подтверждение обучения",
				"verdict.human-approved": "Одобрено человеком",
				"verdict.human-rejected": "Отклонено человеком",
				"verdict.human-cancelled": "Отменено человеком",
				"verdict.no-approval-channel": "Нет канала одобрения",
				"verdict.preset-passthrough": "Политика never · разрешено",
				"verdict.stand-down": "Шлюз выключен",
				"verdict.yolo-allow": "YOLO: разрешено",
				"verdict.yolo-allow-no-reviewer": "YOLO: разрешено (без модели-ревьюера · механически)",
				"verdict.yolo-block": "YOLO: заблокировано",
				"verdict.rules-fallback-allow": "Шлюз правил без модели: разрешено",
				"verdict.rules-fallback-block": "Шлюз правил без модели: заблокировано",
				"verdict.safety-net-passthrough-allow": "Механическая проверка: разрешено (без модели)",
				"verdict.safety-net-passthrough-block": "Механическая проверка: заблокировано (без модели)",
				"verdict.cleanup-safe": "Очистка: безопасное разрешение",
				"verdict.escalation-auto": "Повышение песочницы: авторазрешение",
				"verdict.learned-granted": "Выученное разрешение",
				"verdict.network-ask": "Сетевые одобрения",
				"card.scopeUnresolved": " (scope не разрешён — заглушка диагностики)"
			},
			es: {
				"card.title": "Revisión automática",
				"section.title": "Compuerta de revisión automática",
				"card.description": "Nivel de aprobación independiente: paralelo a solo lectura / acceso completo / lista blanca, mostrado como «Revisión automática» en el selector de permisos de sesión. El frontend expone un único interruptor; las cuatro estrategias de aprobación del backend son combinables mediante este panel y permanecen fail-closed contra la denegación dura P0.",
				"card.permissive": "Habilitar el nivel de revisión automática",
				"card.permissiveHint": "Cuando está desactivado, la compuerta se comporta exactamente igual que antes.",
				"card.unattended": "Modos sin supervisión",
				"card.unattendedHint": "Tres interruptores, cada uno gobierna solo el nivel escrito a su lado: apagar una implementación devuelve ese nivel al flujo humano ordinario, sin convertirse a escondidas en otro.",
				"card.mode.ask": "Mantener humano",
				"card.mode.pass": "Paso mecánico",
				"card.askHint": "El tamiz mecánico filtra y enumera sus dudas, pero la solicitud sigue quedando con una persona y no se llama al modelo revisor ni una vez — la forma para ejecuciones sin LLM revisor conectado, o cuando los tokens no valen la pena.",
				"card.passHint": "Ejecuta solo el juez mecánico determinista: una operación irreversible, irrecuperable o ilegible se bloquea y se devuelve justificada al modelo principal; lo demás corre. Ninguna llamada al modelo, ninguna pregunta humana: la forma revisada de approval: never, y un YOLO sin modelo.",
				"card.testing": "Pruebas y diagnóstico",
				"card.lists": "Listas de permisos y bloqueos",
				"card.credentials": "Protección de credenciales",
				"card.networkOps": "Red y recarga en caliente",
				"card.summaryOn": "sí",
				"card.summaryOff": "no",
				"card.summaryNone": "ninguno",
				"card.summaryStrategies": "%n activadas",
				"card.summaryLists": "%a permitidos · %d bloqueados",
				"card.summaryCredRw": "readwrite: %n familias",
				"card.summaryNetwork": "red %net · recarga %w",
				"card.denylistPresetCollapse": "Palabras integradas (%n)",
				"card.denylistCustom": "Palabras personalizadas",
				"card.yolo": "YOLO — nunca pedir un humano: bloquear lo peligroso, ejecutar el resto",
				"card.yoloExempt": "YOLO: permitir también “ubicación desconocida” dentro del workspace",
				"card.yoloExemptHint": "Solo YOLO. Activado, una llamada en la que solo la “ubicación” es indeterminable (herramienta sin argumentos, script fuera del workspace cuyo cuerpo no se leyó) ya no se bloquea por “invisible”. Las cargas codificadas, los cuerpos ilegibles, los borrados y las escrituras remotas siguen bloqueados; P0, credenciales e irreversible nunca cambian.",
				"card.yoloHint": "Bloquea una carga irreversible / no aprendible / ilegible, o un veredicto de riesgo duro del modelo, y devuelve la razón al LLM principal como mensaje 工具审核意见; todo lo demás se ejecuta. Sin un modelo disponible, solo las redes deterministas interceptan.",
				"card.rulesFallback": "Degradar a una compuerta de reglas cuando no hay modelo (clase cc-safety-net)",
				"card.rulesFallbackHint": "Solo actúa cuando el revisor de riesgo no está configurado o no dio veredicto: las redes deterministas bloquean lo que saben nombrar y dejan pasar el resto, en lugar de dejar la llamada colgada en un emergente que nadie responderá. Mientras un modelo responde, el comportamiento no cambia.",
				"card.allowProtectedBranchPush": "Permitir force-push a ramas protegidas (por defecto off = suelo activo)",
				"card.allowProtectedBranchPushHint": "Por defecto el suelo P0 bloquea git push --force/--force-with-lease/--delete hacia main/master/production/release/stable (no degradable por el modelo). Al activarlo el suelo se aparta y se eximen las tres palabras push planas de la lista negra; la llamada cae en la regla git.push-force integrada, que aún pregunta a una persona salvo que revoques esa entrada o la añada a la allowlist. Nada más se amplía: borrados, redirecciones y el suelo de credenciales siguen armados.",
				"card.credFamily": "Escalón por familia de credenciales",
				"card.credFamilyHint": "Un escalón por familia: deny = lectura y escritura bloqueadas; ask = lectura con validación humana (predeterminado); readonly = lectura libre, la escritura sigue bloqueada por el suelo P0; readwrite = la cláusula de escritura del credential store se aparta para esta familia (caso npm login). Los demás suelos (raíces, rutas protegidas, .dsh, exfiltración) siguen armados en cualquier escalón. El estado vive en la fila del documento de reglas más la lista de exención; esta tarjeta escribe ambas juntas.",
				"card.credFamilyLoading": "Cargando escalones…",
				"card.credFamilyFootnote": "Los niveles sin humano (paso mecánico / YOLO) dejan pasar el residuo de los ask — elige deny para bloquear duro. Los credentialPaths personalizados nunca participan en la exención de escritura.",
				"card.credReadwriteConfirm": "readwrite permite escribir/modificar los archivos de credenciales de esta familia (reescribir ~/.npmrc). Es el único escalón que aparta parte del P0. ¿Confirmar?",
				"card.credConfirmYes": "Confirmar",
				"card.credConfirmNo": "Cancelar",
				"card.credRung.deny": "bloquear",
				"card.credRung.ask": "preguntar",
				"card.credRung.readonly": "solo lectura",
				"card.credRung.readwrite": "lectura escritura",
				"card.scriptReview": "Adjuntar el contenido de los scripts a la revisión (activado por defecto)",
				"card.scriptReviewHint": "Cuando una llamada ejecuta un archivo script, su cuerpo se lee y se da al modelo de riesgo y al humano por igual, y las redes deterministas también evalúan el cuerpo (un borrado que solo se ve dentro del archivo es justo lo que se escapaba). Los cuerpos se redactan y limitan antes de salir del host; desactivarlo mantiene el contenido de archivos local, al costo de devolver los scripts fuera del espacio de trabajo al nivel «ilegible».",
				"card.credentialPaths": "Rutas de credenciales personalizadas (la cola larga)",
				"card.autoAllowTools": "Herramientas de auto-permitido (sin pregunta)",
				"card.autoAllowToolsHint": "Las herramientas de esta lista se tratan como read/grep: sin ventana emergente ni revisión del modelo. La denegación dura P0 y las reglas de ruta siguen vigentes. Úselo para nombres de herramientas seguras registradas por sus propios plugins.",
				"card.autoAllowToolsPlaceholder": "Nombre de herramienta, p. ej. my_safe_tool",
				"card.credentialPathsHint": "Archivos secretos que la lista integrada no conoce. Las entradas son globos de ruta: un doble asterisco cruza directorios, un asterisco simple y un signo de interrogación se quedan dentro de un segmento; sin comodines se compara un fragmento de ruta completo (token no toca ambient.txt); un ~/ inicial se expande a tu home; un patrón relativo también coincide a cualquier profundidad (secrets/*.env cubre a/b/secrets/prod.env). Una coincidencia se trata al mismo estándar que .ssh: leerla fuera del espacio de trabajo y mutarla con una herramienta de archivo se deniegan de forma dura — ese nivel no se puede apelar ni sortear por el revisor, así que declara solo las rutas que de verdad necesitas proteger.",
				"card.credentialPathsPlaceholder": "Nueva ruta, p. ej. ~/.myco/vault.token o secrets/*.env",
				"card.denyKeywordsExtra": "Palabras clave añadidas a la blacklist (no reemplaza el preajuste)",
				"card.denyKeywordsExtraHint": "Un bloqueo determinista sobre términos propios — una subcomando de revocación/borrado de una CLI interna, un prefijo de token que emites. Esta lista solo añade: lo que contenga la blacklist de arriba (preajuste o tu propio reemplazo), estas palabras se fusionan.",
				"card.listRemove": "Quitar esta entrada",
				"card.extraContentArgKeys": "Claves de documento añadidas (nunca leídas como operación)",
				"card.extraContentArgKeysHint": "Nombres de campos documentales fuera de la lista integrada (content/text/plan…): una vez declarados, su texto deja de entrar en la lectura plana de palabras peligrosas y formas de credenciales. Solo se añade: la lista integrada no se reemplaza, porque olvidar una de sus claves traería de vuelta en silencio el fallo por el que un plan se rechaza por describir una acción. El comando realmente ejecutado y la ruta modificada se juzgan por sus propios caminos; esta lista no puede apagarlos.",
				"card.extraContentArgKeysPlaceholder": "Nuevo nombre de argumento, p. ej. steps",
				"card.extraOperationArgKeys": "Claves de operación añadidas (leer el campo como código que se ejecuta)",
				"card.extraOperationArgKeysHint": "Una vía para campos cuyo cuerpo sí se ejecuta (workflowYaml etc.): su texto entra en la blacklist y en el filtro de credenciales, y esta lista gana si ambas nombran la misma clave. Costo: declarar aquí un campo documental real vuelve a hacer que «el plan menciona rm -rf» sea motivo de rechazo.",
				"card.scopeNote": "Ámbito del preajuste: esta compuerta solo actúa mientras el preajuste de permisos de la sesión sea %scope. Bajo cualquier otro preajuste la compuerta completa se retira — incluida la denegación dura P0 — y la política del preajuste seleccionado toma el control. La retirada registra un evento y deja una franja persistente sobre la entrada.",
				"card.strategies": "Estrategias de aprobación del backend (al menos una activa; combinables)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — las operaciones seguras dentro del ámbito se auto-permiten; peligrosas/desconocidas → consulta (nivel intermedio base)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — cada cruce pregunta; los «controles de permiso» del panel de aprobación reciben dos botones extendidos: «repetir permiso para este tipo esta sesión» (grant acotado de sesión) y «permitir todas las ocurrencias» (persistir la palabra de comando en la lista blanca de rulesFile)",
				"card.strategy.llmAssist": "llmAssist — un LLM personalizado evalúa el riesgo: safe → auto-permiso; deletion/credential/remote/system/bulk → riesgos duros mantienen la consulta humana (el clasificador nunca deniega — solo escala); neutral → aprendizaje por confirmación; fallo/timeout → retorno al humano",
				"card.strategy.trustEscalation": "trustEscalation — escalado de sandbox sin aviso: para una llamada ya permitida por esta compuerta, la ampliación de sandbox iniciada internamente por shell / pwsh / edit se aprueba aquí en lugar de preguntarte",
				"card.strategy.trustEscalationHint": "La aprobación del escalado de sandbox se solicita desde dentro del cuerpo de la herramienta, después de tools/pre-execute, así que la compuerta nunca la ve — una llamada que el LLM calificó como segura y que la compuerta auto-permitió aun así te pedía aprobar la ampliación. Activado, solo la llamada exacta que la compuerta permitió (coincidencia por callId) omite el aviso; todo lo demás va al humano como antes, al igual que cualquier motivo no reconocido o un destino distinto de workspace-write / danger-full-access. Desactívalo para mantener la ampliación bajo control humano.",
				"card.readonly": "Solo lectura",
				"card.unavailable": "Espacio de nombres de configuración no disponible: asegúrate de que dsh-perm-gate esté ensamblado en este perfil.",
				"card.llmReceiver": "LLM receptor de llmAssist (compatible con OpenAI; cualquier API personalizada)",
				"card.llmEndpoint": "Endpoint (BaseURL, ej. https://api.openai.com/v1)",
				"card.llmModel": "Model (id del modelo, ej. deepseek-chat)",
				"card.llmEffort": "Esfuerzo de razonamiento (solo modo host)",
				"card.llmEffortHost": "Seguir el host",
				"card.llmEffortHint": "Vacío = no imponer nada, decide la configuración del modelo del host; cambia a low u off si el host lo rechaza.",
				"card.llmKey": "API Key (secreta)",
				"card.llmKeyHidden": "No establecida · se muestra como * tras la primera entrada",
				"card.llmKeyMasked": "Establecida · introduce un nuevo valor para sobrescribir",
				"card.llmKeyOverwrite": "Hay un valor secreto almacenado; introduce un nuevo valor y sal del campo para sobrescribirlo.",
				"card.llmKeyClear": "Borrar",
				"card.allowlist": "Lista blanca (allow, sincronizada con rulesFile)",
				"card.allowlistHint": "Los patrones en la sección allow se permiten directamente; agrega o elimina entradas una por una, se escriben en rulesFile y se recargan en vivo.",
				"card.allowlistPresetNote": "El equivalente de la lista blanca predefinida es la estrategia trustAutoAllow (operaciones seguras en el ámbito auto-permitidas), habilitada en la sección de estrategias de arriba; esta lista refleja tu sección allow de rulesFile y legítimamente comienza vacía.",
				"card.allowlistEmpty": "Sin reglas de lista blanca",
				"card.allowlistPlaceholder": "Nuevo patrón de comando, ej. npm test*",
				"card.allowlistAdd": "Agregar",
				"card.allowlistRemove": "Eliminar este patrón",
				"card.allowlistBulk": "Edición masiva",
				"card.allowlistBulkHide": "Ocultar edición masiva",
				"card.allowlistSave": "Guardar lista blanca",
				"card.riskLearning": "riskLearning — aprendizaje de veredictos: las operaciones de riesgo neutral aprobadas por el humano y ejecutadas se contabilizan; la misma operación se auto-permite al umbral con huella coincidente",
				"card.riskLearningHint": "El estado de aprendizaje pertenece al plugin ($DSH_HOME/perm-gate/learning.json) y nunca se escribe en tus reglas YAML; un destino diferente nunca reutiliza la autoridad. Desactivado por defecto.",
				"card.riskThreshold": "Confirmaciones humanas requeridas antes del auto-permiso (1–10)",
				"notice.label": "Actividad de la compuerta de permisos",
				"history.label": "Aprobaciones",
				"history.title": "Registro de aprobaciones de permisos",
				"history.subtitle": "Cada decisión de la compuerta en esta sesión, más recientes primero",
				"history.loading": "Cargando…",
				"history.empty": "Aún no hay registros de aprobación en esta sesión",
				"history.error": "Error al cargar: ",
				"history.tag.auto": "Auto-permitido",
				"history.tag.ask": "Consultado",
				"history.tag.deny": "Denegado",
				"card.denylistRestore": "Restaurar lista negra predefinida",
				"card.denylist": "Lista negra (palabras clave deny, preajuste del plugin)",
				"card.denylistHint": "Una llamada cuyo texto contiene una palabra clave (subcadena sin distinción de mayúsculas) se deniega de inmediato, antes que lista blanca / grants / LLM. La lista predefinida hereda de dsh-approval-gate y está activa desde la instalación; edita libremente — vacía o borrada vuelve al preajuste (restauración con un clic), así que la lista negra nunca se desactiva silenciosamente.",
				"card.denylistEmpty": "Lista negra vacía (ninguna llamada es vetada por la capa de palabras clave)",
				"card.denylistPlaceholder": "Nueva palabra clave, ej. drop database",
				"card.denylistAdd": "Agregar",
				"card.denylistRemove": "Eliminar esta palabra clave",
				"card.denylistTagPreset": "Preajuste",
				"card.denylistTagCustom": "Personalizado",
				"card.riskSediment": "riskSediment — sedimentación del aprendizaje: las muestras que alcanzan el umbral se convierten en reglas deterministas de auto-permiso",
				"card.riskSedimentHint": "Activado, cuando una clave tool|category alcanza el umbral sus huellas de muestra se sedimentan en reglas de permiso — una coincidencia exacta misma herramienta/mismo destino permite directamente sin otra llamada LLM (sigue funcionando con llmAssist desactivado).",
				"card.sediment": "Sedimento de aprendizaje (reglas deterministas de permiso)",
				"card.sedimentHint": "Reglas sedimentadas a partir de confirmaciones humanas: solo una coincidencia exacta de huella permite, nunca un destino diferente. Termina un aprendizaje o elimina una muestra.",
				"card.learningScope": "Ámbito de los datos de aprendizaje",
				"card.learningScopeGlobal": "Global (predeterminado)",
				"card.learningScopeSession": "Por sesión",
				"card.learningScopeHint": "Global: una operación confirmada en cualquier sesión baja el umbral de todas las sesiones (comportamiento histórico). Por sesión: solo cuentan las confirmaciones de esa sesión, y una regla global existente queda inactiva hasta que la promuevas explícitamente en la lista de sedimentos.",
				"attention.title": "Avisos de aprobación",
				"attention.hint": "Cómo te llega una solicitud. Los dos interruptores son independientes: por defecto solo se muestra la barra de decisión (comportamiento actual); con el sonido activado lo oyes aunque no estés mirando la conversación.",
				"attention.toast": "Mostrar la barra de decisión",
				"attention.sound": "Sonido",
				"attention.gap": "Intervalo mínimo por sesión (ms)",
				"attention.test": "Escuchar",
				"card.sedimentEmpty": "Aún no hay reglas sedimentadas (las muestras que alcanzan el umbral aparecen aquí)",
				"card.sedimentCount": "confirmado %n/%t",
				"card.sedimentStop": "Terminar",
				"card.sedimentStopTitle": "Terminar este aprendizaje (elimina el contador y las muestras)",
				"card.sedimentStopConfirm": "¿Terminar el aprendizaje de «%k»? Se eliminarán su contador y todas las muestras.",
				"card.sedimentSampleRemove": "Eliminar esta muestra sedimentada",
				"card.llmSource": "Fuente del LLM receptor",
				"card.llmSourceCustom": "API personalizada (compatible con OpenAI)",
				"card.llmSourceHost": "Usar el modelo predeterminado actual de la sesión (servicio DSH llm)",
				"card.llmSourceHostHint": "Por defecto la evaluación de aprobación se ejecuta en el grupo de modelos seleccionado actualmente en la sesión DSH (el valor efectivo se muestra abajo); deja Provider / Model vacío para seguir la sesión, o elige del desplegable o escribe para fijar — tus grupos personalizados configurados en DSH (ej. local-35b) aparecen automáticamente.",
				"card.llmProvider": "Provider (vacío = sigue la selección de sesión)",
				"card.llmProviderPlaceholder": "Sigue la selección de sesión",
				"card.llmModelHostPlaceholder": "Vacío = sigue la selección de sesión",
				"card.llmResolved": "Efectivo ahora: %p / %m",
				"card.llmPreset": "Preajustes de endpoint (rellena los campos; aún editable)",
				"card.llmPresetChoose": "Elegir un preajuste…",
				"card.llmPresetPublic": "Preajustes de API públicas",
				"card.llmPresetHost": "Grupos de modelos DSH (seleccionar uno cambia al receptor de sesión)",
				"card.networkEnabled": "Intercepción de red (networkEnabled)",
				"card.networkEnabledHint": "Activado, inicia un proxy local que intercepta las conexiones salientes de los subprocesos y aplica reglas de permiso/denegación. Desactivado = cero cambio de comportamiento.",
				"card.watch": "Recarga en caliente de reglas (watch)",
				"card.watchHint": "Activado, vigila automáticamente los cambios en los archivos de reglas y los aplica instantáneamente sin recarga manual.",
				"card.networkRebindNote": "Surte efecto de inmediato — el proxy se re-vincula automáticamente, sin necesidad de recargar el plugin.",
				"card.networkInjectEnv": "Inyectar variables de entorno del proxy (networkInjectEnv)",
				"card.networkInjectEnvHint": "Escribe HTTP(S)_PROXY / ALL_PROXY para los subprocesos (y vacía NO_PROXY). Desactivado = el listener funciona pero no se modifica ningún entorno de proceso.",
				"card.healthStale": "Ruta del host no disponible (404) — la mitad node sigue siendo una compilación antigua; reinicia completamente dsh (no solo la página del navegador) e inténtalo de nuevo.",
				"card.healthTest": "Prueba de salud",
				"card.healthRunning": "Probando…",
				"card.healthOk": "OK (%ms ms)",
				"card.healthFail": "Fallido: ",
				"history.tag.learned": "Aprendido",
				"history.tag.manualApproved": "Aprobado",
				"history.tag.manualRejected": "Rechazado",
				"history.tag.manualCancelled": "Cancelado",
				"history.tag.standDown": "Compuerta inactiva",
				"history.learnedProgress": "aprendido %n/%t",
				"history.snapshots": "instantáneas diff",
				"history.clearSession": "Borrar esta sesión",
				"history.clearAll": "Borrar todo",
				"history.clearSessionTitle": "Borrar solo las instantáneas diff de esta sesión (otras sesiones intactas)",
				"history.clearAllTitle": "Borrar las instantáneas diff de todas las sesiones, incluidas las no revisadas — pide confirmación",
				"history.clearSessionConfirm": "¿Borrar las instantáneas diff de esta sesión? Solo se eliminan los datos de comparación generados por las aprobaciones de esta sesión; los registros de aprobación permanecen.",
				"history.clearAllConfirm": "¿Borrar las instantáneas diff de TODAS las sesiones? Esto puede eliminar comparaciones que otras sesiones aún no han revisado, y es irreversible.",
				"history.diffTitle": "Comparación de cambios de archivo",
				"history.diffClose": "Cerrar",
				"history.diffLoading": "Cargando…",
				"history.diffEmpty": "Sin cambios de contenido (o archivo ilegible)",
				"history.diffLoadFail": "Error al cargar diff: ",
				"history.diffRevert": "Revertir este cambio",
				"history.diffReverting": "Enviando…",
				"history.diffRevertDone": "Instrucción de reversión enviada",
				"history.diffRevertSent": "Instrucción de reversión enviada a la conversación; la IA restaurará el archivo en consecuencia",
				"history.diffRevertFail": "Error de envío: ",
				"history.diffNoSnapshot": "Este evento no tiene instantánea para ese archivo",
				"history.diffChipTitle": "Ver la comparación de cambios de este archivo",
				"history.diffStats": "+%a / -%r líneas cambiadas · %c sin cambios",
				"history.diffGone": " (el archivo ya no existe)",
				"history.diffHidden": "%n líneas sin modificar",
				"card.dryRun": "Prueba de reglas",
				"card.dryRunHint": "Juzga una llamada contra las reglas vigentes. No ejecuta ninguna herramienta ni escribe ninguna regla — comprueba aquí antes de cambiar.",
				"card.dryRunTool": "Herramienta",
				"card.dryRunCommand": "Comando / argumentos",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Probar",
				"card.dryRunRunning": "Evaluando…",
				"card.dryRunEmpty": "Nada probado aún. Rellena una herramienta y un comando, luego pulsa Probar para ver el veredicto.",
				"card.dryRunVerdict": "Veredicto",
				"card.dryRunAllow": "permitir",
				"card.dryRunAsk": "consultar",
				"card.dryRunDeny": "denegar",
				"card.dryRunRule": "Regla coincidente",
				"card.dryRunRuleNone": "ninguna regla coincidió; defaultAction: %d",
				"card.dryRunDimensions": "Dimensiones",
				"card.dryRunReason": "Razón",
				"card.dryRunNote": "«Regla coincidente» proviene de la capa de reglas. Cuando el veredicto fue producido por una denegación dura anterior o por la lista negra de palabras clave no hay índice de regla — las dimensiones listadas son solo informativas.",
				"card.dryRunNoRules": "(0 reglas cargadas — comprueba la ruta de rulesFile)",
				"card.dryRunFail": "Prueba fallida: ",
				"card.dryRunStale": "ruta ausente (¿plugin no reiniciado?)",
				"card.rules": "Reglas integradas de configuración",
				"card.rulesHint": "Las reglas que la compuerta está cargando ahora (del campo de configuración rules de esta entrada de plugin; retroceso al archivo de reglas si no está configurado). Solo lectura — nada aquí puede modificarlas. Para cambiar reglas, usa la lista blanca de abajo o edítalas en la página de configuración.",
				"card.rulesRefresh": "Actualizar",
				"card.rulesLoading": "Leyendo…",
				"card.rulesPath": "Origen",
				"card.rulesNone": "sin reglas configuradas",
				"card.rulesCounts": "Reglas",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b bytes · %l líneas",
				"card.rulesMissing": "Reglas no encontradas. La compuerta retrocede a sus valores predeterminados integrados.",
				"card.rulesTruncated": "Reglas grandes; se muestran solo los primeros 512 KB.",
				"card.rulesError": "Error de carga: ",
				"card.rulesStale": "ruta ausente (¿plugin no reiniciado?)",
				"card.rulesNote": "Solo lectura: este panel no puede modificar las reglas. La sección de lista blanca y «permitir siempre» escriben de vuelta en la configuración de esta entrada de plugin.",
				"doubt.no-rule": "ninguna regla cubre esta llamada, el valor por defecto es preguntar — eso no significa que sea peligrosa",
				"doubt.opaque": "el payload no puede leerse (codificado, script fuera del workspace o programa no reconocido), ninguna regla puede localizar su objetivo",
				"doubt.irreversible": "regla irreversible: tras la ejecución no se puede deshacer",
				"doubt.never-learn": "esta respuesta no se aprenderá; la misma llamada volverá a preguntar",
				"doubt.delete": "elimina contenido",
				"doubt.remote-write": "efecto visible externamente (push / publish / solicitud de escritura); deshacer requiere pasos manuales",
				"doubt.exec-external": "ejecuta código fuera del workspace, no inspeccionable por esta llamada",
				"doubt.outside-paths": "usa rutas fuera del workspace",
				"doubt.model-flagged": "el modelo de riesgo lo marcó (solo puede escalar, nunca aprobar)",
				"doubt.write": "escribe o modifica archivos",
				"verdict.rule": "Regla aplicada",
				"verdict.grant": "Autorización de sesión",
				"verdict.hard-deny": "Denegación estricta",
				"verdict.deny-keyword": "Palabra clave en lista negra",
				"verdict.default": "Política predeterminada",
				"verdict.ask": "Política predeterminada",
				"verdict.permissive": "Permitido tras revisión automática",
				"verdict.classifier": "Veredicto del LLM",
				"verdict.llm-safe": "LLM: considerado seguro",
				"verdict.llm-learned": "LLM: aprendido y permitido",
				"verdict.learned-sediment": "Regla consolidada: permitido",
				"verdict.learned-confirm": "Confirmación de aprendizaje",
				"verdict.human-approved": "Aprobado por una persona",
				"verdict.human-rejected": "Rechazado por una persona",
				"verdict.human-cancelled": "Cancelado por una persona",
				"verdict.no-approval-channel": "Sin canal de aprobación",
				"verdict.preset-passthrough": "Política never · permitido",
				"verdict.stand-down": "Puerta desactivada",
				"verdict.yolo-allow": "YOLO permitido",
				"verdict.yolo-allow-no-reviewer": "YOLO permitido (sin modelo revisor · gestión mecánica)",
				"verdict.yolo-block": "YOLO bloqueado",
				"verdict.rules-fallback-allow": "Puerta de reglas sin modelo: permitido",
				"verdict.rules-fallback-block": "Puerta de reglas sin modelo: bloqueado",
				"verdict.safety-net-passthrough-allow": "Revisión mecánica permitida (sin modelo)",
				"verdict.safety-net-passthrough-block": "Revisión mecánica bloqueada (sin modelo)",
				"verdict.cleanup-safe": "Limpieza: permiso seguro",
				"verdict.escalation-auto": "Elevación de sandbox permitida automáticamente",
				"verdict.learned-granted": "Permiso aprendido",
				"verdict.network-ask": "Aprobación de red",
				"card.scopeUnresolved": " (scope sin resolver — marcador de diagnóstico)"
			},
			pt: {
				"card.title": "Revisão automática",
				"section.title": "Portal de revisão automática",
				"card.description": "Nível de aprovação independente: paralelo a somente leitura / acesso total / lista de permissões, exibido como «Revisão automática» no seletor de permissões da sessão. A interface expõe um único interruptor; as quatro estratégias de aprovação do backend são combináveis neste painel e continuam fail-closed diante da negação dura P0.",
				"card.permissive": "Ativar o nível de revisão automática",
				"card.permissiveHint": "Quando desativado, o portal se comporta exatamente como antes.",
				"card.unattended": "Modos sem supervisão",
				"card.unattendedHint": "Três interruptores, cada um governa apenas o nível escrito ao seu lado: desligar uma implementação devolve aquele nível ao fluxo humano ordinário, sem transformá-lo às escondidas em outro.",
				"card.mode.ask": "Manter humano",
				"card.mode.pass": "Passagem mecânica",
				"card.askHint": "O crivo mecânico filtra e lista suas dúvidas, mas a solicitação continua com uma pessoa; o modelo revisor nem é chamado — a forma para execuções sem um revisor LLM conectado, ou quando os tokens não valem a pena.",
				"card.passHint": "Executa apenas o julgador mecânico determinístico: uma operação irreversível, irrecuperável ou ilegível é bloqueada e devolvida com justificativa ao modelo principal; o resto roda. Nenhuma chamada de modelo, nenhuma pergunta humana: a forma revisada de approval: never, e um YOLO sem modelo.",
				"card.testing": "Testes e diagnóstico",
				"card.lists": "Listas de permissão e bloqueio",
				"card.credentials": "Proteção de credenciais",
				"card.networkOps": "Rede e recarga a quente",
				"card.summaryOn": "ligado",
				"card.summaryOff": "desligado",
				"card.summaryNone": "nenhum",
				"card.summaryStrategies": "%n ativadas",
				"card.summaryLists": "%a permitidos · %d bloqueados",
				"card.summaryCredRw": "readwrite: %n famílias",
				"card.summaryNetwork": "rede %net · recarga %w",
				"card.denylistPresetCollapse": "Palavras integradas (%n)",
				"card.denylistCustom": "Palavras personalizadas",
				"card.yolo": "YOLO — nunca pedir uma pessoa: bloquear o perigoso, executar o resto",
				"card.yoloExempt": "YOLO: tolerar também “localização desconhecida” dentro do workspace",
				"card.yoloExemptHint": "Só YOLO. Ativado, uma chamada em que apenas a “localização” é indeterminável (ferramenta sem argumentos, script fora do workspace cujo corpo não foi lido) deixa de ser bloqueada por “invisível”. Cargas codificadas, corpos ilegíveis, exclusões e escritas remotas continuam bloqueadas; P0, credenciais e irreversível nunca mudam.",
				"card.yoloHint": "Bloqueia uma carga irreversível / não aprendível / ilegível, ou um veredicto de risco duro do modelo, e devolve o motivo ao LLM principal como mensagem 工具审核意见; todo o resto é executado. Sem um modelo disponível, só as redes determinísticas interceptam.",
				"card.rulesFallback": "Degradar para um portal de regras quando não há modelo (classe cc-safety-net)",
				"card.rulesFallbackHint": "Só age quando o revisor de risco não está configurado ou não deu veredicto: as redes determinísticas bloqueiam o que sabem nomear e deixam passar o resto, em vez de deixar a chamada pendurada numa janela que ninguém vai responder. Enquanto um modelo responde, o comportamento não muda.",
				"card.allowProtectedBranchPush": "Permitir force-push em branches protegidas (padrão off = piso ativo)",
				"card.allowProtectedBranchPushHint": "Por padrão o piso P0 bloqueia git push --force/--force-with-lease/--delete para main/master/production/release/stable (sem apelação pelo modelo). Ativado, o piso se afasta e as três palavras de push simples são isentadas da blacklist; a chamada cai na regra embutida git.push-force, que ainda pergunta a uma pessoa, salvo se você revogar essa entrada ou adicioná-la à allowlist. Nada mais se amplia: exclusões, redirecionamentos e o piso de credenciais continuam armados.",
				"card.credFamily": "Degrau por família de credenciais",
				"card.credFamilyHint": "Um degrau por família: deny = leitura e escrita bloqueadas; ask = leitura com validação humana (padrão); readonly = leitura livre, a escrita continua bloqueada pelo piso P0; readwrite = a cláusula de escrita do credential store se afasta para esta família (caso npm login). Os demais pisos (raízes, caminhos protegidos, .dsh, exfiltração) continuam armados em qualquer degrau. O estado vive na linha do documento de regras mais a lista de isenção; este cartão escreve as duas juntas.",
				"card.credFamilyLoading": "Carregando degraus…",
				"card.credFamilyFootnote": "Os níveis sem humano (passagem mecânica / YOLO) deixam passar o resíduo dos ask — escolha deny para bloquear duro. Os credentialPaths personalizados nunca participam da isenção de escrita; readwrite não afeta nenhum critério fora de credenciais.",
				"card.credReadwriteConfirm": "readwrite libera escrever/modificar os arquivos de credenciais desta família (reescrever ~/.npmrc). É o único degrau que afasta parte do P0. Confirmar?",
				"card.credConfirmYes": "Confirmar",
				"card.credConfirmNo": "Cancelar",
				"card.credRung.deny": "bloquear",
				"card.credRung.ask": "perguntar",
				"card.credRung.readonly": "somente leitura",
				"card.credRung.readwrite": "leitura e escrita",
				"card.scriptReview": "Anexar o conteúdo dos scripts à revisão (ativado por padrão)",
				"card.scriptReviewHint": "Quando uma chamada executa um arquivo de script, seu corpo é lido e entregue igualmente ao modelo de risco e à pessoa, e as redes determinísticas também avaliam o corpo (uma exclusão que só aparece dentro do arquivo era exatamente o que escapava). Os corpos são resumidos e limitados antes de sair do host; desativar mantém o conteúdo dos arquivos local, ao custo de devolver os scripts fora do workspace ao nível «ilegível».",
				"card.credentialPaths": "Caminhos de credenciais personalizados (a cauda longa)",
				"card.autoAllowTools": "Ferramentas de auto-permissão (sem pergunta)",
				"card.autoAllowToolsHint": "As ferramentas desta lista são tratadas como read/grep: sem janela, sem revisão de modelo. A negação dura P0 e as regras de caminho continuam valendo. Use para nomes de ferramentas seguras registradas pelos seus próprios plugins.",
				"card.autoAllowToolsPlaceholder": "Nome da ferramenta, ex. my_safe_tool",
				"card.credentialPathsHint": "Arquivos secretos que a lista embutida não conhece. As entradas são globs de caminho: duas estrelas cruzam diretórios, uma estrela simples e um ponto de interrogação ficam dentro de um segmento; sem curinga, compara-se o caminho inteiro (token não toca ambient.txt); um ~/ inicial vira o seu home; um padrão relativo também casa em qualquer profundidade (secrets/*.env cobre a/b/secrets/prod.env). Uma correspondência é tratada no mesmo padrão de .ssh: ler fora do workspace e modificar com ferramenta de arquivo são negações duras — esse nível não é apelável nem contornável pelo revisor, então declare só os caminhos que você realmente precisa proteger.",
				"card.credentialPathsPlaceholder": "Novo caminho, ex. ~/.myco/vault.token ou secrets/*.env",
				"card.denyKeywordsExtra": "Palavras-chave adicionadas à blacklist (não substitui a predefinição)",
				"card.denyKeywordsExtraHint": "Um bloqueio determinístico sobre termos seus — um subcomando de revogação/exclusão de uma CLI interna, um prefixo de token que você emite. Esta lista apenas acrescenta: o que estiver na blacklist acima (predefinição ou sua própria substituição) é mesclado com estas palavras.",
				"card.listRemove": "Remover esta entrada",
				"card.extraContentArgKeys": "Chaves de documento adicionadas (nunca lidas como operação)",
				"card.extraContentArgKeysHint": "Nomes de campos documentais fora da lista embutida (content/text/plan…): declarados, o texto deles deixa de entrar na leitura plana de palavras perigosas e de formas de credencial. Só se acrescenta: a lista embutida não é substituída, porque esquecer uma de suas chaves traria de volta em silêncio a falha pela qual um plano é negado por descrever uma ação. O comando realmente executado e o caminho modificado são julgados pelos próprios caminhos; esta lista não pode desligá-los.",
				"card.extraContentArgKeysPlaceholder": "Novo nome de argumento, ex. steps",
				"card.extraOperationArgKeys": "Chaves de operação adicionadas (ler o campo como código que roda)",
				"card.extraOperationArgKeysHint": "Um caminho para campos cujo corpo é de fato executado (workflowYaml etc.): o texto entra na blacklist e no filtro de credenciais, e esta lista vence se as duas nomearem a mesma chave. Custo: declarar aqui um campo realmente documental torna de novo «o plano menciona rm -rf» motivo de negação.",
				"card.scopeNote": "Escopo da predefinição: este portal só age enquanto a predefinição de permissões da sessão for %scope. Sob qualquer outra predefinição o portal inteiro se afasta — inclusive a negação dura P0 — e a política da predefinição escolhida assume o controle. O afastamento registra um evento e deixa uma faixa permanente acima da entrada.",
				"card.strategies": "Estratégias de aprovação do backend (pelo menos uma ativa; combináveis)",
				"card.strategy.trustAutoAllow": "trustAutoAllow — operações seguras dentro do escopo se auto-permitem; perigosas/desconhecidas → perguntar (nível intermediário base)",
				"card.strategy.alwaysConfirm": "alwaysConfirm — cada travessia pergunta; os “controles de permissão” do painel de aprovação ganham dois botões estendidos: “repetir permissão para este tipo nesta sessão” (grant limitado de sessão) e “permitir todas as ocorrências” (persistir a palavra de comando na allowlist do rulesFile)",
				"card.strategy.llmAssist": "llmAssist — um LLM personalizado avalia o risco: safe → auto-permissão; deletion/credential/remote/system/bulk → riscos duros mantêm a pergunta humana (o classificador nunca nega — só escala); neutral → aprendizado por confirmação; falha/timeout → volta ao humano",
				"card.strategy.trustEscalation": "trustEscalation — escalonamento de sandbox sem aviso: para uma chamada já permitida por este portal, a ampliação de sandbox iniciada por dentro de shell / pwsh / edit é aprovada aqui em vez de perguntar a você",
				"card.strategy.trustEscalationHint": "A aprovação do escalonamento de sandbox é pedida de dentro do corpo da ferramenta, depois de tools/pre-execute, então o portal nunca a vê — uma chamada que o LLM classificou como segura e que o portal auto-permitiu ainda pedia sua aprovação para a ampliação. Ativado, só a chamada exata que o portal permitiu (correspondência por callId) pula o aviso; todo o resto vai ao humano como antes, assim como qualquer motivo não reconhecido ou um destino diferente de workspace-write / danger-full-access. Desative para manter a ampliação sob controle humano.",
				"card.readonly": "Somente leitura",
				"card.unavailable": "Namespace de configuração indisponível: verifique se o dsh-perm-gate está montado neste perfil.",
				"card.llmReceiver": "LLM receptor do llmAssist (compatível com OpenAI; qualquer API personalizada)",
				"card.llmEndpoint": "Endpoint (BaseURL, ex. https://api.openai.com/v1)",
				"card.llmModel": "Model (id do modelo, ex. deepseek-chat)",
				"card.llmEffort": "Esforço de raciocínio (somente no modo host)",
				"card.llmEffortHost": "Seguir o host",
				"card.llmEffortHint": "Vazio = não impor nada, decide a configuração do modelo do host; mude para low ou off se o host recusar.",
				"card.llmKey": "API Key (secreta)",
				"card.llmKeyHidden": "Não definida · exibida como * após a primeira digitação",
				"card.llmKeyMasked": "Definida · digite um novo valor para sobrescrever",
				"card.llmKeyOverwrite": "Há um valor secreto armazenado; digite um novo valor e saia do campo para sobrescrevê-lo.",
				"card.llmKeyClear": "Limpar",
				"card.allowlist": "Allowlist (allow, sincronizada com o rulesFile)",
				"card.allowlistHint": "Os padrões da seção allow são permitidos direto; adicione ou remova entradas uma a uma, elas são gravadas no rulesFile e recarregadas ao vivo.",
				"card.allowlistPresetNote": "O equivalente da allowlist predefinida é a estratégia trustAutoAllow (operações seguras no escopo auto-permitidas), ativada na seção de estratégias acima; esta lista reflete a sua seção allow do rulesFile e legitimamente começa vazia.",
				"card.allowlistEmpty": "Sem regras de allowlist",
				"card.allowlistPlaceholder": "Novo padrão de comando, ex. npm test*",
				"card.allowlistAdd": "Adicionar",
				"card.allowlistRemove": "Remover este padrão",
				"card.allowlistBulk": "Edição em massa",
				"card.allowlistBulkHide": "Ocultar edição em massa",
				"card.allowlistSave": "Salvar allowlist",
				"card.riskLearning": "riskLearning — aprendizado de veredictos: operações de risco neutras aprovadas pela pessoa e executadas são contabilizadas; a mesma operação se auto-permite ao atingir o limiar com a mesma pegada",
				"card.riskLearningHint": "O estado do aprendizado pertence ao plugin ($DSH_HOME/perm-gate/learning.json) e nunca é escrito nas suas regras YAML; um destino diferente nunca reutiliza a autoridade. Desativado por padrão.",
				"card.riskThreshold": "Confirmações humanas necessárias antes da auto-permissão (1–10)",
				"notice.label": "Atividade do portal de permissões",
				"history.label": "Aprovações",
				"history.title": "Registro de aprovações de permissão",
				"history.subtitle": "Cada decisão do portal nesta sessão, mais recentes primeiro",
				"history.loading": "Carregando…",
				"history.empty": "Ainda não há registros de aprovação nesta sessão",
				"history.error": "Falha ao carregar: ",
				"history.tag.auto": "Auto-permitido",
				"history.tag.ask": "Perguntado",
				"history.tag.deny": "Negado",
				"card.denylistRestore": "Restaurar blacklist predefinida",
				"card.denylist": "Blacklist (palavras-chave deny, predefinição do plugin)",
				"card.denylistHint": "Uma chamada cujo texto contenha uma palavra-chave (subcadena sem diferenciar maiúsculas) é negada na hora, antes de allowlist / grants / LLM. A lista predefinida herda do dsh-approval-gate e já vem ativa na instalação; edite à vontade — vazia ou apagada volta à predefinição (restauração em um clique), então a blacklist nunca se desliga em silêncio.",
				"card.denylistEmpty": "Blacklist vazia (nenhuma chamada é vetada pela camada de palavras-chave)",
				"card.denylistPlaceholder": "Nova palavra-chave, ex. drop database",
				"card.denylistAdd": "Adicionar",
				"card.denylistRemove": "Remover esta palavra-chave",
				"card.denylistTagPreset": "Predefinida",
				"card.denylistTagCustom": "Personalizada",
				"card.riskSediment": "riskSediment — sedimentação do aprendizado: as amostras que atingem o limiar viram regras determinísticas de auto-permissão",
				"card.riskSedimentHint": "Ativado, quando uma chave tool|category atinge o limiar suas pegadas de amostra se sedimentam em regras de permissão — uma correspondência exata de mesma ferramenta/mesmo destino permite direto, sem outra chamada LLM (continua funcionando com llmAssist desativado).",
				"card.sediment": "Sedimento de aprendizado (regras determinísticas de permissão)",
				"card.sedimentHint": "Regras sedimentadas a partir de confirmações humanas: só uma correspondência exata de pegada permite, nunca um destino diferente. Encerre um aprendizado ou remova uma amostra.",
				"card.learningScope": "Escopo dos dados de aprendizagem",
				"card.learningScopeGlobal": "Global (padrão)",
				"card.learningScopeSession": "Por sessão",
				"card.learningScopeHint": "Global: uma operação confirmada em qualquer sessão baixa o limite de todas as sessões (comportamento histórico). Por sessão: contam apenas as confirmações dessa sessão, e uma regra global existente fica inativa até você promovê-la explicitamente na lista de sedimentos.",
				"attention.title": "Alertas de aprovação",
				"attention.hint": "Como uma solicitação chega até você. Os dois interruptores são independentes: por padrão apenas a barra de decisão aparece (comportamento atual); com o som ligado você a ouve mesmo sem olhar a conversa.",
				"attention.toast": "Mostrar a barra de decisão",
				"attention.sound": "Som",
				"attention.gap": "Intervalo mínimo por sessão (ms)",
				"attention.test": "Ouvir",
				"card.sedimentEmpty": "Ainda não há regras sedimentadas (as amostras que atingem o limiar aparecem aqui)",
				"card.sedimentCount": "confirmado %n/%t",
				"card.sedimentStop": "Encerrar",
				"card.sedimentStopTitle": "Encerrar este aprendizado (remove o contador e as amostras)",
				"card.sedimentStopConfirm": "Encerrar o aprendizado de «%k»? O contador e todas as amostras serão removidos.",
				"card.sedimentSampleRemove": "Remover esta amostra sedimentada",
				"card.llmSource": "Origem do LLM receptor",
				"card.llmSourceCustom": "API personalizada (compatível com OpenAI)",
				"card.llmSourceHost": "Usar o modelo padrão atual da sessão (serviço llm do DSH)",
				"card.llmSourceHostHint": "Por padrão a avaliação de aprovação roda no grupo de modelos atualmente selecionado na sessão DSH (o valor efetivo aparece abaixo); deixe Provider / Model vazios para seguir a sessão, ou escolha no seletor ou digite para fixar — os seus grupos personalizados configurados no DSH (ex. local-35b) aparecem automaticamente.",
				"card.llmProvider": "Provider (vazio = segue a seleção da sessão)",
				"card.llmProviderPlaceholder": "Segue a seleção da sessão",
				"card.llmModelHostPlaceholder": "Vazio = segue a seleção da sessão",
				"card.llmResolved": "Efetivo agora: %p / %m",
				"card.llmPreset": "Predefinições de endpoint (preenche os campos; ainda editável)",
				"card.llmPresetChoose": "Escolher uma predefinição…",
				"card.llmPresetPublic": "Predefinições de APIs públicas",
				"card.llmPresetHost": "Grupos de modelos do DSH (escolher um muda para o receptor da sessão)",
				"card.networkEnabled": "Intercepção de rede (networkEnabled)",
				"card.networkEnabledHint": "Ativado, inicia um proxy local que intercepta as conexões de saída dos subprocessos e aplica regras de permissão/negação. Desativado = zero mudança de comportamento.",
				"card.watch": "Recarga a quente das regras (watch)",
				"card.watchHint": "Ativado, vigia automaticamente as mudanças nos arquivos de regras e as aplica na hora, sem recarga manual.",
				"card.networkRebindNote": "Tem efeito imediato — o proxy é re-vinculado sozinho, sem precisar recarregar o plugin.",
				"card.networkInjectEnv": "Injetar variáveis de ambiente do proxy (networkInjectEnv)",
				"card.networkInjectEnvHint": "Escreve HTTP(S)_PROXY / ALL_PROXY para os subprocessos (e esvazia NO_PROXY). Desativado = o listener funciona, mas nenhum ambiente de processo é modificado.",
				"card.healthStale": "Rota do host indisponível (404) — a metade node ainda é uma compilação antiga; reinicie o dsh por completo (não só a página do navegador) e tente de novo.",
				"card.healthTest": "Teste de saúde",
				"card.healthRunning": "Testando…",
				"card.healthOk": "OK (%ms ms)",
				"card.healthFail": "Falhou: ",
				"history.tag.learned": "Aprendido",
				"history.tag.manualApproved": "Aprovado",
				"history.tag.manualRejected": "Rejeitado",
				"history.tag.manualCancelled": "Cancelado",
				"history.tag.standDown": "Portal inativo",
				"history.learnedProgress": "aprendido %n/%t",
				"history.snapshots": "instantâneos de diff",
				"history.clearSession": "Limpar esta sessão",
				"history.clearAll": "Limpar tudo",
				"history.clearSessionTitle": "Remover só os instantâneos de diff desta sessão (outras sessões intactas)",
				"history.clearAllTitle": "Remover os instantâneos de diff de todas as sessões, inclusive os não revisados — pede confirmação",
				"history.clearSessionConfirm": "Remover os instantâneos de diff desta sessão? Só saem os dados de comparação gerados pelas aprovações desta sessão; os registros de aprovação permanecem.",
				"history.clearAllConfirm": "Remover os instantâneos de diff de TODAS as sessões? Isso pode apagar comparações que outras sessões ainda não revisaram, e é irreversível.",
				"history.diffTitle": "Comparação de mudanças do arquivo",
				"history.diffClose": "Fechar",
				"history.diffLoading": "Carregando…",
				"history.diffEmpty": "Sem mudanças de conteúdo (ou arquivo ilegível)",
				"history.diffLoadFail": "Falha ao carregar o diff: ",
				"history.diffRevert": "Reverter esta mudança",
				"history.diffReverting": "Enviando…",
				"history.diffRevertDone": "Instrução de reversão enviada",
				"history.diffRevertSent": "Instrução de reversão enviada à conversa; a IA restaurará o arquivo em conformidade",
				"history.diffRevertFail": "Falha no envio: ",
				"history.diffNoSnapshot": "Este evento não tem instantâneo para aquele arquivo",
				"history.diffChipTitle": "Ver a comparação de mudanças deste arquivo",
				"history.diffStats": "+%a / -%r linhas alteradas · %c sem mudanças",
				"history.diffGone": " (o arquivo já não existe)",
				"history.diffHidden": "%n linhas inalteradas",
				"card.dryRun": "Teste de regras",
				"card.dryRunHint": "Julga uma chamada contra as regras vigentes. Não executa ferramenta nenhuma nem escreve regra nenhuma — confira aqui antes de mudar.",
				"card.dryRunTool": "Ferramenta",
				"card.dryRunCommand": "Comando / argumentos",
				"card.dryRunCommandPlaceholder": "git push --force origin main",
				"card.dryRunTest": "Testar",
				"card.dryRunRunning": "Avaliando…",
				"card.dryRunEmpty": "Nada testado ainda. Preencha uma ferramenta e um comando e clique em Testar para ver o veredicto.",
				"card.dryRunVerdict": "Veredicto",
				"card.dryRunAllow": "permitir",
				"card.dryRunAsk": "perguntar",
				"card.dryRunDeny": "negar",
				"card.dryRunRule": "Regra correspondente",
				"card.dryRunRuleNone": "nenhuma regra casou; defaultAction: %d",
				"card.dryRunDimensions": "Dimensões",
				"card.dryRunReason": "Motivo",
				"card.dryRunNote": "«Regra correspondente» vem da camada de regras. Quando o veredicto foi produzido por uma negação dura anterior ou pela blacklist de palavras-chave, não há índice de regra — as dimensões listadas são apenas informativas.",
				"card.dryRunNoRules": "(0 regras carregadas — confira o caminho de rulesFile)",
				"card.dryRunFail": "Teste falhou: ",
				"card.dryRunStale": "caminho ausente (plugin não reiniciado?)",
				"card.rules": "Regras embutidas da configuração",
				"card.rulesHint": "As regras que o portal está carregando agora (do campo de configuração rules desta entrada de plugin; recai no arquivo de regras se nada estiver configurado). Somente leitura — nada aqui pode modificá-las. Para mudar regras, use a allowlist abaixo ou edite-as na página de configuração.",
				"card.rulesRefresh": "Atualizar",
				"card.rulesLoading": "Lendo…",
				"card.rulesPath": "Origem",
				"card.rulesNone": "sem regras configuradas",
				"card.rulesCounts": "Regras",
				"card.rulesDefault": "defaultAction",
				"card.rulesStats": "%b bytes · %l linhas",
				"card.rulesMissing": "Regras não encontradas. O portal recai nos seus padrões embutidos.",
				"card.rulesTruncated": "Regras grandes; só os primeiros 512 KB são exibidos.",
				"card.rulesError": "Falha de leitura: ",
				"card.rulesStale": "caminho ausente (plugin não reiniciado?)",
				"card.rulesNote": "Somente leitura: este painel não pode modificar as regras. A seção de allowlist e o «permitir sempre» gravam de volta na configuração desta entrada de plugin.",
				"doubt.no-rule": "nenhuma regra cobre esta chamada, o padrão é perguntar — isso não significa que ela seja perigosa",
				"doubt.opaque": "a carga não pode ser lida (codificada, script fora do workspace ou programa não reconhecido); nenhuma regra consegue localizar o seu alvo",
				"doubt.irreversible": "regra irreversível: depois de executada não dá para desfazer",
				"doubt.never-learn": "esta resposta não será aprendida; a mesma chamada vai perguntar de novo",
				"doubt.delete": "exclui conteúdo",
				"doubt.remote-write": "efeito visível por fora (push / publish / solicitação de escrita); desfazer exige passos manuais",
				"doubt.exec-external": "executa código fora do workspace, não inspecionável por esta chamada",
				"doubt.outside-paths": "usa caminhos fora do workspace",
				"doubt.model-flagged": "o modelo de risco sinalizou (só pode escalar, nunca aprovar)",
				"doubt.write": "escreve ou modifica arquivos",
				"verdict.rule": "Regra aplicada",
				"verdict.grant": "Autorização de sessão",
				"verdict.hard-deny": "Negação rígida",
				"verdict.deny-keyword": "Palavra-chave da lista de bloqueio",
				"verdict.default": "Política padrão",
				"verdict.ask": "Política padrão",
				"verdict.permissive": "Permitido após revisão automática",
				"verdict.classifier": "Veredito do LLM",
				"verdict.llm-safe": "LLM: considerado seguro",
				"verdict.llm-learned": "LLM: aprendido e permitido",
				"verdict.learned-sediment": "Regra consolidada: permitido",
				"verdict.learned-confirm": "Confirmação de aprendizado",
				"verdict.human-approved": "Aprovado por humano",
				"verdict.human-rejected": "Rejeitado por humano",
				"verdict.human-cancelled": "Cancelado por humano",
				"verdict.no-approval-channel": "Sem canal de aprovação",
				"verdict.preset-passthrough": "Política never · permitido",
				"verdict.stand-down": "Portão desativado",
				"verdict.yolo-allow": "YOLO permitido",
				"verdict.yolo-allow-no-reviewer": "YOLO permitido (sem modelo revisor · gestão mecânica)",
				"verdict.yolo-block": "YOLO bloqueado",
				"verdict.rules-fallback-allow": "Portão de regras sem modelo: permitido",
				"verdict.rules-fallback-block": "Portão de regras sem modelo: bloqueado",
				"verdict.safety-net-passthrough-allow": "Revisão mecânica permitida (sem modelo)",
				"verdict.safety-net-passthrough-block": "Revisão mecânica bloqueada (sem modelo)",
				"verdict.cleanup-safe": "Limpeza: permissão segura",
				"verdict.escalation-auto": "Elevação de sandbox permitida automaticamente",
				"verdict.learned-granted": "Permissão aprendida",
				"verdict.network-ask": "Aprovação de rede",
				"card.scopeUnresolved": " (scope não resolvido — espaço de diagnóstico)"
			}
		};
		// src/client/attention.ts
		/** The defaults the settings surface starts from: equal to today's experience. */
		const ATTENTION_DEFAULTS = {
			toast: true,
			sound: false,
			gapMs: 3e4
		};
		/** Per-session last-chime timestamps. Different sessions never block each other. */
		const lastChime = /* @__PURE__ */ new Map();
		function audioContextCtor() {
			const g = globalThis;
			return g.AudioContext ?? g.webkitAudioContext;
		}
		/**
		* Two-note chime, synthesised. No asset file: zero bytes, offline-safe, and
		* nothing to resolve at runtime (a missing `assets/` path would otherwise turn
		* a notification into a console error on some hosts).
		*/
		function chime() {
			const Ctor = audioContextCtor();
			if (Ctor === void 0) return;
			try {
				const ctx = new Ctor();
				const start = ctx.currentTime;
				for (const [index, freq] of [880, 1174.7].entries()) {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = "sine";
					osc.frequency.value = freq;
					const at = start + index * .14;
					gain.gain.setValueAtTime(1e-4, at);
					gain.gain.exponentialRampToValueAtTime(.12, at + .02);
					gain.gain.exponentialRampToValueAtTime(1e-4, at + .13);
					osc.connect(gain);
					gain.connect(ctx.destination);
					osc.start(at);
					osc.stop(at + .15);
				}
				setTimeout(() => {
					ctx.close().catch(() => void 0);
				}, 600);
			} catch {}
		}
		/**
		* React to one arriving ask. The two switches are judged independently: a
		* sound-only setup still chimes, a toast-only setup still shows the strip.
		* @returns whether a chime was actually played (handy for tests and for a
		*   'test' button in the settings face).
		*/
		function escalateAsk(input) {
			const { config, sessionId } = input;
			if (!config.sound) return false;
			const now = input.now ?? Date.now;
			const bucket = sessionId ?? "__unknown__";
			const previous = lastChime.get(bucket);
			const at = now();
			if (previous !== void 0 && at - previous < config.gapMs) return false;
			lastChime.set(bucket, at);
			const play = input.play ?? chime;
			try {
				play();
				return true;
			} catch {
				return false;
			}
		}
		/**
		* The user came back to the tab (`visibilitychange` to visible): drop that
		* session's debounce entry so the next ask can be heard immediately instead of
		* being swallowed by a window that started while the tab was hidden.
		*/
		function acknowledge(input) {
			if (input.sessionId === void 0) {
				lastChime.clear();
				return;
			}
			lastChime.delete(input.sessionId);
		}
		// src/client/switch-state.ts
		/**
		* The optimistic state machine behind the settings card's pill switch and its tier
		* picker, kept out of the components so its three rules are testable without a DOM
		* renderer (the client half ships no react-dom).
		*
		* The posture: the control flips the instant it is clicked and holds that
		* position while the write round-trips through the host settings service — a
		* checkbox that waits for the snapshot reads as a dead control. The store stays
		* the truth, so the local override is dropped the moment the snapshot agrees
		* with it, on a rejected write, and on a watchdog in case a host line neither
		* applies nor reports the change.
		*/
		/** How long an unconfirmed click is allowed to hold the control before it snaps back. */
		const SWITCH_SETTLE_MS = 4e3;
		/**
		* What the control displays: the pending click wins over the store until the store
		* catches up (or the watchdog gives up on it). Generic because the same posture covers a
		* two-state pill and a multi-state tier picker alike.
		*/
		function shownValue(pending, checked) {
			return pending ?? checked;
		}
		/**
		* Store update: once the snapshot reports the requested value the override is redundant,
		* and handing the visual back to the snapshot is what keeps the control honest if another
		* writer (a patch file, the app's own plugin manager) moved the same field meanwhile.
		*/
		function pendingAfterSync(pending, checked) {
			return pending !== null && pending === checked ? null : pending;
		}
		/** A write that came back rejected: fall back to whatever the store holds. */
		function pendingAfterFailure(_pending) {
			return null;
		}
		// src/deny-defaults.ts
		/**
		* Preset deny keywords inherited from dsh-approval-gate's `DEFAULT_DENY_KEYWORDS`
		* (the preset blacklist layer of its pipeline). One keyword per entry, matched
		* case-insensitively on word boundaries against the call's command text and its
		* scalar arguments — document bodies are skipped — so a keyword can no longer
		* veto an unrelated identifier or file text that merely contains it.
		*
		* Pure data shared by the node half (deny-keyword pre-layer) and the client
		* bundle (the settings card's preset tags), so it must stay import-free.
		*/
		/** The preset blacklist; the gate applies it whenever the namespace carries no override. */
		const DEFAULT_DENY_KEYWORDS = [
			"rm -rf",
			"rm -fr",
			"rm -r -f",
			"rm --recursive --force",
			"push --force",
			"force-push",
			"force push",
			"drop table",
			"drop database",
			"mkfs",
			"mkfs.ext",
			"format",
			"shutdown",
			"reboot",
			"dd of=",
			"delete from",
			"truncate table",
			"truncate ",
			"terraform destroy",
			"revoke",
			"清空数据库",
			"删除数据库",
			"格式化",
			"sudo rm",
			"chmod 777 /",
			"git reset --hard",
			"git clean -fd",
			"docker rm",
			"docker system prune"
		];
		// src/llm-presets.ts
		const LLM_PRESETS = [
			{
				id: "deepseek",
				label: "DeepSeek",
				endpoint: "https://api.deepseek.com/v1",
				model: "deepseek-chat"
			},
			{
				id: "xiaomi-mimo",
				label: "小米 MiMo",
				endpoint: "https://api.xiaomimimo.com/v1",
				model: "mimo-v2.5"
			},
			{
				id: "openai",
				label: "OpenAI",
				endpoint: "https://api.openai.com/v1",
				model: "gpt-4o-mini"
			}
		];
		// src/preset.ts
		/**
		* Presets in which the gate is active. The plugin ships five 自动审查 tiers of its own
		* (declared in its `cordis.patch.yml`, which is how they reach the composer picker at all):
		* the plain one (file sandbox kept), the full-access one (sandbox lifted, same approval
		* behaviour), and the three human-free / model-free implementations — mechanical takeover of
		* asks (`permissive-mech`), mechanical screen that still asks (`permissive-snet`), and the
		* model-backed YOLO. Each has exactly one preset and one switch, so they never cross: a
		* switch changes the behaviour of its own tier and of nothing else. `'*'` makes the gate
		* global (every preset, including the hard-deny layer).
		*
		* Lives in this dependency-free module (not `config.ts`) so the browser half can
		* render the scope without pulling schemastery into the client bundle.
		*/
		const DEFAULT_GATE_PRESETS = [
			"permissive",
			"permissive-full",
			"permissive-mech",
			"permissive-snet",
			"permissive-yolo"
		];
		// src/client/sediment.tsx
		/**
		* Learning-sediment management section — the settings-card face of verdict
		* learning's "沉淀" (the ⑤ card pattern demonstrated by dsh-approval-gate):
		* every threshold-reached key's confirmed samples, listed as the deterministic
		* auto-allow rules they now are, with per-key terminate and per-sample remove.
		*
		* Data source: the host's `GET /api/dsh-perm-gate/learning` route (the same
		* learning.json store the gate reads); actions POST back. Best-effort: a
		* missing route renders the empty state, never an error.
		*/
		const itemStyle = {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			padding: "4px 8px",
			borderRadius: "6px",
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-surface, transparent)"
		};
		const chipStyle = {
			fontSize: "11px",
			lineHeight: "16px",
			padding: "0 6px",
			borderRadius: "8px",
			color: "var(--dsw-alias-label-tertiary)",
			border: "1px solid var(--dsw-alias-border-l2)"
		};
		const delButtonStyle = {
			flex: "0 0 auto",
			width: "20px",
			height: "20px",
			border: "none",
			borderRadius: "999px",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			cursor: "pointer"
		};
		function SedimentSection({ t }) {
			const [body, setBody] = (0, react.useState)(null);
			/** Latest loader, so a mutation can refresh the list without owning the fetch. */
			const reloadRef = (0, react.useRef)(() => {});
			(0, react.useEffect)(() => {
				let alive = true;
				const load = () => {
					fetch("/api/dsh-perm-gate/learning", { headers: { "cache-control": "no-cache" } }).then((r) => r.ok ? r.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${r.status}`))).then((data) => {
						if (alive) setBody(data);
					}).catch(() => {
						if (alive) setBody({});
					});
				};
				reloadRef.current = load;
				load();
				const onVisible = () => {
					if (document.visibilityState === "visible") load();
				};
				window.addEventListener("focus", onVisible);
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					alive = false;
					reloadRef.current = () => {};
					window.removeEventListener("focus", onVisible);
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, []);
			const post = (payload) => {
				fetch("/api/dsh-perm-gate/learning", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				}).then(() => {
					reloadRef.current();
				}).catch(() => {});
			};
			const threshold = body?.threshold ?? 3;
			const confirmed = body?.confirmed ?? {};
			const samples = body?.samples ?? {};
			const keys = Object.entries(confirmed).filter(([, count]) => count >= threshold);
			if (body === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: { marginTop: "6px" },
				children: keys.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						padding: "4px 0",
						fontSize: "12px",
						color: "var(--dsw-alias-label-tertiary)"
					},
					children: t("card.sedimentEmpty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: "6px"
					},
					children: keys.map(([key, count]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "4px"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: itemStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									style: {
										font: "600 12px/18px var(--ds-font-family-code, monospace)",
										color: "var(--dsw-alias-label-primary)"
									},
									children: key
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: chipStyle,
									children: t("card.sedimentCount").replace("%n", String(count)).replace("%t", String(threshold))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: "1 1 auto" } }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									title: t("card.sedimentStopTitle"),
									onClick: () => {
										if (window.confirm(t("card.sedimentStopConfirm").replace("%k", key))) post({ key });
									},
									style: {
										...delButtonStyle,
										width: "auto",
										padding: "0 8px",
										border: "1px solid var(--dsw-alias-border-l2)"
									},
									children: t("card.sedimentStop")
								})
							]
						}), (samples[key] ?? []).map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								...itemStyle,
								marginLeft: "16px"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", {
								style: {
									flex: "1 1 auto",
									minWidth: 0,
									overflowWrap: "anywhere",
									font: "500 12px/18px var(--ds-font-family-code, monospace)",
									color: "var(--dsw-alias-label-secondary, inherit)"
								},
								children: [s.fp, s.ctx !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { color: "var(--dsw-alias-label-tertiary)" },
									children: ` — ${s.ctx}`
								}) : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-label": t("card.sedimentSampleRemove"),
								title: t("card.sedimentSampleRemove"),
								onClick: () => {
									post({
										key,
										fp: s.fp
									});
								},
								style: delButtonStyle,
								children: "✕"
							})]
						}, `${key}:${s.fp}`))]
					}, key))
				})
			});
		}
		// src/client/guide.tsx
		/**
		* ⚠️ 生成副本 —— 请勿手改。真源：mine-dsh-plugins/_tools/guide-kit/guide.tsx
		* 重新同步：node _tools/guide-kit/sync.mjs
		*/
		/**
		* guide-kit —— 九插件共用的「首次使用引导」件（**生成副本，勿手改**）。
		*
		* 唯一真源：`mine-dsh-plugins/_tools/guide-kit/guide.tsx`
		* 同步命令：`node _tools/guide-kit/sync.mjs`（会覆盖本文件；改这里等于白改）
		*
		* 六条契约（见 .agents/plans/unified-i18n-onboarding/spec.md §2）：
		* 1. Skip 恒定可见，任何步骤都能退；
		* 2. 永远有字：引导外壳（标题/按钮/步进）自带 10 语词表，按 <html lang> 取词，
		*    认不出的一律落 en；步骤正文按「本语 → en → zh → 任意可用」逐级回退，绝不留空白；
		* 3. 重启入口：`GuideRestartButton`（或自己调 `resetGuide(ns)` + setOpen(true)）就地重开；
		* 4. 零依赖：只 react + localStorage，不 import 平台包，不抢宿主设置表单；
		* 5. 引导自己绝不能成为卡面渲染的失败点：样式注入与存储访问全部 try/catch + 能力探测；
		* 6. 外壳词表与步骤正文分离：外壳跨插件统一（本文件），正文每插件一份 `guide-steps.ts`。
		*/
		/** 生态通用的十个语言码（与各插件 `locale/*.json`、README 的十语镜像同口径）。 */
		const GUIDE_LOCALES = [
			"zh",
			"en",
			"ja",
			"ko",
			"fr",
			"de",
			"it",
			"ru",
			"es",
			"pt"
		];
		/**
		* 引导外壳词表（10 语）。
		*
		* 为什么不塞进各插件 locales：这七个词是**跨插件同一套**，塞进九个字典要重复翻译
		* 9×10 次，且一旦措辞调整就得动九个仓。外壳留在本文件，正文留各插件。
		*/
		const GUIDE_COPY = {
			zh: {
				title: "快速上手",
				skip: "跳过引导",
				next: "下一步",
				prev: "上一步",
				done: "开始使用",
				restart: "重新查看引导",
				stepOf: (current, total) => `第 ${current} / ${total} 步`
			},
			en: {
				title: "Quick start",
				skip: "Skip guide",
				next: "Next",
				prev: "Back",
				done: "Get started",
				restart: "Show guide again",
				stepOf: (current, total) => `Step ${current} of ${total}`
			},
			ja: {
				title: "クイックスタート",
				skip: "ガイドをスキップ",
				next: "次へ",
				prev: "戻る",
				done: "はじめる",
				restart: "ガイドをもう一度表示",
				stepOf: (current, total) => `ステップ ${current} / ${total}`
			},
			ko: {
				title: "빠른 시작",
				skip: "가이드 건너뛰기",
				next: "다음",
				prev: "이전",
				done: "시작하기",
				restart: "가이드 다시 보기",
				stepOf: (current, total) => `${current} / ${total} 단계`
			},
			fr: {
				title: "Démarrage rapide",
				skip: "Ignorer le guide",
				next: "Suivant",
				prev: "Retour",
				done: "Commencer",
				restart: "Revoir le guide",
				stepOf: (current, total) => `Étape ${current} sur ${total}`
			},
			de: {
				title: "Schnellstart",
				skip: "Anleitung überspringen",
				next: "Weiter",
				prev: "Zurück",
				done: "Loslegen",
				restart: "Anleitung erneut anzeigen",
				stepOf: (current, total) => `Schritt ${current} von ${total}`
			},
			it: {
				title: "Avvio rapido",
				skip: "Salta la guida",
				next: "Avanti",
				prev: "Indietro",
				done: "Inizia",
				restart: "Rivedi la guida",
				stepOf: (current, total) => `Passo ${current} di ${total}`
			},
			ru: {
				title: "Быстрый старт",
				skip: "Пропустить руководство",
				next: "Далее",
				prev: "Назад",
				done: "Начать",
				restart: "Показать руководство снова",
				stepOf: (current, total) => `Шаг ${current} из ${total}`
			},
			es: {
				title: "Inicio rápido",
				skip: "Omitir la guía",
				next: "Siguiente",
				prev: "Atrás",
				done: "Empezar",
				restart: "Ver la guía de nuevo",
				stepOf: (current, total) => `Paso ${current} de ${total}`
			},
			pt: {
				title: "Início rápido",
				skip: "Ignorar o guia",
				next: "Próximo",
				prev: "Voltar",
				done: "Começar",
				restart: "Ver o guia novamente",
				stepOf: (current, total) => `Passo ${current} de ${total}`
			}
		};
		/** 语言标签 → 语言码：只认主标签，认不出的落 null（由调用方回退 en）。 */
		function normalizeGuideLocale(tag) {
			const primary = tag.toLowerCase().trim().split(/[-_]/)[0] ?? "";
			return GUIDE_LOCALES.includes(primary) ? primary : null;
		}
		function htmlLang() {
			try {
				return typeof document === "undefined" ? "" : document.documentElement?.lang ?? "";
			} catch {
				return "";
			}
		}
		/**
		* 当前引导语言：以宿主 `<html lang>` 为准（语言切换会改写这个属性）。
		*
		* 认不出 → en：引导是「帮助」面，宁可给英文也不能给空白或中文硬串。
		*/
		function currentGuideLocale() {
			return normalizeGuideLocale(htmlLang()) ?? "en";
		}
		/** 引导外壳取词。 */
		function guideLabels(locale = currentGuideLocale()) {
			return GUIDE_COPY[locale] ?? GUIDE_COPY.en;
		}
		/**
		* 步骤正文取词：本语 → en → zh → 表里第一个可用。
		*
		* 为什么需要回退链：九插件分批补语种，某个插件可能只有 zh/en 而宿主是 ru；
		* 这时给英文是可用的，给空白等于「引导坏了」。`undefined` 步骤表按空表处理。
		*/
		function guideSteps(map) {
			if (map === void 0) return [];
			const order = [
				currentGuideLocale(),
				"en",
				"zh"
			];
			for (const key of order) {
				const hit = key === void 0 ? void 0 : map[key];
				if (hit !== void 0 && hit.length > 0) return hit;
			}
			for (const key of GUIDE_LOCALES) {
				const hit = map[key];
				if (hit !== void 0 && hit.length > 0) return hit;
			}
			return [];
		}
		function guideStorageKey(ns) {
			return `dsh.guide.${ns}.skipped`;
		}
		/** 是否已跳过（存储不可用时按「未跳过」处理：宁可多教一次，不要静默不教）。 */
		function isGuideSkipped(ns) {
			try {
				return typeof localStorage !== "undefined" && localStorage.getItem(guideStorageKey(ns)) === "1";
			} catch {
				return false;
			}
		}
		/** 记下跳过；写失败不抛（隐私模式 / 存储禁用）。 */
		function skipGuide(ns) {
			try {
				localStorage?.setItem(guideStorageKey(ns), "1");
			} catch {}
		}
		/** 清标记 = 允许重新教学。 */
		function resetGuide(ns) {
			try {
				localStorage?.removeItem(guideStorageKey(ns));
			} catch {}
		}
		const GUIDE_CSS = `
.sgGuide{border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06));border-radius:12px;padding:14px 16px;margin:0 0 12px}
.sgGuideHead{display:flex;align-items:center;gap:8px;margin:0 0 10px}
.sgGuideTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary, currentColor)}
.sgGuideStep{font-size:12px;color:var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));margin-left:auto}
.sgGuideBody{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary, currentColor);min-height:52px}
.sgGuideBody b{color:var(--dsw-alias-label-primary, currentColor);font-weight:600}
.sgGuideDots{display:flex;gap:6px;margin:10px 0 0}
.sgGuideDot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-border-l2, rgba(127,127,127,.3))}
.sgGuideDot-on{background:var(--dsw-alias-button-primary-fill, #4d6bfe)}
.sgGuideFoot{display:flex;align-items:center;gap:8px;margin:12px 0 0}
.sgGuideBtn{appearance:none;font:inherit;font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-primary, currentColor);cursor:pointer}
.sgGuideBtn-primary{background:var(--dsw-alias-button-primary-fill, #4d6bfe);border-color:transparent;color:#fff}
.sgGuideBtn-skip{margin-right:auto;color:var(--dsw-alias-label-tertiary, rgba(127,127,127,.9));border-color:transparent;text-decoration:underline}
.sgGuideRestart{appearance:none;font:inherit;font-size:12px;line-height:1.4;padding:4px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35));background:var(--dsw-alias-bg-layer-2, rgba(127,127,127,.06));color:var(--dsw-alias-label-primary, currentColor);cursor:pointer;text-decoration:none}
.sgGuideRestart:hover{border-color:var(--dsw-alias-button-primary-fill, #4d6bfe);color:var(--dsw-alias-button-primary-fill, #4d6bfe)}
`;
		function injectGuideCss() {
			try {
				if (typeof document === "undefined") return;
				if (typeof document.querySelector !== "function") return;
				if (typeof document.createElement !== "function") return;
				if (!document.head) return;
				if (document.querySelector("style[data-plugin-css=\"guide-kit\"]") !== null) return;
				const tag = document.createElement("style");
				tag.dataset.pluginCss = "guide-kit";
				tag.textContent = GUIDE_CSS;
				document.head.appendChild(tag);
			} catch {}
		}
		/** 语言变更订阅：语言切换后重渲染词表（引导是短生命周期，直接跟随 <html lang>）。 */
		function useLangTick() {
			const [, setTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				try {
					if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
					if (!document.documentElement) return;
					const observer = new MutationObserver(() => setTick((n) => n + 1));
					observer.observe(document.documentElement, {
						attributes: true,
						attributeFilter: ["lang"]
					});
					return () => observer.disconnect();
				} catch {
					return;
				}
			}, []);
		}
		/**
		* 引导主体：≤10 步的小教学（惯例：末条讲「用量端点」贴士）+ 恒定可见的 Skip。
		*
		* `onClose` 由宿主卡面传：Skip/Done 都会调用它（Skip 同时写标记）。
		*/
		function GuidePanel(props) {
			const { ns, steps, onClose } = props;
			const [index, setIndex] = (0, react.useState)(0);
			useLangTick();
			const labels = guideLabels();
			(0, react.useEffect)(() => {
				injectGuideCss();
			}, []);
			if (steps.length === 0) return null;
			const current = steps[Math.min(index, steps.length - 1)];
			const last = index >= steps.length - 1;
			const finish = () => {
				skipGuide(ns);
				onClose();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "sgGuide",
				"aria-label": labels.title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "sgGuideHead",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sgGuideTitle",
							children: labels.title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "sgGuideStep",
							children: labels.stepOf(index + 1, steps.length)
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "sgGuideBody",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: current.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: current.body })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "sgGuideDots",
						"aria-hidden": "true",
						children: steps.map((step, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sgGuideDot" + (i === index ? " sgGuideDot-on" : "") }, step.title))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
						className: "sgGuideFoot",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn sgGuideBtn-skip",
								onClick: () => finish(),
								children: labels.skip
							}),
							index > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn",
								onClick: () => setIndex(index - 1),
								children: labels.prev
							}),
							last ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn sgGuideBtn-primary",
								onClick: () => finish(),
								children: labels.done
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "sgGuideBtn sgGuideBtn-primary",
								onClick: () => setIndex(index + 1),
								children: labels.next
							})
						]
					})
				]
			});
		}
		/**
		* 重启入口：清标记 + 就地重开引导。
		*
		* 统一件，避免九插件各写一份（措辞/样式/清标记时机容易走样）。跳过之后
		* 用户想再看一次，不需要去清浏览器存储。
		*/
		function GuideRestartButton(props) {
			const { ns, onOpen, style } = props;
			useLangTick();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "sgGuideRestart",
				style,
				onClick: () => {
					resetGuide(ns);
					onOpen();
				},
				children: guideLabels().restart
			});
		}
		// src/client/guide-steps.ts
		const PERM_GATE_GUIDE_STEPS = {
			zh: [
				{
					title: "它管的是「要不要问你」",
					body: "总开关叫「宽松模式」：关着时按宿主权限档走；打开后由本插件判断哪些工具调用可以直接放行、哪些必须问你。"
				},
				{
					title: "三种后端策略，可叠加",
					body: "信任自动放行 / 一律确认 / LLM 评审。只想少弹窗就开第一个；处理陌生仓库时打开第二个，宁可多问一句。"
				},
				{
					title: "被拦了什么，去「判定记录」看",
					body: "输入框旁的提示条和侧栏历史记录会列出每次判定及理由；误判就地加入白名单或补一条拒绝关键词，下次不再问。"
				},
				{
					title: "评审模型建议挂本地端点",
					body: "「llmAssist 受信 LLM」的来源选「自定义 API（OpenAI 兼容）」，Endpoint 填本地服务（如 http://127.0.0.1:8000/v1）再写一个小模型 id；来源停在「使用会话当前默认模型」时，评审和被评审的对话跑在同一个 provider/model 上——每次工具调用都要再走一遍主模型，用量直接翻倍。"
				}
			],
			en: [
				{
					title: "It decides whether to ask you",
					body: "The master switch is \"permissive\": off means the host permission tier rules; on means this plugin decides which tool calls pass straight through and which must ask you."
				},
				{
					title: "Three backend strategies, combinable",
					body: "Trust-auto-allow / always-confirm / LLM review. Turn on the first if you just want fewer prompts; turn on the second on unfamiliar repos — better one extra question."
				},
				{
					title: "See what got gated",
					body: "The notice strip beside the composer and the sidebar history list every decision with its reason. Add a whitelist pattern or a deny keyword right there and it stops asking next time."
				},
				{
					title: "Point the reviewer at a local endpoint",
					body: "Set the llmAssist receiver source to “Custom API (OpenAI-compatible)”, put a local service in Endpoint (e.g. http://127.0.0.1:8000/v1) and pick a small model. Left on “Use the session’s current default model”, the reviewer and the reviewed conversation run on one provider/model, so every tool call runs the main model again and doubles spend."
				}
			]
		};
		// src/client/star-row-copy.ts
		/**
		* star-row 真源（面板 star 快车道行，v1）——纯 DOM 实现，零依赖。
		*
		* 副本约束：生成文件名 star-row-copy.ts，头部须保留 /** 块注释，单行 ≤140
		* 字宽（sidebar-fold 仓 lint 门禁：max-line + file-header）。
		*
		* 契约（对齐 panel-star-row spec）：
		*  - 渲染一行 <a>：GitHub 单色 SVG + `owner/name`；variant A 追加一句工程话术；
		*  - 整行即链接（A/L 档），新标签页打开；不做弹窗、不做按钮交互；
		*  - 文案内嵌 10 语，按 `document.documentElement.lang` 前缀自选
		*    （同 sidebar-fold `pickDictionary` 口径），不依赖宿主 locale 服务，
		*    避免逐仓动字典文件；
		*  - 样式一次性注入 <style data-dsh-star-row>，色随 currentColor，深浅主题自适应；
		*  - 副本由 _tools/star-row/sync.mjs 生成到各仓 `src/client/star-row-copy.ts`
		*    （文件名含 copy，locale 守卫豁免规则命中），改副本无效，改真源后重跑 sync。
		*
		* 每仓生成时在文件头部烘焙 REPO_URL / STAR_NS / STAR_VARIANT 三个常量。
		*/
		/** 生成段：REPO_URL / STAR_NS / STAR_VARIANT 由 sync 注入。 */
		const REPO_URL = "https://github.com/drscrewdriver/dsh-perm-gate";
		const STAR_NS = "perm-gate";
		const STAR_LANGS = [
			"zh",
			"en",
			"ja",
			"ko",
			"fr",
			"de",
			"it",
			"ru",
			"es",
			"pt"
		];
		/** GitHub mark（Simple Icons / octicon 轮廓，24 视口），fill 随 currentColor。 */
		const GITHUB_MARK_PATH = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332 -5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";
		const STYLE_ID = "dsh-star-row-style";
		const STYLE_CSS = [
			".dsh-star-row{display:flex;align-items:center;gap:7px;font-size:12px;",
			"line-height:1.5;color:inherit;text-decoration:none;opacity:.72;padding:3px 0;",
			"margin-top:6px;min-width:0;flex-wrap:wrap}",
			".dsh-star-row:hover{opacity:1;text-decoration:underline}",
			".dsh-star-row svg{width:14px;height:14px;flex:none;display:block}",
			".dsh-star-row .dsh-star-ask{opacity:.85;font-weight:400}"
		].join("");
		const STAR_FOOT_COPY = {
			zh: {
				ask: "觉得好用？",
				star: "去 GitHub 点个 Star",
				issue: "反馈建议 / 提 issue"
			},
			en: {
				ask: "Finding it useful?",
				star: "Star on GitHub",
				issue: "Feedback / open an issue"
			},
			ja: {
				ask: "お役に立っていますか？",
				star: "GitHub でスター",
				issue: "ご意見・不具合報告"
			},
			ko: {
				ask: "유용한가요?",
				star: "GitHub 에서 스타",
				issue: "피드백 / 이슈 열기"
			},
			fr: {
				ask: "Utile ?",
				star: "Une étoile sur GitHub",
				issue: "Retour / ouvrir un ticket"
			},
			de: {
				ask: "Hilfreich?",
				star: "Stern auf GitHub",
				issue: "Feedback / Issue öffnen"
			},
			it: {
				ask: "Ti è utile?",
				star: "Stella su GitHub",
				issue: "Feedback / apri una issue"
			},
			ru: {
				ask: "Полезно?",
				star: "Звезда на GitHub",
				issue: "Отзыв / открыть issue"
			},
			es: {
				ask: "¿Te resulta útil?",
				star: "Danos una estrella",
				issue: "Sugerencias / abrir issue"
			},
			pt: {
				ask: "Achou útil?",
				star: "Dê uma estrela no GitHub",
				issue: "Feedback / abrir uma issue"
			}
		};
		const STAR_FOOT_STYLE_ID = "dsh-star-foot-style";
		const STAR_FOOT_STYLE = [
			".dsh-star-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;",
			"font-size:12px;line-height:1.6;color:inherit;opacity:.72;margin-top:10px}",
			".dsh-star-foot:hover{opacity:1}",
			".dsh-star-foot .dsh-star-ver{opacity:.6;font-variant-numeric:tabular-nums}",
			".dsh-star-foot .dsh-star-dot{opacity:.4}",
			".dsh-star-foot a{color:inherit;text-decoration:none}",
			".dsh-star-foot a:hover{text-decoration:underline}"
		].join("");
		/** 宿主语言标签归一：取 `documentElement.lang` 的前缀，命中 STAR_LANGS 即用。 */
		function starLang() {
			const low = (typeof document !== "undefined" && document.documentElement.lang || "").toLowerCase();
			for (const cand of STAR_LANGS) if (low.startsWith(cand)) return cand;
			return "en";
		}
		/** 关闭态新键（v2）。**必须换键**：≤2.0.25 把「点 ★」误写成了关闭，旧键里的 1 是误判产物。 */
		const STAR_DISMISS_KEY = "dsh.star.perm-gate.v2.dismissed";
		/** 旧键（脏数据源）：读到即清掉，**不迁值**——迁过来等于把旧 bug 固化。 */
		const STAR_DISMISS_KEY_V1 = "dsh.star.perm-gate.dismissed";
		/** 是否已被用户点掉话术（隐私模式下读失败按未关闭处理，只影响本次会话）。 */
		function starDismissed() {
			try {
				if (localStorage.getItem(STAR_DISMISS_KEY_V1) !== null) localStorage.removeItem(STAR_DISMISS_KEY_V1);
				return localStorage.getItem(STAR_DISMISS_KEY) === "1";
			} catch {
				return false;
			}
		}
		/** 记住关闭态（隐私模式写失败不报错，话术本次隐藏、刷新复活）。 */
		function starDismiss() {
			try {
				localStorage.setItem(STAR_DISMISS_KEY, "1");
			} catch {}
		}
		/** 一次性注入页脚样式。 */
		function injectFootStyle(d) {
			if (d.getElementById(STAR_FOOT_STYLE_ID)) return;
			const style = d.createElement("style");
			style.id = STAR_FOOT_STYLE_ID;
			style.textContent = STAR_FOOT_STYLE;
			d.head.appendChild(style);
		}
		/** 页脚里的一段：可点即 <a>，纯文字即 <span>。 */
		function footItem(d, tag, text, href) {
			const el = d.createElement(tag);
			el.className = "dsh-star-ask";
			if (tag === "a" && href) {
				const a = el;
				a.href = href;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
			}
			el.textContent = text;
			return el;
		}
		/** 分隔点。 */
		function footDot(d) {
			const dot = d.createElement("span");
			dot.className = "dsh-star-dot";
			dot.textContent = "·";
			return dot;
		}
		/**
		* S 档：一行页脚；非 S 档或已关掉过话术时返回 null（走裸链接原路径）。
		* 点过任一链接 → 记关闭 + 换回中性一行，链接本身照常跳转（不 preventDefault）。
		*/
		function extendedStarRow(neutral, d) {
			if (starDismissed()) return null;
			injectFootStyle(d);
			const copy = STAR_FOOT_COPY[starLang()] ?? STAR_FOOT_COPY.en;
			const issuesUrl = REPO_URL.replace(/\/+$/, "") + "/issues/new";
			const row = d.createElement("div");
			row.className = "dsh-star-foot";
			const ver = d.createElement("span");
			ver.className = "dsh-star-ver";
			ver.textContent = "v5.7.5";
			row.appendChild(ver);
			row.appendChild(footDot(d));
			row.appendChild(footItem(d, "span", copy.ask));
			const star = footItem(d, "a", "⭐ " + copy.star, REPO_URL);
			const issue = footItem(d, "a", "💬 " + copy.issue, issuesUrl);
			row.appendChild(star);
			row.appendChild(footDot(d));
			row.appendChild(issue);
			const collapse = () => {
				starDismiss();
				if (row.parentNode) {
					neutral.className = "dsh-star-row";
					row.parentNode.replaceChild(neutral, row);
				}
			};
			star.addEventListener("click", collapse);
			issue.addEventListener("click", collapse);
			return row;
		}
		/** 在目标文档上建出快车道行（一次性注入样式）。纯 DOM，React 仓经 ref 回调挂载。 */
		function mountStarRow(doc) {
			const d = doc ?? document;
			if (!d.getElementById(STYLE_ID)) {
				const tag = d.createElement("style");
				tag.id = STYLE_ID;
				tag.textContent = STYLE_CSS;
				d.head.appendChild(tag);
			}
			const match = REPO_URL.match(/github\.com\/([^/]+\/[^/#?]+)/);
			const repo = match ? match[1] : "drscrewdriver";
			const a = d.createElement("a");
			a.className = "dsh-star-row";
			a.href = REPO_URL;
			a.target = "_blank";
			a.rel = "noreferrer";
			a.dataset.starNs = STAR_NS;
			const svg = d.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("aria-hidden", "true");
			const path = d.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("fill", "currentColor");
			path.setAttribute("d", GITHUB_MARK_PATH);
			svg.appendChild(path);
			a.appendChild(svg);
			const label = d.createElement("span");
			label.textContent = repo;
			a.appendChild(label);
			const row = extendedStarRow(a, d);
			if (row) return row;
			return a;
		}
		// src/client/card.tsx
		/**
		* Permissive settings card — the top-level `settings.section` (自动审查门) of dsh-perm-gate.
		*
		* The card binds the plugin's profile entry (`dsh-perm-gate`) through the
		* `configForms` cordis service and renders its fields: the single front switch
		* (`permissive`) plus the three combinable backend strategies
		* (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`). Every change commits
		* immediately through the scope (no staged form); the host reads the namespace
		* live, so a committed change applies to the next tool call without a restart.
		*
		* Kept dependency-free beyond react: the scope is subscribed with
		* `useSyncExternalStore`, and the controls are plain HTML.
		*/
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "12px",
			padding: "6px 0",
			fontSize: "13px",
			lineHeight: "20px"
		};
		const labelStyle = {
			margin: 0,
			color: "var(--dsw-alias-label-primary)"
		};
		const hintStyle = {
			margin: "4px 0 0",
			fontSize: "12px",
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const sectionStyle = {
			marginTop: "12px",
			paddingTop: "10px",
			borderTop: "1px solid var(--dsw-alias-border-l2)"
		};
		const controlStyle = {
			background: "var(--dsw-alias-bg-surface, #fff)",
			color: "var(--dsw-alias-label-primary)",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: "4px",
			padding: "3px 8px",
			fontSize: "13px"
		};
		const fieldStyle = {
			display: "flex",
			flexDirection: "column",
			gap: "4px"
		};
		const fieldLabelStyle = {
			margin: 0,
			fontSize: "12px",
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		/** Focus ring for the pill switch. `:focus-visible` cannot be expressed inline, so
		* the one pseudo-class the card needs rides on a single injected rule. */
		const switchCss = ".pg-switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#3b82f6));outline-offset:2px}.pg-seg:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#3b82f6));outline-offset:1px}";
		/**
		* Optimistic control state, shared by the pill switch and the tier picker: show the
		* requested value the instant it is clicked and hold it while the write round-trips
		* through the host settings service, then hand the visual back to the store — on the
		* snapshot catching up, on a rejected write, and on a watchdog for a host line that
		* neither applies nor reports the change. A control may be fast, but it may not lie.
		*/
		function useOptimistic(stored) {
			const [pending, setPending] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setPending((current) => pendingAfterSync(current, stored));
			}, [stored]);
			(0, react.useEffect)(() => {
				if (pending === null) return void 0;
				const timer = setTimeout(() => {
					setPending(pendingAfterFailure(pending));
				}, SWITCH_SETTLE_MS);
				return () => {
					clearTimeout(timer);
				};
			}, [pending]);
			const commit = (next, write) => {
				setPending(next);
				Promise.resolve(write()).catch(() => {
					setPending(null);
				});
			};
			return [shownValue(pending, stored), commit];
		}
		/**
		* One row of the unattended block: a switch, and the preset it owns.
		*
		* The preset id is rendered next to the label because the mapping is the whole design —
		* one switch, one implementation, one tier — and a person who sees 「机械直通」 in the
		* composer needs to know which row governs it. The id is a machine key, so it stays
		* untranslated on purpose.
		*/
		function TierRow(props) {
			const { id, label, preset, checked, disabled, hint, onCommit } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					htmlFor: id,
					style: { fontSize: "12px" },
					children: [label, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							color: "var(--dsw-alias-label-tertiary)",
							fontSize: "11px"
						},
						children: [" · ", preset]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
					id,
					checked,
					disabled,
					onCommit
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: hintStyle,
				children: hint
			})] });
		}
		/**
		* Pill switch — the card's boolean control, cut to the shape of the host's own
		* `ui-primitives` Switch: 36×20 capsule, 16px thumb, and the on/off appearance
		* keyed off `aria-checked` so assistive tech can never read a state the eye does
		* not see.
		*
		* Optimistic by design: the capsule flips on click and holds that position while
		* `scope.set` round-trips through the host settings service. A checkbox that
		* waits for the snapshot to come back reads as a dead control on a slow write.
		* The snapshot stays the truth — the state machine lives in `switch-state.ts`
		* (and under test there) so the pill can never sit in a state the profile does
		* not have.
		*
		* Every colour is a theme token with a fallback: `--dsw-alias-brand-primary`
		* only exists on newer host lines, and an "on" state that resolves to nothing is
		* an invisible control in dark mode.
		*/
		function PillSwitch(props) {
			const { id, checked, label, disabled = false, title, onCommit } = props;
			const [shown, commit] = useOptimistic(checked);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				id,
				type: "button",
				role: "switch",
				"aria-checked": shown,
				"aria-label": label,
				title,
				disabled,
				className: "pg-switch",
				style: {
					boxSizing: "border-box",
					position: "relative",
					flex: "0 0 auto",
					width: "36px",
					height: "20px",
					padding: "2px",
					border: "0",
					borderRadius: "999px",
					background: shown ? "var(--dsw-alias-brand-primary, var(--dsw-alias-state-business-primary, #3b82f6))" : "var(--dsw-alias-border-l3, var(--dsw-alias-border-l2, rgba(128,128,128,0.35)))",
					cursor: disabled ? "default" : "pointer",
					opacity: disabled ? .5 : 1,
					transition: "background 120ms ease"
				},
				onClick: () => {
					const next = !shown;
					commit(next, () => onCommit(next));
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					style: {
						display: "block",
						width: "16px",
						height: "16px",
						borderRadius: "50%",
						background: "var(--dsw-alias-label-primary-foreground, #fff)",
						transform: shown ? "translateX(16px)" : "translateX(0)",
						transition: "transform 120ms ease"
					}
				})
			});
		}
		/**
		* A minimal add/remove editor for one string-array setting.
		*
		* Deliberately generic and small: the long-tail protection lists (`credentialPaths`,
		* `denyKeywordsExtra`) are the same shape — lines a person types to protect something
		* the preset cannot know — and they should not each grow their own copy of the row
		* markup the deny blacklist already has.
		*/
		/**
		* cred family ladder — server-backed rows (`GET/POST /api/dsh-perm-gate/cred`).
		* The rung state lives in TWO stores the plugin owns — the family's row inside the
		* rules document (section + enabled) and the paired `credWriteExemptFamilies` list —
		* so the card must not keep a local mirror; it reads and writes through the route,
		* which applies both stores in one settings update. `readwrite` asks for an inline
		* confirmation: it is the only rung that steps a piece of P0 aside.
		*/
		const CRED_FAMILIES_UI = [
			["ssh", "SSH (~/.ssh)"],
			["cloud", "Cloud (.aws/.gcloud/.azure)"],
			["package", "Registry (.npmrc/.pypirc/.netrc)"],
			["gitcreds", "Git store (.git-credentials)"],
			["env", "Project (.env)"],
			["cli", "Coding CLI (~/.claude/.codex/gh)"],
			["db", "Database (.pgpass/.my.cnf)"]
		];
		const CRED_RUNGS_UI = [
			"deny",
			"ask",
			"readonly",
			"readwrite"
		];
		const CRED_RUNG_LABEL_KEY = {
			deny: "card.credRung.deny",
			ask: "card.credRung.ask",
			readonly: "card.credRung.readonly",
			readwrite: "card.credRung.readwrite"
		};
		function CredLadderSection(props) {
			const { t, readonly } = props;
			const [rungs, setRungs] = (0, react.useState)(null);
			const [confirm, setConfirm] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [rowError, setRowError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				let alive = true;
				fetch("/api/dsh-perm-gate/cred", { headers: { "cache-control": "no-cache" } }).then((r) => r.json()).then((b) => {
					if (alive && b?.rungs !== void 0) {
						setRungs(b.rungs);
						props.onRungs?.(b.rungs);
					}
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, []);
			const apply = (family, rung) => {
				setBusy(family);
				setRowError(null);
				const abort = new AbortController();
				const timer = setTimeout(() => {
					abort.abort();
				}, 1e4);
				fetch("/api/dsh-perm-gate/cred", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						family,
						rung
					}),
					signal: abort.signal
				}).then((r) => r.json()).then((b) => {
					if (b?.ok === true && b.rungs !== void 0) {
						setRungs(b.rungs);
						props.onRungs?.(b.rungs);
					} else setRowError({
						family,
						msg: String(b?.error ?? "failed")
					});
				}).catch((e) => {
					const msg = String(e?.name ?? e) === "AbortError" ? "timeout (10s)" : String(e);
					setRowError({
						family,
						msg
					});
				}).finally(() => {
					clearTimeout(timer);
					setBusy(null);
					setConfirm(null);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: labelStyle,
						children: t("card.credFamily")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle,
						children: t("card.credFamilyHint")
					}),
					rungs === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle,
						children: t("card.credFamilyLoading")
					}) : CRED_FAMILIES_UI.map(([family, display]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							...rowStyle,
							flexWrap: "wrap"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: "12px",
									color: "var(--dsw-alias-label-primary)"
								},
								children: display
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									display: "inline-flex",
									gap: "4px"
								},
								children: CRED_RUNGS_UI.map((rung) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: readonly || busy === family,
									style: {
										fontSize: "11px",
										padding: "2px 8px",
										cursor: "pointer",
										borderRadius: "10px",
										border: rungs[family] === rung ? "1px solid var(--dsw-alias-primary, #4a90d9)" : "1px solid transparent",
										background: rungs[family] === rung ? "rgba(74, 144, 217, 0.15)" : "transparent"
									},
									onClick: () => {
										if (rung === "readwrite" && confirm !== family) {
											setConfirm(family);
											return;
										}
										setConfirm(null);
										apply(family, rung);
									},
									children: t(CRED_RUNG_LABEL_KEY[rung])
								}, rung))
							}),
							confirm === family && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									width: "100%",
									fontSize: "12px",
									color: "var(--dsw-alias-label-secondary)"
								},
								children: [
									t("card.credReadwriteConfirm"),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: busy === family,
										style: {
											fontSize: "11px",
											marginLeft: "6px"
										},
										onClick: () => apply(family, "readwrite"),
										children: t("card.credConfirmYes")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											fontSize: "11px",
											marginLeft: "4px"
										},
										onClick: () => setConfirm(null),
										children: t("card.credConfirmNo")
									})
								]
							}),
							rowError !== null && rowError.family === family && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									width: "100%",
									fontSize: "11px",
									color: "var(--dsw-alias-danger, #c0392b)"
								},
								children: [
									family,
									": ",
									rowError.msg
								]
							})
						]
					}, family)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle,
						children: t("card.credFamilyFootnote")
					})
				]
			});
		}
		function StringListField(props) {
			const [draft, setDraft] = (0, react.useState)("");
			const add = () => {
				const next = draft.trim();
				if (next === "") return;
				props.onAdd(next);
				setDraft("");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: labelStyle,
					children: props.label
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: hintStyle,
					children: props.hint
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: "4px",
						margin: "6px 0"
					},
					children: props.items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: "8px",
							padding: "4px 8px",
							borderRadius: "6px",
							border: "1px solid var(--dsw-alias-border-l2)",
							background: "var(--dsw-alias-bg-surface, transparent)"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							style: {
								flex: "1 1 auto",
								minWidth: 0,
								overflowWrap: "anywhere",
								font: "500 12px/18px var(--ds-font-family-code, monospace)",
								color: "var(--dsw-alias-label-primary)"
							},
							children: item
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": props.removeLabel,
							title: props.removeLabel,
							disabled: props.locked,
							onClick: () => {
								props.onRemove(index);
							},
							style: {
								flex: "0 0 auto",
								width: "20px",
								height: "20px",
								border: "none",
								borderRadius: "999px",
								background: "transparent",
								color: "var(--dsw-alias-label-tertiary)",
								cursor: props.locked ? "default" : "pointer"
							},
							children: "✕"
						})]
					}, `${index}:${item}`))
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						gap: "6px",
						marginTop: "6px"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "text",
						value: draft,
						disabled: props.locked,
						placeholder: props.placeholder,
						spellCheck: false,
						style: {
							...controlStyle,
							flex: "1 1 auto",
							minWidth: 0
						},
						onChange: (event) => {
							setDraft(event.currentTarget.value);
						},
						onKeyDown: (event) => {
							if (event.key === "Enter") add();
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: props.locked || draft.trim() === "",
						onClick: add,
						style: {
							...controlStyle,
							flex: "0 0 auto",
							cursor: props.locked || draft.trim() === "" ? "default" : "pointer",
							opacity: props.locked || draft.trim() === "" ? .5 : 1
						},
						children: props.addLabel
					})]
				})
			] });
		}
		/** Stable snapshot served while the real scope has not resolved yet — the
		* store hook needs a referentially stable object; the diagnostic placeholder
		* renders instead of the card body in that case. */
		const EMPTY_SNAPSHOT = {
			status: "unavailable",
			value: null,
			writable: false
		};
		const drawerGroupStyle = {
			border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
			borderRadius: "10px",
			background: "var(--dsw-alias-bg-surface, transparent)",
			overflow: "hidden"
		};
		const drawerHeaderStyle = {
			appearance: "none",
			width: "100%",
			font: "inherit",
			color: "inherit",
			textAlign: "left",
			cursor: "pointer",
			background: "none",
			border: 0,
			display: "flex",
			alignItems: "center",
			gap: "8px",
			padding: "10px 12px"
		};
		const drawerTitleStyle = {
			fontSize: "13px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)",
			flex: "0 1 auto",
			minWidth: 0
		};
		const drawerSummaryStyle = {
			flex: "1 1 auto",
			minWidth: 0,
			textAlign: "right",
			fontSize: "12px",
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
			overflowWrap: "anywhere"
		};
		const drawerBodyStyle = { padding: "2px 12px 12px" };
		/**
		* One denylist row: keyword + remove. `muted` marks built-in preset words —
		* visually quieter, because they are the default rather than a decision the
		* person made (they live inside the collapsed built-ins sublist).
		*/
		function DenyRow(props) {
			const { keyword, index, muted, locked, removeLabel, onRemove } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: "4px 8px",
					borderRadius: "6px",
					border: "1px solid var(--dsw-alias-border-l2)",
					background: "var(--dsw-alias-bg-surface, transparent)"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
					style: {
						flex: "1 1 auto",
						minWidth: 0,
						overflowWrap: "anywhere",
						font: "500 12px/18px var(--ds-font-family-code, monospace)",
						color: muted ? "var(--dsw-alias-label-tertiary)" : "var(--dsw-alias-label-primary)"
					},
					children: keyword
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": removeLabel,
					title: removeLabel,
					disabled: locked,
					onClick: () => {
						onRemove(index);
					},
					style: {
						flex: "0 0 auto",
						width: "20px",
						height: "20px",
						border: "none",
						borderRadius: "999px",
						background: "transparent",
						color: "var(--dsw-alias-label-tertiary)",
						cursor: locked ? "default" : "pointer"
					},
					children: "✕"
				})]
			});
		}
		/**
		* One collapsible group inside the settings card.
		*
		* The card body is cut into titled drawers so the front switch and the preset
		* scope note stay first-screen while every block (tiers / strategies / testing
		* / lists / credentials / network) folds behind a header. The header always
		* shows a live state summary — a drawer communicates what it is doing without
		* being opened, mirroring the outer disclosure pattern this card already uses
		* (and the multi-group precedent in thinking-levels' card).
		*
		* `onFirstOpen` fires once, on the first expansion: groups whose content costs
		* a fetch (the rules viewer) load lazily instead of on mount.
		*/
		function DrawerGroup(props) {
			const { id, title, summary, onFirstOpen, children } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const firedRef = (0, react.useRef)(false);
			const toggle = () => {
				const next = !open;
				setOpen(next);
				if (next && onFirstOpen !== void 0 && !firedRef.current) {
					firedRef.current = true;
					onFirstOpen();
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: drawerGroupStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-expanded": open,
					"aria-controls": id,
					onClick: toggle,
					style: drawerHeaderStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "14",
							height: "14",
							viewBox: "0 0 16 16",
							"aria-hidden": true,
							style: {
								color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
								flex: "0 0 auto",
								transition: "transform 0.16s",
								transform: open ? "rotate(180deg)" : "none"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M4 6l4 4 4-4",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.5",
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: drawerTitleStyle,
							children: title
						}),
						summary !== void 0 && summary !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: drawerSummaryStyle,
							children: summary
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": true,
							style: { flex: "1 1 auto" }
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					id,
					style: drawerBodyStyle,
					children
				}) : null]
			});
		}
		/**
		* The card body, wrapped in a disclosure shell like every peer settings card:
		* a header (name + description + chevron) toggling the body. The body keeps
		* the front switch and the preset-scope note first-screen, then cuts the rest
		* into six titled drawers (see DrawerGroup) so the page reads as a short
		* index with live summaries instead of one long form.
		*/
		function PermissiveCard({ t, scope }) {
			const [open, setOpen] = (0, react.useState)(true);
			const [guideOpen, setGuideOpen] = (0, react.useState)(() => !isGuideSkipped("perm-gate"));
			const [apiKeyDraft, setApiKeyDraft] = (0, react.useState)("");
			const [allowText, setAllowText] = (0, react.useState)("");
			const [allowDirty, setAllowDirty] = (0, react.useState)(false);
			const snapshot = (0, react.useSyncExternalStore)(scope ? (listener) => scope.subscribe(listener) : (listener) => {
				return () => {};
			}, () => scope ? scope.getSnapshot() : EMPTY_SNAPSHOT);
			const unavailable = snapshot.status === "unavailable";
			const readonly = unavailable || !snapshot.writable;
			const raw = snapshot.value ?? {};
			const listOf = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
			const value = {
				...raw,
				allowlist: listOf(raw.allowlist),
				denyKeywords: listOf(raw.denyKeywords),
				denyKeywordsExtra: listOf(raw.denyKeywordsExtra),
				credentialPaths: listOf(raw.credentialPaths),
				extraContentArgKeys: listOf(raw.extraContentArgKeys),
				extraOperationArgKeys: listOf(raw.extraOperationArgKeys),
				autoAllowTools: listOf(raw.autoAllowTools)
			};
			const strategies = value.permissiveStrategies ?? {};
			const hasApiKey = typeof value.classifierApiKey === "string" && value.classifierApiKey !== "";
			const effective = value.permissive === true;
			const gateScope = (value.gatePresets ?? []).length > 0 ? value.gatePresets : [...DEFAULT_GATE_PRESETS];
			const commitApiKey = () => {
				const next = apiKeyDraft.trim();
				if (next === "") return;
				scope.set("classifierApiKey", next);
				setApiKeyDraft("");
			};
			const clearApiKey = () => {
				scope.unset("classifierApiKey");
				setApiKeyDraft("");
			};
			const allowlistShown = allowDirty ? allowText : (value.allowlist ?? []).join("\n");
			const commitAllowlist = () => {
				const lines = allowlistShown.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
				scope.set("allowlist", lines);
				setAllowDirty(false);
			};
			const [addDraft, setAddDraft] = (0, react.useState)("");
			const [bulkOpen, setBulkOpen] = (0, react.useState)(false);
			const [healthBusy, setHealthBusy] = (0, react.useState)(false);
			const [healthResult, setHealthResult] = (0, react.useState)(null);
			const [dryTool, setDryTool] = (0, react.useState)("shell");
			const [dryCommand, setDryCommand] = (0, react.useState)("");
			const [dryBusy, setDryBusy] = (0, react.useState)(false);
			const [dryReport, setDryReport] = (0, react.useState)(null);
			const [dryError, setDryError] = (0, react.useState)(null);
			const runDryRunTest = () => {
				const tool = dryTool.trim() === "" ? "shell" : dryTool.trim();
				const command = dryCommand.trim();
				setDryBusy(true);
				setDryError(null);
				setDryReport(null);
				fetch("/api/dsh-perm-gate/dry-run", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						tool,
						args: command === "" ? {} : { command }
					})
				}).then(async (r) => {
					const text = await r.text();
					if (r.status === 404) throw new Error(t("card.dryRunStale"));
					try {
						return JSON.parse(text);
					} catch {
						throw new Error(text.trim().slice(0, 120) !== "" ? text.trim().slice(0, 120) : `HTTP ${r.status}`);
					}
				}).then((res) => {
					if (res.ok === true && res.result !== void 0) setDryReport(res.result);
					else setDryError(res.error ?? t("card.dryRunFail"));
				}).catch((e) => {
					setDryError(String(e?.message ?? e));
				}).finally(() => {
					setDryBusy(false);
				});
			};
			const [rulesBody, setRulesBody] = (0, react.useState)(null);
			const [rulesBusy, setRulesBusy] = (0, react.useState)(false);
			const [rulesError, setRulesError] = (0, react.useState)(null);
			const loadRules = () => {
				setRulesBusy(true);
				setRulesError(null);
				fetch("/api/dsh-perm-gate/rules", { headers: { "cache-control": "no-cache" } }).then(async (r) => {
					const text = await r.text();
					if (r.status === 404) throw new Error(t("card.rulesStale"));
					try {
						return JSON.parse(text);
					} catch {
						throw new Error(text.trim().slice(0, 120) !== "" ? text.trim().slice(0, 120) : `HTTP ${r.status}`);
					}
				}).then((res) => {
					if (res.ok === true && res.result !== void 0) setRulesBody(res.result);
					else setRulesError(res.error ?? t("card.rulesError"));
				}).catch((e) => {
					setRulesError(String(e?.message ?? e));
				}).finally(() => {
					setRulesBusy(false);
				});
			};
			const receiverSource = (value.classifierSource ?? "custom") === "host" ? "host" : "custom";
			const [receiverInfo, setReceiverInfo] = (0, react.useState)(null);
			const [receiverNonce, setReceiverNonce] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				let alive = true;
				fetch("/api/dsh-perm-gate/receiver", { headers: { "cache-control": "no-cache" } }).then((r) => r.ok ? r.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${r.status}`))).then((data) => {
					if (alive) setReceiverInfo(data);
				}).catch(() => {
					if (alive) setReceiverInfo(null);
				});
				return () => {
					alive = false;
				};
			}, [receiverSource, receiverNonce]);
			const receiverProviderDraft = value.classifierProvider ?? "";
			const patterns = value.allowlist ?? [];
			const removePattern = (index) => {
				scope.set("allowlist", patterns.filter((_, i) => i !== index));
			};
			const addPattern = () => {
				const next = addDraft.trim();
				if (next === "" || readonly) return;
				scope.set("allowlist", [...patterns, next]);
				setAddDraft("");
			};
			const denyActive = Array.isArray(value.denyKeywords) && value.denyKeywords.length > 0;
			const denylist = denyActive ? value.denyKeywords : [...DEFAULT_DENY_KEYWORDS];
			const [denyDraft, setDenyDraft] = (0, react.useState)("");
			const removeDeny = (index) => {
				scope.set("denyKeywords", denylist.filter((_, i) => i !== index));
			};
			const addDeny = () => {
				const next = denyDraft.trim();
				if (next === "" || readonly) return;
				scope.set("denyKeywords", [...denylist, next]);
				setDenyDraft("");
			};
			const restoreDeny = () => {
				scope.unset("denyKeywords");
			};
			const [presetDenyOpen, setPresetDenyOpen] = (0, react.useState)(false);
			const denyPairs = denylist.map((keyword, index) => ({
				keyword,
				index,
				preset: DEFAULT_DENY_KEYWORDS.includes(keyword)
			}));
			const customDeny = denyPairs.filter((pair) => !pair.preset);
			const presetDeny = denyPairs.filter((pair) => pair.preset);
			const [credRwCount, setCredRwCount] = (0, react.useState)(null);
			const handleCredRungs = (rungs) => {
				setCredRwCount(Object.values(rungs).filter((rung) => rung === "readwrite").length);
			};
			const enabledTiers = [
				...value.yolo === true ? ["YOLO"] : [],
				...value.safenetPass !== false ? [t("card.mode.pass")] : [],
				...value.safenetAsk === true ? [t("card.mode.ask")] : []
			];
			const tiersSummary = enabledTiers.length > 0 ? enabledTiers.join(" · ") : t("card.summaryNone");
			const enabledStrategies = [
				strategies.trustAutoAllow ?? true,
				strategies.alwaysConfirm ?? false,
				strategies.llmAssist ?? false,
				strategies.trustEscalation ?? true
			].filter((flag) => flag === true).length;
			const strategiesSummary = (enabledStrategies === 0 ? t("card.summaryNone") : t("card.summaryStrategies").replace("%n", String(enabledStrategies))) + (strategies.llmAssist === true ? " · llmAssist" : "");
			const listsSummary = t("card.summaryLists").replace("%a", String(patterns.length + (value.autoAllowTools ?? []).length)).replace("%d", String((denyActive ? denylist.length : 0) + (value.denyKeywordsExtra ?? []).length));
			const credSummary = credRwCount === null ? void 0 : t("card.summaryCredRw").replace("%n", String(credRwCount));
			const networkSummary = t("card.summaryNetwork").replace("%net", value.networkEnabled === true ? t("card.summaryOn") : t("card.summaryOff")).replace("%w", value.watch !== false ? t("card.summaryOn") : t("card.summaryOff"));
			if (!scope) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: 16,
					color: "var(--dsw-alias-label-tertiary, #888)"
				},
				children: [t("card.unavailable"), t("card.scopeUnresolved")]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
					background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))",
					borderRadius: "12px",
					transition: "border-color 0.16s, background 0.16s"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-expanded": open,
						style: {
							appearance: "none",
							width: "100%",
							font: "inherit",
							color: "inherit",
							textAlign: "left",
							cursor: "pointer",
							background: "none",
							border: 0,
							borderRadius: "12px",
							display: "flex",
							alignItems: "center",
							gap: "12px",
							padding: "14px 16px"
						},
						onClick: () => {
							setOpen((current) => !current);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: {
								flex: "1 1 0%",
								minWidth: 0
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: "14px",
									fontWeight: 600,
									color: "var(--dsw-alias-label-primary)"
								},
								children: t("card.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
									fontSize: "13px",
									lineHeight: 1.5
								},
								children: t("card.description")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 16 16",
							"aria-hidden": true,
							style: {
								color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
								flex: "0 0 auto",
								transition: "transform 0.16s",
								transform: open ? "rotate(180deg)" : "none"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M4 6l4 4 4-4",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.5",
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						})]
					}),
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { padding: "12px 16px" },
						children: unavailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: "13px",
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: t("card.unavailable")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: switchCss }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: { margin: "0 0 10px" },
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GuideRestartButton, {
									ns: "perm-gate",
									onOpen: () => {
										setGuideOpen(true);
									}
								})
							}),
							guideOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(GuidePanel, {
								ns: "perm-gate",
								steps: guideSteps(PERM_GATE_GUIDE_STEPS),
								onClose: () => {
									setGuideOpen(false);
								}
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									htmlFor: "plugin-config-perm-gate-permissive",
									style: labelStyle,
									children: t("card.permissive")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
									id: "plugin-config-perm-gate-permissive",
									checked: effective,
									disabled: readonly,
									onCommit: (next) => scope.set("permissive", next)
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: hintStyle,
								children: t("card.permissiveHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: hintStyle,
								children: t("card.scopeNote").replace("%scope", gateScope.join(" / "))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: "10px",
									marginTop: "12px"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DrawerGroup, {
										id: "pg-drawer-unattended",
										title: t("card.unattended"),
										summary: tiersSummary,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.unattendedHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TierRow, {
												id: "plugin-config-perm-gate-yolo",
												label: t("card.yolo"),
												preset: "permissive-yolo",
												checked: value.yolo === true,
												disabled: readonly,
												hint: t("card.yoloHint"),
												onCommit: (next) => scope.set("yolo", next)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-yolo-exempt",
													style: { fontSize: "12px" },
													children: t("card.yoloExempt")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-yolo-exempt",
													checked: value.yoloWorkspaceExempt === true,
													disabled: readonly,
													onCommit: (next) => scope.set("yoloWorkspaceExempt", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.yoloExemptHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TierRow, {
												id: "plugin-config-perm-gate-safenet-pass",
												label: t("card.mode.pass"),
												preset: "permissive-mech",
												checked: value.safenetPass !== false,
												disabled: readonly,
												hint: t("card.passHint"),
												onCommit: (next) => scope.set("safenetPass", next)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TierRow, {
												id: "plugin-config-perm-gate-safenet-ask",
												label: t("card.mode.ask"),
												preset: "permissive-snet",
												checked: value.safenetAsk === true,
												disabled: readonly,
												hint: t("card.askHint"),
												onCommit: (next) => scope.set("safenetAsk", next)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-rules-fallback",
													style: { fontSize: "12px" },
													children: t("card.rulesFallback")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-rules-fallback",
													checked: value.rulesFallback === true,
													disabled: readonly,
													onCommit: (next) => scope.set("rulesFallback", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.rulesFallbackHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-allow-protected-push",
													style: { fontSize: "12px" },
													children: t("card.allowProtectedBranchPush")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-allow-protected-push",
													checked: value.allowProtectedBranchPush === true,
													disabled: readonly,
													onCommit: (next) => scope.set("allowProtectedBranchPush", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.allowProtectedBranchPushHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-script-review",
													style: { fontSize: "12px" },
													children: t("card.scriptReview")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-script-review",
													checked: value.scriptReview !== false,
													disabled: readonly,
													onCommit: (next) => scope.set("scriptReview", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.scriptReviewHint")
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DrawerGroup, {
										id: "pg-drawer-strategies",
										title: t("card.strategies"),
										summary: strategiesSummary,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-trust",
													style: { fontSize: "12px" },
													children: t("card.strategy.trustAutoAllow")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-trust",
													checked: strategies.trustAutoAllow ?? true,
													disabled: readonly || !effective,
													onCommit: (next) => scope.set("permissiveStrategies", {
														...strategies,
														trustAutoAllow: next
													})
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-confirm",
													style: { fontSize: "12px" },
													children: t("card.strategy.alwaysConfirm")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-confirm",
													checked: strategies.alwaysConfirm ?? false,
													disabled: readonly || !effective,
													onCommit: (next) => scope.set("permissiveStrategies", {
														...strategies,
														alwaysConfirm: next
													})
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-llm",
													style: { fontSize: "12px" },
													children: t("card.strategy.llmAssist")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-llm",
													checked: strategies.llmAssist ?? false,
													disabled: readonly || !effective,
													onCommit: (next) => scope.set("permissiveStrategies", {
														...strategies,
														llmAssist: next
													})
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-escalation",
													style: { fontSize: "12px" },
													children: t("card.strategy.trustEscalation")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-escalation",
													checked: strategies.trustEscalation ?? true,
													disabled: readonly || !effective,
													onCommit: (next) => scope.set("permissiveStrategies", {
														...strategies,
														trustEscalation: next
													})
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.strategy.trustEscalationHint")
											}),
											strategies.llmAssist === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: labelStyle,
														children: t("card.llmReceiver")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: fieldLabelStyle,
															children: t("card.llmSource")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															value: value.classifierSource ?? "custom",
															disabled: readonly,
															style: controlStyle,
															onChange: (event) => {
																scope.set("classifierSource", event.currentTarget.value);
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "custom",
																children: t("card.llmSourceCustom")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																value: "host",
																children: t("card.llmSourceHost")
															})]
														})]
													}),
													(value.classifierSource ?? "custom") === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: fieldLabelStyle,
															children: t("card.llmPreset")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															value: "",
															disabled: readonly,
															style: controlStyle,
															onChange: (event) => {
																const v = event.currentTarget.value;
																if (v.startsWith("host:")) {
																	scope.set("classifierSource", "host");
																	scope.set("classifierProvider", v.slice(5));
																	return;
																}
																const preset = LLM_PRESETS.find((p) => p.id === v);
																if (preset !== void 0) {
																	scope.set("classifierEndpoint", preset.endpoint);
																	scope.set("classifierModel", preset.model);
																}
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "",
																	children: t("card.llmPresetChoose")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
																	label: t("card.llmPresetPublic"),
																	children: LLM_PRESETS.map((preset) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: preset.id,
																		children: preset.label
																	}, preset.id))
																}),
																(receiverInfo?.providers ?? []).length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("optgroup", {
																	label: t("card.llmPresetHost"),
																	children: (receiverInfo?.providers ?? []).map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: `host:${p.id}`,
																		children: `${t("card.llmSourceHost")} · ${p.id}`
																	}, `host:${p.id}`))
																}) : null
															]
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: fieldLabelStyle,
															children: t("card.llmEndpoint")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "text",
															value: value.classifierEndpoint ?? "",
															disabled: readonly,
															placeholder: "https://api.openai.com/v1",
															style: controlStyle,
															onChange: (event) => {
																scope.set("classifierEndpoint", event.currentTarget.value);
															},
															onBlur: (event) => {
																if (event.currentTarget.value.trim() === "") scope.unset("classifierEndpoint");
															}
														})]
													})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: hintStyle,
															children: t("card.llmSourceHostHint")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															style: fieldStyle,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.llmProvider")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "text",
																	list: "perm-gate-provider-options",
																	value: value.classifierProvider ?? "",
																	disabled: readonly,
																	placeholder: t("card.llmProviderPlaceholder"),
																	style: controlStyle,
																	onChange: (event) => {
																		scope.set("classifierProvider", event.currentTarget.value);
																	},
																	onBlur: (event) => {
																		if (event.currentTarget.value.trim() === "") scope.unset("classifierProvider");
																	}
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
																	id: "perm-gate-provider-options",
																	children: (receiverInfo?.providers ?? []).map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
																		value: p.id,
																		children: [p.name, p.error !== void 0 ? ` (${p.error})` : ""]
																	}, p.id))
																})
															]
														}),
														receiverInfo?.selection !== null && receiverInfo?.selection !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: hintStyle,
															children: t("card.llmResolved").replace("%p", receiverInfo.selection.provider).replace("%m", receiverInfo.selection.model)
														}) : null
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: fieldLabelStyle,
																children: t("card.llmModel")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																type: "text",
																list: receiverSource === "host" ? "perm-gate-model-options" : void 0,
																value: value.classifierModel ?? "",
																disabled: readonly,
																placeholder: receiverSource === "host" ? t("card.llmModelHostPlaceholder") : "deepseek-chat",
																style: controlStyle,
																onChange: (event) => {
																	scope.set("classifierModel", event.currentTarget.value);
																},
																onBlur: (event) => {
																	if (event.currentTarget.value.trim() === "") scope.unset("classifierModel");
																}
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("datalist", {
																id: "perm-gate-model-options",
																children: (receiverInfo?.providers ?? []).filter((p) => receiverProviderDraft === "" || p.id === receiverProviderDraft).flatMap((p) => p.models).map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: m.id,
																	children: m.name
																}, `${m.id}`))
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: fieldLabelStyle,
															children: t("card.llmEffort")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															value: value.classifierEffort ?? "",
															disabled: readonly || receiverSource !== "host",
															style: controlStyle,
															title: t("card.llmEffortHint"),
															onChange: (event) => {
																scope.set("classifierEffort", event.currentTarget.value);
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "",
																	children: t("card.llmEffortHost")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "off",
																	children: "off"
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "low",
																	children: "low"
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "medium",
																	children: "medium"
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "high",
																	children: "high"
																})
															]
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: fieldLabelStyle,
																children: t("card.llmKey")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "6px"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "password",
																	autoComplete: "off",
																	spellCheck: false,
																	value: apiKeyDraft,
																	disabled: readonly,
																	placeholder: hasApiKey ? t("card.llmKeyMasked") : t("card.llmKeyHidden"),
																	style: {
																		...controlStyle,
																		flex: "1 1 0%"
																	},
																	onChange: (event) => setApiKeyDraft(event.currentTarget.value),
																	onBlur: commitApiKey,
																	onKeyDown: (event) => {
																		if (event.key === "Enter") event.currentTarget.blur();
																	}
																}), hasApiKey ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																	type: "button",
																	disabled: readonly,
																	onClick: clearApiKey,
																	style: controlStyle,
																	children: t("card.llmKeyClear")
																}) : null]
															}),
															hasApiKey && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: hintStyle,
																children: t("card.llmKeyOverwrite")
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															alignItems: "center",
															gap: "8px",
															marginTop: "4px"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															disabled: readonly || healthBusy,
															onClick: () => {
																setHealthBusy(true);
																setHealthResult(null);
																fetch("/api/dsh-perm-gate/health", {
																	method: "POST",
																	headers: { "content-type": "application/json" },
																	body: "{}"
																}).then(async (r) => {
																	const text = await r.text();
																	if (r.status === 404) throw new Error(t("card.healthStale"));
																	try {
																		return JSON.parse(text);
																	} catch {
																		throw new Error(text.trim().slice(0, 120) !== "" ? text.trim().slice(0, 120) : `HTTP ${r.status}`);
																	}
																}).then((res) => {
																	setHealthResult(res.ok === true && typeof res.ms === "number" ? t("card.healthOk").replace("%ms", String(res.ms)) + (typeof res.detail === "string" ? ` · ${res.detail}` : "") : t("card.healthFail") + (res.detail ?? res.error ?? "unknown"));
																	setReceiverNonce((n) => n + 1);
																}).catch((e) => {
																	setHealthResult(t("card.healthFail") + String(e?.message ?? e));
																}).finally(() => {
																	setHealthBusy(false);
																});
															},
															style: {
																...controlStyle,
																cursor: readonly || healthBusy ? "default" : "pointer"
															},
															children: healthBusy ? t("card.healthRunning") : t("card.healthTest")
														}), healthResult !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: {
																fontSize: "12px",
																lineHeight: "18px",
																color: "var(--dsw-alias-label-secondary, inherit)",
																overflowWrap: "anywhere"
															},
															children: healthResult
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: rowStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
															htmlFor: "plugin-config-perm-gate-risk-learning",
															style: { fontSize: "12px" },
															children: t("card.riskLearning")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
															id: "plugin-config-perm-gate-risk-learning",
															checked: value.riskLearning ?? false,
															disabled: readonly || !effective,
															onCommit: (next) => scope.set("riskLearning", next)
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.riskLearningHint")
													}),
													value.riskLearning === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: fieldStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: fieldLabelStyle,
															children: t("card.riskThreshold")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															id: "plugin-config-perm-gate-risk-threshold",
															type: "number",
															min: 1,
															max: 10,
															value: value.riskThreshold ?? 3,
															disabled: readonly || !effective,
															style: {
																...controlStyle,
																width: "96px"
															},
															onChange: (event) => {
																const n = Number.parseInt(event.currentTarget.value, 10);
																if (Number.isFinite(n) && n >= 1 && n <= 10) scope.set("riskThreshold", n);
															}
														})]
													}) : null,
													value.riskLearning === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: rowStyle,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
																htmlFor: "plugin-config-perm-gate-risk-sediment",
																style: { fontSize: "12px" },
																children: t("card.riskSediment")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
																id: "plugin-config-perm-gate-risk-sediment",
																checked: value.riskSediment ?? true,
																disabled: readonly || !effective,
																onCommit: (next) => scope.set("riskSediment", next)
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: hintStyle,
															children: t("card.riskSedimentHint")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: rowStyle,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
																htmlFor: "plugin-config-perm-gate-learning-scope",
																style: { fontSize: "12px" },
																children: t("card.learningScope")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																id: "plugin-config-perm-gate-learning-scope",
																value: value.learningScope ?? "global",
																disabled: readonly || !effective,
																style: {
																	...controlStyle,
																	width: "180px"
																},
																onChange: (event) => {
																	const next = event.currentTarget.value === "session" ? "session" : "global";
																	scope.set("learningScope", next);
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "global",
																	children: t("card.learningScopeGlobal")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "session",
																	children: t("card.learningScopeSession")
																})]
															})]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: hintStyle,
															children: t("card.learningScopeHint")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: sectionStyle,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
																	style: labelStyle,
																	children: t("card.sediment")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
																	style: hintStyle,
																	children: t("card.sedimentHint")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SedimentSection, { t })
															]
														})
													] }) : null
												]
											}) : null
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DrawerGroup, {
										id: "pg-drawer-testing",
										title: t("card.testing"),
										onFirstOpen: loadRules,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: labelStyle,
														children: t("attention.title")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("attention.hint")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: rowStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
															htmlFor: "plugin-config-perm-gate-attention-toast",
															style: { fontSize: "12px" },
															children: t("attention.toast")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
															id: "plugin-config-perm-gate-attention-toast",
															checked: value.attentionToast ?? true,
															disabled: readonly || !effective,
															onCommit: (next) => scope.set("attentionToast", next)
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: rowStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
															htmlFor: "plugin-config-perm-gate-attention-sound",
															style: { fontSize: "12px" },
															children: t("attention.sound")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
															id: "plugin-config-perm-gate-attention-sound",
															checked: value.attentionSound ?? false,
															disabled: readonly || !effective,
															onCommit: (next) => scope.set("attentionSound", next)
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: rowStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
															htmlFor: "plugin-config-perm-gate-attention-gap",
															style: { fontSize: "12px" },
															children: t("attention.gap")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															id: "plugin-config-perm-gate-attention-gap",
															type: "number",
															min: 0,
															max: 6e5,
															step: 5e3,
															value: value.attentionMinGapMs ?? 3e4,
															disabled: readonly || !effective,
															style: {
																...controlStyle,
																width: "110px"
															},
															onChange: (event) => {
																const n = Number.parseInt(event.currentTarget.value, 10);
																if (Number.isFinite(n) && n >= 0) scope.set("attentionMinGapMs", n);
															}
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														disabled: readonly || !effective,
														style: {
															...controlStyle,
															marginTop: "6px",
															cursor: "pointer"
														},
														onClick: () => {
															try {
																chime();
															} catch {}
														},
														children: t("attention.test")
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: labelStyle,
														children: t("card.dryRun")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.dryRunHint")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															flexWrap: "wrap",
															gap: "8px",
															alignItems: "flex-end",
															margin: "6px 0"
														},
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																style: {
																	display: "flex",
																	flexDirection: "column",
																	gap: "4px",
																	flex: "0 0 120px"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.dryRunTool")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "text",
																	value: dryTool,
																	disabled: readonly,
																	placeholder: "shell",
																	onChange: (e) => {
																		setDryTool(e.target.value);
																	},
																	onKeyDown: (e) => {
																		if (e.key === "Enter") runDryRunTest();
																	},
																	style: controlStyle
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																style: {
																	display: "flex",
																	flexDirection: "column",
																	gap: "4px",
																	flex: "1 1 260px",
																	minWidth: 0
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.dryRunCommand")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	type: "text",
																	value: dryCommand,
																	disabled: readonly,
																	placeholder: t("card.dryRunCommandPlaceholder"),
																	onChange: (e) => {
																		setDryCommand(e.target.value);
																	},
																	onKeyDown: (e) => {
																		if (e.key === "Enter") runDryRunTest();
																	},
																	style: controlStyle
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																disabled: readonly || dryBusy,
																onClick: runDryRunTest,
																style: {
																	...controlStyle,
																	flex: "0 0 auto",
																	cursor: readonly || dryBusy ? "default" : "pointer"
																},
																children: dryBusy ? t("card.dryRunRunning") : t("card.dryRunTest")
															})
														]
													}),
													dryError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
														style: {
															...hintStyle,
															color: "var(--dsw-alias-label-error, #c0392b)"
														},
														children: [t("card.dryRunFail"), dryError]
													}),
													dryReport === null ? dryError === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.dryRunEmpty")
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															flexDirection: "column",
															gap: "4px",
															padding: "8px 10px",
															borderRadius: "6px",
															border: "1px solid var(--dsw-alias-border-l2)",
															background: "var(--dsw-alias-bg-surface, transparent)",
															fontSize: "12px",
															lineHeight: "18px"
														},
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	alignItems: "center",
																	gap: "8px"
																},
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		style: fieldLabelStyle,
																		children: t("card.dryRunVerdict")
																	}),
																	(() => {
																		const verdict = dryReport.verdict ?? "ask";
																		const colour = verdict === "deny" ? "var(--dsw-alias-label-error, #c0392b)" : verdict === "allow" ? "var(--dsw-alias-label-success, #2e7d32)" : "var(--dsw-alias-label-warning, #b26a00)";
																		const text = verdict === "deny" ? t("card.dryRunDeny") : verdict === "allow" ? t("card.dryRunAllow") : t("card.dryRunAsk");
																		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
																			style: { color: colour },
																			children: text
																		});
																	})(),
																	(dryReport.ruleCount ?? 0) === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		style: { color: "var(--dsw-alias-label-secondary, inherit)" },
																		children: t("card.dryRunNoRules")
																	})
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "8px",
																	overflowWrap: "anywhere"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.dryRunRule")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
																	style: {
																		font: "500 12px/18px var(--ds-font-family-code, monospace)",
																		color: "var(--dsw-alias-label-primary)"
																	},
																	children: dryReport.ruleLayer?.ruleIndex === void 0 ? t("card.dryRunRuleNone").replace("%d", dryReport.defaultAction ?? "ask") : `#${dryReport.ruleLayer.ruleIndex} (${dryReport.ruleLayer.action ?? "?"})`
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "8px",
																	overflowWrap: "anywhere"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.dryRunDimensions")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
																	style: {
																		font: "500 12px/18px var(--ds-font-family-code, monospace)",
																		color: "var(--dsw-alias-label-primary)"
																	},
																	children: (dryReport.ruleLayer?.matchedDimensions ?? []).length === 0 ? "—" : (dryReport.ruleLayer?.matchedDimensions ?? []).join(", ")
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																style: {
																	display: "flex",
																	gap: "8px",
																	overflowWrap: "anywhere"
																},
																children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.dryRunReason")
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: { color: "var(--dsw-alias-label-secondary, inherit)" },
																	children: dryReport.reason ?? ""
																})]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
																style: {
																	...hintStyle,
																	margin: 0
																},
																children: t("card.dryRunNote")
															})
														]
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															alignItems: "center",
															justifyContent: "space-between",
															gap: "8px"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: labelStyle,
															children: t("card.rules")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															disabled: rulesBusy,
															onClick: loadRules,
															style: {
																...controlStyle,
																flex: "0 0 auto",
																cursor: rulesBusy ? "default" : "pointer"
															},
															children: rulesBusy ? t("card.rulesLoading") : t("card.rulesRefresh")
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.rulesHint")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															gap: "8px",
															overflowWrap: "anywhere",
															marginTop: "6px"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: fieldLabelStyle,
															children: t("card.rulesPath")
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
															style: {
																font: "500 12px/18px var(--ds-font-family-code, monospace)",
																color: "var(--dsw-alias-label-primary)"
															},
															children: rulesBody?.path !== void 0 && rulesBody.path !== "" ? rulesBody.path : t("card.rulesNone")
														})]
													}),
													rulesError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
														style: {
															...hintStyle,
															color: "var(--dsw-alias-label-error, #c0392b)"
														},
														children: [t("card.rulesError"), rulesError]
													}),
													rulesBody !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: {
																display: "flex",
																flexWrap: "wrap",
																gap: "12px",
																marginTop: "4px"
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	style: fieldLabelStyle,
																	children: [t("card.rulesCounts"), " "]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
																	style: {
																		font: "500 12px/18px var(--ds-font-family-code, monospace)",
																		color: "var(--dsw-alias-label-primary)"
																	},
																	children: `deny ${rulesBody.counts?.deny ?? 0} · allow ${rulesBody.counts?.allow ?? 0} · ask ${rulesBody.counts?.ask ?? 0}`
																})] }),
																rulesBody.defaultAction !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	style: fieldLabelStyle,
																	children: [t("card.rulesDefault"), " "]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
																	style: {
																		font: "500 12px/18px var(--ds-font-family-code, monospace)",
																		color: "var(--dsw-alias-label-primary)"
																	},
																	children: rulesBody.defaultAction
																})] }),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	style: fieldLabelStyle,
																	children: t("card.rulesStats").replace("%b", String(rulesBody.bytes ?? 0)).replace("%l", String(rulesBody.lines ?? 0))
																})
															]
														}),
														rulesBody.error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: {
																...hintStyle,
																color: "var(--dsw-alias-label-error, #c0392b)"
															},
															children: rulesBody.error
														}),
														rulesBody.exists === false && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: hintStyle,
															children: t("card.rulesMissing")
														}),
														rulesBody.truncated === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: hintStyle,
															children: t("card.rulesTruncated")
														}),
														(rulesBody.raw ?? "") !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
															style: {
																margin: "6px 0 0",
																padding: "8px 10px",
																maxHeight: "260px",
																overflow: "auto",
																borderRadius: "6px",
																border: "1px solid var(--dsw-alias-border-l2)",
																background: "var(--dsw-alias-bg-surface, transparent)",
																font: "500 12px/18px var(--ds-font-family-code, monospace)",
																color: "var(--dsw-alias-label-primary)",
																whiteSpace: "pre"
															},
															children: rulesBody.raw
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															style: {
																...hintStyle,
																margin: 0
															},
															children: t("card.rulesNote")
														})
													] })
												]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DrawerGroup, {
										id: "pg-drawer-lists",
										title: t("card.lists"),
										summary: listsSummary,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: labelStyle,
														children: t("card.allowlist")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.allowlistHint")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.allowlistPresetNote")
													}),
													patterns.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															padding: "6px 0",
															fontSize: "12px",
															color: "var(--dsw-alias-label-tertiary)"
														},
														children: t("card.allowlistEmpty")
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															display: "flex",
															flexDirection: "column",
															gap: "4px",
															margin: "6px 0"
														},
														children: patterns.map((pattern, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: {
																display: "flex",
																alignItems: "center",
																gap: "8px",
																padding: "4px 8px",
																borderRadius: "6px",
																border: "1px solid var(--dsw-alias-border-l2)",
																background: "var(--dsw-alias-bg-surface, transparent)"
															},
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
																style: {
																	flex: "1 1 auto",
																	minWidth: 0,
																	overflowWrap: "anywhere",
																	font: "500 12px/18px var(--ds-font-family-code, monospace)",
																	color: "var(--dsw-alias-label-primary)"
																},
																children: pattern
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																type: "button",
																"aria-label": t("card.allowlistRemove"),
																title: t("card.allowlistRemove"),
																disabled: readonly,
																onClick: () => {
																	removePattern(index);
																},
																style: {
																	flex: "0 0 auto",
																	width: "20px",
																	height: "20px",
																	border: "none",
																	borderRadius: "999px",
																	background: "transparent",
																	color: "var(--dsw-alias-label-tertiary)",
																	cursor: readonly ? "default" : "pointer"
																},
																children: "✕"
															})]
														}, `${index}:${pattern}`))
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															gap: "6px",
															marginTop: "6px"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "text",
															value: addDraft,
															disabled: readonly,
															placeholder: t("card.allowlistPlaceholder"),
															spellCheck: false,
															style: {
																...controlStyle,
																flex: "1 1 auto",
																minWidth: 0
															},
															onChange: (event) => {
																setAddDraft(event.currentTarget.value);
															},
															onKeyDown: (event) => {
																if (event.key === "Enter") addPattern();
															}
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															disabled: readonly || addDraft.trim() === "",
															onClick: addPattern,
															style: {
																...controlStyle,
																flex: "0 0 auto",
																cursor: readonly || addDraft.trim() === "" ? "default" : "pointer",
																opacity: readonly || addDraft.trim() === "" ? .5 : 1
															},
															children: t("card.allowlistAdd")
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															display: "flex",
															justifyContent: "flex-end",
															marginTop: "6px"
														},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															onClick: () => {
																setBulkOpen((current) => !current);
															},
															style: {
																...controlStyle,
																cursor: "pointer",
																border: "none",
																background: "transparent",
																color: "var(--dsw-alias-label-tertiary)"
															},
															children: bulkOpen ? t("card.allowlistBulkHide") : t("card.allowlistBulk")
														})
													}),
													bulkOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
														id: "plugin-config-perm-gate-allowlist",
														value: allowlistShown,
														disabled: readonly,
														rows: 6,
														spellCheck: false,
														style: {
															...controlStyle,
															width: "100%",
															boxSizing: "border-box",
															resize: "vertical",
															fontFamily: "var(--ds-font-family-code, monospace)",
															whiteSpace: "pre"
														},
														onChange: (event) => {
															setAllowDirty(true);
															setAllowText(event.currentTarget.value);
														},
														onKeyDown: (event) => {
															if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commitAllowlist();
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															display: "flex",
															justifyContent: "flex-end",
															marginTop: "6px"
														},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															disabled: readonly || !allowDirty,
															onClick: commitAllowlist,
															style: {
																...controlStyle,
																cursor: readonly || !allowDirty ? "default" : "pointer",
																opacity: readonly || !allowDirty ? .5 : 1
															},
															children: t("card.allowlistSave")
														})
													})] }) : null
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
												style: sectionStyle,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StringListField, {
													label: t("card.autoAllowTools"),
													hint: t("card.autoAllowToolsHint"),
													placeholder: t("card.autoAllowToolsPlaceholder"),
													addLabel: t("card.denylistAdd"),
													removeLabel: t("card.listRemove"),
													items: value.autoAllowTools ?? [],
													locked: readonly,
													onAdd: (entry) => {
														scope.set("autoAllowTools", [...value.autoAllowTools ?? [], entry]);
													},
													onRemove: (index) => {
														scope.set("autoAllowTools", (value.autoAllowTools ?? []).filter((_, i) => i !== index));
													}
												})
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StringListField, {
														label: t("card.denyKeywordsExtra"),
														hint: t("card.denyKeywordsExtraHint"),
														placeholder: t("card.denylistPlaceholder"),
														addLabel: t("card.denylistAdd"),
														removeLabel: t("card.listRemove"),
														items: value.denyKeywordsExtra ?? [],
														locked: readonly,
														onAdd: (entry) => {
															scope.set("denyKeywordsExtra", [...value.denyKeywordsExtra ?? [], entry]);
														},
														onRemove: (index) => {
															scope.set("denyKeywordsExtra", (value.denyKeywordsExtra ?? []).filter((_, i) => i !== index));
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: { height: "10px" } }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StringListField, {
														label: t("card.extraContentArgKeys"),
														hint: t("card.extraContentArgKeysHint"),
														placeholder: t("card.extraContentArgKeysPlaceholder"),
														addLabel: t("card.denylistAdd"),
														removeLabel: t("card.listRemove"),
														items: value.extraContentArgKeys ?? [],
														locked: readonly,
														onAdd: (entry) => {
															scope.set("extraContentArgKeys", [...value.extraContentArgKeys ?? [], entry]);
														},
														onRemove: (index) => {
															scope.set("extraContentArgKeys", (value.extraContentArgKeys ?? []).filter((_, i) => i !== index));
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: { height: "10px" } }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StringListField, {
														label: t("card.extraOperationArgKeys"),
														hint: t("card.extraOperationArgKeysHint"),
														placeholder: t("card.extraContentArgKeysPlaceholder"),
														addLabel: t("card.denylistAdd"),
														removeLabel: t("card.listRemove"),
														items: value.extraOperationArgKeys ?? [],
														locked: readonly,
														onAdd: (entry) => {
															scope.set("extraOperationArgKeys", [...value.extraOperationArgKeys ?? [], entry]);
														},
														onRemove: (index) => {
															scope.set("extraOperationArgKeys", (value.extraOperationArgKeys ?? []).filter((_, i) => i !== index));
														}
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
												style: sectionStyle,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: labelStyle,
														children: t("card.denylist")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: hintStyle,
														children: t("card.denylistHint")
													}),
													customDeny.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
														style: {
															...labelStyle,
															fontSize: "12px"
														},
														children: t("card.denylistCustom")
													}),
													customDeny.map((pair) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: { margin: "6px 0" },
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DenyRow, {
															keyword: pair.keyword,
															index: pair.index,
															muted: false,
															locked: readonly,
															removeLabel: t("card.denylistRemove"),
															onRemove: removeDeny
														})
													}, `${pair.index}:${pair.keyword}`)),
													presetDeny.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														"aria-expanded": presetDenyOpen,
														onClick: () => {
															setPresetDenyOpen((current) => !current);
														},
														style: {
															...drawerHeaderStyle,
															width: "auto",
															alignSelf: "flex-start",
															padding: "6px 4px"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
															width: "12",
															height: "12",
															viewBox: "0 0 16 16",
															"aria-hidden": true,
															style: {
																color: "var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))",
																flex: "0 0 auto",
																transition: "transform 0.16s",
																transform: presetDenyOpen ? "rotate(180deg)" : "none"
															},
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
																d: "M4 6l4 4 4-4",
																fill: "none",
																stroke: "currentColor",
																strokeWidth: "1.5",
																strokeLinecap: "round",
																strokeLinejoin: "round"
															})
														}), t("card.denylistPresetCollapse").replace("%n", String(presetDeny.length))]
													}), presetDenyOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															display: "flex",
															flexDirection: "column",
															gap: "4px",
															margin: "6px 0"
														},
														children: presetDeny.map((pair) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DenyRow, {
															keyword: pair.keyword,
															index: pair.index,
															muted: true,
															locked: readonly,
															removeLabel: t("card.denylistRemove"),
															onRemove: removeDeny
														}, `${pair.index}:${pair.keyword}`))
													}) : null] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															gap: "6px",
															marginTop: "6px"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "text",
															value: denyDraft,
															disabled: readonly,
															placeholder: t("card.denylistPlaceholder"),
															spellCheck: false,
															style: {
																...controlStyle,
																flex: "1 1 auto",
																minWidth: 0
															},
															onChange: (event) => {
																setDenyDraft(event.currentTarget.value);
															},
															onKeyDown: (event) => {
																if (event.key === "Enter") addDeny();
															}
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															disabled: readonly || denyDraft.trim() === "",
															onClick: addDeny,
															style: {
																...controlStyle,
																flex: "0 0 auto",
																cursor: readonly || denyDraft.trim() === "" ? "default" : "pointer",
																opacity: readonly || denyDraft.trim() === "" ? .5 : 1
															},
															children: t("card.denylistAdd")
														})]
													}),
													denyActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															display: "flex",
															justifyContent: "flex-end",
															marginTop: "6px"
														},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															disabled: readonly,
															onClick: restoreDeny,
															style: {
																...controlStyle,
																cursor: readonly ? "default" : "pointer",
																border: "none",
																background: "transparent",
																color: "var(--dsw-alias-label-tertiary)"
															},
															children: t("card.denylistRestore")
														})
													}) : null
												]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DrawerGroup, {
										id: "pg-drawer-credentials",
										title: t("card.credentials"),
										summary: credSummary,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
											style: sectionStyle,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StringListField, {
												label: t("card.credentialPaths"),
												hint: t("card.credentialPathsHint"),
												placeholder: t("card.credentialPathsPlaceholder"),
												addLabel: t("card.denylistAdd"),
												removeLabel: t("card.listRemove"),
												items: value.credentialPaths ?? [],
												locked: readonly,
												onAdd: (entry) => {
													scope.set("credentialPaths", [...value.credentialPaths ?? [], entry]);
												},
												onRemove: (index) => {
													scope.set("credentialPaths", (value.credentialPaths ?? []).filter((_, i) => i !== index));
												}
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CredLadderSection, {
											t,
											readonly,
											onRungs: handleCredRungs
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(DrawerGroup, {
										id: "pg-drawer-network",
										title: t("card.networkOps"),
										summary: networkSummary,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-network-enabled",
													style: { fontSize: "12px" },
													children: t("card.networkEnabled")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-network-enabled",
													label: t("card.networkEnabled"),
													checked: value.networkEnabled === true,
													disabled: readonly,
													onCommit: (next) => scope.set("networkEnabled", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.networkEnabledHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.networkRebindNote")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: { height: "8px" } }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-network-inject-env",
													style: { fontSize: "12px" },
													children: t("card.networkInjectEnv")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-network-inject-env",
													label: t("card.networkInjectEnv"),
													checked: value.networkInjectEnv !== false,
													disabled: readonly,
													onCommit: (next) => scope.set("networkInjectEnv", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.networkInjectEnvHint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: { height: "8px" } }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: rowStyle,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
													htmlFor: "plugin-config-perm-gate-watch",
													style: { fontSize: "12px" },
													children: t("card.watch")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PillSwitch, {
													id: "plugin-config-perm-gate-watch",
													label: t("card.watch"),
													checked: value.watch !== false,
													disabled: readonly,
													onCommit: (next) => scope.set("watch", next)
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.watchHint")
											})
										]
									})
								]
							}),
							!snapshot.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: {
									margin: "8px 0 0",
									fontSize: "12px",
									color: "var(--dsw-alias-label-tertiary)"
								},
								children: t("card.readonly")
							})
						] })
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { ref: (node) => {
						if (node && !node.firstChild) node.appendChild(mountStarRow());
					} })
				]
			});
		}
		// src/client/feed.ts
		/** Fetch decision events for one session; `since > 0` returns only newer ones. */
		async function fetchEvents(sessionId, since) {
			const query = `/api/dsh-perm-gate/events?sessionId=${encodeURIComponent(sessionId)}${since > 0 ? `&since=${since}` : ""}`;
			const res = await fetch(query, { headers: { "cache-control": "no-cache" } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = await res.json();
			return Array.isArray(body.events) ? body.events : [];
		}
		/** The host's push route (see src/events.ts); the browser half prefers it to polling. */
		const STREAM_ROUTE = "/api/dsh-perm-gate/stream";
		/** Stream attempts before the route is written off as unsupported and polling takes over. */
		const STREAM_RETRIES = 3;
		const STREAM_RETRY_MS = 3e3;
		/**
		* Degraded path only: a host predating the stream route still gets a servable
		* strip. Deliberately slower than the old 2 s tick — it now also pauses while
		* the tab is hidden, so a backgrounded page costs nothing.
		*/
		const FALLBACK_POLL_MS = 5e3;
		/**
		* Follow one session's decision feed until the returned close is called.
		*
		* Prefers the host's `text/event-stream` route, which pushes each decision as
		* the gate appends it — no timer, no repeated re-read of the event log. When
		* the stream is unavailable (an older host, a proxy that buffers it) this
		* degrades to polling the JSON route, gated on page visibility.
		*
		* @param sessionId - the session whose decisions to follow.
		* @param getSince - cursor supplier, read at connect and on every fallback poll.
		* @param onBatch - receives the backlog, then live batches.
		* @returns the close: ends the stream and any fallback timer.
		*/
		function followEvents(sessionId, getSince, onBatch) {
			let closed = false;
			let source = null;
			let pollTimer = null;
			let retries = 0;
			let polls = 0;
			const stopPolling = () => {
				if (pollTimer === null) return;
				clearInterval(pollTimer);
				pollTimer = null;
			};
			const poll = () => {
				if (closed) return;
				if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
				const backlog = polls === 0;
				polls += 1;
				fetchEvents(sessionId, getSince()).then((events) => {
					if (!closed) onBatch({
						events,
						backlog
					});
				}).catch(() => {});
			};
			const startPolling = () => {
				if (closed || pollTimer !== null) return;
				polls = 0;
				poll();
				pollTimer = setInterval(poll, FALLBACK_POLL_MS);
			};
			const connect = () => {
				if (closed) return;
				const query = `?sessionId=${encodeURIComponent(sessionId)}&since=${getSince()}`;
				const next = new EventSource(`${STREAM_ROUTE}${query}`);
				source = next;
				next.onopen = () => {
					retries = 0;
					stopPolling();
				};
				next.onmessage = (message) => {
					try {
						const body = JSON.parse(message.data);
						if (Array.isArray(body.events)) onBatch({
							events: body.events,
							backlog: body.backlog === true
						});
					} catch {}
				};
				next.onerror = () => {
					if (source === next) source = null;
					next.close();
					if (closed) return;
					retries += 1;
					startPolling();
					if (retries <= STREAM_RETRIES) setTimeout(connect, STREAM_RETRY_MS);
				};
			};
			if (typeof EventSource === "undefined") startPolling();
			else connect();
			return () => {
				closed = true;
				source?.close();
				source = null;
				stopPolling();
			};
		}
		/** Resolve the current session id from slot props (top level, nested, or hook). */
		function resolveSessionId(props) {
			const direct = props?.sessionId;
			if (typeof direct === "string" && direct !== "") return direct;
			const nested = props?.slotsProps;
			if (typeof nested?.sessionId === "string" && nested.sessionId !== "") return nested.sessionId;
			for (const hook of [props?.useSessions, nested?.useSessions]) {
				if (typeof hook !== "function") continue;
				try {
					const state = hook((s) => s);
					if (typeof state?.current === "string" && state.current !== "") return state.current;
				} catch {}
			}
			return null;
		}
		/** Presentation per event kind: accent color, background wash, and tag. */
		function presentation(kind) {
			switch (kind) {
				case "deny": return {
					color: "var(--dsw-alias-state-error-primary, #c0392b)",
					bg: "var(--dsw-alias-interactive-bg-hover-danger, rgba(192,57,43,0.08))",
					tag: "DENY",
					sticky: false
				};
				case "ask": return {
					color: "var(--dsw-alias-state-warn-label, #b9770e)",
					bg: "var(--dsw-alias-state-warn-tertiary, rgba(185,119,14,0.08))",
					tag: "ASK",
					sticky: true
				};
				case "learned": return {
					color: "var(--dsw-alias-state-success-primary, #1e8449)",
					bg: "var(--dsw-alias-state-success-tertiary, rgba(30,132,73,0.08))",
					tag: "LEARNED",
					sticky: false
				};
				case "manual-approved": return {
					color: "var(--dsw-alias-state-warn-label, #b9770e)",
					bg: "var(--dsw-alias-state-warn-tertiary, rgba(185,119,14,0.08))",
					tag: "APPROVED",
					sticky: false
				};
				case "manual-rejected": return {
					color: "var(--dsw-alias-state-error-primary, #c0392b)",
					bg: "var(--dsw-alias-interactive-bg-hover-danger, rgba(192,57,43,0.08))",
					tag: "REJECTED",
					sticky: false
				};
				case "manual-cancelled": return {
					color: "var(--dsw-alias-label-secondary, #666)",
					bg: "var(--dsw-alias-bg-module-platform, rgba(127,127,127,0.08))",
					tag: "CANCELLED",
					sticky: false
				};
				case "stand-down": return {
					color: "var(--dsw-alias-state-warn-label, #b9770e)",
					bg: "var(--dsw-alias-state-warn-tertiary, rgba(185,119,14,0.14))",
					tag: "GATE OFF",
					sticky: true
				};
				default: return {
					color: "var(--dsw-alias-state-success-primary, #1e8449)",
					bg: "var(--dsw-alias-state-success-tertiary, rgba(30,132,73,0.08))",
					tag: "ALLOW",
					sticky: false
				};
			}
		}
		/**
		* Decision-path labels shown beside an event's tool name. The values are
		* `verdict.*` dictionary keys (not copy): the history view renders them
		* through `tr()`, so ru/es read their own language instead of the Chinese
		* source. An unknown verdict falls through to its raw string.
		*/
		const VERDICT_LABELS = {
			rule: "verdict.rule",
			grant: "verdict.grant",
			"hard-deny": "verdict.hard-deny",
			"deny-keyword": "verdict.deny-keyword",
			default: "verdict.default",
			ask: "verdict.ask",
			permissive: "verdict.permissive",
			classifier: "verdict.classifier",
			"llm-safe": "verdict.llm-safe",
			"llm-learned": "verdict.llm-learned",
			"learned-sediment": "verdict.learned-sediment",
			"learned-confirm": "verdict.learned-confirm",
			"human-approved": "verdict.human-approved",
			"human-rejected": "verdict.human-rejected",
			"human-cancelled": "verdict.human-cancelled",
			"no-approval-channel": "verdict.no-approval-channel",
			"preset-passthrough": "verdict.preset-passthrough",
			"stand-down": "verdict.stand-down",
			"yolo-allow": "verdict.yolo-allow",
			"yolo-allow-no-reviewer": "verdict.yolo-allow-no-reviewer",
			"yolo-block": "verdict.yolo-block",
			"rules-fallback-allow": "verdict.rules-fallback-allow",
			"rules-fallback-block": "verdict.rules-fallback-block",
			"safety-net-passthrough-allow": "verdict.safety-net-passthrough-allow",
			"safety-net-passthrough-block": "verdict.safety-net-passthrough-block",
			"cleanup-safe": "verdict.cleanup-safe",
			"escalation-auto": "verdict.escalation-auto",
			"learned-granted": "verdict.learned-granted",
			"network-ask": "verdict.network-ask"
		};
		/** Compact wall-clock rendering of an ISO timestamp. */
		function clockTime(iso) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			return date.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit"
			});
		}
		/** Human-readable byte size for the snapshot bar. */
		function fmtBytes(n) {
			if (!Number.isFinite(n) || n <= 0) return "0 B";
			if (n < 1024) return `${n} B`;
			if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
			return `${(n / 1048576).toFixed(2)} MB`;
		}
		/** Load the snapshot inventory (optionally session-scoped); null on failure. */
		async function fetchSnapshotStats(sessionId) {
			const query = sessionId === null ? "" : `?sessionId=${encodeURIComponent(sessionId)}`;
			const res = await fetch(`/api/dsh-perm-gate/snapshots-stats${query}`, { headers: { "cache-control": "no-cache" } });
			if (!res.ok) return null;
			const body = await res.json();
			if (body.ok !== true) return null;
			const files = {};
			if (typeof body.files === "object" && body.files !== null) {
				for (const [key, value] of Object.entries(body.files)) if (Array.isArray(value)) files[key] = value.map(String);
			}
			return {
				count: typeof body.count === "number" ? body.count : 0,
				bytes: typeof body.bytes === "number" ? body.bytes : 0,
				ids: Array.isArray(body.ids) ? body.ids.map(String) : [],
				files
			};
		}
		/** Drop snapshots: pass a session id for a session-scoped clear, null for all. */
		async function clearSnapshots(sessionId) {
			try {
				return (await fetch("/api/dsh-perm-gate/snapshots-clear", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(sessionId === null ? {} : { sessionId })
				})).ok;
			} catch {
				return false;
			}
		}
		/** Load the before/after diff for one event's file; throws on failure. */
		async function fetchDiff(eventId, path) {
			const res = await fetch(`/api/dsh-perm-gate/diff?eventId=${eventId}&path=${encodeURIComponent(path)}`, { headers: { "cache-control": "no-cache" } });
			const body = await res.json().catch(() => null);
			if (body === null || body.ok !== true) throw new Error(typeof body?.error === "string" ? body.error : `HTTP ${res.status}`);
			return {
				hunks: Array.isArray(body.hunks) ? body.hunks : [],
				stats: typeof body.stats === "object" && body.stats !== null ? body.stats : {
					added: 0,
					removed: 0,
					contextLines: 0
				},
				afterExists: body.afterExists !== false
			};
		}
		/** Deliver a revert instruction for one event into its conversation. */
		async function sendRevert(sessionId, eventId) {
			try {
				const res = await fetch("/api/dsh-perm-gate/revert", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						sessionId,
						eventId
					})
				});
				const body = await res.json().catch(() => null);
				if (body !== null && body.ok === true) return { ok: true };
				return {
					ok: false,
					error: typeof body?.error === "string" ? body.error : `HTTP ${res.status}`
				};
			} catch (e) {
				return {
					ok: false,
					error: String(e?.message ?? e)
				};
			}
		}
		// src/client/notice.tsx
		/**
		* Gate decision notice strip — the `conversation.input.dock` face of
		* dsh-perm-gate (a simplified version of the review-feed pattern demonstrated
		* by dsh-approval-gate).
		*
		* Follows the host's decision feed (`GET /api/dsh-perm-gate/stream`, an SSE
		* push; see `followEvents` for the older-host polling fallback) and shows the
		* latest decision above the conversation input: auto-allows (green) and denies
		* (red) auto-dismiss after a few seconds; an ask (amber) stays until the next
		* event because it needs the human's attention.
		*
		* Everything is best-effort: no session id, a missing route, or any fetch
		* failure simply means "render nothing". No @deepseek-ai value imports.
		*/
		const AUTO_HIDE_MS = 4e3;
		/** Localized tag for a manual terminal state; other kinds keep their short tag. */
		function manualTagKey(kind) {
			if (kind === "manual-approved") return "history.tag.manualApproved";
			if (kind === "manual-rejected") return "history.tag.manualRejected";
			if (kind === "manual-cancelled") return "history.tag.manualCancelled";
			return null;
		}
		function NoticeStrip({ t, ...props }) {
			const sessionId = resolveSessionId(props);
			const raw = props.settings;
			const attention = {
				toast: raw?.attentionToast ?? ATTENTION_DEFAULTS.toast,
				sound: raw?.attentionSound ?? ATTENTION_DEFAULTS.sound,
				gapMs: raw?.attentionMinGapMs ?? ATTENTION_DEFAULTS.gapMs
			};
			const [notice, setNotice] = (0, react.useState)(null);
			const sinceRef = (0, react.useRef)(0);
			const shownIdRef = (0, react.useRef)(0);
			const hideTimerRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				sinceRef.current = 0;
				shownIdRef.current = 0;
				setNotice(null);
				if (sessionId === null) return;
				let alive = true;
				const onBatch = (batch) => {
					if (!alive || batch.events.length === 0) return;
					const last = batch.events[batch.events.length - 1];
					if (last === void 0) return;
					if (last.id > sinceRef.current) sinceRef.current = last.id;
					if (batch.backlog) {
						shownIdRef.current = sinceRef.current;
						return;
					}
					if (last.id <= shownIdRef.current) return;
					shownIdRef.current = last.id;
					if (last.kind === "ask") escalateAsk({
						config: attention,
						sessionId: sessionId ?? void 0
					});
					if (last.kind === "ask" && !attention.toast) {
						setNotice(null);
						return;
					}
					setNotice(last);
					if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
					if (!presentation(last.kind).sticky) hideTimerRef.current = setTimeout(() => {
						setNotice(null);
					}, AUTO_HIDE_MS);
				};
				const close = followEvents(sessionId, () => sinceRef.current, onBatch);
				return () => {
					alive = false;
					close();
					if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
				};
			}, [sessionId]);
			(0, react.useEffect)(() => {
				const onVisible = () => {
					if (typeof document === "undefined" || document.visibilityState === "visible") acknowledge({ sessionId: sessionId ?? void 0 });
				};
				if (typeof document === "undefined") return;
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, [sessionId]);
			if (notice === null) return null;
			const style = presentation(notice.kind);
			const manualKey = manualTagKey(notice.kind);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "status",
				style: {
					boxSizing: "border-box",
					display: "flex",
					alignItems: "center",
					gap: "8px",
					margin: "0 auto 6px",
					maxWidth: "720px",
					border: `1px solid ${style.color}`,
					background: style.bg,
					borderRadius: "10px",
					padding: "5px 10px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							flex: "0 0 auto",
							fontSize: "11px",
							lineHeight: "18px",
							padding: "0 8px",
							borderRadius: "9px",
							color: style.color,
							fontWeight: 600
						},
						children: manualKey === null ? style.tag : t(manualKey)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							flex: "1 1 auto",
							minWidth: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							fontSize: "12px",
							color: "var(--dsw-alias-label-secondary, inherit)"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								style: {
									font: "500 12px/18px var(--ds-font-family-code, monospace)",
									color: "var(--dsw-alias-label-primary, inherit)"
								},
								children: notice.tool
							}),
							" — ",
							notice.doubtKinds !== void 0 && notice.doubtKinds.length > 0 ? notice.doubtKinds.map((k) => t(`doubt.${k}`)).join(" · ") : notice.reason
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "dismiss",
						onClick: () => {
							setNotice(null);
						},
						style: {
							flex: "0 0 auto",
							width: "22px",
							height: "22px",
							border: "none",
							borderRadius: "999px",
							background: "transparent",
							color: "var(--dsw-alias-label-tertiary, inherit)",
							cursor: "pointer"
						},
						children: "×"
					})
				]
			});
		}
		// src/client/history.tsx
		/**
		* Approval-history view — the `conversation.view` face of dsh-perm-gate,
		* following the session-scoped review-page pattern demonstrated by
		* dsh-approval-gate: a timeline of every gate decision in the current
		* conversation, newest first, loaded once and then extended by the host's push
		* feed (see `followEvents`).
		*
		* Beyond the decision timeline this view owns the review data plane: a snapshot
		* inventory bar (with session/all clearing), per-event file chips, and a diff
		* overlay that shows the pre-change vs current content of one file and can send
		* a revert instruction back into the conversation.
		*
		* Data source: the host's `GET /api/dsh-perm-gate/events?sessionId=` feed (the
		* same JSONL the notice strip consumes) plus the diff / revert / snapshot
		* routes. Everything is best-effort: no session id or any fetch failure renders
		* the empty / error state. No @deepseek-ai value imports.
		*/
		/** Tag text per event kind, keyed into the plugin dictionary. */
		const TAG_KEYS = {
			auto: "history.tag.auto",
			ask: "history.tag.ask",
			deny: "history.tag.deny",
			learned: "history.tag.learned",
			"manual-approved": "history.tag.manualApproved",
			"manual-rejected": "history.tag.manualRejected",
			"manual-cancelled": "history.tag.manualCancelled",
			"stand-down": "history.tag.standDown"
		};
		/** The file name alone (chips show the basename, like the reference page). */
		function basename(p) {
			const seg = p.split(/[\\/]/);
			return seg[seg.length - 1] ?? p;
		}
		function glyphOf(kind) {
			const style = presentation(kind);
			switch (kind) {
				case "deny":
				case "manual-rejected": return {
					char: "✕",
					color: style.color
				};
				case "ask": return {
					char: "◔",
					color: style.color
				};
				case "manual-cancelled": return {
					char: "—",
					color: style.color
				};
				default: return {
					char: "✓",
					color: style.color
				};
			}
		}
		const barStyle = {
			display: "flex",
			alignItems: "center",
			gap: "8px",
			flexWrap: "wrap",
			padding: "6px 10px",
			borderRadius: "8px",
			background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))",
			fontSize: "12px",
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const barButtonStyle = {
			boxSizing: "border-box",
			height: "26px",
			color: "var(--dsw-alias-label-primary)",
			cursor: "pointer",
			font: "inherit",
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "transparent",
			borderRadius: "13px",
			padding: "0 12px",
			fontSize: "12px",
			lineHeight: "24px"
		};
		/** The snapshot inventory bar: usage plus session/all clearing. */
		function SnapshotBar(props) {
			const { t, stats, sessionId, onCleared } = props;
			const busy = stats === null || stats.count === 0;
			const clear = (mode) => {
				if (!window.confirm(mode === "all" ? t("history.clearAllConfirm") : t("history.clearSessionConfirm"))) return;
				clearSnapshots(mode === "session" ? sessionId : null).then(() => {
					onCleared();
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: barStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [`${t("history.snapshots")} `, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
						style: {
							color: "var(--dsw-alias-label-secondary)",
							fontWeight: 500
						},
						children: stats === null ? "…" : `${fmtBytes(stats.bytes)} · ${stats.count}`
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: "1 1 auto" } }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						title: t("history.clearSessionTitle"),
						disabled: busy,
						onClick: () => {
							clear("session");
						},
						style: {
							...barButtonStyle,
							opacity: busy ? .4 : 1
						},
						children: t("history.clearSession")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						title: t("history.clearAllTitle"),
						disabled: busy,
						onClick: () => {
							clear("all");
						},
						style: {
							...barButtonStyle,
							opacity: busy ? .4 : 1,
							color: "var(--dsw-alias-state-error-primary)"
						},
						children: t("history.clearAll")
					})
				]
			});
		}
		/** One diff line row (marker + line numbers + text). */
		function DiffRow({ line }) {
			const isAdd = line.type === "add";
			const isDel = line.type === "del";
			const background = isAdd ? "var(--dsw-alias-state-success-tertiary)" : isDel ? "var(--dsw-alias-interactive-bg-hover-danger)" : "transparent";
			const color = isDel ? "var(--dsw-alias-state-error-primary)" : isAdd ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)";
			const aNo = line.aNo === void 0 ? "" : String(line.aNo);
			const bNo = line.bNo === void 0 ? "" : String(line.bNo);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					boxSizing: "border-box",
					display: "flex",
					gap: "8px",
					padding: "1px 8px",
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
					minWidth: 0,
					background,
					color
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"aria-hidden": true,
						style: {
							flex: "0 0 auto",
							width: "16px",
							userSelect: "none"
						},
						children: isAdd ? "+" : isDel ? "-" : " "
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: {
							flex: "0 0 auto",
							width: "60px",
							color: "var(--dsw-alias-label-caption)",
							textAlign: "right",
							userSelect: "none",
							fontVariantNumeric: "tabular-nums"
						},
						children: [
							aNo,
							aNo !== "" && bNo !== "" ? " " : "",
							bNo
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							flex: "1 1 auto",
							minWidth: 0
						},
						children: line.text
					})
				]
			});
		}
		/** The file-change overlay: before/after diff plus the revert action. */
		function DiffPanel(props) {
			const { t, sessionId, eventId, path, onClose } = props;
			const [data, setData] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [revertMsg, setRevertMsg] = (0, react.useState)(null);
			const [revertOk, setRevertOk] = (0, react.useState)(false);
			const [reverting, setReverting] = (0, react.useState)(false);
			const [revertDone, setRevertDone] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				let alive = true;
				setData(null);
				setError(null);
				setRevertDone(false);
				setRevertMsg(null);
				fetchDiff(eventId, path).then((res) => {
					if (alive) setData(res);
				}).catch((e) => {
					if (alive) setError(`${t("history.diffLoadFail")}${String(e?.message ?? e)}`);
				});
				return () => {
					alive = false;
				};
			}, [
				eventId,
				path,
				t
			]);
			const doRevert = () => {
				if (reverting || revertDone || sessionId === null) return;
				setReverting(true);
				setRevertMsg(null);
				sendRevert(sessionId, eventId).then((res) => {
					if (res.ok) {
						setRevertMsg(t("history.diffRevertSent"));
						setRevertOk(true);
						setRevertDone(true);
					} else {
						setRevertMsg(`${t("history.diffRevertFail")}${res.error ?? ""}`);
						setRevertOk(false);
					}
					setReverting(false);
				});
			};
			const stats = data?.stats;
			const body = error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: diffEmptyStyle,
				children: error
			}) : data === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: diffEmptyStyle,
				children: t("history.diffLoading")
			}) : data.hunks.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: diffEmptyStyle,
				children: t("history.diffEmpty")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: diffBodyStyle,
				children: data.hunks.map((hunk, hi) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [hunk.hiddenBefore > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: hunkSepStyle,
					children: t("history.diffHidden").replace("%n", String(hunk.hiddenBefore))
				}) : null, hunk.lines.map((line, li) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffRow, { line }, `l-${hi}-${li}`))] }, `hunk-${hi}`))
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: overlayStyle,
				onClick: (e) => {
					if (e.target === e.currentTarget) onClose();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: panelStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: panelHeadStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "8px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											flex: "1 1 auto",
											fontSize: "14px",
											fontWeight: 500,
											color: "var(--dsw-alias-label-primary)"
										},
										children: t("history.diffTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"aria-label": t("history.diffClose"),
										title: t("history.diffClose"),
										onClick: onClose,
										style: closeStyle,
										children: "✕"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: "12px",
										lineHeight: "18px",
										fontFamily: "var(--ds-font-family-code, monospace)",
										color: "var(--dsw-alias-label-tertiary)",
										wordBreak: "break-all"
									},
									children: path
								}),
								stats === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										fontSize: "12px",
										lineHeight: "18px",
										color: "var(--dsw-alias-label-secondary)"
									},
									children: [t("history.diffStats").replace("%a", String(stats.added)).replace("%r", String(stats.removed)).replace("%c", String(stats.contextLines)), data !== null && !data.afterExists ? t("history.diffGone") : ""]
								})
							]
						}),
						body,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: panelFootStyle,
							children: [
								revertMsg === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										marginRight: "auto",
										fontSize: "12px",
										color: revertOk ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-error-primary)"
									},
									children: revertMsg
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: doRevert,
									disabled: reverting || revertDone || sessionId === null,
									style: {
										...barButtonStyle,
										border: "none",
										background: "var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary))",
										color: "var(--dsw-alias-label-primary-foreground, #fff)",
										opacity: reverting || revertDone ? .5 : 1
									},
									children: reverting ? t("history.diffReverting") : revertDone ? t("history.diffRevertDone") : t("history.diffRevert")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: onClose,
									style: barButtonStyle,
									children: t("history.diffClose")
								})
							]
						})
					]
				})
			});
		}
		const overlayStyle = {
			position: "fixed",
			inset: 0,
			zIndex: 900,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			background: "var(--dsw-alias-bg-mask-1, rgba(0,0,0,0.35))"
		};
		const panelStyle = {
			boxSizing: "border-box",
			width: "min(760px, calc(100vw - 48px))",
			maxHeight: "min(720px, calc(100vh - 48px))",
			display: "flex",
			flexDirection: "column",
			background: "var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1))",
			border: "1px solid var(--dsw-alias-border-l1)",
			borderRadius: "16px",
			overflow: "hidden"
		};
		const panelHeadStyle = {
			boxSizing: "border-box",
			flex: "0 0 auto",
			display: "flex",
			flexDirection: "column",
			gap: "4px",
			padding: "12px 14px",
			borderBottom: "1px solid var(--dsw-alias-border-l2)"
		};
		const panelFootStyle = {
			boxSizing: "border-box",
			flex: "0 0 auto",
			display: "flex",
			alignItems: "center",
			gap: "8px",
			justifyContent: "flex-end",
			padding: "10px 14px",
			borderTop: "1px solid var(--dsw-alias-border-l2)"
		};
		const diffBodyStyle = {
			flex: "1 1 auto",
			minHeight: 0,
			overflowY: "auto",
			padding: "8px 10px",
			display: "flex",
			flexDirection: "column",
			fontFamily: "var(--ds-font-family-code, monospace)",
			fontSize: "12px",
			lineHeight: "19px"
		};
		const diffEmptyStyle = {
			flex: "1 1 auto",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: "13px",
			lineHeight: "20px",
			padding: "16px",
			textAlign: "center"
		};
		const hunkSepStyle = {
			boxSizing: "border-box",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: "11px",
			lineHeight: "16px",
			padding: "2px 8px",
			margin: "2px 0",
			borderTop: "1px solid var(--dsw-alias-border-l1)",
			borderBottom: "1px solid var(--dsw-alias-border-l1)",
			userSelect: "none"
		};
		const closeStyle = {
			flex: "0 0 auto",
			width: "24px",
			height: "24px",
			border: "none",
			borderRadius: "999px",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			cursor: "pointer"
		};
		function HistoryView({ t, ...props }) {
			const sessionId = resolveSessionId(props);
			const [events, setEvents] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [stats, setStats] = (0, react.useState)(null);
			const [diffOpen, setDiffOpen] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				setEvents(null);
				setError(null);
				setStats(null);
				if (sessionId === null) {
					setEvents([]);
					return;
				}
				let alive = true;
				let cursor = 0;
				let closeStream = null;
				fetchSnapshotStats(sessionId).then((next) => {
					if (alive) setStats(next);
				});
				/**
				* Decisions landing after the initial load. Both the stream's pushes and the
				* fallback's ticks carry only events past the cursor, so they merge the same
				* way; a batch is also the point where the snapshot inventory can have grown.
				*/
				const onBatch = (batch) => {
					if (!alive || batch.events.length === 0) return;
					for (const ev of batch.events) if (ev.id > cursor) cursor = ev.id;
					setEvents((current) => {
						const known = new Set((current ?? []).map((ev) => ev.id));
						const added = batch.events.filter((ev) => !known.has(ev.id));
						return added.length === 0 ? current : [...added, ...current ?? []].sort((a, b) => b.id - a.id);
					});
					setError(null);
					fetchSnapshotStats(sessionId).then((next) => {
						if (alive) setStats(next);
					});
				};
				fetchEvents(sessionId, 0).then((loaded) => {
					if (!alive) return;
					setEvents([...loaded].sort((a, b) => b.id - a.id));
					setError(null);
					cursor = loaded.reduce((max, ev) => ev.id > max ? ev.id : max, 0);
				}).catch((e) => {
					if (alive) setError(String(e?.message ?? e));
				}).finally(() => {
					if (alive) closeStream = followEvents(sessionId, () => cursor, onBatch);
				});
				return () => {
					alive = false;
					closeStream?.();
				};
			}, [sessionId]);
			/** Whether one event has a snapshot covering this file (chip is clickable). */
			const hasSnapshot = (ev, file) => {
				const paths = stats?.files[String(ev.id)];
				if (paths === void 0 || paths.length === 0) return false;
				const base = basename(file);
				return paths.some((p) => p === file || basename(p) === base);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					boxSizing: "border-box",
					maxWidth: "720px",
					margin: "0 auto",
					padding: "8px 4px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: { marginBottom: "10px" },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: "14px",
								fontWeight: 600,
								color: "var(--dsw-alias-label-primary)"
							},
							children: t("history.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								marginTop: "2px",
								fontSize: "12px",
								lineHeight: "18px",
								color: "var(--dsw-alias-label-primary) !important"
							},
							children: t("history.subtitle")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SnapshotBar, {
						t,
						stats,
						sessionId,
						onCleared: () => {
							fetchSnapshotStats(sessionId).then(setStats);
						}
					}),
					events === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							padding: "16px 0",
							fontSize: "13px",
							color: "var(--dsw-alias-label-tertiary)"
						},
						children: error === null ? t("history.loading") : `${t("history.error")}${error}`
					}) : events.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							padding: "16px 0",
							fontSize: "13px",
							color: "var(--dsw-alias-label-tertiary)"
						},
						children: error === null ? t("history.empty") : `${t("history.error")}${error}`
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: events.map((ev) => {
						const style = presentation(ev.kind);
						const mark = glyphOf(ev.kind);
						const label = ev.verdict === void 0 ? void 0 : VERDICT_LABELS[ev.verdict];
						const verdict = ev.verdict === void 0 ? "" : label === void 0 ? ev.verdict : t(label);
						const files = ev.files ?? [];
						const chips = [];
						const seenBase = /* @__PURE__ */ new Set();
						for (const f of files) {
							const base = basename(f);
							if (base === "" || seenBase.has(base)) continue;
							seenBase.add(base);
							chips.push(f);
						}
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: "10px",
								padding: "6px 10px",
								borderRadius: "8px",
								background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									flex: "0 0 auto",
									width: "20px"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": true,
									style: {
										width: "18px",
										height: "18px",
										marginTop: "3px",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: "11px",
										lineHeight: "18px",
										borderRadius: "999px",
										border: `1px solid ${mark.color}`,
										color: mark.color
									},
									children: mark.char
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": true,
									style: {
										flex: "1 1 auto",
										width: "1px",
										minHeight: "10px",
										background: "var(--dsw-alias-border-l2, rgba(127,127,127,0.3))"
									}
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									flex: "1 1 auto",
									minWidth: 0,
									paddingBottom: "12px"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: "8px",
											flexWrap: "wrap"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												style: {
													font: "600 12px/18px var(--ds-font-family-code, monospace)",
													color: "var(--dsw-alias-label-primary)"
												},
												children: ev.tool
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: "11px",
													lineHeight: "18px",
													padding: "0 8px",
													borderRadius: "9px",
													color: style.color,
													background: style.bg,
													fontWeight: 600
												},
												children: t(TAG_KEYS[ev.kind])
											}),
											verdict === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: "11px",
													lineHeight: "18px",
													padding: "0 6px",
													borderRadius: "9px",
													color: "var(--dsw-alias-label-tertiary)",
													border: "1px solid var(--dsw-alias-border-l2)"
												},
												children: verdict
											}),
											ev.risk === void 0 || ev.risk === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: "11px",
													lineHeight: "18px",
													padding: "0 6px",
													borderRadius: "9px",
													color: "var(--dsw-alias-label-tertiary)",
													border: "1px solid var(--dsw-alias-border-l2)"
												},
												children: ev.risk
											}),
											ev.kind === "manual-approved" && ev.learningCount !== void 0 && ev.threshold !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: "11px",
													lineHeight: "18px",
													padding: "0 6px",
													borderRadius: "9px",
													color: "var(--dsw-alias-state-warn-label)",
													border: "1px solid var(--dsw-alias-border-l2)"
												},
												children: t("history.learnedProgress").replace("%n", String(ev.learningCount)).replace("%t", String(ev.threshold))
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													marginLeft: "auto",
													flex: "0 0 auto",
													fontSize: "11px",
													color: "var(--dsw-alias-label-tertiary)"
												},
												children: clockTime(ev.ts)
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											marginTop: "2px",
											fontSize: "12px",
											lineHeight: "18px",
											color: "var(--dsw-alias-label-secondary, inherit)",
											overflowWrap: "anywhere"
										},
										children: ev.doubtKinds !== void 0 && ev.doubtKinds.length > 0 ? ev.doubtKinds.map((k) => t(`doubt.${k}`)).join(" · ") : ev.humanBrief ?? ev.justification ?? ev.reason
									}),
									ev.humanCommand === void 0 || ev.humanCommand === "" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											marginTop: "4px",
											fontFamily: "var(--ds-font-family-code, monospace)",
											fontSize: "12px",
											lineHeight: "18px",
											whiteSpace: "pre-wrap",
											overflowWrap: "anywhere",
											color: "var(--dsw-alias-label-primary, inherit)"
										},
										children: ev.humanCommand
									}),
									chips.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											display: "flex",
											flexWrap: "wrap",
											gap: "4px",
											marginTop: "4px"
										},
										children: chips.map((file) => {
											const clickable = hasSnapshot(ev, file);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												title: clickable ? t("history.diffChipTitle") : file,
												role: clickable ? "button" : void 0,
												onClick: clickable ? () => {
													setDiffOpen({
														eventId: ev.id,
														path: file
													});
												} : void 0,
												style: {
													boxSizing: "border-box",
													maxWidth: "260px",
													height: "20px",
													display: "inline-flex",
													alignItems: "center",
													padding: "0 7px",
													borderRadius: "5px",
													font: "11px/18px var(--ds-font-family-code, monospace)",
													border: `1px solid ${clickable ? "var(--dsw-alias-state-business-primary)" : "var(--dsw-alias-border-l1)"}`,
													color: clickable ? "var(--dsw-alias-state-business-primary)" : "var(--dsw-alias-label-secondary)",
													background: "var(--dsw-alias-bg-layer-1, transparent)",
													cursor: clickable ? "pointer" : "default",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap"
												},
												children: basename(file)
											}, file);
										})
									})
								]
							})]
						}, ev.id);
					}) }),
					diffOpen === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiffPanel, {
						t,
						sessionId,
						eventId: diffOpen.eventId,
						path: diffOpen.path,
						onClose: () => {
							setDiffOpen(null);
						}
					})
				]
			});
		}
		// src/client/compat.ts
		/**
		* Resolve the plugin's durable settings scope through whichever service this
		* host line carries, then hand it to `onScope` exactly once.
		*
		* Both variants are scoped sub-injects: on a host without the service the fiber
		* waits forever WITHOUT blocking the plugin's other faces (same posture as the
		* notice strip's slot-inject when its slot holder is absent). session-guard
		* 4.1.0 proves the `settingsScope` branch resolves on 0.1.5-rc.3 (its
		* shell.overlay gear registers inside this callback and renders there).
		*/
		function resolveSettingsScope(ctx, namespace, onScope) {
			ctx.inject(["configForms"], (configForms) => {
				onScope(configForms.get(namespace), "configForms");
			});
			ctx.inject(["settingsScope"], (settingsScope) => {
				onScope(settingsScope.bind({ namespace }), "settingsScope");
			});
		}
		// src/client/bridge-scope.ts
		/** 与 server 侧 bridgeRoutesFor（src/bridge.ts）必须逐字符一致。 */
		function bridgeRoutesFor(ns) {
			return {
				describe: `/api/${ns}/settings/describe`,
				mutate: `/api/${ns}/settings/mutate`
			};
		}
		var BridgeDocHandle = class {
			snapshot = {
				status: "pending",
				value: void 0,
				writable: true
			};
			listeners = /* @__PURE__ */ new Set();
			revision;
			inflight;
			routes;
			constructor(ns) {
				this.routes = bridgeRoutesFor(ns);
				this.refresh();
			}
			getSnapshot() {
				return this.snapshot;
			}
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			async set(field, value) {
				await this.mutate([{
					op: "set",
					path: [field],
					value
				}]);
			}
			async unset(field) {
				await this.mutate([{
					op: "unset",
					path: [field]
				}]);
			}
			notify() {
				for (const l of [...this.listeners]) l();
			}
			async request(path, body) {
				const response = await fetch(path, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body ?? {})
				});
				if (!response.ok) throw new Error(`bridge ${path} HTTP ${response.status}`);
				return await response.json();
			}
			async refresh() {
				if (this.inflight !== void 0) return this.inflight;
				this.inflight = (async () => {
					try {
						const body = await this.request(this.routes.describe);
						if (body.ok && body.value?.descriptor !== void 0) {
							const d = body.value.descriptor;
							this.revision = typeof d.revision === "number" ? d.revision : void 0;
							this.snapshot = {
								status: "ready",
								value: d.value,
								writable: body.value.writable !== false
							};
						} else this.snapshot = {
							status: "error",
							value: void 0,
							writable: false
						};
					} catch {
						this.snapshot = {
							status: "error",
							value: void 0,
							writable: false
						};
					} finally {
						this.inflight = void 0;
					}
					this.notify();
				})();
				return this.inflight;
			}
			async mutate(ops) {
				const body = await this.request(this.routes.mutate, {
					ops,
					expectedRevision: this.revision
				});
				if (body.ok && body.value?.descriptor !== void 0) {
					const d = body.value.descriptor;
					this.revision = typeof d.revision === "number" ? d.revision : void 0;
					this.snapshot = {
						status: "ready",
						value: d.value,
						writable: this.snapshot.writable
					};
				} else if (body.code === "settings-conflict") await this.refresh();
				else throw new Error(`bridge mutate failed: ${body.code ?? "unknown"} ${body.message ?? ""}`);
				this.notify();
			}
		};
		// src/client/index.ts
		/** The profile entry id of this plugin — the `configForms` key (kept in lockstep with cordis.patch.yml). */
		const PERMISSIVE_NS = "dsh-perm-gate";
		/** Services required by the browser half — generation-neutral only.
		*
		* `configForms` (0.1.7+) / `settingsScope` (≤0.1.5) are generation-exclusive
		* durable-settings faces: keeping either in the plugin-level inject list would
		* leave the WHOLE browser half fiber PENDING on the other line (strict ctx
		* proxy throws on undeclared service reads; pending fiber = silent death).
		* They resolve through scoped sub-injects in compat.ts instead, and the card
		* registrations below move into the resolution callback. */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: dictionaries plus the settings page registration.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			if (ctx.locale) ctx.effect(() => ctx.locale.register(NS, dictionaries), "dsh-perm-gate: dictionaries");
			ctx.slots.inject("conversation.input.dock", function* () {
				yield ctx.slots.register({
					name: "conversation.input.dock",
					id: "dsh-perm-gate.notice",
					order: 30,
					label: () => t("notice.label"),
					locale: NS
				}, NoticeStrip);
			});
			ctx.slots.inject("conversation.view", function* () {
				yield ctx.slots.register({
					name: "conversation.view",
					id: "dsh-perm-gate.history",
					order: 20,
					label: () => t("history.label"),
					locale: NS,
					inject: (sessionId) => ({ sessionId })
				}, HistoryView);
			});
			const t = ctx.locale.bind(NS);
			const safe = (tag, fn) => {
				try {
					fn();
				} catch (e) {
					(globalThis.__pgSurf ??= []).push(`${tag}: ${e?.message ?? String(e)}`);
					console.warn(`[dsh-perm-gate] client surface '${tag}' failed:`, e);
				}
			};
			const scopeRef = {};
			resolveSettingsScope(ctx, PERMISSIVE_NS, (scope, _generation) => {
				scopeRef.scope = scope;
			});
			const bridgeScope = new BridgeDocHandle(PERMISSIVE_NS);
			const cardInjected = () => ({ scope: scopeRef.scope ?? bridgeScope });
			safe("settings.section", () => {
				ctx.slots.inject("settings.section", function* () {
					yield ctx.slots.register({
						name: "settings.section",
						id: PERMISSIVE_NS,
						order: 30,
						label: () => t("section.title"),
						locale: NS,
						inject: cardInjected
					}, PermissiveCard);
				});
			});
			safe("plugins.bundle.config", () => {
				ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: "dsh-perm-gate",
					locale: NS,
					inject: cardInjected
				}, PermissiveCard));
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map