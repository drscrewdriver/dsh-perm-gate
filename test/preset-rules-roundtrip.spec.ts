/**
 * 播种产物的写读往返守卫。
 *
 * 为什么单独钉这一条：`mergePresetIntoRaw` 把预设条目还原成 raw 形态时，`params`
 * 维度曾被写成编译后的数组（`[{key,patterns,negated}]`），而读侧
 * `parseParamsDimension` 要求映射 ⇒ 播种写进设置文档后，**下一次启动**报
 * `permissions.deny[22].params.params must be a mapping`，perm-gate 整个不激活
 * （farm 0.1.7/0.2.0 实测签名 `not-activated`）。首次启动全绿、第二次才坏，
 * 只断言「规则能否命中 example」的测试结构上看不见这类缺陷。
 */
import { describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { compileDocument, parsePermissionsDocument } from '../src/rule.js'
import { mergePresetIntoRaw, parsePresetDoc, presetRuleId } from '../src/preset-rules.js'

const merged = mergePresetIntoRaw(undefined)
const wrapped = merged.doc as { permissions?: { deny?: unknown[]; ask?: unknown[] } }
const sections = wrapped.permissions ?? (merged.doc as { deny?: unknown[]; ask?: unknown[] })
const idOf = (e: unknown): string => {
  const reason = (e as { reason?: unknown } | undefined)?.reason
  return presetRuleId(reason) ?? ''
}

describe('preset seed round-trip: 写出的文档必须能被自己的读侧读回', () => {
  it('播种 51 条全部落进 deny/ask', () => {
    const src = parsePresetDoc()
    expect(merged.added).toBe(src.deny.length + src.ask.length)
    expect((sections.deny ?? []).length).toBe(src.deny.length)
    expect((sections.ask ?? []).length).toBe(src.ask.length)
  })

  it('params 维度是映射，不是编译后的数组', () => {
    const all = [...(sections.deny ?? []), ...(sections.ask ?? [])] as Array<Record<string, unknown>>
    const withParams = all.filter((e) => e.params !== undefined)
    expect(withParams.length).toBeGreaterThan(0)
    for (const e of withParams) {
      expect(Array.isArray(e.params), `条目 ${idOf(e)} 的 params 被写成数组`).toBe(false)
      expect(typeof e.params).toBe('object')
    }
  })

  it('YAML 往返后读侧零异常，且各维度与源编译结果逐字段相等', () => {
    const rt = parsePermissionsDocument(stringify(merged.doc))
    const src = parsePresetDoc()
    for (const key of ['deny', 'ask'] as const) {
      const a = [...src[key]].sort((x, y) => idOf(x).localeCompare(idOf(y)))
      const b = [...rt[key]].sort((x, y) => idOf(x).localeCompare(idOf(y)))
      expect(b.map((e) => e.params)).toEqual(a.map((e) => e.params))
      expect(b.map((e) => e.command)).toEqual(a.map((e) => e.command))
      expect(b.map((e) => e.args)).toEqual(a.map((e) => e.args))
      expect(b.map((e) => e.paths)).toEqual(a.map((e) => e.paths))
      expect(b.map((e) => e.absent)).toEqual(a.map((e) => e.absent))
      expect(b.map((e) => e.argv)).toEqual(a.map((e) => e.argv))
    }
  })

  it('往返文档能进编译（真机激活前的最后一道形状关）', () => {
    const rt = parsePermissionsDocument(stringify(merged.doc))
    expect(() => compileDocument(rt, { maxGlobStars: 2, caseInsensitivePaths: true })).not.toThrow()
  })

  it('幂等：对已含预设的文档再合并不增条', () => {
    const again = mergePresetIntoRaw(merged.doc)
    expect(again.added).toBe(0)
  })
})
