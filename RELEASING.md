# Releasing dsh-perm-gate

Maintainer notes. Not shipped in the npm tarball (`package.json` `files` does not
list this file) — it documents the release process, not the plugin's use.

## Two DSH compatibility lines, two branches

DSH removed `@deepseek-ai/dsh-client-runtime` at `0.1.2-alpha.1`. The plugin serves
both sides of that break from two long-lived branches, each with its own version
series, its own `engines.dsh`, and its own npm dist-tag.

| Branch | Version series | `engines.dsh` | dist-tag | DSH |
|--------|----------------|---------------|----------|-----|
| `legacy` | `1.x` | `>=0.1.0-rc.7 <0.1.2-alpha.1` | `legacy` | up to `0.1.1-rc.2` |
| `main` | `0.2.x` | `>=0.1.2-alpha.1 <0.2.0-0` | `latest` | from `0.1.2-alpha.1` on (current `0.1.5-rc.2`) |

`beta` stays the pre-release channel for `main`.

DSH does not enforce `engines.dsh` (nothing in the loader reads it), so the version
declaration is a statement of support rather than a gate; the dist-tag is what
actually selects the artifact a user installs.

## What differs between the lines

| | `legacy` | `main` |
|---|---|---|
| `@deepseek-ai/dsh-client-runtime` | ships | removed |
| Where `ctx.slots` is declared | that package's client entry (`Context` comes with it) | `@deepseek-ai/dsh-client-ui-renderer/client` |
| Where `SettingsScope` is exported | that package's `client` subpath | `@deepseek-ai/dsh-client-ui-settings/client` |

The plugin is written so those edges are **type-only**:

- `ClientContext` is `Context` from `@deepseek-ai/cordis`. On the legacy line DSH
  literally defines `export type ClientContext = Context`, so this names the same
  type on both.
- The settings card declares the four scope members it uses locally
  (`SettingsScopeLike<T>`), the same local-face pattern the host half already uses
  for the host `settings` service. The real contract is member-for-member identical
  on both lines; only its exporting package moved.
- `ctx.slots` is picked up by `import type {} from
  '@deepseek-ai/dsh-client-ui-renderer/client'`. On the legacy line that entry
  declares nothing for `slots` (the legacy chain supplies it) — a no-op there.
- The sandbox-escalation handling in `src/runtime.ts` was verified against both
  tags: `tools/pre-execute` is awaited, `approval/request` is a short-circuitable
  waterfall, the escalation reason is
  `` `escalate sandbox to ${mode}: ${justification}` ``, and the target vocabulary is
  `['workspace-write', 'danger-full-access']` — all identical at `dsh-v0.1.1-rc.2`
  and at HEAD.

## Verify before publishing

```sh
npm run verify:line     # this branch's own line (legacy -> 0.1.1-rc.2, main -> 0.1.5-rc.2)
npm run verify:lines    # opt-in drift check: build on BOTH lines and compare hashes
```

`scripts/verify-line.mjs` installs the target line's client packages with
`npm install --no-save`, runs `typecheck` + `test` + `build`, records the SHA-256 of
`lib/client.js`, and restores the `package.json` dependency set. Never edit
`package.json` or `package-lock.json` to run it — the script only writes
`node_modules`.

`verify:lines` is informational, not a release gate: the branches are allowed to
diverge. While they are still in sync the two hashes match, which is the signal
that the version-specific edges are still type-only. When they no longer match, the
branches have genuinely forked and `verify:line` is the only check that matters.

Last measured while the branches were in sync — identical on both lines:
`e8f03f902738bd09cf63499b8557943c96a0ebc75117f8c2a10d4c5b17b1be3f`.

## Publish

Publish from the branch that owns the line:

```sh
# main -> latest
git switch main
npm version <patch|minor|major>
npm run verify:line
npm run build
npm run release:latest

# legacy -> legacy
git switch legacy
npm version <major|minor|patch>     # 1.x series
npm run verify:line
npm run build
npm run release:legacy
```

Fix a defect on both lines by cherry-picking, and re-run `verify:line` on each
branch — never assume a fix built for one line is still correct on the other.

## Change flow

1. Land the change on `main` (the current line is the default target).
2. If it also affects the legacy line, `git cherry-pick` it onto `legacy`.
3. Any change that touches `src/client/**`, `package.json` devDependencies, or
   anything reading a DSH client contract must be verified on **both** branches,
   because that is where the lines actually differ.

## Published tags

| dist-tag | Meaning | Install target |
|----------|---------|----------------|
| `latest` | newest stable, current DSH line (`main`, `0.2.x`) | `dsh plugin add dsh-perm-gate` |
| `legacy` | the DSH `<= 0.1.1` line (`legacy`, `1.x`) | `dsh plugin add dsh-perm-gate@legacy` |
| `beta` | pre-release of the latest line | `dsh plugin add dsh-perm-gate@beta` |
