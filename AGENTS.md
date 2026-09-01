# AGENTS.md

Standalone DeepSeek Harness plugin repository (`dsh-perm-gate`). Development
follows the dsh-plugin-guide skill and the official plugin contract; this file
records repo-local decisions.

## Layout

- `src/index.ts` — function-plugin contract (`name`/`inject`/`Config`/`apply`, NO default export).
- `src/config.ts` — Schemastery schema + explicit `resolveConfig` (no hidden `?? default` in run paths).
- `src/compiler.ts` — pure glob/literal → RegExp compiler with a ReDoS bound (`maxStars` per unbounded run).
- `src/rule.ts` — pure `permissions` YAML parsing/validation + `compileDocument` + content-hash cache key.
- `src/shell.ts` — pure argv decomposition: env/prefix stripping, pipeline, redirects, `sh -c`/`bash -c` recursion, recursive/force recognition.
- `src/evaluate.ts` — first-match `decideRules`: deny-first, then allow, then ask, then `defaultAction`.
- `src/engine.ts` — P0 hard-deny (credentials / protected path / dangerous shell) then P1 grant then P2+P4.
- `src/grant.ts` — precise session grants keyed by canonical fingerprint (key order / cosmetic whitespace normalized; different targets never share).
- `src/path.ts` — pure workspace-relative normalization + protected/sensitive detection + `ArtifactRegistry`.
- `src/audit.ts` — `{ignorable:true}` decision events, host probe, model-visible⟺logged invariant.
- `src/runtime.ts` — host-facing gate; constructed from config or directly in tests.
- `src/cli.ts` — standalone dry-run evaluator (`dsh-perm-gate --rules ... --tool ... --args ...`).
- `src/client/` — browser half: `index.ts` (registers the `settings.plugins.tab` page + dictionaries),
  `card.tsx` (Permissive tier settings card: single switch + three strategies), `locales.ts`.
  Bundled to `lib/client.js` by `tsdown` (`tsdown.config.ts`); node half stays on `tsc`.
- `test/` — vitest; the full decision path (P0/P1/P2/P4 + grants + audit) is exercised without a live harness.

## Hard rules applied here

- Waterfall listener (`tools/pre-execute`) always delegates via `next()` on allow/passthrough; it
  vetoes only with `deny`/`ask`.
- Deny wins over allow: blacklist first, then allow list, then ask list.
- Unknown or malformed config/rules fail loud at load (never silently disabled).
- Grants are precise and bounded; a different target is never covered (no cross-target replay).
- P0 (hard-deny) is monotonic and never negotiated by any later stage.

## Build

`npm run typecheck && npm test && npm run build`. `build` uses `tsc -p tsconfig.build.json`
which emits `lib/*.js` + `lib/*.d.ts`.

## Docs

Docs follow the **multilingual-docs-skill** layout (four languages × three types):

- `README.{md,zh,ja,ko}.md` — project intro, P0–P4 chain, rules format, Permissive tier, CLI.
- `INSTALL.{md,zh,ja,ko}.md` — install / upgrade / migration / verify / troubleshooting
  (split out of the README).
- `CHANGELOG.{md,ja,ko}.md` — Keep-a-Changelog; zh is covered by `README.zh.md`.
- `src/client/locales.ts` — `zh` is the key-set source of truth; `en` / `ja` / `ko` mirror it
  as `Record<keyof typeof zh, string>` (a missing key is a compile error).

Rules for every doc edit:

- English `README.md` is the source of truth; `README.zh.md` / `README.ja.md` /
  `README.ko.md` mirror it. `CHANGELOG.md` keeps the Keep-a-Changelog format;
  `.ja` / `.ko` variants follow.
- Every README / INSTALL carries the full language-switch link block at the top
  (including a self-link), and the `ja` / `ko` compatibility note: official DSH
  `LOCALE_IDS` is `["zh", "en"]`, so `ctx.locale.register` accepts only `{ zh, en }` —
  the `ja` / `ko` dictionaries ship but cannot be selected on stock DSH.
- `package.json` `files` must whitelist every doc (`README.*.md` / `INSTALL.*.md` /
  `CHANGELOG.*.md` / `LICENSE`).
- Keep the version reference in each README in sync with `package.json`.
- When published on GitHub set topics `dsh`, `dsh-plugin`, `deepseek-harness`,
  `permission`, `permission-gate`, `allowlist`, `sandbox`, `ai-safety`.