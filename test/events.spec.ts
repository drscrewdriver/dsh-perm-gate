import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EventLog, registerEventsRoute } from '../src/events.js'

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
    expect(registerEventsRoute(server, log)).toBe(true)
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
    expect(registerEventsRoute(undefined, new EventLog(undefined))).toBe(false)
    expect(registerEventsRoute({}, new EventLog(undefined))).toBe(false)
    expect(registerEventsRoute({ register: 'not-a-function' }, new EventLog(undefined))).toBe(false)
  })
})
