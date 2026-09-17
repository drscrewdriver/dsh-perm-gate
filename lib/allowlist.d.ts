/**
 * Minimal face of the DSH settings scope the rules namespace is bound to
 * (`scope.get()` / `scope.update(patch)`; the host merges a patch into the
 * user layer, replacing arrays wholesale).
 */
export interface SettingsRulesScope {
    get(): unknown;
    update(patch: object): Promise<unknown> | unknown;
}
/** The allow-list command patterns currently in the settings rules document (read-only). */
export declare function listAllowFromRulesDoc(doc: unknown): string[];
/**
 * Append one command pattern as a new `allow` entry in the settings rules
 * namespace. When the namespace is still unconfigured (bare defaults) and a
 * file document is supplied, the namespace is seeded from it first — the
 * implicit migration — so the first settings write cannot shadow file-defined
 * deny/ask rules. Returns false when the scope rejects the write.
 */
export declare function appendAllowToSettings(scope: SettingsRulesScope, pattern: string, reason?: string, seed?: unknown): Promise<boolean>;
/**
 * Replace the settings rules namespace's `allow` whitelist with exactly the
 * given command patterns (one allow entry per pattern); empty clears it.
 * Other sections (deny / ask / defaultAction) are preserved — seeded from the
 * file document on the namespace's first write. Returns false when the scope
 * rejects the write.
 */
export declare function replaceAllowInSettings(scope: SettingsRulesScope, patterns: readonly string[], reason?: string, seed?: unknown): Promise<boolean>;
/**
 * Append one command pattern as a new `allow` entry in the rules file.
 * Returns false (leaving the file untouched) on any I/O or shape error.
 * @param rulesFile - absolute or relative path to the permissions YAML.
 * @param pattern - command word (glob) to whitelist, e.g. `git push`.
 * @param reason - human-readable reason recorded on the allow entry.
 */
export declare function appendAllowCommand(rulesFile: string, pattern: string, reason?: string): boolean;
/** The allow-list command patterns currently in the rules file (read-only). */
export declare function listAllowCommands(rulesFile: string): string[];
/**
 * Replace the rules file's `allow` whitelist with exactly the given command
 * patterns (one allow entry per pattern). Other sections (deny / ask /
 * defaultAction) are preserved. Returns false on any I/O or shape error.
 * @param rulesFile - absolute or relative path to the permissions YAML.
 * @param patterns - exact command-pattern list to set; empty clears the whitelist.
 * @param reason - reason recorded on each generated allow entry.
 */
export declare function replaceAllowCommands(rulesFile: string, patterns: readonly string[], reason?: string): boolean;
