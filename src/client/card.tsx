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
import { DEFAULT_DENY_KEYWORDS } from '../deny-defaults.ts'
import { LLM_PRESETS } from '../llm-presets.ts'
import { SedimentSection } from './sediment.tsx'

/** The settings namespace value the host registers (kept in lockstep with src/index.ts). */
export interface PermissiveCardValue {
  permissive?: boolean
  permissiveStrategies?: { trustAutoAllow?: boolean; alwaysConfirm?: boolean; llmAssist?: boolean }
  /** OpenAI-compatible endpoint the llmAssist classifier calls (custom API allowed). */
  classifierEndpoint?: string
  /** llmAssist receiver source: custom endpoint or the DSH host model group. */
  classifierSource?: string
  /** Optional provider override for the host receiver. */
  classifierProvider?: string
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
  /** Learning sedimentation: threshold-reached samples become deterministic auto-allows. */
  riskSediment?: boolean
  /** Editable whitelist (allow-list command patterns), one per entry. */
  allowlist?: string[]
  /** Editable deny-keyword blacklist; unset applies the inherited preset list. */
  denyKeywords?: string[]
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
  // List-face state: one add-input draft plus per-row delete (approval-gate's
  // rules-list pattern); the bulk textarea stays behind a toggle.
  const [addDraft, setAddDraft] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  // Health-test state for the llmAssist receiver.
  const [healthBusy, setHealthBusy] = useState(false)
  const [healthResult, setHealthResult] = useState<string | null>(null)
  const patterns = value.allowlist ?? []
  const removePattern = (index: number): void => {
    void scope.set('allowlist', patterns.filter((_, i) => i !== index))
  }
  const addPattern = (): void => {
    const next = addDraft.trim()
    if (next === '' || readonly) return
    void scope.set('allowlist', [...patterns, next])
    setAddDraft('')
  }
  // Deny-keyword blacklist: an explicit non-empty namespace array replaces the
  // preset; unset OR empty (schemastery materializes unset arrays as `[]`)
  // applies the inherited defaults — the protective blacklist is never off.
  const denyActive = Array.isArray(value.denyKeywords) && value.denyKeywords.length > 0
  const denylist = denyActive ? (value.denyKeywords as string[]) : [...DEFAULT_DENY_KEYWORDS]
  const [denyDraft, setDenyDraft] = useState('')
  const removeDeny = (index: number): void => {
    void scope.set('denyKeywords', denylist.filter((_, i) => i !== index))
  }
  const addDeny = (): void => {
    const next = denyDraft.trim()
    if (next === '' || readonly) return
    void scope.set('denyKeywords', [...denylist, next])
    setDenyDraft('')
  }
  const restoreDeny = (): void => {
    void scope.unset('denyKeywords')
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
                            <span style={fieldLabelStyle}>{t('card.llmSource')}</span>
                            <select
                              value={value.classifierSource ?? 'custom'}
                              disabled={readonly}
                              style={controlStyle}
                              onChange={(event) => { void scope.set('classifierSource', event.currentTarget.value) }}
                            >
                              <option value="custom">{t('card.llmSourceCustom')}</option>
                              <option value="host">{t('card.llmSourceHost')}</option>
                            </select>
                          </label>
                          {(value.classifierSource ?? 'custom') === 'custom'
                            ? (
                              <>
                                <label style={fieldStyle}>
                                  <span style={fieldLabelStyle}>{t('card.llmPreset')}</span>
                                  <select
                                    value=""
                                    disabled={readonly}
                                    style={controlStyle}
                                    onChange={(event) => {
                                      const preset = LLM_PRESETS.find((p) => p.id === event.currentTarget.value)
                                      if (preset !== undefined) {
                                        void scope.set('classifierEndpoint', preset.endpoint)
                                        void scope.set('classifierModel', preset.model)
                                      }
                                    }}
                                  >
                                    <option value="">{t('card.llmPresetChoose')}</option>
                                    {LLM_PRESETS.map((preset) => (
                                      <option key={preset.id} value={preset.id}>{preset.label}</option>
                                    ))}
                                  </select>
                                </label>
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
                              </>
                            )
                            : (
                              <>
                                <p style={hintStyle}>{t('card.llmSourceHostHint')}</p>
                                <label style={fieldStyle}>
                                  <span style={fieldLabelStyle}>{t('card.llmProvider')}</span>
                                  <input
                                    type="text"
                                    value={value.classifierProvider ?? ''}
                                    disabled={readonly}
                                    placeholder="deepseek-official"
                                    style={controlStyle}
                                    onChange={(event) => { void scope.set('classifierProvider', event.currentTarget.value) }}
                                    onBlur={(event) => {
                                      if (event.currentTarget.value.trim() === '') void scope.unset('classifierProvider')
                                    }}
                                  />
                                </label>
                              </>
                            )}
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <button
                              type="button"
                              disabled={readonly || healthBusy}
                              onClick={() => {
                                setHealthBusy(true)
                                setHealthResult(null)
                                fetch('/api/dsh-perm-gate/health', { method: 'POST' })
                                  .then((r) => r.json())
                                  .then((res: { ok?: boolean; ms?: number; detail?: string; error?: string }) => {
                                    setHealthResult(res.ok === true && typeof res.ms === 'number'
                                      ? t('card.healthOk').replace('%ms', String(res.ms)) + (typeof res.detail === 'string' ? ` · ${res.detail}` : '')
                                      : t('card.healthFail') + (res.detail ?? res.error ?? 'unknown'))
                                  })
                                  .catch((e: unknown) => { setHealthResult(t('card.healthFail') + String((e as Error)?.message ?? e)) })
                                  .finally(() => { setHealthBusy(false) })
                              }}
                              style={{ ...controlStyle, cursor: readonly || healthBusy ? 'default' : 'pointer' }}
                            >
                              {healthBusy ? t('card.healthRunning') : t('card.healthTest')}
                            </button>
                            {healthResult !== null && (
                              <span style={{ fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, inherit)', overflowWrap: 'anywhere' }}>
                                {healthResult}
                              </span>
                            )}
                          </div>
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
                          {value.riskLearning === true
                            ? (
                              <>
                                <div style={rowStyle}>
                                  <label htmlFor="plugin-config-perm-gate-risk-sediment" style={{ fontSize: '12px' }}>{t('card.riskSediment')}</label>
                                  <input
                                    id="plugin-config-perm-gate-risk-sediment"
                                    type="checkbox"
                                    checked={value.riskSediment ?? true}
                                    disabled={readonly || !effective}
                                    onChange={(event) => { void scope.set('riskSediment', event.currentTarget.checked) }}
                                  />
                                </div>
                                <p style={hintStyle}>{t('card.riskSedimentHint')}</p>
                                <div style={sectionStyle}>
                                  <p style={labelStyle}>{t('card.sediment')}</p>
                                  <p style={hintStyle}>{t('card.sedimentHint')}</p>
                                  <SedimentSection t={t} />
                                </div>
                              </>
                            )
                            : null}
                        </section>
                      )
                      : null}
                  </section>

                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('card.allowlist')}</p>
                    <p style={hintStyle}>{t('card.allowlistHint')}</p>
                    <p style={hintStyle}>{t('card.allowlistPresetNote')}</p>
                    {patterns.length === 0
                      ? (
                          <div style={{ padding: '6px 0', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>
                            {t('card.allowlistEmpty')}
                          </div>
                        )
                      : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0' }}>
                            {patterns.map((pattern, index) => (
                              <div
                                key={`${index}:${pattern}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--dsw-alias-border-l2)',
                                  background: 'var(--dsw-alias-bg-surface, transparent)',
                                }}
                              >
                                <code style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                                  {pattern}
                                </code>
                                <button
                                  type="button"
                                  aria-label={t('card.allowlistRemove')}
                                  title={t('card.allowlistRemove')}
                                  disabled={readonly}
                                  onClick={() => { removePattern(index) }}
                                  style={{
                                    flex: '0 0 auto',
                                    width: '20px',
                                    height: '20px',
                                    border: 'none',
                                    borderRadius: '999px',
                                    background: 'transparent',
                                    color: 'var(--dsw-alias-label-tertiary)',
                                    cursor: readonly ? 'default' : 'pointer',
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input
                        type="text"
                        value={addDraft}
                        disabled={readonly}
                        placeholder={t('card.allowlistPlaceholder')}
                        spellCheck={false}
                        style={{ ...controlStyle, flex: '1 1 auto', minWidth: 0 }}
                        onChange={(event) => { setAddDraft(event.currentTarget.value) }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') addPattern()
                        }}
                      />
                      <button
                        type="button"
                        disabled={readonly || addDraft.trim() === ''}
                        onClick={addPattern}
                        style={{
                          ...controlStyle,
                          flex: '0 0 auto',
                          cursor: readonly || addDraft.trim() === '' ? 'default' : 'pointer',
                          opacity: readonly || addDraft.trim() === '' ? 0.5 : 1,
                        }}
                      >
                        {t('card.allowlistAdd')}
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => { setBulkOpen(current => !current) }}
                        style={{ ...controlStyle, cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary)' }}
                      >
                        {bulkOpen ? t('card.allowlistBulkHide') : t('card.allowlistBulk')}
                      </button>
                    </div>
                    {bulkOpen
                      ? (
                          <>
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
                          </>
                        )
                        : null}
                  </section>

                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('card.denylist')}</p>
                    <p style={hintStyle}>{t('card.denylistHint')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0' }}>
                            {denylist.map((keyword, index) => {
                              const preset = (DEFAULT_DENY_KEYWORDS as readonly string[]).includes(keyword)
                              return (
                                <div
                                  key={`${index}:${keyword}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--dsw-alias-border-l2)',
                                    background: 'var(--dsw-alias-bg-surface, transparent)',
                                  }}
                                >
                                  <code style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                                    {keyword}
                                  </code>
                                  <span
                                    style={{
                                      flex: '0 0 auto',
                                      fontSize: '11px',
                                      lineHeight: '16px',
                                      padding: '0 6px',
                                      borderRadius: '8px',
                                      color: preset ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-label-secondary, inherit)',
                                      border: '1px solid var(--dsw-alias-border-l2)',
                                    }}
                                  >
                                    {preset ? t('card.denylistTagPreset') : t('card.denylistTagCustom')}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={t('card.denylistRemove')}
                                    title={t('card.denylistRemove')}
                                    disabled={readonly}
                                    onClick={() => { removeDeny(index) }}
                                    style={{
                                      flex: '0 0 auto',
                                      width: '20px',
                                      height: '20px',
                                      border: 'none',
                                      borderRadius: '999px',
                                      background: 'transparent',
                                      color: 'var(--dsw-alias-label-tertiary)',
                                      cursor: readonly ? 'default' : 'pointer',
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input
                        type="text"
                        value={denyDraft}
                        disabled={readonly}
                        placeholder={t('card.denylistPlaceholder')}
                        spellCheck={false}
                        style={{ ...controlStyle, flex: '1 1 auto', minWidth: 0 }}
                        onChange={(event) => { setDenyDraft(event.currentTarget.value) }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') addDeny()
                        }}
                      />
                      <button
                        type="button"
                        disabled={readonly || denyDraft.trim() === ''}
                        onClick={addDeny}
                        style={{
                          ...controlStyle,
                          flex: '0 0 auto',
                          cursor: readonly || denyDraft.trim() === '' ? 'default' : 'pointer',
                          opacity: readonly || denyDraft.trim() === '' ? 0.5 : 1,
                        }}
                      >
                        {t('card.denylistAdd')}
                      </button>
                    </div>
                    {denyActive
                      ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                            <button
                              type="button"
                              disabled={readonly}
                              onClick={restoreDeny}
                              style={{ ...controlStyle, cursor: readonly ? 'default' : 'pointer', border: 'none', background: 'transparent', color: 'var(--dsw-alias-label-tertiary)' }}
                            >
                              {t('card.denylistRestore')}
                            </button>
                          </div>
                        )
                        : null}
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