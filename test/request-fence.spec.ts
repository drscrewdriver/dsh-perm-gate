/**
 * The cross-origin fence matrix. Every cell of the table in request-fence.ts
 * is asserted, because each one is a distinct bypass when it stops holding.
 */
import { describe, expect, it } from 'vitest'
import { ORIGIN_ENV, checkRead, checkWrite, kindOf } from '../src/request-fence.js'

const HOST = '127.0.0.1:3618'
const SAME = 'http://' + HOST

function req(method: string, headers: Record<string, string> = {}) {
  return { method, url: '/api/dsh-perm-gate/rules', headers: { host: HOST, ...headers } }
}

describe('read semantics', () => {
  it('allows a same-origin GET that carries no Origin at all', () => {
    // Browsers omit Origin on same-origin GET, and EventSource never sends it.
    expect(checkRead(req('GET'))).toEqual({ ok: true })
  })

  it('allows an explicit same-origin GET', () => {
    expect(checkRead(req('GET', { origin: SAME }))).toEqual({ ok: true })
  })

  it('refuses a GET from another origin', () => {
    const v = checkRead(req('GET', { origin: 'https://evil.example' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.status).toBe(403)
  })

  it('refuses a same-host different-scheme origin (DNS rebinding)', () => {
    // Comparing only the host would let this through; the scheme must count.
    const v = checkRead(req('GET', { origin: 'https://' + HOST }))
    expect(v.ok).toBe(false)
  })

  it('refuses a cross-site read even with a matching-looking origin', () => {
    const v = checkRead(req('GET', { origin: SAME, 'sec-fetch-site': 'cross-site' }))
    expect(v.ok).toBe(false)
  })

  it('refuses an opaque (null) origin', () => {
    expect(checkRead(req('GET', { origin: 'null' })).ok).toBe(false)
  })
})

describe('write semantics', () => {
  it('refuses a POST with no Origin (non-browser client)', () => {
    const v = checkWrite(req('POST', { 'content-type': 'application/json' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.status).toBe(403)
  })

  it('allows a same-origin JSON POST', () => {
    expect(checkWrite(req('POST', { origin: SAME, 'content-type': 'application/json' }))).toEqual({ ok: true })
  })

  it('accepts a JSON content-type with parameters', () => {
    expect(checkWrite(req('POST', { origin: SAME, 'content-type': 'application/json; charset=utf-8' }))).toEqual({ ok: true })
  })

  it('refuses the cross-site text/plain simple request', () => {
    // This is the exact bypass the fence exists for: a CORS simple request is
    // sent without a preflight, so only the server can stop the side effect.
    const v = checkWrite(req('POST', { origin: SAME, 'content-type': 'text/plain' }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.status).toBe(415)
  })

  it('refuses a POST with no content-type', () => {
    const v = checkWrite(req('POST', { origin: SAME }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.status).toBe(415)
  })

  it('refuses a cross-origin POST', () => {
    const v = checkWrite(req('POST', { origin: 'https://evil.example', 'content-type': 'application/json' }))
    expect(v.ok).toBe(false)
  })

  it('refuses a cross-site POST', () => {
    const v = checkWrite(req('POST', { origin: SAME, 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }))
    expect(v.ok).toBe(false)
  })

  it('lenient mode lets an Origin-less write through but keeps the JSON rule', () => {
    const env = { [ORIGIN_ENV]: 'lenient' }
    expect(checkWrite(req('POST', { 'content-type': 'application/json' }), env)).toEqual({ ok: true })
    expect(checkWrite(req('POST', { 'content-type': 'text/plain' }), env).ok).toBe(false)
  })

  it('off mode disables the fence entirely', () => {
    const env = { [ORIGIN_ENV]: 'off' }
    expect(checkWrite({ method: 'POST', headers: {} }, env)).toEqual({ ok: true })
    expect(checkRead({ method: 'GET', headers: {} }, env)).toEqual({ ok: true })
  })
})

describe('method kind resolution', () => {
  it('derives read/write from the verb only for auto routes', () => {
    expect(kindOf('auto', 'GET')).toBe('read')
    expect(kindOf('auto', 'HEAD')).toBe('read')
    expect(kindOf('auto', 'POST')).toBe('write')
  })

  it('keeps an explicit kind even for the opposite verb', () => {
    // health / dry-run are POST because they need a body but have no side
    // effect; marking them read is what keeps `curl -X POST` health checks alive.
    expect(kindOf('read', 'POST')).toBe('read')
    expect(kindOf('write', 'GET')).toBe('write')
  })
})
