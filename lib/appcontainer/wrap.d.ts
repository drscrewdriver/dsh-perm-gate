/** One sandboxed-execution plan: everything the launcher needs, on disk. */
export interface SandboxLaunchConfig {
    /** The session workspace the command runs in (cwd + ACL grant root). */
    readonly workspace: string;
    /** Per-call scratch dir created by the Node side; the launcher gets it via env. */
    readonly tempDir: string;
    /** 'read-only' grants RX on the workspace; 'workspace-write' adds Modify. */
    readonly mode: 'read-only' | 'workspace-write';
    /** Exact env overrides for the child (HTTPS_PROXY etc.). Empty keys delete. */
    readonly proxyEnv: Readonly<Record<string, string>>;
}
/** Serialize + persist one launch config, returning the path to hand the launcher. */
export declare function writeLaunchConfig(config: SandboxLaunchConfig, configDir: string): Promise<string>;
/** base64url-free standard base64 of the UTF-8 command text. */
export declare function encodeCommand(command: string): string;
export declare function decodeCommand(encoded: string): string;
/**
 * The command line the outer shell executes instead of the original one.
 * Single quoted-exe invocation; `=` padding and the alnum base64 body are
 * inert in cmd.exe and POSIX shells alike.
 */
export declare function buildWrappedCommand(launcherPath: string, configPath: string, command: string): string;
