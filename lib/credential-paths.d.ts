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
export declare function compileCredentialPaths(entries: readonly string[] | undefined, opts?: {
    readonly caseInsensitive?: boolean;
    readonly home?: string;
}): (path: string) => boolean;
