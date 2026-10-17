/**
 * User-declared credential paths — the long tail the built-in list cannot know.
 *
 * The built-in credential set (`.ssh`, `.aws`, `.npmrc`, `credentials.yaml`, …) ships in
 * `path.ts` because the layer that needs it is P0: a `read`/`grep` call is auto-allowed
 * one stage before the rule chain runs, and mutating a file tool never reaches a model
 * that could be talked out of it. That is also why this cannot simply be "add a rule to
 * `rules.yml`" for the read side — see the note in `runtime.ts` about why the auto-allow
 * does not consult the ruleset (preset entries and hand-written entries live in one
 * document with no provenance, so `.dsh/**` would start blocking legitimate memory
 * reads).
 *
 * So the *list* is what a user extends, through the `credentialPaths` setting, and the
 * *tier* stays where it has to be: a listed path gets the same treatment as the
 * built-ins — reading it outside the workspace is refused, writing it is refused.
 *
 * Matching is pure string work: no filesystem access, no resolution, no execution. A
 * pattern that cannot be understood is dropped rather than guessed at — an unreadable
 * entry must not silently become "protects everything".
 */
/** Normalized, lowercase-able comparison form for a path or pattern. */
function norm(p, caseInsensitive) {
    const slashed = p.trim().replace(/[\\/]+/g, '/');
    const stripped = slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed;
    return caseInsensitive ? stripped.toLowerCase() : stripped;
}
/** Escape regex metacharacters that carry no meaning in a path glob. */
function escapeRe(s) {
    return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}
/**
 * Translate a path glob into a regex source.
 *
 * `**` is translated through a placeholder so it can be restored *after* the
 * single-`*` rule ran — replacing them in the naive order turns `**` into `[^/]*[^/]*`,
 * which silently stops crossing directories, i.e. `secrets/**` would match nothing.
 */
function globSource(glob) {
    const CROSS = '\u0000';
    return escapeRe(glob)
        .replace(/\*\*/g, CROSS)
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .split(CROSS)
        .join('.*');
}
/**
 * Compile one entry into a matcher over an already-normalized path.
 *
 * - contains `*` or `?` → glob: a double star crosses directories, a single star and
 *   a question mark stay inside one. A pattern that is not absolute (no leading slash,
 *   no drive letter) and does not already start with a crossing star is additionally
 *   allowed to match at any depth (`secrets/STAR.env` covers `a/b/secrets/x.env`),
 *   because that is what people mean when they write a relative glob.
 * - no wildcard → path fragment: matches the path itself, or a whole leading/inner
 *   segment run (`myco/token`, `.myco_token`, `vault/prod.env`).
 */
function compileEntry(raw, caseInsensitive) {
    const entry = norm(raw, caseInsensitive);
    if (entry === '' || entry === '/' || entry === '*')
        return undefined;
    const anchored = entry.startsWith('/') || /^[a-z]:/i.test(entry);
    if (/[*?]/.test(entry)) {
        const body = globSource(entry);
        const source = anchored ? `^${body}$` : `(?:^|.*/)${body}$`;
        let re;
        try {
            re = new RegExp(source, caseInsensitive ? 'i' : '');
        }
        catch {
            return undefined;
        }
        return (path) => re.test(path);
    }
    // A plain entry is a path fragment, matched on segment boundaries only: `token` must
    // not protect nothing while `.env` silently matches `ambient.txt`.
    const withLead = entry.startsWith('.') || entry.includes('/') ? entry : `/${entry}`;
    return (path) => path === entry || path.endsWith(withLead) || path.includes(`${withLead}/`) || (anchored && path.startsWith(entry));
}
/**
 * Compile the configured credential paths into one predicate.
 *
 * Returns a matcher that answers `false` for an empty or unusable list, so callers can
 * pass the raw setting straight through. `home` expands a leading `~/` the way a shell
 * would, because the setting is written in home-relative form (`~/.myco/vault.token`)
 * while the paths being judged are absolute. **Without `home`** the `~/` is stripped and
 * the rest matched as a path fragment — a declared secret must not silently stop
 * protecting because one caller did not know the user directory; the widened tail match
 * only ever denies more, never less.
 */
export function compileCredentialPaths(entries, opts = {}) {
    const caseInsensitive = opts.caseInsensitive ?? true;
    const home = opts.home;
    const matchers = [];
    for (const raw of entries ?? []) {
        if (typeof raw !== 'string')
            continue;
        let text = raw.trim();
        if (text === '')
            continue;
        if (text === '~' || text.startsWith('~/') || text.startsWith('~\\')) {
            const rest = text.slice(1).replace(/^[\\/]/, '');
            text = home !== undefined && home !== ''
                ? `${home.replace(/[\\/]+$/, '')}/${rest}`
                // No home known: keep the tail. `~/.myco/vault.token` becomes `.myco/vault.token`,
                // which still matches any user directory's copy of it.
                : rest;
        }
        const m = compileEntry(text, caseInsensitive);
        if (m !== undefined)
            matchers.push(m);
    }
    if (matchers.length === 0)
        return () => false;
    return (path) => {
        const p = norm(path, caseInsensitive);
        return p !== '' && matchers.some((m) => m(p));
    };
}
