/**
 * Redaction primitives for dsh-perm-gate.
 *
 * Before this module existed, the grader payload (`risk.ts riskUserText`)
 * serialized the *whole* `args` object — including file bodies and inline
 * credentials — and POSTed it to a user-configured third-party endpoint, while
 * `classifier.ts` claimed secrets had already been stripped upstream. They had
 * not. This module is the single place that makes that claim true.
 *
 * Three properties are load-bearing, and each has a test:
 *
 * 1. **Judgment-preserving.** Only secret *values* are masked; verbs, path
 *    segments, flags and remote hosts survive, because the deterministic layers
 *    (deny-keywords, `isCleanupSafe`, the parsers) and the reversibility tier
 *    all read those. A redaction that hides `rm -rf /` would be a security
 *    regression, so `adv_040/043/046/047` must still read as credential/remote.
 * 2. **Idempotent.** Every replacement is a `[redacted:<kind>:<len>]` marker
 *    that the patterns themselves refuse to re-match. Without this, piping an
 *    already-redacted value through a second layer (grader payload + event
 *    digest) silently rewrites lengths and breaks fingerprint stability.
 * 3. **Bounded.** Long bodies collapse to a byte count plus a cheap hash, so
 *    redaction also caps prompt size — grading latency is prefill-dominated.
 *
 * The hash here is FNV-1a, deliberately **not** a cryptographic digest: it only
 * needs to identify "the same big body" across events. Security-sensitive
 * digests (event `inputDigest`) use sha256 on the node half.
 */

/** Marker prefix; a value that already starts with it is left untouched. */
const MARK_PREFIX = '[redacted:'

/**
 * One marker, as `[redacted:<len>:<kind>]`.
 *
 * Length comes BEFORE the kind name on purpose: a marker written as
 * `[redacted:token:24]` contains the literal `token:` + payload, which the
 * generic key=value rule happily matches again on the second pass - breaking
 * the idempotency this module promises. Putting the kind last (followed only by
 * `]`) means no rule can find a `key`+separator pair inside a marker.
 */
function mark(kind: string, len: number): string {
  return `${MARK_PREFIX}${len}:${kind}]`
}

/** Whether a captured payload is already one of our markers. */
function alreadyRedacted(payload: string): boolean {
  return payload.trimStart().startsWith(MARK_PREFIX)
}

/** Default ceiling for a redacted command string. */
export const DEFAULT_MAX_COMMAND_CHARS = 800

/** Default ceiling for a single argument string before it collapses to a hash. */
export const DEFAULT_MAX_ARG_CHARS = 200

/** Options for {@link redactCommandText}. */
export interface RedactOptions {
  /** Hard ceiling on the returned string; overflow is cut with a `…[+N]` tail. */
  readonly maxChars?: number
}

interface Rule {
  readonly kind: string
  readonly re: RegExp
  /** Splits one match into [keep-before, secret, keep-after]; `g` is the capture groups. */
  readonly pick: (whole: string, g: readonly string[]) => { before: string; secret: string; after: string }
}

const rules: readonly Rule[] = [
  {
    // PEM / OpenSSH / PGP private key blocks: mask the whole blob.
    kind: 'pem',
    re: /-----BEGIN(?:\s+[A-Z0-9]+)*\s+PRIVATE KEY-----[\s\S]*?-----END(?:\s+[A-Z0-9]+)*\s+PRIVATE KEY-----/gi,
    pick: (m) => ({ before: '', secret: m, after: '' }),
  },
  {
    // Auth headers: keep the header name (a remote-write signal) + the scheme.
    kind: 'token',
    re: /\b(authorization|proxy-authorization|x-api-key|api-key|x-amz-security-token|x-goog-api-key|cookie)\b(\s*[:=]\s*)((?:(?:bearer|basic|token)\s+)?)([^\s"',;]+)/gi,
    pick: (_m, g) => ({ before: `${g[0]}${g[1]}${g[2]}`, secret: g[3] ?? '', after: '' }),
  },
  {
    // URL userinfo: keep scheme + user + host, mask only the password.
    kind: 'pw',
    re: /\b([a-z][a-z0-9+.-]*:\/\/)([^\s:/?#@]*):([^\s@/?#]+)@/gi,
    pick: (_m, g) => ({ before: `${g[0]}${g[1] ?? ''}:`, secret: g[2] ?? '', after: '@' }),
  },
  {
    // Generic key = value secrets, quoted or bare.
    kind: 'token',
    re: /\b(password|passwd|pwd|secret|secret[_-]?key|client[_-]?secret|api[_-]?key|apikey|access[_-]?token|access[_-]?key|refresh[_-]?token|security[_-]?token|id[_-]?token|private[_-]?token|token)(\s*[:=]\s*)(["']?)([^\s"',;)]+)(\3)?/gi,
    pick: (_m, g) => ({ before: `${g[0]}${g[1]}${g[2]}`, secret: g[3] ?? '', after: g[4] ?? '' }),
  },
  {
    // Bare scheme + credential as a standalone value (e.g. an `authorization`
    // object member whose value is `Bearer ...` - no header name in the string).
    kind: 'token',
    re: /\b(bearer|basic|token)\s+([A-Za-z0-9._~+/=-]{12,})/gi,
    pick: (_m, g) => ({ before: `${g[0]} `, secret: g[1] ?? '', after: '' }),
  },
  {
    // Provider-shaped tokens.
    kind: 'token',
    re: /\b(?:sk|ghp|gho|ghu|ghs|ghr|github_pat|xox[abprs]|glpat|dckr_pat|dpo_|sqat|ya29)\b[-_.][A-Za-z0-9_~-]{8,}|\bAKIA[0-9A-Z]{12,}|\bAIza[0-9A-Za-z_-]{20,}/g,
    pick: (m) => ({ before: '', secret: m, after: '' }),
  },
  {
    // Base64 / hex blobs: masked, but the *shape* (charset + length) is kept so
    // the grader still sees "an opaque encoded payload is being shipped here".
    kind: 'b64',
    re: /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{24,}={0,2}(?![A-Za-z0-9+/=])/g,
    pick: (m) => ({ before: '', secret: m, after: '' }),
  },
  {
    kind: 'hex',
    re: /(?<![0-9a-fA-F])[0-9a-fA-F]{32,}(?![0-9a-fA-F])/g,
    pick: (m) => ({ before: '', secret: m, after: '' }),
  },
]

/** Collapse to a bounded length, keeping a visible `…[+N]` tail. */
function clamp(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const kept = text.slice(0, maxChars)
  return `${kept}…[+${text.length - maxChars}]`
}

/**
 * Redact one command/text string, preserving the structure the deterministic
 * layers and the grader depend on. Idempotent by construction.
 */
export function redactCommandText(text: string, options: RedactOptions = {}): string {
  const maxChars = options.maxChars ?? DEFAULT_MAX_COMMAND_CHARS
  if (text === '') return text
  let out = text
  for (const rule of rules) {
    rule.re.lastIndex = 0
    out = out.replace(rule.re, (whole: string, ...rest: unknown[]) => {
      // `rest` is the capture groups, then offset and the source string.
      const groups = rest.slice(0, Math.max(0, rest.length - 2))
        .map((g) => (typeof g === 'string' ? g : ''))
      const { before, secret, after } = rule.pick(whole, groups)
      // Skip anything already carrying a marker, so re-passing is a no-op.
      if (whole.includes(MARK_PREFIX) || secret === '' || alreadyRedacted(secret)) return whole
      return `${before}${mark(rule.kind, secret.length)}${after}`
    })
  }
  return clamp(out, maxChars)
}

/** FNV-1a, 32-bit, hex. Identity only — never a security digest. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Collapse a long body to a marker that still identifies it. */
function collapseBody(text: string): string {
  return `${MARK_PREFIX}${text.length}B:text#${fnv1a(text)}]`
}

/** Options for {@link redactArgs}. */
export interface RedactArgsOptions {
  readonly maxStringChars?: number
  /** Cap on array length and object keys, so a huge payload cannot bloat the prompt. */
  readonly maxItems?: number
  readonly maxDepth?: number
}

function redactValue(value: unknown, opts: Required<RedactArgsOptions>, depth: number): unknown {
  const { maxStringChars, maxItems, maxDepth } = opts
  if (typeof value === 'string') {
    if (alreadyRedacted(value)) return value
    if (value.length > maxStringChars) return collapseBody(value)
    return redactCommandText(value, { maxChars: maxStringChars })
  }
  if (value === null || typeof value !== 'object') return value
  if (depth >= maxDepth) return mark('depth', Array.isArray(value) ? value.length : Object.keys(value).length)
  if (Array.isArray(value)) {
    const kept = value.slice(0, maxItems).map((v) => redactValue(v, opts, depth + 1))
    if (value.length > maxItems) kept.push(mark('more', value.length - maxItems))
    return kept
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, maxItems)) {
    out[k] = redactValue(v, opts, depth + 1)
  }
  return out
}

/**
 * Redact a tool-call argument bag for egress (grader payload, event digest,
 * approval card). Keys are preserved — several are authority-bearing (host,
 * path, command) — and values go through {@link redactCommandText}, with long
 * bodies collapsed to a byte count plus a cheap identity hash.
 */
export function redactArgs(args: unknown, options: RedactArgsOptions = {}): unknown {
  const opts: Required<RedactArgsOptions> = {
    maxStringChars: options.maxStringChars ?? DEFAULT_MAX_ARG_CHARS,
    maxItems: options.maxItems ?? 50,
    maxDepth: options.maxDepth ?? 6,
  }
  return redactValue(args, opts, 0)
}
