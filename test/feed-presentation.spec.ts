import { describe, expect, it } from 'vitest'
import { presentation, type GateEvent } from '../src/client/feed.js'

/**
 * Guard against the quiet failure mode: `presentation()` renders an unknown
 * `kind` through its `default:` branch as a **green ALLOW**. Adding a kind to the
 * union without adding a case here would therefore display a blocked or
 * unresolved call as an approved one — the worst possible direction for a
 * permission gate to fail.
 */
const KINDS = [
  'auto', 'ask', 'deny', 'learned',
  'manual-approved', 'manual-rejected', 'manual-cancelled', 'stand-down',
] as const satisfies readonly GateEvent['kind'][]

/**
 * Compile-time exhaustiveness: if a kind is added to `GateEvent['kind']` without
 * being listed above (and given an explicit case in `presentation()`), this type
 * stops being `never` and `npm run typecheck` fails.
 */
type Unlisted = Exclude<GateEvent['kind'], (typeof KINDS)[number]>
const _exhaustive: Unlisted extends never ? true : never = true

describe('presentation() covers every event kind explicitly', () => {
  it('the kind list is exhaustive at compile time', () => {
    expect(_exhaustive).toBe(true)
  })

  it.each(KINDS)('%s is not rendered as the ALLOW default', (kind) => {
    const p = presentation(kind)
    // Only `auto` may read as allowed; every other kind must be distinguishable.
    if (kind === 'auto') expect(p.tag).toBe('ALLOW')
    else expect(p.tag).not.toBe('ALLOW')
    expect(p.tag).toBeTruthy()
  })

  it('keeps ask and stand-down sticky, and the rest transient', () => {
    expect(presentation('ask').sticky).toBe(true)
    expect(presentation('stand-down').sticky).toBe(true)
    expect(presentation('deny').sticky).toBe(false)
    expect(presentation('manual-approved').sticky).toBe(false)
  })

  it('never lets a refusal share the allow colour', () => {
    const allow = presentation('auto').color
    expect(presentation('deny').color).not.toBe(allow)
    expect(presentation('manual-rejected').color).not.toBe(allow)
    // An ask is a warning, not a success: it must not inherit the green.
    expect(presentation('ask').color).not.toBe(allow)
  })
})
