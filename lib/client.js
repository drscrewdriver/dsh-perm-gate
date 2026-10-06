window.__ModuleLoader__.load({
	id: "dsh-perm-gate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** `dsh-perm-gate` client dictionaries (zh / en / ja / ko / fr / de / it / ru / es). */
		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-perm-gate";
		/**
		* Combined dictionary map for all 9 active languages, registered in ONE
		* `locale.register(NS, dictionaries)` call. The map form is deliberately left
		* with its inferred literal type instead of a loose
		* `Record<string, Record<string, string>>` annotation: `dsh-perm-gate` is a
		* declared namespace in `LocaleNamespaceMap`, so the locale service resolves
		* the TYPED `register(ns, dicts)` overload, which requires the built-in
		* `zh`/`en` keys to be statically present (an index signature would not
		* guarantee them and fails the assignment). The runtime still iterates every
		* entry of the map and accepts any BCP 47-style locale id, so the seven
		* extension languages activate through the very same call.
		*/
		const dictionaries = {
			zh: {
				"card.title": "自动审查",
				"section.title": "自动审查门",
				"card.description": "独立审批档位：与只读 / 完全权限 / 白名单平行，在会话权限下拉中显示为「自动审查」。前端只暴露一个开关；后台四个审批策略可组合、由此处设置决定，仍对 P0 硬拒绝保持 fail-closed。",
				"card.permissive": "启用自动审查档位",
				"card.permissiveHint": "关闭时门禁行为与此前完全一致。",
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
				"card.rulesNote": "此处只读：面板无法修改规则；白名单段与“始终允许”会写回本插件的入口配置。"
			},
			en: {
				"card.title": "自动审查 (Auto review)",
				"section.title": "Auto-Review Gate",
				"card.description": "Independent approval tier, parallel to read-only / full-access / whitelist, shown as 自动审查 in the session permission picker. The front-end exposes a single switch; the four backend approval strategies are combinable via this panel and still fail-closed against P0 hard-deny.",
				"card.permissive": "Enable the 自动审查 tier",
				"card.permissiveHint": "When off, the gate behaves exactly as before.",
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
				"card.rulesNote": "Read-only: this panel cannot modify the rules. The allowlist section and \"allow always\" write back to this plugin's entry config."
			},
			ja: {
				"card.title": "自动审查（自動審査）ティア",
				"section.title": "自動審査ゲート",
				"card.description": "read-only / full-access / whitelist と並ぶ独立の承認モード。セッション権限ピッカーでは「自动审查」と表示されます。フロントは単一スイッチのみ。バックエンドの 4 つの承認戦略はこのパネルで組み合わせ可能で、P0 ハード拒否に対して依然 fail-closed。",
				"card.permissive": "自动审查ティアを有効化",
				"card.permissiveHint": "オフのときは以前と完全に同じ動作です。",
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
				"card.rulesNote": "読み取り専用：このパネルからルールは変更できません。許可リストと「常に許可」は本プラグインのエントリ設定に書き戻されます。"
			},
			ko: {
				"card.title": "自动审查(자동 검토) 티어",
				"section.title": "자동 검토 게이트",
				"card.description": "read-only / full-access / whitelist와 나란한 독립 승인 모드. 세션 권한 선택기에서는 「自动审查」로 표시됩니다. 프론트는 단일 스위치만 노출. 백엔드의 네 가지 승인 전략은 이 패널에서 조합 가능하며 P0 하드 거부에 대해 여전히 fail-closed.",
				"card.permissive": "自动审查 티어 활성화",
				"card.permissiveHint": "꺼져 있으면 이전과 완전히 동일하게 동작합니다.",
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
				"card.rulesNote": "읽기 전용: 이 패널은 규칙을 수정할 수 없습니다. 허용 목록과 \"항상 허용\"은 이 플러그인의 엔트리 설정에 기록됩니다."
			},
			fr: {
				"card.title": "Examen automatique",
				"section.title": "Porte d'examen automatique",
				"card.description": "Niveau d'approbation indépendant : parallèle à lecture seule / accès complet / liste blanche, affiché comme « Examen automatique » dans le sélecteur de permissions de session. Le front-end n'expose qu'un seul interrupteur ; les quatre stratégies d'approbation backend sont combinables via ce panneau et restent fail-closed contre le refus dur P0.",
				"card.permissive": "Activer le niveau d'examen automatique",
				"card.permissiveHint": "Lorsqu'il est désactivé, la porte se comporte exactement comme avant.",
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
				"card.rulesNote": "Lecture seule : ce panneau ne peut pas modifier les règles. La section liste blanche et « toujours autoriser » écrivent dans la configuration d'entrée de ce plugin."
			},
			de: {
				"card.title": "Automatische Überprüfung",
				"section.title": "Automatische Prüfschleuse",
				"card.description": "Unabhängige Genehmigungsstufe: parallel zu Nur-Lesen / Vollzugriff / Whitelist, angezeigt als „Automatische Überprüfung\" im Sitzungs-Berechtigungswähler. Das Frontend bietet einen einzigen Schalter; die vier Backend-Genehmigungsstrategien sind über dieses Panel kombinierbar und bleiben fail-closed gegen P0-Hartablehnung.",
				"card.permissive": "Stufe „Automatische Überprüfung\" aktivieren",
				"card.permissiveHint": "Wenn deaktiviert, verhält sich das Gate genau wie zuvor.",
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
				"card.rulesNote": "Nur-Lesen: Dieses Panel kann die Regeln nicht ändern. Der Whitelist-Abschnitt und „Immer erlauben\" schreiben in die Konfiguration dieses Plugin-Eintrags zurück."
			},
			it: {
				"card.title": "Revisione automatica",
				"section.title": "Portale di revisione automatica",
				"card.description": "Livello di approvazione indipendente: parallelo a sola lettura / accesso completo / whitelist, mostrato come «Revisione automatica» nel selettore delle autorizzazioni della sessione. Il front-end espone un unico interruttore; le quattro strategie di approvazione backend sono combinabili tramite questo pannello e restano fail-closed contro il rifiuto rigido P0.",
				"card.permissive": "Abilita il livello di revisione automatica",
				"card.permissiveHint": "Quando disattivato, il portale si comporta esattamente come prima.",
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
				"card.rulesNote": "Sola lettura: questo pannello non può modificare le regole. La sezione whitelist e «consenti sempre» scrivono nella configurazione di questa voce plugin."
			},
			ru: {
				"card.title": "Автоматическая проверка",
				"section.title": "Шлюз автоматической проверки",
				"card.description": "Независимый уровень одобрения: параллельно с «только чтение» / «полный доступ» / «белый список», отображается как «Автоматическая проверка» в выборе разрешений сессии. Фронтенд предоставляет один переключатель; четыре серверные стратегии одобрения комбинируемы через эту панель и остаются fail-closed против жёсткого отказа P0.",
				"card.permissive": "Включить уровень автоматической проверки",
				"card.permissiveHint": "Когда выключено, шлюз ведёт себя точно так же, как раньше.",
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
				"card.rulesNote": "Только чтение: эта панель не может изменять правила. Секция белого списка и «всегда разрешать» записывают обратно в конфигурацию этой записи плагина."
			},
			es: {
				"card.title": "Revisión automática",
				"section.title": "Compuerta de revisión automática",
				"card.description": "Nivel de aprobación independiente: paralelo a solo lectura / acceso completo / lista blanca, mostrado como «Revisión automática» en el selector de permisos de sesión. El frontend expone un único interruptor; las cuatro estrategias de aprobación del backend son combinables mediante este panel y permanecen fail-closed contra la denegación dura P0.",
				"card.permissive": "Habilitar el nivel de revisión automática",
				"card.permissiveHint": "Cuando está desactivado, la compuerta se comporta exactamente igual que antes.",
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
				"card.rulesNote": "Solo lectura: este panel no puede modificar las reglas. La sección de lista blanca y «permitir siempre» escriben de vuelta en la configuración de esta entrada de plugin."
			}
		};
		//#endregion
		//#region src/deny-defaults.ts
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
		//#endregion
		//#region src/llm-presets.ts
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
		//#endregion
		//#region src/preset.ts
		/**
		* Presets in which the gate is active. It owns both 自动审查 tiers — the plain
		* one (file sandbox kept) and the full-access one (sandbox restriction lifted,
		* same approval behaviour) — so a user can have the gate without inheriting a
		* sandbox that breaks `git` / Cygwin tools. `'*'` makes it global (every
		* preset, including the hard-deny layer).
		*
		* Lives in this dependency-free module (not `config.ts`) so the browser half can
		* render the scope without pulling schemastery into the client bundle.
		*/
		const DEFAULT_GATE_PRESETS = ["permissive", "permissive-full"];
		//#endregion
		//#region src/client/sediment.tsx
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
		//#endregion
		//#region src/client/card.tsx
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
		/**
		* The card body, wrapped in a disclosure shell like every peer settings card:
		* a header (name + description + chevron) toggling the body, expanded by
		* default so the section reads as an open page of drawers.
		*/
		function PermissiveCard({ t, scope }) {
			const [open, setOpen] = (0, react.useState)(true);
			const [apiKeyDraft, setApiKeyDraft] = (0, react.useState)("");
			const [allowText, setAllowText] = (0, react.useState)("");
			const [allowDirty, setAllowDirty] = (0, react.useState)(false);
			const snapshot = (0, react.useSyncExternalStore)((listener) => scope.subscribe(listener), () => scope.getSnapshot());
			const unavailable = snapshot.status === "unavailable";
			const readonly = unavailable || !snapshot.writable;
			const value = snapshot.value ?? {};
			const strategies = value.permissiveStrategies ?? {};
			const hasApiKey = typeof value.classifierApiKey === "string" && value.classifierApiKey !== "";
			const effective = value.permissive === true;
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
			(0, react.useEffect)(() => {
				loadRules();
			}, []);
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))",
					background: "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))",
					borderRadius: "12px",
					transition: "border-color 0.16s, background 0.16s"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
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
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { padding: "12px 16px" },
					children: unavailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: "13px",
							color: "var(--dsw-alias-label-tertiary)"
						},
						children: t("card.unavailable")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								htmlFor: "plugin-config-perm-gate-permissive",
								style: labelStyle,
								children: t("card.permissive")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "plugin-config-perm-gate-permissive",
								type: "checkbox",
								checked: effective,
								disabled: readonly,
								onChange: (event) => {
									scope.set("permissive", event.currentTarget.checked);
								}
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hintStyle,
							children: t("card.permissiveHint")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hintStyle,
							children: t("card.scopeNote").replace("%scope", ((value.gatePresets ?? []).length > 0 ? value.gatePresets : [...DEFAULT_GATE_PRESETS]).join(" / "))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: labelStyle,
									children: t("card.strategies")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										htmlFor: "plugin-config-perm-gate-trust",
										style: { fontSize: "12px" },
										children: t("card.strategy.trustAutoAllow")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "plugin-config-perm-gate-trust",
										type: "checkbox",
										checked: strategies.trustAutoAllow ?? true,
										disabled: readonly || !effective,
										onChange: (event) => {
											scope.set("permissiveStrategies", {
												...strategies,
												trustAutoAllow: event.currentTarget.checked
											});
										}
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										htmlFor: "plugin-config-perm-gate-confirm",
										style: { fontSize: "12px" },
										children: t("card.strategy.alwaysConfirm")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "plugin-config-perm-gate-confirm",
										type: "checkbox",
										checked: strategies.alwaysConfirm ?? false,
										disabled: readonly || !effective,
										onChange: (event) => {
											scope.set("permissiveStrategies", {
												...strategies,
												alwaysConfirm: event.currentTarget.checked
											});
										}
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										htmlFor: "plugin-config-perm-gate-llm",
										style: { fontSize: "12px" },
										children: t("card.strategy.llmAssist")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "plugin-config-perm-gate-llm",
										type: "checkbox",
										checked: strategies.llmAssist ?? false,
										disabled: readonly || !effective,
										onChange: (event) => {
											scope.set("permissiveStrategies", {
												...strategies,
												llmAssist: event.currentTarget.checked
											});
										}
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: rowStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										htmlFor: "plugin-config-perm-gate-escalation",
										style: { fontSize: "12px" },
										children: t("card.strategy.trustEscalation")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: "plugin-config-perm-gate-escalation",
										type: "checkbox",
										checked: strategies.trustEscalation ?? true,
										disabled: readonly || !effective,
										onChange: (event) => {
											scope.set("permissiveStrategies", {
												...strategies,
												trustEscalation: event.currentTarget.checked
											});
										}
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
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												id: "plugin-config-perm-gate-risk-learning",
												type: "checkbox",
												checked: value.riskLearning ?? false,
												disabled: readonly || !effective,
												onChange: (event) => {
													scope.set("riskLearning", event.currentTarget.checked);
												}
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
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													id: "plugin-config-perm-gate-risk-sediment",
													type: "checkbox",
													checked: value.riskSediment ?? true,
													disabled: readonly || !effective,
													onChange: (event) => {
														scope.set("riskSediment", event.currentTarget.checked);
													}
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												style: hintStyle,
												children: t("card.riskSedimentHint")
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
						}),
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
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: "4px",
										margin: "6px 0"
									},
									children: denylist.map((keyword, index) => {
										const preset = DEFAULT_DENY_KEYWORDS.includes(keyword);
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
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
													style: {
														flex: "1 1 auto",
														minWidth: 0,
														overflowWrap: "anywhere",
														font: "500 12px/18px var(--ds-font-family-code, monospace)",
														color: "var(--dsw-alias-label-primary)"
													},
													children: keyword
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														flex: "0 0 auto",
														fontSize: "11px",
														lineHeight: "16px",
														padding: "0 6px",
														borderRadius: "8px",
														color: preset ? "var(--dsw-alias-label-tertiary)" : "var(--dsw-alias-label-secondary, inherit)",
														border: "1px solid var(--dsw-alias-border-l2)"
													},
													children: preset ? t("card.denylistTagPreset") : t("card.denylistTagCustom")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													"aria-label": t("card.denylistRemove"),
													title: t("card.denylistRemove"),
													disabled: readonly,
													onClick: () => {
														removeDeny(index);
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
												})
											]
										}, `${index}:${keyword}`);
									})
								}),
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
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: labelStyle,
									children: t("card.networkEnabled")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("card.networkEnabledHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "8px",
										marginTop: "6px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: value.networkEnabled === true,
										disabled: readonly,
										onChange: (event) => {
											scope.set("networkEnabled", event.currentTarget.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: "13px" },
										children: value.networkEnabled === true ? "ON" : "OFF"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("card.networkRebindNote")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: labelStyle,
									children: t("card.networkInjectEnv")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("card.networkInjectEnvHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "8px",
										marginTop: "6px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: value.networkInjectEnv !== false,
										disabled: readonly,
										onChange: (event) => {
											scope.set("networkInjectEnv", event.currentTarget.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: "13px" },
										children: value.networkInjectEnv !== false ? "ON" : "OFF"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							style: sectionStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: labelStyle,
									children: t("card.watch")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle,
									children: t("card.watchHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "8px",
										marginTop: "6px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: value.watch !== false,
										disabled: readonly,
										onChange: (event) => {
											scope.set("watch", event.currentTarget.checked);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: "13px" },
										children: value.watch !== false ? "ON" : "OFF"
									})]
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
				}) : null]
			});
		}
		/** 浮窗齿轮 + 固定定位浮层承载完整审批门卡。自绘定位,不依赖宿主容器布局。 */
		function FloatingPermissiveGate(props) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					position: "fixed",
					right: 16,
					bottom: 64,
					zIndex: 1e4
				},
				children: [
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						onClick: () => setOpen(false),
						style: {
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: "rgba(0,0,0,.45)",
							zIndex: 1e4
						}
					}) : null,
					open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							position: "fixed",
							top: "6vh",
							left: "50%",
							transform: "translateX(-50%)",
							width: "min(760px, 92vw)",
							maxHeight: "84vh",
							overflowY: "auto",
							zIndex: 10001
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setOpen(false),
							style: {
								position: "sticky",
								top: 6,
								float: "right",
								marginRight: 8,
								zIndex: 2,
								font: "inherit",
								cursor: "pointer",
								borderRadius: 8,
								border: "1px solid rgba(127,127,127,.4)",
								background: "rgba(30,30,32,.85)",
								color: "inherit",
								padding: "2px 10px"
							},
							children: "✕ 关闭"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PermissiveCard, {
							t: props.t,
							scope: props.scope
						})]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						title: "审批门设置",
						onClick: () => setOpen(!open),
						style: {
							width: 40,
							height: 40,
							borderRadius: "50%",
							border: "1px solid rgba(127,127,127,.4)",
							background: "rgba(30,30,32,.85)",
							color: "inherit",
							cursor: "pointer",
							fontSize: 16,
							boxShadow: "0 4px 16px rgba(0,0,0,.35)"
						},
						children: "🛡"
					})
				]
			});
		}
		//#endregion
		//#region src/client/feed.ts
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
		* Decision-path labels shown beside an event's tool name. Kept alongside
		* `presentation` (not in the dictionary) because they name host-internal
		* decision sources; an unknown value falls through to its raw string.
		*/
		const VERDICT_LABELS = {
			rule: "规则命中",
			grant: "会话授权",
			"hard-deny": "硬拒绝",
			"deny-keyword": "黑名单关键词",
			default: "默认策略",
			ask: "默认策略",
			permissive: "自动审查放行",
			classifier: "LLM 裁决",
			"llm-safe": "LLM 判定安全",
			"llm-learned": "LLM 学习放行",
			"learned-sediment": "沉淀规则放行",
			"learned-confirm": "学习确认",
			"human-approved": "人工通过",
			"human-rejected": "人工拒绝",
			"human-cancelled": "人工取消",
			"no-approval-channel": "无审批通道",
			"preset-passthrough": "审批策略 never · 已放行",
			"stand-down": "门禁停用"
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
		//#endregion
		//#region src/client/notice.tsx
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
							notice.reason
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
		//#endregion
		//#region src/client/history.tsx
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
						const verdict = ev.verdict === void 0 ? "" : VERDICT_LABELS[ev.verdict] ?? ev.verdict;
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
										children: ev.justification ?? ev.reason
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
		//#endregion
		//#region src/client/compat.ts
		/**
		* Resolve the plugin's durable settings scope through whichever service this
		* host line carries, then hand it to `onScope` exactly once.
		*
		* Both variants are scoped sub-injects: on a host without the service the fiber
		* waits forever WITHOUT blocking the plugin's other faces (same posture as the
		* notice strip's slot-inject when its slot holder is absent).
		*/
		function resolveSettingsScope(ctx, namespace, onScope) {
			ctx.inject(["configForms"], (configForms) => {
				onScope(configForms.get(namespace));
			});
			ctx.inject(["settingsScope"], (settingsScope) => {
				onScope(settingsScope.bind({ namespace }));
			});
		}
		//#endregion
		//#region src/client/index.ts
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
			resolveSettingsScope(ctx, PERMISSIVE_NS, (scope) => {
				ctx.slots.inject("settings.section", function* () {
					yield ctx.slots.register({
						name: "settings.section",
						id: PERMISSIVE_NS,
						order: 30,
						label: () => t("section.title"),
						locale: NS,
						inject: () => ({ scope })
					}, PermissiveCard);
				});
				ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
					name: "plugins.bundle.config",
					key: "dsh-perm-gate",
					locale: NS,
					inject: () => ({ scope })
				}, PermissiveCard));
				const overlaySlots = ctx.slots;
				overlaySlots.inject("shell.overlay", () => overlaySlots.register({
					name: "shell.overlay",
					id: PERMISSIVE_NS,
					inject: () => ({
						t,
						scope
					})
				}, FloatingPermissiveGate));
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map