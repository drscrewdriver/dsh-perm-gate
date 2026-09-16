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
