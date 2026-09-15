/**
 * The built-in local HTTP/CONNECT proxy for dsh-perm-gate.
 *
 * The process-level network gate for shell subprocess traffic. Bash/pwsh
 * children inherit `HTTP(S)_PROXY`/`ALL_PROXY` environment variables
 * pointing here, and the proxy adjudicates EVERY connection target against
 * the loaded network rules and the active policy mode.
 *
 * Boundaries:
 * - DSH's `ctx.sandbox` enforces file effects only; network interception
 *   is entirely this plugin's job.
 * - The proxy has no session context, so `ask` decisions degrade to
 *   block + audit (web tools get the real approval seam at pre-execute).
 * - Bind failures degrade gracefully: warn + continue without proxy.
 */
import { createServer, request as httpRequest, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { connect } from 'node:net'
import { lookup } from 'node:dns/promises'
import type { AddressInfo } from 'node:net'
import type { Duplex } from 'node:stream'
import type { NetworkDecision, NetworkMode, NetworkTarget } from './network.js'
import { blockMessage, isIpLiteral } from './network.js'

// ─── Constants ─────────────────────────────────────────────────────────────

/** Proxy env var names the injector sets/restores (upper + lower for mixed-ecosystem CLIs). */
export const PROXY_ENV_NAMES: readonly string[] = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']

/** NO_PROXY env var names cleared by the injector. */
export const NO_PROXY_ENV_NAMES: readonly string[] = ['NO_PROXY', 'no_proxy']

// ─── Types ─────────────────────────────────────────────────────────────────

/** One recorded proxy-layer block. */
export interface NetworkBlockRecord {
  readonly time: number
  readonly tool: string
  readonly attributed: boolean
  readonly callId?: string
  readonly domain: string
  readonly scheme?: string
  readonly port?: number
  readonly action: 'deny' | 'ask'
  readonly mode: NetworkMode
  readonly matched: boolean
  readonly source: string
  readonly ruleIndex?: number
  readonly reason?: string
}

/** Cumulative proxy-layer block counters. */
export interface NetworkStats {
  denied: number
  askBlocked: number
}

/** Attribution the runtime supplies for one connection. */
export interface ProxyAttribution {
  readonly tool: string
  readonly callId?: string
}

/** Construction options for NetworkProxy. */
export interface NetworkProxyOptions {
  /** Bind address (loopback by config). */
  readonly bind: string
  /** Requested port; `0` binds an ephemeral port. */
  readonly port: number
  /** Cap on recent-block records kept in memory. */
  readonly maxRecent: number
  /** Decision function supplied by the runtime. */
  readonly decide: (target: NetworkTarget) => NetworkDecision
  /** Current attribution (newest in-flight shell execution). */
  readonly attribution?: () => ProxyAttribution | undefined
  /** Called for every blocked connection. */
  readonly onBlock?: (record: NetworkBlockRecord, attribution: ProxyAttribution | undefined) => void
  /** Logger sink (proxy failures must never crash the host). */
  readonly logger: { warn(message: string): void }
}

// ─── NetworkProxy ──────────────────────────────────────────────────────────

/**
 * The local HTTP/CONNECT policy proxy. Binds on demand; every live tunnel
 * socket is tracked and destroyed on close so updates and uninstalls leave
 * no orphaned connections.
 */
export class NetworkProxy {
  private server: Server | undefined
  private readonly sockets = new Set<Duplex>()
  private readonly recent: NetworkBlockRecord[] = []
  private readonly stats: NetworkStats = { denied: 0, askBlocked: 0 }
  private actualPort = 0

  constructor(private readonly options: NetworkProxyOptions) {}

  /** The bound port (valid after start resolves). */
  get port(): number {
    return this.actualPort
  }

  /** Deny/ask blocks recorded since mount, newest first. */
  recentBlocks(): readonly NetworkBlockRecord[] {
    return this.recent
  }

  /** Cumulative block counters. */
  blockStats(): NetworkStats {
    return { ...this.stats }
  }

  /** Number of active sockets (tunnels + client connections). */
  activeSocketCount(): number {
    return this.sockets.size
  }

  /**
   * Bind the server and return the actual port.
   * On bind failure: warns and returns -1 (degraded mode — no proxy).
   */
  async start(): Promise<number> {
    const server = createServer((req, res) => {
      void this.handleRequest(req, res)
    })
    server.on('connect', (req, socket, head) => {
      void this.handleConnect(req, socket, head)
    })
    server.on('error', (error: unknown) => {
      this.options.logger.warn(`[dsh-perm-gate] proxy server error: ${String(error)}`)
    })
    // T2.9 safety: catch client socket errors that slip through individual
    // request handlers (ECONNRESET after 403, etc.) — never crash the host.
    server.on('clientError', (err: Error, socket: Duplex) => {
      if (err && (err as NodeJS.ErrnoException).code !== 'ECONNRESET' && err.message !== 'socket hang up') {
        this.options.logger.warn(`[dsh-perm-gate] proxy clientError: ${String(err)}`)
      }
      if (!socket.destroyed) socket.destroy()
    })
    this.server = server
    try {
      const port = await new Promise<number>((resolve, reject) => {
        const onError = (error: Error): void => {
          server.off('listening', onListening)
          reject(error)
        }
        const onListening = (): void => {
          server.off('error', onError)
          const address = server.address() as AddressInfo
          resolve(address.port)
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(this.options.port, this.options.bind)
      })
      this.actualPort = port
      return port
    } catch (error) {
      // T2.9: Bind failure degradation — warn + continue without proxy.
      this.options.logger.warn(`[dsh-perm-gate] proxy bind failed (port ${this.options.port}): ${String(error)} — continuing without network proxy`)
      this.server = undefined
      this.actualPort = -1
      return -1
    }
  }

  /** Stop the server and destroy every tunnel socket. */
  async close(): Promise<void> {
    const server = this.server
    this.server = undefined
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    this.actualPort = 0
    if (server === undefined) return
    return new Promise((resolve) => {
      server.close(() => resolve())
    })
  }

  // ─── HTTP proxy ──────────────────────────────────────────────────────

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const target = parseUrlTarget(req.url ?? '')
    if (target === undefined || target.scheme === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('[dsh-perm-gate] proxy: only absolute-form proxy requests are served\n')
      return
    }
    await this.forwardOrBlock(res, target, () => {
      const upstream = new URL(req.url as string)
      const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest
      const proxyReq = send(upstream.href, { method: req.method, headers: req.headers }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
        proxyRes.pipe(res)
      })
      proxyReq.on('error', (error: unknown) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'content-type': 'text/plain' })
          res.end(`[network: upstream error] ${String(error)}\n`)
        } else {
          res.destroy()
        }
      })
      // Suppress ECONNRESET from client closing after receiving 403/502.
      req.on('error', (err: Error) => {
        if (err && (err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
          this.options.logger.warn(`[dsh-perm-gate] proxy req error: ${String(err)}`)
        }
      })
      req.pipe(proxyReq)
    })
  }

  // ─── CONNECT tunnel ──────────────────────────────────────────────────

  private async handleConnect(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    // T2.8/T2.9 safety: attach error handler IMMEDIATELY to prevent unhandled
    // errors from crashing the host process. Client may RST at any point
    // (e.g. after receiving a 403 block), and upstream may fail to connect.
    let upstream: ReturnType<typeof connect> | undefined
    const suppressError = (err: Error): void => {
      // Suppress ECONNRESET / EPIPE after a 403 block — expected behavior.
      // Only log unexpected errors.
      if (err && (err as NodeJS.ErrnoException).code !== 'ECONNRESET' && err.message !== 'socket hang up') {
        this.options.logger.warn(`[dsh-perm-gate] proxy connect error: ${String(err)}`)
      }
    }
    socket.on('error', (err: Error) => {
      suppressError(err)
      if (upstream !== undefined) upstream.destroy()
    })

    const target = connectTarget(req.url ?? '')
    if (target === undefined) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      return
    }
    const decision = await this.decideWithResolution(target)
    if (decision.action !== 'allow') {
      this.recordBlock(decision, target)
      const body = blockMessage(decision)
      socket.end(`HTTP/1.1 403 Forbidden\r\ncontent-type: text/plain\r\ncontent-length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
      return
    }
    upstream = connect(target.port ?? 443, target.host)
    this.sockets.add(socket)
    this.sockets.add(upstream)
    const cleanup = (): void => {
      this.sockets.delete(socket)
      this.sockets.delete(upstream!)
    }
    socket.on('close', cleanup)
    upstream.on('close', cleanup)
    upstream.on('error', (err: Error) => {
      suppressError(err)
      socket.destroy()
    })
    upstream.once('connect', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length > 0) upstream!.write(head)
      upstream!.pipe(socket)
      socket.pipe(upstream!)
    })
  }

  // ─── Decision pipeline ───────────────────────────────────────────────

  private async forwardOrBlock(res: ServerResponse, target: NetworkTarget, forward: () => void): Promise<void> {
    const decision = await this.decideWithResolution(target)
    if (decision.action !== 'allow') {
      this.recordBlock(decision, target)
      const body = blockMessage(decision)
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(body) })
      res.end(body)
      return
    }
    forward()
  }

  /**
   * DNS-resolve a hostname so `ips`-scoped rules see real addresses,
   * then decide. Resolution failure → decide on literal name.
   */
  private async decideWithResolution(target: NetworkTarget): Promise<NetworkDecision> {
    if (!isIpLiteral(target.host)) {
      try {
        const addresses = await lookup(target.host, { all: true, verbatim: true })
        const resolved = addresses.map((entry) => entry.address)
        if (resolved.length > 0) {
          return this.options.decide({ ...target, ips: [...target.ips, ...resolved] })
        }
      } catch {
        // Unresolvable: decide on literal name (ip-scoped rules cannot fire).
      }
    }
    return this.options.decide(target)
  }

  // ─── Block recording ─────────────────────────────────────────────────

  private recordBlock(decision: NetworkDecision, target: NetworkTarget): void {
    const attribution = this.options.attribution?.()
    const record: NetworkBlockRecord = {
      time: Date.now(),
      tool: attribution?.tool ?? 'subprocess',
      attributed: attribution !== undefined,
      ...(attribution?.callId !== undefined ? { callId: attribution.callId } : {}),
      domain: target.host,
      ...(target.scheme !== undefined ? { scheme: target.scheme } : {}),
      ...(target.port !== undefined ? { port: target.port } : {}),
      action: decision.action === 'ask' ? 'ask' : 'deny',
      mode: decision.mode,
      matched: decision.matched,
      source: decision.source ?? '',
      ...(decision.ruleIndex !== undefined ? { ruleIndex: decision.ruleIndex } : {}),
      ...(decision.rule !== undefined ? { reason: decision.rule.reason } : {}),
    }
    if (record.action === 'deny') this.stats.denied += 1
    else this.stats.askBlocked += 1
    this.recent.unshift(record)
    if (this.recent.length > this.options.maxRecent) this.recent.length = this.options.maxRecent
    this.options.logger.warn(`[dsh-perm-gate] network ${record.action === 'deny' ? 'denied' : 'ask-blocked'} ${target.scheme ?? '?'}://${target.host}${target.port !== undefined ? `:${target.port}` : ''} (mode ${decision.mode}${decision.matched ? `, rule ${(decision.ruleIndex ?? 0) + 1}` : ', mode default'})`)
    try {
      this.options.onBlock?.(record, attribution)
    } catch (error: unknown) {
      this.options.logger.warn(`[dsh-perm-gate] network block hook failed: ${String(error)}`)
    }
  }
}

// ─── Environment injection ─────────────────────────────────────────────────

/**
 * Inject proxy environment variables for subprocesses and return a disposer
 * restoring every previous value exactly.
 *
 * The snapshot pass covers EVERY name BEFORE any write: on Windows
 * `process.env` is case-insensitive, so writing `HTTP_PROXY` mid-loop
 * would poison the later snapshot of `http_proxy`.
 *
 * @param port - the bound proxy port.
 * @param noProxy - `'clear'` empties NO_PROXY so policy cannot be bypassed;
 *                  `'preserve'` keeps ambient values.
 * @returns the restore disposer.
 */
export function injectProxyEnv(port: number, noProxy: 'clear' | 'preserve'): () => void {
  const previous = new Map<string, string | undefined>()
  const value = `http://127.0.0.1:${port}`
  // Snapshot ALL names before any write.
  for (const name of PROXY_ENV_NAMES) previous.set(name, process.env[name])
  if (noProxy === 'clear') {
    for (const name of NO_PROXY_ENV_NAMES) previous.set(name, process.env[name])
  }
  // Write proxy env.
  for (const name of PROXY_ENV_NAMES) process.env[name] = value
  if (noProxy === 'clear') {
    for (const name of NO_PROXY_ENV_NAMES) process.env[name] = ''
  }
  // Return restore disposer.
  return () => {
    for (const name of PROXY_ENV_NAMES) {
      const old = previous.get(name)
      if (old === undefined) delete process.env[name]
      else process.env[name] = old
    }
    if (noProxy === 'clear') {
      for (const name of NO_PROXY_ENV_NAMES) {
        const old = previous.get(name)
        if (old === undefined) delete process.env[name]
        else process.env[name] = old
      }
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse a CONNECT authority (`host:port`) into an https target. */
function connectTarget(authority: string): NetworkTarget | undefined {
  const colon = authority.lastIndexOf(':')
  if (colon <= 0) return undefined
  const host = authority.slice(0, colon).replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, '')
  const port = Number(authority.slice(colon + 1))
  if (host.length === 0 || !Number.isInteger(port) || port < 1 || port > 65535) return undefined
  return { scheme: 'https', host, port, ips: isIpLiteral(host) ? [host] : [] }
}

/** Parse a URL string into a NetworkTarget. */
function parseUrlTarget(url: string): NetworkTarget | undefined {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/\.+$/, '')
    if (host.length === 0) return undefined
    const port = u.port !== '' ? Number(u.port) : (u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : undefined)
    return {
      host,
      port: port !== undefined && Number.isFinite(port) ? port : undefined,
      scheme: u.protocol.replace(/:$/, ''),
      ips: isIpLiteral(host) ? [host] : [],
    }
  } catch {
    return undefined
  }
}
