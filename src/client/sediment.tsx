/**
 * Learning-sediment management section — the settings-card face of verdict
 * learning's "沉淀" (the ⑤ card pattern demonstrated by dsh-approval-gate):
 * every threshold-reached key's confirmed samples, listed as the deterministic
 * auto-allow rules they now are, with per-key terminate and per-sample remove.
 *
 * Data source: the host's `GET /api/dsh-perm-gate/learning` route (the same
 * learning.json store the gate reads); actions POST back. Best-effort: a
 * missing route renders the empty state, never an error.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

interface LearningSample {
  readonly fp: string
  readonly ctx: string
  readonly at: number
}

interface LearningBody {
  readonly ok?: boolean
  readonly threshold?: number
  readonly confirmed?: Record<string, number>
  readonly samples?: Record<string, LearningSample[]>
}

const POLL_MS = 5_000

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '4px 8px',
  borderRadius: '6px',
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-surface, transparent)',
}

const chipStyle: CSSProperties = {
  fontSize: '11px',
  lineHeight: '16px',
  padding: '0 6px',
  borderRadius: '8px',
  color: 'var(--dsw-alias-label-tertiary)',
  border: '1px solid var(--dsw-alias-border-l2)',
}

const delButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  width: '20px',
  height: '20px',
  border: 'none',
  borderRadius: '999px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  cursor: 'pointer',
}

/** Full props: the locale seat delivered by the slot system. */
export type SedimentSectionProps = PropsLocale<'dsh-perm-gate'>

export function SedimentSection({ t }: SedimentSectionProps): JSX.Element | null {
  const [body, setBody] = useState<LearningBody | null>(null)

  useEffect(() => {
    let alive = true
    const load = (): void => {
      fetch('/api/dsh-perm-gate/learning', { headers: { 'cache-control': 'no-cache' } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data: LearningBody) => { if (alive) setBody(data) })
        .catch(() => { if (alive) setBody({}) })
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const post = (payload: { key: string; fp?: string }): void => {
    void fetch('/api/dsh-perm-gate/learning', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  const threshold = body?.threshold ?? 3
  const confirmed = body?.confirmed ?? {}
  const samples = body?.samples ?? {}
  const keys = Object.entries(confirmed).filter(([, count]) => count >= threshold)

  if (body === null) return null
  return (
    <div style={{ marginTop: '6px' }}>
      {keys.length === 0
        ? <div style={{ padding: '4px 0', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>{t('card.sedimentEmpty')}</div>
        : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {keys.map(([key, count]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={itemStyle}>
                    <code style={{ font: '600 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>{key}</code>
                    <span style={chipStyle}>{t('card.sedimentCount').replace('%n', String(count)).replace('%t', String(threshold))}</span>
                    <span style={{ flex: '1 1 auto' }} />
                    <button
                      type="button"
                      title={t('card.sedimentStopTitle')}
                      onClick={() => {
                        if (window.confirm(t('card.sedimentStopConfirm').replace('%k', key))) post({ key })
                      }}
                      style={{ ...delButtonStyle, width: 'auto', padding: '0 8px', border: '1px solid var(--dsw-alias-border-l2)' }}
                    >
                      {t('card.sedimentStop')}
                    </button>
                  </div>
                  {(samples[key] ?? []).map((s) => (
                    <div key={`${key}:${s.fp}`} style={{ ...itemStyle, marginLeft: '16px' }}>
                      <code style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-secondary, inherit)' }}>
                        {s.fp}
                        {s.ctx !== '' ? <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>{` — ${s.ctx}`}</span> : null}
                      </code>
                      <button
                        type="button"
                        aria-label={t('card.sedimentSampleRemove')}
                        title={t('card.sedimentSampleRemove')}
                        onClick={() => { post({ key, fp: s.fp }) }}
                        style={delButtonStyle}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
    </div>
  )
}
