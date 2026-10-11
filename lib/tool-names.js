/**
 * The harness tool-name lists, in one place.
 *
 * These sets used to live inside `engine.ts` / `evaluate.ts`, which meant the
 * question "is this call an executed command?" had two answers depending on which
 * file asked it. It now has one, in `commandBearingCall`.
 *
 * Why not a name whitelist for executors: the agent mis-types tool names (today's
 * log has `Error: unknown tool "pash"`), plugins register their own runners, and a
 * future line may rename `shell`. A call that carries a command string and is not
 * a *known* non-executor must be judged as a command call — the whitelist direction
 * was a bypass, not a safety margin.
 */
/** Names the harness uses for "run this shell command". */
export const SHELL_TOOLS = new Set(['shell', 'terminal', 'bash', 'pwsh', 'sh', 'cmd', 'powershell']);
/** File mutation tools: they write paths, they do not execute their arguments. */
export const WRITE_TOOLS = new Set(['write', 'edit']);
/**
 * Read-only tools that can never modify the workspace or execute anything. P0
 * still protects sensitive path reads outside the workspace root, and the
 * deny-keyword layer still runs first, so a search whose query contains a
 * blacklisted phrase is still vetoed.
 */
export const READ_TOOLS = new Set([
    'read', 'read_image', 'grep', 'glob', 'ls', 'lsp',
    // Search / lookup: every one of these only READS. `web_search` and
    // `modlens_read_image` also reach the network, but through DSH's own client
    // rather than a subprocess — see the network note below.
    'web_search', 'modlens_read_image',
    'advanced_search', 'platform_search', 'free_search_test',
    // Session-scoped reads: they disclose already-recorded state, never mutate.
    'context_compression_retrieve', 'memory_search_graph', 'memory_expand_graph_node',
]);
/** DSH internal coordination / management tools — not workspace-modifying. */
export const INTERNAL_TOOLS = new Set([
    // AgentTeams coordination
    'agent_teams_create', 'agent_teams_add_member', 'agent_teams_remove_member',
    'agent_teams_delete', 'agent_teams_edit_plan', 'agent_teams_reassign_task',
    'agent_teams_claim_task', 'agent_teams_create_task', 'agent_teams_send_message',
    'agent_teams_approve', 'agent_teams_resume',
    // AgentTeams status reads
    'agent_teams_status', 'agent_teams_update_task',
    // DSH session/memory/goal/taskboard management. The memory store is the
    // agent's own state, not the workspace: writing it is not a workspace write.
    'conversation_search',
    'memory_add', 'memory_delete', 'memory_read_scene', 'memory_search',
    'memory_import', 'memory_ruminate', 'memory_ruminate_cancel', 'memory_ruminate_status',
    'get_goal', 'update_goal', 'create_goal',
    'taskboard_get', 'taskboard_list', 'taskboard_claim', 'taskboard_block',
    'taskboard_comment', 'taskboard_release_claim', 'taskboard_submit_review',
    'taskboard_relate',
    // Job/agent management
    'job_list', 'job_output', 'job_kill',
    'list_agents', 'interrupt_agent', 'send_message',
    // Session-local UI / plan / todo state (no workspace write, no execution)
    'todo_write', 'render_ui', 'validate_dsh_ui', 'ask_user_question', 'exit_plan_mode',
    // Background / planning delegation (the delegated work is gated separately)
    'subagent', 'subagent_fork', 'ralph', 'workflow', 'skill',
]);
/**
 * Tools whose `command`-shaped argument is **data, not an action**.
 *
 * `read` receives a search string under several keys, `write` may carry a script
 * body; parsing those as shell text would deny a file read because a document
 * happens to quote `git push --force`. Everything *outside* this set is treated as
 * a possible executor when it carries a command string.
 */
export const NON_EXECUTOR_TOOLS = new Set([...READ_TOOLS, ...INTERNAL_TOOLS, ...WRITE_TOOLS]);
/** The command string one call carries, under any of the names runners use. */
export function commandArgOf(args) {
    for (const key of ['command', 'cmd', 'script']) {
        const value = args?.[key];
        if (typeof value === 'string' && value.trim() !== '')
            return value;
    }
    return undefined;
}
/**
 * The command a call actually executes, or `undefined` when the call is not a
 * command call. Known non-executors are exempt; anything else with a command
 * string is judged as a command (fail-closed toward inspection, never toward allow).
 */
export function executableCommandOf(tool, args) {
    return NON_EXECUTOR_TOOLS.has(tool) ? undefined : commandArgOf(args);
}
