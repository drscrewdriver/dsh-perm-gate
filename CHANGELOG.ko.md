# 변경 로그

이 프로젝트의 중요한 변경 사항은 모두 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

## [2.0.0] - 2026-09-11

### 수정

- **DSH 0.1.2에서 게이트가 모든 호출에서 대기 상태가 되어 「승인 기록」 페이지가 비어 있었습니다.** 세션의
  권한 preset fold가 로그를 `exec.agent.session.events`로 읽었습니다. DSH 0.1.1은 이 배열을
  노출했지만 0.1.2는 로그를 `Session.snapshotEvents()` / `ownEvents()` 뒤로 감추고 `events` 멤버를
  남기지 않아, 읽기가 `undefined`를 반환하고 `presetOf`도 `undefined`를 반환했으며
  `presetInScope(undefined, ['permissive'])` 때문에 `gateActive`가 **모든** 호출에서 false가
  되었습니다 —— 규칙 / grant / 거부 키워드 / 분류기 / P0 하드 거부 판정이 전혀 없고 감사 이벤트도
  기록되지 않았습니다(게이트 자체 티어를 선택한 세션에서도 마찬가지여서, 탭에는 실패가 아니라
  「이 세션에는 아직 승인 기록이 없습니다」가 표시되었습니다). fold는 알려진 모든 접근자 형태
  (`events` 배열, `snapshotEvents()`, `ownEvents()`)로 로그를 읽고, 호스트가 아무것도 노출하지
  않을 때만 "이벤트 없음"으로 축소됩니다. fold 캐시는 로그 길이와 마지막 이벤트의 동일성을 키로
  사용합니다(0.1.2 스냅샷은 동일한 동결 이벤트에 대한 매번 새로운 배열입니다).
  `test/preset-scope.spec.ts`가 두 형태를 고정합니다.

### 변경

- **`main` 라인의 버전 계열을 `2.x`로 바꿔 대응하는 DSH 라인을 나타냅니다.** `1.x`는 DSH
  `<= 0.1.1` 라인, `2.x`는 DSH `0.1.2+` 라인이라 플러그인 버전만 보고 어느 DSH용인지 알 수
  있습니다. `2.0.0`이 새 계열의 첫 릴리스이며 `0.2.x`(`0.2.0`, `0.2.1-beta.2`…`beta.5`)는
  이것으로 대체됩니다. 메이저가 서로를 차단하므로(`^1.0.0`은 `2.0.0`을, `^2.0.0`은 `1.0.0`을
  해석하지 않습니다) 기존 `^0.2.1-beta.4` 설치(역시 `2.0.0`을 해석하지 않습니다)는 명시적으로
  올려야 합니다. `engines.dsh`도 같은 경계를 적어 두지만(여기는
  `>=0.1.2-alpha.1 <0.2.0-0`, `legacy`는 `>=0.1.0-rc.7 <0.1.2-alpha.1`) DSH는 이를 읽지 않으므로
  구버전 DSH를 `1.x`에 묶어 두는 것은 버전 범위와 dist-tag입니다.
- **권한 티어의 표시 이름을 모든 화면에서 「自动审查」로 통일하고 아이콘을 제거했습니다.**
  `cordis.patch.yml`의 preset `name:`이 중국어 제품명이 되어 일반 설정 기본 행, 입력창 선택기,
  플러그인 설정 탭이 모두 같은 이름을 표시합니다. DSH 0.1.2는 플러그인 티어의 `name:`을 그대로
  렌더링하고 내장 세 값(`仅可查看` / `工作区内修改` / `完全权限`)만 지역화하므로, zh 세션이 보는 것은
  이 하나의 문자열입니다. 머신 값은 `permissive` 그대로입니다(`gatePresets`가 대조하는 값).
  권한 선택기의 아이콘 장식은 제거했습니다(`src/client/permission-icon.ts` 삭제): 은퇴한 `auto` 티어의
  방패 글리프에 맞추기 위한 것이었고, 0.1.2에서는 `aria-haspopup="menu"` 선택자를 통해 설정 행에도
  적용되었으며, 선택기의 글리프는 내장 값에만 연결되므로 플러그인 티어는 그리지 않습니다.

## [Unreleased]

### 추가

- Permissive 티어에 `trustEscalation` 전략 추가(티어 켜짐时 기본 켬): 게이트가 이미 허용한 호출의
  샌드박스 승격 승인을 여기서 `allowed-once`로 응답하여 프롬프트를 표시하지 않음. 승격은 shell / pwsh / edit
  도구 내부(`tools/pre-execute` 결착 후)에서 발생하므로 게이트의 allow는 여기에 닿지 않고,
  LLM이 `safe`로 판정한 호출조차 승격 확인을 요구했음. 게이트가 허용한 호출만
  (`callId` 및 툴 이름 일치) 프롬프트를 건너뛰고, `workspace-write` / `danger-full-access`를
  명시하는 알려진 승격 원인에만 적용. 나머지는 변경 없이 사람에게 위임. 자동 응답은 이벤트 피드에 기록
  (`verdict: "escalation-auto"`, `mode: <대상>`). 스위치를 끄면 승격은 사람 게이트화.

### 수정

- 설정 카드가 규칙 파일에서 편집 가능한 허용 목록을 시딩하도록 수정.
  `installSettingsSection`은 호스트 설정 스코프에서 `scope.set('allowlist', …)`를 호출했지만,
  호스트 스코프는 `get` / `watch` / `update` / `replace`만 제공 —
  `set(field, value)`는 *클라이언트*의 `mutate()`용 convenience 래퍼로 다른 객체이므로
  호출이 예외를 throw하고 네임스페이스가 시딩되지 않았음.
  이제 `scope.update({ allowlist: … })`를 사용.
- `approval/request` 리스너가 `prepend`로 등록되고 수동 옵서버에서 응답 게이트로 바뀌어,
  브라우저 프롬프트를 렌더링하는 원격 브리ჯ 앞에 위치하게 됨.
  그 브리ჯ 뒤에 리스너가 있으면 이미 표시된 프롬프트만 기록 가능했음.

## [0.2.1-beta.3] - 2026-09-10

### 추가

- 위험 등급 `llmAssist`: 설정된 사용자 지정 LLM(OpenAI 호환 엔드포인트)이 각 `ask`를
  `safe` / `risky:<카테고리>`로 판정합니다. 하드 카테고리(deletion / credential / remote / system /
  bulk)는 자동 거부되고, 시간 초과는 1회 재시도하며, 모든 실패는 fail-closed를 유지합니다.
- 판정 학습(`riskLearning`, 기본 꺼짐, `riskThreshold` 1–10, 기본 3): 사람이 승인하고 실제 실행된
  neutral 위험은 카운트되어 지문이 일치하는 동일 작업만 자동 허용 — `$DSH_HOME/perm-gate/learning.json`에
  영속화되며 사용자 YAML 규칙에는 기록되지 않습니다.
- 결정 이벤트 피드: 모든 결정이 `$DSH_HOME/perm-gate/events.jsonl`에 추가되고
  `GET /api/dsh-perm-gate/events?sessionId=&since=`로 제공되며, 브라우저 절반이 입력창 위 알림 바로 표시합니다.
- 권한 선택기 방패 아이콘이 축소된 트리거에도 표시됩니다.
- 승인 기록 페이지: 대화 보기에「승인 기록」탭이 추가되어 세션의 게이트 판정을 최신 순 타임라인으로
  표시합니다(종류 태그·위험 카테고리·시간 포함). 설정 카드의 허용 목록은 행별 삭제가 가능한 편집형
  목록 + 일괄 편집 토글로 바뀌었습니다.
- dsh-approval-gate에서 계승한 프리셋 거부 키워드(`DEFAULT_DENY_KEYWORDS`): 키워드 일치(대소문자 구분
  없는 부분 일치) 시 허용 목록/권한/LLM보다 먼저 거부. 설정 카드에서 목록으로 편집 가능하며 프리셋 태그와
  원클릭 복원을 지원하고, 미설정·빈 목록 시 프리셋이 적용됩니다(블랙리스트는 항상 활성).
- 학습 침전(`riskSediment`, 기본 켜짐): 임계값에 도달한 키의 확인 샘플이 결정론적 자동 허용 규칙이 됩니다——
  지문 정확 일치 시 LLM 호출을 건너뛰고 llmAssist가 꺼져도 유지됩니다. 설정 카드에 목록으로 표시되며 키
  종료·샘플 삭제가 가능합니다(`GET/POST /api/dsh-perm-gate/learning`).
- 선택 가능한 llmAssist 수신처: **사용자 지정 API**(OpenAI 호환, Xiaomi MiMo
  `https://api.xiaomimimo.com/v1` 포함 프리셋) 또는 **DSH 호스트 모델 그룹**(`llm` 서비스 +
  `agentDefaultModel.currentSelection`, provider/model 재정의 가능) — 그리고 **상태 테스트**
  버튼(`POST /api/dsh-perm-gate/health`)으로 최소 completion 응답과 지연 시간을 확인. 설정 카드는 `GET /api/dsh-perm-gate/receiver`를 통해
  라이브 프로바이더/모델 그룹 목록(호스트 `llm.listProviders`/`listModels`, 사용자 지정 그룹 포함)을
  읽어 현재 적용 선택을 표시합니다.
- **승인 기록 리뷰 화면**: 각 결정이 건드린 파일은 변경 전에 스냅샷되며(파일 ≤5개, 각 ≤256KB,
  `$DSH_HOME/perm-gate/snapshots/`), **승인 기록** 탭에서 파일 칩을 눌러 줄 단위 diff
  (`GET /api/dsh-perm-gate/diff`)를 열고 **되돌리기**(`POST /api/dsh-perm-gate/revert`)로 대화에
  복원 지시를 보낼 수 있습니다. 스냅샷 관리 바(`GET /api/dsh-perm-gate/snapshots-stats` /
  `POST /api/dsh-perm-gate/snapshots-clear`, 세션 단위 또는 전체)도 추가. 이벤트 행은 이제
  `files` / `justification` / `verdict` / `category`를 가집니다.
- **사람 승인 종결 기록**: 사람에게 넘긴 `ask`를 추적하고 수동적 `approval/request` 옵서버로
  실제 응답을 기록합니다 — `allowed-once` → 승인, `rejected` → 거부, `cancelled` → 취소,
  `unavailable` → 거부(승인 채널 없음). 옵서버가 연관시키지 못하는 경우(`callId` 누락,
  approval 서비스 없음, 상류 리스너의 단락) `tools/result`가 폴백으로 같은 ask를 정산합니다
  ("정산 시 삭제"가 유일한 중복 제거 규칙). 승인 시 승인 후 학습 진행률(`n`/임계값)을 표시하고,
  알림 바는 세 가지 종결 상태를 라벨로 보여줍니다.

### 제거

- 폐기된 **Auto** 권한 티어를 더 이상 `cordis.patch.yml`에 다시 기재하지 않습니다. DSH의 bundle
  patch는 `permission.config.presets` 맵 전체를 **교체**하므로 이 파일은 유지할 티어를 모두
  기재해야 했고, `dsh-auto-mode`가 제공한 `auto`도 포함되어 있었습니다. 해당 플러그인은
  제거되었고 노브는 `workspace-write`와 동일하며, 설명문의 "자동 검토 / 일회성 승인"은 구현과
  함께 사라졌고, 이 게이트는 그 티어에서 동작하지 않습니다(`gatePresets` 기본값은
  `['permissive']`). 피커는 내장 3개 티어(`read-only` / `workspace-write` / `danger-full-access`,
  `@deepseek-ai/dsh-base/cordis.patch.yml`에서 재기재)와 이 플러그인의 `permissive`만 제공합니다.
- `test/patch-presets.spec.ts`가 이 키 집합을 고정하므로 내장 티어가 빠지거나 폐기 티어가
  되살아나면 테스트가 실패합니다.

### 변경

- 게이트는 **`gatePresets`에 나열한 티어에서만 동작**합니다(기본 `['permissive']`,
  이 플러그인이 추가하는 티어). 그 밖의 티어(Read Only / Workspace Write / Auto / Full access /
  `custom`)에서는 판정 흐름이 전혀 실행되지 않습니다 — 허용·ask·거부·P0 하드 거부·거부 키워드
  차단·감사 이벤트 모두 해당하지 않습니다. `gatePresets: ['*']`는 게이트를 다시 전역(하드 거부
  포함)으로 적용합니다.
- `llmAssist`는 위험 카테고리 프로토콜을 사용합니다(기존 allow/deny/ask 판정의 상위 집합).
  `classifier.ts`는 위험 판정기와 OpenAI 호환 전송 계층(`chatCompletion`)을 공유합니다.
  하드 위험 카테고리(`deletion` / `credential` / `remote` / `system` / `bulk`)는 이제
  **자동 거부**됩니다(사람에게 전달하지 않음 — 명백히 위험한 작업에는 확인 불필요)；
  `risky:neutral`(불확실)만 사람에게 전달됩니다.
- `write` / `edit` 도구에 **경로 인식 기본값**이 추가되어, 워크스페이스 내 쓰기는 `defaultAction`
  (보통 `allow`)을 따르고, 워크스페이스 밖 쓰기는 콘텐츠 검토를 위해 `ask`로 승격됩니다.
  LLM 분류기가 안전한 콘텐츠를 자동 허용하고 유해한 콘텐츠를 자동 거부할 수 있으므로, 불확실한
  작업만 팝업이 발생합니다.

### 수정

- **`llmAssist`의 `safe`는 기록만 될 뿐 실제로 자동 허용되지 않았습니다.** `tools/pre-execute`
  리스너가 `ask`를 즉시 반환하고 백그라운드에서 판정했지만, 호스트로 넘어간 ask는 이미 승인
  answerer로 향하고 있고 DSH에는 이를 되돌릴 API가 없습니다(요청의 `signal`이 할 수 있는 일은
  `cancelled`로 종결시키는 것뿐입니다). 그래서 패널은 계속 표시되었고, 피드에는 `safe` 자동 허용이
  찍혔는데도 사람이 직접 클릭해야 했습니다 — 하드 위험의 `auto-deny`는 호스트에 아예 전달되지
  않았습니다. 이제 리스너는 결정을 반환하기 **전에** `refineAsk`를 await하며
  (`makePreExecuteListener`), `safe`는 `next()`로 위임되어 패널이 뜨지 않고, 하드 카테고리는 자동
  거부되며, `risky:neutral` / `unresolved` / 판정 실패만 사람에게 ask로 남습니다(fail-closed).
  대기 시간은 `riskTimeoutMs`(기본 20초)로 제한되며, 이미 취소된 호출은 판정을 건너뜁니다.
- **사용자가 선택한 권한 티어를 게이트가 덮어썼습니다.** 게이트는 독립 승인 티어를 가지지만
  *모든* 프리셋에서 동작했고, 모든 경계가 `ask`가 되어 DSH 승인 시임으로 전달되었으며,
  `danger-full-access`(`approval: never`)에서는 그 시임이 **어떤 answerer보다도 먼저**
  `rejected`를 반환했습니다 — 패널은 한 번도 표시되지 않았고 read 전용이 아닌 모든 호출이
  오해를 부르는 `the user rejected tool "..."`로 실패했습니다. 하드 거부와 거부 키워드 계층도
  티어를 무시했기에 `danger-full-access`("승인 프롬프트 없는 전체 접근")가 조용히 좁혀졌습니다.
  이제 게이트 전체가 `gatePresets`로 한정되며 범위 밖에서는 아무것도 하지 않고 기록도 남기지
  않습니다. 유효한 티어 안에서는 유효 승인 정책이 `never`이면 ask가 패스스루로 강등됩니다.
- **읽기 전용 검색과 세션 내 도구가 ask로 처리되었습니다.** `web_search` /
  `modlens_read_image`는 읽기 전용 질의이고 `todo_write` / `render_ui` / `validate_dsh_ui` /
  `ask_user_question` / `exit_plan_mode` / `ralph` / `workflow`는 세션 내 상태 또는 위임인데도
  자동 허용 분류에 없어 매번 `ask`(`no rule matched; default action` 팝업)가 발생했습니다.
  이들을 자동 허용에 추가하고, 서드파티 읽기 전용 도구를 위한 `autoAllowTools` 설정을
  신설했습니다. P0 하드 거부와 거부 키워드 계층이 먼저 실행되므로 이 목록이 권한을 넓히지
  않습니다.
- **`write`/`edit`이 워크스페이스 밖 경로로 조용히 쓰기 실행했습니다.** `~/.bashrc`나 다른
  드라이브의 파일에 `defaultAction`(보통 `allow`)이 적용되어 검토 없이 실행되었습니다. 규칙이
  일치하지 않을 때 `write`/`edit` 도구에 경로 인식 오버라이드가 적용되어, 워크스페이스 내 쓰기는
  `defaultAction`을 따르고 바깥 쓰기는 콘텐츠 검토를 위해 `ask`로 승격됩니다. 유해한 콘텐츠는
  거부되고, `llmAssist`가 켜져 있으면 정상적인 추가는 자동 허용됩니다. `deny` 규칙은 경로 범위와
  관계없이 우선하고, `allow` 규칙은 내부 경로를 허용할 수 있지만 외부 경로의 검토를 우회할 수
  없습니다.
- **P0 자격 증명 검출이 문서 본문까지 스캔했습니다.** 토큰·개인 키·`credentials.yaml`을 단지
  *언급*한 파일의 쓰기/편집까지 하드 거부되었습니다. 이제 동작 자체를 나타내는 인수
  (`command` / `file_path` 등)만 스캔하며, 거부 키워드 계층의 "파일 텍스트는 동작이 아니다"라는
  규칙과 일치합니다.
- **`$DSH_HOME/perm-gate/rules.yml`이 로드되지 않았습니다.** `rulesFile`에 기본값이 없어
  `config`를 생략한 프로필에서는 규칙 집합이 비고 `defaultAction: ask`가 되었으며, 사용자의
  `defaultAction: allow`와 `allow:` 규칙은 조용히 무시되었습니다. `rulesFile`은 이제
  `<dataDir>/rules.yml`을 기본값으로 하며 설정 카드의 허용 목록도 그곳에 기록됩니다.
- **`format`이 PowerShell의 `Format-Table`을 거부했습니다.** 하이픈은 명령 식별자의 단어
  경계가 아니므로 키워드 끝을 식별자 문자(`[A-Za-z0-9_-]`)로 판정하도록 바꿨습니다 —
  `format C: /q`는 계속 탐지되고 `Format-Table` / `mkfs.ext4`는 올바르게 처리됩니다.
- 거부 키워드 매칭이 긴 식별자 안에 단순히 포함된 키워드를 더 이상 거부하지 않으며,
  문서 본문 인수(`content` / `new_string` / `old_string` / `text` 등)는 아예 검사 대상에서
  제외됩니다 — 파일의 텍스트는 작업 자체가 아닙니다. 매칭은 이제 단어 경계를 인식하므로
  구두점으로 끝나는 키워드와 CJK 키워드도 계속 동작하고, 공백이 압축되어 여분의 공백이 있는
  명령도 탐지됩니다.

### Fixed

- **모든 읽기 쿼리에 수동 승인이 필요했습니다.** `read` / `read_image` / `grep` / `glob` / `ls` / `lsp`
  은 워크스페이스 내의 읽기 전용 작업으로, 변경을 가할 수 없습니다. 이들은 자동 허용되었습니다.

### Added
- **Permissive 모드(독립 승인 티어)** — read-only / workspace-write / full-access / whitelist와 나란한 독립 모드.
  단일 프론트 스위치(`permissive`) + 조합 가능한 백엔드 전략(`trustAutoAllow` / `alwaysConfirm` / `llmAssist`).
  P0 하드 거부는 단조 유지.
- 감사 소스에 `classifier` / `permissive` 추가. `llmAssist`용 주입 가능한 `classify` 훅(`ask`/미지정 시 fail-closed).
- CLI `--permissive` 플래그와 `--list`의 permissive 요약 추가.
- **브라우저 클라이언트** — `settings.plugins.tab` 페이지("Permissive 승인 티어")가
  설정 → 플러그인에 렌더링됩니다. 스위치 하나(`permissive`) + 백엔드
  `permissiveStrategies` 토글 세 개. host는 네임스페이스를 live로 읽으므로 재시작 없이
  다음 도구 호출부터 반영됩니다.
- **실제 llmAssist LLM** — 설정 가능한 OpenAI 호환 분류기(`classifierEndpoint` /
  `classifierModel`)가 `ask`를 자동 판정하고, 사람 승인 심으로 fail-closed 폴백합니다.
- **허용 목록 이전** — `approveAllowEverywhere`는 명령어를 규칙 파일의 `allow`에
  영속 기록하고 재로드하며, `approveRepeat`는 유계 세션 허용을 발행합니다. 둘 다
  always-confirm 패널의 확장 허용 버튼 두 개를 뒷받침합니다.
- **4개 언어 설치 안내** — `INSTALL.md` / `INSTALL.zh.md` / `INSTALL.ja.md` /
  `INSTALL.ko.md`(설치·업그레이드·분리 플러그인에서의 이전·검증·문제 해결).
  모든 README에 언어 전환 링크, `ja` / `ko` 호환성 안내(공식 DSH의 `LOCALE_IDS`는
  `["zh", "en"]`), 버전 표기를 추가.
- README.ko / README.ja를 영어 정본과 동등한 수준으로 확장(P0–P4 체인 표, 배경/기능,
  규칙 파일 형식, Permissive 티어, CLI).

## [0.1.0] - 2026-08-30

### Added
- P0–P4 결정 체인: 하드 거부 / 세션 허용 / 정적 거부 우선 규칙 체인 / 선택적 분류기(기본 꺼짐) / `ask`.
- 순수 함수 규칙 엔진: glob/regex 컴파일 + ReDoS 상한, 오류 시 loud-fail, 콘텐츠 해시 컴파일 캐시.
- argv 분해 기반 명령 화이트/블랙리스트(`sh -c`/`bash -c` 재귀, 파이프라인, 리다이렉트, 재귀/강제).
- 정규화된 지문으로 정밀한 세션 허용(TTL + maxUses, 대상이 다르면 재사용 불가).
- `{ignorable:true}` 결정 감사와 모델 가시⟺기록 불변식.
- 독립 실행 dry-run CLI 평가기(`dsh-perm-gate --rules … --tool … --args …`).
- DSH cordis 함수 플러그인 계약(`cordis.patch.yml`, Schemastery `Config`, exports/types).
- 4개 언어 README(en/zh/ja/ko) 및 Keep-a-Changelog 프레임워크(en + ja + ko).