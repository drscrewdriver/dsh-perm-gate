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

`dsh-perm-gate` 버전 **2.2.0**. 결정 체인, 규칙 파일 형식, 自动审查 티어는
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

## **DSH** 업그레이드 후: 입력창 아이콘 패치 재적용

「自动审查（高权限）」가 「自动审查」와 같은 방패+눈 아이콘을 보여 주는 것은
`scripts/patch-permission-glyph.mjs`가 **DSH 호스트 패키지 안의 닫힌 Map**에 그 항목을
추가했기 때문일 뿐입니다. DSH는 플러그인이 제공한 티어에 **설계상 아이콘을 주지
않습니다** —— 그 Map 자체의 주석이 *"host-configured names outside the design set get
none"*이라고 말합니다. 플러그인이 영향을 줄 수 있는 option 객체는
`{value, name, description}`만 나르므로, 대신 쓸 수 있는 플러그인 측 이음새가 없습니다.

이 패치는 **호스트** 파일을 고치므로 **DSH 업그레이드나 재설치에서 사라집니다**.
*이 플러그인*을 업그레이드할 때는 사라지지 않습니다. 아이콘은 애초에 플러그인 소유가
아니었고, 플러그인 자신의 기여(`cordis.patch.yml`의 `name:` / `description:`)는
패키지에 함께 실려 나갑니다.

```sh
npx dsh-perm-gate-patch-glyph            # 패치 적용
npx dsh-perm-gate-patch-glyph --check    # 확인만. 글리프가 사라졌으면 종료 코드 1
dsh profile reload --profile web
```

스크립트는 **이 패키지에 함께 실려 나갑니다** —— `scripts/patch-permission-glyph.mjs`로도,
`dsh-perm-gate-patch-glyph` bin으로도 —— 소스 checkout이 필요 없습니다.
**의도적으로 `postinstall`에 연결하지 않았습니다**: 이 스크립트는 호스트 패키지를 고치며,
플러그인이 허락 없이 자신이 설치된 harness를 다시 쓸 이유는 없습니다. 적용 여부와 무관하게
DSH 동작에는 영향이 없고 티어 자체는 그대로 기능합니다.

이 스크립트는 멱등이며(두 번째 실행은 no-op), 백업은 한 번만 뜨고, 잘못 잘린 조각을
쓰지 않습니다 —— 결과에 `node --check`를 돌려 실패하면 백업을 복원합니다 —— 따라서
DSH 업그레이드 때마다 무조건 다시 실행해도 안전합니다. 실행 중인 `node` 바이너리에서
패키지를 역산하므로 nvm 버전 변경이나 설치 symlink 재지정에도 깨지지 않습니다.

**플러그인을 재설치해도 아이콘은 돌아오지 않습니다.**
`dsh plugin --profile web add …`는 profile 디렉터리 안의 pnpm으로 인자를 넘기고
profile 자신의 `node_modules`만 씁니다(`-w` = `--workspace-root`인데, 이 profile의
workspace는 `packages: ['.']` 그 자체이므로 달라지는 것이 없습니다). 아이콘은 DSH
설치 쪽에 있습니다. 표준 설치에서 아래 세 경로는 사본 세 개가 아니라
**하나의 물리 파일**입니다:

| 경로 | 실체 |
|------|------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | DSH 설치 위치(symlink일 수 있음) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | 그곳을 가리키는 **정션(junction)** |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | 패치 대상 파일 |

관찰할 증상: 티어는 여전히 동작하고 게이트도 그대로지만, 입력창 드롭다운의 그 행에
아이콘이 없고 접힌 트리거가 다른 티어의 아이콘+텍스트와 달리 텍스트만 표시됩니다.

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

**「自动审查（高权限）」의 입력창 아이콘이 사라졌습니다.**
DSH 업그레이드나 재설치가 패치해 둔 호스트 번들을 교체했습니다. 플러그인을
재설치해도 되돌아오지 않습니다. `npx dsh-perm-gate-patch-glyph`를 실행하고
다시 불러오세요. 티어 자체는 영향받지 않습니다 —— 패치가 없어도 라벨과 게이트는
정상 동작합니다.

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
