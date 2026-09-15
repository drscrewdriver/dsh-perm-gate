import { describe, expect, it } from 'vitest'
import { networkModeForSandbox, defaultDecision, decideNetworkTarget, isLoopbackTarget, blockMessage, isIpLiteral, parseUrlTarget } from '../src/network.js'
import { compileDocument, parsePermissionsDocument } from '../src/rule.js'
import type { CompiledRuleset } from '../src/rule.js'

function makeRuleset(yaml: string): CompiledRuleset {
  const doc = parsePermissionsDocument(yaml)
  return compileDocument(doc)
}

describe('networkModeForSandbox', () => {
  it('maps read-only to deny-all', () => {
    expect(networkModeForSandbox('read-only', 'whitelist')).toBe('deny-all')
  })

  it('maps workspace-write to whitelist', () => {
    expect(networkModeForSandbox('workspace-write', 'whitelist')).toBe('whitelist')
  })

  it('maps danger-full-access to allow-all', () => {
    expect(networkModeForSandbox('danger-full-access', 'whitelist')).toBe('allow-all')
  })

  it('falls back for unknown presets', () => {
    expect(networkModeForSandbox('unknown', 'whitelist')).toBe('whitelist')
    expect(networkModeForSandbox(undefined, 'deny-all')).toBe('deny-all')
  })
})

describe('defaultDecision', () => {
  it('deny-all yields deny', () => {
    expect(defaultDecision('deny-all', 'deny')).toEqual({ action: 'deny', matched: false, mode: 'deny-all' })
  })

  it('whitelist uses unlisted action', () => {
    expect(defaultDecision('whitelist', 'ask')).toEqual({ action: 'ask', matched: false, mode: 'whitelist' })
    expect(defaultDecision('whitelist', 'deny')).toEqual({ action: 'deny', matched: false, mode: 'whitelist' })
  })

  it('allow-all yields allow', () => {
    expect(defaultDecision('allow-all', 'deny')).toEqual({ action: 'allow', matched: false, mode: 'allow-all' })
  })
})

describe('isLoopbackTarget', () => {
  it('identifies loopback addresses', () => {
    expect(isLoopbackTarget({ host: 'localhost', ips: [] })).toBe(true)
    expect(isLoopbackTarget({ host: '127.0.0.1', ips: [] })).toBe(true)
    expect(isLoopbackTarget({ host: '::1', ips: [] })).toBe(true)
  })

  it('rejects non-loopback', () => {
    expect(isLoopbackTarget({ host: 'github.com', ips: [] })).toBe(false)
    expect(isLoopbackTarget({ host: '192.168.1.1', ips: [] })).toBe(false)
  })
})

describe('decideNetworkTarget', () => {
  it('allow-all mode allows everything', () => {
    const ruleset = makeRuleset('defaultAction: ask\ndeny: []\nallow: []\nask: []')
    const decision = decideNetworkTarget(ruleset, { host: 'example.com', ips: [] }, {
      mode: 'allow-all', unlisted: 'deny', loopback: 'allow',
    })
    expect(decision.action).toBe('allow')
    expect(decision.matched).toBe(false)
  })

  it('deny-all mode denies everything', () => {
    const ruleset = makeRuleset('defaultAction: allow\ndeny: []\nallow: []\nask: []')
    const decision = decideNetworkTarget(ruleset, { host: 'example.com', ips: [] }, {
      mode: 'deny-all', unlisted: 'deny', loopback: 'allow',
    })
    expect(decision.action).toBe('deny')
  })

  it('loopback short-circuits when loopback=allow', () => {
    const ruleset = makeRuleset('defaultAction: deny\ndeny:\n  - network:\n      domains: ["*"]\n')
    const decision = decideNetworkTarget(ruleset, { host: 'localhost', ips: [] }, {
      mode: 'whitelist', unlisted: 'deny', loopback: 'allow',
    })
    expect(decision.action).toBe('allow')
  })

  it('loopback does NOT short-circuit when loopback=policy', () => {
    const ruleset = makeRuleset('defaultAction: deny\ndeny:\n  - network:\n      domains: ["*"]\n')
    const decision = decideNetworkTarget(ruleset, { host: 'localhost', ips: [] }, {
      mode: 'whitelist', unlisted: 'deny', loopback: 'policy',
    })
    expect(decision.action).toBe('deny')
    expect(decision.matched).toBe(true)
  })

  it('allow rule matches specific domain', () => {
    const ruleset = makeRuleset(`defaultAction: deny
allow:
  - network:
      domains: ["github.com"]
`)
    const decision = decideNetworkTarget(ruleset, { host: 'github.com', port: 443, scheme: 'https', ips: [] }, {
      mode: 'whitelist', unlisted: 'deny', loopback: 'allow',
    })
    expect(decision.action).toBe('allow')
    expect(decision.matched).toBe(true)
  })

  it('deny rule matches before allow (deny-first)', () => {
    const ruleset = makeRuleset(`defaultAction: allow
deny:
  - network:
      domains: ["evil.com"]
allow:
  - network:
      domains: ["evil.com"]
`)
    const decision = decideNetworkTarget(ruleset, { host: 'evil.com', ips: [] }, {
      mode: 'whitelist', unlisted: 'deny', loopback: 'allow',
    })
    expect(decision.action).toBe('deny')
    expect(decision.matched).toBe(true)
  })

  it('unlisted target in whitelist mode uses unlisted action', () => {
    const ruleset = makeRuleset('defaultAction: allow\ndeny: []\nallow: []\nask: []')
    const decision = decideNetworkTarget(ruleset, { host: 'unknown.com', ips: [] }, {
      mode: 'whitelist', unlisted: 'ask', loopback: 'allow',
    })
    expect(decision.action).toBe('ask')
    expect(decision.matched).toBe(false)
  })

  it('shell tool scope: rules scoped to bash/pwsh fire at proxy', () => {
    const ruleset = makeRuleset(`defaultAction: deny
allow:
  - tools: [bash]
    network:
      domains: ["github.com"]
`)
    // bash matches
    const d1 = decideNetworkTarget(ruleset, { host: 'github.com', ips: [] }, {
      mode: 'whitelist', unlisted: 'deny', loopback: 'allow',
    })
    expect(d1.action).toBe('allow')

    // Non-shell tool (e.g. read) — rule should NOT fire at proxy layer
    // (proxy always attributes to bash/pwsh)
    const d2 = decideNetworkTarget(ruleset, { host: 'other.com', ips: [] }, {
      mode: 'whitelist', unlisted: 'deny', loopback: 'allow',
    })
    expect(d2.action).toBe('deny')
  })
})

describe('blockMessage', () => {
  it('generates rule-matched deny message', () => {
    // Build a real compiled rule instead of a hand-shaped stub.
    const ruleset = makeRuleset(`defaultAction: allow
deny:
  - tools: [bash]
    reason: "no internal access"
    network:
      domains: ["internal.corp"]
`)
    const rule = ruleset.deny[0]
    const msg = blockMessage({
      action: 'deny', matched: true, mode: 'whitelist',
      ruleIndex: rule.index, rule,
    })
    expect(msg).toContain('denied')
    expect(msg).toContain('rule 1')
    expect(msg).toContain('no internal access')
  })

  it('generates mode-default deny message', () => {
    const msg = blockMessage({ action: 'deny', matched: false, mode: 'deny-all' })
    expect(msg).toContain('deny-all')
  })
})

describe('isIpLiteral', () => {
  it('identifies IPv4', () => {
    expect(isIpLiteral('192.168.1.1')).toBe(true)
  })

  it('identifies IPv6', () => {
    expect(isIpLiteral('::1')).toBe(true)
    expect(isIpLiteral('fe80::1')).toBe(true)
  })

  it('rejects hostnames', () => {
    expect(isIpLiteral('github.com')).toBe(false)
  })
})

describe('parseUrlTarget', () => {
  it('parses https URL', () => {
    const t = parseUrlTarget('https://github.com:443/path')
    expect(t).toBeDefined()
    expect(t!.host).toBe('github.com')
    expect(t!.port).toBe(443)
    expect(t!.scheme).toBe('https')
  })

  it('parses http URL', () => {
    const t = parseUrlTarget('http://example.com')
    expect(t).toBeDefined()
    expect(t!.host).toBe('example.com')
    expect(t!.port).toBe(80)
  })

  it('returns undefined for invalid URL', () => {
    expect(parseUrlTarget('not-a-url')).toBeUndefined()
  })
})
