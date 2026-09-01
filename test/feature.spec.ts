import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { classifyWithLLM } from '../src/classifier.js'
import { appendAllowCommand, listAllowCommands } from '../src/allowlist.js'
import { PermGateRuntime } from '../src/runtime.js'

function chatReply(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }))
}

describe('classifier (llmAssist receiving LLM)', () => {
  it('allows when the configured LLM says allow', async () => {
    const v = await classifyWithLLM(
      { endpoint: 'https://api.example.com/v1', model: 'm' },
      { tool: 'bash', args: { command: 'pnpm install' }, reason: 'trusted' },
      (async () => chatReply('{"verdict":"allow","reason":"ok"}')) as never,
    )
    expect(v).toBe('allow')
  })

  it('denies when the LLM says deny', async () => {
    const v = await classifyWithLLM(
      { endpoint: 'https://api.example.com/v1', model: 'm' },
      { tool: 'bash', args: { command: 'rm -rf /' }, reason: 'risky' },
      (async () => chatReply('{"verdict":"deny","reason":"destructive"}')) as never,
    )
    expect(v).toBe('deny')
  })

  it('fails closed to ask without endpoint/model', async () => {
    expect(await classifyWithLLM({}, { tool: 'bash', args: {}, reason: 'x' })).toBe('ask')
  })

  it('fails closed on non-ok response and on network error', async () => {
    expect(await classifyWithLLM(
      { endpoint: 'https://api.example.com/v1', model: 'm' },
      { tool: 'bash', args: {}, reason: 'x' },
      (async () => new Response('', { status: 500 })) as never,
    )).toBe('ask')
    expect(await classifyWithLLM(
      { endpoint: 'https://api.example.com/v1', model: 'm' },
      { tool: 'bash', args: {}, reason: 'x' },
      (async () => { throw new Error('boom') }) as never,
    )).toBe('ask')
  })
})

describe('allowlist (whitelist) append', () => {
  function rulesFile(allow: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-'))
    const file = join(dir, 'permissions.yaml')
    writeFileSync(file, `permissions:\n  defaultAction: ask\n  allow:\n    - command: [${allow.join(', ')}]\n      reason: dev\n`, 'utf8')
    return file
  }

  it('appends a command pattern to the allow list durably', () => {
    const file = rulesFile(['git pull'])
    expect(appendAllowCommand(file, 'git push')).toBe(true)
    expect(listAllowCommands(file)).toContain('git push')
    expect(listAllowCommands(file)).toContain('git pull')
  })
})

describe('runtime approval extensions', () => {
  function rt() {
    const dir = mkdtempSync(join(tmpdir(), 'perm-gate-'))
    const file = join(dir, 'permissions.yaml')
    writeFileSync(file, 'permissions:\n  defaultAction: ask\n  allow:\n    - command: [pnpm]\n      reason: dev\n', 'utf8')
    return new PermGateRuntime({ rulesFile: file, dshHome: '/home/u/.dsh', caseInsensitivePaths: true })
  }

  it('approveAllowEverywhere persists the command then decides allow', () => {
    const r = rt()
    // git status was an ask by default.
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('ask')
    expect(r.allowlist()).not.toContain('git')
    // "allow every occurrence of this command type" -> whitelist the command word.
    expect(r.approveAllowEverywhere('git')).toBe(true)
    expect(r.allowlist()).toContain('git')
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })).toBeUndefined()
  })

  it('setAllowlist replaces the whitelist then decides accordingly', () => {
    const r = rt()
    expect(r.allowlist()).toEqual(['pnpm'])
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('ask')
    expect(r.setAllowlist(['pnpm', 'git'])).toBe(true)
    expect(r.allowlist()).toEqual(['pnpm', 'git'])
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })).toBeUndefined()
    // Clearing the whitelist restores ask for the command again.
    r.setAllowlist([])
    expect(r.allowlist()).toEqual([])
    expect(r.decideExecution({ name: 'bash', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('ask')
  })

  it('approveRepeat lets an identical re-run pass without asking', () => {
    const r = rt()
    const exec = { name: 'bash', arguments: { command: 'curl https://x.example.com' }, cwd: '/work', parentAuthorized: true }
    expect(r.decideExecution(exec)?.kind).toBe('ask')
    r.approveRepeat(exec)
    expect(r.decideExecution(exec)).toBeUndefined()
  })

  it('classifyAsync fails closed to ask when no LLM is configured', async () => {
    const r = rt()
    expect(await r.classifyAsync({ tool: 'bash', args: {}, reason: 'x' })).toBe('ask')
  })
})