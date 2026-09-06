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

> **호환성 안내:** v0.1.0은 `ja` / `ko` 사전을 포함하지만, 공식 DSH의 `LocaleRuntime`은
> `zh` / `en`만 노출합니다(`LOCALE_IDS = ["zh", "en"]`). 기본 DSH에서 `ja` / `ko`를
> 선택하면 `locale "<id>" is not registered` 오류가 발생합니다. `LOCALE_IDS`
> (locale-settings.ts)와 `LOCALES` 라벨(client/index.ts)을 갱신한 DSH fork를 사용해
> 다시 빌드하세요.

버전 **0.1.0** — 변경 내역은 [한국어 changelog](./CHANGELOG.ko.md)를 참고하세요.

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
- **Permissive 티어** — read-only / full-access / whitelist와 구별되는 **독립 승인
  모드**. "자동 승인"도 아니고 포괄적 권한 부여도 아닙니다. 프론트는 **단일 스위치**
  (`permissive`)만 노출하고, 백엔드의 세 가지 전략은 **조합 가능**하며 플러그인
  설정으로 제어됩니다. P0에 대해서는 여전히 fail-closed입니다.

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
    rulesFile: ./permissions.yaml   # 선택. 비우면 defaultAction을 따름
    dshHome: $DSH_HOME              # 보호 대상 검사의 고정 루트
    defaultAction: ask              # allow | ask | deny
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

## Permissive 티어

Permissive는 권한 선택기에서 Read Only / Workspace Write / Full access / Whitelist와
나란한 **독립 승인 티어**입니다. "자동 승인"이 아니며 포괄적 권한을 발행하지도 않습니다.
사람/LLM 심 **이전에** 판정을 좁히거나 넓힐 뿐이고, P0 하드 거부는 단조롭고 협상
불가능하게 유지됩니다.

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
      llmAssist: false           # 먼저 LLM이 분류, ask/실패 시 사람에게
```

`trustAutoAllow`는 중간 티어의 기준선입니다(rule-allow는 자동 통과). `alwaysConfirm`은
모든 경계에서 승인 패널을 띄우며, 그「허용 컨트롤」에 두 개의 확장 버튼을 추가합니다 —
**이 세션에서 해당 유형 반복 허용**(`approveRepeat`, 유계 세션 허용)과 **모든 발생
허용**(`approveAllowEverywhere`, 명령어를 `permissions.yaml`의 allow 허용 목록에
영속 기록 후 재로드). `llmAssist`는 설정된 실제 LLM(수신처는 설정 카드에서 선택: **사용자 지정 API**(`classifierEndpoint` /
`classifierModel`, OpenAI 호환 API면 무엇이든 가능, Xiaomi MiMo `https://api.xiaomimimo.com/v1` 등
프리셋 포함) 또는 **호스트 모델 그룹**(DSH의 `llm` 서비스와 현재 모델 그룹, `classifierProvider` /
`classifierModel`로 재정의 가능). **상태 테스트** 버튼으로 수신 LLM의 연결과 지연 시간을 확인할 수 있음)에 `ask` 자동 판정을 맡기고,
`ask`/오류 시 사람의 승인 심으로 폴백합니다 — 항상 fail-closed입니다.
`permissive`가 꺼져 있으면 게이트는 이전과 완전히 동일하게 동작합니다.

### 선택 가능한 세션 티어

`cordis.patch.yml`은 DSH의 `permission.config.presets`를 확장해 Workspace Write와
Full access 사이에 `permissive` preset(`sandbox: workspace-write`, `approval: ask`,
이름 **Permissive**)을 추가합니다. Auto 모드와 같은 메커니즘입니다. 따라서 세션 권한
선택기에는 "auto-approval"이 아니라 **독립적으로 선택 가능한 승인 티어**인 Permissive가
놓입니다.

### UI에서 설정 가능

이 티어는 실행 중에도 **설정 → 플러그인 → Permissive 승인 티어**에서 조정할 수 있습니다
(플러그인 브라우저 절반이 렌더링하는 `settings.plugins.tab` 페이지). 스위치 하나가
`permissive`를 토글하고, 토글 세 개가 백엔드 `permissiveStrategies`를 편집합니다.
host는 네임스페이스를 live로 읽으므로 변경은 재시작 없이 다음 도구 호출부터 적용됩니다.
이것은 독립적인 승인 클래스이며 DSH의 "auto-approval" 모드가 **아닙니다**.

### 위험 등급 llmAssist, 판정 학습, 이벤트 피드

`llmAssist`가 켜져 있으면 설정된 LLM(OpenAI 호환 엔드포인트라면 무엇이든 — `classifierEndpoint` / `classifierModel` / `classifierApiKey`을 자신의 API로 지정)이 구조화된 프로토콜로 `ask`를 하나씩 판정합니다:

- `safe` → 자동 허용(감사 소스 `classifier`).
- `risky` + **하드 위험 카테고리**(`deletion`, `credential`, `remote`, `system`, `bulk`) → 항상 사람에게 전달. 하드 위험은 자동 허용도 학습도 되지 않습니다.
- `risky:neutral` → `riskLearning` 활성 시(설정 카드, 기본 꺼짐), 사람이 승인하고 실제 실행된 neutral 위험은 `tool|카테고리` 키로 카운트되며, `riskThreshold`(기본 3) 도달 및 새 호출의 작업 지문(명령어 단어 + 대상 기본 이름)이 확인된 샘플과 일치하면 **동일 작업만** 자동 허용됩니다. 학습 침전(`riskSediment`, 기본 켜짐)을 사용하면 임계값에 도달한 키의 확인 샘플이 **결정론적 허용 규칙**이 됩니다: 지문이 정확히 일치하면 LLM 호출 없이 바로 허용——llmAssist가 꺼져도 유지되며, 침전 규칙은 설정 카드에서 확인·관리(종료 / 샘플 삭제)할 수 있습니다.
- 시간 초과(`riskTimeoutMs`, 기본 20초, 1회 재시도), 전송 실패, 프로토콜 외 출력은 원래 `ask`를 유지합니다.

학습 상태는 플러그인 소유 JSON(`$DSH_HOME/perm-gate/learning.json` 또는 `learningFile`)에 영속화되며 YAML 규칙 파일에는 기록되지 않습니다. 모든 결정은 `$DSH_HOME/perm-gate/events.jsonl`(또는 `eventsFile`)에 추가되고 `GET /api/dsh-perm-gate/events?sessionId=&since=`로 제공됩니다. 브라우저 절반이 이를 폴링하여 입력창 위에 최신 결정을 알림 바로 표시하고, 대화 보기의「승인 기록」탭에 세션의 모든 판정을 최신 순으로 나열합니다.

또한 프리셋 **거부 키워드 블랙리스트**(dsh-approval-gate의 `DEFAULT_DENY_KEYWORDS` 계승: `rm -rf`,
`push --force`, `drop table`, `mkfs`, `git reset --hard`, `docker system prune` 등)를 갖추어, 텍스트가
키워드를 포함하는 호출(대소문자 구분 없는 부분 일치)은 허용 목록/권한/LLM보다 먼저 거부됩니다. 설정
카드에서 목록으로 편집할 수 있고(프리셋 항목에는 태그 표시, 원클릭 복원 지원) 미설정·빈 목록 시 프리셋이
적용됩니다——블랙리스트가 조용히 꺼지지 않습니다.
 Permissive 티어는 권한 선택기에서 방패 아이콘을 유지합니다(메뉴 항목과 축소 트리거 모두).


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
