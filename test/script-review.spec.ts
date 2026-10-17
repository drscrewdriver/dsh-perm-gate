import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readScriptContents, resolveScriptPath, scriptRefs, scriptsFullyCovered } from '../src/script-review.js'

const dirs: string[] = []
function tmp(): string {
  const dir = mkdtempDir()
  dirs.push(dir)
  return dir
}
function mkdtempDir(): string {
  // A per-case directory so a path in one case can never resolve in another.
  const dir = join(tmpdir(), `perm-gate-script-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('scriptRefs — which files does this call run', () => {
  it.each([
    ['bash with a relative file', 'bash ./clean-home.sh', ['./clean-home.sh']],
    ['interpreter plus bare name', 'python extract.py', ['extract.py']],
    ['-File flag form', 'pwsh -File ./clean-home.ps1', ['./clean-home.ps1']],
    ['home-absolute form', 'bash ~/scripts/clean-home.sh', ['~/scripts/clean-home.sh']],
    ['direct execution', './deploy.sh --fast', ['./deploy.sh']],
    ['source builtin', 'source ~/.profile', ['~/.profile']],
    ['cmd /c batch', 'cmd /c build.bat', ['build.bat']],
    ['pipeline with two scripts', 'bash a.sh && python b.py', ['a.sh', 'b.py']],
    ['same file twice is one entry', 'bash x.sh; cat x.sh', ['x.sh']],
  ])('finds %s', (_label, command, expected) => {
    expect(scriptRefs(command).map((r) => r.ref)).toEqual(expected)
  })

  /**
   * Inline code is *already* the command text the gate grades, so mining it for a file
   * name would read a file called after a whole code string — and `python -m` runs an
   * installed module, which no file argument names.
   */
  it.each([
    ['bash -c', 'bash -c "rm -rf ~/.*"'],
    ['pwsh -Command', "pwsh -Command 'Get-Process'"],
    ['pwsh -EncodedCommand', 'pwsh -EncodedCommand UgBlAG0AbwB2AGU='],
    ['python -m', 'python -m http.server 8000'],
    ['node -e', 'node -e "console.log(1)"'],
    ['no script at all', 'npm install left-pad'],
  ])('names no file for %s', (_label, command) => {
    expect(scriptRefs(command)).toHaveLength(0)
  })

  it('labels the interpreter and keeps order', () => {
    const refs = scriptRefs('pwsh -File tools/x.ps1; bash tools/y.sh')
    expect(refs.map((r) => [r.ref, r.interpreter])).toEqual([['tools/x.ps1', 'pwsh'], ['tools/y.sh', 'bash']])
  })
})

describe('readScriptContents — bounded, best-effort, never executing', () => {
  it('reads a workspace script and reports the path it resolved', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'clean-home.sh'), '#!/bin/bash\necho cleaning\n')
    const out = readScriptContents(scriptRefs('bash ./clean-home.sh'), dir)
    expect(out).toHaveLength(1)
    expect(out[0].body).toContain('echo cleaning')
    expect(out[0].path).toBe(join(dir, 'clean-home.sh'))
    expect(out[0].unreadable).toBeUndefined()
    expect(out[0].truncated).toBe(false)
  })

  it('expands ~ against the real home, not the cwd', () => {
    const resolved = resolveScriptPath('~/scripts/x.sh', '/work')
    expect(resolved.replace(/\\/g, '/')).toContain('/scripts/x.sh')
    expect(resolved.startsWith('/work')).toBe(false)
  })

  it('labels a missing file instead of returning an empty body', () => {
    const out = readScriptContents(scriptRefs('bash ./nope.sh'), tmp())
    expect(out[0].unreadable).toBe('missing')
    expect(out[0].body).toBe('')
  })

  it('labels a directory and refuses to read it as a script', () => {
    const dir = tmp()
    mkdirSync(join(dir, 'weird.sh'))
    const out = readScriptContents(scriptRefs('bash ./weird.sh'), dir)
    expect(out[0].unreadable).toBe('not-a-file')
  })

  it('labels a binary blob', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'blob.py'), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0, 0, 1, 2, 3, 4, 5, 6]))
    const out = readScriptContents(scriptRefs('python ./blob.py'), dir)
    expect(out[0].unreadable).toBe('binary')
  })

  it('truncates a long body but says so', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'big.sh'), 'echo x\n'.repeat(20_000))
    const out = readScriptContents(scriptRefs('bash ./big.sh'), dir, { maxBodyChars: 500 })
    expect(out[0].truncated).toBe(true)
    expect(out[0].body.length).toBeLessThanOrEqual(500)
    expect(out[0].unreadable).toBeUndefined()
  })

  it('refuses to swallow an oversized file whole', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'huge.sh'), 'a'.repeat(600_000))
    const out = readScriptContents(scriptRefs('bash ./huge.sh'), dir, { maxFileBytes: 1000 })
    expect(out[0].unreadable).toBe('too-large')
    expect(out[0].bytes).toBeGreaterThan(1000)
  })

  it('caps how many files one call can drag into the review', () => {
    const dir = tmp()
    for (const n of ['a', 'b', 'c', 'd', 'e']) writeFileSync(join(dir, `${n}.sh`), 'echo 1\n')
    const refs = scriptRefs('bash a.sh; bash b.sh; bash c.sh; bash d.sh; bash e.sh')
    expect(readScriptContents(refs, dir)).toHaveLength(4)
  })

  it('coverage needs every named script read', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'a.sh'), 'echo a\n')
    const refsAll = scriptRefs('bash ./a.sh; bash ./b.sh')
    expect(scriptsFullyCovered(refsAll, readScriptContents(refsAll, dir))).toBe(false)
    const refsOne = scriptRefs('bash ./a.sh')
    expect(scriptsFullyCovered(refsOne, readScriptContents(refsOne, dir))).toBe(true)
    // No script named at all is not "covered" — there was nothing to see.
    expect(scriptsFullyCovered([], [])).toBe(false)
  })

  /** The read is a read: nothing here may execute the file it opened. */
  it('does not execute a script whose body would crash if run', () => {
    const dir = tmp()
    writeFileSync(join(dir, 'boom.sh'), '#!/bin/bash\nexit 3 # never run by the gate\n')
    const out = readScriptContents(scriptRefs('bash ./boom.sh'), dir)
    expect(out[0].body).toContain('never run')
  })
})
