/**
 * Preset deny keywords inherited from dsh-approval-gate's `DEFAULT_DENY_KEYWORDS`
 * (the preset blacklist layer of its pipeline). One keyword per entry, matched
 * case-insensitively on word boundaries against the call's command text and its
 * scalar arguments — document bodies are skipped — so a keyword can no longer
 * veto an unrelated identifier or file text that merely contains it.
 *
 * Pure data shared by the node half (deny-keyword pre-layer) and the client
 * bundle (the settings card's preset tags), so it must stay import-free.
 */

/** The preset blacklist; the gate applies it whenever the namespace carries no override. */
export const DEFAULT_DENY_KEYWORDS: readonly string[] = [
  'rm -rf', 'rm -fr', 'rm -r -f', 'rm --recursive --force',
  'push --force', 'force-push', 'force push', 'drop table', 'drop database',
  'mkfs', 'mkfs.ext', 'format', 'shutdown', 'reboot', 'dd of=',
  'delete from', 'truncate table', 'truncate ', 'terraform destroy', 'revoke',
  '清空数据库', '删除数据库', '格式化', 'sudo rm', 'chmod 777 /',
  'git reset --hard', 'git clean -fd', 'docker rm', 'docker system prune',
]

/**
 * Tool names whose `code`-style argument is a code-mode wrapper: its body is other
 * tools' document text, so a deny-keyword hit on that prose is a false positive
 * (issue #11). Applied as the default of `denyKeywordExemptTools` — an explicit empty
 * array disables every exemption and restores the scan-everything behaviour. The
 * exemption reaches the deny-keyword layer ONLY; P0, the credential pre-screen and
 * explicit `deny:` rules keep running.
 *
 * Import-free on purpose, like the blacklist above: the same preset seeds both the
 * node runtime and the client bundle's settings card.
 */
export const DEFAULT_DENY_KEYWORD_EXEMPT_TOOLS: readonly string[] = ['run_code']
