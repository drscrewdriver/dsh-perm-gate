/**
 * "Is this call an executed command?" — one answer, in `tool-names.ts`.
 *
 * Both directions are defects with teeth:
 *  - a name whitelist lets an unfamiliar runner (`pash`, `nushell`, a plugin's own
 *    `run_command`) carry `diskpart /s x.txt` straight past P0;
 *  - pure shape lets a `read` call be denied because the *document* it fetched
 *    quotes a command.
 */
import { describe, expect, it } from 'vitest'
import { hardDenyReason } from '../src/engine.js'
import { buildAskContext, humanBrief, askDoubtKinds } from '../src/ask-context.js'

const CTX = (tool: string, args: Record<string, unknown>) => ({
  tool,
  args,
  cwd: 'E:\\work\\proj',
  dshHome: 'C:/Users/joshua/.dsh',
})

const WIPER = 'diskpart /s C:\\gate-dryrun\\no-such-script.txt'

describe('command calls are recognised by shape, with a non-executor veto', () => {
  it('denies through a name the whitelist never heard of', () => {
    for (const tool of ['pash', 'nushell', 'run_command', 'exec']) {
      expect(hardDenyReason(CTX(tool, { command: WIPER }) as never), tool).toContain('unrecoverable')
    }
  })

  it('reads the command under the other runner keys too', () => {
    expect(hardDenyReason(CTX('runner', { cmd: WIPER }) as never)).toContain('unrecoverable')
    expect(hardDenyReason(CTX('runner', { script: WIPER }) as never)).toContain('unrecoverable')
  })

  it('does not treat a file tool payload as a command', () => {
    // `read` receives its query under assorted keys and `write` receives document
    // text: neither executes it, and denying them was the false positive the
    // non-executor set exists to prevent.
    expect(hardDenyReason(CTX('read', { command: 'git push --force origin main', file_path: 'E:/work/x.md' }) as never)).toBeUndefined()
    expect(hardDenyReason(CTX('write', { script: WIPER, file_path: 'E:/work/x.md' }) as never)).toBeUndefined()
    expect(hardDenyReason(CTX('memory_read_scene', { command: WIPER }) as never)).toBeUndefined()
  })

  it('keeps the known shell names covered', () => {
    expect(hardDenyReason(CTX('pwsh', { command: WIPER }) as never)).toContain('unrecoverable')
  })
})

describe('the human brief says stakes, not internals', () => {
  const listing = buildAskContext({
    tool: 'pwsh',
    commandText: 'Get-ChildItem -Force E:\\work\\proj | Select-Object Name',
    args: { command: 'Get-ChildItem -Force E:\\work\\proj | Select-Object Name' },
    workspaceRoot: 'E:\\work\\proj',
    cwd: 'E:\\work\\proj',
    ruleReason: 'no rule matched; default action',
  })

  it('names the doubt in words, in both languages the host can resolve', () => {
    const en = humanBrief(listing, 'en')
    expect(en.startsWith('why it asks:')).toBe(true)
    expect(en).toMatch(/no rule covers this call/i)
    expect(en).toMatch(/what it touches:/)
    // A listing must never be described as a write.
    expect(en).toMatch(/target=read/)
    const zh = humanBrief(listing, 'zh')
    expect(zh).toContain('疑点')
    expect(zh).toContain('影响面')
    expect(zh).toContain('允许 =')
  })

  it('escalates the cost line when the act cannot be undone', () => {
    const wipe = buildAskContext({
      tool: 'pwsh',
      commandText: 'docker volume rm gate-dryrun-nonexistent-volume',
      args: { command: 'docker volume rm gate-dryrun-nonexistent-volume' },
      workspaceRoot: 'E:\\work\\proj',
      cwd: 'E:\\work\\proj',
    })
    const brief = humanBrief(wipe, 'en')
    expect(brief).toMatch(/cannot be undone|will not be learned/)
    expect(askDoubtKinds(wipe)).toContain('never-learn')
  })

  it('stays short enough to read: at most four doubts, one line', () => {
    const noisy = buildAskContext({
      tool: 'pwsh',
      commandText: 'function scrub($p){ Remove-Item -Recurse -Force $p }; scrub "C:\\Users\\gate-dryrun-nonexistent"',
      args: { command: 'function scrub($p){ Remove-Item -Recurse -Force $p }; scrub "C:\\Users\\gate-dryrun-nonexistent"' },
      workspaceRoot: 'E:\\work\\proj',
      cwd: 'E:\\work\\proj',
      ruleReason: 'no rule matched; default action',
    })
    const kinds = askDoubtKinds(noisy)
    expect(kinds.length).toBeLessThanOrEqual(4)
    expect(new Set(kinds).size).toBe(kinds.length)
    expect(humanBrief(noisy, 'en').split('\n')).toHaveLength(1)
  })
})
