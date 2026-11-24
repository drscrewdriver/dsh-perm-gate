/**
 * dsh-perm-gate 的首次使用引导文案（3 步）。
 *
 * 与 `guide.tsx`（生成副本）分文件：副本会被 `_tools/guide-kit/sync.mjs` 覆盖，
 * 本插件专属文案必须留在这里。
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
  ],
}
