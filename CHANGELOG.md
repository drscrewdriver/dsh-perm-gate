# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `trustEscalation` strategy in the Permissive tier (on by default while the tier is on): a
  sandbox-escalation approval for a call this gate already allowed is answered `allowed-once`
  here instead of prompting you. The escalation is raised by `approveEscalation` from *inside*
  the shell / pwsh / edit tool body — after `tools/pre-execute` settled — so the gate's own
  allow never reached it and a call the LLM graded `safe` still asked you to approve the
  widening. Only the exact call the gate cleared (matched by `callId` and tool name) skips the
  prompt, and only for a recognized escalation reason naming `workspace-write` /
  `danger-full-access`; everything else delegates to the human unchanged. The auto-answer is
  recorded on the event feed (`verdict:"escalation-auto"`, `mode:<target>`). Turn the switch
  off to keep sandbox widening human-gated.

### Fixed

- The settings card now seeds the editable whitelist from the rules file. `installSettingsSection`
  called `scope.set('allowlist', …)` on the **host** settings scope, which exposes only
  `get` / `watch` / `update` / `replace` — `set(field, value)` is the *client* convenience wrapper
  over `mutate()`, a different object — so the call threw and the namespace stayed unseeded.
  It now uses `scope.update({ allowlist: … })`.
- The `approval/request` listener is registered `prepend` and is now an answering gate rather than
  a passive observer, so it sits ahead of the remote bridge that renders the browser prompt. A
  listener behind that bridge could only ever record a prompt that had already been shown.
- The browser half no longer imports `@deepseek-ai/dsh-client-runtime`, which DSH removed in
  `0.1.2-alpha.1`. `ClientContext` now comes from `@deepseek-ai/cordis` — the alias DSH 0.1.1
  defined as `export type ClientContext = Context`, so it names the same type on both lines — and
  the settings card declares the four scope members it uses locally (`SettingsScopeLike`), the
  same local-face pattern the host half already uses for the host `settings` service. The client
  contract is byte-identical on both lines; only its exporting package moved.

### Changed

- DSH compatibility now ships as **two long-lived branches**, each with its own version series,
  `engines.dsh`, and npm dist-tag: `main` / `0.2.x` / `>=0.1.2-alpha.1 <0.2.0-0` / `latest`, and
  `legacy` / `1.x` / `>=0.1.0-rc.7 <0.1.2-alpha.1` / `legacy`. This branch is `main`. See
  `RELEASING.md` for the branch layout and the cherry-pick flow.
- On this line `ctx.slots` is declared by `@deepseek-ai/dsh-client-ui-renderer/client` — from
  `0.1.2-alpha.1` on, `@deepseek-ai/dsh-client-runtime` is gone — so the client entry imports it.
- Client devDependency floors raised from `^0.1.0-rc.7` to `^0.1.5-rc.2`, and
  `@deepseek-ai/dsh-client-ui-renderer` added. The old floor meant the build could only ever
  resolve the 0.1.0-rc.8 package set, so this line was never compiled against.
- `npm run verify:line` (`scripts/verify-line.mjs`) installs this branch's line packages with
  `npm install --no-save` and runs typecheck + tests + build against them, so a build always
  compiles against the packages the branch ships for. `npm run verify:lines` is an opt-in drift
  check that builds on both lines and compares the bundles.

## [0.2.1-beta.3] - 2026-09-10

### Added

- Risk-graded `llmAssist`: the configured custom LLM (any OpenAI-compatible endpoint) grades each
  `ask` as `safe` / `risky:<category>`; hard categories (deletion / credential / remote / system /
  bulk) auto-deny, timeouts retry once, and every failure stays fail-closed.
- Verdict learning (`riskLearning`, off by default; `riskThreshold` 1–10, default 3): neutral-risk
  asks confirmed by a human and actually executed count toward auto-allowing the exact same
  operation (fingerprint-matched) — persisted to `$DSH_HOME/perm-gate/learning.json`, never into
  the user's YAML rules.
- Decision event feed: every decision appends to `$DSH_HOME/perm-gate/events.jsonl` and is served
  at `GET /api/dsh-perm-gate/events?sessionId=&since=`; the browser half shows the latest decision
  as a notice strip above the conversation input.
- Permission-picker icon now also decorates the collapsed picker trigger.
- Approval-records page: the conversation view gains an **Approvals** tab listing the session's
  gate decisions newest-first (timeline with kind tags, risk category, and time); the settings
  card's whitelist is now an editable rule list with per-row delete plus a bulk-edit toggle.
- Learning sedimentation (`riskSediment`, default on): a threshold-reached key's confirmed samples
  become deterministic auto-allow rules — exact fingerprint hits skip the LLM call entirely and
  survive the llmAssist switch; the settings card lists them with per-key terminate and per-sample
  remove (backed by `GET/POST /api/dsh-perm-gate/learning`).
- Selectable llmAssist receiver: **custom API** (OpenAI-compatible, with endpoint presets
  including Xiaomi MiMo `https://api.xiaomimimo.com/v1`) or the **DSH host model group**
  (`llm` service + `agentDefaultModel.currentSelection`, provider/model overridable) — plus a
  **health test** button (`POST /api/dsh-perm-gate/health`) that runs one minimal completion
  and reports latency. The card reads the live provider/model-group catalog
  (host `llm.listProviders`/`listModels` — user-configured custom groups included) via
  `GET /api/dsh-perm-gate/receiver` and shows the effective provider/model selection.
- Preset deny-keyword blacklist inherited from dsh-approval-gate (`DEFAULT_DENY_KEYWORDS`): a
  case-insensitive keyword hit vetoes the call before whitelist / grants / LLM; editable as a
  list in the settings card with preset tags and one-click restore; unset or empty applies the
  preset (the blacklist never silently turns off).
- **Approval-records review plane**: every decision's affected files are snapshotted before the
  change lands (≤5 files, ≤256 KB each) under `$DSH_HOME/perm-gate/snapshots/`; the **Approvals**
  tab turns those files into clickable chips that open a line diff (`GET /api/dsh-perm-gate/diff`)
  with a **revert** action delivering a restore instruction into the conversation
  (`POST /api/dsh-perm-gate/revert`), plus a snapshot inventory bar
  (`GET /api/dsh-perm-gate/snapshots-stats`, `POST /api/dsh-perm-gate/snapshots-clear`,
  session-scoped or all). Event rows now carry `files`, `justification`, `verdict`, and `category`.
- **Manual-approval terminal records**: an `ask` routed to a human is tracked and settled with the
  human's actual answer by a passive `approval/request` observer — `allowed-once` → approved,
  `rejected` → rejected, `cancelled` → cancelled, `unavailable` → a denial (no approval channel).
  `tools/result` settles the same ask as a fallback when the observer cannot correlate it (missing
  `callId`, no approval service, or an earlier listener short-circuiting the waterfall);
  "delete on settle" is the whole de-duplication rule. Approvals report the post-approval learning
  progress (`n`/threshold), and the notice strip labels all three terminal states.

### Removed

- The retired **Auto** permission tier is no longer restated in `cordis.patch.yml`. The DSH bundle
  patch replaces the whole `permission.config.presets` map, so this file had to carry every tier
  that should survive — including `auto`, which `dsh-auto-mode` contributed. That plugin is
  uninstalled: its knobs were identical to `workspace-write`, its "automatic review / one-shot
  approval" description lost its implementation with it, and this gate is inactive in that tier
  (`gatePresets` defaults to `['permissive']`). The picker now offers the three built-ins
  (`read-only` / `workspace-write` / `danger-full-access`, restated from
  `@deepseek-ai/dsh-base/cordis.patch.yml`) plus this plugin's `permissive`.
- `test/patch-presets.spec.ts` pins that exact key set, so a built-in tier can no longer be dropped
  (or a retired one resurrected) without failing the suite.

### Changed

- **DSH dual-version support (0.1.0-rc.7 … 0.1.2-rc.1).** One artifact now covers both
  `dsh-v0.1.1-rc.2` and `dsh-v0.1.2-rc.1` without a version check. `effectivePolicy` is a
  **private** method of the user-approval service in both versions, so it is read behind a
  `typeof` probe and a throwing/absent probe now degrades to “policy unknown” (the ask stands)
  instead of failing the decision path. Settings registration keeps `ctx.settings.register`,
  which exists in every supported version. `dsh.client.inject` no longer names
  `@deepseek-ai/dsh-client-runtime` (removed in 0.1.2) or `@deepseek-ai/dsh-client-ui-slots`
  (not a dynamic client row in either version); it now lists the real client rows it renders
  into. Added `engines.dsh` and a version-compatibility table to the README.
- The gate is **active only in the permission tiers listed in `gatePresets`** (default
  `['permissive']`, the tier this plugin adds). In every other tier — Read Only, Workspace Write,
  Auto, Full access, `custom` — its decision flow does not run at all: no allow, no ask, no deny,
  no P0 hard-deny, no deny-keyword veto, and no audit event. `gatePresets: ['*']` makes the gate
  global again (hard-deny included); an embedding that passes no scope keeps the legacy behaviour.
- `llmAssist` now uses the risk-category protocol (superset of the previous allow/deny/ask verdicts);
  `classifier.ts` shares one OpenAI-compatible transport (`chatCompletion`) with the risk grader.
  Hard-risk categories (`deletion` / `credential` / `remote` / `system` / `bulk`) now **auto-deny**
  instead of routing to the human — the operation is clearly dangerous and no popup is needed;
  only `risky:neutral` (uncertain) still reaches the human seam.
- `write` / `edit` tools now have a **path-aware default**: workspace-internal writes follow the
  configured `defaultAction` (typically `allow`); writes to paths outside the session workspace
  escalate to `ask` so the content can be reviewed. The LLM classifier can then auto-allow safe
  content or auto-deny harmful content, so only truly uncertain operations produce a popup.

### Fixed

- **`llmAssist` "safe" now actually auto-allows instead of only being recorded.** The
  `tools/pre-execute` listener returned the `ask` immediately and graded the call in the
  background, but an ask handed to the host is already on its way to the approval answerers and
  DSH offers no API to retract it (the request's own `signal` can only settle it `cancelled`). The
  panel therefore still appeared and the human still had to click, while the feed showed the
  `safe` auto-allow — and a hard-risk `auto-deny` never reached the host at all. The listener now
  awaits `refineAsk` **before** returning the decision (`makePreExecuteListener`): `safe` delegates
  via `next()` with no panel, a hard-risk category auto-denies, and only `risky:neutral` /
  `unresolved` / a grader failure keep the human ask (fail-closed). The wait is bounded by
  `riskTimeoutMs` (default 20 s) and an already-cancelled call skips grading.
- **The shell write-pattern layer never ran for DSH's primary shell tool.** `SHELL_TOOLS` listed
  `bash` / `pwsh` / `sh` / `cmd` / `powershell` but not **`shell`** (DSH's own tool name) or
  `terminal`, so `git push`, `chmod`, `tee`, redirects and every other write pattern fell through
  to `defaultAction` instead of escalating to `ask`. The roster is now
  `shell` / `terminal` / `bash` / `pwsh` / `sh` / `cmd` / `powershell`, and the duplicate copy in
  `learning.ts` was removed (single source in `evaluate.ts`, so the decision path and the learning
  fingerprint cannot drift again).
- **Redirect and `tee` detection was too narrow.** Only `>>` matched, so `echo x > /tmp/out.txt`
  and a bare `tee /tmp/log.txt` were treated as read-only. `> f` / `>> f` / `>f` now escalate while
  the stderr idioms a read-only command uses (`2>&1`, `>&2`, `2>/dev/null`, `1>&2`) stay
  read-only; `curl` / `wget` escalate only when they write a file (`-o` / `-O` / `>`).
- **`decideRules` ignored `args.command`.** It read only the derived `ctx.commandText`, so any
  caller that built a context by hand (tests, embedders) silently lost command inspection. It now
  falls back to `args.command`, matching `PermGateRuntime.ctxFor`.
- **The gate overruled the permission tier the user selected.** It owns an independent approval
  tier, but it acted in *every* preset: any crossing became an `ask`, `dsh-tools` forwarded it to
  the DSH approval seam, and under the `danger-full-access` preset (`approval: never`) that seam
  returns `rejected` **before any answerer runs** — no panel was ever rendered and every
  non-read-only call failed with the misleading `the user rejected tool "..."`. Its hard-deny and
  deny-keyword layers likewise ignored the tier, so `danger-full-access` ("full access without
  approval prompts") was silently narrowed. The whole gate is now scoped to `gatePresets`; outside
  it the gate is inert and records nothing. Inside an active tier an `ask` is still degraded to
  passthrough when the session's effective approval policy is `never`, so an unanswerable ask can
  never become a denial.
- **Read-only search and session-local tools were asked about.** `web_search` and
  `modlens_read_image` are read-only queries and `todo_write` / `render_ui` / `validate_dsh_ui` /
  `ask_user_question` / `exit_plan_mode` / `ralph` / `workflow` are session-local state or
  delegation, but none were in the auto-allow classification, so each one raised an `ask` (the
  `no rule matched; default action` popup). They are auto-allowed now, and a new `autoAllowTools`
  config list extends the classification for third-party read-only tools. P0 hard-deny and the
  deny-keyword layer still run first, so the list can never widen authority.
- **`write` / `edit` to paths outside the workspace silently passed through.** A call that writes
  to `~/.bashrc` or another drive's files received the configured `defaultAction` (typically `allow`)
  and executed without review. A path-aware override now applies to write/edit tools when no rule
  matches: workspace-internal writes follow the configured `defaultAction`, but any target path
  outside the session's workspace escalates to `ask` so the content can be reviewed — harmful
  content is denied; benign additions are auto-allowed when `llmAssist` is enabled. Explicit deny
  rules still win regardless of path scope, and explicit allow rules can grant access to inside
  paths but never bypass the review for outside ones.
- **P0 credential detection scanned document bodies**, so writing or editing any file that merely
  *mentioned* a token, a private key, or `credentials.yaml` was hard-denied. It now scans only the
  arguments that describe the operation (`command`, `file_path`, …), matching the deny-keyword
  layer's existing rule that a file's text is not the operation.
- **A `$DSH_HOME/perm-gate/rules.yml` was never loaded.** `rulesFile` had no default, so a profile
  entry that omitted `config` left the gate with an empty ruleset and `defaultAction: ask` — the
  user's `defaultAction: allow` and `allow:` rules were silently ignored. `rulesFile` now defaults
  to `<dataDir>/rules.yml` (like `eventsFile` / `learningFile`), and the settings card's whitelist
  mirror actually writes there.
- **`format` vetoed the PowerShell cmdlet `Format-Table`.** A hyphen is not a word boundary for a
  command identifier, so the blacklist matched `Format-Table` / `Format-List`. Keyword edges now
  match against identifier characters (`[A-Za-z0-9_-]`), so `format C: /q` is still caught while
  `Format-Table` and `mkfs.ext4` behave as before.
- **Every read query required manual approval.** `read` / `read_image` / `grep` / `glob` / `ls` / `lsp`
  are workspace-only read operations that can't modify anything (P0 hard-deny still blocks reads
  of sensitive paths outside the workspace root). They are now auto-allowed. The same applies to
  all DSH internal coordination tools (`agent_teams_*`, `conversation_search`, `memory_*`,
  `get_goal` / `update_goal` / `create_goal`, `taskboard_*`, `job_*`, `list_agents` /
  `interrupt_agent` / `send_message`, `subagent` / `subagent_fork` / `terminal` / `skill`).

- **The Approvals tab resolved no session id**, so it listed nothing while the snapshot bar showed
  the global inventory. A `conversation.view` occupant receives the standard props at the top level
  (`sessionId` / `useSessions`) — the shape `ConversationRoot` consumes — not under `slotsProps`;
  the view and the notice strip now probe the top level, the nested shape, and the session-list hook.
- **Events were recorded with an empty session id**, so the Approvals tab (which filters by the
  current session) showed nothing even though `events.jsonl` was filling up. DSH's `ToolExecution`
  carries the session on `agent.session.id` (workspace cwd on `agent.session.header.cwd`), not on
  `exec.sessionId` / `exec.cwd`; both are now read from the agent when the direct fields are absent.
- **The review page was silently dead on a default install**: with a profile entry that omits
  `config`, `dshHome` was empty, so the data directory was `undefined` and the event log was never
  constructed — no `events.jsonl`, no snapshots, no persisted learning, and a 404 on
  `GET /api/dsh-perm-gate/events`. `dshHome` now resolves to an explicit value, else `$DSH_HOME`,
  else `~/.dsh`, so `<dshHome>/perm-gate/{events.jsonl,learning.json,snapshots/}` is always written.
- Deny-keyword matching no longer vetoes a keyword that merely appears inside a longer identifier,
  and document-body arguments (`content`, `new_string`, `old_string`, `text`, …) are no longer
  scanned at all — a file's text is not the operation. Matching is word-boundary aware now, so
  punctuation-edged and CJK keywords keep working, and whitespace is collapsed so a command
  written with extra spaces is still caught.


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