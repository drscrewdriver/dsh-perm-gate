export interface ScriptRef {
    /** Exactly as it appeared in the command, so the ask context can match coverage. */
    readonly ref: string;
    /** Which interpreter runs it (`bash`, `pwsh`, … or `direct` for `./x.sh`). */
    readonly interpreter: string;
}
/**
 * Every script file the command runs, in order of appearance, deduplicated.
 *
 * Shapes covered: `bash x.sh`, `pwsh -File x.ps1`, `python -m pkg` (no file — nothing
 * is returned), `node -e 'code'` (inline — nothing returned), `./deploy.sh`,
 * `~/scripts/clean.sh`, `source env.sh`, `cmd /c build.bat`, and a pipeline of several
 * of them. A `-c`/`-Command` payload is deliberately *not* mined for a nested script
 * name: the code text is already what the gate grades.
 */
export declare function scriptRefs(commandText: string): readonly ScriptRef[];
/** One script the call will run, with the text the reviewer gets. */
export interface ScriptContent extends ScriptRef {
    /** Absolute path actually read. */
    readonly path: string;
    readonly body: string;
    /** True when the file is longer than the budget and `body` is a prefix. */
    readonly truncated: boolean;
    /** Set instead of `body` when nothing could be read (never silently empty). */
    readonly unreadable?: 'missing' | 'not-a-file' | 'too-large' | 'binary' | 'unreadable';
    readonly bytes: number;
}
/** Reading budget: enough for a real script, small enough for one grader round-trip. */
export declare const SCRIPT_REVIEW_MAX_BODY_CHARS = 20000;
export declare const SCRIPT_REVIEW_MAX_FILE_BYTES = 512000;
export declare const SCRIPT_REVIEW_MAX_FILES = 4;
/** `~` expansion plus cwd-relative resolution, without touching the filesystem. */
export declare function resolveScriptPath(ref: string, cwd: string): string;
/**
 * Read the bodies of {@link scriptRefs}, bounded and best-effort: a file that cannot be
 * read is *reported* as such (`unreadable`), because "we looked and could not see" is
 * information the reviewer needs, while an empty body would read as a benign script.
 *
 * Never throws — a missing file, a permission error, or an undecodable blob all come
 * back as a labelled entry.
 */
export declare function readScriptContents(refs: readonly ScriptRef[], cwd: string, limits?: {
    readonly maxFiles?: number;
    readonly maxBodyChars?: number;
    readonly maxFileBytes?: number;
}): readonly ScriptContent[];
/** Whether every script the call runs has been read (i.e. the payload is now visible). */
export declare function scriptsFullyCovered(refs: readonly ScriptRef[], contents: readonly ScriptContent[]): boolean;
/** The readable summary the deterministic layers judge a script body alongside. */
export declare function scriptBodyText(contents: readonly ScriptContent[]): string;
