/**
 * Pre-execution network-target extraction — the candidate harvest that lets a
 * `network:` rule row fire before a shell command runs. Cases cover the cloud
 * metadata forms the preset rows must see (URL, bare IPv4, bracketed IPv6,
 * bare hostname, url-key arguments), the shapes that must NOT become targets
 * (timestamps), and the candidate cap.
 */
import { describe, expect, it } from 'vitest'
import { extractNetworkTargets } from '../src/network-extract.js'

describe('extractNetworkTargets — URL forms', () => {
  it('extracts an IPv4 metadata endpoint with port and scheme', () => {
    const t = extractNetworkTargets('curl http://169.254.169.254/latest/meta-data/', undefined)
    expect(t).toContainEqual({ ip: '169.254.169.254', port: 80, scheme: 'http' })
  })

  it('extracts an https host as a domain target', () => {
    const t = extractNetworkTargets('curl http://metadata.google.internal/computeMetadata/v1/', undefined)
    expect(t).toContainEqual({ domain: 'metadata.google.internal', port: 80, scheme: 'http' })
  })

  it('extracts a bracketed IPv6 target with the brackets stripped', () => {
    const t = extractNetworkTargets("curl 'http://[fd00:ec2::254]/latest/meta-data/'", undefined)
    expect(t).toContainEqual({ ip: 'fd00:ec2::254', port: 80, scheme: 'http' })
  })

  it('keeps an explicit port from the URL', () => {
    const t = extractNetworkTargets('curl http://169.254.170.2:8080/v2/credentials', undefined)
    expect(t).toContainEqual({ ip: '169.254.170.2', port: 8080, scheme: 'http' })
  })
})

describe('extractNetworkTargets — bare forms a raw-socket call produces', () => {
  it('extracts a bare IPv4 from a netcat-style command', () => {
    const t = extractNetworkTargets('nc 169.254.169.254 80', undefined)
    expect(t).toContainEqual({ ip: '169.254.169.254' })
  })

  it('extracts a bare hostname token from a netcat-style command', () => {
    const t = extractNetworkTargets('nc metadata.goog 80', undefined)
    expect(t).toContainEqual({ domain: 'metadata.goog' })
  })
})

describe('extractNetworkTargets — arguments', () => {
  it('parses a url-key value with a scheme', () => {
    const t = extractNetworkTargets(undefined, { url: 'https://100.100.100.200/latest/meta-data/' })
    expect(t).toContainEqual({ ip: '100.100.100.200', port: 443, scheme: 'https' })
  })

  it('falls back to bare-host parsing for a scheme-less url-key value', () => {
    const t = extractNetworkTargets(undefined, { url: '169.254.170.2' })
    expect(t).toContainEqual({ ip: '169.254.170.2' })
  })

  it('walks url-key arrays', () => {
    const t = extractNetworkTargets(undefined, { urls: ['http://metadata.goog/x', 'https://example.com/y'] })
    expect(t).toContainEqual({ domain: 'metadata.goog', port: 80, scheme: 'http' })
    expect(t).toContainEqual({ domain: 'example.com', port: 443, scheme: 'https' })
  })

  it('scans command-key text for embedded URLs', () => {
    const t = extractNetworkTargets(undefined, { command: "wget http://169.254.169.254/latest/meta-data/'" })
    expect(t).toContainEqual({ ip: '169.254.169.254', port: 80, scheme: 'http' })
  })
})

describe('extractNetworkTargets — non-targets and bounds', () => {
  it('does not read a timestamp as a target', () => {
    expect(extractNetworkTargets('echo run at 12:30:45', undefined)).toEqual([])
  })

  it('does not read an ordinary local path as a target', () => {
    expect(extractNetworkTargets('cat src/app.ts', undefined)).toEqual([])
  })

  it('returns nothing for an empty call', () => {
    expect(extractNetworkTargets(undefined, undefined)).toEqual([])
    expect(extractNetworkTargets('', {})).toEqual([])
  })

  it('caps the candidate list', () => {
    const text = Array.from({ length: 60 }, (_, i) => `http://10.0.0.${i}/`).join(' ')
    expect(extractNetworkTargets(text, undefined).length).toBeLessThanOrEqual(16)
  })

  it('deduplicates repeated targets', () => {
    const t = extractNetworkTargets('curl http://169.254.169.254/a http://169.254.169.254/b', undefined)
    expect(t.filter((x) => x.ip === '169.254.169.254')).toHaveLength(1)
  })
})
