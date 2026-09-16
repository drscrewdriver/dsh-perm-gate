/**
 * Path containment and normalization for dsh-perm-gate, plus a session-scoped
 * artifact registry that tracks files a session created so deletion of
 * same-session artifacts can be cleaned up without widening authority.
 *
 * Containment helpers are pure string operators (testable); the registry is
 * the one stateful piece and stays in-process for a session.
 */
// --- Pure path helpers -------------------------------------------------------
export function toPosix(p) {
    return p.replaceAll('\\', '/');
}
/**
 * Normalize one candidate path against the workspace root to a
 * workspace-relative posix path. Candidates OUTSIDE the root yield `''`.
 * `caseInsensitive` (Windows default) compares drive/root prefixes case-insensitively.
 */
export function normalizeWorkspacePath(cwd, candidate, caseInsensitive = false) {
    const root = toPosix(cwd).replace(/\/+$/, '');
    const raw = toPosix(candidate);
    if (raw.length === 0)
        return '';
    let path = raw;
    while (path.startsWith('./'))
        path = path.slice(2);
    if (/^[A-Za-z]:\//.test(path)) {
        if (!/^[A-Za-z]:\//.test(root))
            return '';
        if (path.slice(0, 2).toLowerCase() !== root.slice(0, 2).toLowerCase())
            return '';
        return relFromRoot(root, path, path.slice(2), root.slice(2), caseInsensitive);
    }
    if (path.startsWith('/')) {
        return relFromRoot(root, path, path, root, caseInsensitive);
    }
    return path;
}
function relFromRoot(root, path, rest, rootRest, ci) {
    const eq = (a, b) => (ci ? a.toLowerCase() === b.toLowerCase() : a === b);
    if (rootRest.length === 0)
        return rest.slice(1);
    if (eq(path, root))
        return '';
    return (ci ? rest.toLowerCase() : rest).startsWith((ci ? rootRest.toLowerCase() + '/' : rootRest + '/'))
        ? rest.slice(rootRest.length + 1)
        : '';
}
export function isWithin(base, target) {
    const b = toPosix(base).replace(/\/+$/, '');
    const t = toPosix(target);
    return t === b || t.startsWith(b + '/');
}
/** Sensitive credential-ish path roots that reads/writes should route to review. */
export function isSensitivePath(p) {
    return /(?:^|[\\/])(?:\.ssh|\.gnupg|\.aws|\.azure|\.kube|\.config[\\/]gh|\.docker)(?:[\\/]|$)|(?:^|[\\/])(?:id_rsa|id_ed25519|credentials\.yaml|config\.json|\.env)(?:$|[.\\/])/i.test(p);
}
/** Root-level / DSH_HOME / home/system paths that must never be mutated. */
export function isProtectedDestructiveTarget(p, dshHome) {
    const posix = toPosix(p).toLowerCase();
    const guards = ['/', '/home', '/root', '/usr', '/etc', '/bin', '/sbin', '/boot', '/var'];
    for (const g of guards) {
        if (posix === g || posix.startsWith(g + '/'))
            return true;
    }
    if (dshHome !== undefined && (posix === toPosix(dshHome).toLowerCase() || posix.startsWith(toPosix(dshHome).toLowerCase() + '/')))
        return true;
    return false;
}
/**
 * Tracks files a session created so their exact cleanup can be authorized
 * without widening authority to pre-existing data. Keyed by `device:inode`.
 */
export class ArtifactRegistry {
    byId = new Map();
    register(id, kind, cwd) {
        if (id !== '')
            this.byId.set(id, { cwd, kind });
    }
    /** Whether a known id was created during this session. */
    known(id) {
        const r = this.byId.get(id);
        return r === undefined ? undefined : { id, kind: r.kind, tracked: true };
    }
    unregister(id) {
        this.byId.delete(id);
    }
    snapshot() {
        return this.byId.size;
    }
    /** Build a stable identity string for a file system entry when given device+inode. */
    static identity(device, inode) {
        return `${String(device)}:${String(inode)}`;
    }
}
