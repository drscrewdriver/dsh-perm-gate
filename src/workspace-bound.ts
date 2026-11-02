/**
 * Node-side containment check for the YOLO workspace exemption.
 *
 * `ask-context.ts` stays dependency-free (the browser half imports its types), so its
 * `workspaceBound` is a **lexical** prefix test. That is the right answer for the fact
 * layer but not sufficient to *relax* a safety screen: a link inside the workspace can
 * point anywhere. This module resolves the paths the call actually names and answers the
 * same question through the filesystem, and it is deliberately pessimistic — a path that
 * cannot be resolved (missing, unreadable, permission denied) answers `false`, because
 * "I could not prove it stays inside" must never read as "it stays inside".
 *
 * Node half only: never imported by the client bundle.
 */
import { realpathSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'

/** Windows paths are case-insensitive; the other supported lines are not. */
function fold(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

/**
 * Whether every named path resolves inside `root`, after following links.
 *
 * An empty list is `true` (the call named nothing), a missing root is `false`, and any
 * path that cannot be resolved is `false`.
 */
export function pathsRealInsideWorkspace(root: string | undefined, paths: readonly string[]): boolean {
  if (root === undefined || root === '') return false
  if (paths.length === 0) return true
  let realRoot: string
  try {
    realRoot = fold(realpathSync.native(root))
  } catch {
    return false
  }
  return paths.every((candidate) => {
    try {
      const absolute = isAbsolute(candidate) ? candidate : resolve(root, candidate)
      const real = fold(realpathSync.native(absolute))
      return real === realRoot || real.startsWith(`${realRoot}${sep}`)
    } catch {
      return false
    }
  })
}
