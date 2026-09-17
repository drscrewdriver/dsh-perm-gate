import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EventLog, registerEventsRoute, registerStreamRoute } from '../src/events.js'

const dirs: string[] = []
function tmpFile(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'perm-gate-events-'))
  dirs.push(dir)
  return join(dir, 'perm-gate', name)
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('EventLog', () => {
  it('appends events with monotonic ids and truncates reasons', () => {
    const log = new EventLog(tmpFile('events.jsonl'))
    const a = log.append({ tool: 'bash', kind: 'ask', reason: 'x'.repeat(500) })
    const b = log.append({ tool: 'write', kind: 'auto', risk: 'safe', reason: 'ok', sessionId: 's1' })
    expect(a?.id).toBe(1)
    expect(b?.id).toBe(2)
    expect(a?.reason.length).toBe(200)
    expect(b?.risk).toBe('safe')
    expect(b?.sessionId).toBe('s1')
  })

  it('queries with since and sessionId filters', () => {
    const log = new EventLog(tmpFile('events.jsonl'))
    log.append({ tool: 'bash', kind: 'ask', reason: 'a', sessionId: 's1' })
    log.append({ tool: 'write', kind: 'auto', reason: 'b', sessionId: 's2' })
    log.append({ tool: 'bash', kind: 'deny', reason: 'c', sessionId: 's1' })
    expect(log.query().length).toBe(3)
    expect(log.query({ since: 2 }).map((e) => e.id)).toEqual([3])
    expect(log.query({ sessionId: 's1' }).map((e) => e.id)).toEqual([1, 3])
    expect(log.query({ sessionId: 's1', since: 1 }).map((e) => e.id)).toEqual([3])
  })

  it('resumes the id sequence from an existing file', () => {
    const file = tmpFile('events.jsonl')
    const first = new EventLog(file)
    first.append({ tool: 'bash', kind: 'ask', reason: 'a' })
    first.append({ tool: 'bash', kind: 'deny', reason: 'b' })
    const second = new EventLog(file)
    expect(second.append({ tool: 'bash', kind: 'auto', reason: 'c' })?.id).toBe(3)
  })

  it('skips corrupted lines and an empty/missing file yields nothing', () => {
    const file = tmpFile('events.jsonl')
    const log = new EventLog(file)
    expect(log.query()).toEqual([])
    expect(log.append({ tool: 'bash', kind: 'ask', reason: 'seed' })?.id).toBe(1)
    writeFileSync(file, 'not json\n{"id":2,"ts":"t","sessionId":"","tool":"w","kind":"auto","reason":"ok"}\n', 'utf8')
    expect(log.query().length).toBe(1)
    expect(log.query()[0]?.tool).toBe('w')
  })

  it('is a no-op without a file path', () => {
    const log = new EventLog(undefined)
    expect(log.append({ tool: 'bash', kind: 'ask', reason: 'x' })).toBeUndefined()
    expect(log.query()).toEqual([])
  })
})

describe('registerEventsRoute', () => {
  function makeServer() {
    let handler: ((req: unknown, res: unknown) => unknown) | undefined
    return {
      register(route: { handler: (req: unknown, res: unknown) => unknown }): () => void {
        handler = route.handler
        return () => {}
      },
      call(method: string, url: string): { code: number; body: unknown } {
        const out = { code: 0, body: undefined as unknown }
        handler?.({ method, url }, {
          writeHead(code: number, headers?: Record<string, string>) { out.code = code; void headers },
          end(body?: string) { out.body = body === undefined ? undefined : JSON.parse(body) },
        })
        return out
      },
    }
  }

  it('registers on a webServer-like service and answers queries', () => {
    const log = new EventLog(tmpFile('events.jsonl'))
    log.append({ tool: 'bash', kind: 'ask', reason: 'a', sessionId: 's1' })
    log.append({ tool: 'bash', kind: 'auto', reason: 'b', sessionId: 's2' })
    const server = makeServer()
    expect(typeof registerEventsRoute(server, log)).toBe('function')
    const all = server.call('GET', '/api/dsh-perm-gate/events')
    expect(all.code).toBe(200)
    expect((all.body as { events: unknown[] }).events.length).toBe(2)
    const filtered = server.call('GET', '/api/dsh-perm-gate/events?sessionId=s1&since=1')
    expect((filtered.body as { events: { id: number }[] }).events).toEqual([])
  })

  it('rejects non-GET methods', () => {
    const server = makeServer()
    registerEventsRoute(server, new EventLog(tmpFile('events.jsonl')))
    expect(server.call('POST', '/api/dsh-perm-gate/events').code).toBe(405)
  })

  it('returns false when the webServer service is unavailable', () => {
    expect(registerEventsRoute(undefined, new EventLog(undefined))).toBeUndefined()
    expect(registerEventsRoute({}, new EventLog(undefined))).toBeUndefined()
    expect(registerEventsRoute({ register: 'not-a-function' }, new EventLog(undefined))).toBeUndefined()
  })
})

describe('registerStreamRoute', () => {
  /** A webServer-like service whose response captures frames and lets the test close the socket. */
  function makeStreamServer() {
    let handler: ((req: unknown, res: unknown) => unknown) | undefined
    const frames: string[] = []
    const listeners = new Map<string, () => void>()
    return {
      register(route: { handler: (req: unknown, res: unknown) => unknown }): () => void {
        handler = route.handler
        return () => {}
      },
      open(url: string, method = 'GET', streaming = true): { code: number; headers?: Record<string, string> } {
        const out: { code: number; headers?: Record<string, string> } = { code: 0 }
        const res: Record<string, unknown> = {
          writeHead(code: number, headers?: Record<string, string>) { out.code = code; out.headers = headers },
          write(chunk: string) { frames.push(chunk) },
          end() {},
          on(event: string, cb: () => void) { listeners.set(event, cb) },
        }
        if (!streaming) delete res.write
        handler?.({ method, url }, res)
        return out
      },
      emit(event: string): void { listeners.get(event)?.() },
      frames,
    }
  }

  /** The `data:` frames of a stream, parsed. */
  function datas(frames: string[]): { events: { id: number; reason: string }[]; backlog?: boolean }[] {
    return frames
      .filter((frame) => frame.startsWith('data: '))
      .map((frame) => JSON.parse(frame.slice('data: '.length)) as { events: { id: number; reason: string }[]; backlog?: boolean })
  }

  it('writes the backlog as one marked frame, then pushes each appended event unmarked', () => {
    const log = new EventLog(tmpFile('events.jsonl'))
    log.append({ tool: 'bash', kind: 'ask', reason: 'history', sessionId: 's1' })
    const server = makeStreamServer()
    expect(typeof registerStreamRoute(server, log)).toBe('function')
    const head = server.open('/api/dsh-perm-gate/stream?sessionId=s1&since=0')
    expect(head.code).toBe(200)
    expect(head.headers?.['content-type']).toContain('text/event-stream')

    const opened = datas(server.frames)
    expect(opened.length).toBe(1)
    expect(opened[0]?.backlog).toBe(true)
    expect(opened[0]?.events.map((ev) => ev.reason)).toEqual(['history'])

    // A decision taken while the stream is open is pushed, not replayed.
    log.append({ tool: 'bash', kind: 'deny', reason: 'live', sessionId: 's1' })
    const after = datas(server.frames)
    expect(after.length).toBe(2)
    expect(after[1]?.backlog).toBeUndefined()
    expect(after[1]?.events.map((ev) => ev.reason)).toEqual(['live'])
  })

  it('marks the backlog frame even when there is nothing to replay', () => {
    const server = makeStreamServer()
    registerStreamRoute(server, new EventLog(tmpFile('events.jsonl')))
    server.open('/api/dsh-perm-gate/stream?sessionId=none')
    const frames = datas(server.frames)
    expect(frames.length).toBe(1)
    expect(frames[0]?.backlog).toBe(true)
    expect(frames[0]?.events).toEqual([])
  })

  it('filters both the backlog and the live pushes to the requested session', () => {
    const log = new EventLog(tmpFile('events.jsonl'))
    log.append({ tool: 'bash', kind: 'ask', reason: 'a', sessionId: 's1' })
    log.append({ tool: 'bash', kind: 'ask', reason: 'b', sessionId: 's2' })
    const server = makeStreamServer()
    registerStreamRoute(server, log)
    server.open('/api/dsh-perm-gate/stream?sessionId=s1&since=0')
    expect(datas(server.frames)[0]?.events.map((ev) => ev.reason)).toEqual(['a'])

    log.append({ tool: 'bash', kind: 'ask', reason: 'other-session', sessionId: 's2' })
    expect(datas(server.frames).length).toBe(1)
    log.append({ tool: 'bash', kind: 'ask', reason: 'same-session', sessionId: 's1' })
    expect(datas(server.frames)[1]?.events.map((ev) => ev.reason)).toEqual(['same-session'])
  })

  it('drops the subscription when the connection closes', () => {
    const log = new EventLog(tmpFile('events.jsonl'))
    const server = makeStreamServer()
    registerStreamRoute(server, log)
    server.open('/api/dsh-perm-gate/stream?sessionId=s1&since=0')
    const before = datas(server.frames).length
    server.emit('close')
    log.append({ tool: 'bash', kind: 'ask', reason: 'after-close', sessionId: 's1' })
    expect(datas(server.frames).length).toBe(before)
  })

  it('rejects non-GET methods, a non-streaming server, and a missing webServer', () => {
    const server = makeStreamServer()
    registerStreamRoute(server, new EventLog(tmpFile('events.jsonl')))
    expect(server.open('/api/dsh-perm-gate/stream', 'POST').code).toBe(405)
    expect(server.open('/api/dsh-perm-gate/stream', 'GET', false).code).toBe(500)
    expect(registerStreamRoute(undefined, new EventLog(undefined))).toBeUndefined()
    expect(registerStreamRoute({}, new EventLog(undefined))).toBeUndefined()
    expect(registerStreamRoute({ register: 'not-a-function' }, new EventLog(undefined))).toBeUndefined()
  })
})
