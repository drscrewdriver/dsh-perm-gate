/**
 * Permission-picker icon decoration for the Permissive tier.
 *
 * dsh-auto-mode injects a shield glyph onto its "Auto" permission menu item
 * via a `data-*` attribute + a CSS mask. This module does the same for the
 * "Permissive" preset so the two approval tiers look consistent in the
 * dropdown. It only annotates the item; the preset itself comes from
 * `cordis.patch.yml` (the `permission.config.presets` table).
 *
 * Pure DOM + CSS, no @deepseek-ai value imports (client bundle purity).
 */
const PLUGIN_ID = 'dsh-perm-gate'
const ICON_ATTRIBUTE = 'data-dsh-perm-gate-icon'

/** Labels of the Permissive preset item, current + future localized variants. */
const PERMISSIVE_LABELS = new Set(['Permissive', 'Permissive 审批档', 'Permissive 审批档位'])

/** Same shield glyph as dsh-auto-mode so the two approval tiers match visually. */
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8.21.9l6.58 2.47v3.64c0 4.99-3.74 7.2-6.58 8.29C5.36 14.21 1.62 12 1.62 7.01V3.37L8.21.9Z" fill="none" stroke="black" stroke-width="1.32" stroke-linejoin="round"/><path d="M8.75 3.65 5.95 8.2h2.08l-.78 4.15 2.82-4.9H8.12l.63-3.8Z" fill="black"/></svg>'

function iconStyles(): string {
  const mask = `url("data:image/svg+xml,${encodeURIComponent(ICON_SVG)}")`
  return `
[${ICON_ATTRIBUTE}]::before {
  content: "";
  display: inline-block;
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  background-color: var(--dsw-alias-label-tertiary, currentColor);
  -webkit-mask-image: ${mask};
  mask-image: ${mask};
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}
`
}

/** The permission dropdown menu (lists the permission presets as menuitems). */
function isPermissionMenu(menu: Element): boolean {
  return menu.matches('[role="menu"]')
    && Array.from(menu.querySelectorAll('button[role="menuitem"]')).length >= 4
}

/** Whether one menuitem is the Permissive preset. */
function isPermissiveMenuItem(element: Element): boolean {
  if (!element.matches('button[role="menuitem"]')) return false
  const label = (element.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!PERMISSIVE_LABELS.has(label)) return false
  return element.closest('[role="menu"]') !== null
}

/** Annotate the Permissive permission menuitems with the icon attribute. */
function decorate(document: Document): void {
  for (const marked of document.querySelectorAll(`[${ICON_ATTRIBUTE}]`)) {
    if (!isPermissiveMenuItem(marked)) marked.removeAttribute(ICON_ATTRIBUTE)
  }
  for (const menu of document.querySelectorAll('[role="menu"]')) {
    if (!isPermissionMenu(menu)) continue
    for (const item of menu.querySelectorAll('button[role="menuitem"]')) {
      if (isPermissiveMenuItem(item)) item.setAttribute(ICON_ATTRIBUTE, 'menu')
    }
  }
}

/** Install the Permissive tile icon into the permission picker; returns the disposer. */
export function installPermissivePermissionIcon(document: Document): () => void {
  for (const existing of document.querySelectorAll('style[data-plugin]')) {
    if (existing.getAttribute('data-plugin') === PLUGIN_ID) existing.remove()
  }
  const style = document.createElement('style')
  style.dataset.plugin = PLUGIN_ID
  style.dataset.pluginCss = `${PLUGIN_ID}/permission-icon`
  style.textContent = iconStyles()
  document.head.appendChild(style)

  let active = true
  let queued = false
  const scan = (): void => {
    if (!active || queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      if (active) decorate(document)
    })
  }

  decorate(document)
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true })

  return () => {
    active = false
    observer.disconnect()
    for (const marked of document.querySelectorAll(`[${ICON_ATTRIBUTE}]`)) {
      marked.removeAttribute(ICON_ATTRIBUTE)
    }
    style.remove()
  }
}