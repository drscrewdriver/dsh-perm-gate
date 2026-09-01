# 변경 로그

이 프로젝트의 중요한 변경 사항은 모두 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)을 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

## [Unreleased]

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