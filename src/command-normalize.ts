/**
 * Command normalization — decode the layers a call hides behind, as a scan signal.
 *
 * Why this exists: every deterministic layer reads the command *as written*.
 * `deny-defaults` is a word list, the parsers switch on `baseName`, and
 * `isCleanupSafe` matches path segments. All three are blind to
 * `powershell -EncodedCommand UgBlAG0A...`, to `R="-rf"; rm $R /`, and to a
 * function wrapper around a wipe. Measured on the eval set, the encoded cases are
 * exactly where a graded model ships an unrecoverable act past the gate
 * (`adv_013` decodes to `Remove-Item -Recurse -Force C:\`, `adv_032` to
 * `DROP DATABASE orders_prod`).
 *
 * Two rules keep this from becoming its own vulnerability:
 *
 * 1. **Additive only.** The caller feeds these strings to *stricter* scans
 *    (deny-keyword, P0 wipe detection, tier grading). Nothing here can widen a
 *    decision, and no result is written back to `exec.arguments` or the event
 *    log, so fingerprints, grants and audit text stay about the call as received.
 * 2. **Bounded.** Length caps, depth cap, variant cap and a printable-ratio gate,
 *    because decoding is attacker-controlled input on the decision path. Oversized
 *    or undecodable input yields nothing, which leaves the call
 *    `targetResolvable=false` — opaque, never optimistically safe.
 *
 * On the plugin's own `--exec-b64` launcher wrapper: it is decoded like anything
 * else rather than exempted. An exemption would hand the agent a disguise
 * (`ac-launcher --config x --exec-b64 <rm -rf ...>`), while decoding it can only
 * ever escalate — so the cost is at most a second confirmation, never a block
 * that could not have been reached honestly.
 */

/** Where a decoded string came from, and whether the original runs it as code. */
export interface NormalizedText {
  readonly text: string
  readonly via: 'base64' | 'hex' | 'varsub'
  /**
   * True when the payload is handed to an execution primitive
   * (`-EncodedCommand`, `FromBase64String`, `Invoke-Expression`, `eval`,
   * `bash -c`, `xxd -r -p` …), i.e. it will really run. Only these variants may
   * feed P0 hard-deny; a stray base64 blob in a comment must not.
   */
  readonly executed: boolean
}

export interface NormalizeOptions {
  /** Refuse to touch a command longer than this (DoS + false-positive guard). */
  readonly maxInputChars?: number
  /** How many decode layers to peel. */
  readonly maxDepth?: number
  /** Shortest base64 blob considered (below this, too noisy). */
  readonly minBlobChars?: number
  /** Longest decoded output kept. */
  readonly maxOutputChars?: number
  /** Hard cap on returned variants. */
  readonly maxVariants?: number
  /**
   * Wall-clock budget for the whole peel. On expiry **all** partial work is
   * dropped, not just the remaining layers: a decoded fragment found late could
   * turn into a P0 deny, and the guardrail this plugin cannot trade away is that
   * the normalizer never decides — an expired peel leaves the call opaque, so the
   * decision falls back to the ask it was already heading for.
   */
  readonly maxMs?: number
  /** Injected clock (tests drive the deadline without sleeping). */
  readonly now?: () => number
}

const DEFAULTS: Required<NormalizeOptions> = {
  maxInputChars: 4096,
  maxDepth: 3,
  minBlobChars: 16,
  maxOutputChars: 2048,
  maxVariants: 8,
  maxMs: 25,
  now: Date.now,
}

/** Primitives that run a following encoded string / blob as code. */
const EXEC_PRIMITIVE = /(?:-EncodedCommand|FromBase64String|Invoke-Expression|\biex\b|\beval\b|bash\s+-c|sh\s+-c|pwsh\s+-c|powershell\s+-c|xxd\s+-r|--decode\b)/i

/** base64 blobs long enough to be a real payload, quoted or bare. */
const B64_RE = /["']?([A-Za-z0-9+/]{16,}={0,2})["']?/g

/** `\x72\x6d` escapes, or a spaced hex dump. */
const HEX_ESCAPE_RE = /\\x([0-9a-fA-F]{2})/g
const HEX_PAIR_RE = /[0-9a-fA-F]{2}/g

/**
 * Simple assignments we can substitute textually: `X="v"`, `$X='v'`, `${X}: v`.
 *
 * The value is matched lazily without escape handling, because a Windows path is
 * the common case and ends in a backslash right before the closing quote
 * (`$t="C:\"`): an escape-aware pattern cannot find that terminator and silently
 * yields nothing, which is the exact blind spot this folding exists to close.
 * Truncating a value that contains a literal quote is acceptable here — variants
 * only ever feed stricter scans.
 */
const ASSIGN_RE = /\$?\{?([A-Za-z_][A-Za-z0-9_]*)\}?\s*=\s*(["'])(.*?)\2/g

/** Share of decoded bytes that must be printable before we trust it as a command. */
const PRINTABLE_MIN = 0.85

function printableRatio(text: string): number {
  if (text === '') return 0
  let ok = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code === 0x09 || code === 0x0a || code === 0x0d || (code >= 0x20 && code !== 0x7f)) ok += 1
  }
  return ok / text.length
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max)
}

/** Decoded text is only useful if it plausibly is a command, not binary noise. */
function looksLikeText(text: string, minPrintable: number = PRINTABLE_MIN): boolean {
  return text !== '' && printableRatio(text) >= minPrintable && /[A-Za-z]{3}/.test(text)
}

/** Decode a blob as one encoding; '' when it is not valid base64 at all. */
function decodeB64(blob: string, encoding: 'utf8' | 'utf16le'): string {
  try {
    return Buffer.from(blob, 'base64').toString(encoding)
  } catch {
    return ''
  }
}

/**
 * Decode one base64 blob, or undefined when it is not decodable text.
 *
 * Two readings are attempted because they look identical from outside and both
 * are common:
 * - **utf16le** — `powershell/pwsh -EncodedCommand` and
 *   `[Convert]::ToBase64String([Text.Encoding]::Unicode…)` carry UTF-16LE. Read
 *   as UTF-8 the result is `R\0e\0m\0o\0v\0e…`, which a printable check alone
 *   rejects: a silent false negative on exactly the highest-value case, caught
 *   only once the test asserted the decoded text.
 * - **utf8** — POSIX `base64 -d` and generic payloads.
 */
function tryB64(blob: string, opts: Required<NormalizeOptions>): string | undefined {
  if (blob.length < opts.minBlobChars) return undefined
  const utf8 = decodeB64(blob, 'utf8')
  const interleavedNull = /\x00/.test(utf8)
  if (!interleavedNull && looksLikeText(utf8)) return clip(utf8, opts.maxOutputChars)
  const utf16 = decodeB64(blob, 'utf16le')
  if (looksLikeText(utf16)) return clip(utf16, opts.maxOutputChars)
  if (looksLikeText(utf8)) return clip(utf8, opts.maxOutputChars)
  return undefined
}

/** Decode `\x72\x6d` escapes or a spaced hex dump into text. */
function tryHex(blob: string, opts: Required<NormalizeOptions>): string | undefined {
  const escaped: number[] = []
  HEX_ESCAPE_RE.lastIndex = 0
  let e: RegExpExecArray | null = HEX_ESCAPE_RE.exec(blob)
  while (e !== null) {
    escaped.push(parseInt(e[1] ?? '0', 16))
    e = HEX_ESCAPE_RE.exec(blob)
  }
  const bytes: number[] = escaped.length > 0 ? escaped : []
  if (bytes.length === 0) {
    const compact = blob.replace(/\s+/g, '')
    if (compact.length % 2 !== 0) return undefined
    HEX_PAIR_RE.lastIndex = 0
    let m: RegExpExecArray | null = HEX_PAIR_RE.exec(compact)
    while (m !== null) {
      bytes.push(parseInt(m[0], 16))
      m = HEX_PAIR_RE.exec(compact)
    }
  }
  if (bytes.length === 0) return undefined
  let hex: string
  try {
    hex = Buffer.from(bytes).toString('utf8')
  } catch {
    return undefined
  }
  if (!looksLikeText(hex)) return undefined
  return clip(hex, opts.maxOutputChars)
}

/**
 * Substitute `X="rm -rf"` / `$X` pairs so `rm $X /` becomes visible as one
 * string. Only literal assignments are folded; nothing is evaluated.
 */
function expandVars(text: string, opts: Required<NormalizeOptions>): string | undefined {
  const table = new Map<string, string>()
  ASSIGN_RE.lastIndex = 0
  let m: RegExpExecArray | null = ASSIGN_RE.exec(text)
  while (m !== null) {
    const name = m[1]
    const value = m[3] ?? ''
    if (name !== undefined && value !== '') table.set(name, value)
    m = ASSIGN_RE.exec(text)
  }
  if (table.size === 0) return undefined
  let out = text
  for (const [name, value] of table) {
    // Skip the assignment's own left-hand side (`$t=` …), which would otherwise
    // be rewritten into noise like `C:\="C:\"`; only uses are folded.
    const use = new RegExp(`\\$\\{?${name}\\}?(?!\\s*=)`, 'g')
    out = out.replace(use, () => value)
  }
  return out === text ? undefined : clip(out, opts.maxOutputChars)
}

/**
 * Peel encoding layers off one command and return every readable variant.
 *
 * Never throws: any failure yields whatever decoded fine, and an empty result
 * simply means the call stays opaque to the deterministic layers. Exceeding the
 * time budget returns **nothing** rather than the partial set (see `maxMs`).
 */
export function normalizeCommandText(text: string, options: NormalizeOptions = {}): NormalizedText[] {
  const opts: Required<NormalizeOptions> = { ...DEFAULTS, ...options }
  if (typeof text !== 'string' || text.trim() === '' || text.length > opts.maxInputChars) return []
  const startedAt = opts.now()
  const spent = (): number => opts.now() - startedAt
  const seen = new Set<string>()
  const out: NormalizedText[] = []
  const push = (variant: NormalizedText): void => {
    const trimmed = variant.text.trim()
    if (trimmed === '' || seen.has(trimmed)) return
    seen.add(trimmed)
    out.push({ ...variant, text: trimmed })
  }

  let frontier: { text: string; executed: boolean }[] = [{ text, executed: false }]
  for (let depth = 0; depth < opts.maxDepth && frontier.length > 0 && out.length < opts.maxVariants; depth += 1) {
    if (spent() > opts.maxMs) return []
    const next: { text: string; executed: boolean }[] = []
    for (const item of frontier) {
      const runsCode = item.executed || EXEC_PRIMITIVE.test(item.text)

      B64_RE.lastIndex = 0
      let b: RegExpExecArray | null = B64_RE.exec(item.text)
      while (b !== null) {
        const decoded = tryB64(b[1] ?? '', opts)
        if (decoded !== undefined) {
          push({ text: decoded, via: 'base64', executed: runsCode })
          next.push({ text: decoded, executed: runsCode })
        }
        b = B64_RE.exec(item.text)
      }

      if (/\\x[0-9a-fA-F]{2}/.test(item.text) || /(?:\b[0-9a-fA-F]{2}\b){6,}/.test(item.text)) {
        const decoded = tryHex(item.text, opts)
        if (decoded !== undefined) {
          push({ text: decoded, via: 'hex', executed: runsCode })
          next.push({ text: decoded, executed: runsCode })
        }
      }

      const expanded = expandVars(item.text, opts)
      if (expanded !== undefined) {
        // A folded variable is the same command the shell will run, not a hidden
        // payload, so it always counts as executed.
        push({ text: expanded, via: 'varsub', executed: true })
        next.push({ text: expanded, executed: true })
      }
      if (out.length >= opts.maxVariants) break
    }
    frontier = next
  }
  return out.slice(0, opts.maxVariants)
}

/**
 * Whether a command is the plugin's own AppContainer launcher wrapper.
 * Informational only — the payload is still decoded and judged on its merits.
 */
export function isOwnLauncher(text: string): boolean {
  return /--exec-b64\s+[A-Za-z0-9+/=]{8,}/.test(text) && /--config\s+/.test(text)
}

/** Variants strict enough to feed a deterministic deny: the payload actually runs. */
export function executableVariants(variants: readonly NormalizedText[]): string[] {
  return variants.filter((v) => v.executed).map((v) => v.text)
}

/** All decoded variants, for the additive-only keyword/tier scans. */
export function allVariants(variants: readonly NormalizedText[]): string[] {
  return variants.map((v) => v.text)
}
