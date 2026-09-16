window.__ModuleLoader__.load({
	id: "dsh-perm-gate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/** `dsh-perm-gate` client dictionaries (zh / en / ja / ko). */
		/** Dictionary namespace owned by this plugin. */
		const NS = "dsh-perm-gate";
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"card.title": "自动审查",
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
			"history.diffHidden": "%n 行未修改"
		};
		/** English dictionary (keys mirror zh). */
		const en = {
			"card.title": "自动审查 (Auto review)",
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
			"history.diffHidden": "%n unmodified lines"
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
		const POLL_MS$2 = 5e3;
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
			(0, react.useEffect)(() => {
				let alive = true;
				const load = () => {
					fetch("/api/dsh-perm-gate/learning", { headers: { "cache-control": "no-cache" } }).then((r) => r.ok ? r.json() : Promise.reject(/* @__PURE__ */ new Error(`HTTP ${r.status}`))).then((data) => {
						if (alive) setBody(data);
					}).catch(() => {
						if (alive) setBody({});
					});
				};
				load();
				const timer = setInterval(load, POLL_MS$2);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);
			const post = (payload) => {
				fetch("/api/dsh-perm-gate/learning", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
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
		* Permissive settings card — the `settings.plugin.item` face of dsh-perm-gate.
		*
		* The card binds the `dsh-perm-gate` settings namespace through the
		* `settingsScope` cordis service and renders its fields: the single front switch
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
		* a header (name + description + chevron) toggling the body, collapsed by
		* default so the plugin tab stays a tidy list of drawers.
		*/
		function PermissiveCard({ t, scope }) {
			const [open, setOpen] = (0, react.useState)(false);
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
		* Polls the host's `GET /api/dsh-perm-gate/events?sessionId=&since=` feed every
		* 2 s and shows the latest decision above the conversation input: auto-allows
		* (green) and denies (red) auto-dismiss after a few seconds; an ask (amber)
		* stays until the next event because it needs the human's attention.
		*
		* Everything is best-effort: no session id, a missing route, or any fetch
		* failure simply means "render nothing". No @deepseek-ai value imports.
		*/
		const POLL_MS$1 = 2e3;
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
				let timer = null;
				const startPolling = () => {
					if (!alive) return;
					timer = setInterval(() => {
						fetchEvents(sessionId, sinceRef.current).then((events) => {
							if (!alive || events.length === 0) return;
							const last = events[events.length - 1];
							if (last === void 0 || last.id <= shownIdRef.current) return;
							shownIdRef.current = last.id;
							sinceRef.current = last.id;
							setNotice(last);
							if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
							if (!presentation(last.kind).sticky) hideTimerRef.current = setTimeout(() => {
								setNotice(null);
							}, AUTO_HIDE_MS);
						}).catch(() => {});
					}, POLL_MS$1);
				};
				fetchEvents(sessionId, 0).then((events) => {
					if (!alive) return;
					if (events.length > 0) {
						sinceRef.current = events[events.length - 1]?.id ?? 0;
						shownIdRef.current = sinceRef.current;
					}
					startPolling();
				}).catch(startPolling);
				return () => {
					alive = false;
					if (timer !== null) clearInterval(timer);
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
		* conversation, newest first, refreshed by polling.
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
		const POLL_MS = 5e3;
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
				let alive = true;
				const load = () => {
					fetchSnapshotStats(sessionId).then((next) => {
						if (alive) setStats(next);
					});
					if (sessionId === null) {
						setEvents([]);
						return;
					}
					fetchEvents(sessionId, 0).then((loaded) => {
						if (!alive) return;
						setEvents([...loaded].sort((a, b) => b.id - a.id));
						setError(null);
					}).catch((e) => {
						if (!alive) return;
						setError(String(e?.message ?? e));
					});
				};
				load();
				const timer = setInterval(load, POLL_MS);
				return () => {
					alive = false;
					clearInterval(timer);
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
		/** The settings namespace the host half registers (kept in lockstep with src/index.ts). */
		const PERMISSIVE_NS = "dsh-perm-gate";
		/** Services required by the browser half. */
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		/**
		* Client plugin body: dictionaries plus the settings page registration.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-perm-gate: dictionaries");
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
			ctx.slots.inject("settings.plugins.tab", function* () {
				yield ctx.slots.register({
					name: "settings.plugins.tab",
					id: PERMISSIVE_NS,
					order: 50,
					label: () => t("card.title"),
					locale: NS,
					inject: () => {
						return { scope: ctx.settingsScope.bind({ namespace: PERMISSIVE_NS }) };
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