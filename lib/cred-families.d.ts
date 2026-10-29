export type CredFamily = 'ssh' | 'cloud' | 'package' | 'gitcreds' | 'env' | 'cli' | 'db';
/**
 * Every family id, in the order the settings face should offer them. Lowercase +
 * dots/dashes only: the ids ride inside the `[deny-rule:<id>]` tag, whose pattern
 * does not accept uppercase (a `gitCreds` tag would never parse and the row could
 * never be located for revocation).
 */
export declare const CRED_FAMILY_IDS: readonly CredFamily[];
/**
 * Built-in path patterns per family, aligned with the P0 sensitive list (`path.ts`)
 * and the cc-safety-net secret shapes the deny table was ported from. `~` forms are
 * home-relative (the matcher strips or expands them); a bare dotted name is a
 * segment-tail fragment matched at any depth.
 */
export declare const CRED_FAMILIES: Readonly<Record<CredFamily, readonly string[]>>;
/**
 * Which credential family, if any, claims this path. First family in
 * {@link CRED_FAMILY_IDS} order wins (ssh before package etc.), so a path cannot
 * flip families between calls. `undefined` = not a built-in credential path —
 * custom `credentialPaths` entries have no family and can never be write-exempt.
 */
export declare function familyOfPath(path: string | undefined): CredFamily | undefined;
