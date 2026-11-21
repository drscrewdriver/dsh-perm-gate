/**
 * Pre-execution network-target extraction for the rule layer's `network` dimension.
 *
 * The proxy layer (`network.ts`) sees real connections from attributed shell
 * subprocesses; the rule layer sees only the tool call's own arguments. This module
 * bridges the two: it harvests URL / IP-literal / hostname candidates with the same
 * key lists and URL regex the args dimension uses (`rule.ts`), so a preset row with
 * a `network:` dimension can fire BEFORE a shell command runs — the pre-execution
 * half of the cloud-metadata guard (the proxy half needs no extractor).
 *
 * Extraction is deliberately generous and rule-agnostic: it fills candidates, and a
 * rule only fires when its own `network` sub-dimensions match one of them (an ips
 * list, domain globs, ports, schemes). Garbage candidates can never match a precise
 * row — the row's own list is the gate. Pure — no I/O, no execution.
 */
import { isIpLiteral, parseUrlTarget } from './network.js'

/** One extracted network candidate, shaped for `matchNetwork` in evaluate.ts. */
export interface NetworkTargetLite {
  readonly domain?: string
  readonly ip?: string
  readonly port?: number
  readonly scheme?: string
}

/** The url-ish argument keys, mirroring `rule.ts` URL_CANDIDATE_KEYS. */
const URL_KEYS: readonly string[] = ['url', 'urls', 'uri', 'endpoint', 'remote', 'repo', 'repository']

/** The command-ish argument keys, mirroring `rule.ts` COMMAND_CANDIDATE_KEYS. */
const COMMAND_KEYS: readonly string[] = ['command', 'cmd', 'script', 'command_line', 'commandLine']

/**
 * The URL shape scanned from free text. Unlike `rule.ts`'s args-dimension regex
 * this one keeps `]` inside the match — a bracketed IPv6 host (`http://[fd00:ec2::254]/`)
 * would otherwise be truncated mid-bracket and unparsable.
 */
const URL_RE = /https?:\/\/[^\s"'<>)(\\]+/g

/** Bare IPv4 dotted quad (octet sanity is irrelevant — the rule's ips list gates). */
const IPV4_RE = /(?:\d{1,3}\.){3}\d{1,3}/g

/**
 * Bracketed IPv6 (`[fd00:ec2::254]`) — the URL parser's canonical form for a
 * literal IPv6 host. Unbracketed IPv6 from free text goes through the token walk
 * below with a stricter shape gate instead.
 */
const BRACKETED_V6_RE = /\[[0-9a-fA-F:.]+:[0-9a-fA-F:.]+\]/g

/**
 * Hostname-ish token: dotted with an alphabetic TLD. Broad by design — `app.ts`
 * becomes a candidate and that is fine, because a rule only fires when its own
 * domains globs match the candidate.
 */
const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

/**
 * A bare unbracketed IPv6 token must look unlike a timestamp or a port list:
 * `12:30:45` (all-numeric, no empty group) is a wall clock; `fd00:ec2::254`
 * carries a hex letter or an empty (`::`) group. This gate exists to keep
 * candidate lists readable — a metadata row could never match a timestamp
 * either way.
 */
function isPlausibleBareIpv6(token: string): boolean {
  if (!/^[0-9a-fA-F:]+$/.test(token) || !token.includes(':')) return false
  const groups = token.split(':')
  return groups.length >= 3 && (groups.some((g) => g === '') || groups.some((g) => /[a-f]/i.test(g)))
}

/** Hard cap so a pathological command cannot balloon the candidate list. */
const MAX_TARGETS = 16

/** Tokens long beyond any hostname/IP shape are skipped outright. */
const MAX_TOKEN_LENGTH = 253

/**
 * Candidates dedupe by HOST: a bare `nc 169.254.169.254` harvest and a parsed
 * `http://169.254.169.254/` URL are the same target, and the richer shape (port,
 * scheme) wins so a rule with port/scheme sub-dimensions sees the full form.
 */
function hostKeyOf(t: NetworkTargetLite): string {
  return t.domain ?? t.ip ?? ''
}

function richnessOf(t: NetworkTargetLite): number {
  return (t.port !== undefined ? 2 : 0) + (t.scheme !== undefined ? 1 : 0)
}

function pushTarget(out: Map<string, NetworkTargetLite>, target: NetworkTargetLite | undefined): void {
  if (target === undefined) return
  const key = hostKeyOf(target)
  const existing = out.get(key)
  if (existing === undefined) {
    if (out.size < MAX_TARGETS) out.set(key, target)
    return
  }
  if (richnessOf(target) > richnessOf(existing)) out.set(key, target)
}

/** A URL string → target; the host becomes `ip` for literals, `domain` otherwise. */
function targetFromUrl(raw: string): NetworkTargetLite | undefined {
  const parsed = parseUrlTarget(raw.trim())
  if (parsed === undefined) return undefined
  // WHATWG URL keeps brackets on an IPv6 hostname (`[fd00:ec2::254]`) — strip
  // them so the literal is recognized and dedupes against the bare form.
  const host = parsed.host.replace(/^\[|\]$/g, '')
  return isIpLiteral(host)
    ? { ip: host, port: parsed.port, scheme: parsed.scheme }
    : { domain: host, port: parsed.port, scheme: parsed.scheme }
}

/** A bare host token → target (no scheme/port known). */
function targetFromHost(host: string): NetworkTargetLite | undefined {
  const h = host.toLowerCase()
  if (h.length === 0 || h.length > MAX_TOKEN_LENGTH) return undefined
  if (isIpLiteral(h)) {
    // `isIpLiteral` also accepts `12:30:45`; only real IPv4 shapes and
    // plausible IPv6 shapes deserve a candidate slot.
    if (h.includes('.') || isPlausibleBareIpv6(h)) return { ip: h }
    return undefined
  }
  return HOSTNAME_RE.test(h) ? { domain: h } : undefined
}

function collectTextTargets(text: string, out: Map<string, NetworkTargetLite>): void {
  for (const m of text.matchAll(URL_RE)) pushTarget(out, targetFromUrl(m[0]))
  for (const m of text.matchAll(IPV4_RE)) pushTarget(out, targetFromHost(m[0]))
  for (const m of text.matchAll(BRACKETED_V6_RE)) pushTarget(out, targetFromHost(m[0].slice(1, -1)))
  // Bare tokens: netcat-style raw-socket calls name their target without a
  // scheme (`nc metadata.goog 80`, `nc fd00:ec2::254 80`). A token that still
  // carries a scheme prefix (`urlopen('http://fd00:ec2::254/…')` inside a
  // quoted interpreter argument — the URL parser rejects an unbracketed IPv6
  // host) is cut down to its authority segment first.
  for (const tok of text.split(/[\s"'`<>()\\;,|&]+/)) {
    if (tok.length === 0) continue
    let candidate = tok
    const schemeIdx = candidate.indexOf('://')
    if (schemeIdx >= 0) {
      candidate = candidate.slice(schemeIdx + 3)
      const slash = candidate.indexOf('/')
      if (slash >= 0) candidate = candidate.slice(0, slash)
    }
    pushTarget(out, targetFromHost(candidate))
  }
}

/**
 * Harvest network targets from a call's command text and arguments. The depth walk
 * mirrors `extractUrlCandidates`; a url-key value without a scheme falls back to
 * bare-host parsing (`{url: "169.254.169.254"}` from a raw-socket tool call).
 */
export function extractNetworkTargets(
  commandText: string | undefined,
  args: Record<string, unknown> | undefined,
): NetworkTargetLite[] {
  const out = new Map<string, NetworkTargetLite>()
  if (typeof commandText === 'string' && commandText.length > 0) collectTextTargets(commandText, out)
  if (args !== undefined && typeof args === 'object') {
    const walk = (node: unknown, depth: number): void => {
      if (depth > 8) return
      if (Array.isArray(node)) {
        for (const e of node) walk(e, depth + 1)
        return
      }
      if (node === null || typeof node !== 'object') return
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (URL_KEYS.includes(k)) {
          const values =
            typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : []
          for (const raw of values) pushTarget(out, targetFromUrl(raw) ?? targetFromHost(raw.trim()))
        }
        if (COMMAND_KEYS.includes(k) && typeof v === 'string') collectTextTargets(v, out)
        walk(v, depth + 1)
      }
    }
    walk(args, 0)
  }
  return [...out.values()]
}
