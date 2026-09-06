# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Risk-graded `llmAssist`: the configured custom LLM (any OpenAI-compatible endpoint) grades each
  `ask` as `safe` / `risky:<category>`; hard categories (deletion / credential / remote / system /
  bulk) always ask, timeouts retry once, and every failure stays fail-closed.
- Verdict learning (`riskLearning`, off by default; `riskThreshold` 1–10, default 3): neutral-risk
  asks confirmed by a human and actually executed count toward auto-allowing the exact same
  operation (fingerprint-matched) — persisted to `$DSH_HOME/perm-gate/learning.json`, never into
  the user's YAML rules.
- Decision event feed: every decision appends to `$DSH_HOME/perm-gate/events.jsonl` and is served
  at `GET /api/dsh-perm-gate/events?sessionId=&since=`; the browser half shows the latest decision
  as a notice strip above the conversation input.
- Permission-picker icon now also decorates the collapsed picker trigger.

### Changed

- `llmAssist` now uses the risk-category protocol (superset of the previous allow/deny/ask verdicts);
  `classifier.ts` shares one OpenAI-compatible transport (`chatCompletion`) with the risk grader.


### Added
- **Permissive tier** — an independent approval mode parallel to read-only / workspace-write /
  full-access / whitelist. A single front switch (`permissive`) plus combinable backend
  strategies (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`); P0 hard-deny stays monotonic.
- Audit `classifier` / `permissive` decision sources; optional injectable `classify` hook for
  `llmAssist` (fail-closed on `ask`/absence).
- **Browser client** — a `settings.plugins.tab` page ("Permissive approval tier") renders in
  Settings → Plugins: one switch (`permissive`) + three backend `permissiveStrategies` toggles.
  The host reads the namespace live, so edits apply to the next tool call without a restart.
- CLI `--permissive` flag and permissive summary in `--list`.
- **Real llmAssist LLM** — a configurable OpenAI-compatible classifier (`classifierEndpoint` /
  `classifierModel`), invoked to auto-decide an `ask` and fail-closed to the human seam.
- **Whitelist migration** — `approveAllowEverywhere` persists a command word into the rules
  file's `allow` whitelist and reloads; `approveRepeat` mints a bounded session grant. Both back
  the always-confirm panel's two extended allow buttons.
- **Four-language install guides** — `INSTALL.md` / `INSTALL.zh.md` / `INSTALL.ja.md` /
  `INSTALL.ko.md` covering install, upgrade, migration from the split plugins, verification and
  troubleshooting; every README gained language-switch links, a `ja` / `ko` compatibility note
  (official DSH `LOCALE_IDS` is `["zh", "en"]`) and a version reference.
- README.ja / README.ko expanded to full mirrors of the English source of truth (P0–P4 chain
  table, why/features, rules-file format, Permissive tier, CLI).

## [0.1.0] - 2026-08-30

### Added
- P0–P4 decision chain: hard-deny, session grant, static deny-first rule chain, optional classifier (off), `ask`.
- Pure-function rule engine: glob/regex compilation with ReDoS bound, loud-fail parsing, content-hash compile cache.
- Command whitelist/blacklist via argv decomposition (`sh -c`/`bash -c` recursion, pipelines, redirects, recursive/force).
- Precise session grants keyed by canonical fingerprint (TTL + maxUses, no cross-target reuse).
- `{ignorable:true}` decision audit with model-visible⟺logged invariant.
- Standalone CLI dry-run evaluator (`dsh-perm-gate --rules … --tool … --args …`).
- DSH cordis function-plugin contract (`cordis.patch.yml`, Schemastery `Config`, exports/types).
- 4-language README (en/zh/ja/ko) and Keep-a-Changelog framework (en + ja + ko).