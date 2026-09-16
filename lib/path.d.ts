/**
 * Path containment and normalization for dsh-perm-gate, plus a session-scoped
 * artifact registry that tracks files a session created so deletion of
 * same-session artifacts can be cleaned up without widening authority.
 *
 * Containment helpers are pure string operators (testable); the registry is
 * the one stateful piece and stays in-process for a session.
 */
export declare function toPosix(p: string): string;
/**
 * Normalize one candidate path against the workspace root to a
 * workspace-relative posix path. Candidates OUTSIDE the root yield `''`.
 * `caseInsensitive` (Windows default) compares drive/root prefixes case-insensitively.
 */
export declare function normalizeWorkspacePath(cwd: string, candidate: string, caseInsensitive?: boolean): string;
export declare function isWithin(base: string, target: string): boolean;
/** Sensitive credential-ish path roots that reads/writes should route to review. */
export declare function isSensitivePath(p: string): boolean;
/** Root-level / DSH_HOME / home/system paths that must never be mutated. */
export declare function isProtectedDestructiveTarget(p: string, dshHome?: string): boolean;
export interface ArtifactRecord {
    readonly device: string;
    readonly inode: string;
    readonly birthMs: number;
    readonly kind: 'file' | 'dir';
    readonly cwd: string;
}
export interface ArtifactRead {
    /** device:inode for files; '' when unknown. */
    readonly id: string;
    readonly kind: 'file' | 'dir';
    readonly tracked: boolean;
}
/**
 * Tracks files a session created so their exact cleanup can be authorized
 * without widening authority to pre-existing data. Keyed by `device:inode`.
 */
export declare class ArtifactRegistry {
    private readonly byId;
    register(id: string, kind: 'file' | 'dir', cwd: string): void;
    /** Whether a known id was created during this session. */
    known(id: string): ArtifactRead | undefined;
    unregister(id: string): void;
    snapshot(): number;
    /** Build a stable identity string for a file system entry when given device+inode. */
    static identity(device: number | string, inode: number | string): string;
}
