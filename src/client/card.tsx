/**
 * Permissive settings card — the top-level `settings.section` (自动审查门) of dsh-perm-gate.
 *
 * The card binds the plugin's profile entry (`dsh-perm-gate`) through the
 * `configForms` cordis service and renders its fields: the single front switch
 * (`permissive`) plus the three combinable backend strategies
 * (`trustAutoAllow` / `alwaysConfirm` / `llmAssist`). Every change commits
 * immediately through the scope (no staged form); the host reads the namespace
 * live, so a committed change applies to the next tool call without a restart.
 *
 * Kept dependency-free beyond react: the scope is subscribed with
 * `useSyncExternalStore`, and the controls are plain HTML.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, JSX, ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { chime } from './attention.ts'
import type { SettingsDocHandle } from './compat.ts'
import { pendingAfterFailure, pendingAfterSync, shownValue, SWITCH_SETTLE_MS } from './switch-state.ts'
import { DEFAULT_DENY_KEYWORDS } from '../deny-defaults.ts'
import { LLM_PRESETS } from '../llm-presets.ts'
import { DEFAULT_GATE_PRESETS } from '../preset.ts'
import { SedimentSection } from './sediment.tsx'
import { GuidePanel, GuideRestartButton, guideSteps, isGuideSkipped } from './guide.tsx'
import { PERM_GATE_GUIDE_STEPS } from './guide-steps.ts'
import { mountStarRow } from './star-row-copy.ts'

/** The settings namespace value the host registers (kept in lockstep with src/index.ts). */
export interface PermissiveCardValue {
  permissive?: boolean
  /** Permissive tier: the human handles what the grader flags. */
  /** YOLO tier (`permissive-yolo`): the grader answers in the person's place, never asks. */
  yolo?: boolean
  /**
   * YOLO only: stop treating "the target could not be pinned down" as a danger signal.
   * Invisible content, deletes and remote writes stay blocked; default off.
   */
  yoloWorkspaceExempt?: boolean
  /** Safenet-pass tier (`permissive-mech`): the mechanical screen takes over asks. */
  safenetPass?: boolean
  /** Safenet-ask tier (`permissive-snet`): mechanical screen, still asks, no grader. */
  safenetAsk?: boolean
  /** Protected-branch push floor opt-out. Default false keeps the P0 floor. */
  allowProtectedBranchPush?: boolean
  /** Unattended tiers: never a human popup (see src/config.ts for the semantics). */
  rulesFallback?: boolean
  /** On unless explicitly unset to false — the default attaches script bodies. */
  scriptReview?: boolean
  permissiveStrategies?: { trustAutoAllow?: boolean; alwaysConfirm?: boolean; llmAssist?: boolean; trustEscalation?: boolean }
  /** OpenAI-compatible endpoint the llmAssist classifier calls (custom API allowed). */
  classifierEndpoint?: string
  /** llmAssist receiver source: custom endpoint or the DSH host model group. */
  classifierSource?: string
  /** Optional provider override for the host receiver. */
  classifierProvider?: string
  /** Model id used by the llmAssist classifier. */
  classifierModel?: string
  /** Reasoning effort for the host receiver; empty follows the host model config. */
  classifierEffort?: string
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
  learningScope?: 'global' | 'session'
  attentionToast?: boolean
  attentionSound?: boolean
  attentionMinGapMs?: number
  /** Editable whitelist (allow-list command patterns), one per entry. */
  allowlist?: string[]
  /** Editable deny-keyword blacklist; unset applies the inherited preset list. */
  denyKeywords?: string[]
  /** Keywords appended to whichever blacklist is live (never replaces it). */
  denyKeywordsExtra?: string[]
  /** Tool names skipped by the deny-keyword layer ONLY (issue #11); preset includes `run_code`. */
  denyKeywordExemptTools?: string[]
  /** User-declared credential paths, held to the same standard as `.ssh`. */
  credentialPaths?: string[]
  /** User-classified safe tool names held to the same tier as the built-in read tools. */
  autoAllowTools?: string[]
  /** Extra argument keys treated as document bodies (never replaces the built-in list). */
  extraContentArgKeys?: string[]
  /** Extra argument keys treated as operations; wins over the prose list on the same key. */
  extraOperationArgKeys?: string[]
  /**
   * Session permission presets in which the gate acts at all (the host's
   * resolved `gatePresets`). Outside them the whole gate — P0 hard-deny
   * included — stands down; the card states that scope so the user is not
   * surprised by a silent stand-down.
   */
  gatePresets?: string[]
  // ─── Network (Phase 2) ─────────────────────────────────────────────
  /** Master network switch. When false, no proxy is started. */
  networkEnabled?: boolean
  /** Network policy mode. */
  networkMode?: 'deny-all' | 'whitelist' | 'allow-all'
  /** Rewrite HTTP(S)_PROXY / ALL_PROXY for subprocesses. Default true. */
  networkInjectEnv?: boolean
  // ─── Hot reload (Phase 3) ──────────────────────────────────────────
  /** Enable file watching for rule hot-reload. */
  watch?: boolean
}

/** One injected face: the plugin's own settings scope. Typed as the local
 * structural handle (compat.ts) instead of the host package's `ConfigForm` —
 * the host type's shape moves between host lines (0.1.5 set/unset vs 0.2.0
 * mutate-centered snapshot), and the card must compile identically against
 * every line's real types. */
export interface PermissiveCardInjected {
  scope: SettingsDocHandle
}

/** Full props: locale seat + the injected scope. */
export type PermissiveCardProps = PropsLocale<'dsh-perm-gate'> & PermissiveCardInjected

/** The receiver projection served by GET /api/dsh-perm-gate/receiver. */
interface ReceiverInfoBody {
  readonly ok?: boolean
  readonly source?: 'custom' | 'host'
  readonly selection?: { readonly provider: string; readonly model: string } | null
  readonly providers?: readonly { readonly id: string; readonly name: string; readonly models: readonly { readonly id: string; readonly name: string }[]; readonly error?: string }[]
}

/**
 * The report served by POST /api/dsh-perm-gate/dry-run. `verdict` is the
 * effective result of the whole chain; `ruleLayer` is what the `permissions`
 * chain decides on its own, and only that layer can name a rule index.
 */
interface DryRunReport {
  readonly verdict?: 'allow' | 'ask' | 'deny'
  readonly reason?: string
  readonly ruleCount?: number
  readonly defaultAction?: string
  readonly ruleLayer?: {
    readonly action?: 'allow' | 'ask' | 'deny'
    readonly reason?: string
    readonly ruleIndex?: number
    readonly matchedDimensions?: readonly string[]
  }
}

/**
 * The document served by GET /api/dsh-perm-gate/rules: the permissions YAML the
 * gate is loading, plus what it parsed to.
 *
 * `error` is a rendered state, not a transport failure. A missing or
 * uncompilable file is exactly what the operator opened this section to see —
 * a viewer that only worked on healthy input would be useless precisely when it
 * is needed.
 */
interface RulesViewBody {
  readonly path?: string
  readonly exists?: boolean
  readonly bytes?: number
  readonly hash?: string
  readonly lines?: number
  readonly raw?: string
  readonly truncated?: boolean
  readonly defaultAction?: string
  readonly counts?: { readonly allow?: number; readonly deny?: number; readonly ask?: number }
  readonly error?: string
}

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

/** Focus ring for the pill switch. `:focus-visible` cannot be expressed inline, so
 * the one pseudo-class the card needs rides on a single injected rule. */
const switchCss = '.pg-switch:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#3b82f6));outline-offset:2px}.pg-seg:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#3b82f6));outline-offset:1px}'

/**
 * Optimistic control state, shared by the pill switch and the tier picker: show the
 * requested value the instant it is clicked and hold it while the write round-trips
 * through the host settings service, then hand the visual back to the store — on the
 * snapshot catching up, on a rejected write, and on a watchdog for a host line that
 * neither applies nor reports the change. A control may be fast, but it may not lie.
 */
function useOptimistic<T>(stored: T): readonly [T, (next: T, write: () => unknown) => void] {
  const [pending, setPending] = useState<T | null>(null)
  useEffect(() => { setPending((current) => pendingAfterSync(current, stored)) }, [stored])
  useEffect(() => {
    if (pending === null) return undefined
    const timer = setTimeout(() => { setPending(pendingAfterFailure(pending)) }, SWITCH_SETTLE_MS)
    return () => { clearTimeout(timer) }
  }, [pending])
  const commit = (next: T, write: () => unknown): void => {
    setPending(next)
    void Promise.resolve(write()).catch(() => { setPending(null) })
  }
  return [shownValue(pending, stored), commit] as const
}

/**
 * One row of the unattended block: a switch, and the preset it owns.
 *
 * The preset id is rendered next to the label because the mapping is the whole design —
 * one switch, one implementation, one tier — and a person who sees 「机械直通」 in the
 * composer needs to know which row governs it. The id is a machine key, so it stays
 * untranslated on purpose.
 */
function TierRow(props: {
  readonly id: string
  readonly label: string
  readonly preset: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly hint: string
  readonly onCommit: (next: boolean) => unknown
}): JSX.Element {
  const { id, label, preset, checked, disabled, hint, onCommit } = props
  return (
    <>
      <div style={rowStyle}>
        <label htmlFor={id} style={{ fontSize: '12px' }}>
          {label}
          <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: '11px' }}> · {preset}</span>
        </label>
        <PillSwitch
          id={id}
          checked={checked}
          disabled={disabled}
          onCommit={onCommit}
        />
      </div>
      <p style={hintStyle}>{hint}</p>
    </>
  )
}

/**
 * Pill switch — the card's boolean control, cut to the shape of the host's own
 * `ui-primitives` Switch: 36×20 capsule, 16px thumb, and the on/off appearance
 * keyed off `aria-checked` so assistive tech can never read a state the eye does
 * not see.
 *
 * Optimistic by design: the capsule flips on click and holds that position while
 * `scope.set` round-trips through the host settings service. A checkbox that
 * waits for the snapshot to come back reads as a dead control on a slow write.
 * The snapshot stays the truth — the state machine lives in `switch-state.ts`
 * (and under test there) so the pill can never sit in a state the profile does
 * not have.
 *
 * Every colour is a theme token with a fallback: `--dsw-alias-brand-primary`
 * only exists on newer host lines, and an "on" state that resolves to nothing is
 * an invisible control in dark mode.
 */
function PillSwitch(props: {
  readonly id: string
  readonly checked: boolean
  /** Accessible name for rows whose text is not a `<label>` (the host Switch demands one). */
  readonly label?: string | undefined
  readonly disabled?: boolean | undefined
  readonly title?: string | undefined
  readonly onCommit: (next: boolean) => unknown
}): JSX.Element {
  const { id, checked, label, disabled = false, title, onCommit } = props
  const [shown, commit] = useOptimistic<boolean>(checked)
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={shown}
      aria-label={label}
      title={title}
      disabled={disabled}
      className="pg-switch"
      style={{
        boxSizing: 'border-box',
        position: 'relative',
        flex: '0 0 auto',
        width: '36px',
        height: '20px',
        padding: '2px',
        border: '0',
        borderRadius: '999px',
        background: shown
          ? 'var(--dsw-alias-brand-primary, var(--dsw-alias-state-business-primary, #3b82f6))'
          : 'var(--dsw-alias-border-l3, var(--dsw-alias-border-l2, rgba(128,128,128,0.35)))',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms ease',
      }}
      onClick={() => {
        const next = !shown
        commit(next, () => onCommit(next))
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'block',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'var(--dsw-alias-label-primary-foreground, #fff)',
          transform: shown ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 120ms ease',
        }}
      />
    </button>
  )
}

/**
 * A minimal add/remove editor for one string-array setting.
 *
 * Deliberately generic and small: the long-tail protection lists (`credentialPaths`,
 * `denyKeywordsExtra`) are the same shape — lines a person types to protect something
 * the preset cannot know — and they should not each grow their own copy of the row
 * markup the deny blacklist already has.
 */
/**
 * cred family ladder — server-backed rows (`GET/POST /api/dsh-perm-gate/cred`).
 * The rung state lives in TWO stores the plugin owns — the family's row inside the
 * rules document (section + enabled) and the paired `credWriteExemptFamilies` list —
 * so the card must not keep a local mirror; it reads and writes through the route,
 * which applies both stores in one settings update. `readwrite` asks for an inline
 * confirmation: it is the only rung that steps a piece of P0 aside.
 */
const CRED_FAMILIES_UI: readonly (readonly [string, string])[] = [
  ['ssh', 'SSH (~/.ssh)'],
  ['cloud', 'Cloud (.aws/.gcloud/.azure)'],
  ['package', 'Registry (.npmrc/.pypirc/.netrc)'],
  ['gitcreds', 'Git store (.git-credentials)'],
  ['env', 'Project (.env)'],
  ['cli', 'Coding CLI (~/.claude/.codex/gh)'],
  ['db', 'Database (.pgpass/.my.cnf)'],
]
const CRED_RUNGS_UI: readonly string[] = ['deny', 'ask', 'readonly', 'readwrite']
// Literal key map: the locale dictionary is a literal union — a computed
// `card.credRung.${rung}` template widens to string and fails the seat typing.
const CRED_RUNG_LABEL_KEY = {
  deny: 'card.credRung.deny',
  ask: 'card.credRung.ask',
  readonly: 'card.credRung.readonly',
  readwrite: 'card.credRung.readwrite',
} as const

function CredLadderSection(props: { t: PermissiveCardProps['t']; readonly: boolean; onRungs?: (rungs: Record<string, string>) => void }) {
  const { t, readonly } = props
  const [rungs, setRungs] = useState<Record<string, string> | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // Row-scoped error: a failure at the bottom of the section is invisible to the
  // person who just clicked a row — the feedback must sit on the row that failed.
  const [rowError, setRowError] = useState<{ family: string; msg: string } | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/dsh-perm-gate/cred', { headers: { 'cache-control': 'no-cache' } })
      .then((r) => r.json())
      .then((b: { rungs?: Record<string, string> }) => {
        if (alive && b?.rungs !== undefined) {
          setRungs(b.rungs)
          props.onRungs?.(b.rungs)
        }
      })
      .catch(() => { /* route unavailable: the section keeps showing the loading line */ })
    return () => { alive = false }
  }, [])
  const apply = (family: string, rung: string): void => {
    setBusy(family)
    setRowError(null)
    // A hanging POST used to leave the row in silent `busy` forever (desktop webServer
    // body-stream mismatch) — 10s ceiling turns it into a visible, named failure.
    const abort = new AbortController()
    const timer = setTimeout(() => { abort.abort() }, 10_000)
    fetch('/api/dsh-perm-gate/cred', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ family, rung }),
      signal: abort.signal,
    })
      .then((r) => r.json())
      .then((b: { ok?: boolean; rungs?: Record<string, string>; error?: string }) => {
        if (b?.ok === true && b.rungs !== undefined) {
          setRungs(b.rungs)
          props.onRungs?.(b.rungs)
        }
        else setRowError({ family, msg: String(b?.error ?? 'failed') })
      })
      .catch((e: unknown) => {
        const msg = String((e as Error)?.name ?? e) === 'AbortError' ? 'timeout (10s)' : String(e)
        setRowError({ family, msg })
      })
      .finally(() => { clearTimeout(timer); setBusy(null); setConfirm(null) })
  }
  return (
    <section style={sectionStyle}>
      <p style={labelStyle}>{t('card.credFamily')}</p>
      <p style={hintStyle}>{t('card.credFamilyHint')}</p>
      {rungs === null ? (
        <p style={hintStyle}>{t('card.credFamilyLoading')}</p>
      ) : (
        CRED_FAMILIES_UI.map(([family, display]) => (
          <div key={family} style={{ ...rowStyle, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--dsw-alias-label-primary)' }}>{display}</span>
            <span style={{ display: 'inline-flex', gap: '4px' }}>
              {CRED_RUNGS_UI.map((rung) => (
                <button
                  key={rung}
                  type="button"
                  disabled={readonly || busy === family}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    borderRadius: '10px',
                    border: rungs[family] === rung ? '1px solid var(--dsw-alias-primary, #4a90d9)' : '1px solid transparent',
                    background: rungs[family] === rung ? 'rgba(74, 144, 217, 0.15)' : 'transparent',
                  }}
                  onClick={() => {
                    if (rung === 'readwrite' && confirm !== family) { setConfirm(family); return }
                    setConfirm(null)
                    apply(family, rung)
                  }}
                >
                  {t(CRED_RUNG_LABEL_KEY[rung as keyof typeof CRED_RUNG_LABEL_KEY])}
                </button>
              ))}
            </span>
            {confirm === family && (
              <span style={{ width: '100%', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' }}>
                {t('card.credReadwriteConfirm')}
                <button type="button" disabled={busy === family} style={{ fontSize: '11px', marginLeft: '6px' }} onClick={() => apply(family, 'readwrite')}>{t('card.credConfirmYes')}</button>
                <button type="button" style={{ fontSize: '11px', marginLeft: '4px' }} onClick={() => setConfirm(null)}>{t('card.credConfirmNo')}</button>
              </span>
            )}
            {rowError !== null && rowError.family === family && (
              <span style={{ width: '100%', fontSize: '11px', color: 'var(--dsw-alias-danger, #c0392b)' }}>{family}: {rowError.msg}</span>
            )}
          </div>
        ))
      )}
      <p style={hintStyle}>{t('card.credFamilyFootnote')}</p>
    </section>
  )
}

function StringListField(props: {
  readonly label: string
  readonly hint: string
  readonly placeholder: string
  readonly addLabel: string
  readonly removeLabel: string
  readonly items: readonly string[]
  readonly locked: boolean
  readonly onAdd: (value: string) => void
  readonly onRemove: (index: number) => void
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const add = (): void => {
    const next = draft.trim()
    if (next === '') return
    props.onAdd(next)
    setDraft('')
  }
  return (
    <>
      <p style={labelStyle}>{props.label}</p>
      <p style={hintStyle}>{props.hint}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0' }}>
        {props.items.map((item, index) => (
          <div
            key={`${index}:${item}`}
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
              {item}
            </code>
            <button
              type="button"
              aria-label={props.removeLabel}
              title={props.removeLabel}
              disabled={props.locked}
              onClick={() => { props.onRemove(index) }}
              style={{
                flex: '0 0 auto',
                width: '20px',
                height: '20px',
                border: 'none',
                borderRadius: '999px',
                background: 'transparent',
                color: 'var(--dsw-alias-label-tertiary)',
                cursor: props.locked ? 'default' : 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        <input
          type="text"
          value={draft}
          disabled={props.locked}
          placeholder={props.placeholder}
          spellCheck={false}
          style={{ ...controlStyle, flex: '1 1 auto', minWidth: 0 }}
          onChange={(event) => { setDraft(event.currentTarget.value) }}
          onKeyDown={(event) => { if (event.key === 'Enter') add() }}
        />
        <button
          type="button"
          disabled={props.locked || draft.trim() === ''}
          onClick={add}
          style={{ ...controlStyle, flex: '0 0 auto', cursor: props.locked || draft.trim() === '' ? 'default' : 'pointer', opacity: props.locked || draft.trim() === '' ? 0.5 : 1 }}
        >
          {props.addLabel}
        </button>
      </div>
    </>
  )
}

/** Stable snapshot served while the real scope has not resolved yet — the
 * store hook needs a referentially stable object; the diagnostic placeholder
 * renders instead of the card body in that case. */
const EMPTY_SNAPSHOT: { status: string; value: unknown; writable: boolean } = {
  status: 'unavailable',
  value: null,
  writable: false,
}

const drawerGroupStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
  borderRadius: '10px',
  background: 'var(--dsw-alias-bg-surface, transparent)',
  overflow: 'hidden',
}

const drawerHeaderStyle: CSSProperties = {
  appearance: 'none',
  width: '100%',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  background: 'none',
  border: 0,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 12px',
}

const drawerTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--dsw-alias-label-primary)',
  flex: '0 1 auto',
  minWidth: 0,
}

const drawerSummaryStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  textAlign: 'right',
  fontSize: '12px',
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
  overflowWrap: 'anywhere',
}

const drawerBodyStyle: CSSProperties = { padding: '2px 12px 12px' }

/**
 * One denylist row: keyword + remove. `muted` marks built-in preset words —
 * visually quieter, because they are the default rather than a decision the
 * person made (they live inside the collapsed built-ins sublist).
 */
function DenyRow(props: {
  readonly keyword: string
  readonly index: number
  readonly muted: boolean
  readonly locked: boolean
  readonly removeLabel: string
  readonly onRemove: (index: number) => void
}): JSX.Element {
  const { keyword, index, muted, locked, removeLabel, onRemove } = props
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      borderRadius: '6px',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-surface, transparent)',
    }}>
      <code style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere', font: '500 12px/18px var(--ds-font-family-code, monospace)', color: muted ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-label-primary)' }}>
        {keyword}
      </code>
      <button
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
        disabled={locked}
        onClick={() => { onRemove(index) }}
        style={{
          flex: '0 0 auto',
          width: '20px',
          height: '20px',
          border: 'none',
          borderRadius: '999px',
          background: 'transparent',
          color: 'var(--dsw-alias-label-tertiary)',
          cursor: locked ? 'default' : 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}

/**
 * One collapsible group inside the settings card.
 *
 * The card body is cut into titled drawers so the front switch and the preset
 * scope note stay first-screen while every block (tiers / strategies / testing
 * / lists / credentials / network) folds behind a header. The header always
 * shows a live state summary — a drawer communicates what it is doing without
 * being opened, mirroring the outer disclosure pattern this card already uses
 * (and the multi-group precedent in thinking-levels' card).
 *
 * `onFirstOpen` fires once, on the first expansion: groups whose content costs
 * a fetch (the rules viewer) load lazily instead of on mount.
 */
function DrawerGroup(props: {
  readonly id: string
  readonly title: string
  readonly summary?: string | undefined
  readonly onFirstOpen?: (() => void) | undefined
  readonly children: ReactNode
}): JSX.Element {
  const { id, title, summary, onFirstOpen, children } = props
  const [open, setOpen] = useState(false)
  const firedRef = useRef(false)
  const toggle = (): void => {
    const next = !open
    setOpen(next)
    if (next && onFirstOpen !== undefined && !firedRef.current) {
      firedRef.current = true
      onFirstOpen()
    }
  }
  return (
    <section style={drawerGroupStyle}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={toggle} style={drawerHeaderStyle}>
        <svg
          width="14" height="14" viewBox="0 0 16 16" aria-hidden
          style={{
            color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
            flex: '0 0 auto',
            transition: 'transform 0.16s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={drawerTitleStyle}>{title}</span>
        {summary !== undefined && summary !== ''
          ? <span style={drawerSummaryStyle}>{summary}</span>
          : <span aria-hidden style={{ flex: '1 1 auto' }} />}
      </button>
      {open
        ? <div id={id} style={drawerBodyStyle}>{children}</div>
        : null}
    </section>
  )
}

/**
 * The card body, wrapped in a disclosure shell like every peer settings card:
 * a header (name + description + chevron) toggling the body. The body keeps
 * the front switch and the preset-scope note first-screen, then cuts the rest
 * into six titled drawers (see DrawerGroup) so the page reads as a short
 * index with live summaries instead of one long form.
 */
export function PermissiveCard({ t, scope }: PermissiveCardProps): JSX.Element {
  const [open, setOpen] = useState(true)
  // 首次使用引导：本地标记持久化；设置面上方的「重新查看引导」清标记就地重开。
  const [guideOpen, setGuideOpen] = useState(() => !isGuideSkipped('perm-gate'))
  // The api key is kept OUT of the visible value (secret): a fresh typed draft
  // overwrites on blur; an already-set key shows only a masked placeholder.
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  // Whitelist draft (one pattern per line); `allowDirty` avoids clobbering user
  // edits when the host re-seeds the namespace after mount.
  const [allowText, setAllowText] = useState('')
  const [allowDirty, setAllowDirty] = useState(false)
  const snapshot = useSyncExternalStore(
    scope
      ? (listener) => scope.subscribe(listener)
      : (listener) => { void listener; return () => {} },
    () => (scope ? scope.getSnapshot() : EMPTY_SNAPSHOT),
  )
  const unavailable = snapshot.status === 'unavailable'
  const readonly = unavailable || !snapshot.writable
  const raw = (snapshot.value ?? {}) as Record<string, unknown>
  // 形状防御（T13b 桥轨实测）：宿主各线的 settings 值可能残留非数组形态的
  // 列表字段（0.1.5 installSection base=resolved config，deployment patch 里
  // 的历史 allowlist:{} 透传到 value），卡片只认 string[]——非数组一律按空
  // 处理，用户在卡里保存一次即写回正确形态。
  const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const value = {
    ...raw,
    allowlist: listOf(raw.allowlist),
    denyKeywords: listOf(raw.denyKeywords),
    denyKeywordsExtra: listOf(raw.denyKeywordsExtra),
    denyKeywordExemptTools: listOf(raw.denyKeywordExemptTools),
    credentialPaths: listOf(raw.credentialPaths),
    extraContentArgKeys: listOf(raw.extraContentArgKeys),
    extraOperationArgKeys: listOf(raw.extraOperationArgKeys),
    autoAllowTools: listOf(raw.autoAllowTools),
  } as unknown as Partial<PermissiveCardValue>
  const strategies = value.permissiveStrategies ?? {}
  const hasApiKey = typeof value.classifierApiKey === 'string' && value.classifierApiKey !== ''

  // The backend strategy toggles only take effect while the tier is on.
  const effective = value.permissive === true

  // The presets the gate acts in at all — outside them the whole gate stands down.
  const gateScope = (value.gatePresets ?? []).length > 0 ? (value.gatePresets as string[]) : [...DEFAULT_GATE_PRESETS]

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
  // Rule-test (dry-run) state: the call to try and its report. Read-only — the
  // panel never writes a rule, so "test first" cannot itself change the ruleset.
  const [dryTool, setDryTool] = useState('shell')
  const [dryCommand, setDryCommand] = useState('')
  const [dryBusy, setDryBusy] = useState(false)
  const [dryReport, setDryReport] = useState<DryRunReport | null>(null)
  const [dryError, setDryError] = useState<string | null>(null)
  const runDryRunTest = (): void => {
    const tool = dryTool.trim() === '' ? 'shell' : dryTool.trim()
    const command = dryCommand.trim()
    setDryBusy(true)
    setDryError(null)
    setDryReport(null)
    // A shell call is described by its `command`; any other tool's arguments are
    // not expressible in one line, so the panel honestly tests the empty form.
    const args: Record<string, unknown> = command === '' ? {} : { command }
    fetch('/api/dsh-perm-gate/dry-run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tool, args }),
    })
      .then(async (r) => {
        const text = await r.text()
        if (r.status === 404) throw new Error(t('card.dryRunStale'))
        try {
          return JSON.parse(text) as { ok?: boolean; result?: DryRunReport; error?: string }
        } catch {
          throw new Error(text.trim().slice(0, 120) !== '' ? text.trim().slice(0, 120) : `HTTP ${r.status}`)
        }
      })
      .then((res) => {
        if (res.ok === true && res.result !== undefined) setDryReport(res.result)
        else setDryError(res.error ?? t('card.dryRunFail'))
      })
      .catch((e: unknown) => { setDryError(String((e as Error)?.message ?? e)) })
      .finally(() => { setDryBusy(false) })
  }
  // Permissions YAML (read-only): the document the gate is actually loading, so
  // the panel can never be editing a file it cannot display. Loaded on mount —
  // a viewer you have to ask to load is one more reason not to look.
  const [rulesBody, setRulesBody] = useState<RulesViewBody | null>(null)
  const [rulesBusy, setRulesBusy] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const loadRules = (): void => {
    setRulesBusy(true)
    setRulesError(null)
    fetch('/api/dsh-perm-gate/rules', { headers: { 'cache-control': 'no-cache' } })
      .then(async (r) => {
        const text = await r.text()
        if (r.status === 404) throw new Error(t('card.rulesStale'))
        try {
          return JSON.parse(text) as { ok?: boolean; result?: RulesViewBody; error?: string }
        } catch {
          throw new Error(text.trim().slice(0, 120) !== '' ? text.trim().slice(0, 120) : `HTTP ${r.status}`)
        }
      })
      .then((res) => {
        if (res.ok === true && res.result !== undefined) setRulesBody(res.result)
        else setRulesError(res.error ?? t('card.rulesError'))
      })
      .catch((e: unknown) => { setRulesError(String((e as Error)?.message ?? e)) })
      .finally(() => { setRulesBusy(false) })
  }
  // Rules load lazily: the testing drawer's `onFirstOpen` triggers the first
  // fetch, so a person who never opens diagnostics never pays the request.
  // (The refresh button inside the drawer re-fetches any time.)
  // Receiver introspection: the live provider/model-group catalog (host mode)
  // and the provider/model the gate will actually use right now.
  const receiverSource = (value.classifierSource ?? 'custom') === 'host' ? 'host' : 'custom'
  const [receiverInfo, setReceiverInfo] = useState<ReceiverInfoBody | null>(null)
  const [receiverNonce, setReceiverNonce] = useState(0)
  useEffect(() => {
    let alive = true
    fetch('/api/dsh-perm-gate/receiver', { headers: { 'cache-control': 'no-cache' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ReceiverInfoBody) => { if (alive) setReceiverInfo(data) })
      .catch(() => { if (alive) setReceiverInfo(null) })
    return () => { alive = false }
  }, [receiverSource, receiverNonce])
  const receiverProviderDraft = value.classifierProvider ?? ''
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

  // Denylist split: the built-in preset words fold into a collapsed sublist
  // (they dominate the row count and are the ones a person rarely edits);
  // custom words and the add row stay visible. Indexes stay bound to the
  // combined `denylist` array so removeDeny keeps one code path.
  const [presetDenyOpen, setPresetDenyOpen] = useState(false)
  const denyPairs = denylist.map((keyword, index) => ({
    keyword,
    index,
    preset: (DEFAULT_DENY_KEYWORDS as readonly string[]).includes(keyword),
  }))
  const customDeny = denyPairs.filter((pair) => !pair.preset)
  const presetDeny = denyPairs.filter((pair) => pair.preset)

  // Credential-family rungs arrive from CredLadderSection's own fetch (and its
  // POST round-trips); the readwrite count surfaces in the credentials drawer
  // summary — a rung that steps a piece of P0 aside is worth seeing without
  // opening the drawer.
  const [credRwCount, setCredRwCount] = useState<number | null>(null)
  const handleCredRungs = (rungs: Record<string, string>): void => {
    setCredRwCount(Object.values(rungs).filter((rung) => rung === 'readwrite').length)
  }

  // Drawer summaries: live projections of the snapshot, so each header states
  // what its block is currently doing without being opened.
  const enabledTiers = [
    ...(value.yolo === true ? ['YOLO'] : []),
    ...(value.safenetPass !== false ? [t('card.mode.pass')] : []),
    ...(value.safenetAsk === true ? [t('card.mode.ask')] : []),
  ]
  const tiersSummary = enabledTiers.length > 0 ? enabledTiers.join(' · ') : t('card.summaryNone')
  const enabledStrategies = [
    strategies.trustAutoAllow ?? true,
    strategies.alwaysConfirm ?? false,
    strategies.llmAssist ?? false,
    strategies.trustEscalation ?? true,
  ].filter((flag) => flag === true).length
  const strategiesSummary = (enabledStrategies === 0
    ? t('card.summaryNone')
    : t('card.summaryStrategies').replace('%n', String(enabledStrategies)))
    + (strategies.llmAssist === true ? ' · llmAssist' : '')
  const listsSummary = t('card.summaryLists')
    .replace('%a', String(patterns.length + (value.autoAllowTools ?? []).length))
    .replace('%d', String((denyActive ? denylist.length : 0) + (value.denyKeywordsExtra ?? []).length))
  const credSummary = credRwCount === null
    ? undefined
    : t('card.summaryCredRw').replace('%n', String(credRwCount))
  const networkSummary = t('card.summaryNetwork')
    .replace('%net', value.networkEnabled === true ? t('card.summaryOn') : t('card.summaryOff'))
    .replace('%w', value.watch !== false ? t('card.summaryOn') : t('card.summaryOff'))

  // 诊断守卫（2026-10-07 立项；2026-11-22 改为 hook 稳定形态）：scope 未解析时
  // 不能在 render 里炸——宿主设置壳对内容槽异常静默吞（面板空白无报错），守卫
  // 让面板显式出占位文案，把「渲染了但 scope 没到」与「没渲染」分开。守卫放在
  // 全部 hooks 之后：提前 return 会跳过下方 hooks，scope 到位后 hook 数漂移
  // （React 违例）；上方 store 钩子在 scope 缺席时回落 EMPTY_SNAPSHOT。
  if (!scope) {
    return <div style={{ padding: 16, color: 'var(--dsw-alias-label-tertiary, #888)' }}>
      {t('card.unavailable')}{t('card.scopeUnresolved')}
    </div>
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
                  <style>{switchCss}</style>
                  {/* 引导重启入口放在设置面上方：跳过之后想重新看贴士，不必滚到卡底。 */}
                  <p style={{ margin: '0 0 10px' }}>
                    <GuideRestartButton ns="perm-gate" onOpen={() => { setGuideOpen(true) }} />
                  </p>
                  {guideOpen
                    ? (
                      <GuidePanel
                        ns="perm-gate"
                        steps={guideSteps(PERM_GATE_GUIDE_STEPS)}
                        onClose={() => { setGuideOpen(false) }}
                      />
                    )
                    : null}
                  <div style={rowStyle}>
                    <label htmlFor="plugin-config-perm-gate-permissive" style={labelStyle}>{t('card.permissive')}</label>
                    <PillSwitch
                      id="plugin-config-perm-gate-permissive"
                      checked={effective}
                      disabled={readonly}
                      onCommit={(next) => scope.set('permissive', next)}
                    />
                  </div>
                  <p style={hintStyle}>{t('card.permissiveHint')}</p>
                  {/* The gate's own scope: outside these presets the WHOLE gate
                      stands down, P0 hard-deny included (see the stand-down note
                      in src/runtime.ts). Stated here because the settings card is
                      where the tier is configured, and a silent stand-down would
                      otherwise look like a gate that approved the call. */}
                  <p style={hintStyle}>
                    {t('card.scopeNote').replace('%scope', gateScope.join(' / '))}
                  </p>

                  {/* Six titled drawers (DrawerGroup): each header carries a live state
                      summary, and the testing drawer lazy-loads the rules viewer on
                      first expansion. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  {/* Each unattended implementation owns one preset and one switch, so the
                      rows below cannot cross: a switch changes the behaviour of the tier
                      named beside it and of no other. Script review is independent of all
                      of them and on by default. */}
                  <DrawerGroup id="pg-drawer-unattended" title={t('card.unattended')} summary={tiersSummary}>
                    <p style={hintStyle}>{t('card.unattendedHint')}</p>
                    <TierRow
                      id="plugin-config-perm-gate-yolo"
                      label={t('card.yolo')}
                      preset="permissive-yolo"
                      checked={value.yolo === true}
                      disabled={readonly}
                      hint={t('card.yoloHint')}
                      onCommit={(next) => scope.set('yolo', next)}
                    />
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-yolo-exempt" style={{ fontSize: '12px' }}>
                        {t('card.yoloExempt')}
                      </label>
                      <PillSwitch
                        id="plugin-config-perm-gate-yolo-exempt"
                        checked={value.yoloWorkspaceExempt === true}
                        disabled={readonly}
                        onCommit={(next) => scope.set('yoloWorkspaceExempt', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.yoloExemptHint')}</p>
                    <TierRow
                      id="plugin-config-perm-gate-safenet-pass"
                      label={t('card.mode.pass')}
                      preset="permissive-mech"
                      checked={value.safenetPass !== false}
                      disabled={readonly}
                      hint={t('card.passHint')}
                      onCommit={(next) => scope.set('safenetPass', next)}
                    />
                    <TierRow
                      id="plugin-config-perm-gate-safenet-ask"
                      label={t('card.mode.ask')}
                      preset="permissive-snet"
                      checked={value.safenetAsk === true}
                      disabled={readonly}
                      hint={t('card.askHint')}
                      onCommit={(next) => scope.set('safenetAsk', next)}
                    />
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-rules-fallback" style={{ fontSize: '12px' }}>{t('card.rulesFallback')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-rules-fallback"
                        checked={value.rulesFallback === true}
                        disabled={readonly}
                        onCommit={(next) => scope.set('rulesFallback', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.rulesFallbackHint')}</p>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-allow-protected-push" style={{ fontSize: '12px' }}>{t('card.allowProtectedBranchPush')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-allow-protected-push"
                        checked={value.allowProtectedBranchPush === true}
                        disabled={readonly}
                        onCommit={(next) => scope.set('allowProtectedBranchPush', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.allowProtectedBranchPushHint')}</p>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-script-review" style={{ fontSize: '12px' }}>{t('card.scriptReview')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-script-review"
                        checked={value.scriptReview !== false}
                        disabled={readonly}
                        onCommit={(next) => scope.set('scriptReview', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.scriptReviewHint')}</p>
                  </DrawerGroup>

                  <DrawerGroup id="pg-drawer-strategies" title={t('card.strategies')} summary={strategiesSummary}>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-trust" style={{ fontSize: '12px' }}>{t('card.strategy.trustAutoAllow')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-trust"
                        checked={strategies.trustAutoAllow ?? true}
                        disabled={readonly || !effective}
                        onCommit={(next) => scope.set('permissiveStrategies', { ...strategies, trustAutoAllow: next })}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-confirm" style={{ fontSize: '12px' }}>{t('card.strategy.alwaysConfirm')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-confirm"
                        checked={strategies.alwaysConfirm ?? false}
                        disabled={readonly || !effective}
                        onCommit={(next) => scope.set('permissiveStrategies', { ...strategies, alwaysConfirm: next })}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-llm" style={{ fontSize: '12px' }}>{t('card.strategy.llmAssist')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-llm"
                        checked={strategies.llmAssist ?? false}
                        disabled={readonly || !effective}
                        onCommit={(next) => scope.set('permissiveStrategies', { ...strategies, llmAssist: next })}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-escalation" style={{ fontSize: '12px' }}>{t('card.strategy.trustEscalation')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-escalation"
                        checked={strategies.trustEscalation ?? true}
                        disabled={readonly || !effective}
                        onCommit={(next) => scope.set('permissiveStrategies', { ...strategies, trustEscalation: next })}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.strategy.trustEscalationHint')}</p>
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
                                      const v = event.currentTarget.value
                                      if (v.startsWith('host:')) {
                                        // A DSH model group: switch to the host receiver
                                        // and pin the provider (model follows the session).
                                        void scope.set('classifierSource', 'host')
                                        void scope.set('classifierProvider', v.slice('host:'.length))
                                        return
                                      }
                                      const preset = LLM_PRESETS.find((p) => p.id === v)
                                      if (preset !== undefined) {
                                        void scope.set('classifierEndpoint', preset.endpoint)
                                        void scope.set('classifierModel', preset.model)
                                      }
                                    }}
                                  >
                                    <option value="">{t('card.llmPresetChoose')}</option>
                                    <optgroup label={t('card.llmPresetPublic')}>
                                      {LLM_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.id}>{preset.label}</option>
                                      ))}
                                    </optgroup>
                                    {(receiverInfo?.providers ?? []).length > 0
                                      ? (
                                          <optgroup label={t('card.llmPresetHost')}>
                                            {(receiverInfo?.providers ?? []).map((p) => (
                                              <option key={`host:${p.id}`} value={`host:${p.id}`}>
                                                {`${t('card.llmSourceHost')} · ${p.id}`}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )
                                        : null}
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
                                    list="perm-gate-provider-options"
                                    value={value.classifierProvider ?? ''}
                                    disabled={readonly}
                                    placeholder={t('card.llmProviderPlaceholder')}
                                    style={controlStyle}
                                    onChange={(event) => { void scope.set('classifierProvider', event.currentTarget.value) }}
                                    onBlur={(event) => {
                                      if (event.currentTarget.value.trim() === '') void scope.unset('classifierProvider')
                                    }}
                                  />
                                  <datalist id="perm-gate-provider-options">
                                    {(receiverInfo?.providers ?? []).map((p) => (
                                      <option key={p.id} value={p.id}>{p.name}{p.error !== undefined ? ` (${p.error})` : ''}</option>
                                    ))}
                                  </datalist>
                                </label>
                                {receiverInfo?.selection !== null && receiverInfo?.selection !== undefined
                                  ? (
                                      <span style={hintStyle}>
                                        {t('card.llmResolved')
                                          .replace('%p', receiverInfo.selection.provider)
                                          .replace('%m', receiverInfo.selection.model)}
                                      </span>
                                    )
                                    : null}
                              </>
                            )}
                          <label style={fieldStyle}>
                            <span style={fieldLabelStyle}>{t('card.llmModel')}</span>
                            <input
                              type="text"
                              list={receiverSource === 'host' ? 'perm-gate-model-options' : undefined}
                              value={value.classifierModel ?? ''}
                              disabled={readonly}
                              placeholder={receiverSource === 'host' ? t('card.llmModelHostPlaceholder') : 'deepseek-chat'}
                              style={controlStyle}
                              onChange={(event) => { void scope.set('classifierModel', event.currentTarget.value) }}
                              onBlur={(event) => {
                                if (event.currentTarget.value.trim() === '') void scope.unset('classifierModel')
                              }}
                            />
                            <datalist id="perm-gate-model-options">
                              {(receiverInfo?.providers ?? [])
                                .filter((p) => receiverProviderDraft === '' || p.id === receiverProviderDraft)
                                .flatMap((p) => p.models)
                                .map((m) => <option key={`${m.id}`} value={m.id}>{m.name}</option>)}
                            </datalist>
                          </label>
                          <label style={fieldStyle}>
                            <span style={fieldLabelStyle}>{t('card.llmEffort')}</span>
                            <select
                              value={value.classifierEffort ?? ''}
                              disabled={readonly || receiverSource !== 'host'}
                              style={controlStyle}
                              title={t('card.llmEffortHint')}
                              onChange={(event) => { void scope.set('classifierEffort', event.currentTarget.value) }}
                            >
                              <option value="">{t('card.llmEffortHost')}</option>
                              <option value="off">off</option>
                              <option value="low">low</option>
                              <option value="medium">medium</option>
                              <option value="high">high</option>
                            </select>
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
                                // The dsh webServer rejects bodyless POSTs, so send a
                                // JSON envelope; parse defensively either way.
                                fetch('/api/dsh-perm-gate/health', {
                                  method: 'POST',
                                  headers: { 'content-type': 'application/json' },
                                  body: '{}',
                                })
                                  .then(async (r) => {
                                    const text = await r.text()
                                    if (r.status === 404) throw new Error(t('card.healthStale'))
                                    try {
                                      return JSON.parse(text) as { ok?: boolean; ms?: number; detail?: string; error?: string }
                                    } catch {
                                      throw new Error(text.trim().slice(0, 120) !== '' ? text.trim().slice(0, 120) : `HTTP ${r.status}`)
                                    }
                                  })
                                  .then((res) => {
                                    setHealthResult(res.ok === true && typeof res.ms === 'number'
                                      ? t('card.healthOk').replace('%ms', String(res.ms)) + (typeof res.detail === 'string' ? ` · ${res.detail}` : '')
                                      : t('card.healthFail') + (res.detail ?? res.error ?? 'unknown'))
                                    setReceiverNonce((n) => n + 1)
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
                            <PillSwitch
                              id="plugin-config-perm-gate-risk-learning"
                              checked={value.riskLearning ?? false}
                              disabled={readonly || !effective}
                              onCommit={(next) => scope.set('riskLearning', next)}
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
                                  <PillSwitch
                                    id="plugin-config-perm-gate-risk-sediment"
                                    checked={value.riskSediment ?? true}
                                    disabled={readonly || !effective}
                                    onCommit={(next) => scope.set('riskSediment', next)}
                                  />
                                </div>
                                <p style={hintStyle}>{t('card.riskSedimentHint')}</p>
                                <div style={rowStyle}>
                                  <label htmlFor="plugin-config-perm-gate-learning-scope" style={{ fontSize: '12px' }}>{t('card.learningScope')}</label>
                                  <select
                                    id="plugin-config-perm-gate-learning-scope"
                                    value={value.learningScope ?? 'global'}
                                    disabled={readonly || !effective}
                                    style={{ ...controlStyle, width: '180px' }}
                                    onChange={(event) => {
                                      const next = event.currentTarget.value === 'session' ? 'session' : 'global'
                                      void scope.set('learningScope', next)
                                    }}
                                  >
                                    <option value="global">{t('card.learningScopeGlobal')}</option>
                                    <option value="session">{t('card.learningScopeSession')}</option>
                                  </select>
                                </div>
                                <p style={hintStyle}>{t('card.learningScopeHint')}</p>
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
                  </DrawerGroup>

                  <DrawerGroup id="pg-drawer-testing" title={t('card.testing')} onFirstOpen={loadRules}>
                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('attention.title')}</p>
                    <p style={hintStyle}>{t('attention.hint')}</p>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-attention-toast" style={{ fontSize: '12px' }}>{t('attention.toast')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-attention-toast"
                        checked={value.attentionToast ?? true}
                        disabled={readonly || !effective}
                        onCommit={(next) => scope.set('attentionToast', next)}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-attention-sound" style={{ fontSize: '12px' }}>{t('attention.sound')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-attention-sound"
                        checked={value.attentionSound ?? false}
                        disabled={readonly || !effective}
                        onCommit={(next) => scope.set('attentionSound', next)}
                      />
                    </div>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-attention-gap" style={{ fontSize: '12px' }}>{t('attention.gap')}</label>
                      <input
                        id="plugin-config-perm-gate-attention-gap"
                        type="number"
                        min={0}
                        max={600000}
                        step={5000}
                        value={value.attentionMinGapMs ?? 30000}
                        disabled={readonly || !effective}
                        style={{ ...controlStyle, width: '110px' }}
                        onChange={(event) => {
                          const n = Number.parseInt(event.currentTarget.value, 10)
                          if (Number.isFinite(n) && n >= 0) void scope.set('attentionMinGapMs', n)
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={readonly || !effective}
                      style={{ ...controlStyle, marginTop: '6px', cursor: 'pointer' }}
                      onClick={() => { try { chime() } catch { /* silence */ } }}
                    >
                      {t('attention.test')}
                    </button>
                  </section>
                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('card.dryRun')}</p>
                    <p style={hintStyle}>{t('card.dryRunHint')}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end', margin: '6px 0' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '0 0 120px' }}>
                        <span style={fieldLabelStyle}>{t('card.dryRunTool')}</span>
                        <input
                          type="text"
                          value={dryTool}
                          disabled={readonly}
                          placeholder="shell"
                          onChange={(e) => { setDryTool(e.target.value) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') runDryRunTest() }}
                          style={controlStyle}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 260px', minWidth: 0 }}>
                        <span style={fieldLabelStyle}>{t('card.dryRunCommand')}</span>
                        <input
                          type="text"
                          value={dryCommand}
                          disabled={readonly}
                          placeholder={t('card.dryRunCommandPlaceholder')}
                          onChange={(e) => { setDryCommand(e.target.value) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') runDryRunTest() }}
                          style={controlStyle}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={readonly || dryBusy}
                        onClick={runDryRunTest}
                        style={{ ...controlStyle, flex: '0 0 auto', cursor: readonly || dryBusy ? 'default' : 'pointer' }}
                      >
                        {dryBusy ? t('card.dryRunRunning') : t('card.dryRunTest')}
                      </button>
                    </div>
                    {dryError !== null && (
                      <p style={{ ...hintStyle, color: 'var(--dsw-alias-label-error, #c0392b)' }}>{t('card.dryRunFail')}{dryError}</p>
                    )}
                    {dryReport === null
                      ? (dryError === null && <p style={hintStyle}>{t('card.dryRunEmpty')}</p>)
                      : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--dsw-alias-border-l2)',
                              background: 'var(--dsw-alias-bg-surface, transparent)',
                              fontSize: '12px',
                              lineHeight: '18px',
                            }}
                          >
                            {/* The verdict badge: colour carries the same meaning as the word. */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={fieldLabelStyle}>{t('card.dryRunVerdict')}</span>
                              {(() => {
                                const verdict = dryReport.verdict ?? 'ask'
                                const colour = verdict === 'deny'
                                  ? 'var(--dsw-alias-label-error, #c0392b)'
                                  : verdict === 'allow'
                                    ? 'var(--dsw-alias-label-success, #2e7d32)'
                                    : 'var(--dsw-alias-label-warning, #b26a00)'
                                const text = verdict === 'deny'
                                  ? t('card.dryRunDeny')
                                  : verdict === 'allow' ? t('card.dryRunAllow') : t('card.dryRunAsk')
                                return <strong style={{ color: colour }}>{text}</strong>
                              })()}
                              {(dryReport.ruleCount ?? 0) === 0 && (
                                <span style={{ color: 'var(--dsw-alias-label-secondary, inherit)' }}>{t('card.dryRunNoRules')}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', overflowWrap: 'anywhere' }}>
                              <span style={fieldLabelStyle}>{t('card.dryRunRule')}</span>
                              <code style={{ font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                                {dryReport.ruleLayer?.ruleIndex === undefined
                                  ? t('card.dryRunRuleNone').replace('%d', dryReport.defaultAction ?? 'ask')
                                  : `#${dryReport.ruleLayer.ruleIndex} (${dryReport.ruleLayer.action ?? '?'})`}
                              </code>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', overflowWrap: 'anywhere' }}>
                              <span style={fieldLabelStyle}>{t('card.dryRunDimensions')}</span>
                              <code style={{ font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                                {(dryReport.ruleLayer?.matchedDimensions ?? []).length === 0
                                  ? '—'
                                  : (dryReport.ruleLayer?.matchedDimensions ?? []).join(', ')}
                              </code>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', overflowWrap: 'anywhere' }}>
                              <span style={fieldLabelStyle}>{t('card.dryRunReason')}</span>
                              <span style={{ color: 'var(--dsw-alias-label-secondary, inherit)' }}>{dryReport.reason ?? ''}</span>
                            </div>
                            <p style={{ ...hintStyle, margin: 0 }}>{t('card.dryRunNote')}</p>
                          </div>
                        )}
                  </section>

                  <section style={sectionStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <p style={labelStyle}>{t('card.rules')}</p>
                      <button
                        type="button"
                        disabled={rulesBusy}
                        onClick={loadRules}
                        style={{ ...controlStyle, flex: '0 0 auto', cursor: rulesBusy ? 'default' : 'pointer' }}
                      >
                        {rulesBusy ? t('card.rulesLoading') : t('card.rulesRefresh')}
                      </button>
                    </div>
                    <p style={hintStyle}>{t('card.rulesHint')}</p>

                    <div style={{ display: 'flex', gap: '8px', overflowWrap: 'anywhere', marginTop: '6px' }}>
                      <span style={fieldLabelStyle}>{t('card.rulesPath')}</span>
                      <code style={{ font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                        {rulesBody?.path !== undefined && rulesBody.path !== '' ? rulesBody.path : t('card.rulesNone')}
                      </code>
                    </div>

                    {rulesError !== null && (
                      <p style={{ ...hintStyle, color: 'var(--dsw-alias-label-error, #c0392b)' }}>{t('card.rulesError')}{rulesError}</p>
                    )}

                    {rulesBody !== null && (
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                          <span>
                            <span style={fieldLabelStyle}>{t('card.rulesCounts')} </span>
                            <code style={{ font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                              {`deny ${rulesBody.counts?.deny ?? 0} · allow ${rulesBody.counts?.allow ?? 0} · ask ${rulesBody.counts?.ask ?? 0}`}
                            </code>
                          </span>
                          {rulesBody.defaultAction !== undefined && (
                            <span>
                              <span style={fieldLabelStyle}>{t('card.rulesDefault')} </span>
                              <code style={{ font: '500 12px/18px var(--ds-font-family-code, monospace)', color: 'var(--dsw-alias-label-primary)' }}>
                                {rulesBody.defaultAction}
                              </code>
                            </span>
                          )}
                          <span style={fieldLabelStyle}>
                            {t('card.rulesStats')
                              .replace('%b', String(rulesBody.bytes ?? 0))
                              .replace('%l', String(rulesBody.lines ?? 0))}
                          </span>
                        </div>

                        {/* Why the document did not load or did not compile. The text below is still shown. */}
                        {rulesBody.error !== undefined && (
                          <p style={{ ...hintStyle, color: 'var(--dsw-alias-label-error, #c0392b)' }}>{rulesBody.error}</p>
                        )}
                        {rulesBody.exists === false && <p style={hintStyle}>{t('card.rulesMissing')}</p>}
                        {rulesBody.truncated === true && <p style={hintStyle}>{t('card.rulesTruncated')}</p>}

                        {(rulesBody.raw ?? '') !== '' && (
                          <pre
                            style={{
                              margin: '6px 0 0',
                              padding: '8px 10px',
                              maxHeight: '260px',
                              overflow: 'auto',
                              borderRadius: '6px',
                              border: '1px solid var(--dsw-alias-border-l2)',
                              background: 'var(--dsw-alias-bg-surface, transparent)',
                              font: '500 12px/18px var(--ds-font-family-code, monospace)',
                              color: 'var(--dsw-alias-label-primary)',
                              whiteSpace: 'pre',
                            }}
                          >
                            {rulesBody.raw}
                          </pre>
                        )}
                        <p style={{ ...hintStyle, margin: 0 }}>{t('card.rulesNote')}</p>
                      </>
                    )}
                  </section>
                  </DrawerGroup>

                  <DrawerGroup id="pg-drawer-lists" title={t('card.lists')} summary={listsSummary}>
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

                  {/* User-classified safe tool names: same auto-allow treatment as
                      READ_TOOLS (path rules still consulted, P0 hard-deny still fires). */}
                  <section style={sectionStyle}>
                    <StringListField
                      label={t('card.autoAllowTools')}
                      hint={t('card.autoAllowToolsHint')}
                      placeholder={t('card.autoAllowToolsPlaceholder')}
                      addLabel={t('card.denylistAdd')}
                      removeLabel={t('card.listRemove')}
                      items={value.autoAllowTools ?? []}
                      locked={readonly}
                      onAdd={(entry) => { void scope.set('autoAllowTools', [...(value.autoAllowTools ?? []), entry]) }}
                      onRemove={(index) => { void scope.set('autoAllowTools', (value.autoAllowTools ?? []).filter((_, i) => i !== index)) }}
                    />
                  </section>
                  <section style={sectionStyle}>
                    <StringListField
                      label={t('card.denyKeywordsExtra')}
                      hint={t('card.denyKeywordsExtraHint')}
                      placeholder={t('card.denylistPlaceholder')}
                      addLabel={t('card.denylistAdd')}
                      removeLabel={t('card.listRemove')}
                      items={value.denyKeywordsExtra ?? []}
                      locked={readonly}
                      onAdd={(entry) => { void scope.set('denyKeywordsExtra', [...(value.denyKeywordsExtra ?? []), entry]) }}
                      onRemove={(index) => { void scope.set('denyKeywordsExtra', (value.denyKeywordsExtra ?? []).filter((_, i) => i !== index)) }}
                    />
                    <div style={{ height: '10px' }} />
                    {/* issue #11: code-mode wrappers (e.g. run_code) carry other tools' document
                        text, so a keyword hit on that prose was a false positive. These tool names
                        skip ONLY the blacklist layer — P0, the credential screen and deny rules run. */}
                    <StringListField
                      label={t('card.denyKeywordExemptTools')}
                      hint={t('card.denyKeywordExemptToolsHint')}
                      placeholder={t('card.denyKeywordExemptToolsPlaceholder')}
                      addLabel={t('card.denylistAdd')}
                      removeLabel={t('card.listRemove')}
                      items={value.denyKeywordExemptTools ?? []}
                      locked={readonly}
                      onAdd={(entry) => { void scope.set('denyKeywordExemptTools', [...(value.denyKeywordExemptTools ?? []), entry]) }}
                      onRemove={(index) => { void scope.set('denyKeywordExemptTools', (value.denyKeywordExemptTools ?? []).filter((_, i) => i !== index)) }}
                    />
                    <div style={{ height: '10px' }} />
                    <StringListField
                      label={t('card.extraContentArgKeys')}
                      hint={t('card.extraContentArgKeysHint')}
                      placeholder={t('card.extraContentArgKeysPlaceholder')}
                      addLabel={t('card.denylistAdd')}
                      removeLabel={t('card.listRemove')}
                      items={value.extraContentArgKeys ?? []}
                      locked={readonly}
                      onAdd={(entry) => { void scope.set('extraContentArgKeys', [...(value.extraContentArgKeys ?? []), entry]) }}
                      onRemove={(index) => { void scope.set('extraContentArgKeys', (value.extraContentArgKeys ?? []).filter((_, i) => i !== index)) }}
                    />
                    <div style={{ height: '10px' }} />
                    <StringListField
                      label={t('card.extraOperationArgKeys')}
                      hint={t('card.extraOperationArgKeysHint')}
                      placeholder={t('card.extraContentArgKeysPlaceholder')}
                      addLabel={t('card.denylistAdd')}
                      removeLabel={t('card.listRemove')}
                      items={value.extraOperationArgKeys ?? []}
                      locked={readonly}
                      onAdd={(entry) => { void scope.set('extraOperationArgKeys', [...(value.extraOperationArgKeys ?? []), entry]) }}
                      onRemove={(index) => { void scope.set('extraOperationArgKeys', (value.extraOperationArgKeys ?? []).filter((_, i) => i !== index)) }}
                    />
                  </section>

                  {/* Denylist: custom words and the add row stay visible; the built-in
                      preset words fold into a collapsed sublist (they are the default,
                      not a decision — the grouping replaces the old preset/custom tag
                      chips). Removing a preset word still works from inside the sublist;
                      the restore button brings the inherited defaults back. */}
                  <section style={sectionStyle}>
                    <p style={labelStyle}>{t('card.denylist')}</p>
                    <p style={hintStyle}>{t('card.denylistHint')}</p>
                    {customDeny.length > 0 && (
                      <p style={{ ...labelStyle, fontSize: '12px' }}>{t('card.denylistCustom')}</p>
                    )}
                    {customDeny.map((pair) => (
                      <div key={`${pair.index}:${pair.keyword}`} style={{ margin: '6px 0' }}>
                        <DenyRow
                          keyword={pair.keyword}
                          index={pair.index}
                          muted={false}
                          locked={readonly}
                          removeLabel={t('card.denylistRemove')}
                          onRemove={removeDeny}
                        />
                      </div>
                    ))}
                    {presetDeny.length > 0 && (
                      <>
                        <button
                          type="button"
                          aria-expanded={presetDenyOpen}
                          onClick={() => { setPresetDenyOpen((current) => !current) }}
                          style={{ ...drawerHeaderStyle, width: 'auto', alignSelf: 'flex-start', padding: '6px 4px' }}
                        >
                          <svg
                            width="12" height="12" viewBox="0 0 16 16" aria-hidden
                            style={{
                              color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
                              flex: '0 0 auto',
                              transition: 'transform 0.16s',
                              transform: presetDenyOpen ? 'rotate(180deg)' : 'none',
                            }}
                          >
                            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {t('card.denylistPresetCollapse').replace('%n', String(presetDeny.length))}
                        </button>
                        {presetDenyOpen
                          ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0' }}>
                                {presetDeny.map((pair) => (
                                  <DenyRow
                                    key={`${pair.index}:${pair.keyword}`}
                                    keyword={pair.keyword}
                                    index={pair.index}
                                    muted
                                    locked={readonly}
                                    removeLabel={t('card.denylistRemove')}
                                    onRemove={removeDeny}
                                  />
                                ))}
                              </div>
                            )
                          : null}
                      </>
                    )}
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
                  </DrawerGroup>

                  <DrawerGroup id="pg-drawer-credentials" title={t('card.credentials')} summary={credSummary}>
                    <section style={sectionStyle}>
                      <StringListField
                        label={t('card.credentialPaths')}
                        hint={t('card.credentialPathsHint')}
                        placeholder={t('card.credentialPathsPlaceholder')}
                        addLabel={t('card.denylistAdd')}
                        removeLabel={t('card.listRemove')}
                        items={value.credentialPaths ?? []}
                        locked={readonly}
                        onAdd={(entry) => { void scope.set('credentialPaths', [...(value.credentialPaths ?? []), entry]) }}
                        onRemove={(index) => { void scope.set('credentialPaths', (value.credentialPaths ?? []).filter((_, i) => i !== index)) }}
                      />
                    </section>

                    {/* Credential-family ladder: rows live in the rules document (section +
                        enabled) and in credWriteExemptFamilies — read and written through
                        the cred route, never mirrored here. Rung changes report through
                        `onRungs` so the drawer summary tracks readwrite without mirroring
                        the rung state here. */}
                    <CredLadderSection t={t} readonly={readonly} onRungs={handleCredRungs} />
                  </DrawerGroup>

                  <DrawerGroup id="pg-drawer-network" title={t('card.networkOps')} summary={networkSummary}>
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-network-enabled" style={{ fontSize: '12px' }}>{t('card.networkEnabled')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-network-enabled"
                        label={t('card.networkEnabled')}
                        checked={value.networkEnabled === true}
                        disabled={readonly}
                        onCommit={(next) => scope.set('networkEnabled', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.networkEnabledHint')}</p>
                    <p style={hintStyle}>{t('card.networkRebindNote')}</p>
                    <div style={{ height: '8px' }} />
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-network-inject-env" style={{ fontSize: '12px' }}>{t('card.networkInjectEnv')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-network-inject-env"
                        label={t('card.networkInjectEnv')}
                        checked={value.networkInjectEnv !== false}
                        disabled={readonly}
                        onCommit={(next) => scope.set('networkInjectEnv', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.networkInjectEnvHint')}</p>
                    <div style={{ height: '8px' }} />
                    <div style={rowStyle}>
                      <label htmlFor="plugin-config-perm-gate-watch" style={{ fontSize: '12px' }}>{t('card.watch')}</label>
                      <PillSwitch
                        id="plugin-config-perm-gate-watch"
                        label={t('card.watch')}
                        checked={value.watch !== false}
                        disabled={readonly}
                        onCommit={(next) => scope.set('watch', next)}
                      />
                    </div>
                    <p style={hintStyle}>{t('card.watchHint')}</p>
                  </DrawerGroup>
                  </div>

                  {!snapshot.writable
                    && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' }}>{t('card.readonly')}</p>}
                </>
              )}
          </div>
        )
        : null}
      <span
        ref={(node: HTMLElement | null) => {
          if (node && !node.firstChild) node.appendChild(mountStarRow())        }}
      />
    </div>
  )
}
