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

> **Compatibility note:** v0.1.0 ships `ja` / `ko` dictionaries, but official DSH exposes
> only `zh` / `en` through `LocaleRuntime` (`LOCALE_IDS = ["zh", "en"]`). On stock DSH,
> selecting `ja` / `ko` fails with `locale "<id>" is not registered`. Use a DSH fork that
> updates `LOCALE_IDS` (locale-settings.ts) and `LOCALES` labels (client/index.ts), then
> rebuild.

Version **0.1.0** — see the [Changelog](./CHANGELOG.md).

A single, self-sufficient, deterministic-first, fail-closed permission gate for DeepSeek Harness.

`dsh-perm-gate` decides every tool call through a fixed priority chain:

| Stage | Decision | What it is |
| ---- | ---- | ---- |
| **P0** | `deny` | deterministic hard-deny: credential material, protected-path mutation, dangerous shell |
| **P1** | `allow` | a precise, bounded **session grant** |
| **P2** | `deny/allow/ask` | static rule chain: blacklist first, then allow, then ask |
| **P3** | `allow/deny/ask` | optional LLM semantic classifier (default **off**) |
| **P4** | `ask` | official approval seam |

Strictly fail-closed: a P0 decision is never overridden by a grant, a rule, the classifier, or a human.

## Why

The DSH safety ecosystem splits this across several plugins (`dsh-permission-rules`,
`dsh-auto-mode`, `dsh-auto-review`, `dsh-movein-permissions`). `dsh-perm-gate` merges the
gate + approval + (optional) classifier into one package, with one audit trail and no
cross-plugin version coupling.

## Features

- **Command whitelist / blacklist** — matched on an **argv decomposition** (not a raw string),
  with recursive descent into `sh -c`/`bash -c`, pipeline detection, redirect-target
  checking, and recursive/force (`rm -rf`) recognition.
- **Deny priority** — a matching deny rule wins over any allow rule.
- **Session grants** — precise `(tool, canonical fingerprint)` grants with `TTL` + `maxUses`;
  re-running with a different target never reuses authority. Sub-agents inherit but cannot mint.
- **Pure-function rule engine** — glob/regex compilation with a ReDoS bound, loud fail on
  malformed rules, and source-hash compile caching.
- **Audit** — every decision is logged as an `{ignorable:true}` event with its `callId`; the
  model-visible reason matches the recorded outcome.
- **Permissive tier** — an **independent approval mode** (separate from read-only, full-access
  and whitelist tiers) that is neither "auto-approve" nor blanket trust. Front-end exposes a
  **single switch** (`permissive`); the three backend strategies are **combinable** and driven
  by plugin settings — still fail-closed against P0.

## Install

Requires an existing [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installation.

```sh
dsh plugin --profile web add dsh-perm-gate
```

Full install, upgrade, migration and troubleshooting steps live in the
[Installation guide](./INSTALL.md) — also available in
[中文](./INSTALL.zh.md) / [日本語](./INSTALL.ja.md) / [한국어](./INSTALL.ko.md).

## Configuration

Add the plugin to `cordis.yml`:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; empty = allow everything per defaultAction
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
```

### Rules file

```yaml
permissions:
  defaultAction: ask
  deny:
    - command: [rm#recursive]
      reason: no recursive rm
    - command: [ssh]
      reason: no direct ssh
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

A command entry `word#flag` matches the command word (`word`) with the modifier `recursive` or
`force` — so `rm#recursive` matches `rm -rf`, `env rm -rf`, and `sh -c "rm -rf /"`.

## Permissive mode

Permissive is an **independent approval tier** in the DSH permission picker, parallel to
Read Only / Workspace Write / Full access / Whitelist. It is **not** "auto-approval" and never
mints blanket authority: it only narrows or widens the seam *before* the human/LLM step while
P0 hard-deny stays monotonic and non-negotiable.

In `cordis.yml`:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml
    defaultAction: ask
    permissive: true            # single front-facing switch (independent tier on)
    permissiveStrategies:        # backend, combinable
      trustAutoAllow: true       # in-scope safe ops auto-allow; dangerous/unknown ask
      alwaysConfirm: false       # every crossing asks; allow-controls add repeat-allow / wl-migrate buttons
      llmAssist: false           # LLM classify first, human fallback on ask/failure
```

`trustAutoAllow` is the baseline middle tier (rule-allow auto-passes). `alwaysConfirm` surfaces
the approval panel for every crossing; its "allow controls" add two extended buttons — 
**repeat-allow this type this session** (a bounded session grant) and **allow every occurrence**
(which persists the command word into the `permissions.yaml` allow whitelist via
`approveAllowEverywhere`). `llmAssist` consults a real, configurable LLM (`classifierEndpoint` /
`classifierModel`, any OpenAI-compatible API) to auto-decide an `ask`, and falls back to the
human seam on `ask`/error — always fail-closed. When `permissive` is off, the gate behaves
exactly as before.

### A selectable session tier

`cordis.patch.yml` extends the DSH `permission.config.presets` with a `permissive` preset
(`sandbox: workspace-write`, `approval: ask`, name **Permissive**) between Workspace Write and
Full access — the same mechanism the Auto mode uses. So the session permission picker offers
Permissive as an independent selectable approval tier, not an "auto-approval" mode.

### Configurable in the UI

The tier is also adjustable at runtime from **Settings → Plugins → Permissive approval tier**
(a `settings.plugins.tab` page rendered by the plugin's browser client): one switch toggles
`permissive`, and three toggles edit the backend `permissiveStrategies`. The host reads the
namespace live, so a change applies to the next tool call without a restart. This is an
independent approval class, NOT the DSH "auto-approval" mode.

## CLI

Dry-run one call against a rules file (no harness needed):

```sh
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
dsh-perm-gate --rules permissions.yaml --list
```

## Development

```sh
npm run typecheck
npm test
npm run build
```

## License

[MIT](./LICENSE)