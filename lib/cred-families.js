/**
 * Credential families — one shared answer to "which kind of secret is this path".
 *
 * The settings face exposes a four-step ladder per family (deny / ask / readonly /
 * readwrite); the ladder's write side is enforced by `engine.hardDenyReason`, which
 * consults `familyOfPath` against the `credWriteExemptFamilies` opt-out list. The
 * exemption is deliberately coarse: family-level, binary, and it steps aside for
 * exactly one P0 clause (the credential-store mutation floor). Root/drive wipes,
 * protected destructive targets and the neverClear family are NOT family-scoped and
 * stay armed whatever a user selects.
 *
 * Pure string work (no fs, no execution), so the client bundle can render the family
 * roster from the same table. Matching reuses `compileCredentialPaths`, keeping glob
 * semantics identical to the `credentialPaths` setting — one vocabulary, two uses.
 */
import { compileCredentialPaths } from './credential-paths.js';
/**
 * Every family id, in the order the settings face should offer them. Lowercase +
 * dots/dashes only: the ids ride inside the `[deny-rule:<id>]` tag, whose pattern
 * does not accept uppercase (a `gitCreds` tag would never parse and the row could
 * never be located for revocation).
 */
export const CRED_FAMILY_IDS = ['ssh', 'cloud', 'package', 'gitcreds', 'env', 'cli', 'db'];
/**
 * Built-in path patterns per family, aligned with the P0 sensitive list (`path.ts`)
 * and the cc-safety-net secret shapes the deny table was ported from. `~` forms are
 * home-relative (the matcher strips or expands them); a bare dotted name is a
 * segment-tail fragment matched at any depth.
 */
export const CRED_FAMILIES = {
    ssh: ['~/.ssh', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'authorized_keys'],
    cloud: ['~/.aws', '~/.gcloud', '~/.config/gcloud', '~/.azure', '~/.azure/**', 'credentials.yaml', 'credentials.json'],
    package: ['~/.npmrc', '.npmrc', '~/.pypirc', '~/.netrc', '.netrc', '.pypirc', '_netrc', '~/.pip/pip.conf'],
    gitcreds: ['~/.git-credentials', '.git-credentials'],
    env: ['.env', '.env.*', '*.env'],
    cli: ['~/.claude', '~/.claude/**', '~/.codex', '~/.codex/**', '~/.config/gh', '~/.config/gh/**'],
    db: ['~/.pgpass', 'pgpass', '~/.my.cnf', '.my.cnf'],
};
/** One compiled matcher per family (lazy; compile is pure and cheap, memoize anyway). */
const matcherCache = new Map();
function familyMatcher(family) {
    let m = matcherCache.get(family);
    if (m === undefined) {
        m = compileCredentialPaths(CRED_FAMILIES[family], { caseInsensitive: true });
        matcherCache.set(family, m);
    }
    return m;
}
/**
 * Which credential family, if any, claims this path. First family in
 * {@link CRED_FAMILY_IDS} order wins (ssh before package etc.), so a path cannot
 * flip families between calls. `undefined` = not a built-in credential path —
 * custom `credentialPaths` entries have no family and can never be write-exempt.
 */
export function familyOfPath(path) {
    if (path === undefined || path.trim() === '')
        return undefined;
    for (const family of CRED_FAMILY_IDS) {
        if (familyMatcher(family)(path))
            return family;
    }
    return undefined;
}
