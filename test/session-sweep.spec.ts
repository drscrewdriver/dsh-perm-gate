import { mkdtempSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { classifySessions, isStaleSession, normalizeSessionId, sweepSessionData } from '../src/session-sweep.js'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-sweep-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function storeWith(live: string[], archived: string[]): string {
  return JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, archivedSessionIds: archived },
    tables: {
      workspaces: Object.fromEntries(live.map((id, i) => [`w${i}`, { path: `/p${i}`, title: `t${i}`, sessionIds: [id] }])),
    },
  })
}

describe('normalizeSessionId', () => {
  it('strips the session- prefix and survives empty/undefined input', () => {
    expect(normalizeSessionId('session-abc')).toBe('abc')
    expect(normalizeSessionId('abc')).toBe('abc')
    expect(normalizeSessionId('')).toBe('')
    expect(normalizeSessionId(undefined)).toBe('')
  })
})

describe('classifySessions', () => {
  it('collects live sessions from every workspace and archived ids from global', () => {
    const cls = classifySessions(storeWith(['session-aaa', 'session-bbb'], ['session-ccc']))
    expect(cls).not.toBeNull()
    expect([...cls!.live]).toEqual(['aaa', 'bbb'])
    expect([...cls!.archived]).toEqual(['ccc'])
  })

  it('returns null on unparsable or non-object content', () => {
    expect(classifySessions('{torn')).toBeNull()
    expect(classifySessions('null')).toBeNull()
    expect(classifySessions('[]')).toBeNull()
  })

  it('degrades missing sections to empty sets', () => {
    const cls = classifySessions(JSON.stringify({ unit: { name: 'workspace', version: 2 } }))
    expect(cls).not.toBeNull()
    expect(cls!.live.size).toBe(0)
    expect(cls!.archived.size).toBe(0)
  })

  it('ignores workspace records without sessionIds', () => {
    const cls = classifySessions(JSON.stringify({ tables: { workspaces: { a: { path: '/p' }, b: null } } }))
    expect(cls!.live.size).toBe(0)
  })
})

describe('isStaleSession', () => {
  const cls = classifySessions(storeWith(['session-live'], ['session-archived']))!
  it('flags archived and deleted sessions, prefix-insensitively', () => {
    expect(isStaleSession('session-archived', cls)).toBe(true)
    expect(isStaleSession('gone', cls)).toBe(true)
    expect(isStaleSession('session-live', cls)).toBe(false)
  })
  it('never flags an empty (unattributable) id', () => {
    expect(isStaleSession('', cls)).toBe(false)
  })
})

describe('sweepSessionData', () => {
  function fixture(cls: NonNullable<ReturnType<typeof classifySessions>>, events: string, snapshots: Record<string, unknown>) {
    const dir = tempDir()
    const eventsFile = join(dir, 'events.jsonl')
    const snapshotsDir = join(dir, 'snapshots')
    mkdirSync(snapshotsDir, { recursive: true })
    writeFileSync(eventsFile, events, 'utf8')
    for (const [name, doc] of Object.entries(snapshots)) {
      writeFileSync(join(snapshotsDir, name), JSON.stringify(doc), 'utf8')
    }
    return { eventsFile, snapshotsDir, sweep: () => sweepSessionData({ classification: cls, eventsFile, snapshotsDir }) }
  }

  it('removes archived and deleted sessions, keeps live ones, preserves order and ids', () => {
    const cls = classifySessions(storeWith(['session-keep'], ['session-old']))!
    const f = fixture(cls, [
      JSON.stringify({ id: 1, sessionId: 'session-keep', tool: 'shell' }),
      JSON.stringify({ id: 2, sessionId: 'session-old', tool: 'shell' }),
      JSON.stringify({ id: 3, sessionId: 'session-ghost', tool: 'shell' }),
      JSON.stringify({ id: 4, sessionId: 'keep', tool: 'shell' }),
    ].join('\n') + '\n', {})
    const report = f.sweep()
    expect(report).toEqual({ eventsRemoved: 2, snapshotsRemoved: 0 })
    const lines = readFileSync(f.eventsFile, 'utf8').trim().split('\n')
    expect(lines.map((l) => JSON.parse(l).id)).toEqual([1, 4])
    expect(existsSync(`${f.eventsFile}.sweep-tmp`)).toBe(false)
  })

  it('deletes snapshots of stale sessions, keeps legacy-empty and unparsable ones', () => {
    const cls = classifySessions(storeWith(['session-keep'], []))!
    const f = fixture(cls, '', {
      '1.json': { eventId: 1, sessionId: 'session-keep', snapshots: [] },
      '2.json': { eventId: 2, sessionId: 'session-gone', snapshots: [] },
      '3.json': { eventId: 3, snapshots: [] }, // legacy: no sessionId
    })
    writeFileSync(join(f.snapshotsDir, 'torn.json'), '{"eventId":4,"sessionId":"se')
    const report = f.sweep()
    expect(report.snapshotsRemoved).toBe(1)
    const names = readdirSync(f.snapshotsDir).sort()
    expect(names).toContain('1.json')
    expect(names).toContain('3.json')
    expect(names).toContain('torn.json')
    expect(names).not.toContain('2.json')
  })

  it('does not touch events.jsonl when nothing is stale', () => {
    const cls = classifySessions(storeWith(['session-keep'], []))!
    const events = JSON.stringify({ id: 1, sessionId: 'session-keep' }) + '\n'
    const f = fixture(cls, events, {})
    expect(f.sweep().eventsRemoved).toBe(0)
    expect(readFileSync(f.eventsFile, 'utf8')).toBe(events)
  })

  it('keeps unparsable event lines instead of destroying them', () => {
    const cls = classifySessions(storeWith([], ['session-old']))!
    const f = fixture(cls, '{torn line\n', {})
    expect(f.sweep().eventsRemoved).toBe(0)
    expect(readFileSync(f.eventsFile, 'utf8')).toBe('{torn line\n')
  })

  it('returns zeros instead of throwing when data files are missing', () => {
    const dir = tempDir()
    const report = sweepSessionData({
      classification: { live: new Set(), archived: new Set() },
      eventsFile: join(dir, 'missing.jsonl'),
      snapshotsDir: join(dir, 'missing-snapshots'),
    })
    expect(report).toEqual({ eventsRemoved: 0, snapshotsRemoved: 0 })
  })

  it('rewrites to an empty file when every line is stale', () => {
    const cls = classifySessions(storeWith([], []))!
    const f = fixture(cls, JSON.stringify({ id: 1, sessionId: 'session-old' }) + '\n', {})
    expect(f.sweep().eventsRemoved).toBe(1)
    expect(readFileSync(f.eventsFile, 'utf8')).toBe('')
  })
})
