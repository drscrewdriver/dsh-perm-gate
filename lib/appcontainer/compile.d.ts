/** The shipped C# launcher source (read-only asset). */
export declare const LAUNCHER_SOURCE: string;
/** Locate the .NET Framework C# compiler, or undefined when absent. */
export declare function locateCsc(): string | undefined;
export interface CompiledLauncher {
    readonly exePath: string;
    readonly cached: boolean;
}
/**
 * Compile (or reuse) the launcher for the current source hash. Returns the exe
 * path; undefined means the platform cannot provide one (no csc) — callers
 * must treat sandbox mode as unavailable (fail-closed), never run unwrapped.
 */
export declare function ensureLauncher(): Promise<CompiledLauncher | undefined>;
