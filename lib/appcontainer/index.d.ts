import { type CompiledLauncher } from './compile.js';
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
}
export declare class SandboxController {
    private readonly deps;
    private launcher;
    private launcherPromise;
    private tempRoot;
    private exemptKey;
    private sid;
    constructor(deps: SandboxControllerDeps);
    /** Comparison key for change detection (settings-edit → re-ensure). */
    static keyOf(settings: SandboxSettings, sid: string): string;
    /**
     * Compile the launcher once per source hash, ask it once for the OS-derived
     * container SID (`--print-sid`), and record the loopback exemption once per
     * (sid, loopback setting). Memoized; failures are NOT cached (a missing csc
     * may appear after a .NET install — retry next call).
     */
    ensure(settings: SandboxSettings): Promise<CompiledLauncher | undefined>;
    /** The proxy URL injected into sandboxed processes, if any. */
    resolveProxyUrl(settings: SandboxSettings): string | undefined;
    /**
     * Gate-aware rewrite of one allowed shell call: undefined (not applicable —
     * disabled / not a shell tool), wrap (the rewritten command), or deny
     * (fail-closed when the sandbox is on but cannot be honored).
     */
    wrap(settings: SandboxSettings, exec: SandboxCall): Promise<SandboxRewriteResult | undefined>;
    /** One standing scratch dir per plugin process, removed on dispose. */
    private ensureTempDir;
    /** Best-effort scratch cleanup at plugin dispose. */
    dispose(): Promise<void>;
}
