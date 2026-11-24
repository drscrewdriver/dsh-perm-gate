/**
 * dsh-perm-gate 的首次使用引导文案（4 步；末条讲用量端点）。
 *
 * 与 `guide.tsx`（生成副本）分文件：副本会被 `_tools/guide-kit/sync.mjs` 覆盖，
 * 本插件专属文案必须留在这里。
 *
 * 术语取 `locales.ts` 的既有译名：宽松模式 / 后端审批策略 / llmAssist 受信 LLM /
 * 接收端来源 / 自定义 API / Endpoint / 预置端点 / 判定记录。
 */
import type { GuideLocale, GuideStep } from './guide.tsx'

export const PERM_GATE_GUIDE_STEPS: Partial<Record<GuideLocale, readonly GuideStep[]>> = {
  zh: [
    {
      title: '它管的是「要不要问你」',
      body: '总开关叫「宽松模式」：关着时按宿主权限档走；打开后由本插件判断哪些工具调用可以直接放行、哪些必须问你。',
    },
    {
      title: '三种后端策略，可叠加',
      body: '信任自动放行 / 一律确认 / LLM 评审。只想少弹窗就开第一个；处理陌生仓库时打开第二个，宁可多问一句。',
    },
    {
      title: '被拦了什么，去「判定记录」看',
      body: '输入框旁的提示条和侧栏历史记录会列出每次判定及理由；误判就地加入白名单或补一条拒绝关键词，下次不再问。',
    },
    {
      title: '评审模型建议挂本地端点',
      body: '「llmAssist 受信 LLM」的来源选「自定义 API（OpenAI 兼容）」，Endpoint 填本地服务（如 http://127.0.0.1:8000/v1）再写一个小模型 id；来源停在「使用会话当前默认模型」时，评审和被评审的对话跑在同一个 provider/model 上——每次工具调用都要再走一遍主模型，用量直接翻倍。',
    },
  ],
  en: [
    {
      title: 'It decides whether to ask you',
      body: 'The master switch is "permissive": off means the host permission tier rules; on means this plugin decides which tool calls pass straight through and which must ask you.',
    },
    {
      title: 'Three backend strategies, combinable',
      body: 'Trust-auto-allow / always-confirm / LLM review. Turn on the first if you just want fewer prompts; turn on the second on unfamiliar repos — better one extra question.',
    },
    {
      title: 'See what got gated',
      body: 'The notice strip beside the composer and the sidebar history list every decision with its reason. Add a whitelist pattern or a deny keyword right there and it stops asking next time.',
    },
    {
      title: 'Point the reviewer at a local endpoint',
      body: 'Set the llmAssist receiver source to “Custom API (OpenAI-compatible)”, put a local service in Endpoint (e.g. http://127.0.0.1:8000/v1) and pick a small model. Left on “Use the session’s current default model”, the reviewer and the reviewed conversation run on one provider/model, so every tool call runs the main model again and doubles spend.',
    },
  ],
}
