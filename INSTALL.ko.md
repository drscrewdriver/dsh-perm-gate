# 설치 안내

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

`dsh-perm-gate` 버전 **2.0.0**. 결정 체인, 규칙 파일 형식, 自动审查 티어는
[한국어 README](./README.ko.md)를 참고하세요.

## 요구 사항

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)가 설치되어 있어야 합니다.
- Node.js **>= 20** (`package.json`의 `engines` 참고).
- `dsh` CLI가 `PATH`에 있어야 합니다.
- 설치할 profile. 브라우저 절반은 `web` profile용으로만 빌드됩니다
  (`package.json`의 `dsh.client.platform = "web"`).

## DSH 버전에 맞는 tag 선택

단일 빌드는 두 DSH 라인을 모두 커버하므로, 어느 tag를 골라도 작동하는 코드가
설치됩니다 —— tag를 유지하는 이유는 당신이 고정하는 버전이 각 라인에서 의미 있게
유지되도록 하기 위함입니다.

| DSH 버전 | 설치 방법 |
|----------|-----------|
| `0.1.2-alpha.1` 이상 (`0.1.5-rc.2` 포함) | `dsh plugin --profile web add dsh-perm-gate` (tag `latest`) |
| `0.1.1-rc.2` 이하 | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH는 `engines.dsh`를 강제하지 않으므로, tag는 선택 메커니즘이지 호환성 게이트가
아닙니다. 단일 아티팩트가 두 라인을 커버하는 이유와 tag가 게시되는 방식에 대해서는
[RELEASING.md](./RELEASING.md)를 참고하세요.

## 공식 CLI로 설치

```sh
dsh plugin --profile web add dsh-perm-gate
```

게시된 패키지를 가져오고 `cordis.patch.yml`(自动审查 세션 티어 + 플러그인 항목)을
적용하여 host / client 양쪽을 조립합니다.

## 소스에서 설치

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build`는 `prepublishOnly` 단계이기도 하므로, 게시 시 오래된 `lib/`가
포함되지 않습니다.

## 활성화 및 설정

profile의 `cordis.yml`에 플러그인을 추가합니다:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # 선택. 기본값은 $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # 보호 대상 검사의 고정 루트
    defaultAction: ask              # allow | ask | deny
```

[examples/permissions.example.yaml](./examples/permissions.example.yaml)에서 시작한 뒤
profile을 다시 불러오세요.

## 업그레이드

```sh
dsh plugin --profile web update dsh-perm-gate
```

그다음 패치 파일을 다시 읽도록 profile을 재적용합니다:

```sh
dsh profile reload --profile web
```

## 분리된 플러그인에서 이전하기

`dsh-perm-gate`는 `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review`,
`dsh-movein-permissions`에 흩어져 있던 게이트·승인 심·선택적 분류기를 하나의
패키지로 통합합니다.

1. 기존 규칙 목록(deny / allow / ask)을 내보내 하나의 `permissions.yaml`로 합칩니다.
2. 위 네 플러그인을 `cordis.yml`에서 제거하고 `dsh-perm-gate` 항목만 추가합니다.
3. 해당 플러그인들이 제공하던 preset 재정의를 삭제합니다. `cordis.patch.yml`은
   `permission.config.presets`를 **전체 교체**하므로, 다른 플러그인의 오래된
   key 단위 패치가 自动审查 티어(또는 내장 티어)를 조용히 없앨 수 있습니다.
4. profile을 다시 불러오고 아래의 `--list`로 검증합니다.

## 검증

```sh
# 로드된 규칙 세트 요약(Harness 불필요)
dsh-perm-gate --rules permissions.yaml --list

# 단일 호출 dry-run
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

`--list` 출력 예시:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

UI의 **설정 → 플러그인 → 自动审查**에 스위치 하나와 백엔드 전략 토글
네 개가 표시되어야 합니다.

## 제거

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

플러그인을 제거하면 패치 기여도 사라지므로 自动审查 티어가 세션 권한 선택기에서
다시 사라집니다.

## 문제 해결

**권한 선택기에 自动审查 티어가 없습니다.**
DSH 번들 패치는 `permission.config.presets`를 key 단위로 병합하지 않고 **전체 교체**
합니다. profile을 다시 불러와 `cordis.patch.yml`을 재적용하고, 더 늦게 로드되는
플러그인이 `presets`를 덮어쓰지 않는지 확인하세요.

**규칙 파일이 있는데 `--list`가 `ruleCount: 0`을 표시합니다.**
`rulesFile`은 플러그인 디렉터리가 아니라 Harness 프로세스의 CWD에서 해석됩니다.
절대 경로를 쓰거나 셸의 CWD를 확인하세요. 잘못된 문서는 로드 시 loud-fail하며
조용히 비활성화되지 않습니다.

**`llmAssist`가 동작하지 않습니다.**
`classifierEndpoint`, `classifierModel`, `classifierApiKey`가 필요합니다
(**설정 → 플러그인 → 自动审查** 또는 `cordis.yml`에서 지정).
값이 없거나 네트워크 오류가 나면 사람 승인 심으로 폴백합니다. 설계상 fail-closed입니다.

**「승인 기록」 페이지가 계속 비어 있습니다.**
게이트는 `gatePresets`에 나열한 티어(기본 `['permissive']`, 선택기 표시명 「自动审查」)
에서만 동작하므로 다른 티어의 세션에서는 이벤트를 전혀 기록하지 않습니다 —— 기록하려면
해당 세션에서 권한 선택기로 「自动审查」를 고르세요. preset을 한 번도 선택하지 않은
세션도 범위 밖입니다. 새 세션의 초기 티어는 `permission.defaultPreset` 설정이 정합니다.

**설정 카드에 "설정 네임스페이스를 사용할 수 없습니다"가 표시됩니다.**
플러그인이 현재 profile에 조립되지 않았습니다.
`dsh plugin --profile web add dsh-perm-gate`를 실행하고 다시 불러오세요.

**`ja` / `ko` 선택 시 `locale "<id>" is not registered` 오류가 납니다.**
공식 DSH의 `LocaleRuntime`은 `zh` / `en`만 노출합니다.
[한국어 README](./README.ko.md)의 호환성 안내를 참고하세요.

## 라이선스

[MIT](./LICENSE)
