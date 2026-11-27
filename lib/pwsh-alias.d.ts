/**
 * PowerShell alias expansion - one table, one function, no side effects.
 *
 * Why: the destructive-program tables in irreversible.ts were hard-coded four
 * times, and all four lists were missing the PowerShell aliases `rd` and `ri`
 * (`rd C:\Windows -Recurse -Force` is `Remove-Item`, and it was graded as an
 * unknown program). Patching two words would leave the next alias just as
 * blind, so the root cause fixed here is the RULE, not the two spellings:
 * aliases resolve to their cmdlet before any destructive classification runs.
 *
 * The direction is one-way - expansion can only make a call look MORE
 * dangerous, never less:
 *
 * - Only destructive / writing aliases are listed. `ls`, `dir`, `cat`, `gc`,
 *   `type` are read-only and expanding them would only add noise to the P0
 *   path without changing a single verdict.
 * - Callers use the UNION (original + expanded), never a replacement: a
 *   user-defined `function rd {}` does not beat the built-in alias in
 *   PowerShell (aliases resolve first), so both spellings must be judged.
 * - The original token is never discarded, so logs and reasons still quote
 *   what the user actually typed.
 */
/** PowerShell built-in alias (lower-case, no `.exe`) -> standard cmdlet name. */
export declare const PWSH_ALIASES: ReadonlyMap<string, string>;
/**
 * Expand one already-lower-case program name to its standard cmdlet.
 * A non-alias is returned unchanged, so this is safe to call unconditionally.
 */
export declare function expandPwshAlias(program: string): string;
/**
 * Every spelling that must take part in a destructive classification: the
 * program as written plus its expansion (as a union, never a replacement).
 * Duplicates collapse, so `remove-item` yields exactly one entry.
 */
export declare function pwshAliasVariants(program: string): readonly string[];
/**
 * Expand the first word of a command line, keeping the rest verbatim.
 * Used by the normalizer to add one union variant per command; a line that
 * begins with an option (`-Recurse`) or a path is returned unchanged.
 */
export declare function expandLeadingProgram(command: string): string | undefined;
