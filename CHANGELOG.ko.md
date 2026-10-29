# 변경 로그

이 프로젝트의 중요한 변경 사항은 모두 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

> 참고: 2.4.1부터 5.1.2까지는 영문 `CHANGELOG.md`에만 기록되어 있습니다 (ko판은 아직 미추적).

## [5.4.0] - 2026-10-30

- 자격증명 계열 사다리: 내장 7계열(ssh / cloud / package / gitcreds / env / cli / db), 각 유형 4칸 deny / ask(기본) / readonly / readwrite. 칸 상태는 규칙 문서 자체에 저장 — 계열별 `[deny-rule:cred.<family>]` 행 + 짝을 이루는 `credWriteExemptFamilies` 목록. 설정 카드는 `GET/POST /api/dsh-perm-gate/cred`로 두 저장소를 단일 update에 함께 쓰며 지역 사본을 두지 않는다. readwrite는 인라인 확인을 요구하고 P0 판정 중 정확히 하나(credential-store 쓰기)만 물러남; 루트·보호 경로·.dsh·유출은 어떤 칸에서도 움직이지 않는다.
- 엔진: `decide()`가 READ 도구에서 규칙 계층 선행 조회(이름을 지정한 항목만 ask/deny로 라우팅; 미적중은 기존 무음 자동 통과로 확인 예산 불변). INTERNAL 조율 도구는 선행 조회하지 않는다. 순수 모듈 `src/cred-families.ts`(계열 glob + `familyOfPath`) 추가.
- 시딩: 프리셋 표 52→59행; 수위 키 `presetRulesVersion`으로 업그레이드 후 신규 행만 보충(id 단위 멱등, 취소한 행은 부활하지 않음). 보호 브랜치 force push 바닥 해제 스위치 `allowProtectedBranchPush`(기본 꺼짐=바닥 유지)와 프리셋 행 `[deny-rule:rsync.delete]` 추가.

## [5.3.1] - 2026-10-17

### 추가

- **호스트 지원: DSH `0.2.1-rc.1`.** 지원 호스트 열거(`package.json` engines.dsh, `dsh.plugin.json`, 모든 `@deepseek-ai/dsh*` peer, README 관리 블록)에 `0.2.1-rc.1` 추가(구간 없이 rc 단위 정확한 열거). 동작 변화 없음: 선언면 릴리스로, 0.2.1-alpha.4부터 engines.dsh만 읽는 호스트 게이트가 0.2.1-rc.1 호스트에서 이 플러그인을 허용합니다.

### 변경

- `publishConfig.registry`를 `https://registry.npmjs.org`에 고정(릴리스 위생: 배포 대상이 미러 registry로 표류하지 않음).

## [5.3.0] - 2026-10-17

### 추가됨

- **YOLO 티어** (`yolo` — `permissive-yolo` 를 담당): 사람 확인을 절대 요구하지 않는다. 위험한 ask(되돌릴 수 없음·학습 불가·해독 불가 하중, 또는 검토 모델의 하드 위험 판정)는 차단하고 이유를 `工具审核意见` 메시지로 메인 LLM에 되돌려 준다. 나머지는 실행된다. 심사자가 부재하거나 무응답일 때도 사람에게 묻지 않고 기계 선별로 처리하되 `yolo-allow-no-reviewer` 로 명시한다(아래 항목).
- **축소 검토** (`rulesFallback`): 검토 모델이 설정되지 않았거나 판정을 내리지 못했을 때, 아무도 답하지 않는 확인 창에 처리를 멈추지 않고 결정론적 그물만으로 판정한다. 모델이 답하는 동안에는 동작이 그대로다. 보통의 자동 심사 등급(`permissive` / `permissive-full`)에 적용되는 항목이며, 구현을 독점하는 세 등급은 이미 답하는 주체를 명시하고 있으므로 강등하지 않는다.
- **스크립트 검토** (`scriptReview`, 기본 켬): 호출이 실행하는 스크립트 본문을 (용량 제한·절대 실행 없이) 읽어 검토 모델·사람·결정론적 그물이 같은 코드를 보게 한다. 파일명으로는 보이지 않는 삭제가 코드로 판정된다. 전부 읽혔다면 '해독 불가' 티어를 벗어난다. 끄면 파일 내용은 로컬에 남지만 워크스페이스 외부 스크립트는 U 티어로 돌아간다.
- **사용자 신고형 보호** (모두 추가 전용·즉시 반영): `credentialPaths`(`.ssh`와 같은 기준——워크스페이스 외부 읽기와 파일 도구를 통한 변경을 거부), `denyKeywordsExtra`(프리셋을 대체하지 않고 병합), `extraContentArgKeys` / `extraOperationArgKeys`(내장 목록 위에 어떤 인자가 문서이고 어떤 것이 동작 서술인지를 선언한다).
- **무인 구현 세 개 — 스위치 하나에 권한 등급 하나씩**: `safenetAsk`(`permissive-snet`)는 결정론 기계 선별로 위험을 걸러낸 뒤에도 **여전히 사람에게 묻는다**. 심사 모델은 전혀 부르지 않는다 — 심사 LLM 미연결시, 또는 토큰을 쓰지 않고 사람이 직접 판단하게 하고 싶을 때의 형태. `safenetPass`(`permissive-mech`)는 같은 선별로 **ask 를 인계받는다**: 지목한 위험은 차단하고 주모델에 돌려보내며, 특정하지 못한 것은 실행한다. 사람 확인 없음·모델 호출 없음 — `approval: never` 의 심사판. `yolo`(`permissive-yolo`)는 모델을 쓰는 등급이며, 사람이 답할 질문을 모델이 대신 답하고 사람에게는 절대 격상하지 않는다. 핵심은 그 대응 관계 자체다: 스위치는 옆에 적힌 등급의 동작만 바꾸고, 구현을 끄면 그 등급은 다른 등급으로 몰래 바뀌지 않고 보통의 사람 확인으로 돌아간다. 다섯 등급은 모두 **플러그인 자체**의 profile patch 로 배포되어 설치 직후 피커에 있으며 손으로 고칠 것은 없다(`permissive` 자체는 그대로). 참고로 2개 리비전만 존재했던 per-preset 표(`<preset>=<mode>`)는 사라졌다 — 이 세 스위치와 중복되며, 하나의 자세에 제어기가 두 개면 하나는 반드시 거짓을 말한다.
- **YOLO 는 얻지 못한 심사자를 칭하지 않는다**: 심사 모델 미설정 또는 `unresolved` 일 때, 등급은 여전히 사람에게 묻지 않고 기계 선별로 처리한다. 다만 기록은 `yolo-allow-no-reviewer` 로 남고 이유에도 그렇게 적힌다 — 라벨 없는 폴백으로는 모델이 없는 순간에만 YOLO 와 기계 등급이 심사 이력에서 구별되지 않기 때문.
- **모든 등급이 공유하는 하층 기계 심사**: 결정론 판정 (비가역 / 학습 불가 / 해독 불가)이 YOLO·강등 게이트·새 passthrough 세 곳에 손으로 복사되어 있었다. 하나의 `mechanicalJudge`로 합쳐, 등급이 바뀌는 것은 "잔여를 누가 결정하는가"뿐이고 "위험을 무엇으로 보는가"는 바뀌지 않는다. 테스트로 고정: 같은 호출은 YOLO와 passthrough 모두에서 차단되며, 어느 쪽도 모델 호출을 쓰지 않는다.
- 설정 카드의 불리언 항목은 **낙관적 알약 스위치**가 되었다 (36×20 캡슐, 상태는 `aria-checked`가 단일 원천, 테마 토큰＋폴백으로 명암 모두 대응). 무인 확인 각 행은 자기가 제어하는 등급 이름도 함께 찍는다. 모두 클릭 즉시 반전하고, 기록의 확정·거부·미보고 시 표시권을 저장소로 돌려준다.
- 심사 이력에서 맨 태그로 노출되던 결정 경로를 라벨링: `yolo-allow` / `yolo-block`, `rules-fallback-*`, `safety-net-passthrough-*`, 그리고 이전부터 미번역이던 넷 (`cleanup-safe`, `escalation-auto`, `learned-granted`, `network-ask`).
- 프로파일 및 보호된 Windows 루트를 **변수나 glob 경유**로 삭제하는 처리에 대한 결정론적 그물(`$HOME`, `~/.*`, `$env:USERPROFILE\.*`, `%WINDIR%`, `$PSHOME` 등): 프로파일 루는 바로 거부하고, 다른 보호 루트는 '지워지지 않는 영원한 ask'가 된다. 9B 검토 모델에서는 지식을 주입한 프롬프트로도 실측으로 놓쳤기에 코드 층에 두었다.

### 수정됨

- issue #2: 문서형 도구의 본문을 더 이상 동작으로 읽지 않는다. 공유 규칙 `src/scan-text.ts`가 도구 구분으로 읽을 키를 고른다(read / internal / write는 command·url·path·query만. 알 수 없는 도구명은 여전히 실행형으로 전부 읽음). `exit_plan_mode`는 실행할 단계를 솔직히 적을 수 있게 되어, 모델이 계획 문구를 비틀어 게이트를 통과하는 상황을 막는다.
- 같은 보고의 부수 항목: 따옴표 밖의 줄바꿈과 여백 없이 붙은 `;` `|` `&&` `||`를 문 구분자로 `decomposeShellCommand`가 보게 되어, 다중 행 명령의 두 번째 문이 규칙에 도달한다.혼자 쓰인 `&`는 자르지 않아 `2>&1`과 백그라운드 실행 형태를 지킨다.
- issue #3: 기본 안전 스크린이 올린 격상은 자기 이유를 직접 밝힌다(`write target outside the workspace (…)` / `command carries a file-write or redirect pattern`). `no rule matched`를 사칭하지 않고, 모델 자신의 문장도 확인·거부 문구에 실린다(개행 제거·각괄호 제거·마스크 처리·180자 상한으로 `[deny-rule:…]` 위조를 방지).
- issue #4: `=>`와 `->`를 파일 리다이렉트로 오인하지 않는다.
- `write` / `edit`로 자격증명 스토어를 변경하는 행위(`~/.ssh/authorized_keys`, `.git-credentials`, `.npmrc`, 클라우드 자격증명)를 P0에서 거부한다. 기존에는 삭제만 막혀 있어 자동 허용된 쓰기만으로 접근 권한을 심을 수 있었다.
- 키 쌍의 공개 쪽(`id_ed25519.pub`)은 인자 전체 자격증명 스크린에 걸리지 않는다(손으로 키를 복원하는 운용에 이의 제기 불가능 계층이 막히고 있었다).
- `deny-keyword` 감사 문구에서 사용자가 추가한 항목에 대한 "preset" 표현을 없앴다.

### 알려진 공백

- `pathArgument`는 `file_path` / `path` / `cwd` / `workdir`만 본다. 복수형 필드(`paths`·`files`·`urls`)는 자격증명 경로 기준 밖에 남는다.
- 넘겨받은 문서 자체를 실행하는 도구(`workflow`·`skill`·`ralph`)의 본문은 평탄화된 스크린으로 읽지 않는다. 위임된 작업은 독립적인 도구 호출로 심사된다.

## [5.2.0] - 2026-10-14

### 추가됨

- `src/preset-rules.ts`: cc-safety-net에서 이식한 51개의 `[deny-rule:*]` 항목(MIT, 출처는 `THIRD_PARTY_NOTICES.md`). `mergePresetIntoRaw()`는 `deny`/`ask` 끝에 추가하고 id 단위로 멱등이며, 사용자가 취소한 행을 다시 넣지 않는다. 새 volatile 키 `presetRulesSeeded`를 활성 시점에 한 번 기록.
- `argv.pipeline`을 연결 문자열뿐 아니라 개별 단순 명령마다 평가한다(프리셋 적중률이 여기에 의존). 규칙 판정은 `deny-rule:<id>`로 귀속.

### 수정됨

- 시딩이 `apply`의 동기 본문에서 달려 settings 서비스가 아직 마운트되지 않은 상태였기 때문에, 어떤 호스트에서도 조용히 한 번도 적용되지 않았다. 이제 inject 콜백 안, 각 세대가 네임스페이스를 등록한 뒤에 실행한다(0.1.5에서는 `installSection` 이전 쓰기가 예외를 던진다).
- 규칙과 멱등 플래그를 두 개의 `update`로 나누면 rc.1+에서 두 번째가 `Plugin entry "dsh-perm-gate" is no longer configurable`로 실패해 플래그가 영원히 서지 않았고, 사용자가 전부 취소한 표가 무한히 재시딩되었다. 이제 한 번의 갱신으로, 규칙 성공 이후에 플래그를 쓴다.
- `rawEntry()`가 `params` 차원에 **컴파일된** `ParamCondition[]`를 내보냈고, 그래서 시딩된 문서는 다음 부팅에서 이 플러그인 자기 자신의 리더에서 실패해(`permissions.deny[22].params.params must be a mapping`) perm-gate가 활성화되지 못했다. mapping으로 되돌리고 `!glob` 부정 접두어도 복원.
- 플러그인 자신의 `perm-gate/rules.yml`로 시딩하는 폴백을 폐기(저자 결정 2026-10-14): 손으로 관리하는 규칙 원본에 주입 행 51개를 섞어서는 안 되고, 그 분기는 구세대 호스트에서만 돌아 두 호스트 세대의 동작이 갈렸다. settings 서비스가 없으면 지금은 시딩하지 않으며, 파일 쓰기로 축소하지 않고 명시적으로 보고한다.
- 세 번째 항목을 잡을 수 있던 관문을 추가했다: `test/preset-rules-roundtrip.spec.ts`가 병합된 문서를 리더와 컴파일러에 다시 통과시킨다. 음성 대조(수정 3을 되돌리면 5개 중 3개 실패)도 확인했다.

## [5.1.0] - 2026-10-05

### 변경됨

- 15-rc 열거 라인 통일: 세 개의 호스트 서브패키지(`client-locale`·`client-ui-renderer`·`client-ui-settings`)의 peer를 전부 열거하고, 내용은 검증 환경에서 확인된 `4.3.0-beta.2`와 같은 트리이며, 버전은 compat 라인의 `5.0.4`를 넘는다.

## [2.4.1] - 2026-09-17

### 수정됨

- 승인 이력이, 플래그된 호출이 왜 검토 없이 실행되었는지 설명하는 유일한 이벤트에 대해 원시 `preset-passthrough` 문자열을 표시했습니다(티어는 `approval: ask`를 선언했지만 세션이 `never`로 재정의되어 게이트의 ask가 패스스루로 강등된 경우입니다). 이제 다른 판정과 마찬가지로 읽기 쉬운 라벨로 표시됩니다.

## [2.4.0] - 2026-09-17

### 변경됨

- **P3 LLM 분류기는 에스컬레이션 전용이 되어 더 이상 거부할 수 없습니다.** 하드 카테고리
  (`deletion` / `credential` / `remote` / `system` / `bulk`)의 `risky` 판정은 이전에는 패널 없이
  **자동 거부**했지만, 이제는 **사람 확인(ask)을 유지**합니다. 거부는 결정론적 계층(P0 하드 거부,
  거부 키워드 블랙리스트, 명시적 `deny:` 규칙)에만 속합니다. 확률적 판정이 이의를 제기할 수 없는
  차단을 내려서는 안 되기 때문입니다. 실측: 그레이더가 무해한 `git commit -F …`를 **`remote`**로
  판정했고, 자동 거부는 승인할 패널도 재시도할 grant도 남기지 않았습니다(우연히 `safe`로 판정된
  수동 재시도만 통과했습니다). 이는 "고위험 작업은 **결정론적으로** 차단하고 LLM 판단에 맡기지
  않는다"는 프로젝트 자체 규칙과도 일치합니다.

### 추가됨

- 하드 위험 카테고리는 `neutral`과의 중요한 차이를 하나만 유지합니다: **결코 학습되지 않습니다**.
  사람의 승인을 반복해도 `deletion`/`credential`/`remote`/`system`/`bulk` 판정이 자동 허용으로
  침전되지 않습니다(이전에는 자동 거부의 부수 효과로만 성립했지만, 이제는 명시적 속성입니다).

### 동작 주의

- `approval: never`에서는 게이트가 전달할 수 없는 ask가 여전히 패스스루로 강등되므로, 분류기가
  플래그한 호출은 이제 **실행됩니다**(이전에는 자동 거부였습니다). 이는 "결정론적으로 위험한 것만
  거부하고 나머지는 협상한다"의 직접적 귀결입니다 —— 협상에는 사람이 필요하고, `never`는 사람이
  없다는 뜻입니다. 플래그를 실제로 받으려면 `approval`이 `ask`인 티어에서 운용하십시오.

## [2.3.0] - 2026-09-17

### 추가됨

- **게이트 정지는 더 이상 침묵하지 않습니다.** 세션 권한 프리셋이 `gatePresets` 밖에 있을 때 게이트는
  정지하고 아무것도 기록하지 않았습니다 —— 그래서 그 도구 호출은 게이트가 검사하고 허용한 호출과
  구별되지 않았습니다. 이제 (session, preset) 전환마다 **1건만** `stand-down` 알림을 기록하고
  (호출마다가 아닙니다), 프리셋·범위·P0 하드 거부가 비활성이라는 사실을 명시합니다. 브라우저는
  입력창 위에 상시 **GATE OFF** 표시줄로 렌더링하고, 승인 이력에는 `게이트 정지` 태그가 표시됩니다.
- 自动审查 설정 카드가 게이트 자체의 프리셋 범위(`gatePresets`, 기본값
  `permissive` / `permissive-full`)와 그 밖에서 벌어지는 일을 명시하므로, 범위를 티어를 설정하는
  곳에서 확인할 수 있습니다.

### 변경됨

- **P0의 문서상 위치는 전역이 아니라 범위 한정입니다.** P0 하드 거부는 *게이트의 프리셋 범위 안에서*
  단조롭고 협상 불가능합니다. 프리셋을 넘어가면 게이트는 P0를 포함해 완전히 정지합니다 —— 선택된
  티어 자체의 정책이 그 세션을 소유하기 때문입니다. 코드는 항상 이렇게 동작했지만 `AGENTS.md`와
  4개 README는 반대로 주장해, `danger-full-access`가 "P0는 여전히 적용된다"로 읽혔습니다.
  `gatePresets: ['*']`로 설정하면 P0는 다시 전역이 됩니다.

### 수정됨

- `DEFAULT_GATE_PRESETS` / `resolveGatePresets`를 `config.ts`(schemastery를 import합니다)에서
  의존성 없는 `preset.ts`로 옮겨, 브라우저 쪽이 node 전용 의존성을 클라이언트 번들로 끌어오지 않고
  범위를 렌더링할 수 있게 했습니다. `config.ts`는 둘 다 재수출하므로 기존 import는 변경이 없습니다.

## [2.2.0] - 2026-09-17

### 수정

- **P0 하드 거부가 4개의 셸 도구를 제외한 나머지를 모두 통과시키고 있었습니다.** `hardDenyReason`은 셸 검사를 로컬 정규식 `/^(?:bash|pwsh|sh|cmd)$/`로 막고 있었는데, 이는 `shell` / `terminal` / `powershell`에 **일치하지 않습니다**. `shell`은 DSH의 주 셸 도구이므로, P0의 셸 검사(보호 경로로의 리다이렉트)는 **가장 흔한 호출 형태에 대해 무력**했습니다. 실측, 동일 명령 `echo x > /etc/passwd`: `bash` 경유는 차단, `shell` 경유는 **통과**. `engine.ts`가 이제 `evaluate.ts`에서 `SHELL_TOOLS`를 가져옵니다——같은 사실의 사본이 세 곳에 있었고, 완전한 것은 하나뿐이었습니다.
- **`git push --delete`가 일반 push로 파싱되고 있었습니다.** `hasDelete`는 `analyzeSubcommand`에서 계산되지만 `branch` 케이스에서만 읽혔고, 그 결과 `git push --delete origin main`은 일반 push 분기(`destructiveness: 4`)로 떨어졌습니다. `DESTRUCTIVENESS_MAP`의 `'push-delete': 5`는 죽은 데이터였습니다.
- **보호 브랜치 판정이 슬래시를 포함한 이름에 오작동하고 있었습니다.** 술어가 마지막 `/` 앞부분을 잘라내어 `backup/main`과 `feat/release`가 보호 대상으로 읽혔습니다. 이제 알려진 ref 접두사(`refs/heads/`, `refs/tags/`, `refs/remotes/<remote>/`)만 제거합니다. 방향이 중요합니다——이 술어는 **되돌릴 수 없는** P0에 공급되며, 놓침에는 키워드/규칙/LLM 계층이라는 안전망이 있지만 오탐은 정당한 워크플로를 출구 없이 막습니다.

### 추가

- **보호 브랜치에 대한 원격 이력 재작성의 P0 하드 거부.** `main` / `master` / `production` / `release` / `stable`을 강제 덮어쓰기하거나 삭제하는 `git push`를 LLM 호출 이전에 결정론적으로 거부합니다. 기존 보호는 평면적이고 브랜치를 보지 않으며 네임스페이스로 덮어쓸 수 있는 키워드 `'push --force'`였습니다. 이것은 그 아래에 깔리는 협상 불가능한 바닥입니다.
  - **"에스컬레이션 전용"은 관례가 아니라 구조입니다**: 헬퍼는 `string | undefined`를 반환하고 호출자는 이를 deny / 미결로 읽습니다. allow를 표현할 수단이 없으므로 P0에 배선해도 게이트가 허용하는 범위를 넓힐 수 없습니다.
  - 의도적으로 **대상에서 제외**(키워드/규칙/LLM 계층이 계속 담당): 비보호 브랜치로의 force push, 브랜치명을 쓰지 않은 `git push --force`, 일반 push.
  - 커맨드 파서(`command-dispatcher` / `command-semantics` / `parsers/git` / `parsers/shell-cmds`)의 첫 프로덕션 사용입니다. 지금까지는 자체 테스트 파일에서만 참조되고 있었습니다.

### 테스트

- 신규 `test/git-protected-push.spec.ts`(13건).
- **반증**: 세 수정을 각각 되돌리면 그것을 지키는 케이스만 빨개집니다(총 7건). 의도적으로 허용하는 케이스는 초록으로 남습니다.
- 전체 **40 파일 / 459건**, `typecheck` 클린.

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

## [0.2.1-beta.4] - 2026-09-11

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