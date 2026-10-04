/** Sandbox-relevant settings, resolved from the volatile config each read. */
export interface SandboxSettings {
    readonly enabled: boolean;
    readonly mode: 'read-only' | 'workspace-write';
    /** '' = follow the builtin filtered proxy; otherwise an explicit loopback URL. */
    readonly proxy: string;
    readonly loopback: 'exempt' | 'off';
}
/** What the gate should do with an allowed shell call. */
export type SandboxRewriteResult = {
    readonly kind: 'wrap';
    readonly command: string;
} | {
    readonly kind: 'deny';
    readonly reason: string;
};
/** The call face the controller needs (subset of ToolExecutionLike). */
export interface SandboxCall {
    readonly name: string;
    readonly arguments: Record<string, unknown>;
    readonly cwd?: string;
}
export interface SandboxControllerDeps {
    /** Default workspace when the call carries no cwd (the host process cwd). */
    readonly cwdRoot: () => string;
    /** The builtin filtered proxy's actually-bound port, when it is up. */
    readonly builtinProxyPort: () => number | undefined;
    readonly log: (message: string) => void;
    readonly platform?: () => NodeJS.Platform;
    readonly now?: () => number;
}
/**
 * Workspace roots that must never receive container ACEs: granting the whole
 * user profile / a drive root / the OS directory turns "workspace-write" into
 * a machine-wide write grant (R3). Returns the denial reason or undefined.
 */
export declare function isForbiddenWorkspace(workspace: string, home?: string, winDir?: string): string | undefined;
export declare class SandboxController {
    private readonly deps;
    private launcherPromise;
    private probe;
    private tempRoot;
    private configRoot;
    private exemptSettled;
    private exemptLastAttempt;
    private sid;
    private swept;
    constructor(deps: SandboxControllerDeps);
    private get platform();
    private get now();
    /** Comparison key for change detection (settings-edit → re-ensure). */
    static keyOf(settings: SandboxSettings, sid: string): string;
    /**
     * Compile the launcher once per source hash, ask it for the OS-derived
     * container SID, and run the one-shot `--probe` verdict. Failures are NOT
     * cached (a missing csc may appear after a .NET install — retry next call);
     * the loopback exemption settles only on success (a failure retries with
     * backoff — a transient denial must not disable loopback for the process
     * lifetime).
     */
    ensure(settings: SandboxSettings): Promise<{
        exePath: string;
        hash: string;
    } | undefined>;
    /** The proxy URL injected into sandboxed processes, if any. */
    resolveProxyUrl(settings: SandboxSettings): string | undefined;
    /**
     * Gate-aware rewrite of one allowed shell call: undefined (not applicable —
     * disabled / not a shell tool / non-Windows), wrap (the rewritten command),
     * or deny (fail-closed when the sandbox is on but cannot be honored).
     */
    wrap(settings: SandboxSettings, exec: SandboxCall): Promise<SandboxRewriteResult | undefined>;
    /** One standing scratch dir per plugin process, removed on dispose. */
    private ensureTempDir;
    /** Private config dir — NOT container-writable (R5). */
    private ensureConfigDir;
    /** Best-effort scratch cleanup at plugin dispose. */
    dispose(): Promise<void>;
    /**
     * One-shot housekeeping: orphan scratch dirs (crashed processes leak them —
     * 6 found on this machine) older than 24h, and stale compile-cache exes
     * older than 7 days. Best effort, once per process.
     */
    private sweep;
}
