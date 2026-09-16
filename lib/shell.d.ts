/**
 * Shell command decomposition for dsh-perm-gate.
 *
 * Turns a raw command-string argument into a list of SIMPLE commands: each
 * simple command is a `command` word plus `args` and `redirect` tokens. It
 * recognizes pipelines/`&&`/`;` at the top level, strips common prefix wrappers
 * (`env`, `sudo`, `command`, literal-prefix `\`), and RECURSIVELY descends into
 * `sh -c "..."` / `bash -c "..."` / `powershell -Command "..."` so that
 * `sh -c "rm -rf /"` matches the same way as a bare `rm -rf /`.
 *
 * Pure: no filesystem/process state.
 */
export interface SimpleCommand {
    /** The command word (env/prefix wrappers stripped, `\,` backtick un-escaped). */
    readonly command: string;
    /** Argument tokens (redirect targets are NOT part of `args`). */
    readonly args: readonly string[];
    /** Redirect targets (`>`, `>>`, `<`) — treated as argument-token candidates too. */
    readonly redirects: readonly string[];
}
export type CmdFlag = 'recursive' | 'force';
/**
 * Tokenize a shell string into tokens, honoring single/double quotes and a few
 * common escapes. Missing/EOF quotes throw so the caller can route an
 * undecidable command to `ask` rather than guessing.
 */
export declare function tokenizeShell(text: string): string[];
/**
 * Recursively decompose a command string into simple commands, descending into
 * `-c`/`-Command` inline scripts. Throws on undecidable syntax (unclosed quote);
 * callers route that to `ask`, never `allow`.
 */
export declare function decomposeShellCommand(text: string): {
    commands: SimpleCommand[];
};
/** Whether a simple command's args carry a `recursive` deletion modifier. */
export declare function isRecursiveDeletion(cmd: SimpleCommand): boolean;
export declare function isForceDeletion(cmd: SimpleCommand): boolean;
