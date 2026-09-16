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
/**
 * Fold the last selected permission preset out of one session's event log.
 * @param events - the session's events in log order.
 * @returns the preset name, or `undefined` when the log records none.
 */
export function permissionPresetOf(events) {
    if (events === undefined)
        return undefined;
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event?.type !== 'permission/preset')
            continue;
        const preset = event.data?.preset;
        if (typeof preset === 'string' && preset !== '')
            return preset;
    }
    return undefined;
}
/** Whether one preset name is covered by a configured scope list. */
export function presetInScope(preset, scope) {
    if (scope.includes('*'))
        return true;
    if (preset === undefined)
        return false;
    return scope.includes(preset);
}
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
export const DEFAULT_GATE_PRESETS = ['permissive', 'permissive-full'];
/** Normalize the gate scope: an unset/empty list means the default. */
export function resolveGatePresets(configured) {
    if (configured === undefined || configured.length === 0)
        return DEFAULT_GATE_PRESETS;
    return configured.filter((name) => typeof name === 'string' && name !== '');
}
