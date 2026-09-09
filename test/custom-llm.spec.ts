import { describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { chatCompletionsUrl } from '../src/classifier.js'
import { PermGateRuntime } from '../src/runtime.js'
import type { ClassifierConfig } from '../src/classifier.js'

/**
 * End-to-end proof of the custom-LLM review path: a REAL local HTTP server
 * stands in for the user's own OpenAI-compatible API (any vendor), the runtime
 * is configured exactly like the DSH settings namespace configures it
 * (readClassifyConfig, no risk hook), and refineAsk must reach it over HTTP.
 */

interface CapturedRequest {
  url: string
  authorization?: string
  body: { model?: string; response_format?: unknown; messages?: unknown[] }
}

/** Start a stub custom LLM API; returns its base URL and the requests it saw. */
async function startLlmApi(handler: (req: CapturedRequest) => { status: number; content: string } | { status: number; raw?: string }): Promise<{ server: Server; base: string; requests: CapturedRequest[] }> {
  const requests: CapturedRequest[] = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      let body: CapturedRequest['body'] = {}
      try { body = JSON.parse(raw) } catch { /* keep empty */ }
      const captured: CapturedRequest = {
        url: req.url ?? '',
        authorization: req.headers.authorization,
        body,
      }
      requests.push(captured)
      const out = handler(captured)
      res.writeHead(out.status, { 'content-type': 'application/json' })
      res.end('raw' in out && out.raw !== undefined ? out.raw : JSON.stringify({ choices: [{ message: { content: out.content } }] }))
    })
  })
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address() as AddressInfo
  return { server, base: `http://127.0.0.1:${port}/v1`, requests }
}

function runtimeWith(base: string, extra: Partial<ClassifierConfig> = {}): PermGateRuntime {
  return new PermGateRuntime({
    rulesFile: undefined,
    permissive: true,
    permissiveStrategies: { llmAssist: true },
    // Exactly what the host half wires from the settings namespace
    // (src/index.ts readClassifyConfig): custom endpoint/model/key/timeout.
    readClassifyConfig: () => ({ endpoint: base, model: 'my-own-model', apiKey: 'sk-custom', timeoutMs: 20_000, ...extra }),
  })
}

const EXEC = { name: 'bash', arguments: { command: 'terraform plan' }, cwd: '/work', sessionId: 's1' }

describe('custom LLM review path (real HTTP, no injected hook)', () => {
  it('reaches the custom endpoint with model+key and auto-allows a safe verdict', async () => {
    const { server, base, requests } = await startLlmApi((req) => {
      // The custom API sees a well-formed OpenAI-compatible call.
      expect(req.authorization).toBe('Bearer sk-custom')
      expect(req.body.model).toBe('my-own-model')
      expect(Array.isArray(req.body.messages)).toBe(true)
      return { status: 200, content: '{"risk":"safe","reason":"read-only plan"}' }
    })
    try {
      const r = runtimeWith(base)
      const ask = r.decideExecution(EXEC)
      expect(ask?.kind).toBe('ask')
      expect(await r.refineAsk(EXEC, ask as never)).toBeUndefined() // allowed
      expect(r.auditEntries.at(-1)?.source).toBe('classifier')
      expect(requests[0]?.url).toBe('/v1/chat/completions')
    } finally {
      server.close()
    }
  })

  it('hard-risk verdict from the custom API auto-denies without popup', async () => {
    const { server, base } = await startLlmApi(() => ({ status: 200, content: '{"risk":"risky","category":"system"}' }))
    try {
      const r = runtimeWith(base)
      const ask = r.decideExecution(EXEC)
      const refined = await r.refineAsk(EXEC, ask as never)
      expect(refined?.kind).toBe('deny')
      expect(refined?.reason).toMatch(/risky:system/)
    } finally {
      server.close()
    }
  })

  it('works with gateways that reject response_format (lenient retry)', async () => {
    const { server, base, requests } = await startLlmApi((req) => {
      if (req.body.response_format !== undefined) return { status: 400, raw: '{"error":"response_format unsupported"}' }
      return { status: 200, content: '{"risk":"safe"}' }
    })
    try {
      const r = runtimeWith(base)
      const ask = r.decideExecution(EXEC)
      expect(await r.refineAsk(EXEC, ask as never)).toBeUndefined()
      expect(requests.length).toBe(2) // strict attempt + lenient retry
      expect(requests[1]?.body.response_format).toBeUndefined()
    } finally {
      server.close()
    }
  })

  it('accepts a fully pasted endpoint path (…/v1/chat/completions)', async () => {
    const { server, base, requests } = await startLlmApi(() => ({ status: 200, content: '{"risk":"safe"}' }))
    try {
      const r = runtimeWith(`${base}/chat/completions`) // user pasted the complete URL
      const ask = r.decideExecution(EXEC)
      expect(await r.refineAsk(EXEC, ask as never)).toBeUndefined()
      expect(requests.length).toBe(1) // no double path append
    } finally {
      server.close()
    }
  })

  it('falls back to the human ask when the custom endpoint is unreachable', async () => {
    const r = runtimeWith('http://127.0.0.1:9/v1') // nothing listens there
    const ask = r.decideExecution(EXEC)
    expect((await r.refineAsk(EXEC, ask as never))?.kind).toBe('ask')
    // ask is tracked in pending asks (not in audit anymore)
    expect(r.pendingAskCount()).toBe(1)
  })

  it('parses a plain-text "safe" from non-conforming custom models', async () => {
    const { server, base } = await startLlmApi(() => ({ status: 200, raw: 'SAFE - this is a read-only plan' }))
    try {
      const r = runtimeWith(base)
      const ask = r.decideExecution(EXEC)
      expect(await r.refineAsk(EXEC, ask as never)).toBeUndefined()
    } finally {
      server.close()
    }
  })
})

describe('chatCompletionsUrl normalization', () => {
  it('appends the path to a bare base and never double-appends a full one', () => {
    expect(chatCompletionsUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/chat/completions')
    expect(chatCompletionsUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1/chat/completions')
    expect(chatCompletionsUrl('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1/chat/completions')
    expect(chatCompletionsUrl(' http://localhost:11434/v1 ')).toBe('http://localhost:11434/v1/chat/completions')
  })
})
