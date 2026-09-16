/**
 * Known OpenAI-compatible endpoint presets for the llmAssist receiver
 * (the settings card fills endpoint + model from one pick; every field stays
 * editable afterwards). Pure data shared by the node half and the client
 * bundle, so it must stay import-free.
 */
/** One preset receiver endpoint. */
export interface LlmPreset {
    readonly id: string;
    readonly label: string;
    /** OpenAI-compatible base URL (the `/chat/completions` suffix is normalized away). */
    readonly endpoint: string;
    /** Suggested chat model id (editable after filling). */
    readonly model: string;
}
export declare const LLM_PRESETS: readonly LlmPreset[];
