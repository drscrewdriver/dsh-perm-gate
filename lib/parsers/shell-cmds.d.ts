/**
 * Shell dangerous commands parser - rm, mv, cp, chmod, dd, diskpart, etc.
 * P1 priority - detects destructive filesystem operations.
 *
 * Handles:
 * - rm -rf / recursive deletion
 * - mv overwriting existing files
 * - cp -r with destructive patterns
 * - chmod/chown with system directories
 * - dd writing to disk
 * - diskpart on Windows
 * - format disk operations
 * - PowerShell Remove-Item with dangerous patterns
 */
import type { CommandParser, CommandSemantics } from '../command-semantics.js';
export declare class ShellDangerousParser implements CommandParser {
    readonly name = "shell-dangerous";
    readonly priority = 20;
    canParse(command: string): boolean;
    parse(command: string): CommandSemantics | null;
    private extractBaseName;
    private parseRm;
    private parseMv;
    private parseCp;
    private parseChmod;
    private parseDd;
    private parseDiskpart;
    private parsePowerShellRemove;
    private parseArchive;
    private extractArgs;
    private extractFlags;
}
