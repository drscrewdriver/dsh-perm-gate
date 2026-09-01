# Installation guide

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

`dsh-perm-gate` version **0.1.0**. Continue with the [README](./README.md) for the
decision chain, the rules file format and the Permissive tier.

## Requirements

- An existing [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installation.
- Node.js **>= 20** (see `engines` in `package.json`).
- The `dsh` CLI on your `PATH`.
- A profile to install into — the browser half only ships for the `web` profile
  (`dsh.client.platform = "web"` in `package.json`).

## Install with the official CLI

```sh
dsh plugin --profile web add dsh-perm-gate
```

This pulls the published package, applies its `cordis.patch.yml` (the Permissive
session tier plus the plugin entry) and assembles both halves.

## Install from source

```sh
git clone https://github.com/drscrewdriver/dsh-perm-gate.git
cd dsh-perm-gate
npm install
npm run build      # tsc -> lib/*.js + lib/*.d.ts, tsdown -> lib/client.js
dsh plugin --profile web add .
```

`npm run build` is also the `prepublishOnly` step, so publishing never ships a
stale `lib/`.

## Enable and configure

Add the plugin to your profile's `cordis.yml`:

```yaml
- id: dsh-perm-gate
  name: dsh-perm-gate
  config:
    rulesFile: ./permissions.yaml   # optional; omit to fall back to defaultAction
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
```

Start from [examples/permissions.example.yaml](./examples/permissions.example.yaml),
then reload the profile.

## Upgrade

```sh
dsh plugin --profile web update dsh-perm-gate
```

Then re-apply the profile so the patch file is re-read:

```sh
dsh profile reload --profile web
```

## Migrate from the split plugins

`dsh-perm-gate` merges the gate, the approval seam and the (optional) classifier
that used to live across `dsh-permission-rules`, `dsh-auto-mode`, `dsh-auto-review`
and `dsh-movein-permissions`.

1. Export your existing rule lists (deny / allow / ask) and merge them into one
   `permissions.yaml` document.
2. Remove the four plugins from `cordis.yml` and add the single `dsh-perm-gate`
   entry above.
3. Delete any preset overrides those plugins contributed — `cordis.patch.yml`
   **replaces** `permission.config.presets` wholesale, so stale per-key patches
   from other plugins can silently drop the Permissive or Auto tier.
4. Reload the profile and verify with `--list` (below).

## Verify

```sh
# summarize the loaded ruleset (no harness needed)
dsh-perm-gate --rules permissions.yaml --list

# dry-run one call
dsh-perm-gate --rules permissions.yaml --tool bash --args '{"command":"pnpm install"}'
```

Expected `--list` output shape:

```json
{
  "rulesFile": "/abs/path/permissions.yaml",
  "defaultAction": "ask",
  "ruleCount": 8,
  "permissive": false,
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false }
}
```

In the UI, **Settings → Plugins → Permissive approval tier** should render one
switch plus the three backend strategy toggles.

## Uninstall

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Removing the plugin also removes its patch contribution, so the Permissive tier
disappears from the session permission picker again.

## Troubleshooting

**The Permissive tier is missing from the permission picker.**
The DSH bundle patch replaces the whole `permission.config.presets` map instead of
merging per key. Reload the profile so `cordis.patch.yml` is re-applied, and make
sure no later plugin overwrites `presets`.

**`--list` reports `ruleCount: 0` although my rules file exists.**
`rulesFile` is resolved against the process CWD of the harness, not the plugin
directory. Prefer an absolute path or confirm the shell CWD. A malformed document
fails loud at load — it is never silently disabled.

**`llmAssist` never fires.**
It needs `classifierEndpoint`, `classifierModel` and `classifierApiKey` (set them
in **Settings → Plugins → Permissive approval tier** or in `cordis.yml`). Any
missing value or network error falls back to the human seam — the gate is
fail-closed by design.

**Settings card shows "Settings namespace unavailable".**
The plugin is not assembled into the active profile. Run
`dsh plugin --profile web add dsh-perm-gate` and reload.

**Selecting `ja` / `ko` fails with `locale "<id>" is not registered`.**
Official DSH exposes only `zh` / `en` through `LocaleRuntime`. See the
compatibility note in the [README](./README.md).

## License

[MIT](./LICENSE)
