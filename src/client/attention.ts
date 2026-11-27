/**
 * Ask attention: an optional sound plus a switchable decision strip.
 *
 * Why this is not a new toast: `notice.tsx` already renders the decision strip
 * above the input dock and its ask branch is already sticky (it stays until
 * the next event). The real gap is that the strip only exists where the user
 * is LOOKING — a background session raises an ask and nothing happens. So this
 * module adds the one thing the strip cannot do for itself (a sound), and makes
 * the strip itself switchable, as two INDEPENDENT booleans:
 *
 *   toast:true,  sound:false  == today's behaviour (upgrade is invisible)
 *   toast:false, sound:true   == audio only (an enum could not express this)
 *
 * Everything here is best-effort and host-free: no @deepseek-ai value imports,
 * no audio asset, no permission prompt. A browser that refuses to start an
 * AudioContext degrades to silence rather than to an error.
 */

/** The two switches plus the debounce window. */
export interface AttentionConfig {
  /** Show the ask in the decision strip (default true = existing behaviour). */
  readonly toast: boolean
  /** Play a short chime when an ask arrives (default false). */
  readonly sound: boolean
  /** Minimum gap between two chimes for the SAME session, in ms. */
  readonly gapMs: number
}

/** The defaults the settings surface starts from: equal to today's experience. */
export const ATTENTION_DEFAULTS: AttentionConfig = { toast: true, sound: false, gapMs: 30_000 }

export interface EscalateInput {
  readonly config: AttentionConfig
  readonly sessionId: string | undefined
  /** Injected for tests; defaults to the real clock. */
  readonly now?: () => number
  /** Injected for tests; defaults to the WebAudio chime. */
  readonly play?: () => void
}

/** Per-session last-chime timestamps. Different sessions never block each other. */
const lastChime = new Map<string, number>()

/** Test seam: forget every recorded chime. */
export function resetAttention(): void {
  lastChime.clear()
}

function audioContextCtor(): (new () => AudioContext) | undefined {
  const g = globalThis as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext }
  return g.AudioContext ?? g.webkitAudioContext
}

/**
 * Two-note chime, synthesised. No asset file: zero bytes, offline-safe, and
 * nothing to resolve at runtime (a missing `assets/` path would otherwise turn
 * a notification into a console error on some hosts).
 */
export function chime(): void {
  const Ctor = audioContextCtor()
  if (Ctor === undefined) return
  try {
    const ctx = new Ctor()
    const start = ctx.currentTime
    for (const [index, freq] of [880, 1174.7].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const at = start + index * 0.14
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.15)
    }
    // Release the context once the notes are done: a lingering AudioContext
    // keeps an audio device open and some browsers cap how many may exist.
    setTimeout(() => { void ctx.close().catch(() => undefined) }, 600)
  } catch {
    // Autoplay refused / no audio device: silence is the correct degradation.
  }
}

/**
 * React to one arriving ask. The two switches are judged independently: a
 * sound-only setup still chimes, a toast-only setup still shows the strip.
 * @returns whether a chime was actually played (handy for tests and for a
 *   'test' button in the settings face).
 */
export function escalateAsk(input: EscalateInput): boolean {
  const { config, sessionId } = input
  if (!config.sound) return false
  const now = input.now ?? Date.now
  // One debounce bucket per session; an unknown session shares one bucket,
  // which is still better than chiming on every event of a burst.
  const bucket = sessionId ?? '__unknown__'
  const previous = lastChime.get(bucket)
  const at = now()
  if (previous !== undefined && at - previous < config.gapMs) return false
  lastChime.set(bucket, at)
  const play = input.play ?? chime
  try {
    play()
    return true
  } catch {
    return false
  }
}

export interface AcknowledgeInput {
  readonly sessionId: string | undefined
}

/**
 * The user came back to the tab (`visibilitychange` to visible): drop that
 * session's debounce entry so the next ask can be heard immediately instead of
 * being swallowed by a window that started while the tab was hidden.
 */
export function acknowledge(input: AcknowledgeInput): void {
  if (input.sessionId === undefined) {
    lastChime.clear()
    return
  }
  lastChime.delete(input.sessionId)
}
