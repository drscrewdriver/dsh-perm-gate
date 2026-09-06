/**
 * Permissive settings card — the `settings.plugin.item` face of dsh-perm-gate.
 *
 * The card binds the `dsh-perm-gate` settings namespace through the
 * `settingsScope` cordis service and renders its fields: the single front switch
 * (`permissive`) plus the three combinable backend strategies
 * (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`). Every change commits
 * immediately through the scope (no staged form); the host reads the namespace
 * live, so a committed change applies to the next tool call without a restart.
 *
 * Kept dependency-free beyond react: the scope is subscribed with
 * `useSyncExternalStore`, and the controls are plain HTML.
 */
import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'

/** The settings namespace value the host registers (kept in lockstep with src/index.ts). */
export interface PermissiveCardValue {
  permissive?: boolean
  permissiveStrategies?: { trustAutoAllow?: boolean; alwaysConfirm?: boolean; llmAssist?: boolean }
  /** OpenAI-compatible endpoint the llmAssist classifier calls (custom API allowed). */
  classifierEndpoint?: string
  /** Model id used by the llmAssist classifier. */
  classifierModel?: string
  /** Secret bearer token / API key for the classifier endpoint (masked in the UI). */
  classifierApiKey?: string
  /** Timeout for one llmAssist risk call (ms). */
  riskTimeoutMs?: number
  /** Verdict learning: neutral-risk human confirmations may auto-allow the exact same operation later. */
  riskLearning?: boolean
  /** Confirmations required before a learned auto-allow (1–10). */
  riskThreshold?: number
  /** Editable whitelist (allow-list command patterns), one per entry. */
  allowlist?: string[]
}

/** One injected face: the plugin's own settings scope. */
export interface PermissiveCardInjected {
  scope: SettingsScope<PermissiveCardValue>
}

/** Full props: locale seat + the injected scope. */
export type PermissiveCardProps = PropsLocale<'dsh-perm-gate'> & PermissiveCardInjected

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '6px 0',
  fontSize: '13px',
  lineHeight: '20px',
}

const labelStyle: CSSProperties = { margin: 0, color: 'var(--dsw-alias-label-primary)' }

const hintStyle: CSSProperties = { margin: '4px 0 0', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

const sectionStyle: CSSProperties = {
  marginTop: '12px',
  paddingTop: '10px',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}

const controlStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-surface, #fff)',
  color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: '4px',
  padding: '3px 8px',
  fontSize: '13px',
}

const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' }

const fieldLabelStyle: CSSProperties = { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' }

/**
 * The card body, wrapped in a disclosure shell like every peer settings card:
 * a header (name + description + chevron) toggling the body, collapsed by
 * default so the plugin tab stays a tidy list of drawers.
 */
export function PermissiveCard({ t, scope }: PermissiveCardProps): JSX.Element {
  const [open, setOpen] = useState(false)
  // The api key is kept OUT of the visible value (secret): a fresh typed draft
  // overwrites on blur; an already-set key shows only a masked placeholder.
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  // Whitelist draft (one pattern per line); `allowDirty` avoids clobbering user
  // edits when the host re-seeds the namespace after mount.
  const [allowText, setAllowText] = useState('')
  const [allowDirty, setAllowDirty] = useState(false)
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const unavailable = snapshot.status === 'unavailable'
  const readonly = unavailable || !snapshot.writable
  const value = (snapshot.value ?? {}) as Partial<PermissiveCardValue>
  const strategies = value.permissiveStrategies ?? {}
  const hasApiKey = typeof value.classifierApiKey === 'string' && value.classifierApiKey !== ''

  // The backend strategy toggles only take effect while the tier is on.
  const effective = value.permissive === true

  const commitApiKey = (): void => {
    const next = apiKeyDraft.trim()
    if (next === '') return
    void scope.set('classifierApiKey', next)
    setApiKeyDraft('') // never echo the secret back after it is stored
  }
  const clearApiKey = (): void => {
    void scope.unset('classifierApiKey')
    setApiKeyDraft('')
  }

  // Show the persisted allowlist until the user starts editing a fresh draft.
  const allowlistShown = allowDirty ? allowText : (value.allowlist ?? []).join('\n')
  const commitAllowlist = (): void => {
    const lines = allowlistShown.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
    void scope.set('allowlist', lines)
    setAllowDirty(false)
  }

  return (
    <div style={{
      border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
      background: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
      borderRadius: '12px',
      transition: 'border-color 0.16s, background 0.16s',
    }}>
      <button
        type="button"
        aria-expanded={open}
        style={{
          appearance: 'none',
          width: '100%',
          font: 'inherit',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          background: 'none',
          border: 0,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 16px',
        }}
        onClick={() => { setOpen(current => !current) }}
      >
        <span style={{ flex: '1 1 0%', minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }}>{t('card.title')}</div>
          <div style={{ color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', fontSize: '13px', lineHeight: 1.5 }}>{t('card.description')}</div>
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" aria-hidden
          style={{
            color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
            flex: '0 0 auto',
            transition: 'transform 0.16s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open
        ? (
          <div style={{ padding: '12px 16px' }}>
            {unavailable
              ? (
                <div style={{ fontSize: '13px', color: 'var(--dsw-alias-label-tertiary)' }}>
                  {t('card.unavailable')}
                </div>
              )
              : (
                <>
                  <div style={rowStyle}>
                    <label htmlFor="plugin-config-perm-gate-permissive" style={labelStyle}>{t('card.permissive')}</label>
                    <input
                      id="plugin-config-perm-gate-permissive"
                      type="checkbox"
                      checked={effective}
                      disabled={readonly}
                      onChange={(event) => { void scope.set('permissive', event.currentTarget.checked) }}
                    />
                  </div>
                  <p style={hintStyle}>{t('card.permissiveHint')}</p>

                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('card.strategies')}</p>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-trust" style={{ fontSize: '12px' }}>{t('card.strategy.trustAutoAllow')}</label>
                      <input
                        id="plugin-config-perm-gate-trust"
                        type="checkbox"
                        checked={strategies.trustAutoAllow ?? true}
                        disabled={readonly || !effective}
                        onChange={(event) => {
                          void scope.set('permissiveStrategies', {
                            ...strategies,
                            trustAutoAllow: event.currentTarget.checked,
                          })
                        }}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-confirm" style={{ fontSize: '12px' }}>{t('card.strategy.alwaysConfirm')}</label>
                      <input
                        id="plugin-config-perm-gate-confirm"
                        type="checkbox"
                        checked={strategies.alwaysConfirm ?? false}
                        disabled={readonly || !effective}
                        onChange={(event) => {
                          void scope.set('permissiveStrategies', {
                            ...strategies,
                            alwaysConfirm: event.currentTarget.checked,
                          })
                        }}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-llm" style={{ fontSize: '12px' }}>{t('card.strategy.llmAssist')}</label>
                      <input
                        id="plugin-config-perm-gate-llm"
                        type="checkbox"
                        checked={strategies.llmAssist ?? false}
                        disabled={readonly || !effective}
                        onChange={(event) => {
                          void scope.set('permissiveStrategies', {
                            ...strategies,
                            llmAssist: event.currentTarget.checked,
                          })
                        }}
                      />
                    </div>
                    {strategies.llmAssist === true
                      ? (
                        <section style={sectionStyle}>
                          <p style={labelStyle}>{t('card.llmReceiver')}</p>
                          <label style={fieldStyle}>
                            <span style={fieldLabelStyle}>{t('card.llmEndpoint')}</span>
                            <input
                              type="text"
                              value={value.classifierEndpoint ?? ''}
                              disabled={readonly}
                              placeholder="https://api.openai.com/v1"
                              style={controlStyle}
                              onChange={(event) => { void scope.set('classifierEndpoint', event.currentTarget.value) }}
                              onBlur={(event) => {
                                if (event.currentTarget.value.trim() === '') void scope.unset('classifierEndpoint')
                              }}
                            />
                          </label>
                          <label style={fieldStyle}>
                            <span style={fieldLabelStyle}>{t('card.llmModel')}</span>
                            <input
                              type="text"
                              value={value.classifierModel ?? ''}
                              disabled={readonly}
                              placeholder="deepseek-chat"
                              style={controlStyle}
                              onChange={(event) => { void scope.set('classifierModel', event.currentTarget.value) }}
                              onBlur={(event) => {
                                if (event.currentTarget.value.trim() === '') void scope.unset('classifierModel')
                              }}
                            />
                          </label>
                          <label style={fieldStyle}>
                            <span style={fieldLabelStyle}>{t('card.llmKey')}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="password"
                                autoComplete="off"
                                spellCheck={false}
                                value={apiKeyDraft}
                                disabled={readonly}
                                placeholder={hasApiKey ? t('card.llmKeyMasked') : t('card.llmKeyHidden')}
                                style={{ ...controlStyle, flex: '1 1 0%' }}
                                onChange={(event) => setApiKeyDraft(event.currentTarget.value)}
                                onBlur={commitApiKey}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
                                }}
                              />
                              {hasApiKey
                                ? (
                                  <button type="button" disabled={readonly} onClick={clearApiKey} style={controlStyle}>
                                    {t('card.llmKeyClear')}
                                  </button>
                                )
                                : null}
                            </div>
                            {hasApiKey && <span style={hintStyle}>{t('card.llmKeyOverwrite')}</span>}
                          </label>
                          <div style={rowStyle}>
                            <label htmlFor="plugin-config-perm-gate-risk-learning" style={{ fontSize: '12px' }}>{t('card.riskLearning')}</label>
                            <input
                              id="plugin-config-perm-gate-risk-learning"
                              type="checkbox"
                              checked={value.riskLearning ?? false}
                              disabled={readonly || !effective}
                              onChange={(event) => { void scope.set('riskLearning', event.currentTarget.checked) }}
                            />
                          </div>
                          <p style={hintStyle}>{t('card.riskLearningHint')}</p>
                          {value.riskLearning === true
                            ? (
                              <label style={fieldStyle}>
                                <span style={fieldLabelStyle}>{t('card.riskThreshold')}</span>
                                <input
                                  id="plugin-config-perm-gate-risk-threshold"
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={value.riskThreshold ?? 3}
                                  disabled={readonly || !effective}
                                  style={{ ...controlStyle, width: '96px' }}
                                  onChange={(event) => {
                                    const n = Number.parseInt(event.currentTarget.value, 10)
                                    if (Number.isFinite(n) && n >= 1 && n <= 10) void scope.set('riskThreshold', n)
                                  }}
                                />
                              </label>
                            )
                            : null}
                        </section>
                      )
                      : null}
                  </section>

                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('card.allowlist')}</p>
                    <p style={hintStyle}>{t('card.allowlistHint')}</p>
                    <textarea
                      id="plugin-config-perm-gate-allowlist"
                      value={allowlistShown}
                      disabled={readonly}
                      rows={6}
                      spellCheck={false}
                      style={{
                        ...controlStyle,
                        width: '100%',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        fontFamily: 'var(--ds-font-family-code, monospace)',
                        whiteSpace: 'pre',
                      }}
                      onChange={(event) => {
                        setAllowDirty(true)
                        setAllowText(event.currentTarget.value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) commitAllowlist()
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="button"
                        disabled={readonly || !allowDirty}
                        onClick={commitAllowlist}
                        style={{
                          ...controlStyle,
                          cursor: readonly || !allowDirty ? 'default' : 'pointer',
                          opacity: readonly || !allowDirty ? 0.5 : 1,
                        }}
                      >
                        {t('card.allowlistSave')}
                      </button>
                    </div>
                  </section>
                  {!snapshot.writable
                    && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>{t('card.readonly')}</p>}
                </>
              )}
          </div>
        )
        : null}
    </div>
  )
}