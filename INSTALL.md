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

`dsh-perm-gate` version **2.6.1**. Continue with the [README](./README.md) for the
decision chain, the rules file format and the 自动审查 tier.

## Requirements

- An existing [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) installation.
- Node.js **>= 20** (see `engines` in `package.json`).
- The `dsh` CLI on your `PATH`.
- A profile to install into — the browser half only ships for the `web` profile
  (`dsh.client.platform = "web"` in `package.json`).

## Pick the line for your DSH version

Two long-lived branches serve two DSH lines: `main` (2.x) and
`sync/0.1.5-from-main` (3.x, the DSH 0.1.5 packaging variant — `compat/0.1.5`
points at the same tree).

| Your DSH | Install |
|----------|---------|
| `0.1.2-alpha.1` – `0.1.5-rc.0` | `dsh plugin --profile web add dsh-perm-gate` (tag `latest`, the 2.x line) |
| `0.1.5-rc.1` or newer | `dsh plugin --profile web add github:drscrewdriver/dsh-perm-gate#sync/0.1.5-from-main` (the 3.x line; no npm dist-tag yet — `@latest` installs the same code with 2.x packaging) |
| up to `0.1.1-rc.2` | `dsh plugin --profile web add dsh-perm-gate@legacy` |

DSH does not enforce `engines.dsh`, so tags and refs are the selection mechanism
rather than a compatibility gate. See [RELEASING.md](./RELEASING.md) for how the
lines and tags are laid out.

## Install with the official CLI

```sh
dsh plugin --profile web add dsh-perm-gate
```

This pulls the published package, applies its `cordis.patch.yml` (the 自动审查
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
    rulesFile: ./permissions.yaml   # optional; defaults to $DSH_HOME/perm-gate/rules.yml
    dshHome: $DSH_HOME              # root pinned for protected-target checks
    defaultAction: ask              # allow | ask | deny
    gatePresets: [permissive]       # tiers where the gate is active at all (default)
```

Since 2.6.0 the rules themselves are stored in the `dsh-perm-gate-rules` settings
namespace, and every change recompiles the gate in place. The YAML file above is
optional: it is only read while the namespace is untouched, and the first rules
write from the plugin (an allowlist approval, or an edit in the settings UI)
absorbs the file's rules automatically.

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

## After a **DSH** upgrade: re-apply the composer glyph patch

Both 自动审查 tiers draw an icon only because `scripts/patch-permission-glyph.mjs`
added them to a **closed map inside a DSH host package**: 自动审查 copies the
`workspace-write` glyph and 自动审查（高权限） the `danger-full-access` one — the
built-in tier each shares a file sandbox with. DSH gives host-configured tiers no
glyph by design — the map's own comment reads *"host-configured names outside the
design set get none"* — and the option objects a plugin can influence carry only
`{value, name, description}`, so there is no plugin-side seam to use instead.

The script resolves each source key instead of assuming its spelling: `["<key>",`
first, then the constant alias the bundle may use instead (`[FULL_ACCESS,` for
`danger-full-access`). DSH has already changed this design set once — 0.1.2 keyed a
`permissive` glyph, 0.1.5 keeps only `read-only` / `workspace-write` /
`danger-full-access` — and a source key it cannot resolve is reported together with
the keys the map does carry, so re-pointing a tier is a one-line edit to
`GLYPH_TARGETS`.

That patch edits a **host** file, so a DSH upgrade or reinstall erases it. Upgrading
*this plugin* does not: the plugin never owned the glyph, and its own contribution
(`name:` / `description:` in `cordis.patch.yml`) ships inside the package.

```sh
npx dsh-perm-gate-patch-glyph            # apply the patch
npx dsh-perm-gate-patch-glyph --check    # report only; exits 1 if the glyph is gone
dsh profile reload --profile web
```

The script **ships inside this package** — as `scripts/patch-permission-glyph.mjs` and as
the `dsh-perm-gate-patch-glyph` bin — so no source checkout is needed. It is deliberately
**not** wired to `postinstall`: it edits a host package, and a plugin must not rewrite its
harness uninvited. Running DSH is unaffected either way; the tier works with or without it.

It is idempotent (a second run is a no-op), backs the bundle up once, applies both
glyphs or neither (a source key it cannot resolve is a refusal, not a half-patch),
and refuses to write a mis-sliced bundle — it runs `node --check` on the result and
restores the backup if that fails — so it is safe to run unconditionally after every
DSH upgrade. It locates the bundle from the caller's profile scope first and the CLI
install second, so an nvm version change or a re-pointed install symlink does not
break it — and when the machine carries more than one DSH install, the ones it did
**not** patch are listed in the output, because only one of them serves the UI in
front of you. Pass that path explicitly to patch it.

**Reinstalling the plugin does not restore the glyph.** `dsh plugin --profile web
add …` forwards to pnpm inside the profile directory and writes the profile's own
`node_modules` only; `-w` (`--workspace-root`, and this profile's workspace is just
`packages: ['.']`) changes nothing about that. The glyph lives in the DSH install.
On a stock install these are not three copies but **one physical file**:

| Path | What it is |
|------|------------|
| `dirname(node)/node_modules/@deepseek-ai/dsh` | the DSH install (may be a symlink) |
| `<profile>/node_modules/@deepseek-ai/dsh-client-ui-conversation` | a **junction** into it |
| `<dsh>/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` | the patched file |

Symptom to look for: the tier still works and still gates correctly, but its row in
the composer dropdown has no icon and the collapsed trigger renders plain text
where the other tiers render glyph + text.

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
   from other plugins can silently drop the 自动审查 tier (or a built-in one).
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
  "permissiveStrategies": { "trustAutoAllow": true, "alwaysConfirm": false, "llmAssist": false, "trustEscalation": true }
}
```

In the UI, **Settings → Plugins → 自动审查** should render one
switch plus the four backend strategy toggles.

## Uninstall

```sh
dsh plugin --profile web remove dsh-perm-gate
dsh profile reload --profile web
```

Removing the plugin also removes its patch contribution, so the 自动审查 tier
disappears from the session permission picker again.

## Troubleshooting

**The 自动审查 tier is missing from the permission picker.**
The DSH bundle patch replaces the whole `permission.config.presets` map instead of
merging per key. Reload the profile so `cordis.patch.yml` is re-applied, and make
sure no later plugin overwrites `presets`.

**A 自动审查 tier lost its icon in the composer.**
A DSH upgrade or reinstall replaced the host bundle the glyphs were patched into;
re-running the plugin install will not bring it back. Run
`npx dsh-perm-gate-patch-glyph` and reload. If it reports that a source key is gone,
DSH changed the glyph map again: the error names the keys the map now carries, so
re-point the affected tier in `GLYPH_TARGETS`. The tiers themselves are
unaffected — their labels and their gating keep working without the patch.

**`--list` reports `ruleCount: 0` although my rules file exists.**
`rulesFile` is resolved against the process CWD of the harness, not the plugin
directory. Prefer an absolute path or confirm the shell CWD. A malformed document
fails loud at load — it is never silently disabled.

**`llmAssist` never fires.**
It needs `classifierEndpoint`, `classifierModel` and `classifierApiKey` (set them
in **Settings → Plugins → 自动审查** or in `cordis.yml`). Any
missing value or network error falls back to the human seam — the gate is
fail-closed by design.

**The Approvals tab stays empty.**
The gate is scoped to the tiers listed in `gatePresets` (default
`['permissive']`), so it records nothing while the session runs in another tier —
pick 自动审查 in the permission picker for the session you want recorded. A
session that has never selected a preset is out of scope too. New sessions start
in the tier named by the `permission.defaultPreset` setting.

**Settings card shows "Settings namespace unavailable".**
The plugin is not assembled into the active profile. Run
`dsh plugin --profile web add dsh-perm-gate` and reload.

**Selecting `ja` / `ko` fails with `locale "<id>" is not registered`.**
Official DSH exposes only `zh` / `en` through `LocaleRuntime`. See the
compatibility note in the [README](./README.md).

## License

[MIT](./LICENSE)
