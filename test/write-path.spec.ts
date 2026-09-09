import { describe, expect, it } from 'vitest'
import { decideRules, type ToolCallContext } from '../src/evaluate.js'
import { compileDocument, parsePermissionsDocument, type CompiledRuleset } from '../src/rule.js'

/** Empty ruleset with a given defaultAction (no rules at all). */
function emptyRules(defaultAction: 'allow' | 'ask' | 'deny'): CompiledRuleset {
  return compileDocument(parsePermissionsDocument(`permissions:\n  defaultAction: ${defaultAction}`))
}

/** Build a ruleset from a rules YAML string. */
function ruleset(yaml: string): CompiledRuleset {
  return compileDocument(parsePermissionsDocument(yaml))
}

const WORKSPACE = 'E:/test/rewrite-agently'

function writeCtx(filePath: string, cwd = WORKSPACE): ToolCallContext {
  return { tool: 'write', args: { file_path: filePath, content: 'hello' }, cwd, home: cwd, caseInsensitive: true }
}

function editCtx(filePath: string, cwd = WORKSPACE): ToolCallContext {
  return { tool: 'edit', args: { file_path: filePath, old_string: 'a', new_string: 'b' }, cwd, home: cwd, caseInsensitive: true }
}

function shellCtx(command: string, cwd = WORKSPACE): ToolCallContext {
  return { tool: 'shell', args: { command }, cwd, home: cwd, caseInsensitive: true }
}

describe('write-path default (no rule matches)', () => {
  it('allows a write inside the workspace (defaultAction allow)', () => {
    expect(decideRules(emptyRules('allow'), writeCtx(`${WORKSPACE}/src/index.ts`)).action).toBe('allow')
  })

  it('asks for a write outside the workspace (defaultAction allow)', () => {
    expect(decideRules(emptyRules('allow'), writeCtx('C:/Users/joshua/.bashrc')).action).toBe('ask')
  })

  it('asks for a write to another drive', () => {
    expect(decideRules(emptyRules('allow'), writeCtx('D:/other/file.txt')).action).toBe('ask')
  })

  it('allows a write with a relative path (always inside)', () => {
    expect(decideRules(emptyRules('allow'), writeCtx('src/utils.ts')).action).toBe('allow')
  })

  it('uses defaultAction ask for inside paths', () => {
    expect(decideRules(emptyRules('ask'), writeCtx(`${WORKSPACE}/src/index.ts`)).action).toBe('ask')
  })

  it('uses defaultAction deny for outside paths', () => {
    expect(decideRules(emptyRules('deny'), writeCtx('C:/Users/joshua/.bashrc')).action).toBe('deny')
  })

  it('handles write without a file_path', () => {
    expect(decideRules(emptyRules('allow'), { tool: 'write', args: { content: 'hi' }, cwd: WORKSPACE, home: WORKSPACE }).action).toBe('allow')
  })

  it('handles write without home (no workspace root)', () => {
    expect(decideRules(emptyRules('allow'), { tool: 'write', args: { file_path: '/outside/file.txt' }, cwd: WORKSPACE }).action).toBe('allow')
  })
})

describe('edit-path default (no rule matches)', () => {
  it('allows an edit inside the workspace', () => {
    expect(decideRules(emptyRules('allow'), editCtx(`${WORKSPACE}/src/index.ts`)).action).toBe('allow')
  })

  it('asks for an edit outside the workspace', () => {
    expect(decideRules(emptyRules('allow'), editCtx('C:/Users/joshua/.bashrc')).action).toBe('ask')
  })
})

describe('explicit deny rules still win', () => {
  it('a deny rule on an inside path denies', () => {
    const rs = ruleset(`permissions:\n  defaultAction: allow\n  deny:\n    - paths: [src/secret.ts]\n      reason: secret`)
    expect(decideRules(rs, writeCtx('src/secret.ts')).action).toBe('deny')
  })
})

describe('explicit allow rules for inside paths', () => {
  it('an allow rule for an inside path matches', () => {
    // The rule matches because the path is inside the workspace and
    // normalizeWorkspacePath resolves it to a non-empty relative path.
    const rs = ruleset(`permissions:\n  defaultAction: ask\n  allow:\n    - paths: [src/config.ts]\n      reason: config is safe`)
    expect(decideRules(rs, writeCtx(`${WORKSPACE}/src/config.ts`)).action).toBe('allow')
  })
})

describe('shell command read-only detection', () => {
  it('allows read-only commands (defaultAction allow)', () => {
    for (const cmd of [
      'git status',
      'git log --oneline',
      'git remote -v',
      'cat /etc/passwd',
      'ls -la',
      'echo hello',
      'python -c "import urllib.request; print(urllib.request.urlopen(\'https://api.github.com/repos/x/y\').read())"',
      'curl https://api.github.com/repos/x/y',
      'node -e "console.log(1)"',
    ]) {
      expect(decideRules(emptyRules('allow'), shellCtx(cmd)).action).toBe('allow')
    }
  })

  it('asks for commands with write/execution patterns', () => {
    for (const cmd of [
      'git push origin main',
      'git commit -m "fix"',
      'cp a.txt b.txt',
      'mv old.txt new.txt',
      'mkdir -p build',
      'touch newfile.txt',
      'chmod 755 script.sh',
      'sed -i "s/foo/bar/g" file.txt',
      'echo hello > /tmp/out.txt',
      'tee /tmp/log.txt',
      'docker rm container1',
      'gh pr create --title "test"',
    ]) {
      expect(decideRules(emptyRules('allow'), shellCtx(cmd)).action).toBe('ask')
    }
  })

  it('uses defaultAction deny for write-pattern commands', () => {
    expect(decideRules(emptyRules('deny'), shellCtx('git push origin main')).action).toBe('deny')
  })
})
