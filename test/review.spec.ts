import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  diffLines,
  EventLog,
  loadEventSnapshots,
  registerReviewRoutes,
  resolveAbsPath,
  saveEventSnapshots,
} from '../src/events.js'

const dirs: string[] = []
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-review-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Minimal webServer stand-in that can drive async handlers. */
function makeServer() {
  const routes = new Map<string, (req: unknown, res: unknown) => unknown>()
  return {
    register(route: { path: string; handler: (req: unknown, res: unknown) => unknown }): () => void {
      routes.set(route.path, route.handler)
      return () => { routes.delete(route.path) }
    },
    async call(method: string, url: string, payload?: unknown): Promise<{ code: number; body: unknown }> {
      const out = { code: 0, body: undefined as unknown }
      const handler = routes.get(url.split('?')[0] ?? url)
      if (handler === undefined) throw new Error(`no route for ${url}`)
      const req = {
        method,
        url,
        on(event: string, cb: (chunk?: unknown) => void): unknown {
          if (event === 'data' && payload !== undefined) cb(JSON.stringify(payload))
          if (event === 'end') cb()
          return undefined
        },
      }
      handler(req, {
        writeHead(code: number) { out.code = code },
        end(body?: string) { out.body = body === undefined ? undefined : JSON.parse(body) },
      })
      // Let the async handlers (revert / clear) settle.
      await new Promise((resolve) => setTimeout(resolve, 5))
      return out
    },
  }
}

describe('diffLines', () => {
  it('reports changed lines with context and stats', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n')
    const after = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'H', 'i', 'j'].join('\n')
    const result = diffLines(before, after, 1)
    expect(result.stats.added).toBe(1)
    expect(result.stats.removed).toBe(1)
    const lines = result.hunks.flatMap((h) => h.lines)
    expect(lines.some((l) => l.type === 'add' && l.text === 'H')).toBe(true)
    expect(lines.some((l) => l.type === 'del' && l.text === 'h')).toBe(true)
    expect(result.changedLines.length).toBe(2)
  })

  it('treats an unreadable after side as removed content', () => {
    const result = diffLines('a\nb', null, 0)
    expect(result.stats.removed).toBe(2)
    expect(result.hunks.length).toBeGreaterThan(0)
  })

  it('hides unchanged runs behind a hunk separator', () => {
    const before = Array.from({ length: 40 }, (_, i) => `line-${i}`).join('\n')
    const after = before.replace('line-0', 'changed-0')
    const result = diffLines(before, after, 2)
    expect(result.hunks.length).toBe(1)
    expect(result.hunks[0]?.hiddenBefore).toBe(0)
    expect(result.stats.contextLines).toBe(38)
  })

  it('returns no hunks when both sides are equal', () => {
    const result = diffLines('same\ntext', 'same\ntext', 3)
    expect(result.hunks).toEqual([])
    expect(result.stats.added).toBe(0)
    expect(result.stats.removed).toBe(0)
  })
})

describe('resolveAbsPath', () => {
  it('resolves a relative path against the base dir when it exists', () => {
    const dir = tmpDir()
    const file = join(dir, 'x.txt')
    writeFileSync(file, 'x', 'utf8')
    expect(resolveAbsPath('x.txt', dir)).toBe(file)
  })

  it('passes absolute paths through and expands ~', () => {
    expect(resolveAbsPath('/abs/path', tmpDir())).toBe('/abs/path')
    const home = resolveAbsPath('~/nested/file', tmpDir())
    expect(home).not.toBe('~/nested/file')
    expect(home).toContain('nested')
    expect(home).toContain('file')
  })
})

describe('snapshots', () => {
  it('saves and reloads one event\u2019s pre-change content', () => {
    const dir = tmpDir()
    const snaps = join(dir, 'snapshots')
    const file = join(dir, 'note.txt')
    writeFileSync(file, 'hello\n', 'utf8')
    saveEventSnapshots(snaps, 7, [file], dir, 's1')
    const loaded = loadEventSnapshots(snaps, 7)
    expect(loaded.length).toBe(1)
    expect(loaded[0]?.path).toBe(file)
    expect(loaded[0]?.content).toBe('hello\n')
    expect(loadEventSnapshots(snaps, 8)).toEqual([])
  })

  it('skips missing, empty, and device targets', () => {
    const dir = tmpDir()
    const snaps = join(dir, 'snapshots')
    writeFileSync(join(dir, 'empty.txt'), '', 'utf8')
    saveEventSnapshots(snaps, 1, [join(dir, 'missing.txt'), join(dir, 'empty.txt'), '/dev/null'], dir, 's1')
    expect(loadEventSnapshots(snaps, 1)).toEqual([])
  })

  it('snapshots auto and ask events only, and records the files list', () => {
    const dir = tmpDir()
    const snaps = join(dir, 'snapshots')
    const file = join(dir, 'a.txt')
    writeFileSync(file, 'one\n', 'utf8')
    const log = new EventLog(join(dir, 'events.jsonl'), Date.now, snaps)
    const auto = log.append({ tool: 'write', kind: 'auto', reason: 'r', files: [file], baseDir: dir, sessionId: 's1' })
    const ask = log.append({ tool: 'write', kind: 'ask', reason: 'r', files: [file], baseDir: dir, sessionId: 's1' })
    const deny = log.append({ tool: 'write', kind: 'deny', reason: 'r', files: [file], baseDir: dir, sessionId: 's1' })
    expect(auto?.files).toEqual([file])
    expect(loadEventSnapshots(snaps, auto?.id ?? -1).length).toBe(1)
    expect(loadEventSnapshots(snaps, ask?.id ?? -1).length).toBe(1)
    expect(loadEventSnapshots(snaps, deny?.id ?? -1)).toEqual([])
  })

  it('records the decision labels used by the history view', () => {
    const log = new EventLog(join(tmpDir(), 'events.jsonl'))
    const ev = log.append({
      tool: 'edit',
      kind: 'auto',
      reason: 'rule allow',
      verdict: 'rule',
      justification: 'edit src/app.ts',
      category: 'neutral',
    })
    expect(ev?.verdict).toBe('rule')
    expect(ev?.justification).toBe('edit src/app.ts')
    expect(ev?.category).toBe('neutral')
  })

  it('finds one event by id', () => {
    const log = new EventLog(join(tmpDir(), 'events.jsonl'))
    const ev = log.append({ tool: 'bash', kind: 'auto', reason: 'x' })
    expect(log.byId(ev?.id ?? -1)?.tool).toBe('bash')
    expect(log.byId(999)).toBeUndefined()
  })
})

describe('registerReviewRoutes', () => {
  function setup(): { server: ReturnType<typeof makeServer>; log: EventLog; snaps: string; dir: string; file: string } {
    const dir = tmpDir()
    const snaps = join(dir, 'snapshots')
    const file = join(dir, 'a.txt')
    writeFileSync(file, 'one\ntwo\n', 'utf8')
    const log = new EventLog(join(dir, 'events.jsonl'), Date.now, snaps)
    const server = makeServer()
    registerReviewRoutes(server, { log, snapshotsDir: snaps, send: async () => ({ ok: true, via: 'test' }) })
    return { server, log, snaps, dir, file }
  }

  it('serves a diff for a snapshotted file and 404s otherwise', async () => {
    const { server, log, dir, file } = setup()
    const ev = log.append({ tool: 'edit', kind: 'auto', reason: 'r', files: [file], baseDir: dir, sessionId: 's1' })
    writeFileSync(file, 'one\nTWO\n', 'utf8')
    const ok = await server.call('GET', `/api/dsh-perm-gate/diff?eventId=${ev?.id}&path=${encodeURIComponent('a.txt')}`)
    expect(ok.code).toBe(200)
    const lines = (ok.body as { hunks: { lines: { type: string; text: string }[] }[] }).hunks.flatMap((h) => h.lines)
    expect(lines.some((l) => l.type === 'add' && l.text === 'TWO')).toBe(true)
    expect(lines.some((l) => l.type === 'del' && l.text === 'two')).toBe(true)

    const missing = await server.call('GET', '/api/dsh-perm-gate/diff?eventId=999&path=a.txt')
    expect(missing.code).toBe(404)
    const bad = await server.call('GET', '/api/dsh-perm-gate/diff?eventId=1')
    expect(bad.code).toBe(400)
  })

  it('reports snapshot stats and clears them', async () => {
    const { server, log, dir, file } = setup()
    log.append({ tool: 'edit', kind: 'auto', reason: 'r', files: [file], baseDir: dir, sessionId: 's1' })
    const stats = await server.call('GET', '/api/dsh-perm-gate/snapshots-stats')
    expect((stats.body as { count: number }).count).toBe(1)
    expect((stats.body as { bytes: number }).bytes).toBeGreaterThan(0)

    const cleared = await server.call('POST', '/api/dsh-perm-gate/snapshots-clear', {})
    expect((cleared.body as { removed: number }).removed).toBe(1)
    const after = await server.call('GET', '/api/dsh-perm-gate/snapshots-stats')
    expect((after.body as { count: number }).count).toBe(0)
  })

  it('scopes snapshot clearing to one session', async () => {
    const { server, log, dir, file } = setup()
    log.append({ tool: 'edit', kind: 'auto', reason: 'r', files: [file], baseDir: dir, sessionId: 's1' })
    log.append({ tool: 'edit', kind: 'auto', reason: 'r', files: [file], baseDir: dir, sessionId: 's2' })
    const scoped = await server.call('POST', '/api/dsh-perm-gate/snapshots-clear', { sessionId: 's1' })
    expect((scoped.body as { removed: number }).removed).toBe(1)
    const left = await server.call('GET', '/api/dsh-perm-gate/snapshots-stats')
    expect((left.body as { count: number }).count).toBe(1)
  })

  it('delivers a revert instruction carrying the event context', async () => {
    const dir = tmpDir()
    const snaps = join(dir, 'snapshots')
    const file = join(dir, 'a.txt')
    writeFileSync(file, 'one\n', 'utf8')
    const log = new EventLog(join(dir, 'events.jsonl'), Date.now, snaps)
    const ev = log.append({
      tool: 'edit',
      kind: 'auto',
      reason: 'r',
      justification: 'edit a.txt',
      files: [file],
      baseDir: dir,
      sessionId: 's1',
    })
    const sent: { sessionId: string; content: string }[] = []
    const server = makeServer()
    registerReviewRoutes(server, {
      log,
      snapshotsDir: snaps,
      send: async (sessionId, content) => { sent.push({ sessionId, content }); return { ok: true, via: 'test' } },
    })

    const res = await server.call('POST', '/api/dsh-perm-gate/revert', { sessionId: 's1', eventId: ev?.id })
    expect(res.code).toBe(200)
    expect(sent.length).toBe(1)
    expect(sent[0]?.sessionId).toBe('s1')
    expect(sent[0]?.content).toContain('a.txt')
    expect(sent[0]?.content).toContain('edit a.txt')

    const unknown = await server.call('POST', '/api/dsh-perm-gate/revert', { sessionId: 's1', eventId: 999 })
    expect(unknown.code).toBe(404)
    const bad = await server.call('POST', '/api/dsh-perm-gate/revert', { sessionId: 's1' })
    expect(bad.code).toBe(400)
  })

  it('reports a failed delivery instead of pretending success', async () => {
    const dir = tmpDir()
    const log = new EventLog(join(dir, 'events.jsonl'), Date.now, join(dir, 'snapshots'))
    const ev = log.append({ tool: 'edit', kind: 'auto', reason: 'r', sessionId: 's1' })
    const server = makeServer()
    registerReviewRoutes(server, {
      log,
      snapshotsDir: join(dir, 'snapshots'),
      send: async () => ({ ok: false, error: 'no channel' }),
    })
    const res = await server.call('POST', '/api/dsh-perm-gate/revert', { sessionId: 's1', eventId: ev?.id })
    expect(res.code).toBe(500)
    expect((res.body as { error: string }).error).toBe('no channel')
  })

  it('registers nothing without a webServer service', () => {
    const log = new EventLog(undefined)
    expect(registerReviewRoutes(undefined, { log, snapshotsDir: undefined, send: async () => ({ ok: true }) })).toEqual([])
    expect(registerReviewRoutes({}, { log, snapshotsDir: undefined, send: async () => ({ ok: true }) })).toEqual([])
  })
})
