/**
 * switch-state.spec.ts — 药丸开关「乐观态但不说谎」契约。
 *
 * 客户端半区没有 react-dom，组件本体渲染不了；这里测的是被抽出来的状态机
 * （点击即翻 / 快照追上才交还 / 写失败与看门狗回落），外加两条对 card.tsx
 * 源码的静态闸：布尔控件必须全是 switch 角色、颜色必须全部走主题令牌
 * （十六进制只允许作为 var() 回退存在——暗色壳写死颜色是本家族的旧事故）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  pendingAfterFailure,
  pendingAfterSync,
  shownValue,
  SWITCH_SETTLE_MS,
} from '../src/client/switch-state.ts'

const cardSource = readFileSync(new URL('../src/client/card.tsx', import.meta.url), 'utf8')
// 从乐观钩子起切：选择器与胶囊开关共用同一套控件规则，颜色闸也得一起覆盖。
const switchSource = cardSource.slice(
  cardSource.indexOf('function useOptimistic'),
  cardSource.indexOf('A minimal add/remove editor'),
)

describe('药丸开关的乐观态状态机', () => {
  it('没有点击时完全跟随快照', () => {
    expect(shownValue(null, true)).toBe(true)
    expect(shownValue(null, false)).toBe(false)
  })

  it('点击立即取反当前显示值，不等写入回来', () => {
    // 快照还是 false，第一击就得把胶囊推到 true（乐观值优先于存储值）。
    expect(shownValue(true, false)).toBe(true)
    // 写入未回来时再击一次：新值从**显示值**而不是存储值取反，所以翻回 false。
    const first = !shownValue(null, false)
    expect(!shownValue(first, false)).toBe(false)
  })

  it('快照追上乐观值后把显示权交还快照', () => {
    expect(pendingAfterSync(true, true)).toBeNull()
    expect(pendingAfterSync(false, false)).toBeNull()
  })

  it('快照还没追上时保持乐观值（包括被别的写者改动期间）', () => {
    expect(pendingAfterSync(true, false)).toBe(true)
    expect(pendingAfterSync(null, true)).toBeNull()
  })

  it('写入失败即回落到快照真值，不保留一个配置里没有的状态', () => {
    const pending = pendingAfterFailure(true)
    expect(pending).toBeNull()
    // 回落之后显示的就是存储真值。
    expect(shownValue(pending, false)).toBe(false)
  })

  it('乐观值不会永久说谎：宿主既不落盘也不报错时看门狗兜住', () => {
    // 时间常量要落在「一次设置写入够快、又不至于让人以为控件坏了」的区间。
    expect(SWITCH_SETTLE_MS).toBeGreaterThanOrEqual(1_500)
    expect(SWITCH_SETTLE_MS).toBeLessThanOrEqual(10_000)
    // 序列：点击 → 快照始终为 false → 超时回落 → 显示回到 false。
    let pending: boolean | null = !shownValue(null, false)
    pending = pendingAfterSync(pending, false)
    expect(shownValue(pending, false)).toBe(true) // 仍在窗口内，保持乐观
    pending = pendingAfterFailure(pending) // 看门狗与写失败走同一条回落
    expect(shownValue(pending, false)).toBe(false)
  })

  it('多态控件（档位选择器）复用同一套乐观规则', () => {
    // 选择器的值是模式串，不是布尔：规则必须与 T 无关。
    const stored = 'inherit' as const
    expect(shownValue('yolo', stored)).toBe('yolo')
    expect(pendingAfterSync('yolo', stored)).toBe('yolo')
    expect(pendingAfterSync('yolo', 'yolo')).toBeNull()
  })
})

describe('card.tsx 的开关控件形态', () => {
  it('布尔行不再残留原生 checkbox', () => {
    expect(cardSource).not.toMatch(/type=["']checkbox["']/)
    expect(switchSource).toMatch(/role="switch"/)
    // 视觉状态与无障碍状态同源：只由 aria-checked 驱动。
    expect(switchSource).toMatch(/aria-checked=\{shown\}/)
  })

  it('开关颜色只取主题令牌，十六进制仅作为 var() 回退', () => {
    expect(switchSource).toMatch(/--dsw-alias-brand-primary/)
    expect(switchSource).toMatch(/--dsw-alias-border-l3/)
    for (const match of switchSource.matchAll(/#[0-9a-fA-F]{3,8}/g)) {
      const before = switchSource.slice(Math.max(0, (match.index ?? 0) - 48), match.index)
      expect(before).toContain('var(')
    }
  })

  it('每个开关都有可及名称（label 关联或 aria-label）', () => {
    expect(switchSource).toMatch(/aria-label=\{label\}/)
    // 字面 id 现在出现在两种调用上：裸 PillSwitch，以及把 id 转交给胶囊的 TierRow。
    const ids = cardSource.match(/id="plugin-config-perm-gate-[a-z-]+"/g) ?? []
    expect(ids.length).toBeGreaterThanOrEqual(14)
  })

  it('无人值守开关每颗只管自己那一档', () => {
    const row = cardSource.slice(cardSource.indexOf('function TierRow'), cardSource.indexOf('function PillSwitch'))
    expect(row.length).toBeGreaterThan(80)
    expect(row).toMatch(/htmlFor=\{id\}/)
    // 预设 id 必须写在标签上：一开关一实现一档，看得到才串不了。
    expect(row).toMatch(/· \{preset\}/)
    const rows = cardSource.match(/<TierRow[\s\S]*?\/>/g) ?? []
    expect(rows).toHaveLength(3)
    expect(cardSource).toMatch(/preset="permissive-yolo"/)
    expect(cardSource).toMatch(/preset="permissive-mech"/)
    expect(cardSource).toMatch(/preset="permissive-snet"/)
    expect(cardSource).toMatch(/scope\.set\('safenetPass', next\)/)
    expect(cardSource).toMatch(/scope\.set\('safenetAsk', next\)/)
    // 退役的 per-preset 表不得回来：它和三个开关同时存在就会互相说谎。
    expect(cardSource).not.toMatch(/scope\.set\('unattendedTiers'/)
  })
})
