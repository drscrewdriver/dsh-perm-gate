/**
 * Preset deny rule table for dsh-perm-gate.
 *
 * Ported from cc-safety-net (MIT, https://github.com/kenryu42/cc-safety-net)
 * `src/core/rules/destructive.ts` + `secret.ts`, translated into this plugin's
 * own `permissions` YAML vocabulary (see rule.ts / rule-dims.ts). The catalog
 * is ONE SHOT-SEEDED preset: on first activation the entries are appended to
 * the tail of the live rules document's deny/ask lists — the settings `rules`
 * field when it is configured, otherwise the rules file. Revocation is
 * user-owned: every entry carries a `[deny-rule:<id>]` tag and can be flipped
 * to `enabled: false` or deleted in the settings card or the file; the
 * `presetRulesSeeded` config flag keeps the seed from ever re-adding them.
 *
 * Policy decisions baked into this table (auditable history in
 * .agents/plans/compat-cc-safety-net-deny-table/):
 * - `git push --force` → ask, not deny (user decision 2026-10-13; also sidesteps
 *   the glob negation gap for --force-with-lease).
 * - Dynamic/unverifiable targets (cc's strict-mode fail-closed family) → ask,
 *   aligning with this gate's existing "undecidable → ask" philosophy.
 * - Secret protection keeps this gate's ruling: read = ask, write/delete = deny,
 *   read+egress combos stay in the prompt layer (layered-defense decision).
 * - Root/home wipes and full-drive Remove-Item are NOT duplicated here — the P0
 *   irreversible layer runs first and owns them.
 * - The legacy deny-keyword blacklist (deny-defaults.ts) stays as a parallel
 *   layer; nothing here replaces it.
 *
 * Pure + import-light (yaml + rule.ts only): the client bundle may render the
 * table from `presetEntriesForView()` without pulling in the node filesystem.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { parsePermissionsDocument } from './rule.js';
import { CRED_FAMILY_IDS } from './cred-families.js';
/**
 * Shipped version of the preset table. Activation backfills (idempotent, revocation-
 * preserving) whenever the stored `presetRulesVersion` lags this number — bump it
 * whenever `PRESET_RULES_YAML` gains entries that existing installs must receive
 * (v1 added the seven `cred.*` family rows).
 */
export const PRESET_TABLE_VERSION = 1;
/** Tag prefix carried by every preset entry's reason; locates an entry for revocation. */
export const PRESET_RULE_MARKER = '[deny-rule:';
/** Extract the `[deny-rule:<id>]` tag from one reason string (undefined when untagged). */
export function presetRuleId(reason) {
    if (typeof reason !== 'string')
        return undefined;
    const m = /\[deny-rule:([a-z0-9._-]+)\]/.exec(reason);
    return m?.[1];
}
/**
 * The preset document in the file's bare YAML form. `defaultAction: ask`
 * matches the empty-ruleset default, so seeding cannot widen anything.
 * Patterns obey the compile limits: ≤2 glob stars, ordered subcommand+flag
 * forms through argv.pipeline (evaluated per simple command as well as over
 * the joined pipeline — see evaluate.ts), token co-occurrence NEVER through
 * args (args is any-token OR).
 */
export const PRESET_RULES_YAML = `defaultAction: ask

deny:
  # ── Git ──────────────────────────────────────────────────────────────────
  - command: [git]
    argv: { pipeline: ["git reset --hard*", "git reset *--hard*"] }
    reason: "[deny-rule:git.reset-hard] Hard reset discards uncommitted changes. Use git reset --soft/--mixed, or git stash first."
  - command: [git]
    argv: { pipeline: ["git reset --merge*", "git reset --abort*"] }
    reason: "[deny-rule:git.reset-merge] Merge reset discards in-progress merge work. Stash first, then reset --soft/--mixed."
  - command: [git]
    argv: { pipeline: ["git clean *-f*", "git clean *--force*"] }
    reason: "[deny-rule:git.clean-force] git clean permanently deletes untracked files. Dry-run first: git clean -nd."
  - command: [git]
    argv: { pipeline: ["git push origin *--delete*", "git push * --delete *", "git push --delete*"] }
    reason: "[deny-rule:git.push-delete] Deleting remote refs is visible to collaborators and needs explicit consent."
  - command: [git]
    argv: { pipeline: ["git push --mirror*", "git push * --mirror"] }
    reason: "[deny-rule:git.push-mirror] Mirror push force-updates and deletes remote refs wholesale."
  - command: [git]
    argv: { pipeline: ["git branch -D*", "git branch * -D", "git branch *--force-delete*"] }
    reason: "[deny-rule:git.branch-force-delete] git branch -D drops unmerged commits. Prefer merged-safe git branch -d."
  - command: [git]
    argv: { pipeline: ["git stash drop*"] }
    reason: "[deny-rule:git.stash-drop] Dropping a stash entry is unrecoverable after GC. Verify with git stash list."
  - command: [git]
    argv: { pipeline: ["git stash clear*"] }
    reason: "[deny-rule:git.stash-clear] Clearing all stashes destroys every saved worktree state."
  - command: [git]
    argv: { pipeline: ["git tag -d*", "git tag --delete*"] }
    reason: "[deny-rule:git.tag-delete] Tag deletion removes release anchors."
  - command: [git]
    argv: { pipeline: ["git reflog delete*", "git reflog expire*"] }
    reason: "[deny-rule:git.reflog-delete] Reflog deletion removes the last recovery path for lost commits."
  - command: [git]
    argv: { pipeline: ["git rebase --abort*"] }
    reason: "[deny-rule:git.rebase-abort] Aborting a rebase discards resolution work. Prefer --continue/--skip."
  - command: [git]
    argv: { pipeline: ["git merge --abort*"] }
    reason: "[deny-rule:git.merge-abort] Aborting a merge discards conflict resolution."
  - command: [git]
    argv: { pipeline: ["git rm -rf *", "git rm *-rf *", "git rm * -rf", "git rm -fr *", "git rm --force *", "git rm * --force", "git rm -f *", "git rm * -f"] }
    reason: "[deny-rule:git.rm-force] git rm -f deletes working-tree files even when modified. Stash them first."
  - command: [git]
    argv: { pipeline: ["git checkout --force *", "git checkout * --force", "git checkout -f *", "git checkout * -f", "git checkout -f", "git checkout * --force *"] }
    reason: "[deny-rule:git.checkout-force] Forced checkout overwrites local changes. git stash, then checkout."
  - command: [git]
    argv: { pipeline: ["git checkout -- *"] }
    reason: "[deny-rule:git.checkout-double-dash] Path restore from checkout discards local edits. Use git stash push -- <path>."
  - command: [git]
    argv: { pipeline: ["git checkout * -- *"] }
    reason: "[deny-rule:git.checkout-ref-path] Checking out a ref with a path overwrites working-tree files. Stash the paths first."
  - command: [git]
    argv: { pipeline: ["git checkout *--pathspec-from-file*"] }
    reason: "[deny-rule:git.checkout-pathspec-from-file] Bulk path restore from a file can silently overwrite edits. List the pathspec, stash, then restore."
  - command: [git]
    argv: { pipeline: ["git switch *--discard-changes*"] }
    reason: "[deny-rule:git.switch-discard-changes] --discard-changes throws away edits. git stash first."
  - command: [git]
    argv: { pipeline: ["git switch --force *", "git switch * --force", "git switch -f *", "git switch * -f"] }
    reason: "[deny-rule:git.switch-force] Forced switch overwrites local changes. git stash first."
  - command: [git]
    # git restore <bare path> (the plain unstaged discard) is NOT ported here:
    # any glob broad enough to catch it also catches the harmless
    # git restore --staged <path> (G6) — only the explicit discard forms are
    # denied, the bare-path case stays in the prompt layer.
    argv: { pipeline: ["git restore --worktree *", "git restore * --worktree *", "git restore * --worktree", "git restore -W *"] }
    reason: "[deny-rule:git.restore-worktree] Worktree restore discards local edits. git stash push -- <path> first."
  - command: [git]
    argv: { pipeline: ["git worktree remove --force *", "git worktree remove * --force", "git worktree remove -f *", "git worktree remove * -f"] }
    reason: "[deny-rule:git.worktree-remove-force] Forced worktree removal discards uncommitted work in that tree."
  - command: [git]
    args: ["alias.*"]
    reason: "[deny-rule:git.alias-config] Command-line Git aliases run arbitrary shell and cannot be analyzed."
  # params matches the RAW command string: the env-assignment word lands as the
  # simple command's lowercased word, so a command:[git] dimension would never
  # see this form — match on params alone.
  - params: { command: ["*GIT_SSH_COMMAND=*", "*git_ssh_command=*", "*GIT_SSH=*", "*git_ssh=*"] }
    reason: "[deny-rule:git.ssh-env] Git network ops with an SSH env override execute unanalyzable code."

  # ── Filesystem ───────────────────────────────────────────────────────────
  - command: ["rm#recursive", "rm#force"]
    args: [".git", ".git/*", "*/.git"]
    reason: "[deny-rule:rm.git-metadata] Removing Git metadata destroys history and the gate's audit anchors."
  - command: [find]
    argv: { pipeline: ["find .git*"] }
    reason: "[deny-rule:find.delete-git-metadata] Selecting .git for deletion destroys repository state."
  - command: [find]
    argv: { pipeline: ["find * -delete"] }
    reason: "[deny-rule:find.delete] find -delete removes everything selected. Enumerate with plain find first."
  - command: [find]
    argv: { pipeline: ["find *-exec rm*", "find *-delete*"] }
    reason: "[deny-rule:find.exec-rm-recursive-force] find -exec rm removes the whole tree per match. Dry-run plain find, delete explicit paths."
  - command: [rsync]
    argv: { pipeline: ["rsync * --delete*", "rsync --delete*"] }
    reason: "[deny-rule:rsync.delete] rsync --delete erases destination files absent from the source. Dry-run with rsync -n --delete first."
  - command: [dd]
    argv: { pipeline: ["dd * of=/dev/sd*", "dd * of=/dev/nvme*", "dd * of=/dev/mmcblk*"] }
    reason: "[deny-rule:dd.device-write] dd writing to a block device destroys the disk."
  - command: [mkfs, mke2fs, newfs, "mkfs.*"]
    reason: "[deny-rule:mkfs.device] Formatting a device erases it."
  - command: [diskutil, wipefs, sgdisk, parted]
    reason: "[deny-rule:disk.erase] Disk erase/partition/wipe operations destroy data."
  - command: [shred]
    reason: "[deny-rule:shred.target] shred irreversibly destroys files (even --help/--version reach it)."
  - command: [cat, head, tail, dd]
    args: ["*/dev/sd*", "*/dev/nvme*", "*/dev/disk*", "*/dev/mmcblk*"]
    reason: "[deny-rule:redirect.block-device] Redirect target resolving to a disk device path."

  # ── PowerShell ───────────────────────────────────────────────────────────
  # Command words are lowercased by the decomposer — command dimensions must
  # carry the lowercased verb (Remove-Item → remove-item).
  - command: ["remove-item#recursive"]
    args: [".git", ".git/*", "*/.git"]
    reason: "[deny-rule:powershell.remove-item-git-metadata] Never target .git."
  - command: [powershell, pwsh]
    argv: { pipeline: ["pwsh *Remove-Item*", "powershell *Remove-Item*", "pwsh *remove-item*", "powershell *remove-item*"] }
    reason: "[deny-rule:powershell.nested-recursive-delete-unread] A delete handed to pwsh/powershell in a non-literal form cannot be verified before it runs."
  - command: ["remove-item#recursive"]
    args: [".", "./"]
    reason: "[deny-rule:powershell.remove-item-recursive-force-cwd-self] Deleting the current directory removes the project."
  - command: ["remove-item#recursive"]
    args: ["../*", "..\\\\*"]
    reason: "[deny-rule:powershell.remove-item-recursive-force-outside-cwd] Deleting above the cwd escapes task scope."

  # ── Command Prompt ───────────────────────────────────────────────────────
  # (The cc escaped-quote-collapse rule cannot be expressed faithfully with
  # these globs — every cmd /c recursion is nested behind a second parser,
  # so its true target is undecidable: it moves to the ask section instead.)
  - command: [cmd, rmdir, del]
    args: [".git", ".git/*", "*/.git"]
    reason: "[deny-rule:cmd.recursive-delete-git-metadata] Never target .git."
  - command: [rmdir, del]
    args: [".", "./"]
    reason: "[deny-rule:cmd.recursive-delete-cwd-self] Deleting the current directory removes the project."
  - command: [rmdir, del]
    args: ["../*", "..\\\\*"]
    reason: "[deny-rule:cmd.recursive-delete-outside-cwd] Delete above cwd escapes task scope."

  # ── Secret targets (write/delete deny; reads are the ask section below) ──
  - command: ["rm#recursive", "remove-item#recursive", rmdir, del]
    args: ["*/.ssh", "*/.aws", "*/.gnupg", ".ssh", ".aws"]
    reason: "[deny-rule:secret.delete-credential-path] Deleting credential stores destroys keys you cannot regenerate."
  - command: [echo, "set-content", "out-file"]
    args: [".env", ".env.*"]
    reason: "[deny-rule:secret.write-overwrite-env] Overwriting .env destroys existing secrets. Edit specific lines."
  - command: ["rm#recursive", "remove-item#recursive", rmdir, del]
    args: ["*/.git-credentials", ".git-credentials"]
    reason: "[deny-rule:secret.delete-git-credentials] Deleting the git credential store breaks push/pull auth."

ask:
  # Force push: ask, not deny (revoked from cc's deny ruling 2026-10-13).
  - command: [git]
    argv: { pipeline: ["git push *--force*", "git push *-f*"] }
    reason: "[deny-rule:git.push-force] Force push rewrites shared history. Prefer git push --force-with-lease."

  # cmd /c recursion hides the real target behind a second parser (and quoting):
  # undecidable → ask, where cc denied only the drive-root-collapse variant.
  - command: [cmd]
    argv: { pipeline: ["cmd /c *rmdir /s*", "cmd /c *del /s*"] }
    reason: "[deny-rule:cmd.recursive-delete-nested] cmd /c recursion nests a second parser; the real target cannot be resolved. Run rmdir/del directly so the gate can see the target."

  # Dynamic targets: this gate's ruling is "undecidable → ask", not fail-closed deny.
  - command: ["rm#recursive", "remove-item#recursive"]
    args: ["$*"]
    reason: "[deny-rule:rm.recursive-force-dynamic-target] Recursive delete of a substitution-assembled target — verify the variable yourself."
  # The wrapper word xargs is stripped by the decomposer, so pipeline patterns
  # never see it — match the raw command string through the params dimension.
  - params: { command: ["*xargs rm*", "*xargs del*"] }
    reason: "[deny-rule:xargs.rm-recursive-force-dynamic] xargs-fed removals have unverifiable target sets."
  - command: [parallel]
    argv: { pipeline: ["parallel *rm*", "*| parallel*"] }
    reason: "[deny-rule:parallel.rm-recursive-force-dynamic] parallel-fed rm has unresolvable targets."
  - command: [awk]
    args: ["*system(*"]
    reason: "[deny-rule:awk.system-dynamic] awk program text containing system() cannot be analyzed."
  # NOTE: cc's git checkout <ref> <path> ambiguity (G5) is NOT ported — a glob
  # cannot tell ref candidates from paths, and a broad pattern would prompt on
  # every git checkout -b new-branch. Documented residual gap.

  # Credential reads: ask (A2 ruling kept; egress combos stay in the prompt layer).
  - command: [cat, head, tail, type, "get-content", ls, dir, "get-childitem", "select-string"]
    args: [".env", ".env.*", "*.env", ".npmrc", ".pypirc", ".netrc", ".git-credentials", "id_rsa", "id_ed25519", "id_ecdsa"]
    reason: "[deny-rule:secret.read-credential-file] Reading a credential file requires confirmation. Echo only the keys you need via a filtered command."
  - command: [cat, head, tail, type, "get-content", ls, dir, "get-childitem"]
    args: ["*/.ssh", "*/.ssh/*", "*/.aws", "*/.aws/*", "*/.gnupg", "*/.gnupg/*", "*/.config/gcloud/*", "*/.claude/*", "*/.codex/*"]
    reason: "[deny-rule:secret.read-home-credential-dirs] Browsing ssh/cloud/coding-CLI credential stores requires confirmation."

  # ── Credential family ladder (read side) ──────────────────────────────────
  # One row per family, restricted to the file-READ tools: decide() pre-queries the
  # rule layer for READ calls, so these rows are what a read hits (shell reads stay
  # under the secret.* rows above, which match first in this section). The settings
  # face rewrites each row as the family's rung: deny - moved to the deny section;
  # ask - stays here; readonly/readwrite - enabled:false (readwrite additionally
  # lists the family in credWriteExemptFamilies for the engine's write clause).
  # Custom credentialPaths have no family and are never write-exempt.
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.ssh", "*/.ssh/*", "*id_rsa", "*id_ed25519", "*id_ecdsa", "*id_dsa", "*authorized_keys"]
    reason: "[deny-rule:cred.ssh] Reading SSH keys or authorized_keys needs confirmation (family rung: ask)."
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.aws", "*/.aws/*", "*/.config/gcloud", "*/.config/gcloud/*", "*/.azure", "*/.azure/*", "*credentials.yaml", "*credentials.json"]
    reason: "[deny-rule:cred.cloud] Reading cloud-provider credential stores needs confirmation (family rung: ask)."
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.npmrc", "*.npmrc", "*/.pypirc", "*/.netrc", "*_netrc", "*/pip.conf"]
    reason: "[deny-rule:cred.package] Reading package-registry auth files needs confirmation (family rung: ask)."
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.git-credentials", "*.git-credentials"]
    reason: "[deny-rule:cred.gitcreds] Reading the git credential store needs confirmation (family rung: ask)."
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.env", "*/.env.*", "*.env"]
    reason: "[deny-rule:cred.env] Reading project env files needs confirmation (family rung: ask; readwrite also lets edits, npm-login-style)."
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.claude", "*/.claude/*", "*/.codex", "*/.codex/*", "*/.config/gh", "*/.config/gh/*"]
    reason: "[deny-rule:cred.cli] Reading coding-CLI credential stores needs confirmation (family rung: ask)."
  - tools: [read, read_image, grep, glob, ls, lsp]
    args: ["*/.pgpass", "*pgpass", "*/.my.cnf"]
    reason: "[deny-rule:cred.db] Reading database credential files needs confirmation (family rung: ask)."

  # Self-protection: editing the gate's own rule sources needs confirmation —
  # revocation must be a human act, not something an agent can slide through.
  # (Settings-namespace edits go through the host UI, not a tool call, and are
  # out of reach of this entry; documented gap.)
  - args: ["*rules.yml", "*rules.yaml", "*deny-defaults*"]
    reason: "[deny-rule:gate.self-protection] This call touches the permission gate's own rule sources; changes here alter what the gate enforces."
`;
/** Parsed preset document (module-level cache; throws on a malformed table — never silent). */
let presetDoc;
export function parsePresetDoc() {
    if (presetDoc === undefined)
        presetDoc = parsePermissionsDocument(PRESET_RULES_YAML);
    return presetDoc;
}
/** Every preset id, in table order. Client view + tests use this as the row key. */
export function presetRuleIds() {
    const doc = parsePresetDoc();
    return [...doc.deny, ...doc.ask].map((e) => presetRuleId(e.reason) ?? '');
}
/**
 * A rule entry as it is stored in a raw document (settings JSON / file YAML):
 * only the fields the author wrote — parse fills every dimension with empty
 * arrays, and an empty dimension means "no constraint", so round-tripping the
 * parsed shape verbatim would be noise (still valid, just bloated).
 */
function rawEntry(e) {
    const out = {};
    if (e.tools.length > 0)
        out.tools = e.tools;
    if (e.command.length > 0)
        out.command = e.command;
    if (e.args.length > 0)
        out.args = e.args;
    if (e.paths.length > 0)
        out.paths = e.paths;
    // `params` 是唯一「源形态 = 映射、编译形态 = ParamCondition[]」的维度（其余维度
    // 两者一致），所以不能直写 e.params：那会产出 `params: [{key,patterns,negated}]`，
    // 下次启动被 parseParamsDimension 拒（`params must be a mapping`）⇒ 插件不激活。
    // 反向映射时把 negation 还原成源头的 `!glob` 前缀写法（parse 就是这么判的）。
    if (e.params.length > 0) {
        const map = {};
        for (const cond of e.params) {
            map[cond.key] = cond.patterns.map((p) => (cond.negated && !p.startsWith('!') ? `!${p}` : p));
        }
        out.params = map;
    }
    if (e.absent.length > 0)
        out.absent = e.absent;
    if (e.agents.length > 0)
        out.agents = e.agents;
    if (e.when !== undefined)
        out.when = e.when;
    if (e.argv !== undefined)
        out.argv = e.argv;
    if (e.network !== undefined)
        out.network = e.network;
    if (e.branch !== undefined)
        out.branch = e.branch;
    out.reason = e.reason;
    out.enabled = e.enabled;
    return out;
}
function idsPresentIn(section) {
    const out = new Set();
    if (Array.isArray(section)) {
        for (const item of section) {
            if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                const id = presetRuleId(item.reason);
                if (id !== undefined)
                    out.add(id);
            }
        }
    }
    return out;
}
/**
 * Append missing preset entries to a RAW rules document object (bare or
 * `permissions:`-wrapped form). Idempotent and revocation-preserving: an id
 * already present — enabled or not — is never re-added. Mutates nothing;
 * returns the merged copy and the added count.
 */
export function mergePresetIntoRaw(rawDoc) {
    const root = rawDoc !== null && typeof rawDoc === 'object' && !Array.isArray(rawDoc)
        ? { ...rawDoc }
        : {};
    const wrapper = root['permissions'] !== null && typeof root['permissions'] === 'object' && !Array.isArray(root['permissions'])
        ? root['permissions']
        : root;
    const doc = root['permissions'] !== undefined ? root : { ...wrapper };
    const target = root['permissions'] !== undefined ? root['permissions'] : doc;
    let added = 0;
    const preset = parsePresetDoc();
    for (const [key, list] of [['deny', preset.deny], ['ask', preset.ask]]) {
        const existing = Array.isArray(target[key]) ? [...target[key]] : [];
        const have = idsPresentIn(existing);
        for (const entry of list) {
            const id = presetRuleId(entry.reason);
            if (id !== undefined && have.has(id))
                continue;
            existing.push(rawEntry(entry));
            added += 1;
        }
        target[key] = existing;
    }
    if (typeof doc.defaultAction !== 'string' && typeof target.defaultAction !== 'string') {
        target.defaultAction = 'ask';
    }
    return { doc, added };
}
/**
 * One-shot file seed: create the rules file from the preset when absent, or
 * append missing preset entries when present (comments in a hand-written file
 * are lost on rewrite — the file is the plugin's data dir, not user-authored
 * by default). A sibling marker file records that the seed ran: after a full
 * revocation (user deletes every preset entry) the seed must never re-add
 * them, and the marker works on hosts without the settings service where the
 * `presetRulesSeeded` config flag cannot be persisted. Returns what happened
 * for the log line.
 */
export function ensurePresetRulesFile(rulesFile, markerFile) {
    try {
        if (markerFile !== undefined && existsSync(markerFile))
            return { action: 'already-seeded', added: 0 };
        let result;
        if (!existsSync(rulesFile)) {
            writeFileSync(rulesFile, PRESET_RULES_YAML, 'utf8');
            result = { action: 'created', added: presetRuleIds().length };
        }
        else {
            const text = readFileSync(rulesFile, 'utf8');
            const root = text.trim() === '' ? {} : parse(text);
            const { doc, added } = mergePresetIntoRaw(root);
            if (added === 0) {
                result = { action: 'skipped', added: 0 };
            }
            else {
                writeFileSync(rulesFile, stringify(doc, { lineWidth: 0 }), 'utf8');
                result = { action: 'merged', added };
            }
        }
        if (markerFile !== undefined && result.action !== 'skipped') {
            try {
                writeFileSync(markerFile, new Date().toISOString(), 'utf8');
            }
            catch { /* marker is best-effort */ }
        }
        return result;
    }
    catch {
        // A broken user file must NOT be rewritten by the seed (fail-open on the
        // seed path only: the loader's own badFilePolicy still governs decisions).
        return { action: 'skipped', added: 0 };
    }
}
/**
 * The current rung per family, read out of a RAW rules document plus the write-exemption
 * list (GET side of the settings face; the card renders straight from this map).
 * A missing row reports 'ask' — the shipped default every fresh seed writes.
 */
export function credRungsOf(rawDoc, exempt = []) {
    const root = rawDoc !== null && typeof rawDoc === 'object' && !Array.isArray(rawDoc)
        ? rawDoc
        : {};
    const target = root['permissions'] !== null && typeof root['permissions'] === 'object' && !Array.isArray(root['permissions'])
        ? root['permissions']
        : root;
    const out = {};
    for (const family of CRED_FAMILY_IDS) {
        const tag = `cred.${family}`;
        let rung = 'ask';
        for (const key of ['deny', 'ask']) {
            const arr = Array.isArray(target[key]) ? target[key] : [];
            const row = arr.find((e) => presetRuleId(e.reason) === tag);
            if (row !== undefined) {
                if (row.enabled === false)
                    rung = exempt.includes(family) ? 'readwrite' : 'readonly';
                else
                    rung = key === 'deny' ? 'deny' : 'ask';
                break;
            }
        }
        out[family] = rung;
    }
    return out;
}
/**
 * Rewrite one `cred.<family>` row of a RAW rules document to the chosen rung, and
 * maintain the paired write-exemption list. Both stores are returned together; the
 * caller persists them in one settings update. Idempotent: applying the same rung
 * twice is a no-op. Revocation-preserving elsewhere untouched — this function only
 * ever moves or enables/disables the family's own row.
 *
 * `readonly` and `readwrite` both disable the read row (reads then fall through to
 * the READ auto-allow); they differ only in `exempt`: readwrite additionally lists
 * the family, which steps the engine's credential-store WRITE clause aside for that
 * family's built-in paths — and nothing else.
 */
export function setCredFamilyAction(rawDoc, exempt, family, rung) {
    const root = rawDoc !== null && typeof rawDoc === 'object' && !Array.isArray(rawDoc)
        ? { ...rawDoc }
        : {};
    const hasWrapper = root['permissions'] !== null && typeof root['permissions'] === 'object' && !Array.isArray(root['permissions']);
    // Always work on a fresh wrapper copy — the shared `permissions` object is frozen
    // on the live host, and `defaultAction` writes below must not hit it.
    const target = hasWrapper ? { ...root['permissions'] } : root;
    if (hasWrapper)
        root['permissions'] = target;
    const tag = `cred.${family}`;
    // Settings snapshots are deep-frozen on the live host: containers AND elements.
    // Every section array we touch is replaced by a copy first — `splice` on a frozen
    // array throws in strict mode (`Cannot delete property`), the same class of failure
    // as the frozen-row write. Copy-on-write for arrays and rows alike.
    const takeSection = (key) => {
        const cur = Array.isArray(target[key]) ? target[key] : [];
        const copy = [...cur];
        target[key] = copy;
        return copy;
    };
    // Detach this family's row from wherever it sits. NO whole-table merge here: the
    // merge dedupes per section, so a row previously moved deny↔ask would be
    // re-appended to its preset section and the rung would silently revert (measured
    // on the frozen-snapshot regression). Only this family's row is touched.
    let entry;
    for (const key of ['deny', 'ask']) {
        const arr = takeSection(key);
        const i = arr.findIndex((e) => presetRuleId(e.reason) === tag);
        if (i >= 0) {
            // Copy before mutate: settings snapshots are deep-frozen on the live host.
            entry = { ...arr.splice(i, 1)[0] };
            break;
        }
    }
    if (entry === undefined) {
        // Row absent (fresh doc or pruned): seed just this family's preset row.
        const src = parsePresetDoc().ask.find((e) => presetRuleId(e.reason) === tag);
        if (src !== undefined)
            entry = rawEntry(src);
    }
    if (entry !== undefined) {
        entry.enabled = rung !== 'readonly' && rung !== 'readwrite';
        const destKey = rung === 'deny' ? 'deny' : 'ask';
        const dest = takeSection(destKey);
        dest.push(entry);
    }
    if (typeof root.defaultAction !== 'string' && typeof target.defaultAction !== 'string') {
        target.defaultAction = 'ask';
    }
    const nextExempt = rung === 'readwrite' ? [...new Set([...exempt, family])] : exempt.filter((f) => f !== family);
    return { doc: root, exempt: nextExempt };
}
