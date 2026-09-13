import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { apply } from '../src/index.js'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Minimal ctx: captures disposers; no injected services (routes/stand down paths are optional). */
function mockCtx(): { ctx: never; dispose: () => void } {
  const disposers: Array<() => void> = []
  const ctx = {
    effect(fn: () => () => void): void {
      disposers.push(fn())
    },
    get(): undefined {
      return undefined
    },
    inject(_deps: readonly string[], _fn: (actx: never) => void): void {
      // services absent — the plugin stands down those surfaces
    },
    on(_name: string, _listener: (...args: never[]) => unknown): void {
      // host event bus absent — pre-execute hooks are not under test here
    },
  }
  return { ctx: ctx as never, dispose: () => disposers.forEach((d) => d()) }
}

describe('apply() session sweep wiring', () => {
  it('sweeps stale sessions once on startup and honors the dispose hook', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-apply-'))
    dirs.push(dir)
    const dataDir = join(dir, 'perm-gate')
    const eventsFile = join(dataDir, 'events.jsonl')
    const snapshotsDir = join(dataDir, 'snapshots')
    mkdirSync(dataDir, { recursive: true })
    mkdirSync(snapshotsDir, { recursive: true })
    writeFileSync(eventsFile, [
      JSON.stringify({ id: 1, sessionId: 'session-keep', tool: 'shell', kind: 'auto', reason: 'r' }),
      JSON.stringify({ id: 2, sessionId: 'session-old', tool: 'shell', kind: 'auto', reason: 'r' }),
    ].join('\n') + '\n')
    writeFileSync(join(snapshotsDir, '1.json'), JSON.stringify({ eventId: 1, sessionId: 'session-keep', snapshots: [] }))
    writeFileSync(join(snapshotsDir, '2.json'), JSON.stringify({ eventId: 2, sessionId: 'session-old', snapshots: [] }))
    const store = join(dir, 'storages', 'workspace.json')
    mkdirSync(join(dir, 'storages'), { recursive: true })
    writeFileSync(store, JSON.stringify({
      global: { archivedSessionIds: ['session-old'] },
      tables: { workspaces: { w: { path: '/p', sessionIds: ['session-keep'] } } },
    }))

    const { ctx, dispose } = mockCtx()
    apply(ctx, {
      dshHome: dir,
      eventsFile,
      snapshotsDir,
      workspaceStoreFile: store,
      gatePresets: ['permissive'],
    } as never)

    // The first sweep is scheduled via setTimeout(0) — let it fire.
    await new Promise((resolve) => setTimeout(resolve, 20))

    const lines = readFileSync(eventsFile, 'utf8').trim().split('\n')
    expect(lines.map((l) => (JSON.parse(l) as { id: number }).id)).toEqual([1])
    expect(readdirSync(snapshotsDir).sort()).toEqual(['1.json'])
    expect(() => dispose()).not.toThrow()
  })

  it('starts no timer and sweeps nothing when sessionSweep is false', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-apply-off-'))
    dirs.push(dir)
    const eventsFile = join(dir, 'events.jsonl')
    writeFileSync(eventsFile, JSON.stringify({ id: 1, sessionId: 'session-old', tool: 'shell', kind: 'auto', reason: 'r' }) + '\n')
    const store = join(dir, 'workspace.json')
    writeFileSync(store, JSON.stringify({
      global: { archivedSessionIds: ['session-old'] },
      tables: { workspaces: {} },
    }))

    const { ctx, dispose } = mockCtx()
    apply(ctx, { dshHome: dir, eventsFile, workspaceStoreFile: store, sessionSweep: false } as never)
    await new Promise((resolve) => setTimeout(resolve, 20))

    // The stale line is still there: no first sweep ran, so no timer exists.
    expect(readFileSync(eventsFile, 'utf8')).toContain('session-old')
    expect(() => dispose()).not.toThrow()
  })
})
