/** `dsh-perm-gate` client dictionaries (zh / en / ja / ko). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-perm-gate'

/** The key union of this plugin's dictionary (source of truth: `zh`). */
export type PermissiveKey = keyof typeof zh

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'card.title': 'Permissive 审批档',
  'card.description': '独立审批模式档位：与只读 / 完全权限 / 白名单平行。前端只暴露一个开关；后台三个审批策略可组合、由此处设置决定，仍对 P0 硬拒绝保持 fail-closed。',
  'card.permissive': '启用 Permissive 档位',
  'card.permissiveHint': '关闭时门禁行为与此前完全一致。',
  'card.strategies': '后台审批策略（至少一个生效；可组合）',
  'card.strategy.trustAutoAllow': 'trustAutoAllow — 作用域内安全操作自动放行，危险/未知转 ask（中间档基线）',
  'card.strategy.alwaysConfirm': 'alwaysConfirm — 一律逐次 ask；审批面板「允许控件」含两个扩展按钮：「本会话重复允许该类」（会话语限次 grant）与「允许所有类型」（命令词持久迁入 rulesFile 白名单）',
  'card.strategy.llmAssist': 'llmAssist — 先由 LLM 分类裁决；ask/无分类器时回退人工',
  'card.readonly': '只读',
  'card.unavailable': '设置命名空间不可用：请确认 dsh-perm-gate 已装配进 profile。',
  'card.llmReceiver': 'llmAssist 接收 LLM（OpenAI 兼容，可用自定义 API）',
  'card.llmEndpoint': 'Endpoint（BaseURL，如 https://api.openai.com/v1）',
  'card.llmModel': 'Model（模型 id，如 deepseek-chat）',
  'card.llmKey': 'API Key（保密）',
  'card.llmKeyHidden': '未设置 · 首次输入后以 * 显示',
  'card.llmKeyMasked': '已设置 · 输入新值覆盖',
  'card.llmKeyOverwrite': '已设置保密值，输入新值并失焦即可覆盖。',
  'card.llmKeyClear': '清除',
  'card.allowlist': '白名单（allow，rulesFile 同步）',
  'card.allowlistHint': '一行一个命令模式，换行即一个元素；保存后写入 rulesFile 的 allow 段并重载（Ctrl/Cmd+Enter 保存）。',
  'card.allowlistSave': '保存白名单',
} satisfies Record<string, string>

/** English dictionary (keys mirror zh). */
export const en: Record<keyof typeof zh, string> = {
  'card.title': 'Permissive approval tier',
  'card.description': 'Independent approval mode tier, parallel to read-only / full-access / whitelist. The front-end exposes a single switch; the three backend approval strategies are combinable via this panel and still fail-closed against P0 hard-deny.',
  'card.permissive': 'Enable Permissive tier',
  'card.permissiveHint': 'When off, the gate behaves exactly as before.',
  'card.strategies': 'Backend approval strategies (at least one effective; combinable)',
  'card.strategy.trustAutoAllow': 'trustAutoAllow — safe in-scope ops auto-allow; dangerous/unknown ask (baseline middle tier)',
  'card.strategy.alwaysConfirm': 'alwaysConfirm — every crossing asks; the approval "allow controls" get two extended buttons: "repeat-allow this type this session" (bounded session grant) and "allow every occurrence" (persist the command word into the rulesFile whitelist)',
  'card.strategy.llmAssist': 'llmAssist — LLM classifies first; human fallback on ask/no classifier',
  'card.readonly': 'Read-only',
  'card.unavailable': 'Settings namespace unavailable: make sure dsh-perm-gate is assembled into this profile.',
  'card.llmReceiver': 'llmAssist receiving LLM (OpenAI-compatible; any custom API)',
  'card.llmEndpoint': 'Endpoint (BaseURL, e.g. https://api.openai.com/v1)',
  'card.llmModel': 'Model (model id, e.g. deepseek-chat)',
  'card.llmKey': 'API Key (secret)',
  'card.llmKeyHidden': 'Unset · shown as * after first entry',
  'card.llmKeyMasked': 'Set · type a new value to overwrite',
  'card.llmKeyOverwrite': 'A secret is stored; type a new value and blur to overwrite it.',
  'card.llmKeyClear': 'Clear',
  'card.allowlist': 'Whitelist (allow, synced to rulesFile)',
  'card.allowlistHint': 'One command pattern per line (a newline is one element). Saving writes the rulesFile allow section and reloads (Ctrl/Cmd+Enter to save).',
  'card.allowlistSave': 'Save whitelist',
}

/** Japanese dictionary (keys mirror zh). */
export const ja: Record<keyof typeof zh, string> = {
  'card.title': 'Permissive 承認ティア',
  'card.description': 'read-only / full-access / whitelist と並ぶ独立の承認モード。フロントは単一スイッチのみ。バックエンドの 3 つの承認戦略はこのパネルで組み合わせ可能で、P0 ハード拒否に対して依然 fail-closed。',
  'card.permissive': 'Permissive ティアを有効化',
  'card.permissiveHint': 'オフのときは以前と完全に同じ動作です。',
  'card.strategies': 'バックエンド承認戦略（少なくとも 1 つ有効、組み合わせ可）',
  'card.strategy.trustAutoAllow': 'trustAutoAllow — スコープ内の安全操作は自動許可、危険/不明は ask（中間ティアのベースライン）',
  'card.strategy.alwaysConfirm': 'alwaysConfirm — すべて ask。承認パネルの「許可コントロール」に2つの拡張ボタン：「このセッションで当該種別を繰り返し許可」（セッション限次 grant）と「すべての発生を許可」（コマンド語を rulesFile の許可リストへ永続化）',
  'card.strategy.llmAssist': 'llmAssist — まず LLM が分類、ask/分類器なしは人手にフォールバック',
  'card.readonly': '読み取り専用',
  'card.unavailable': '設定名前空間が利用できません：dsh-perm-gate がこの profile に組み込まれているか確認してください。',
  'card.llmReceiver': 'llmAssist 受信 LLM（OpenAI 互換、カスタム API 可）',
  'card.llmEndpoint': 'Endpoint（BaseURL、例：https://api.openai.com/v1）',
  'card.llmModel': 'Model（モデル id、例：deepseek-chat）',
  'card.llmKey': 'API Key（機密）',
  'card.llmKeyHidden': '未設定・初回入力後は * 表示',
  'card.llmKeyMasked': '設定済み・新しい値を入力すると上書き',
  'card.llmKeyOverwrite': '機密値が保存されています。新しい値を入力してフォーカスを外すと上書きします。',
  'card.llmKeyClear': 'クリア',
  'card.allowlist': '許可リスト（allow、rulesFile と同期）',
  'card.allowlistHint': '1 行に 1 コマンドパターン（改行 = 1 要素）。保存で rulesFile の allow に書き込み再読込（Ctrl/Cmd+Enter で保存）。',
  'card.allowlistSave': '許可リストを保存',
}

/** Korean dictionary (keys mirror zh). */
export const ko: Record<keyof typeof zh, string> = {
  'card.title': 'Permissive 승인 티어',
  'card.description': 'read-only / full-access / whitelist와 나란한 독립 승인 모드. 프론트는 단일 스위치만 노출. 백엔드의 세 가지 승인 전략은 이 패널에서 조합 가능하며 P0 하드 거부에 대해 여전히 fail-closed.',
  'card.permissive': 'Permissive 티어 활성화',
  'card.permissiveHint': '꺼져 있으면 이전과 완전히 동일하게 동작합니다.',
  'card.strategies': '백엔드 승인 전략(하나 이상 유효, 조합 가능)',
  'card.strategy.trustAutoAllow': 'trustAutoAllow — 범위 내 안전 작업은 자동 허용, 위험/미확인은 ask(중간 티어 기준)',
  'card.strategy.alwaysConfirm': 'alwaysConfirm — 모든 경계를 ask. 승인 패널의「허용 컨트롤」에 두 개의 확장 버튼:「이 세션에서 해당 유형 반복 허용」(세션 제한 grant) 과「모든 발생 허용」(명령어를 rulesFile 허용 목록에 영구 추가)',
  'card.strategy.llmAssist': 'llmAssist — 먼저 LLM이 분류, ask/분류기 없음은 사람에게 폴백',
  'card.readonly': '읽기 전용',
  'card.unavailable': '설정 네임스페이스를 사용할 수 없습니다: dsh-perm-gate가 이 profile에 조립되었는지 확인하세요.',
  'card.llmReceiver': 'llmAssist 수신 LLM (OpenAI 호환, 사용자 지정 API 가능)',
  'card.llmEndpoint': 'Endpoint (BaseURL, 예: https://api.openai.com/v1)',
  'card.llmModel': 'Model (모델 id, 예: deepseek-chat)',
  'card.llmKey': 'API Key (비밀)',
  'card.llmKeyHidden': '미설정 · 최초 입력 후 * 표시',
  'card.llmKeyMasked': '설정됨 · 새 값을 입력하면 덮어씀',
  'card.llmKeyOverwrite': '비밀 값이 저장되어 있습니다. 새 값을 입력하고 포커스를 벗어나면 덮어씁니다.',
  'card.llmKeyClear': '지우기',
  'card.allowlist': '허용 목록(allow, rulesFile과 동기화)',
  'card.allowlistHint': '한 줄에 명령 패턴 하나(줄바꿈 = 요소 하나). 저장하면 rulesFile의 allow에 기록 후 재로드(Ctrl/Cmd+Enter로 저장).',
  'card.allowlistSave': '허용 목록 저장',
}