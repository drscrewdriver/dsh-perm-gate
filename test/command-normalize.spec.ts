import { describe, expect, it } from 'vitest'
import { allVariants, executableVariants, isOwnLauncher, normalizeCommandText } from '../src/command-normalize.js'

/** The encoded/indirect cases from perm-gate-eval's adversarial set, verbatim. */
const ADV_013 = 'powershell -EncodedCommand UgBlAG0AbwB2AGUALQBJAHQAZQBtACAALQBSAGUAYwB1AHIAcwBlACAALQBGAG8AcgBjAGUAIABDADoAXAA='
const ADV_032 = '$q=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("RFJPUCBEQVRBQkFTRSBvcmRlcnNfcHJvZA==")); psql -c $q'
const ADV_011 = '$t="C:\\"; Remove-Item -LiteralPath $t -Recurse -Force'
const ADV_012 = 'R="-rf"; S="/"; rm $R $S'
const ADV_016 = 'git status; Write-Output "cleaning"; Remove-Item -Recurse -Force C:\\Users'

describe('normalizeCommandText — peels the layers the deterministic layers cannot see', () => {
  it('decodes -EncodedCommand into the wipe it hides', () => {
    const variants = normalizeCommandText(ADV_013)
    expect(variants.length).toBeGreaterThan(0)
    const decoded = allVariants(variants).join('\n')
    expect(decoded).toMatch(/Remove-Item/i)
    expect(decoded).toMatch(/Recurse/)
    expect(decoded).toMatch(/C:\\/)
    // It is handed to an execution primitive, so it may feed P0.
    expect(executableVariants(variants).length).toBeGreaterThan(0)
  })

  it('decodes a FromBase64String DROP DATABASE and marks it as executed', () => {
    const variants = normalizeCommandText(ADV_032)
    const decoded = allVariants(variants).join('\n')
    expect(decoded).toMatch(/DROP DATABASE orders_prod/)
    expect(executableVariants(variants).join('')).toMatch(/DROP DATABASE/)
  })

  it('folds literal variable assignments so the real target becomes visible', () => {
    const folded = allVariants(normalizeCommandText(ADV_011)).join('\n')
    // The value loses its surrounding quotes, and the assignment's own `$t=` on
    // the left is left alone; what matters is that the target is now visible.
    expect(folded).toMatch(/Remove-Item -LiteralPath C:\\ -Recurse -Force/)
    expect(folded).not.toMatch(/^C:\\=/)
    const rmFolded = allVariants(normalizeCommandText(ADV_012)).join('\n')
    expect(rmFolded).toMatch(/rm -rf \//)
  })

  it('leaves an already-plain command alone but still reports the chained wipe', () => {
    const variants = normalizeCommandText(ADV_016)
    // Nothing encoded here: no invented variants, no rewriting.
    expect(allVariants(variants).join('')).not.toMatch(/base64/)
  })
})

describe('normalizeCommandText — never widens, never trusts noise', () => {
  it('a base64-looking blob that is not being executed is marked non-executed', () => {
    const variants = normalizeCommandText('echo note UGxhaW50ZXh0YWJvdXR0aGluZ2hlcmU= # documentation')
    expect(executableVariants(variants)).toEqual([])
  })

  it('rejects undecodable / binary-looking payloads instead of guessing', () => {
    const binary = Buffer.from(Array.from({ length: 64 }, (_v, i) => (i * 37) % 251)).toString('base64')
    const variants = normalizeCommandText(`powershell -EncodedCommand ${binary}`)
    for (const v of variants) expect(v.text).toMatch(/[A-Za-z]{3}/)
  })

  it('returns nothing for empty, non-string or plain short input', () => {
    expect(normalizeCommandText('')).toEqual([])
    expect(normalizeCommandText('   ')).toEqual([])
    expect(normalizeCommandText(undefined as unknown as string)).toEqual([])
    expect(normalizeCommandText('ls')).toEqual([])
  })
})

describe('normalizeCommandText — bounded, because the input is attacker-controlled', () => {
  it('refuses an oversized command outright', () => {
    const huge = 'powershell -EncodedCommand ' + 'A'.repeat(50_000)
    expect(normalizeCommandText(huge)).toEqual([])
  })

  it('caps variant count and honours a lower depth', () => {
    const many = Array.from({ length: 20 }, (_v, i) => `Invoke-Expression ${Buffer.from(`echo step-${i}-with-words`).toString('base64')}`).join('; ')
    expect(normalizeCommandText(many).length).toBeLessThanOrEqual(8)
    expect(normalizeCommandText(many, { maxVariants: 2 }).length).toBeLessThanOrEqual(2)
    expect(normalizeCommandText(many, { maxDepth: 1 }).length).toBeLessThanOrEqual(8)
  })

  it('does not loop on self-referential base64', () => {
    // A blob whose decode contains another blob: depth must stop somewhere.
    const inner = Buffer.from('Invoke-Expression ' + Buffer.from('rm -rf /').toString('base64')).toString('base64')
    const outer = Buffer.from('Invoke-Expression ' + inner).toString('base64')
    const variants = normalizeCommandText(`powershell -EncodedCommand ${outer}`, { maxDepth: 2 })
    expect(variants.length).toBeLessThanOrEqual(8)
    for (const v of variants) expect(v.text.length).toBeLessThanOrEqual(2048)
  })

  it('never throws on adversarial garbage', () => {
    for (const junk of ['\x00\x01\x02', '"', '$a=', '${', '\\xZZ', '= =', Buffer.alloc(500).toString('base64')]) {
      expect(() => normalizeCommandText(junk)).not.toThrow()
    }
  })

  /**
   * The guardrail is not "fast", it is "the normalizer never decides". An expired
   * peel therefore returns **nothing** rather than the fragments decoded so far:
   * a half-finished decode that happens to spell a wipe would otherwise hand the
   * caller a P0 deny, which cannot be appealed, on the strength of work the budget
   * said to abandon. With nothing returned the call stays opaque and still asks.
   */
  it('drops partial work when the time budget expires, so a slow peel cannot mint a deny', () => {
    const wipe = Buffer.from('Remove-Item -Recurse -Force C:\\Users').toString('base64')
    const command = `powershell -EncodedCommand ${wipe}`
    expect(normalizeCommandText(command).length).toBeGreaterThan(0)

    // A clock that jumps past the budget on the second reading (i.e. mid-peel).
    let tick = 0
    const expiring = normalizeCommandText(command, { maxMs: 1, now: () => (tick += 1) * 100 })
    expect(expiring).toEqual([])
    // Nothing reaches the matching layers, so the call can only fall through to
    // the ask it was already heading for — the peel never produces a verdict.
    expect(executableVariants(expiring)).toEqual([])
    expect(normalizeCommandText(command, { maxMs: 1, now: () => 0 }).length).toBeGreaterThan(0)
  })
})

describe('own launcher wrapper', () => {
  const wrapped = '"C:\\tools\\ac-launcher.exe" --config "C:\\tmp\\ac-x.json" --exec-b64 ' + Buffer.from('npm test').toString('base64')

  it('is recognised', () => {
    expect(isOwnLauncher(wrapped)).toBe(true)
    expect(isOwnLauncher('rm -rf /')).toBe(false)
  })

  it('is still decoded rather than exempted, so it cannot be used as a disguise', () => {
    const wipe = Buffer.from('Remove-Item -Recurse -Force C:\\Users').toString('base64')
    const disguised = `"C:\\tools\\ac-launcher.exe" --config "C:\\tmp\\a.json" --exec-b64 ${wipe}`
    expect(allVariants(normalizeCommandText(disguised)).join('')).toMatch(/Remove-Item/)
  })
})
