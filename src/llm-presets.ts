/**
 * Known OpenAI-compatible endpoint presets for the llmAssist receiver
 * (the settings card fills endpoint + model from one pick; every field stays
 * editable afterwards). Pure data shared by the node half and the client
 * bundle, so it must stay import-free.
 */

/** One preset receiver endpoint. */
export interface LlmPreset {
  readonly id: string
  readonly label: string
  /** OpenAI-compatible base URL (the `/chat/completions` suffix is normalized away). */
  readonly endpoint: string
  /** Suggested chat model id (editable after filling). */
  readonly model: string
}

export const LLM_PRESETS: readonly LlmPreset[] = [
  { id: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'xiaomi-mimo', label: '小米 MiMo', endpoint: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5' },
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
]
