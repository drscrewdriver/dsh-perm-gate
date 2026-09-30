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
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
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
		};
		/** English dictionary (keys mirror zh). */
		const en = {
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
		};
		/** French dictionary (keys mirror zh). */
		const fr = {
			"card.title": "自动审查 (Revue automatique)",
			"section.title": "Porte de revue automatique",
			"card.description": "Niveau d’approbation indépendant, parallèle à lecture seule / accès complet / liste blanche, affiché comme 自动审查 dans le sélecteur de permissions de session. Le front n’expose qu’un seul interrupteur ; les quatre stratégies d’approbation backend sont combinables depuis ce panneau et restent fail-closed face au refus dur P0.",
			"card.permissive": "Activer le niveau 自动审查",
			"card.permissiveHint": "Désactivée, la porte se comporte exactement comme avant.",
			"card.scopeNote": "Portée prédéfinie : cette porte n’agit que lorsque le préréglage de permissions de session est %scope. Sous tout autre préréglage, la porte entière se met en retrait — refus dur P0 compris — et la politique du préréglage choisi prend le relais. Une mise en retrait enregistre un événement et laisse une bande permanente au-dessus de la zone de saisie.",
			"card.strategies": "Stratégies d’approbation backend (au moins une effective ; combinables)",
			"card.strategy.trustAutoAllow": "trustAutoAllow — les opérations sûres du périmètre sont autorisées d’office ; les dangereuses/inconnues demandent confirmation (référence du niveau intermédiaire)",
			"card.strategy.alwaysConfirm": "alwaysConfirm — chaque passage demande confirmation ; les « contrôles d’autorisation » du panneau gagnent deux boutons étendus : « réautoriser ce type pour cette session » (autorisation limitée à la session) et « autoriser toutes les occurrences » (le mot de commande est persisté dans la liste blanche du rulesFile)",
			"card.strategy.llmAssist": "llmAssist — un LLM personnalisé évalue le risque : safe est autorisé d’office ; les risques durs deletion/credential/remote/system/bulk restent soumis à l’humain (le classifieur ne refuse jamais — il ne fait qu’escalader) ; neutral entre en apprentissage par confirmation ; échec/timeout retombe sur l’humain",
			"card.strategy.trustEscalation": "trustEscalation — élargissement de sandbox sans invite : pour un appel déjà autorisé par cette porte, l’extension de sandbox qu’un outil shell / pwsh / edit demande de l’intérieur est approuvée ici au lieu de vous demander",
			"card.strategy.trustEscalationHint": "Une demande d’élargissement de sandbox est émise depuis le corps de l’outil, après tools/pre-execute, donc la porte ne l’a jamais vue — un appel jugé safe par le LLM et autorisé d’office vous demandait quand même d’approuver l’élargissement. Activée, seule la demande que la porte a réellement autorisée (correspondance exacte par callId) saute l’invite ; tout le reste passe par l’humain comme avant, de même qu’une raison non reconnue ou une cible autre que workspace-write / danger-full-access. Désactivez-la pour garder l’élargissement sous contrôle humain.",
			"card.readonly": "Lecture seule",
			"card.unavailable": "Espace de noms Settings indisponible : assurez-vous que dsh-perm-gate est assemblé dans ce profil.",
			"card.llmReceiver": "LLM récepteur de llmAssist (compatible OpenAI ; toute API personnalisée)",
			"card.llmEndpoint": "Endpoint (BaseURL, ex. https://api.openai.com/v1)",
			"card.llmModel": "Model (id de modèle, ex. deepseek-chat)",
			"card.llmKey": "Clé API (secrète)",
			"card.llmKeyHidden": "Non définie · affichée sous forme de * après la première saisie",
			"card.llmKeyMasked": "Définie · saisissez une nouvelle valeur pour la remplacer",
			"card.llmKeyOverwrite": "Un secret est enregistré ; saisissez une nouvelle valeur puis quittez le champ pour la remplacer.",
			"card.llmKeyClear": "Effacer",
			"card.allowlist": "Liste blanche (allow, synchronisée au rulesFile)",
			"card.allowlistHint": "Les motifs de la section allow autorisent directement ; ajoutez ou supprimez des entrées une à une, écrites au rulesFile et rechargées en direct.",
			"card.allowlistPresetNote": "L’équivalent de liste blanche prédéfinie est la stratégie trustAutoAllow (opérations sûres du périmètre autorisées d’office), à activer dans la section des stratégies ci-dessus ; cette liste reflète la section allow de votre rulesFile et légitimement commence vide.",
			"card.allowlistEmpty": "Aucune règle de liste blanche",
			"card.allowlistPlaceholder": "Nouveau motif de commande, ex. npm test*",
			"card.allowlistAdd": "Ajouter",
			"card.allowlistRemove": "Supprimer ce motif",
			"card.allowlistBulk": "Édition en masse",
			"card.allowlistBulkHide": "Masquer l’édition en masse",
			"card.allowlistSave": "Enregistrer la liste blanche",
			"card.riskLearning": "riskLearning — apprentissage des verdicts : les demandes à risque neutral approuvées puis exécutées par l’humain comptent ; la même opération s’autorise d’office au seuil avec une empreinte correspondante",
			"card.riskLearningHint": "L’état d’apprentissage appartient au plugin ($DSH_HOME/perm-gate/learning.json) et n’est jamais écrit dans vos règles YAML ; une cible différente ne réutilise jamais une autorité. Désactivé par défaut.",
			"card.riskThreshold": "Confirmations humaines requises avant autorisation automatique (1–10)",
			"notice.label": "Activité de la porte de permissions",
			"history.label": "Approbations",
			"history.title": "Registres d’approbation de permissions",
			"history.subtitle": "Chaque décision de la porte dans cette conversation, de la plus récente à la plus ancienne",
			"history.loading": "Chargement…",
			"history.empty": "Aucun registre d’approbation dans cette session",
			"history.error": "Échec du chargement : ",
			"history.tag.auto": "Autorisé d’office",
			"history.tag.ask": "Demandé",
			"history.tag.deny": "Refusé",
			"card.denylistRestore": "Restaurer la liste noire prédéfinie",
			"card.denylist": "Liste noire (mots-clés deny, préréglage du plugin)",
			"card.denylistHint": "Un appel dont le texte contient un mot-clé (sous-chaîne insensible à la casse) est refusé d’emblée, avant liste blanche / autorisations / LLM. La liste prédéfinie est héritée de dsh-approval-gate et active dès l’installation ; modifiez-la librement — vide ou effacée, elle retombe sur le préréglage (restauration en un clic disponible), la liste noire ne se désactive donc jamais en silence.",
			"card.denylistEmpty": "Liste noire vide (aucun appel n’est bloqué par la couche de mots-clés)",
			"card.denylistPlaceholder": "Nouveau mot-clé, ex. drop database",
			"card.denylistAdd": "Ajouter",
			"card.denylistRemove": "Supprimer ce mot-clé",
			"card.denylistTagPreset": "Prédéfini",
			"card.denylistTagCustom": "Personnalisé",
			"card.riskSediment": "riskSediment — sédimentation d’apprentissage : les échantillons au seuil deviennent des autorisations déterministes",
			"card.riskSedimentHint": "Une fois activée, quand une clé tool|category atteint le seuil, ses empreintes d’échantillons se sédimentent en règles d’autorisation — une correspondance exacte même outil/même cible autorise d’office sans nouvel appel LLM (reste actif même llmAssist désactivé).",
			"card.sediment": "Sédiment d’apprentissage (règles d’autorisation déterministes)",
			"card.sedimentHint": "Règles sédimentées des confirmations humaines : seule une correspondance d’empreinte exacte autorise, jamais une cible différente. Terminez un apprentissage ou supprimez un échantillon.",
			"card.sedimentEmpty": "Aucune règle sédimentée pour l’instant (les échantillons au seuil apparaissent ici)",
			"card.sedimentCount": "confirmés %n/%t",
			"card.sedimentStop": "Terminer",
			"card.sedimentStopTitle": "Terminer cet apprentissage (supprime le compteur et les échantillons)",
			"card.sedimentStopConfirm": "Terminer l’apprentissage de « %k » ? Son compteur et tous ses échantillons seront supprimés.",
			"card.sedimentSampleRemove": "Supprimer cet échantillon sédimenté",
			"card.llmSource": "Source du récepteur",
			"card.llmSourceCustom": "API personnalisée (compatible OpenAI)",
			"card.llmSourceHost": "Utiliser le modèle par défaut actuel de la session (service llm DSH)",
			"card.llmSourceHostHint": "Par défaut, l’évaluation d’approbation s’exécute sur le groupe de modèles que la session DSH utilise actuellement (la valeur effective s’affiche ci-dessous) ; laissez Provider / Model vides pour suivre la session, ou choisissez dans la liste déroulante ou saisissez pour épingler — vos groupes personnalisés configurés dans DSH (ex. local-35b) apparaissent automatiquement.",
			"card.llmProvider": "Provider (vide = suivre la sélection de session)",
			"card.llmProviderPlaceholder": "Suivre la sélection de session",
			"card.llmModelHostPlaceholder": "Vide = suivre la sélection de session",
			"card.llmResolved": "Effectif maintenant : %p / %m",
			"card.llmPreset": "Préréglages d’endpoint (remplit les champs ; reste modifiable)",
			"card.llmPresetChoose": "Choisir un préréglage…",
			"card.llmPresetPublic": "Préréglages d’API publiques",
			"card.llmPresetHost": "Groupes de modèles DSH (la sélection bascule vers le récepteur de session)",
			"card.networkEnabled": "Interception réseau (networkEnabled)",
			"card.networkEnabledHint": "Une fois activée, démarre un proxy local qui intercepte les connexions sortantes des sous-processus et applique les règles allow/deny. Désactivée : aucun changement de comportement.",
			"card.watch": "Rechargement à chaud des règles (watch)",
			"card.watchHint": "Une fois activé, surveille automatiquement les fichiers de règles et applique les changements instantanément, sans rechargement manuel.",
			"card.networkRebindNote": "Effet immédiat — le proxy se relie automatiquement, sans rechargement du plugin.",
			"card.networkInjectEnv": "Injection des variables de proxy (networkInjectEnv)",
			"card.networkInjectEnvHint": "Écrit HTTP(S)_PROXY / ALL_PROXY pour les sous-processus (et efface NO_PROXY). Désactivée : l’écouteur tourne mais aucun environnement de processus ne change.",
			"card.healthStale": "Route de l’hôte indisponible (404) — la moitié node est encore un ancien build ; redémarrez complètement dsh (pas seulement la page du navigateur) puis réessayez.",
			"card.healthTest": "Test de santé",
			"card.healthRunning": "Test en cours…",
			"card.healthOk": "OK (%ms ms)",
			"card.healthFail": "Échec : ",
			"history.tag.learned": "Appris",
			"history.tag.manualApproved": "Approuvé",
			"history.tag.manualRejected": "Rejeté",
			"history.tag.manualCancelled": "Annulé",
			"history.tag.standDown": "Porte désactivée",
			"history.learnedProgress": "appris %n/%t",
			"history.snapshots": "instantanés diff",
			"history.clearSession": "Effacer cette session",
			"history.clearAll": "Tout effacer",
			"history.clearSessionTitle": "Effacer uniquement les instantanés diff de cette session (les autres sessions restent intactes)",
			"history.clearAllTitle": "Effacer les instantanés diff de toutes les sessions, y compris celles jamais consultées — demande une seconde confirmation",
			"history.clearSessionConfirm": "Effacer les instantanés diff de cette session ? Seules les données de comparaison produites par les approbations de cette session sont supprimées ; les registres d’approbation restent.",
			"history.clearAllConfirm": "Effacer les instantanés diff de TOUTES les sessions ? Cela peut supprimer des comparaisons que d’autres sessions n’ont pas encore consultées, sans retour arrière.",
			"history.diffTitle": "Comparaison des modifications de fichiers",
			"history.diffClose": "Fermer",
			"history.diffLoading": "Chargement…",
			"history.diffEmpty": "Aucun changement de contenu (ou fichier illisible)",
			"history.diffLoadFail": "Échec du chargement du diff : ",
			"history.diffRevert": "Annuler cette modification",
			"history.diffReverting": "Envoi…",
			"history.diffRevertDone": "Instruction d’annulation envoyée",
			"history.diffRevertSent": "Instruction d’annulation envoyée à la conversation ; l’IA restaurera le fichier en conséquence",
			"history.diffRevertFail": "Échec de l’envoi : ",
			"history.diffNoSnapshot": "Cet événement n’a pas d’instantané pour ce fichier",
			"history.diffChipTitle": "Voir la comparaison des modifications de ce fichier",
			"history.diffStats": "+%a / -%r lignes modifiées · %c inchangées",
			"history.diffGone": " (le fichier n’existe plus)",
			"history.diffHidden": "%n lignes non modifiées",
			"card.dryRun": "Test de règles",
			"card.dryRunHint": "Juge un appel selon les règles en vigueur. N’exécute aucun outil et n’écrit aucune règle — vérifiez une règle ici avant de la modifier.",
			"card.dryRunTool": "Outil",
			"card.dryRunCommand": "Commande / arguments",
			"card.dryRunCommandPlaceholder": "git push --force origin main",
			"card.dryRunTest": "Tester",
			"card.dryRunRunning": "Évaluation…",
			"card.dryRunEmpty": "Rien de testé pour l’instant. Saisissez un outil et une commande, puis appuyez sur Tester pour voir le verdict.",
			"card.dryRunVerdict": "Verdict",
			"card.dryRunAllow": "autoriser",
			"card.dryRunAsk": "demander",
			"card.dryRunDeny": "refuser",
			"card.dryRunRule": "Règle correspondante",
			"card.dryRunRuleNone": "aucune règle correspondante ; defaultAction : %d",
			"card.dryRunDimensions": "Dimensions",
			"card.dryRunReason": "Motif",
			"card.dryRunNote": "« Règle correspondante » vient de la couche de règles. Quand le verdict provient d’un refus dur antérieur ou de la liste noire de mots-clés, il n’y a pas d’index de règle — les dimensions listées sont alors purement indicatives.",
			"card.dryRunNoRules": "(0 règle chargée — vérifiez le chemin du rulesFile)",
			"card.dryRunFail": "Échec du test : ",
			"card.dryRunStale": "route absente (plugin non redémarré ?)",
			"card.rules": "Règles intégrées de Settings",
			"card.rulesHint": "Les règles que la porte charge en ce moment (du champ de config `rules` de l’entrée de ce plugin ; retombe sur le fichier de règles si non défini). Lecture seule — rien ici ne peut les changer. Pour changer les règles, utilisez la liste blanche ci-dessous ou la page des réglages.",
			"card.rulesRefresh": "Actualiser",
			"card.rulesLoading": "Lecture…",
			"card.rulesPath": "Source",
			"card.rulesNone": "aucune règle configurée",
			"card.rulesCounts": "Règles",
			"card.rulesDefault": "defaultAction",
			"card.rulesStats": "%b octets · %l lignes",
			"card.rulesMissing": "Règles introuvables. La porte retombe sur ses valeurs par défaut intégrées.",
			"card.rulesTruncated": "Règles volumineuses ; seuls les premiers 512 Ko sont affichés.",
			"card.rulesError": "Échec du chargement : ",
			"card.rulesStale": "route absente (plugin non redémarré ?)",
			"card.rulesNote": "Lecture seule : ce panneau ne peut pas modifier les règles. La section liste blanche et « toujours autoriser » sont réécrites dans la config d’entrée de ce plugin."
		};
		/** German dictionary (keys mirror zh). */
		const de = {
			"card.title": "自动审查 (Automatische Prüfung)",
			"section.title": "Auto-Prüf-Gate",
			"card.description": "Unabhängige Genehmigungsstufe neben read-only / full-access / whitelist, angezeigt als 自动审查 in der Sitzungsrechte-Auswahl. Das Frontend bietet nur einen einzigen Schalter; die vier Backend-Genehmigungsstrategien sind über dieses Panel kombinierbar und bleiben gegenüber P0-Hartablehnung fail-closed.",
			"card.permissive": "Stufe 自动审查 aktivieren",
			"card.permissiveHint": "Ausgeschaltet verhält sich das Gate exakt wie bisher.",
			"card.scopeNote": "Voreingestellter Geltungsbereich: Dieses Gate wirkt nur, während der Sitzungsrechte-Preset %scope ist. Unter jedem anderen Preset steht das gesamte Gate still — P0-Hartablehnung eingeschlossen — und die eigene Politik des gewählten Presets übernimmt. Ein Stillstand schreibt ein Ereignis und hinterlässt einen dauerhaften Hinweisstreifen über der Eingabe.",
			"card.strategies": "Backend-Genehmigungsstrategien (mindestens eine wirksam; kombinierbar)",
			"card.strategy.trustAutoAllow": "trustAutoAllow — sichere Operationen im Umfang werden automatisch erlaubt; gefährliche/unbekannte fragen nach (Baseline der mittleren Stufe)",
			"card.strategy.alwaysConfirm": "alwaysConfirm — jeder Durchgang fragt; die „Erlaubnis-Steuerungen“ des Genehmigungspanels erhalten zwei erweiterte Schaltflächen: „diesen Typ in dieser Sitzung wiederholt erlauben“ (sitzungsbegrenzte Genehmigung) und „jedes Vorkommen erlauben“ (das Befehlswort wird dauerhaft in die Whitelist der rulesFile aufgenommen)",
			"card.strategy.llmAssist": "llmAssist — ein benutzerdefiniertes LLM stuft das Risiko ein: safe wird automatisch erlaubt; harte Risiken (deletion/credential/remote/system/bulk) behalten die menschliche Nachfrage (der Klassifikator lehnt nie ab — er eskaliert nur); neutral geht ins Bestätigungslernen; Fehler/Timeout fällt auf den Menschen zurück",
			"card.strategy.trustEscalation": "trustEscalation — Sandbox-Ausweitung ohne Rückfrage: Bei einem von diesem Gate bereits erlaubten Aufruf wird die Ausweitung, die ein shell-/pwsh-/edit-Werkzeug von innen anfordert, hier genehmigt, statt Sie zu fragen",
			"card.strategy.trustEscalationHint": "Eine Sandbox-Ausweitungsanfrage stellt das Werkzeug selbst, nach tools/pre-execute, daher sah das Gate sie nie — ein vom LLM als safe eingestuftes, automatisch erlaubtes Aufrufen fragte Sie dennoch, die Ausweitung zu genehmigen. Eingeschaltet überspringt nur der exakte Aufruf die Rückfrage, den das Gate erlaubt hat (exakt per callId gematcht); alles andere geht wie bisher an den Menschen, ebenso bei unbekanntem Grund oder einem Ziel außer workspace-write / danger-full-access. Ausgeschaltet bleibt jede Ausweitung manuell genehmigungspflichtig.",
			"card.readonly": "Nur Lesen",
			"card.unavailable": "Settings-Namespace nicht verfügbar: Stellen Sie sicher, dass dsh-perm-gate in dieses Profil eingebaut ist.",
			"card.llmReceiver": "llmAssist-Empfangs-LLM (OpenAI-kompatibel; jede eigene API)",
			"card.llmEndpoint": "Endpoint (BaseURL, z. B. https://api.openai.com/v1)",
			"card.llmModel": "Model (Modell-ID, z. B. deepseek-chat)",
			"card.llmKey": "API-Key (geheim)",
			"card.llmKeyHidden": "Nicht gesetzt · nach der ersten Eingabe als * angezeigt",
			"card.llmKeyMasked": "Gesetzt · neuen Wert eingeben zum Überschreiben",
			"card.llmKeyOverwrite": "Ein Geheimwert ist gespeichert; geben Sie einen neuen Wert ein und verlassen Sie das Feld, um ihn zu überschreiben.",
			"card.llmKeyClear": "Löschen",
			"card.allowlist": "Whitelist (allow, mit rulesFile synchronisiert)",
			"card.allowlistHint": "Muster im allow-Abschnitt erlauben direkt; Einträge einzeln hinzufügen oder entfernen — wird in die rulesFile geschrieben und live neu geladen.",
			"card.allowlistPresetNote": "Das Pendant zur voreingestellten Whitelist ist die Strategie trustAutoAllow (sichere Operationen im Umfang automatisch erlauben), aktivierbar im Strategiebereich oben; diese Liste spiegelt den allow-Abschnitt Ihrer rulesFile und darf leer beginnen.",
			"card.allowlistEmpty": "Keine Whitelist-Regeln",
			"card.allowlistPlaceholder": "Neues Befehlsmuster, z. B. npm test*",
			"card.allowlistAdd": "Hinzufügen",
			"card.allowlistRemove": "Dieses Muster entfernen",
			"card.allowlistBulk": "Massenbearbeitung",
			"card.allowlistBulkHide": "Massenbearbeitung einklappen",
			"card.allowlistSave": "Whitelist speichern",
			"card.riskLearning": "riskLearning — Urteilslernen: neutral-Risiko-Anfragen, die der Mensch genehmigt und die ausgeführt werden, zählen hoch; dieselbe Operation wird bei Erreichen des Schwellwerts mit passendem Fingerabdruck automatisch erlaubt",
			"card.riskLearningHint": "Der Lernzustand gehört zum Plugin ($DSH_HOME/perm-gate/learning.json) und wird nie in Ihre YAML-Regeln geschrieben; ein anderes Ziel nutzt eine Erlaubnis nie wieder. Standardmäßig aus.",
			"card.riskThreshold": "Menschliche Bestätigungen vor automatischer Erlaubnis (1–10)",
			"notice.label": "Aktivität des Rechte-Gates",
			"history.label": "Genehmigungen",
			"history.title": "Genehmigungsprotokoll der Rechte",
			"history.subtitle": "Jede Gate-Entscheidung dieser Konversation, neueste zuerst",
			"history.loading": "Wird geladen…",
			"history.empty": "Noch keine Genehmigungen in dieser Sitzung",
			"history.error": "Laden fehlgeschlagen: ",
			"history.tag.auto": "Automatisch erlaubt",
			"history.tag.ask": "Nachgefragt",
			"history.tag.deny": "Abgelehnt",
			"card.denylistRestore": "Voreingestellte Blacklist wiederherstellen",
			"card.denylist": "Blacklist (deny-Schlüsselwörter, Plugin-Voreinstellung)",
			"card.denylistHint": "Ein Aufruf, dessen Text ein Schlüsselwort enthält (Teilstring, Groß-/Kleinschreibung egal), wird rundum abgelehnt — vor Whitelist / Genehmigungen / LLM. Die Voreinstellung stammt von dsh-approval-gate und ist ab Installation aktiv; frei editierbar — leer oder geleert fällt auf die Voreinstellung zurück (Ein-Klick-Wiederherstellung), die Blacklist schaltet sich also nie still ab.",
			"card.denylistEmpty": "Blacklist leer (kein Aufruf wird von der Schlüsselwortschicht abgelehnt)",
			"card.denylistPlaceholder": "Neues Schlüsselwort, z. B. drop database",
			"card.denylistAdd": "Hinzufügen",
			"card.denylistRemove": "Dieses Schlüsselwort entfernen",
			"card.denylistTagPreset": "Voreingestellt",
			"card.denylistTagCustom": "Benutzerdefiniert",
			"card.riskSediment": "riskSediment — Lernsedimentierung: Stichproben am Schwellwert werden deterministische Auto-Erlaubnisse",
			"card.riskSedimentHint": "Eingeschaltet sedimentieren die Stichproben-Fingerabdrücke eines tool|category-Schlüssels bei Erreichen des Schwellwerts zu Erlaubnisregeln — ein exakter Treffer gleiches Werkzeug/gleiches Ziel erlaubt ohne weiteren LLM-Aufruf (wirkt auch bei ausgeschaltetem llmAssist).",
			"card.sediment": "Lernsediment (deterministische Erlaubnisregeln)",
			"card.sedimentHint": "Aus menschlichen Bestätigungen sedimentierte Regeln: Nur ein exakter Fingerabdruck-Treffer erlaubt, nie ein anderes Ziel. Ein Lernen beenden oder eine Stichprobe entfernen.",
			"card.sedimentEmpty": "Noch keine sedimentierten Regeln (Stichproben am Schwellwert erscheinen hier)",
			"card.sedimentCount": "bestätigt %n/%t",
			"card.sedimentStop": "Beenden",
			"card.sedimentStopTitle": "Dieses Lernen beenden (Zähler und Stichproben werden gelöscht)",
			"card.sedimentStopConfirm": "Lernen für „%k“ beenden? Zähler und alle Stichproben werden gelöscht.",
			"card.sedimentSampleRemove": "Diese sedimentierte Stichprobe entfernen",
			"card.llmSource": "Empfangsquelle",
			"card.llmSourceCustom": "Eigene API (OpenAI-kompatibel)",
			"card.llmSourceHost": "Aktuelles Sitzungsstandardmodell verwenden (DSH-llm-Dienst)",
			"card.llmSourceHostHint": "Standardmäßig läuft die Genehmigungsbewertung auf der Modellgruppe, die die DSH-Sitzung aktuell nutzt (der effektive Wert steht unten); lassen Sie Provider / Model leer, um der Sitzung zu folgen, oder wählen Sie aus der Liste bzw. tippen Sie einen festen Wert — eigene Gruppen aus Ihrer DSH-Konfiguration (z. B. local-35b) erscheinen automatisch.",
			"card.llmProvider": "Provider (leer = der Sitzungsauswahl folgen)",
			"card.llmProviderPlaceholder": "Der Sitzungsauswahl folgen",
			"card.llmModelHostPlaceholder": "Leer = der Sitzungsauswahl folgen",
			"card.llmResolved": "Derzeit wirksam: %p / %m",
			"card.llmPreset": "Endpoint-Voreinstellungen (füllt die Felder; weiter editierbar)",
			"card.llmPresetChoose": "Voreinstellung wählen…",
			"card.llmPresetPublic": "Voreinstellungen für öffentliche APIs",
			"card.llmPresetHost": "DSH-Modellgruppen (Auswahl wechselt zum Sitzungsempfänger)",
			"card.networkEnabled": "Netzwerkabfangen (networkEnabled)",
			"card.networkEnabledHint": "Eingeschaltet startet ein lokaler Proxy, der ausgehende Verbindungen von Unterprozessen abfängt und allow/deny-Regeln anwendet. Aus = kein Verhaltensunterschied.",
			"card.watch": "Heißes Nachladen der Regeln (watch)",
			"card.watchHint": "Eingeschaltet werden Regeldateien automatisch überwacht und Änderungen sofort angewendet — ohne manuelles Nachladen.",
			"card.networkRebindNote": "Wirkt sofort — der Proxy bindet automatisch neu, ein Plugin-Neuladen ist nicht nötig.",
			"card.networkInjectEnv": "Proxy-Umgebungsvariablen injizieren (networkInjectEnv)",
			"card.networkInjectEnvHint": "Schreibt HTTP(S)_PROXY / ALL_PROXY für Unterprozesse (und leert NO_PROXY). Aus = der Lauscher läuft, aber keine Prozessumgebung ändert sich.",
			"card.healthStale": "Host-Route nicht verfügbar (404) — die node-Hälfte ist noch ein alter Build; starten Sie dsh vollständig neu (nicht nur die Browserseite) und versuchen Sie es erneut.",
			"card.healthTest": "Gesundheitstest",
			"card.healthRunning": "Teste…",
			"card.healthOk": "OK (%ms ms)",
			"card.healthFail": "Fehlgeschlagen: ",
			"history.tag.learned": "Gelernt",
			"history.tag.manualApproved": "Genehmigt",
			"history.tag.manualRejected": "Abgelehnt",
			"history.tag.manualCancelled": "Abgebrochen",
			"history.tag.standDown": "Gate aus",
			"history.learnedProgress": "gelernt %n/%t",
			"history.snapshots": "diff-Snapshots",
			"history.clearSession": "Nur diese Sitzung leeren",
			"history.clearAll": "Alles leeren",
			"history.clearSessionTitle": "Nur die diff-Snapshots dieser Sitzung löschen (andere Sitzungen unberührt)",
			"history.clearAllTitle": "diff-Snapshots aller Sitzungen löschen, auch nie angesehener — fragt nochmals nach",
			"history.clearSessionConfirm": "diff-Snapshots dieser Sitzung löschen? Nur die von den Genehmigungen dieser Sitzung erzeugten Vergleichsdaten werden entfernt; die Genehmigungsprotokolle bleiben.",
			"history.clearAllConfirm": "diff-Snapshots ALLER Sitzungen löschen? Das kann Vergleiche löschen, die andere Sitzungen noch nicht angesehen haben, und ist nicht rückgängig zu machen.",
			"history.diffTitle": "Dateiänderungsvergleich",
			"history.diffClose": "Schließen",
			"history.diffLoading": "Wird geladen…",
			"history.diffEmpty": "Keine Inhaltsänderung (oder Datei nicht lesbar)",
			"history.diffLoadFail": "diff konnte nicht geladen werden: ",
			"history.diffRevert": "Diese Änderung zurücknehmen",
			"history.diffReverting": "Wird gesendet…",
			"history.diffRevertDone": "Rücknahmeanweisung gesendet",
			"history.diffRevertSent": "Rücknahmeanweisung an die Konversation gesendet; die KI stellt die Datei entsprechend wieder her",
			"history.diffRevertFail": "Senden fehlgeschlagen: ",
			"history.diffNoSnapshot": "Dieses Ereignis hat keinen Snapshot für diese Datei",
			"history.diffChipTitle": "Änderungsvergleich dieser Datei ansehen",
			"history.diffStats": "+%a / -%r Zeilen geändert · %c unverändert",
			"history.diffGone": " (Datei existiert nicht mehr)",
			"history.diffHidden": "%n unveränderte Zeilen",
			"card.dryRun": "Regeltest",
			"card.dryRunHint": "Beurteilt einen Aufruf gegen die geltenden Regeln. Führt kein Werkzeug aus und schreibt keine Regel — prüfen Sie eine Regel hier, bevor Sie sie ändern.",
			"card.dryRunTool": "Werkzeug",
			"card.dryRunCommand": "Befehl / Argumente",
			"card.dryRunCommandPlaceholder": "git push --force origin main",
			"card.dryRunTest": "Testen",
			"card.dryRunRunning": "Wird beurteilt…",
			"card.dryRunEmpty": "Noch nichts getestet. Werkzeug und Befehl eingeben, dann auf Testen drücken, um das Urteil zu sehen.",
			"card.dryRunVerdict": "Urteil",
			"card.dryRunAllow": "erlauben",
			"card.dryRunAsk": "nachfragen",
			"card.dryRunDeny": "ablehnen",
			"card.dryRunRule": "Passende Regel",
			"card.dryRunRuleNone": "keine Regel passt; defaultAction: %d",
			"card.dryRunDimensions": "Dimensionen",
			"card.dryRunReason": "Grund",
			"card.dryRunNote": "„Passende Regel“ stammt aus der Regelebene. Stammt das Urteil aus einer früheren Hartablehnung oder der Schlüsselwort-Blacklist, gibt es keine Regelnummer — die gelisteten Dimensionen sind dann rein informativ.",
			"card.dryRunNoRules": "(0 Regeln geladen — rulesFile-Pfad prüfen)",
			"card.dryRunFail": "Test fehlgeschlagen: ",
			"card.dryRunStale": "Route fehlt (Plugin nicht neu gestartet?)",
			"card.rules": "Eingebaute Regeln aus Settings",
			"card.rulesHint": "Die Regeln, die das Gate gerade lädt (aus dem `rules`-Konfigurationsfeld dieses Plugin-Eintrags; ohne Angabe fällt es auf die Regeldatei zurück). Nur Lesen — hier lässt sich nichts ändern. Regeln ändern Sie über die Whitelist unten oder auf der Einstellungsseite.",
			"card.rulesRefresh": "Aktualisieren",
			"card.rulesLoading": "Wird gelesen…",
			"card.rulesPath": "Quelle",
			"card.rulesNone": "keine Regeln konfiguriert",
			"card.rulesCounts": "Regeln",
			"card.rulesDefault": "defaultAction",
			"card.rulesStats": "%b Bytes · %l Zeilen",
			"card.rulesMissing": "Regeln nicht gefunden. Das Gate fällt auf seine eingebauten Standardwerte zurück.",
			"card.rulesTruncated": "Regeln sind groß; nur die ersten 512 KB werden angezeigt.",
			"card.rulesError": "Laden fehlgeschlagen: ",
			"card.rulesStale": "Route fehlt (Plugin nicht neu gestartet?)",
			"card.rulesNote": "Nur Lesen: Dieses Panel kann die Regeln nicht ändern. Der Whitelist-Abschnitt und „immer erlauben“ schreiben in die Eintragskonfiguration dieses Plugins zurück."
		};
		/** Italian dictionary (keys mirror zh). */
		const it = {
			"card.title": "自动审查 (Revisione automatica)",
			"section.title": "Gate di revisione automatica",
			"card.description": "Livello di approvazione indipendente, parallelo a read-only / full-access / whitelist, mostrato come 自动审查 nel selettore dei permessi di sessione. Il front-end espone un solo interruttore; le quattro strategie di approvazione del backend sono combinabili da questo pannello e restano fail-closed contro il diniego rigido P0.",
			"card.permissive": "Attiva il livello 自动审查",
			"card.permissiveHint": "Spento, il gate si comporta esattamente come prima.",
			"card.scopeNote": "Ambito preimpostato: questo gate agisce solo quando il preset dei permessi di sessione è %scope. Con qualsiasi altro preset l’intero gate si disattiva — diniego rigido P0 compreso — e prende il comando la politica del preset scelto. Una disattivazione registra un evento e lascia una striscia persistente sopra la casella di input.",
			"card.strategies": "Strategie di approvazione del backend (almeno una efficace; combinabili)",
			"card.strategy.trustAutoAllow": "trustAutoAllow — le operazioni sicure nell’ambito sono consentite automaticamente; quelle pericolose/sconosciute chiedono conferma (baseline del livello intermedio)",
			"card.strategy.alwaysConfirm": "alwaysConfirm — ogni passaggio chiede conferma; i «controlli di consenso» del pannello di approvazione ricevono due pulsanti estesi: «ri-consenti questo tipo per questa sessione» (concessione limitata alla sessione) e «consenti ogni occorrenza» (la parola di comando viene resa persistente nella whitelist del rulesFile)",
			"card.strategy.llmAssist": "llmAssist — un LLM personalizzato gradua il rischio: safe consente automaticamente; i rischi rigidi deletion/credential/remote/system/bulk mantengono la conferma umana (il classificatore non nega mai — si limita a escalare); neutral entra nell’apprendimento per conferma; fallimento/timeout ricade sull’umano",
			"card.strategy.trustEscalation": "trustEscalation — ampliamento sandbox senza prompt: per una chiamata già consentita da questo gate, l’ampliamento di sandbox che uno strumento shell / pwsh / edit richiede dal proprio interno viene approvato qui invece di chiedere a te",
			"card.strategy.trustEscalationHint": "Una richiesta di ampliamento sandbox parte dall’interno del corpo dello strumento, dopo tools/pre-execute, quindi il gate non l’ha mai vista — una chiamata valutata safe dal LLM e consentita automaticamente chiedeva comunque l’approvazione dell’ampliamento. Attiva, solo la chiamata esatta che il gate ha consentito (corrispondenza esatta per callId) salta il prompt; tutto il resto va all’umano come prima, così come una ragione non riconosciuta o una destinazione diversa da workspace-write / danger-full-access. Disattiva per tenere l’ampliamento sotto controllo umano.",
			"card.readonly": "Sola lettura",
			"card.unavailable": "Namespace delle impostazioni non disponibile: verifica che dsh-perm-gate sia assemblato in questo profilo.",
			"card.llmReceiver": "LLM ricevente di llmAssist (compatibile OpenAI; qualsiasi API personalizzata)",
			"card.llmEndpoint": "Endpoint (BaseURL, es. https://api.openai.com/v1)",
			"card.llmModel": "Model (id del modello, es. deepseek-chat)",
			"card.llmKey": "API Key (segreta)",
			"card.llmKeyHidden": "Non impostata · mostrata come * dopo il primo inserimento",
			"card.llmKeyMasked": "Impostata · digita un nuovo valore per sostituirla",
			"card.llmKeyOverwrite": "Un segreto è memorizzato; digita un nuovo valore e togli il focus per sostituirlo.",
			"card.llmKeyClear": "Cancella",
			"card.allowlist": "Whitelist (allow, sincronizzata con il rulesFile)",
			"card.allowlistHint": "I pattern nella sezione allow consentono direttamente; aggiungi o rimuovi voci una a una, scritte nel rulesFile e ricaricate in diretta.",
			"card.allowlistPresetNote": "L’equivalente della whitelist preimpostata è la strategia trustAutoAllow (operazioni sicure nell’ambito consentite automaticamente), da attivare nella sezione strategie sopra; questo elenco rispecchia la sezione allow del tuo rulesFile ed è normale che parta vuoto.",
			"card.allowlistEmpty": "Nessuna regola di whitelist",
			"card.allowlistPlaceholder": "Nuovo pattern di comando, es. npm test*",
			"card.allowlistAdd": "Aggiungi",
			"card.allowlistRemove": "Rimuovi questo pattern",
			"card.allowlistBulk": "Modifica in blocco",
			"card.allowlistBulkHide": "Nascondi la modifica in blocco",
			"card.allowlistSave": "Salva la whitelist",
			"card.riskLearning": "riskLearning — apprendimento dei verdetti: le richieste a rischio neutral approvate ed eseguite dall’umano contano; la stessa operazione si auto-consente alla soglia con impronta corrispondente",
			"card.riskLearningHint": "Lo stato di apprendimento è dati del plugin ($DSH_HOME/perm-gate/learning.json) e non viene mai scritto nelle tue regole YAML; una destinazione diversa non riusa mai un’autorità. Disattivato per impostazione predefinita.",
			"card.riskThreshold": "Conferme umane richieste prima del consenso automatico (1–10)",
			"notice.label": "Attività del gate dei permessi",
			"history.label": "Approvazioni",
			"history.title": "Registri di approvazione dei permessi",
			"history.subtitle": "Ogni decisione del gate in questa conversazione, dalla più recente",
			"history.loading": "Caricamento…",
			"history.empty": "Nessun registro di approvazione in questa sessione",
			"history.error": "Caricamento non riuscito: ",
			"history.tag.auto": "Auto-consentito",
			"history.tag.ask": "Chiesto",
			"history.tag.deny": "Negato",
			"card.denylistRestore": "Ripristina la blacklist preimpostata",
			"card.denylist": "Blacklist (parole chiave deny, preimpostazione del plugin)",
			"card.denylistHint": "Una chiamata il cui testo contiene una parola chiave (sottostringa senza distinzione tra maiuscole e minuscole) viene negata outright — prima di whitelist / concessioni / LLM. L’elenco preimpostato è ereditato da dsh-approval-gate e attivo dall’installazione; modifica liberamente — vuoto o svuotato ricade sulla preimpostazione (ripristino con un clic disponibile), così la blacklist non si spegne mai in silenzio.",
			"card.denylistEmpty": "Blacklist vuota (nessuna chiamata è bloccata dal livello delle parole chiave)",
			"card.denylistPlaceholder": "Nuova parola chiave, es. drop database",
			"card.denylistAdd": "Aggiungi",
			"card.denylistRemove": "Rimuovi questa parola chiave",
			"card.denylistTagPreset": "Preimpostato",
			"card.denylistTagCustom": "Personalizzato",
			"card.riskSediment": "riskSediment — sedimentazione dell’apprendimento: i campioni arrivati alla soglia diventano consensi deterministici",
			"card.riskSedimentHint": "Attiva, quando una chiave tool|category raggiunge la soglia le impronte dei suoi campioni si sedimentano in regole di consenso — una corrispondenza esatta stesso strumento/stessa destinazione consente senza un’altra chiamata LLM (resta attivo anche con llmAssist spento).",
			"card.sediment": "Sedimento di apprendimento (regole di consenso deterministiche)",
			"card.sedimentHint": "Regole sedimentate dalle conferme umane: solo una corrispondenza esatta di impronta consente, mai una destinazione diversa. Termina un apprendimento o rimuovi un campione.",
			"card.sedimentEmpty": "Ancora nessuna regola sedimentata (i campioni arrivati alla soglia compaiono qui)",
			"card.sedimentCount": "confermati %n/%t",
			"card.sedimentStop": "Termina",
			"card.sedimentStopTitle": "Termina questo apprendimento (elimina il conteggio e i campioni)",
			"card.sedimentStopConfirm": "Terminare l’apprendimento di «%k»? Il conteggio e tutti i campioni saranno eliminati.",
			"card.sedimentSampleRemove": "Rimuovi questo campione sedimentato",
			"card.llmSource": "Sorgente del ricevente",
			"card.llmSourceCustom": "API personalizzata (compatibile OpenAI)",
			"card.llmSourceHost": "Usa il modello predefinito corrente della sessione (servizio llm DSH)",
			"card.llmSourceHostHint": "Per impostazione predefinita la graduazione dell’approvazione gira sul gruppo di modelli che la sessione DSH usa attualmente (il valore effettivo è mostrato sotto); lascia Provider / Model vuoti per seguire la sessione, oppure scegli dal menu a tendina o digita per fissarne uno — i gruppi personalizzati configurati in DSH (es. local-35b) compaiono automaticamente.",
			"card.llmProvider": "Provider (vuoto = segue la selezione della sessione)",
			"card.llmProviderPlaceholder": "Segue la selezione della sessione",
			"card.llmModelHostPlaceholder": "Vuoto = segue la selezione della sessione",
			"card.llmResolved": "Effettivo ora: %p / %m",
			"card.llmPreset": "Preimpostazioni di endpoint (compila i campi; resta modificabile)",
			"card.llmPresetChoose": "Scegli una preimpostazione…",
			"card.llmPresetPublic": "Preimpostazioni di API pubbliche",
			"card.llmPresetHost": "Gruppi di modelli DSH (la selezione passa al ricevente di sessione)",
			"card.networkEnabled": "Intercettazione di rete (networkEnabled)",
			"card.networkEnabledHint": "Attiva, avvia un proxy locale che intercetta le connessioni in uscita dei sottoprocessi e applica regole allow/deny. Spenta = nessun cambiamento di comportamento.",
			"card.watch": "Ricarica a caldo delle regole (watch)",
			"card.watchHint": "Attivo, osserva automaticamente i file di regole e applica i cambiamenti all’istante, senza ricarica manuale.",
			"card.networkRebindNote": "Effetto immediato — il proxy si ricollega da solo, nessun ricaricamento del plugin.",
			"card.networkInjectEnv": "Iniezione delle variabili d’ambiente del proxy (networkInjectEnv)",
			"card.networkInjectEnvHint": "Scrive HTTP(S)_PROXY / ALL_PROXY per i sottoprocessi (e cancella NO_PROXY). Spenta = il listener gira ma nessun ambiente di processo cambia.",
			"card.healthStale": "Rotta dell’host non disponibile (404) — la metà node è ancora una build vecchia; riavvia completamente dsh (non solo la pagina del browser) e riprova.",
			"card.healthTest": "Test di salute",
			"card.healthRunning": "Test in corso…",
			"card.healthOk": "OK (%ms ms)",
			"card.healthFail": "Non riuscito: ",
			"history.tag.learned": "Appreso",
			"history.tag.manualApproved": "Approvato",
			"history.tag.manualRejected": "Rifiutato",
			"history.tag.manualCancelled": "Annullato",
			"history.tag.standDown": "Gate disattivato",
			"history.learnedProgress": "appreso %n/%t",
			"history.snapshots": "snapshot diff",
			"history.clearSession": "Svuota questa sessione",
			"history.clearAll": "Svuota tutto",
			"history.clearSessionTitle": "Svuota solo gli snapshot diff di questa sessione (le altre sessioni restano intatte)",
			"history.clearAllTitle": "Svuota gli snapshot diff di ogni sessione, comprese quelle mai riviste — chiede una seconda conferma",
			"history.clearSessionConfirm": "Svuotare gli snapshot diff di questa sessione? Vengono rimossi solo i dati di confronto prodotti dalle approvazioni di questa sessione; i registri di approvazione restano.",
			"history.clearAllConfirm": "Svuotare gli snapshot diff di TUTTE le sessioni? Questo può eliminare confronti che altre sessioni non hanno ancora visto, e non si può annullare.",
			"history.diffTitle": "Confronto delle modifiche ai file",
			"history.diffClose": "Chiudi",
			"history.diffLoading": "Caricamento…",
			"history.diffEmpty": "Nessun cambiamento di contenuto (o file non leggibile)",
			"history.diffLoadFail": "Caricamento del diff non riuscito: ",
			"history.diffRevert": "Annulla questa modifica",
			"history.diffReverting": "Invio…",
			"history.diffRevertDone": "Istruzione di annullamento inviata",
			"history.diffRevertSent": "Istruzione di annullamento inviata alla conversazione; l’AI ripristinerà il file di conseguenza",
			"history.diffRevertFail": "Invio non riuscito: ",
			"history.diffNoSnapshot": "Questo evento non ha uno snapshot per quel file",
			"history.diffChipTitle": "Vedi il confronto delle modifiche di questo file",
			"history.diffStats": "+%a / -%r righe modificate · %c invariate",
			"history.diffGone": " (il file non esiste più)",
			"history.diffHidden": "%n righe non modificate",
			"card.dryRun": "Test delle regole",
			"card.dryRunHint": "Giudica una chiamata secondo le regole in vigore. Non esegue alcuno strumento e non scrive alcuna regola — verifica una regola qui prima di modificarla.",
			"card.dryRunTool": "Strumento",
			"card.dryRunCommand": "Comando / argomenti",
			"card.dryRunCommandPlaceholder": "git push --force origin main",
			"card.dryRunTest": "Testa",
			"card.dryRunRunning": "Giudizio in corso…",
			"card.dryRunEmpty": "Niente ancora testato. Inserisci strumento e comando, poi premi Testa per vedere come sarebbe giudicato.",
			"card.dryRunVerdict": "Verdetto",
			"card.dryRunAllow": "consenti",
			"card.dryRunAsk": "chiedi",
			"card.dryRunDeny": "nega",
			"card.dryRunRule": "Regola corrisposta",
			"card.dryRunRuleNone": "nessuna regola corrisposta; defaultAction: %d",
			"card.dryRunDimensions": "Dimensioni",
			"card.dryRunReason": "Motivo",
			"card.dryRunNote": "«Regola corrisposta» viene dal livello delle regole. Quando il verdetto proviene da un diniego rigido precedente o dalla blacklist di parole chiave non c’è un indice di regola — le dimensioni elencate sono allora solo indicative.",
			"card.dryRunNoRules": "(0 regole caricate — controlla il percorso del rulesFile)",
			"card.dryRunFail": "Test non riuscito: ",
			"card.dryRunStale": "rotta assente (plugin non riavviato?)",
			"card.rules": "Regole incorporate di Settings",
			"card.rulesHint": "Le regole che il gate sta caricando adesso (dal campo di configurazione `rules` della voce di questo plugin; senza configurazione ricade sul file di regole). Sola lettura — qui non si può cambiare nulla. Per cambiare le regole usa la whitelist sotto o la pagina delle impostazioni.",
			"card.rulesRefresh": "Aggiorna",
			"card.rulesLoading": "Lettura…",
			"card.rulesPath": "Sorgente",
			"card.rulesNone": "nessuna regola configurata",
			"card.rulesCounts": "Regole",
			"card.rulesDefault": "defaultAction",
			"card.rulesStats": "%b byte · %l righe",
			"card.rulesMissing": "Regole non trovate. Il gate ricade sui suoi valori predefiniti incorporati.",
			"card.rulesTruncated": "Regole grandi; mostro solo i primi 512 KB.",
			"card.rulesError": "Caricamento non riuscito: ",
			"card.rulesStale": "rotta assente (plugin non riavviato?)",
			"card.rulesNote": "Sola lettura: questo pannello non può modificare le regole. La sezione whitelist e «consenti sempre» riscrivono nella configurazione della voce di questo plugin."
		};
		/** Russian dictionary (keys mirror zh). */
		const ru = {
			"card.title": "自动审查 (Автопроверка)",
			"section.title": "Шлюз автопроверки",
			"card.description": "Отдельный уровень одобрения наряду с read-only / full-access / whitelist, в выборе прав сессии показывается как 自动审查. Фронтенд показывает один переключатель; четыре серверные стратегии одобрения комбинируются на этой панели и по-прежнему fail-closed против жёсткого отказа P0.",
			"card.permissive": "Включить уровень 自动审查",
			"card.permissiveHint": "При выключении шлюз ведёт себя ровно как раньше.",
			"card.scopeNote": "Область пресета: шлюз действует, только когда пресет прав сессии — %scope. При любом другом пресете весь шлюз стоит (включая жёсткий отказ P0), и действует политика выбранного пресета. Остановка записывает одно событие и оставляет постоянную полосу над полем ввода.",
			"card.strategies": "Серверные стратегии одобрения (хотя бы одна действует; сочетаются)",
			"card.strategy.trustAutoAllow": "trustAutoAllow — безопасные операции в области пропускаются автоматически; опасные/неизвестные спрашивают (базовый средний уровень)",
			"card.strategy.alwaysConfirm": "alwaysConfirm — каждый проход спрашивает; у «элементов разрешения» панели одобрения появляются две расширенные кнопки: «повторно разрешать этот тип в этой сессии» (сессионная ограниченная выдача) и «разрешать каждое вхождение» (слово команды переносится на постоянной основе в белый список rulesFile)",
			"card.strategy.llmAssist": "llmAssist — пользовательская LLM оценивает риск: safe пропускается автоматически; жёсткие риски deletion/credential/remote/system/bulk остаются на подтверждении человеком (классификатор никогда не отказывает — только эскалирует); neutral уходит в обучение по подтверждениям; сбой/тайм-аут возвращается человеку",
			"card.strategy.trustEscalation": "trustEscalation — расширение песочницы без запроса: для вызова, который шлюз уже пропустил, расширение песочницы, запрашиваемое инструментом shell / pwsh / edit изнутри, одобряется здесь, а не вопросом вам",
			"card.strategy.trustEscalationHint": "Запрос расширения песочницы возникает внутри тела инструмента, после tools/pre-execute, поэтому шлюз его не видел — вызов, оценённый LLM как safe и пропущенный автоматически, всё равно спрашивал у вас одобрения расширения. При включении запрос пропускает только тот точный вызов, который шлюз пропустил (точное совпадение по callId); всё остальное идёт человеку как раньше — как и нераспознанная причина или цель, отличная от workspace-write / danger-full-access. Выключите, чтобы оставить расширение под контролем человека.",
			"card.readonly": "Только чтение",
			"card.unavailable": "Пространство имён настроек недоступно: убедитесь, что dsh-perm-gate собран в этот профиль.",
			"card.llmReceiver": "Принимающая LLM для llmAssist (совместимая с OpenAI; любой свой API)",
			"card.llmEndpoint": "Endpoint (BaseURL, напр. https://api.openai.com/v1)",
			"card.llmModel": "Model (id модели, напр. deepseek-chat)",
			"card.llmKey": "API-ключ (секрет)",
			"card.llmKeyHidden": "Не задан · после первого ввода отображается как *",
			"card.llmKeyMasked": "Задан · введите новое значение, чтобы перезаписать",
			"card.llmKeyOverwrite": "Секрет сохранён; введите новое значение и уберите фокус, чтобы перезаписать.",
			"card.llmKeyClear": "Очистить",
			"card.allowlist": "Белый список (allow, синхронизируется с rulesFile)",
			"card.allowlistHint": "Шаблоны из секции allow пропускают напрямую; добавляйте и удаляйте записи по одной — запись идёт в rulesFile и перезагружается на лету.",
			"card.allowlistPresetNote": "Эквивалент предустановленного белого списка — стратегия trustAutoAllow (безопасные операции в области пропускаются автоматически), включается в блоке стратегий выше; этот список отражает секцию allow вашего rulesFile и поначалу пуст — это нормально.",
			"card.allowlistEmpty": "Нет правил белого списка",
			"card.allowlistPlaceholder": "Новый шаблон команды, напр. npm test*",
			"card.allowlistAdd": "Добавить",
			"card.allowlistRemove": "Удалить этот шаблон",
			"card.allowlistBulk": "Массовое редактирование",
			"card.allowlistBulkHide": "Свернуть массовое редактирование",
			"card.allowlistSave": "Сохранить белый список",
			"card.riskLearning": "riskLearning — обучение вердиктам: запросы риска neutral, подтверждённые и исполненные человеком, считаются; та же операция при достижении порога с совпадающим отпечатком пропускается автоматически",
			"card.riskLearningHint": "Состояние обучения принадлежит плагину ($DSH_HOME/perm-gate/learning.json) и никогда не пишется в ваши YAML-правила; другая цель никогда не переиспользует разрешение. По умолчанию выключено.",
			"card.riskThreshold": "Подтверждений человека до автопропуска (1–10)",
			"notice.label": "Активность шлюза прав",
			"history.label": "Одобрения",
			"history.title": "Журнал одобрений прав",
			"history.subtitle": "Каждое решение шлюза в этом разговоре, новые сверху",
			"history.loading": "Загрузка…",
			"history.empty": "В этой сессии пока нет одобрений",
			"history.error": "Не удалось загрузить: ",
			"history.tag.auto": "Автопропуск",
			"history.tag.ask": "Спрошено",
			"history.tag.deny": "Отказано",
			"card.denylistRestore": "Вернуть предустановленный чёрный список",
			"card.denylist": "Чёрный список (ключевые слова deny, предустановка плагина)",
			"card.denylistHint": "Вызов, чей текст содержит ключевое слово (подстрока без учёта регистра), отклоняется сразу — до белого списка / выдач / LLM. Предустановка унаследована от dsh-approval-gate и активна с установки; правьте свободно — пустой или очищенный список возвращается к предустановке (есть восстановление в один клик), поэтому чёрный список никогда не выключается молча.",
			"card.denylistEmpty": "Чёрный список пуст (ни один вызов не отклоняется слоем ключевых слов)",
			"card.denylistPlaceholder": "Новое ключевое слово, напр. drop database",
			"card.denylistAdd": "Добавить",
			"card.denylistRemove": "Удалить это ключевое слово",
			"card.denylistTagPreset": "Предустановка",
			"card.denylistTagCustom": "Своё",
			"card.riskSediment": "riskSediment — осаждение обучения: образцы, достигшие порога, становятся детерминированными автопропусками",
			"card.riskSedimentHint": "При включении, когда ключ tool|category достигает порога, отпечатки его образцов оседают в правила пропуска — точное совпадение тот же инструмент/та же цель пропускает без нового вызова LLM (работает и при выключенном llmAssist).",
			"card.sediment": "Осадок обучения (детерминированные правила пропуска)",
			"card.sedimentHint": "Правила, осевшие из человеческих подтверждений: пропускает только точное совпадение отпечатка, другая цель — никогда. Можно завершить одно обучение или удалить один образец.",
			"card.sedimentEmpty": "Осевших правил пока нет (образцы, достигшие порога, появятся здесь)",
			"card.sedimentCount": "подтверждено %n/%t",
			"card.sedimentStop": "Завершить",
			"card.sedimentStopTitle": "Завершить это обучение (счётчик и образцы будут удалены)",
			"card.sedimentStopConfirm": "Завершить обучение для «%k»? Счётчик и все образцы будут удалены.",
			"card.sedimentSampleRemove": "Удалить этот осевший образец",
			"card.llmSource": "Источник принимающей LLM",
			"card.llmSourceCustom": "Свой API (совместимый с OpenAI)",
			"card.llmSourceHost": "Использовать текущую модель по умолчанию сессии (сервис llm DSH)",
			"card.llmSourceHostHint": "По умолчанию оценка одобрения идёт на группе моделей, которую сессия DSH использует сейчас (действующее значение показано ниже); оставьте Provider / Model пустыми, чтобы следовать за сессией, или выберите из списка либо введите своё — настроенные в DSH свои группы (напр. local-35b) появляются автоматически.",
			"card.llmProvider": "Provider (пусто = следовать выбору сессии)",
			"card.llmProviderPlaceholder": "Следовать выбору сессии",
			"card.llmModelHostPlaceholder": "Пусто = следовать выбору сессии",
			"card.llmResolved": "Действует сейчас: %p / %m",
			"card.llmPreset": "Предустановки endpoint (заполняют поля; можно править)",
			"card.llmPresetChoose": "Выбрать предустановку…",
			"card.llmPresetPublic": "Предустановки публичных API",
			"card.llmPresetHost": "Группы моделей DSH (выбор переключает на сессионный приёмник)",
			"card.networkEnabled": "Перехват сети (networkEnabled)",
			"card.networkEnabledHint": "При включении запускается локальный прокси, перехватывающий исходящие соединения подпроцессов и применяющий правила allow/deny. Выключено — поведение не меняется.",
			"card.watch": "Горячая перезагрузка правил (watch)",
			"card.watchHint": "При включении файлы правил отслеживаются автоматически, изменения применяются мгновенно, без ручной перезагрузки.",
			"card.networkRebindNote": "Вступает в силу сразу — прокси перепривязывается сам, перезагрузка плагина не нужна.",
			"card.networkInjectEnv": "Ввод переменных окружения прокси (networkInjectEnv)",
			"card.networkInjectEnvHint": "Записывает подпроцессам HTTP(S)_PROXY / ALL_PROXY (и очищает NO_PROXY). Выключено — слушатель работает, но окружение процессов не меняется.",
			"card.healthStale": "Маршрут хоста недоступен (404) — node-половина всё ещё старой сборки; полностью перезапустите dsh (а не только страницу браузера) и повторите.",
			"card.healthTest": "Проверка здоровья",
			"card.healthRunning": "Проверка…",
			"card.healthOk": "OK (%ms ms)",
			"card.healthFail": "Не удалось: ",
			"history.tag.learned": "Выучено",
			"history.tag.manualApproved": "Одобрено",
			"history.tag.manualRejected": "Отклонено",
			"history.tag.manualCancelled": "Отменено",
			"history.tag.standDown": "Шлюз отключён",
			"history.learnedProgress": "выучено %n/%t",
			"history.snapshots": "diff-снимки",
			"history.clearSession": "Очистить эту сессию",
			"history.clearAll": "Очистить всё",
			"history.clearSessionTitle": "Очистить diff-снимки только этой сессии (другие сессии не затронуты)",
			"history.clearAllTitle": "Очистить diff-снимки всех сессий, включая непросмотренные — потребуется повторное подтверждение",
			"history.clearSessionConfirm": "Очистить diff-снимки этой сессии? Удаляются только данные сравнения, порождённые одобрениями этой сессии; сами записи одобрений остаются.",
			"history.clearAllConfirm": "Очистить diff-снимки ВСЕХ сессий? Это может удалить сравнения, которые другие сессии ещё не просмотрели, и отменить это нельзя.",
			"history.diffTitle": "Сравнение изменений файлов",
			"history.diffClose": "Закрыть",
			"history.diffLoading": "Загрузка…",
			"history.diffEmpty": "Изменений содержимого нет (или файл не читается)",
			"history.diffLoadFail": "Не удалось загрузить diff: ",
			"history.diffRevert": "Отменить это изменение",
			"history.diffReverting": "Отправка…",
			"history.diffRevertDone": "Инструкция отмены отправлена",
			"history.diffRevertSent": "Инструкция отмены отправлена в разговор; ИИ восстановит файл по инструкции",
			"history.diffRevertFail": "Не удалось отправить: ",
			"history.diffNoSnapshot": "У этого события нет снимка для этого файла",
			"history.diffChipTitle": "Посмотреть сравнение изменений этого файла",
			"history.diffStats": "+%a / -%r строк изменено · %c без изменений",
			"history.diffGone": " (файла больше нет)",
			"history.diffHidden": "%n неизменённых строк",
			"card.dryRun": "Тест правил",
			"card.dryRunHint": "Оценивает один вызов по действующим правилам. Инструмент не запускает и правил не пишет — проверьте правило здесь, прежде чем менять.",
			"card.dryRunTool": "Инструмент",
			"card.dryRunCommand": "Команда / аргументы",
			"card.dryRunCommandPlaceholder": "git push --force origin main",
			"card.dryRunTest": "Тест",
			"card.dryRunRunning": "Оценка…",
			"card.dryRunEmpty": "Пока ничего не тестировалось. Введите инструмент и команду и нажмите «Тест», чтобы увидеть вердикт.",
			"card.dryRunVerdict": "Вердикт",
			"card.dryRunAllow": "пропустить",
			"card.dryRunAsk": "спросить",
			"card.dryRunDeny": "отказать",
			"card.dryRunRule": "Сработавшее правило",
			"card.dryRunRuleNone": "правило не сработало; defaultAction: %d",
			"card.dryRunDimensions": "Измерения",
			"card.dryRunReason": "Причина",
			"card.dryRunNote": "«Сработавшее правило» приходит из слоя правил. Если вердикт вынесен более ранним жёстким отказом или чёрным списком ключевых слов, номера правила нет — перечисленные измерения тогда носят справочный характер.",
			"card.dryRunNoRules": "(загружено 0 правил — проверьте путь rulesFile)",
			"card.dryRunFail": "Тест не удался: ",
			"card.dryRunStale": "маршрута нет (плагин не перезапущен?)",
			"card.rules": "Встроенные правила Settings",
			"card.rulesHint": "Правила, которые шлюз загружает прямо сейчас (из поля конфигурации `rules` этого плагина; без настройки берётся файл правил). Только чтение — здесь ничего не изменить. Меняйте правила через белый список ниже или на странице настроек.",
			"card.rulesRefresh": "Обновить",
			"card.rulesLoading": "Чтение…",
			"card.rulesPath": "Источник",
			"card.rulesNone": "правила не настроены",
			"card.rulesCounts": "Правил",
			"card.rulesDefault": "defaultAction",
			"card.rulesStats": "%b байт · %l строк",
			"card.rulesMissing": "Правила не найдены. Шлюз вернётся к встроенным значениям по умолчанию.",
			"card.rulesTruncated": "Правила велики; показаны первые 512 КБ.",
			"card.rulesError": "Не удалось загрузить: ",
			"card.rulesStale": "маршрута нет (плагин не перезапущен?)",
			"card.rulesNote": "Только чтение: эта панель не может менять правила. Секция белого списка и «всегда разрешать» записываются обратно в конфигурацию входа этого плагина."
		};
		/** Spanish dictionary (keys mirror zh). */
		const es = {
			"card.title": "自动审查 (Revisión automática)",
			"section.title": "Compuerta de revisión automática",
			"card.description": "Nivel de aprobación independiente, paralelo a read-only / full-access / whitelist, mostrado como 自动审查 en el selector de permisos de sesión. El frontal expone un único interruptor; las cuatro estrategias de aprobación del backend son combinables desde este panel y siguen siendo fail-closed frente al rechazo duro P0.",
			"card.permissive": "Activar el nivel 自动审查",
			"card.permissiveHint": "Apagada, la compuerta se comporta exactamente igual que antes.",
			"card.scopeNote": "Ámbito del preajuste: esta compuerta solo actúa cuando el preajuste de permisos de sesión es %scope. Con cualquier otro preajuste toda la compuerta se retira — rechazo duro P0 incluido — y toma el mando la política del preajuste elegido. Un retiro registra un evento y deja una franja permanente sobre el campo de entrada.",
			"card.strategies": "Estrategias de aprobación del backend (al menos una vigente; combinables)",
			"card.strategy.trustAutoAllow": "trustAutoAllow — las operaciones seguras dentro del ámbito se permiten automáticamente; las peligrosas/desconocidas preguntan (línea base del nivel intermedio)",
			"card.strategy.alwaysConfirm": "alwaysConfirm — cada paso pregunta; los «controles de permiso» del panel de aprobación ganan dos botones ampliados: «volver a permitir este tipo en esta sesión» (concesión limitada a la sesión) y «permitir cada aparición» (la palabra del comando se persiste en la whitelist del rulesFile)",
			"card.strategy.llmAssist": "llmAssist — un LLM personalizado gradúa el riesgo: safe se permite automáticamente; los riesgos duros deletion/credential/remote/system/bulk mantienen la confirmación humana (el clasificador nunca niega — solo escala); neutral entra en aprendizaje por confirmación; fallo/timeout vuelve al humano",
			"card.strategy.trustEscalation": "trustEscalation — ampliación de sandbox sin prompt: para una llamada que esta compuerta ya permitió, la ampliación de sandbox que una herramienta shell / pwsh / edit pide desde su interior se aprueba aquí en lugar de preguntarte",
			"card.strategy.trustEscalationHint": "Una petición de ampliación de sandbox se emite desde dentro del cuerpo de la herramienta, tras tools/pre-execute, así que la compuerta nunca la vio — una llamada que el LLM gradúo como safe y se permitió automáticamente igual te pedía aprobar la ampliación. Activada, solo la llamada exacta que la compuerta permitió (coincidencia exacta por callId) se salta el prompt; todo lo demás pasa por el humano como antes, igual que una razón no reconocida o un destino distinto de workspace-write / danger-full-access. Desactívala para dejar la ampliación bajo control humano.",
			"card.readonly": "Solo lectura",
			"card.unavailable": "Namespace de ajustes no disponible: asegúrate de que dsh-perm-gate está ensamblado en este perfil.",
			"card.llmReceiver": "LLM receptor de llmAssist (compatible con OpenAI; cualquier API propia)",
			"card.llmEndpoint": "Endpoint (BaseURL, p. ej. https://api.openai.com/v1)",
			"card.llmModel": "Model (id del modelo, p. ej. deepseek-chat)",
			"card.llmKey": "API Key (secreta)",
			"card.llmKeyHidden": "Sin definir · se muestra como * tras la primera entrada",
			"card.llmKeyMasked": "Definida · escribe un valor nuevo para sobrescribirla",
			"card.llmKeyOverwrite": "Hay un secreto guardado; escribe un valor nuevo y pierde el foco para sobrescribirlo.",
			"card.llmKeyClear": "Borrar",
			"card.allowlist": "Whitelist (allow, sincronizada con rulesFile)",
			"card.allowlistHint": "Los patrones de la sección allow permiten directamente; añade o elimina entradas una a una, se escriben en el rulesFile y se recargan en vivo.",
			"card.allowlistPresetNote": "El equivalente de la whitelist preajustada es la estrategia trustAutoAllow (operaciones seguras del ámbito se permiten automáticamente), activable en la sección de estrategias de arriba; esta lista refleja la sección allow de tu rulesFile y es normal que empiece vacía.",
			"card.allowlistEmpty": "Sin reglas de whitelist",
			"card.allowlistPlaceholder": "Nuevo patrón de comando, p. ej. npm test*",
			"card.allowlistAdd": "Añadir",
			"card.allowlistRemove": "Eliminar este patrón",
			"card.allowlistBulk": "Edición en bloque",
			"card.allowlistBulkHide": "Ocultar la edición en bloque",
			"card.allowlistSave": "Guardar la whitelist",
			"card.riskLearning": "riskLearning — aprendizaje de veredictos: las peticiones de riesgo neutral aprobadas y ejecutadas por el humano cuentan; la misma operación se auto-permite al umbral con huella coincidente",
			"card.riskLearningHint": "El estado de aprendizaje son datos del plugin ($DSH_HOME/perm-gate/learning.json) y nunca se escribe en tus reglas YAML; un destino distinto nunca reutiliza una autoridad. Desactivado por defecto.",
			"card.riskThreshold": "Confirmaciones humanas necesarias antes del permiso automático (1–10)",
			"notice.label": "Actividad de la compuerta de permisos",
			"history.label": "Aprobaciones",
			"history.title": "Registros de aprobación de permisos",
			"history.subtitle": "Cada decisión de la compuerta en esta conversación, la más reciente primero",
			"history.loading": "Cargando…",
			"history.empty": "Aún no hay aprobaciones en esta sesión",
			"history.error": "Error al cargar: ",
			"history.tag.auto": "Auto-permitido",
			"history.tag.ask": "Preguntado",
			"history.tag.deny": "Denegado",
			"card.denylistRestore": "Restaurar la blacklist preajustada",
			"card.denylist": "Blacklist (palabras clave deny, preajuste del plugin)",
			"card.denylistHint": "Una llamada cuyo texto contiene una palabra clave (subcadena sin distinguir mayúsculas) se deniega de plano, antes de whitelist / concesiones / LLM. La lista preajustada se hereda de dsh-approval-gate y está activa desde la instalación; edítala con libertad — vacía o vaciada vuelve al preajuste (restauración de un clic disponible), así la blacklist nunca se apaga en silencio.",
			"card.denylistEmpty": "Blacklist vacía (ninguna llamada es vetada por la capa de palabras clave)",
			"card.denylistPlaceholder": "Nueva palabra clave, p. ej. drop database",
			"card.denylistAdd": "Añadir",
			"card.denylistRemove": "Eliminar esta palabra clave",
			"card.denylistTagPreset": "Preajuste",
			"card.denylistTagCustom": "Personalizado",
			"card.riskSediment": "riskSediment — sedimentación del aprendizaje: las muestras que llegan al umbral se vuelven permisos deterministas",
			"card.riskSedimentHint": "Activada, cuando una clave tool|category alcanza el umbral las huellas de sus muestras se sedimentan en reglas de permiso — una coincidencia exacta misma herramienta/mismo destino permite sin otra llamada al LLM (sigue funcionando con llmAssist apagado).",
			"card.sediment": "Sedimento de aprendizaje (reglas de permiso deterministas)",
			"card.sedimentHint": "Reglas sedimentadas de confirmaciones humanas: solo una coincidencia exacta de huella permite, jamás un destino distinto. Puedes terminar un aprendizaje o eliminar una muestra.",
			"card.sedimentEmpty": "Aún no hay reglas sedimentadas (las muestras que llegan al umbral aparecen aquí)",
			"card.sedimentCount": "confirmadas %n/%t",
			"card.sedimentStop": "Terminar",
			"card.sedimentStopTitle": "Terminar este aprendizaje (borra el conteo y las muestras)",
			"card.sedimentStopConfirm": "¿Terminar el aprendizaje de «%k»? Se borrarán su conteo y todas sus muestras.",
			"card.sedimentSampleRemove": "Eliminar esta muestra sedimentada",
			"card.llmSource": "Fuente del receptor",
			"card.llmSourceCustom": "API propia (compatible con OpenAI)",
			"card.llmSourceHost": "Usar el modelo por defecto actual de la sesión (servicio llm de DSH)",
			"card.llmSourceHostHint": "Por defecto la graduación de aprobación corre sobre el grupo de modelos que la sesión DSH usa ahora (el valor efectivo se muestra abajo); deja Provider / Model vacíos para seguir la sesión, o elige del desplegable o escribe para fijar uno — tus grupos personalizados configurados en DSH (p. ej. local-35b) aparecen automáticamente.",
			"card.llmProvider": "Provider (vacío = seguir la selección de la sesión)",
			"card.llmProviderPlaceholder": "Seguir la selección de la sesión",
			"card.llmModelHostPlaceholder": "Vacío = seguir la selección de la sesión",
			"card.llmResolved": "Vigente ahora: %p / %m",
			"card.llmPreset": "Preajustes de endpoint (rellena los campos; sigue siendo editable)",
			"card.llmPresetChoose": "Elegir un preajuste…",
			"card.llmPresetPublic": "Preajustes de API públicas",
			"card.llmPresetHost": "Grupos de modelos DSH (seleccionar uno cambia al receptor de sesión)",
			"card.networkEnabled": "Intercepción de red (networkEnabled)",
			"card.networkEnabledHint": "Activada, arranca un proxy local que intercepta las conexiones salientes de los subprocesos y aplica reglas allow/deny. Apagada = cero cambio de comportamiento.",
			"card.watch": "Recarga en caliente de reglas (watch)",
			"card.watchHint": "Activada, vigila automáticamente los archivos de reglas y aplica los cambios al instante, sin recarga manual.",
			"card.networkRebindNote": "Surte efecto al instante — el proxy se reconecta solo, sin recargar el plugin.",
			"card.networkInjectEnv": "Inyectar variables de entorno del proxy (networkInjectEnv)",
			"card.networkInjectEnvHint": "Escribe HTTP(S)_PROXY / ALL_PROXY para los subprocesos (y limpia NO_PROXY). Apagada = el listener corre pero no cambia ningún entorno de proceso.",
			"card.healthStale": "Ruta del host no disponible (404) — la mitad node sigue siendo una build antigua; reinicia dsh por completo (no solo la página del navegador) y reintenta.",
			"card.healthTest": "Prueba de salud",
			"card.healthRunning": "Probando…",
			"card.healthOk": "OK (%ms ms)",
			"card.healthFail": "Falló: ",
			"history.tag.learned": "Aprendido",
			"history.tag.manualApproved": "Aprobado",
			"history.tag.manualRejected": "Rechazado",
			"history.tag.manualCancelled": "Cancelado",
			"history.tag.standDown": "Compuerta desactivada",
			"history.learnedProgress": "aprendido %n/%t",
			"history.snapshots": "instantáneas diff",
			"history.clearSession": "Vaciar esta sesión",
			"history.clearAll": "Vaciar todo",
			"history.clearSessionTitle": "Vaciar solo las instantáneas diff de esta sesión (las demás sesiones quedan intactas)",
			"history.clearAllTitle": "Vaciar las instantáneas diff de todas las sesiones, incluidas las nunca revisadas — pide una segunda confirmación",
			"history.clearSessionConfirm": "¿Vaciar las instantáneas diff de esta sesión? Solo se eliminan los datos de comparación producidos por las aprobaciones de esta sesión; los registros de aprobación quedan.",
			"history.clearAllConfirm": "¿Vaciar las instantáneas diff de TODAS las sesiones? Esto puede borrar comparaciones que otras sesiones aún no han visto, y no se puede deshacer.",
			"history.diffTitle": "Comparación de cambios de archivos",
			"history.diffClose": "Cerrar",
			"history.diffLoading": "Cargando…",
			"history.diffEmpty": "Sin cambios de contenido (o el archivo no se puede leer)",
			"history.diffLoadFail": "Error al cargar el diff: ",
			"history.diffRevert": "Deshacer este cambio",
			"history.diffReverting": "Enviando…",
			"history.diffRevertDone": "Instrucción de reversión enviada",
			"history.diffRevertSent": "Instrucción de reversión enviada a la conversación; la IA restaurará el archivo según la instrucción",
			"history.diffRevertFail": "Error al enviar: ",
			"history.diffNoSnapshot": "Este evento no tiene instantánea para ese archivo",
			"history.diffChipTitle": "Ver la comparación de cambios de este archivo",
			"history.diffStats": "+%a / -%r líneas cambiadas · %c sin cambios",
			"history.diffGone": " (el archivo ya no existe)",
			"history.diffHidden": "%n líneas sin modificar",
			"card.dryRun": "Prueba de reglas",
			"card.dryRunHint": "Juzga una llamada contra las reglas vigentes. No ejecuta ninguna herramienta ni escribe ninguna regla — comprueba una regla aquí antes de cambiarla.",
			"card.dryRunTool": "Herramienta",
			"card.dryRunCommand": "Comando / argumentos",
			"card.dryRunCommandPlaceholder": "git push --force origin main",
			"card.dryRunTest": "Probar",
			"card.dryRunRunning": "Juzgando…",
			"card.dryRunEmpty": "Nada probado todavía. Rellena herramienta y comando y pulsa Probar para ver cómo se juzgaría.",
			"card.dryRunVerdict": "Veredicto",
			"card.dryRunAllow": "permitir",
			"card.dryRunAsk": "preguntar",
			"card.dryRunDeny": "denegar",
			"card.dryRunRule": "Regla coincidente",
			"card.dryRunRuleNone": "ninguna regla coincidió; defaultAction: %d",
			"card.dryRunDimensions": "Dimensiones",
			"card.dryRunReason": "Motivo",
			"card.dryRunNote": "«Regla coincidente» viene de la capa de reglas. Cuando el veredicto lo produce un rechazo duro anterior o la blacklist de palabras clave no hay índice de regla — las dimensiones listadas son entonces solo orientativas.",
			"card.dryRunNoRules": "(0 reglas cargadas — revisa la ruta del rulesFile)",
			"card.dryRunFail": "La prueba falló: ",
			"card.dryRunStale": "ruta inexistente (¿plugin sin reiniciar?)",
			"card.rules": "Reglas integradas de Settings",
			"card.rulesHint": "Las reglas que la compuerta carga ahora mismo (del campo de configuración `rules` de la entrada de este plugin; sin configurar recurre al archivo de reglas). Solo lectura — aquí no se puede cambiar nada. Para cambiar reglas usa la whitelist de abajo o la página de ajustes.",
			"card.rulesRefresh": "Actualizar",
			"card.rulesLoading": "Leyendo…",
			"card.rulesPath": "Origen",
			"card.rulesNone": "sin reglas configuradas",
			"card.rulesCounts": "Reglas",
			"card.rulesDefault": "defaultAction",
			"card.rulesStats": "%b bytes · %l líneas",
			"card.rulesMissing": "Reglas no encontradas. La compuerta vuelve a sus valores integrados por defecto.",
			"card.rulesTruncated": "Reglas grandes; se muestran solo los primeros 512 KB.",
			"card.rulesError": "Error al cargar: ",
			"card.rulesStale": "ruta inexistente (¿plugin sin reiniciar?)",
			"card.rulesNote": "Solo lectura: este panel no puede modificar las reglas. La sección whitelist y «permitir siempre» se escriben de vuelta en la configuración de entrada de este plugin."
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
		//#region src/client/index.ts
		/** The profile entry id of this plugin — the `configForms` key (kept in lockstep with cordis.patch.yml). */
		const PERMISSIVE_NS = "dsh-perm-gate";
		/** Services required by the browser half. */
		const inject = [
			"slots",
			"locale",
			"configForms"
		];
		/**
		* Client plugin body: dictionaries plus the settings page registration.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const disposers = [
					ctx.locale.register(NS, {
						zh,
						en
					}),
					ctx.locale.register(NS, "fr", fr),
					ctx.locale.register(NS, "de", de),
					ctx.locale.register(NS, "it", it),
					ctx.locale.register(NS, "ru", ru),
					ctx.locale.register(NS, "es", es)
				];
				return () => disposers.forEach((dispose) => dispose());
			}, "dsh-perm-gate: dictionaries");
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
			ctx.slots.inject("settings.section", function* () {
				yield ctx.slots.register({
					name: "settings.section",
					id: PERMISSIVE_NS,
					order: 30,
					label: () => t("section.title"),
					locale: NS,
					inject: () => {
						return { scope: ctx.configForms.get(PERMISSIVE_NS) };
					}
				}, PermissiveCard);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map