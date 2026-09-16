/**
 * Session permission-preset awareness for dsh-perm-gate.
 *
 * `dsh-permission-presets` folds three durable knob events per session
 * (`permission/preset`, `sandbox/mode`, `approval/policy`) and pins an initial
 * `permission/preset` at session creation, so the last `permission/preset`
 * event names the tier the user selected. The gate reads that fold to decide
 * whether its own approval tier is the active one.
 *
 * Reading the session log directly (instead of requiring the
 * `permissionPresets` service) keeps the gate usable in a bare embedding and
 * avoids a hard dependency on a service that may not be composed. The fold
 * matches `effectivePermissionPreset` in dsh-permission-presets: last event
 * wins.
 */
/** The slice of one session event this module folds. */
export interface SessionEventLike {
    readonly type?: string;
    readonly data?: {
        readonly preset?: unknown;
    };
}
/**
 * Fold the last selected permission preset out of one session's event log.
 * @param events - the session's events in log order.
 * @returns the preset name, or `undefined` when the log records none.
 */
export declare function permissionPresetOf(events: readonly SessionEventLike[] | undefined): string | undefined;
/** Whether one preset name is covered by a configured scope list. */
export declare function presetInScope(preset: string | undefined, scope: readonly string[]): boolean;
/**
 * Presets in which the gate is active. It owns both 自动审查 tiers — the plain
 * one (file sandbox kept) and the full-access one (sandbox restriction lifted,
 * same approval behaviour) — so a user can have the gate without inheriting a
 * sandbox that breaks `git` / Cygwin tools. `'*'` makes it global (every
 * preset, including the hard-deny layer).
 *
 * Lives in this dependency-free module (not `config.ts`) so the browser half can
 * render the scope without pulling schemastery into the client bundle.
 */
export declare const DEFAULT_GATE_PRESETS: readonly string[];
/** Normalize the gate scope: an unset/empty list means the default. */
export declare function resolveGatePresets(configured?: readonly string[]): readonly string[];
