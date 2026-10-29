/**
 * cred 阶梯的表级守卫与播种水位语义（tasks 11/13/14 的测试面）：
 *  - merge 水位重跑只补物理删除的 id，enabled:false 的撤销永不复活；
 *  - 预设表里任何带 paths 维度的条目必须带 tools 限定（READ 预询后，
 *    无限定 paths 会把记忆库/.dsh 的正当读取整体吞掉）；
 *  - credWriteExempt 清单不触碰其他 P0 判据（全量豁免下根盘清扫仍 deny）。
 */
import { describe, expect, it } from 'vitest'
import { homedir } from 'node:os'
import { parsePresetDoc, presetRuleId, mergePresetIntoRaw } from '../src/preset-rules'
import { setCredFamilyAction } from '../src/preset-rules'
import { CRED_FAMILY_IDS } from '../src/cred-families'
import { hardDenyReason } from '../src/engine'
import { PermGateRuntime } from '../src/runtime'
import type { ToolCallContext } from '../src/evaluate'

describe('preset table guard: paths dimension requires a tools restriction', () => {
  it('no entry selects paths without naming tools', () => {
    const doc = parsePresetDoc()
    for (const [section, list] of [['deny', doc.deny], ['ask', doc.ask]] as const) {
      for (const e of list) {
        if (e.paths.length > 0) {
          expect(e.tools.length, `${section} entry ${presetRuleId(e.reason)} has paths but no tools`)
            .toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('seed watermark semantics (merge re-run after v1)', () => {
  it('disabled (revoked) cred rows are never re-added', () => {
    const first = mergePresetIntoRaw({})
    expect(first.added).toBeGreaterThan(0)
    const flipped = { ...first.doc }
    flipped.ask = (first.doc.ask as Record<string, unknown>[]).map((e) =>
      presetRuleId(e.reason) === 'cred.db' ? { ...e, enabled: false } : e,
    )
    const again = mergePresetIntoRaw(flipped)
    expect(again.added).toBe(0)
    expect((again.doc.ask as Record<string, unknown>[]).some((e) => e.enabled === false && presetRuleId(e.reason) === 'cred.db')).toBe(true)
  })

  it('a physically deleted cred row is backfilled by the next watermark merge', () => {
    const first = mergePresetIntoRaw({})
    const pruned = { ...first.doc }
    pruned.ask = (first.doc.ask as Record<string, unknown>[]).filter((e) => presetRuleId(e.reason) !== 'cred.env')
    const again = mergePresetIntoRaw(pruned)
    expect(again.added).toBe(1)
    expect((again.doc.ask as Record<string, unknown>[]).some((e) => presetRuleId(e.reason) === 'cred.env')).toBe(true)
  })
})

describe('setCredFamilyAction — four rungs, two stores, round trips', () => {
  const seeded = mergePresetIntoRaw({}).doc
  const findRow = (doc: Record<string, unknown>, family: string) => {
    const tag = `cred.${family}`
    for (const key of ['deny', 'ask'] as const) {
      const arr = (doc[key] as Record<string, unknown>[] | undefined) ?? []
      const e = arr.find((x) => presetRuleId(x.reason) === tag)
      if (e !== undefined) return { key, entry: e }
    }
    return undefined
  }

  it('deny moves the row to the deny section and clears the exemption', () => {
    const { doc, exempt } = setCredFamilyAction(seeded, ['package'], 'package', 'deny')
    const row = findRow(doc, 'package')
    expect(row?.key).toBe('deny')
    expect(row?.entry.enabled).not.toBe(false)
    expect(exempt).toEqual([])
  })

  it('ask moves it back to the ask section', () => {
    const denied = setCredFamilyAction(seeded, [], 'ssh', 'deny').doc
    const { doc, exempt } = setCredFamilyAction(denied, ['ssh'], 'ssh', 'ask')
    expect(findRow(doc, 'ssh')?.key).toBe('ask')
    expect(exempt).toEqual([])
  })

  it('readonly disables the row WITHOUT touching the exemption list', () => {
    const { doc, exempt } = setCredFamilyAction(seeded, ['cli'], 'cli', 'readonly')
    const row = findRow(doc, 'cli')
    expect(row?.entry.enabled).toBe(false)
    expect(exempt).toEqual([])
  })

  it('readwrite disables the row AND lists the family', () => {
    const { doc, exempt } = setCredFamilyAction(seeded, [], 'env', 'readwrite')
    expect(findRow(doc, 'env')?.entry.enabled).toBe(false)
    expect(exempt).toEqual(['env'])
  })

  it('idempotent: applying the same rung twice changes nothing further', () => {
    const a = setCredFamilyAction(seeded, [], 'cloud', 'readwrite')
    const b = setCredFamilyAction(a.doc, a.exempt, 'cloud', 'readwrite')
    expect(b.exempt).toEqual(['cloud'])
    expect(JSON.stringify(b.doc)).toBe(JSON.stringify(a.doc))
  })

  it('the full ladder cycle lands where it started for every family', () => {
    let doc: unknown = seeded
    let exempt: string[] = []
    for (const family of CRED_FAMILY_IDS) {
      for (const rung of ['deny', 'readonly', 'readwrite', 'ask'] as const) {
        const r = setCredFamilyAction(doc, exempt, family, rung)
        doc = r.doc
        exempt = r.exempt
      }
      const row = findRow(doc as Record<string, unknown>, family)
      expect(row?.key, family).toBe('ask')
      expect(row?.entry.enabled, family).not.toBe(false)
    }
    expect(exempt).toEqual([])
  })

  it('the write ladder never arms or disarms any other P0 clause', () => {
    const ctx: ToolCallContext = {
      tool: 'shell', args: { command: 'rm -rf /' }, commandText: 'rm -rf /',
      cwd: 'E:/w', home: 'E:/w', credWriteExempt: [...CRED_FAMILY_IDS],
    }
    expect(hardDenyReason(ctx)).toBeDefined()
  })

  it('survives a deep-frozen settings snapshot (live host hands frozen config)', () => {
    const deepFreeze = <T>(o: T): T => {
      if (o !== null && typeof o === 'object') {
        for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v)
        Object.freeze(o)
      }
      return o
    }
    const frozen = deepFreeze(structuredClone(mergePresetIntoRaw({}).doc))
    // Before the copy-on-write fix this threw: Cannot assign to read only property 'enabled'
    const { doc } = setCredFamilyAction(frozen, [], 'ssh', 'deny')
    const row = (doc.deny as Record<string, unknown>[]).find((e) => presetRuleId(e.reason) === 'cred.ssh')
    expect(row).toBeDefined()
    expect(row!.enabled).not.toBe(false)
    const back = setCredFamilyAction(doc, [], 'ssh', 'readonly')
    const askRow = (back.doc.ask as Record<string, unknown>[]).find((e) => presetRuleId(e.reason) === 'cred.ssh')
    expect(askRow!.enabled).toBe(false)
  })

  it('热生效：同一个 runtime 实例改豁免清单，下一次调用即变（不重建）', () => {
    const exempt: string[] = []
    const rt = new PermGateRuntime({ readCredWriteExemptFamilies: () => exempt })
    const exec = {
      name: 'write',
      arguments: { file_path: `${homedir().replace(/\\/g, '/')}/.npmrc` },
      cwd: 'E:/w', sessionId: 'ladder',
    }
    const before = rt.decideExecution(exec)
    expect(before?.kind, '默认：凭据 store 写被 P0 硬拦').toBe('deny')
    exempt.push('package')
    const after = rt.decideExecution(exec)
    expect(after?.reason ?? '', '豁免后不再是 store 判据').not.toContain('credential store')
    expect(after?.kind).not.toBe('deny')
  })
})
