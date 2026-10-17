/**
 * Unattended tiers — which human-free implementations exist, and which permission preset
 * each one owns.
 *
 * The shape, and why it is shaped this way: a mode is a property of the preset the user
 * picks in the composer, never a background flow the gate adds to a session it was not
 * asked to change. So each implementation has exactly one preset and exactly one switch
 * that says whether it exists at all — one switch, one implementation, one tier. They do
 * not cross: turning `safenetPass` off cannot make 自动审查 behave differently, and
 * selecting `permissive-mech` does nothing unless that implementation is switched on.
 *
 * | switch       | preset            | who settles an ask                                   | model |
 * | ------------ | ----------------- | ---------------------------------------------------- | ----- |
 * | `permissive` | permissive(-full) | machine screen + grader refine, then a PERSON        | yes   |
 * | `safenetAsk` | permissive-snet   | machine screen, then a PERSON — no grader at all      | no    |
 * | `safenetPass`| permissive-mech   | the machine screen alone: named danger blocked+fed    | no    |
 * | `yolo`       | permissive-yolo   | the grader answers in place of the person, always     | yes   |
 *
 * `yolo` is the model-backed tier and says so: with no reviewer in seat it is NOT silently
 * a pass-through. The caller still has to decide what a missing grader means (see
 * {@link YOLO_WITHOUT_REVIEWER}) but it must record that the tier could not do the thing it
 * advertises, and the settings face must say so out loud.
 *
 * Everything here is pure string/enum work so the browser half can reuse the same truth.
 */
/** The preset each implementation owns. One switch, one preset — they never cross. */
export const MODE_PRESETS = {
    'safety-net-ask': 'permissive-snet',
    'safety-net-passthrough': 'permissive-mech',
    yolo: 'permissive-yolo',
};
/** Every accepted mode, in the order the settings face should offer them. */
export const UNATTENDED_MODES = [
    'safety-net-ask',
    'safety-net-passthrough',
    'yolo',
];
/**
 * The mode for one call, from the session's current permission preset plus which
 * implementations are switched on.
 *
 * `null` means no human-free implementation owns this preset: the ordinary flow runs, and
 * an ask goes to a person. A preset whose switch is off also returns `null` — the tier may
 * still exist in the picker (profiles are not rewritten here), it simply has no
 * implementation behind it, which is the honest reading of "the switch controls whether the
 * implementation exists".
 */
export function resolveTierMode(preset, switches) {
    if (preset === undefined)
        return null;
    for (const mode of UNATTENDED_MODES) {
        if (MODE_PRESETS[mode] !== preset)
            continue;
        const on = mode === 'safety-net-ask'
            ? switches.safenetAsk === true
            : mode === 'safety-net-passthrough'
                ? switches.safenetPass === true
                : switches.yolo === true;
        return on ? mode : null;
    }
    return null;
}
/**
 * Whether a mode takes the human out of the loop. `safety-net-ask` keeps them in — it
 * exists to grade without a model, not to stop asking — so the decision seam only branches
 * on the other two, and `safety-net-ask` instead suppresses the grader refine pass.
 */
export function isHumanFree(mode) {
    return mode === 'safety-net-passthrough' || mode === 'yolo';
}
/**
 * What YOLO does when its grader is not in seat. It stays human-free (that is the tier's
 * promise), settles on the mechanical screen alone, and the caller records that the model
 * never answered — a tier that quietly becomes a different tier is the failure mode this
 * whole module exists to avoid.
 */
export const YOLO_WITHOUT_REVIEWER = 'settle-mechanically-and-label';
