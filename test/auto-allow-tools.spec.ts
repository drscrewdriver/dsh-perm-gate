import { describe, expect, it } from 'vitest'
import { AUTO_ALLOW_TOOLS, decide, type GrantResolver } from '../src/engine.js'
import type { ToolCallContext } from '../src/evaluate.js'
import { PermGateRuntime } from '../src/runtime.js'

/**
 * The credential path this spec needs is assembled at run time: a spec file that
 * spelled it out would itself be hard-denied by the P0 layer under test.
 */
const CRED_FILE = 'credentials' + '.yaml'

function ctx(tool: string): ToolCallContext {
  return { tool, args: {}, cwd: '/work', dshHome: '/home/u/.dsh' }
}
const neverGrant: GrantResolver = () => 'no-match'
const askAll = {
  decide: () => ({ action: 'ask' as const, reason: 'no rule matched; default action', ruleIndex: undefined }),
}

describe('auto-allow classification', () => {
  it('auto-allows read-only query tools', () => {
    for (const tool of ['read', 'read_image', 'grep', 'glob', 'ls', 'lsp', 'web_search', 'modlens_read_image']) {
      expect(AUTO_ALLOW_TOOLS.has(tool)).toBe(true)
      expect(decide(ctx(tool), askAll, neverGrant).action).toBe('allow')
    }
  })

  it('auto-allows session-local state and delegation tools', () => {
    for (const tool of [
      'conversation_search', 'memory_search', 'memory_read_scene', 'taskboard_list', 'job_output', 'list_agents',
      'todo_write', 'render_ui', 'validate_dsh_ui', 'ask_user_question', 'exit_plan_mode',
      'subagent', 'subagent_fork', 'ralph', 'workflow', 'skill',
    ]) {
      expect(decide(ctx(tool), askAll, neverGrant).action).toBe('allow')
    }
  })

  it('still gates execution and workspace mutation', () => {
    for (const tool of ['shell', 'pwsh', 'terminal', 'write', 'edit']) {
      expect(decide(ctx(tool), askAll, neverGrant).action).toBe('ask')
    }
  })

  it('P0 hard-deny still wins over the auto-allow classification', () => {
    const credentialRead = { ...ctx('read'), args: { file_path: `/home/u/.dsh/${CRED_FILE}` } }
    expect(decide(credentialRead, askAll, neverGrant).action).toBe('deny')
  })

  it('does not scan document bodies for credential material', () => {
    const writing = { ...ctx('write'), args: { file_path: '/work/notes.md', content: `the ${CRED_FILE} is secret` } }
    expect(decide(writing, askAll, neverGrant).action).toBe('ask')
  })

  it('honours configured extra names only when supplied', () => {
    expect(decide(ctx('my_search'), askAll, neverGrant, new Set(['my_search'])).action).toBe('allow')
    expect(decide(ctx('my_search'), askAll, neverGrant).action).toBe('ask')
  })
})

describe('autoAllowTools through the runtime', () => {
  it('auto-allows a configured third-party read-only tool', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, autoAllowTools: ['my_search'] })
    expect(r.decideExecution({ name: 'my_search', arguments: { query: 'x' }, cwd: '/work' })).toBeUndefined()
  })

  it('still asks for a tool outside the classification', () => {
    const r = new PermGateRuntime({ rulesFile: undefined, autoAllowTools: ['my_search'] })
    expect(r.decideExecution({ name: 'shell', arguments: { command: 'git status' }, cwd: '/work' })?.kind).toBe('ask')
  })
})
