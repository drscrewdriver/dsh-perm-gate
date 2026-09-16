/**
 * Known OpenAI-compatible endpoint presets for the llmAssist receiver
 * (the settings card fills endpoint + model from one pick; every field stays
 * editable afterwards). Pure data shared by the node half and the client
 * bundle, so it must stay import-free.
 */
export const LLM_PRESETS = [
    { id: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { id: 'xiaomi-mimo', label: '小米 MiMo', endpoint: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5' },
    { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
];
