import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileCredentialPaths } from '../src/credential-paths.js'
import { hardDenyReason } from '../src/engine.js'
import { PermGateRuntime } from '../src/runtime.js'
import type { ToolCallContext } from '../src/evaluate.js'

/** The matcher only: pure string work, no filesystem, no resolution. */
describe('compileCredentialPaths — the entry language', () => {
  const at = (entries: string[], p: string, opts = {}): boolean => compileCredentialPaths(entries, opts)(p)

  it('matches a plain entry on segment boundaries only', () => {
    expect(at(['.myco_token'], '/home/u/.myco_token')).toBe(true)
    expect(at(['vault/prod.env'], '/home/u/vault/prod.env')).toBe(true)
    expect(at(['vault/prod.env'], '/work/secrets/vault/prod.env')).toBe(true)
    // A fragment must not become a substring search: `token` protects nothing here.
    expect(at(['token'], '/home/u/ambient.txt')).toBe(false)
    expect(at(['.env'], '/home/u/ambient.conf')).toBe(false)
  })

  it('crosses directories with a double star and stays inside one segment with a single one', () => {
    expect(at(['secrets/**'], '/work/a/b/secrets/prod.key')).toBe(true)
    expect(at(['**/vault/*.env'], '/opt/app/vault/prod.env')).toBe(true)
    expect(at(['**/vault/*.env'], '/opt/vault/deep/prod.env')).toBe(false)
    expect(at(['/opt/app/*.env'], '/opt/app/prod.env')).toBe(true)
    expect(at(['/opt/app/*.env'], '/etc/prod.env')).toBe(false)
  })

  it('lets a relative pattern match at any depth', () => {
    expect(at(['secrets/*.env'], '/a/b/secrets/x.env')).toBe(true)
    expect(at(['deploy/*.pub'], '/home/u/keys/deploy/id_ed25519.pub')).toBe(true)
  })

  it('expands a home-relative entry against the real home', () => {
    const opts = { home: '/home/u' }
    expect(at(['~/.myco/vault.token'], '/home/u/.myco/vault.token', opts)).toBe(true)
    expect(at(['~/.myco/vault.token'], '/work/.myco/vault.token', opts)).toBe(false)
  })

  /**
   * A caller without a home (dry-run, an embedder that never filled `userHome`) must not
   * end up protecting nothing: the `~/` is dropped and the tail still matches.
   * The fallback is stricter in one direction only — it can deny more, never less.
   */
  it('falls back to a tail match when no home is supplied', () => {
    expect(at(['~/.myco/vault.token'], '/home/anyone/.myco/vault.token')).toBe(true)
    expect(at(['~/.myco/vault.token'], '/home/anyone/.myco/other.txt')).toBe(false)
  })

  it('is case-insensitive on request', () => {
    expect(at(['Vault/Prod.ENV'], '/work/vault/prod.env')).toBe(true)
    expect(at(['Vault/Prod.ENV'], '/work/vault/prod.env', { caseInsensitive: false })).toBe(false)
  })

  /**
   * A bare `*` is dropped rather than honoured: an entry nobody meant as "every path"
   * must not silently widen the guard to the whole filesystem.
   */
  it('drops an entry it cannot honour instead of guessing', () => {
    expect(compileCredentialPaths([])('/anything')).toBe(false)
    expect(compileCredentialPaths(undefined)('/anything')).toBe(false)
    expect(compileCredentialPaths(['   ', '*'])('/anything')).toBe(false)
  })

  /** Metacharacters in a path are literals: a `.` must not match any character. */
  it('treats regex metacharacters in a path as literals', () => {
    expect(at(['app.config'], '/work/appXconfig')).toBe(false)
    expect(at(['app.config'], '/work/app.config')).toBe(true)
    expect(at(['secrets/*.env'], '/work/secretsXprod?env')).toBe(false)
    expect(at(['a(b[c+.token'], '/work/a(b[c+.token')).toBe(true)
    expect(at(['a(b[c+.token'], '/work/a(b[cXtoken')).toBe(false)
  })
})

/** The wiring: a declared path gets the same tier as `.ssh`. */
describe('credentialPaths in P0', () => {
  const DECL = ['/home/u/.myco/vault.token', 'secrets/*.env']

  const readCtx = (file_path: string): ToolCallContext => ({
    tool: 'read',
    args: { file_path },
    cwd: '/work/proj',
    home: '/work/proj',
    userHome: '/home/u',
    caseInsensitive: true,
    credentialPaths: DECL,
  })

  it('refuses a read of a declared credential outside the workspace', () => {
    expect(hardDenyReason(readCtx('/home/u/.myco/vault.token'))).toContain('sensitive path outside workspace')
    expect(hardDenyReason(readCtx('/home/u/a/secrets/prod.env'))).toContain('sensitive path outside workspace')
  })

  it('leaves an unread path alone', () => {
    expect(hardDenyReason(readCtx('/home/u/.myco/notes.md'))).toBeUndefined()
    // A declared path *inside* the workspace is an ordinary project file to read — the
    // built-in rule this extends only fires outside the workspace root.
    expect(hardDenyReason(readCtx('/work/proj/secrets/local.env'))).toBeUndefined()
    // And the built-in list still works with nothing declared.
    expect(hardDenyReason({ ...readCtx('/home/u/.ssh/id_ed25519'), credentialPaths: undefined })).toBeDefined()
  })

  it('refuses a file tool mutating a declared credential', () => {
    const ctx = (tool: string, file_path: string, entries: readonly string[]): ToolCallContext => ({
      tool,
      args: { file_path, content: 'x' },
      cwd: '/work/proj',
      home: '/work/proj',
      userHome: '/home/u',
      caseInsensitive: true,
      credentialPaths: entries,
    })
    // A path under `/home` is refused by the protected-root rule first; that is the same
    // outcome by a different clause, so the credential-store wording is checked on a
    // path no root rule knows.
    expect(hardDenyReason(ctx('write', '/home/u/.myco/vault.token', DECL))).toBeDefined()
    expect(hardDenyReason(ctx('write', '/opt/vault/prod.token', ['/opt/vault/*.token']))).toContain('credential store')
    expect(hardDenyReason(ctx('edit', '/opt/vault/prod.token', ['/opt/vault/*.token']))).toContain('credential store')
    expect(hardDenyReason(ctx('write', '/work/proj/src/main.ts', DECL))).toBeUndefined()
  })
})

/** The blacklist extension, which is the other half of "protect my own long tail". */
describe('denyKeywordsExtra appends instead of replacing', () => {
  const bash = (command: string) => ({ name: 'bash', arguments: { command }, cwd: '/work', sessionId: 's1' })

  it('keeps the preset and adds the user entry', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, readDenyKeywordsExtra: () => ['vault token revoke'] })
    expect(r.decideExecution(bash('rm -rf /work/build'))?.kind).toBe('deny')
    expect(r.decideExecution(bash('myco-cli vault token revoke prod'))?.kind).toBe('deny')
    expect(r.decideExecution(bash('myco-cli vault token list'))?.kind).not.toBe('deny')
  })

  it('still appends when the preset itself was replaced', () => {
    const r = new PermGateRuntime({
      rulesFile: undefined,
      readDenyKeywords: () => ['terraform destroy'],
      readDenyKeywordsExtra: () => ['vault token revoke'],
    })
    // The replacement removed `rm -rf` from the blacklist; the extra did not.
    expect(r.decideExecution(bash('rm -rf /work/build'))?.kind).not.toBe('deny')
    expect(r.decideExecution(bash('terraform destroy -auto-approve'))?.kind).toBe('deny')
    expect(r.decideExecution(bash('myco-cli vault token revoke prod'))?.kind).toBe('deny')
  })

  it('reads the credential paths live, so a settings edit applies on the next call', () => {
    let declared: string[] = []
    const r = new PermGateRuntime({ rulesFile: undefined, readCredentialPaths: () => declared })
    const read = { name: 'read', arguments: { file_path: path.join(os.homedir(), '.myco', 'vault.token') }, cwd: '/work', sessionId: 's1' }
    expect(r.decideExecution(read as never)).toBeUndefined()
    declared = ['~/.myco/vault.token']
    expect(r.decideExecution(read as never)?.kind).toBe('deny')
  })
})
