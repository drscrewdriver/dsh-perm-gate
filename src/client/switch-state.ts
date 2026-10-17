/**
 * The optimistic state machine behind the settings card's pill switch and its tier
 * picker, kept out of the components so its three rules are testable without a DOM
 * renderer (the client half ships no react-dom).
 *
 * The posture: the control flips the instant it is clicked and holds that
 * position while the write round-trips through the host settings service — a
 * checkbox that waits for the snapshot reads as a dead control. The store stays
 * the truth, so the local override is dropped the moment the snapshot agrees
 * with it, on a rejected write, and on a watchdog in case a host line neither
 * applies nor reports the change.
 */

/** How long an unconfirmed click is allowed to hold the control before it snaps back. */
export const SWITCH_SETTLE_MS = 4_000

/**
 * What the control displays: the pending click wins over the store until the store
 * catches up (or the watchdog gives up on it). Generic because the same posture covers a
 * two-state pill and a multi-state tier picker alike.
 */
export function shownValue<T>(pending: T | null, checked: T): T {
  return pending ?? checked
}

/**
 * Store update: once the snapshot reports the requested value the override is redundant,
 * and handing the visual back to the snapshot is what keeps the control honest if another
 * writer (a patch file, the app's own plugin manager) moved the same field meanwhile.
 */
export function pendingAfterSync<T>(pending: T | null, checked: T): T | null {
  return pending !== null && pending === checked ? null : pending
}

/** A write that came back rejected: fall back to whatever the store holds. */
export function pendingAfterFailure<T>(_pending: T | null): null {
  return null
}
