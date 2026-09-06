/**
 * Gate decision events for dsh-perm-gate: a JSONL audit feed the browser half
 * polls so every automatic allow / ask / deny is visible in the conversation UI.
 *
 * Pure append-only logging: every I/O error is swallowed (events are best-effort
 * and must never influence gating), and the id sequence resumes from the file on
 * first use so restarts never reuse an id the client has already seen.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** One gate decision event. `kind` drives the client notice strip styling. */
export interface GateEvent {
  /** Monotonic id (resumed from the file across restarts). */
  readonly id: number
  readonly ts: string
  readonly sessionId: string
  readonly tool: string
  /** auto = allowed (rule/grant/llm), ask = routed to the human, deny = vetoed, learned = confirmation settled. */
  readonly kind: 'auto' | 'ask' | 'deny' | 'learned'
  /** Risk category when an LLM verdict contributed to the decision. */
  readonly risk?: string
  /** Truncated decision reason. */
  readonly reason: string
}

export interface GateEventInput {
  readonly sessionId?: string
  readonly tool: string
  readonly kind: GateEvent['kind']
  readonly risk?: string
  readonly reason: string
}

const REASON_MAX = 200

export class EventLog {
  private seq = -1 // lazily restored from the file on first append

  constructor(
    /** JSONL path; `undefined` disables event recording entirely. */
    private readonly filePath: string | undefined,
    private readonly now: () => number = Date.now,
  ) {}

  /** Append one event; returns it, or undefined when recording is disabled/failed. */
  append(input: GateEventInput): GateEvent | undefined {
    if (this.filePath === undefined) return undefined
    try {
      const id = this.nextId()
      const ev: GateEvent = {
        id,
        ts: new Date(this.now()).toISOString(),
        sessionId: input.sessionId ?? '',
        tool: input.tool,
        kind: input.kind,
        ...(input.risk === undefined ? {} : { risk: input.risk }),
        reason: String(input.reason).slice(0, REASON_MAX),
      }
      mkdirSync(dirname(this.filePath), { recursive: true })
      appendFileSync(this.filePath, JSON.stringify(ev) + '\n', 'utf8')
      return ev
    } catch {
      return undefined // best-effort only
    }
  }

  /** Events with `id > since`, optionally filtered to one session. */
  query({ sessionId, since }: { sessionId?: string; since?: number } = {}): GateEvent[] {
    if (this.filePath === undefined) return []
    let text: string
    try {
      text = readFileSync(this.filePath, 'utf8')
    } catch {
      return [] // no events yet
    }
    const out: GateEvent[] = []
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      try {
        const ev = JSON.parse(line) as GateEvent
        if (typeof ev.id !== 'number') continue
        if (since !== undefined && ev.id <= since) continue
        if (sessionId !== undefined && sessionId !== '' && ev.sessionId !== sessionId) continue
        out.push(ev)
      } catch {
        // corrupted line: skip
      }
    }
    return out
  }

  private nextId(): number {
    if (this.seq < 0) {
      this.seq = 0
      for (const ev of this.query()) {
        if (ev.id > this.seq) this.seq = ev.id
      }
    }
    this.seq += 1
    return this.seq
  }
}

/**
 * The minimal face of the DSH `webServer` service this plugin uses
 * (typed locally — never value-imported; provided by the dsh runtime).
 */
export interface WebServerLike {
  register(route: { kind: 'exact'; path: string; handler: (req: unknown, res: unknown) => unknown }): () => void
}

export const EVENTS_ROUTE = '/api/dsh-perm-gate/events'

/**
 * Register `GET /api/dsh-perm-gate/events?sessionId=&since=` on the webServer
 * service. Returns whether the route was registered (false when the service is
 * unavailable — the host keeps running, only the HTTP API is missing).
 */
export function registerEventsRoute(server: unknown, log: EventLog): boolean {
  if (typeof server !== 'object' || server === null) return false
  const candidate = server as { register?: WebServerLike['register'] }
  if (typeof candidate.register !== 'function') return false
  candidate.register({
    kind: 'exact',
    path: EVENTS_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as { method?: string; url?: string }
      const res = rawRes as { writeHead: (code: number, headers?: Record<string, string>) => unknown; end: (body?: string) => unknown }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      let sessionId: string | undefined
      let since: number | undefined
      try {
        const url = new URL(req.url ?? '/', 'http://localhost')
        sessionId = url.searchParams.get('sessionId') ?? undefined
        const raw = url.searchParams.get('since')
        if (raw !== null && raw !== '') since = Number.parseInt(raw, 10) || 0
      } catch {
        // unparseable URL: answer with the unfiltered tail
      }
      const events = log.query({ sessionId, since })
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
      res.end(JSON.stringify({ events }))
    },
  })
  return true
}

export const LEARNING_ROUTE = '/api/dsh-perm-gate/learning'

export const HEALTH_ROUTE = '/api/dsh-perm-gate/health'

/**
 * Register `POST /api/dsh-perm-gate/health` — runs one minimal completion
 * through the currently configured llmAssist receiver and returns
 * `{ ok, ms, detail }` (the settings card's health test).
 */
export function registerHealthRoute(server: unknown, provider: { check(): Promise<{ ok: boolean; ms: number; detail: string }> }): boolean {
  if (typeof server !== 'object' || server === null) return false
  const candidate = server as { register?: WebServerLike['register'] }
  if (typeof candidate.register !== 'function') return false
  candidate.register({
    kind: 'exact',
    path: HEALTH_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as { method?: string }
      const res = rawRes as { writeHead: (code: number, headers?: Record<string, string>) => unknown; end: (body?: string) => unknown }
      const json = (code: number, body: unknown): void => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
        res.end(JSON.stringify(body))
      }
      if (req.method !== 'POST') {
        json(405, { ok: false, error: 'method not allowed' })
        return
      }
      provider.check().then(
        (result) => json(200, { ...result, ok: true }),
        (e: unknown) => json(500, { ok: false, error: String((e as Error)?.message ?? e) }),
      )
    },
  })
  return true
}

/** The learning-store face the settings UI's sediment view needs. */
export interface LearningRouteProvider {
  snapshot(): unknown
  threshold(): number
  reset(key: string, fp?: string): void
}

/**
 * Register the learning-store routes on the webServer service:
 * `GET  /api/dsh-perm-gate/learning` → the store snapshot + live threshold,
 * `POST /api/dsh-perm-gate/learning` → `{ key, fp? }` terminates one key's
 * learning or drops one sedimented sample. Returns whether registered.
 */
export function registerLearningRoute(server: unknown, provider: LearningRouteProvider): boolean {
  if (typeof server !== 'object' || server === null) return false
  const candidate = server as { register?: WebServerLike['register'] }
  if (typeof candidate.register !== 'function') return false
  candidate.register({
    kind: 'exact',
    path: LEARNING_ROUTE,
    handler: (rawReq, rawRes) => {
      const req = rawReq as { method?: string; url?: string; on?: (event: string, cb: (chunk?: unknown) => void) => unknown }
      const res = rawRes as { writeHead: (code: number, headers?: Record<string, string>) => unknown; end: (body?: string) => unknown }
      const json = (code: number, body: unknown): void => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
        res.end(JSON.stringify(body))
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        json(200, { ok: true, threshold: provider.threshold(), ...(provider.snapshot() as object) })
        return
      }
      if (req.method !== 'POST') {
        json(405, { ok: false, error: 'method not allowed' })
        return
      }
      let body = ''
      req.on?.('data', (chunk) => { body += String(chunk) })
      req.on?.('end', () => {
        try {
          const parsed = JSON.parse(body === '' ? '{}' : body) as { key?: unknown; fp?: unknown }
          if (typeof parsed.key !== 'string' || parsed.key === '') {
            json(400, { ok: false, error: 'missing key' })
            return
          }
          provider.reset(parsed.key, typeof parsed.fp === 'string' && parsed.fp !== '' ? parsed.fp : undefined)
          json(200, { ok: true })
        } catch (e) {
          json(400, { ok: false, error: String((e as Error)?.message ?? e) })
        }
      })
    },
  })
  return true
}
