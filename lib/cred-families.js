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
    // ssh: the dotted variants (id_rsa.bak / .old / .pem …) ride the cc-safety-net
    // secret.variant.* shapes — keys get copied and renamed, and a backup of a
    // private key is still a private key. Anchored at the segment start, so
    // `myid_rsa.notes` stays unclaimed.
    ssh: ['~/.ssh', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'authorized_keys', 'id_rsa.*', 'id_ed25519.*', 'id_ecdsa.*', 'id_dsa.*'],
    // cloud: kube/docker/gcp ride the cc-safety-net secret.home.* shapes —
    // `kubectl`/`docker login`/gcloud store live registry/cluster credentials in
    // exactly these files, backup suffixes included (.kube/config.bak etc.).
    cloud: ['~/.aws', '~/.gcloud', '~/.config/gcloud', '~/.azure', '~/.azure/**', 'credentials.yaml', 'credentials.json', '~/.gcp', '~/.gcp/**', '~/.kube/config', '~/.kube/config.*', '~/.docker/config.json', '~/.docker/config.json.*'],
    package: ['~/.npmrc', '.npmrc', '~/.pypirc', '~/.netrc', '.netrc', '.pypirc', '_netrc', '~/.pip/pip.conf'],
    gitcreds: ['~/.git-credentials', '.git-credentials'],
    env: ['.env', '.env.*', '*.env'],
    // cli: the ten coding-CLI credential stores cc covers beyond claude/codex/gh,
    // at cc's FILE precision (exact enumeration — the glob compiler caps at two
    // star runs, and cc's own catalog is a per-file list anyway). Credential files
    // only; config files stay out (cc marks the config category defaultOff for
    // the same false-positive reason).
    cli: ['~/.claude', '~/.claude/**', '~/.codex', '~/.codex/**', '~/.config/gh', '~/.config/gh/**', '~/.gemini/oauth_creds.json', '~/.gemini/mcp-oauth-tokens.json', '~/.gemini/a2a-oauth-tokens.json', '~/.gemini/gemini-credentials.json', '~/.copilot/config.json', '~/.copilot/mcp-oauth-config', '~/.copilot/mcp-secrets', '~/.kimi-code/credentials', '~/.kimi-code/server.token', '~/.kimi/credentials', '~/.kimi/mcp-oauth', '~/.local/share/opencode/auth.json', '~/.local/share/opencode/mcp-auth.json', '~/.local/share/opencode/opencode.db', '~/.pi/agent/auth.json', '~/.local/share/amp/secrets.json', '~/.amp/oauth', '~/.cursor/auth.json', '~/.cursor/projects/*/mcp-auth.json', '~/.config/cursor/auth.json', '~/.grok/mcp_credentials.json', '~/.factory/auth*', '~/.local/share/devin/*'],
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
