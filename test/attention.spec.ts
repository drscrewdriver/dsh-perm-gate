/**
 * Ask attention: the two switches are INDEPENDENT booleans, and the defaults
 * reproduce today's experience exactly. The debounce is per session, because
 * one noisy session must not silence another.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ATTENTION_DEFAULTS, acknowledge, chime, escalateAsk, resetAttention, type AttentionConfig } from '../src/client/attention.js'

const CFG: AttentionConfig = { toast: true, sound: true, gapMs: 30_000 }

beforeEach(() => { resetAttention() })

describe('defaults', () => {
  it('equal today behaviour (toast on, sound off)', () => {
    expect(ATTENTION_DEFAULTS).toEqual({ toast: true, sound: false, gapMs: 30_000 })
  })
})

describe('two independent switches', () => {
  it('toast on + sound off plays nothing', () => {
    const play = vi.fn()
    expect(escalateAsk({ config: { ...CFG, sound: false }, sessionId: 's1', play })).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })

  it('toast off + sound on still chimes (an enum could not express this)', () => {
    const play = vi.fn()
    const played = escalateAsk({ config: { ...CFG, toast: false, sound: true }, sessionId: 's1', play })
    expect(played).toBe(true)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('both off stays completely silent', () => {
    const play = vi.fn()
    expect(escalateAsk({ config: { toast: false, sound: false, gapMs: 0 }, sessionId: 's1', play })).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })
})

describe('debounce', () => {
  it('suppresses a second chime inside the gap for the same session', () => {
    const play = vi.fn()
    let now = 1_000
    const run = (): boolean => escalateAsk({ config: CFG, sessionId: 's1', play, now: () => now })
    expect(run()).toBe(true)
    now += 1_000
    expect(run()).toBe(false)
    now += CFG.gapMs
    expect(run()).toBe(true)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('never blocks a different session', () => {
    const play = vi.fn()
    const now = 1_000
    expect(escalateAsk({ config: CFG, sessionId: 'a', play, now: () => now })).toBe(true)
    expect(escalateAsk({ config: CFG, sessionId: 'b', play, now: () => now })).toBe(true)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('acknowledge clears the window so the next ask is audible at once', () => {
    const play = vi.fn()
    let now = 1_000
    escalateAsk({ config: CFG, sessionId: 's1', play, now: () => now })
    now += 100
    expect(escalateAsk({ config: CFG, sessionId: 's1', play, now: () => now })).toBe(false)
    acknowledge({ sessionId: 's1' })
    expect(escalateAsk({ config: CFG, sessionId: 's1', play, now: () => now })).toBe(true)
    expect(play).toHaveBeenCalledTimes(2)
  })
})

describe('degradation', () => {
  it('survives a player that throws', () => {
    expect(escalateAsk({ config: CFG, sessionId: 's1', play: () => { throw new Error('no audio device') } })).toBe(false)
  })

  it('chime() is a no-op when the host has no AudioContext', () => {
    // Node has no WebAudio: the settings face's 试听 button must not throw there.
    expect(() => { chime() }).not.toThrow()
  })
})
