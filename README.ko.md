# dsh-perm-gate

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [Installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [日本語インストールガイド](./INSTALL.ja.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

> **호환성 안내:** v2.0.0은 `ja` / `ko` 사전을 포함하지만, 공식 DSH의 `LocaleRuntime`은
> `zh` / `en`만 노출합니다(`LOCALE_IDS = ["zh", "en"]`). 기본 DSH에서 `ja` / `ko`를
> 선택하면 `locale "<id>" is not registered` 오류가 발생합니다. `LOCALE_IDS`
> (locale-settings.ts)와 `LOCALES` 라벨(client/index.ts)을 갱신한 DSH fork를 사용해
> 다시 빌드하세요.

> **▼ DSH 버전 호환성**
>
> 두 DSH 라인 각각이 장기 유지되는 두 브랜치를 통해 제공되며, 각자 고유한
> 버전 시리즈, `engines.dsh`, npm dist-tag 을 가집니다
> ([릴아웃](./RELEASING.md)):
>
> | DSH 버전 | 브랜치 | 버전 | npm 태그 |
> | --- | --- | --- | --- |
> | 0.1.0-rc.7 ~ 0.1.1-rc.x | `legacy` | `1.x` | `@legacy` |
> | 0.1.2-alpha.1+ (0.1.5-rc.2 포함) | `main` | `2.x` | `@latest` / `@dsh-0.1.2` (`@2.x`는 범위) |
>
> 버전 계열은 **DSH 라인**을 따릅니다(`1.x` = DSH ≤ 0.1.1, `2.x` = DSH 0.1.2+). 메이저
> 버전이 서로를 차단하므로 `^1.x` 설치가 `2.x`를 해석하는 일은 없고 그 반대도
> 마찬가지입니다. `engines.dsh`도 같은 경계를 적어 두지만 DSH는 이를 읽지 않으므로,
> 구버전 DSH를 `1.x`에 묶어 두는 것은 버전 범위와 dist-tag입니다.
>
> `@deepseek-ai/dsh-client-runtime`은 `0.1.2-alpha.1`에서 **제거**되었습니다 —
> 단순히 이동한 것이 아닙니다. `legacy` 라인은 여전히 이를 통해 `ctx.slots`에
> 접근합니다. `main`은 `@deepseek-ai/dsh-client-ui-renderer/client`에서 같은
> 선언을 가져옵니다. 두 버전 민감 시ーム은 버전 체크 대신 기능 프로브로 처리합니다:
> (1) 설정 등록은 `register`를 사용하며, 두 라인 모두에 존재합니다
> (`installSection`은 대체가 아닌 추가 사항); (2) `effectivePolicy`는 두 라인
> 모두에서 user-approval 서비스의 **개인** 메소드이므로 `typeof` 프로브를 통해
> 읽으며, 누락되거나 예외 발생 시 "정책_unknown"으로 후퇴합니다.

버전 **2.0.0** — 변경 내역은 [한국어 changelog](./CHANGELOG.ko.md)를 참고하세요.

DeepSeek Harness용 단일·자족적·결정론 우선·fail-closed 권한 게이트입니다.

도구 호출마다 고정된 우선순위 체인으로 판정합니다:

| 단계 | 판정 | 내용 |
| ---- | ---- | ---- |
| **P0** | `deny` | 결정론적 하드 거부: 자격 증명 material / 보호 경로 변경 / 위험한 shell |
| **P1** | `allow` | 정밀하고 유계인 **세션 허용** grant |
| **P2** | `deny/allow/ask` | 정적 규칙 체인: 블랙리스트 → allow → ask 순서 |
| **P3** | `allow/deny/ask` | 선택적 LLM 의미 분류기(기본 **꺼짐**) |
| **P4** | `ask` | 공식 approval seam |

엄격하게 fail-closed입니다: P0 판정은 grant·규칙·분류기·사람 누구에게도
덮어써지지 않습니다.

## 배경

DSH 안전 생태계에서는 이 역할이 `dsh-permission-rules` / `dsh-auto-mode` /
`dsh-auto-review` / `dsh-movein-permissions` 등 여러 플러그인에 흩어져 있습니다.
`dsh-perm-gate`는 게이트·승인·선택적 분류기를 하나의 패키지로 합쳐 감사 로그를
단일화하고 플러그인 간 버전 결합을 없앱니다.

## 주요 기능

- **명령 화이트/블랙리스트** — 원시 문자열이 아니라 **argv 분해**로 매칭
  (`sh -c`/`bash -c` 재귀 하강, 파이프라인 감지, 리다이렉트 대상 검사,
  재귀/강제(`rm -rf`) 인식).
- **거부 우선** — 거부 규칙은 어떤 allow 규칙보다 우선합니다.
- **세션 허용** — `(도구, 정규화 지문)` 단위의 정밀 허용(TTL + maxUses. 대상이
  달라지면 권한을 재사용하지 않습니다. 서브 에이전트는 상속할 수 있지만 스스로
  발행할 수 없습니다).
- **순수 함수 규칙 엔진** — glob/regex 컴파일 + ReDoS 상한, 잘못된 규칙은 loud fail,
  소스 콘텐츠 해시 기반 컴파일 캐시.
- **감사** — 모든 판정을 `callId`와 함께 `{ignorable:true}` 이벤트로 기록합니다.
  모델에 보이는 이유와 기록된 결과는 항상 일치합니다.
- **自动审查 티어**(`permissive`) — read-only / full-access / whitelist와 구별되는 **독립 승인
  모드**. 범용 "자동 승인"도 아니고 포괄적 권한 부여도 아닙니다. 프론트는 **단일 스위치**
  (`permissive`)만 노출하고, 백엔드의 네 가지 전략은 **조합 가능**하며 플러그인
  설정으로 제어됩니다. P0에 대해서는 여전히 fail-closed입니다.
  권한 선택기와 설정 행 모두 제품명 「自动审查」로 표시하며 아이콘은 그리지 않습니다.
- **샌드박스 승격 자동 응답** (`trustEscalation`) — 샌드박스 승격은 shell / pwsh /
   edit 도구의 **내부**(`tools/pre-execute` 이후)에서 발생하므로 게이트가 이를 볼 수
   없고, 게이트가 자동 허용한 호출에도 확인 프롬프트가 나타납니다. 이 전략을 켜면 게이트가
   `callId`로 이미 허용한 호출을 정확히 매칭하여 여기서 직접 응답합니다.

## 설치

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)가 설치되어 있어야
합니다.

```sh
dsh plugin --profile web add dsh-perm-gate
```

설치·업그레이드·이전·문제 해결의 전체 절차는
[한국어 설치 안내](./INSTALL.ko.md)([English](./INSTALL.md) /
[中文](./INSTALL.zh.md) / [日本語](./INSTALL.ja.md))에 있습니다.

## 설정

`cordis.yml`에 추가합니다:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # 선택. 기본값은 $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # 보호 대상 검사의 고정 루트
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # 게이트가 활성화되는 티어(기본)
```

### 규칙 파일

```yaml
permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive]
      reason: no recursive rm
    - paths: [.dsh/**]
      reason: protect harness metadata
  allow:
    - command: [pnpm, node]
      reason: dev tools
    - command: [curl, wget]
      args: ["https://*.example.com/*"]
      reason: allowed endpoint
  ask:
    - command: [bash, sh]
      reason: ask shells
```

명령 항목의 `word#flag`는 명령어 `word`에 수식어 `recursive` 또는 `force`를 붙여
매칭합니다. 즉 `rm#recursive`는 `rm -rf`, `env rm -rf`, `sh -c "rm -rf /"`에
일치합니다.

전체 예시: [examples/permissions.example.yaml](./examples/permissions.example.yaml)

## 自动审查 티어(머신 값 `permissive`)

自动审查는 권한 선택기에서 읽기 전용 / 워크스페이스 내 수정 / 완전 권한 / 허용 목록과
나란한 **독립 승인 티어**입니다. 범용 "자동 승인"이 아니며 포괄적 권한을 발행하지도 않습니다.
사람/LLM 심 **이전에** 판정을 좁히거나 넓힐 뿐이고, P0 하드 거부는 단조롭고 협상
불가능하게 유지됩니다.

선택기의 표시 이름은 **호스트가 공급하는 제품명**이며 언어별 사전 항목이 아닙니다. DSH 0.1.2는
플러그인 티어의 `name:`을 두 권한 화면(일반 설정 기본 행과 입력창 선택기)에 그대로 렌더링하고
자체 지역화 라벨은 세 가지 내장 값에만 부여하므로, `cordis.patch.yml`이 모든 세션에 중국어
라벨을 배포합니다. 이 티어는 **아이콘을 그리지 않습니다** —— 선택기의 글리프는 내장 값에만
연결됩니다.

`cordis.yml`에서:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml
    defaultAction: ask
    permissive: true            # 프론트의 유일한 스위치(독립 티어 켜기)
    permissiveStrategies:        # 백엔드 전략, 조합 가능
      trustAutoAllow: true       # 범위 내 안전 작업 자동 허용, 위험/미확인은 ask
      alwaysConfirm: false       # 매번 ask. 허용 컨트롤에 확장 버튼 2개
      trustEscalation: true      # 게이트가 허용한 호출 자체의 샌드박스 승격은 확인 불필요
      llmAssist: false           # 먼저 LLM이 분류, ask/실패 시 사람에게
```

`trustAutoAllow`은 중간 티어의 기준선입니다(rule-allow는 자동 통과). `alwaysConfirm`은
모든 경계에서 승인 패널을 띄우며, 그「허용 컨트롤」에 두 개의 확장 버튼을 추가합니다 —
**이 세션에서 해당 유형 반복 허용**(`approveRepeat`, 유계 세션 허용)과 **모든 발생
허용**(`approveAllowEverywhere`, 명령어를 `permissions.yaml`의 allow 허용 목록에
영속 기록 후 재로드). `llmAssist`는 설정된 실제 LLM(수신처는 설정 카드에서 선택: **사용자 지정 API**(`classifierEndpoint` /
`classifierModel`, OpenAI 호환 API면 무엇이든 가능, Xiaomi MiMo `https://api.xiaomimimo.com/v1` 등
프리셋 포함) 또는 **호스트 모델 그룹**(DSH의 `llm` 서비스와 현재 모델 그룹, `classifierProvider` /
`classifierModel`로 재정의 가능). **상태 테스트** 버튼으로 수신 LLM의 연결과 지연 시간을 확인할 수 있음)에 `ask` 자동 판정을 맡기고,
`ask`/오류 시 사람의 승인 심으로 폴백합니다 — 항상 fail-closed입니다.
`trustEscalation`（티어 켜짐时 기본 켬）은 게이트가 이미 허용한 호출 내부에서
`sandbox_permissions` 승격이 발생할 때 여기서 응답합니다. 아래 참조.
`permissive`가 꺼져 있으면 게이트는 이전과 완전히 동일하게 동작합니다.

### 샌드박스 승격: 왜 `safe` 판정에도 프롬프트가 떴나

툴 호출은 **두 개의 독립된 승인**을 일으킬 수 있습니다. 게이트가 맡는 것이 첫 번째 —
`tools/pre-execute` 워터폴의 `ask`입니다. 두 번째는 툴 내부의 `approveEscalation`,
`tools/execute` 시점, 모델이 `sandbox_permissions` + `justification`을 건넸을 때
발생 — 이미 `tools/pre-execute`는 끝났으므로 게이트의 allow는 여기에 닿지 않습니다.
LLM이 `safe`로 판정하고 게이트가 자동 허용한 호출조차 샌드박스 확장을 승인하라는
프롬프트가 떴습니다.

`trustEscalation`은 이 간극을 메웁니다. 게이트가 정面向上 허용한 호출(호스트의
`callId`로 키화, 승격 요청이 이를 반복)을 기억하고 승격을 여기서 `allowed-once`로
자응답합니다. **모든 조건이 충족될 때만** 적용됩니다:

- 自动审查 티어가 켜져 있고 `trustEscalation`이 켜져 있음;
- 호출에 게이트가 허용한 `callId`가 있고, 툴 이름이 일치;
- 원인이 알려진 승격이며 `workspace-write` 또는 `danger-full-access`를 명시.

그 외의 모든 경우 — 알려지지 않은 원인, 다른 호출, 게이트가 ask/deny한 호출, `approval:
never` 패스스루 — 는 사람에 그대로 위임되므로 향후 DSH 변경이 open이 아닌 closed로
실패합니다. 자동 응답은 이벤트 피드에 기록됩니다
(`verdict: "escalation-auto"`, `mode: <대상>`). 스위치를 끄면 샌드박스 확장은
사람 게이트로 유지되고 다른 허용은 자동 상태를 유지합니다.

### 선택 가능한 세션 티어

`cordis.patch.yml`은 DSH의 `permission.config.presets`에 워크스페이스 내 수정과
완전 권한 사이의 `permissive` preset(`sandbox: workspace-write`, `approval: ask`,
이름 **自动审查**)을 추가합니다. DSH의 bundle patch는 이 map을 **전체 교체**하므로
(키 단위 병합이 아닙니다) 내장 3개 티어
(`read-only` / `workspace-write` / `danger-full-access`,
`@deepseek-ai/dsh-base/cordis.patch.yml` 기준)도 다시 기재해야 하며,
`test/patch-presets.spec.ts`가 그 키 집합을 고정합니다. 따라서 세션 권한
선택기에는 "auto-approval"이 아니라 **독립적으로 선택 가능한 승인 티어**인
「自动审查」가 놓입니다.

게이트가 동작하는 범위는 **`gatePresets`에 나열한 티어 안뿐**입니다(기본 `['permissive']`,
이 플러그인이 추가하는 티어). 그 밖의 티어(Read Only / Workspace Write / Full access /
`custom`)에서는 게이트의 판정 흐름이 **전혀 실행되지 않습니다** — 허용도, ask도, 거부도,
P0 하드 거부도, 거부 키워드 차단도, 감사 이벤트 기록도 하지 않습니다. 선택한 티어의 자체 정책이
호출을 결정합니다. `danger-full-access`의 정의는 "승인 프롬프트 없는 전체 접근"이며, 이를 ask로
덮어써도 의미가 없습니다(그 정책에서는 DSH 승인 시임이 **어떤 answerer보다도 먼저** `rejected`를
반환해 전달된 ask는 패널을 한 번도 띄우지 못하고 `the user rejected tool "..."`만 남습니다).
하드 거부로 덮어쓰는 것 역시 사용자가 고른 티어를 조용히 뒤집는 일입니다.
`gatePresets: ['*']`는 게이트를 다시 전역(하드 거부 포함)으로 적용합니다. 유효한 티어 안에서는
세션의 유효 승인 정책이 `never`이면 ask가 패스스루로 강등됩니다.

### UI에서 설정 가능

이 티어는 실행 중에도 **설정 → 플러그인 → Permissive 승인 티어**에서 조정할 수 있습니다
(플러그인 브라우저 절반이 렌더링하는 `settings.plugins.tab` 페이지). 스위치 하나가
`permissive`를 토글하고, 네 개가 백엔드 `permissiveStrategies`를 편집합니다.
host는 네임스페이스를 live로 읽으므로 변경은 재시작 없이 다음 도구 호출부터 적용됩니다.
이것은 독립적인 승인 클래스이며 DSH의 "auto-approval" 모드가 **아닙니다**.

### 위험 등급 llmAssist, 판정 학습, 이벤트 피드

`llmAssist`가 켜져 있으면 설정된 LLM(OpenAI 호환 엔드포인트라면 무엇이든 — `classifierEndpoint` / `classifierModel` / `classifierApiKey`을 자신의 API로 지정)이 구조화된 프로토콜로 `ask`를 하나씩 판정합니다. **판정은 게이트의 `tools/pre-execute` 워터폴 안에서, 결정이 호스트로 반환되기 전에 이루어집니다**: `safe`는 곧바로 위임되므로 승인 패널이 아예 표시되지 않고, 정말로 판단할 수 없는 판정만 사람에게 전달됩니다.

- `safe` → 자동 허용(감사 소스 `classifier`), 패널 없음.
- `risky` + **하드 위험 카테고리**(`deletion`, `credential`, `remote`, `system`, `bulk`) → **자동 거부**, 패널 없음. 하드 위험은 자동 허용도 학습도 되지 않습니다.
- `risky:neutral` → `riskLearning` 활성 시(설정 카드, 기본 꺼짐), 사람이 승인하고 실제 실행된 neutral 위험은 `tool|카테고리` 키로 카운트되며, `riskThreshold`(기본 3) 도달 및 새 호출의 작업 지문(명령어 단어 + 대상 기본 이름)이 확인된 샘플과 일치하면 **동일 작업만** 자동 허용됩니다. 학습 침전(`riskSediment`, 기본 켜짐)을 사용하면 임계값에 도달한 키의 확인 샘플이 **결정론적 허용 규칙**이 됩니다: 지문이 정확히 일치하면 LLM 호출 없이 바로 허용——llmAssist가 꺼져도 유지되며, 침전 규칙은 설정 카드에서 확인·관리(종료 / 샘플 삭제)할 수 있습니다.
- 시간 초과(`riskTimeoutMs`, 기본 20초, 1회 재시도), 전송 실패, 프로토콜 외 출력은 원래 `ask`를 유지합니다.

학습 상태는 플러그인 소유 JSON(`$DSH_HOME/perm-gate/learning.json` 또는 `learningFile`)에 영속화되며 YAML 규칙 파일에는 기록되지 않습니다. 모든 결정은 `$DSH_HOME/perm-gate/events.jsonl`(또는 `eventsFile`)에 추가되고 `GET /api/dsh-perm-gate/events?sessionId=&since=`로 제공됩니다. 브라우저 절반이 이를 폴링하여 입력창 위에 최신 결정을 알림 바로 표시하고, 대화 보기의「승인 기록」탭에 세션의 모든 판정을 최신 순으로 나열합니다.

각 결정이 건드린 파일은 변경 전에(이벤트당 ≤5개 파일, 각 ≤256KB) `$DSH_HOME/perm-gate/snapshots/`에 스냅샷됩니다. 「승인 기록」탭에서는 각 파일 칩을 눌러 줄 단위 diff(`GET /api/dsh-perm-gate/diff`)를 열고, **되돌리기**(`POST /api/dsh-perm-gate/revert`)로 대화에 복원 지시를 보낼 수 있습니다. 스냅샷 관리 바는 세션 단위 또는 전체로 삭제할 수 있습니다(`GET /api/dsh-perm-gate/snapshots-stats` / `POST /api/dsh-perm-gate/snapshots-clear`).

사람에게 넘긴 `ask`는 응답이 올 때까지 추적됩니다. 수동적 `approval/request` 옵서버가 닫힌 결과를 기록하며(`allowed-once` → **승인**, `rejected` → **거부**, `cancelled` → **취소**, `unavailable` → 거부=승인 채널 없음), 옵서버가 연관시키지 못하는 경우(`callId` 누락, approval 서비스 없음, 상류 리스너의 단락) `tools/result`가 같은 ask를 폴백으로 정산합니다. 승인 시 승인 후 학습 진행률(`n`/임계값)을 표시하고, 알림 바도 세 가지 종결 상태에 라벨을 붙입니다.

또한 프리셋 **거부 키워드 블랙리스트**(dsh-approval-gate의 `DEFAULT_DENY_KEYWORDS` 계승: `rm -rf`,
`push --force`, `drop table`, `mkfs`, `git reset --hard`, `docker system prune` 등)를 갖추어, 텍스트가
키워드를 포함하는 호출(대소문자 구분 없는 부분 일치)은 허용 목록/권한/LLM보다 먼저 거부됩니다. 설정
카드에서 목록으로 편집할 수 있고(프리셋 항목에는 태그 표시, 원클릭 복원 지원) 미설정·빈 목록 시 프리셋이
적용됩니다——블랙리스트가 조용히 꺼지지 않습니다.
블랙리스트가 조용히 꺼지는 일은 없습니다.
이 티어는 권한 선택기에 **아이콘을 표시하지 않습니다** —— 선택기의 글리프는 내장 세 값에만
연결되고, 플러그인 티어는 텍스트만입니다.


## CLI(독립 실행 dry-run)

Harness 없이 규칙 파일에 대해 호출 하나를 평가할 수 있습니다:

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
dsh-perm-gate --permissive --tool bash --args '{"command":"pnpm install"}'
```

## 개발

```sh
npm run typecheck
npm test
npm run build
```

## 라이선스

[MIT](./LICENSE)
