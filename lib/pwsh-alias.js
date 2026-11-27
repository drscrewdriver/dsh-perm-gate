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
export const PWSH_ALIASES = new Map([
    // deletion
    ['rd', 'remove-item'],
    ['ri', 'remove-item'],
    ['rm', 'remove-item'],
    ['del', 'remove-item'],
    ['erase', 'remove-item'],
    ['rmdir', 'remove-item'],
    ['rmo', 'remove-item'],
    // movement / copy / rename
    ['move', 'move-item'],
    ['mv', 'move-item'],
    ['cp', 'copy-item'],
    ['copy', 'copy-item'],
    ['cpi', 'copy-item'],
    ['ren', 'rename-item'],
    ['rni', 'rename-item'],
    // content writes
    ['clc', 'clear-content'],
    ['sc', 'set-content'],
    ['ac', 'add-content'],
    ['ni', 'new-item'],
    ['si', 'set-item'],
    ['rp', 'remove-itemproperty'],
    ['epcsv', 'export-csv'],
    // network fetch (a download into a staging dir is the first half of an upload)
    ['iwr', 'invoke-webrequest'],
    ['curl', 'invoke-webrequest'],
    ['wget', 'invoke-webrequest'],
    ['irm', 'invoke-restmethod'],
    // process / expression execution
    ['iex', 'invoke-expression'],
    ['saps', 'start-process'],
    ['start', 'start-process'],
    ['kill', 'stop-process'],
    ['spps', 'stop-process'],
]);
/** Strip a trailing executable suffix so `rd.exe` still resolves. */
function bare(program) {
    return program.toLowerCase().trim().replace(/\.(?:exe|cmd|bat|com)$/, '');
}
/**
 * Expand one already-lower-case program name to its standard cmdlet.
 * A non-alias is returned unchanged, so this is safe to call unconditionally.
 */
export function expandPwshAlias(program) {
    const name = bare(program);
    return PWSH_ALIASES.get(name) ?? name;
}
/**
 * Every spelling that must take part in a destructive classification: the
 * program as written plus its expansion (as a union, never a replacement).
 * Duplicates collapse, so `remove-item` yields exactly one entry.
 */
export function pwshAliasVariants(program) {
    const name = bare(program);
    const expanded = PWSH_ALIASES.get(name);
    return expanded === undefined || expanded === name ? [name] : [name, expanded];
}
/**
 * Expand the first word of a command line, keeping the rest verbatim.
 * Used by the normalizer to add one union variant per command; a line that
 * begins with an option (`-Recurse`) or a path is returned unchanged.
 */
export function expandLeadingProgram(command) {
    const match = /^(\s*)([A-Za-z][\w.-]*)(?=[\s]|$)/.exec(command);
    if (match === null)
        return undefined;
    const program = match[2] ?? '';
    const expanded = PWSH_ALIASES.get(bare(program));
    if (expanded === undefined)
        return undefined;
    const head = match[1] ?? '';
    const rest = command.slice(head.length + program.length);
    // Keep the casing of the tail (arguments are case-sensitive paths).
    return head + expanded + rest;
}
