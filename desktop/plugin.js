/** OpenCodex Usage Meter v1.2.0 — Window-level pinning, cascading weekly exhaustion alerts, and clean statusbar presentation. */
import { Popover, PopoverContent, PopoverTrigger, STATUSBAR_AREAS, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useRef, useState } from 'react'

const ID = 'opencodex-usage-meter'
const SHOW_STATUS_LABELS_KEY = `${ID}:show-status-labels`
const ORDER_KEY = `${ID}:provider-order`
const PINS_KEY = `${ID}:pinned-providers`
const WINDOW_PREFS_KEY = `${ID}:window-prefs`
const COMPACT_KEY = `${ID}:compact-providers`
let rest

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

const CSS = `
.ocx-panel {
  width: 326px;
  max-width: calc(100vw - 20px);
  max-height: min(480px, calc(100vh - 80px));
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 10px;
  color: var(--ui-text-primary);
  font-size: 11.5px;
  line-height: 1.4;
  background: var(--ui-bg-elevated, var(--background));
  isolation: isolate;
  border-radius: 8px;
}
.ocx-panel::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.ocx-panel * { box-sizing: border-box; }

/* Header */
.ocx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 0 2px;
}
.ocx-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ui-text-primary);
}
.ocx-dot {
  width: 5px;
  height: 5px;
  border-radius: 99px;
  background: #10b981;
  flex-shrink: 0;
}
.ocx-dot.stale { background: var(--ui-yellow, #f59e0b); }
.ocx-header-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  color: var(--ui-text-quaternary);
  font-family: ${MONO};
  font-variant-numeric: tabular-nums;
}
.ocx-icon-btn {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid var(--ui-stroke-quaternary);
  border-radius: 4px;
  background: transparent;
  color: var(--ui-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: all .15s ease;
}
.ocx-icon-btn:hover {
  border-color: var(--ui-accent-secondary);
  color: var(--ui-text-primary);
}
.ocx-icon-btn:disabled { opacity: .45; cursor: default; }
.ocx-icon-btn.is-loading svg { animation: ocx-spin .8s linear infinite; }
@keyframes ocx-spin { to { transform: rotate(360deg); } }

/* Cards */
.ocx-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ocx-card {
  border: 1px solid var(--ui-stroke-quaternary);
  border-radius: 6px;
  background: color-mix(in srgb, var(--ui-bg-elevated) 42%, transparent);
  padding: 8px 10px;
  transition: border-color .18s ease;
}
.ocx-card:hover {
  border-color: var(--ui-stroke-tertiary);
}
.ocx-card.primary {
  background: color-mix(in srgb, var(--ui-accent-secondary) 4%, transparent);
  border-color: color-mix(in srgb, var(--ui-accent-secondary) 24%, transparent);
}

/* Card Head */
.ocx-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ocx-card-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.ocx-card-title {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--ui-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ocx-card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.ocx-order-btn {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--ui-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: all .12s ease;
}
.ocx-order-btn:hover:not(:disabled) {
  background: var(--ui-fill-secondary);
  color: var(--ui-text-primary);
  border-color: var(--ui-stroke-quaternary);
}
.ocx-order-btn:disabled {
  opacity: .18;
  cursor: default;
}
.ocx-pin-btn {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--ui-text-quaternary);
  cursor: pointer;
  opacity: .6;
  padding: 0;
  transition: all .15s ease;
}
.ocx-pin-btn:hover {
  opacity: 1;
  border-color: var(--ui-stroke-tertiary);
  background: var(--ui-fill-secondary);
  color: var(--ui-text-primary);
}
.ocx-pin-btn.is-pinned {
  opacity: 1;
  color: var(--ui-accent-secondary);
}

.ocx-drag-handle {
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  border-radius: 3px;
  background: transparent;
  color: var(--ui-text-quaternary);
  cursor: grab;
  padding: 0;
  opacity: .5;
  transition: all .12s ease;
}
.ocx-drag-handle:hover {
  opacity: 1;
  background: var(--ui-fill-secondary);
  color: var(--ui-text-primary);
}
.ocx-drag-handle:active {
  cursor: grabbing;
}
.ocx-card.is-dragging {
  opacity: .35;
  border-style: dashed;
}
.ocx-card.is-drop-target {
  border-color: var(--ui-accent-secondary);
  box-shadow: 0 0 0 1px var(--ui-accent-secondary);
}

/* Compact Card */
.ocx-card.compact {
  padding: 5px 8px 6px;
}
.ocx-compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 18px;
}
.ocx-compact-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}
.ocx-compact-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.ocx-compact-pct {
  font-family: ${MONO};
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.ocx-compact-track {
  height: 2.5px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--ui-text-primary) 8%, transparent);
  overflow: hidden;
  margin-top: 4px;
}
.ocx-compact-track i {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width .4s ease;
}

/* Card Main Stat */
.ocx-card-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
}
.ocx-card-window-tag {
  font-size: 10.5px;
  color: var(--ui-text-secondary);
  font-weight: 500;
}
.ocx-card-pct {
  font-family: ${MONO};
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
}

/* Track / Gauge */
.ocx-track {
  height: 3.5px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--ui-text-primary) 8%, transparent);
  overflow: hidden;
  margin-top: 6px;
}
.ocx-track i {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width .4s ease;
}

/* Windows Pills */
.ocx-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 3.5px;
  margin-top: 6px;
}
.ocx-pill {
  height: 19px;
  padding: 0 6px;
  border: 1px solid var(--ui-stroke-quaternary);
  border-radius: 3px;
  background: transparent;
  color: var(--ui-text-tertiary);
  font-size: 9.5px;
  cursor: pointer;
  transition: all .15s ease;
}
.ocx-pill:hover {
  border-color: var(--ui-accent-secondary);
  color: var(--ui-text-primary);
}
.ocx-pill.is-active {
  border-color: var(--ui-accent-secondary);
  background: color-mix(in srgb, var(--ui-accent-secondary) 10%, transparent);
  color: var(--ui-accent-secondary);
  font-weight: 600;
}

/* Card Foot */
.ocx-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px dashed var(--ui-stroke-quaternary);
  font-size: 9.5px;
  color: var(--ui-text-quaternary);
}
.ocx-expand-btn {
  border: none;
  background: transparent;
  color: var(--ui-accent-secondary);
  cursor: pointer;
  font-size: 9.5px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.ocx-expand-btn:hover {
  text-decoration: underline;
}

/* Sub Rows */
.ocx-details-box {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--ui-stroke-quaternary);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ocx-sub-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 54px;
  gap: 6px;
  align-items: center;
  font-size: 9.5px;
  color: var(--ui-text-tertiary);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.ocx-sub-row span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ocx-sub-row strong {
  text-align: right;
  font-family: ${MONO};
  font-weight: 650;
}

/* Sub Accounts */
.ocx-accounts-box {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ocx-acc-row {
  padding: 6px 8px;
  border: 1px solid var(--ui-stroke-quaternary);
  border-radius: 5px;
  background: color-mix(in srgb, var(--ui-text-primary) 2.5%, transparent);
  transition: all .15s ease;
}
.ocx-acc-row:hover {
  border-color: var(--ui-stroke-tertiary);
  background: color-mix(in srgb, var(--ui-text-primary) 4.5%, transparent);
}
.ocx-acc-row.is-pinned {
  border-color: color-mix(in srgb, var(--ui-accent-secondary) 30%, transparent);
  background: color-mix(in srgb, var(--ui-accent-secondary) 5%, transparent);
}
.ocx-acc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  line-height: 1.3;
}
.ocx-acc-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}
.ocx-acc-email {
  color: var(--ui-text-primary);
  font-size: 11px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ocx-acc-pct {
  font-family: ${MONO};
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.ocx-acc-track {
  height: 2.5px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--ui-text-primary) 8%, transparent);
  overflow: hidden;
  margin: 5px 0 4px;
}
.ocx-acc-track i {
  display: block;
  height: 100%;
  border-radius: 99px;
  transition: width .3s ease;
}
.ocx-acc-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: var(--ui-text-quaternary);
  line-height: 1.25;
}
.ocx-acc-badges {
  display: inline-flex;
  gap: 3px;
  font-size: 8.5px;
}
.ocx-badge-active {
  color: var(--ui-accent-secondary);
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--ui-accent-secondary) 10%, transparent);
}
.ocx-badge-reauth {
  color: var(--ui-red);
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--ui-red) 10%, transparent);
}
.ocx-badge-ceiling {
  color: var(--ui-red, #ef4444);
  font-weight: 600;
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--ui-red, #ef4444) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ui-red, #ef4444) 26%, transparent);
  line-height: 1.25;
}

.ocx-empty { padding: 20px 10px; text-align: center; color: var(--ui-text-tertiary); }
`

// TARGET_HELPERS_START
function providerTargetKey(provider) {
  return `provider:${provider}`
}

function accountTargetKey(provider, accountId) {
  return `account:${provider}:${accountId}`
}

function normalizePinnedTarget(value) {
  if (typeof value !== 'string' || !value) return null
  return value.startsWith('provider:') || value.startsWith('account:') ? value : providerTargetKey(value)
}

function targetProvider(targetKey) {
  const [, provider] = String(targetKey || '').split(':')
  return provider || null
}

function normalizePinnedTargets(targets) {
  const normalized = [...new Set((targets || []).map(normalizePinnedTarget).filter(Boolean))]
  const lastTypeByProvider = new Map(normalized.map(key => [targetProvider(key), key.startsWith('provider:') ? 'provider' : 'account']))
  return normalized.filter(key => key.startsWith(`${lastTypeByProvider.get(targetProvider(key))}:`))
}

function togglePinnedTarget(targets, targetKey) {
  const current = normalizePinnedTargets(targets)
  if (current.includes(targetKey)) return current.filter(item => item !== targetKey)
  const provider = targetProvider(targetKey)
  const oppositePrefix = targetKey.startsWith('provider:') ? `account:${provider}:` : `provider:${provider}`
  const compatible = current.filter(item => targetKey.startsWith('provider:') ? !item.startsWith(oppositePrefix) : item !== oppositePrefix)
  return [...compatible, targetKey]
}

function pinnedAccountIdsForProvider(targetKeys, provider) {
  const prefix = `account:${provider}:`
  return new Set((targetKeys || []).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)))
}

function accountDetailLabel(totalAccounts, visibleAccounts, windowKey) {
  const hidden = Math.max(0, Number(totalAccounts || 0) - Number(visibleAccounts || 0))
  const prefix = windowKey === 'fiveHour' ? '5 小时账户' : '每周账户'
  return `${prefix} · ${visibleAccounts}${hidden ? `（另 ${hidden} 个已固定）` : ''}`
}

function resolvePinnedTarget(targetKey, quotas, windowPreference) {
  const [type, provider, ...identity] = String(targetKey || '').split(':')
  const quota = (quotas || []).find(item => item.provider === provider)
  if (!quota) return null
  const providerNames = { openai: 'ChatGPT', 'openai-codex': 'ChatGPT', 'opencode-go': 'OpenCode Go', 'command-code': 'Command Code', xai: 'Grok' }
  if (type === 'account') {
    const accountId = identity.join(':')
    const account = (quota.accounts || []).find(item => item.id === accountId)
    if (!account) return null
    const label = account.email || account.label || '账户'
    const localPart = label.includes('@') ? label.split('@')[0] : label
    const isShort = windowPreference === 'fiveHour'
    const used = isShort && account.fiveHourPercent != null ? account.fiveHourPercent : account.weeklyPercent
    if (!Number.isFinite(Number(used))) return null
    const resetsAt = isShort && account.fiveHourResetAt ? account.fiveHourResetAt : account.weeklyResetAt
    return {
      key: targetKey, type, provider, quota, account,
      label, statusLabel: localPart, contextLabel: providerNames[provider] || quota.label || provider,
      windowKey: isShort ? 'fiveHour' : 'weekly', windowLabel: isShort ? '5 小时' : '每周', remainingPercent: Math.max(0, Math.min(100, 100 - Number(used))),
      resetsAt: resetsAt || null
    }
  }
  if (type !== 'provider') return null
  const wins = quota.windows || []
  const window = wins.find(item => item.key === windowPreference) || wins.find(item => item.key === 'weekly') || wins[0]
  if (!window) return null
  const label = providerNames[provider] || quota.label || provider
  return {
    key: targetKey, type, provider, quota, window,
    label, statusLabel: label, contextLabel: window.label,
    windowKey: window.key, windowLabel: window.label, remainingPercent: Number(window.remainingPercent), resetsAt: window.resetsAt || null
  }
}
function selectedWindowForGroup(quota, providerPref, accountPrefs) {
  const wins = quota?.windows || []
  const prefKey = (typeof providerPref === 'string' ? providerPref : providerPref?.windowKey) ||
    (Array.isArray(accountPrefs) && accountPrefs[0]?.windowKey) || null
  return wins.find(w => w.key === prefKey) || (quota?.provider === 'openai' ? wins.find(w => w.key === 'fiveHour') : null) || wins.find(w => w.key === 'weekly') || wins[0] || null
}

// TARGET_HELPERS_END

const PROVIDER_TITLES = {
  openai: 'ChatGPT',
  'openai-codex': 'ChatGPT',
  'opencode-go': 'OpenCode Go',
  'command-code': 'Command Code',
  xai: 'Grok',
  'google-antigravity': 'Antigravity'
}

function providerTitle(quota) {
  return PROVIDER_TITLES[quota.provider] || quota.label || quota.provider || '未知'
}

function clampPercent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0
}

function quotaColor(p, isBlocked = false) {
  if (isBlocked) return 'var(--ui-red, #ef4444)'
  if (p == null) return 'var(--ui-text-quaternary)'
  if (p < 25) return 'var(--ui-red, #ef4444)'
  if (p < 50) return 'var(--ui-yellow, #f59e0b)'
  return 'var(--ui-accent-secondary, #0053fd)'
}

function formatTime(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(number))
}

function resetInfo(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  const ms = number < 100000000000 ? number * 1000 : number
  const delta = ms - Date.now()
  if (delta <= 0) return '即将重置'
  const totalMin = Math.ceil(delta / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  return d ? `${d}天${h ? ` ${h}时` : ''}后重置` : h ? `${h}小时${m ? ` ${m}分` : ''}后重置` : `${m}分钟后重置`
}

function defaultWindow(quota) {
  const wins = quota?.windows || []
  if (quota?.provider === 'openai') {
    return wins.find(w => w.key === 'fiveHour') || wins.find(w => w.key === 'weekly') || wins[0] || null
  }
  return wins.find(w => w.key === 'weekly') || wins.find(w => w.key === 'fiveHour') || wins[0] || null
}

function OpenCodexMark({ size = 12 }) {
  return jsx('svg', {
    viewBox: '0 0 24 24', style: { width: `${size}px`, height: `${size}px`, flexShrink: 0 },
    fill: 'currentColor', 'aria-hidden': true,
    children: jsx('path', {
      fillRule: 'evenodd', clipRule: 'evenodd',
      d: 'M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z'
    })
  })
}

/* Tabler Pin icon */
function PinIcon({ filled = false }) {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '13', height: '13', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('path', { d: 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4' }),
      jsx('path', { d: 'M9 15l-4.5 4.5' }),
      jsx('path', { d: 'M14.5 4l5.5 5.5' })
    ]
  })
}

/* Tabler Refresh icon */
function RefreshIcon() {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('path', { d: 'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4' }),
      jsx('path', { d: 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4' })
    ]
  })
}

/* Tabler Grip Vertical icon (drag handle) */
function GripIcon() {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '10', height: '10', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('circle', { cx: '9', cy: '5', r: '1', fill: 'currentColor' }),
      jsx('circle', { cx: '9', cy: '12', r: '1', fill: 'currentColor' }),
      jsx('circle', { cx: '9', cy: '19', r: '1', fill: 'currentColor' }),
      jsx('circle', { cx: '15', cy: '5', r: '1', fill: 'currentColor' }),
      jsx('circle', { cx: '15', cy: '12', r: '1', fill: 'currentColor' }),
      jsx('circle', { cx: '15', cy: '19', r: '1', fill: 'currentColor' })
    ]
  })
}

/* Tabler Minimize / Maximize (toggle compact view) */
function MinimizeIcon() {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '11', height: '11', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('path', { d: 'M5 9h4v-4' }),
      jsx('path', { d: 'M3 3l6 6' }),
      jsx('path', { d: 'M5 15h4v4' }),
      jsx('path', { d: 'M3 21l6 -6' }),
      jsx('path', { d: 'M19 9h-4v-4' }),
      jsx('path', { d: 'M21 3l-6 6' }),
      jsx('path', { d: 'M19 15h-4v4' }),
      jsx('path', { d: 'M21 21l-6 -6' })
    ]
  })
}

function MaximizeIcon() {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '11', height: '11', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: [
      jsx('path', { d: 'M16 4h4v4' }),
      jsx('path', { d: 'M14 10l6 -6' }),
      jsx('path', { d: 'M8 20h-4v-4' }),
      jsx('path', { d: 'M4 20l6 -6' }),
      jsx('path', { d: 'M16 20h4v-4' }),
      jsx('path', { d: 'M14 14l6 6' }),
      jsx('path', { d: 'M8 4h-4v4' }),
      jsx('path', { d: 'M4 4l6 6' })
    ]
  })
}

function calcAccountRemaining(acc, winKey) {
  if (!acc) return null

  let used = null
  if (Array.isArray(acc.customWindows) && acc.customWindows.length > 0) {
    const matched = acc.customWindows.find(cw => cw.key === winKey)
    if (matched && matched.usedPercent != null) used = matched.usedPercent
  }
  if (used == null) {
    const isShort = winKey === 'fiveHour' || winKey === 'claude-rolling' || winKey === 'gem'
    used = isShort && acc.fiveHourPercent != null ? acc.fiveHourPercent : acc.weeklyPercent
  }
  if (used == null) return null
  return clampPercent(100 - Number(used))
}

function calcProviderRemaining(quota, winKey) {
  const wins = quota?.windows || []
  const cur = wins.find(w => w.key === winKey) || defaultWindow(quota)
  if (!cur) return 0
  let p = clampPercent(cur.remainingPercent)
  const accs = quota?.accounts || []
  if (accs.length > 1) {
    const accPercents = accs.map(a => {
      if (isAccountBlockedByWeekly(a, cur.key)) {
        return 0
      }
      return calcAccountRemaining(a, cur.key)
    }).filter(v => v != null)
    if (accPercents.length > 1) {
      p = Math.round(accPercents.reduce((sum, v) => sum + v, 0) / accPercents.length)
    }
  } else if (isProviderBlockedByWeekly(quota, cur.key)) {
    p = 0
  }
  return p
}

function isAccountBlockedByWeekly(acc, winKey) {
  if (!acc) return false

  // 1. Claude 轨：仅受 Claude 每周（claude-weekly）制约，绝不读取 Gemini 的周额度
  if (winKey === 'claude-rolling') {
    if (Array.isArray(acc.customWindows)) {
      const cla = acc.customWindows.find(cw => cw.key === 'claude-rolling')
      if (cla && cla.blockedBy === 'weekly') return true
      const claWeekly = acc.customWindows.find(cw => cw.key === 'claude-weekly' || cw.label?.includes('Claude 每周') || cw.label?.includes('Cla (Weekly)'))
      if (claWeekly && claWeekly.usedPercent >= 100) return true
    }
    return false
  }

  // 2. Gemini / OpenAI 5小时短窗口轨
  const isShort = winKey === 'fiveHour' || winKey === 'gem' || winKey === 'gemini-rolling'
  if (!isShort) return false

  if (acc.fiveHourBlockedBy === 'weekly') return true
  if (Array.isArray(acc.customWindows)) {
    const matched = acc.customWindows.find(cw => cw.key === winKey)
    if (matched && matched.blockedBy === 'weekly') return true
    const gemWeekly = acc.customWindows.find(cw => cw.key === 'weekly' || cw.label?.toLowerCase().includes('weekly') || cw.label?.includes('每周'))
    if (gemWeekly && gemWeekly.usedPercent >= 100) return true
  } else if (acc.weeklyPercent != null && acc.weeklyPercent >= 100) {
    return true
  }
  return false
}

function isProviderBlockedByWeekly(quota, winKey) {
  const wins = quota?.windows || []
  const cur = wins.find(w => w.key === winKey) || defaultWindow(quota)
  if (!cur) return false

  // 1. Claude 轨：仅受 Claude 每周制约，绝不读取 Gemini 每周
  if (cur.key === 'claude-rolling') {
    if (cur.blockedBy === 'weekly') return true
    const claWeekly = wins.find(w => w.key === 'claude-weekly')
    if (claWeekly && claWeekly.remainingPercent <= 0) return true
    const accs = quota?.accounts || []
    if (accs.length > 0) {
      return accs.every(a => isAccountBlockedByWeekly(a, cur.key))
    }
    return false
  }

  // 2. Gemini / 5小时短窗口轨
  const isShort = cur.key === 'fiveHour' || cur.key === 'gem' || cur.key === 'gemini-rolling'
  if (!isShort) return false

  if (cur.blockedBy === 'weekly') return true
  const weeklyWin = wins.find(w => w.key === 'weekly' || w.key === 'gemini-weekly')
  if (weeklyWin && weeklyWin.remainingPercent <= 0) return true

  const accs = quota?.accounts || []
  if (accs.length > 0) {
    return accs.every(a => isAccountBlockedByWeekly(a, cur.key))
  }
  return false
}

function ProviderCard({
  quota,
  activeWinKey,
  onWindowChange,
  isPinned,
  onTogglePin,
  pinnedWinKeys,
  onTogglePinWindow,
  pinnedAccountIds,
  onTogglePinAccount,
  isExpanded,
  onToggleExpand,
  isCompact,
  onToggleCompact,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}) {
  const wins = quota?.windows || []
  const curWin = wins.find(w => w.key === activeWinKey) || defaultWindow(quota)
  if (!curWin) return null

  const accounts = quota?.accounts || []
  const p = calcProviderRemaining(quota, curWin.key)
  const isBlocked = isProviderBlockedByWeekly(quota, curWin.key)
  const reset = resetInfo(curWin.resetsAt)
  const otherWins = wins.filter(w => w.key !== curWin.key)
  const hasDetails = otherWins.length > 0 || accounts.length > 1

  /* Compact View Mode: top label row + full-width bottom progress bar */
  if (isCompact) {
    return jsxs('div', {
      className: `ocx-card compact${isPinned ? ' primary' : ''}${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}`,
      onDragOver, onDragLeave, onDrop,
      children: [
        /* Top Row: Info Left, Actions Right */
        jsxs('div', { className: 'ocx-compact-row', children: [
          /* Left: drag handle, provider title, window tag */
          jsxs('div', { className: 'ocx-compact-left', children: [
            jsx('button', {
              type: 'button', className: 'ocx-drag-handle', draggable: true,
              onDragStart, onDragEnd, title: '按住拖动排序',
              children: jsx(GripIcon, {})
            }),
            jsx('span', {
              className: 'ocx-card-title',
              style: { fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
              children: providerTitle(quota)
            }),
            jsx('span', {
              style: {
                fontSize: '9px', color: 'var(--ui-text-quaternary)',
                background: 'color-mix(in srgb, var(--ui-text-primary) 5%, transparent)',
                padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap'
              },
              children: curWin.label
            }),
            isBlocked ? jsx('span', {
              className: 'ocx-badge-ceiling',
              style: { fontSize: '8.5px', padding: '0 4px' },
              title: '周额度已耗尽',
              children: '周额度耗尽'
            }) : null
          ]}),

          /* Right: percent, maximize button, pin button */
          jsxs('div', { className: 'ocx-compact-right', children: [
            jsx('span', { className: 'ocx-compact-pct', style: { color: quotaColor(p, isBlocked) }, children: `${Math.round(p)}%` }),
            jsx('button', {
              type: 'button', className: 'ocx-order-btn',
              style: { width: '18px', height: '18px' },
              onClick: onToggleCompact, title: '展开为标准视图',
              children: jsx(MaximizeIcon, {})
            }),
            jsx('button', {
              type: 'button',
              className: `ocx-pin-btn${isPinned ? ' is-pinned' : ''}`,
              style: { width: '18px', height: '18px' },
              onClick: onTogglePin,
              title: isPinned ? '取消状态栏固定' : '固定整个 Provider 到状态栏',
              children: jsx(PinIcon, { filled: isPinned })
            })
          ]})
        ]}),

        /* Bottom Row: full-width slim track bar */
        jsx('div', { className: 'ocx-compact-track', children: jsx('i', { style: { width: `${p}%`, background: quotaColor(p, isBlocked) } }) })
      ]
    })
  }

  /* Standard View Mode */
  return jsxs('div', {
    className: `ocx-card${isPinned ? ' primary' : ''}${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}`,
    onDragOver, onDragLeave, onDrop,
    children: [
    /* Head */
    jsxs('div', { className: 'ocx-card-head', children: [
      jsxs('div', { className: 'ocx-card-left', children: [
        jsx('button', {
          type: 'button', className: 'ocx-drag-handle', draggable: true,
          onDragStart, onDragEnd, title: '按住拖动排序',
          children: jsx(GripIcon, {})
        }),
        jsx('span', { className: 'ocx-card-title', children: providerTitle(quota) }),
      ]}),
      jsxs('div', { className: 'ocx-card-actions', children: [
        jsx('button', {
          type: 'button', className: 'ocx-order-btn',
          onClick: onToggleCompact, title: '切换为极简视图',
          children: jsx(MinimizeIcon, {})
        }),
        jsx('button', {
          type: 'button',
          className: `ocx-pin-btn${isPinned ? ' is-pinned' : ''}`,
          onClick: onTogglePin,
          title: isPinned ? '取消状态栏固定' : '固定整个 Provider 到状态栏',
          children: jsx(PinIcon, { filled: isPinned })
        })
      ]}),
    ]}),

    /* Primary Metric */
    jsxs('div', { className: 'ocx-card-main', children: [
      jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: '5px' }, children: [
        jsx('span', { className: 'ocx-card-window-tag', children: `${curWin.label}剩余` }),
        isBlocked ? jsx('span', {
          className: 'ocx-badge-ceiling',
          title: '5小时实际额度未满，但周额度已耗尽不可调用',
          children: '周额度耗尽'
        }) : null
      ]}),
      jsx('span', { className: 'ocx-card-pct', style: { color: quotaColor(p, isBlocked) }, children: `${Math.round(p)}%` })
    ]}),

    /* Progress bar */
    jsx('div', { className: 'ocx-track', children: jsx('i', { style: { width: `${p}%`, background: quotaColor(p, isBlocked) } }) }),

    /* Pill Selector for multiple windows */
    wins.length > 1 ? jsx('div', { className: 'ocx-pills', children: wins.map(w => jsx('button', {
      key: w.key,
      type: 'button',
      className: `ocx-pill${w.key === curWin.key ? ' is-active' : ''}`,
      onClick: () => onWindowChange(w.key),
      children: w.label
    })) }) : null,

    /* Card Footer */
    jsxs('div', { className: 'ocx-card-foot', children: [
      jsx('span', {
        children: isBlocked
          ? (reset ? `周额度耗尽 · ${reset}` : '周额度耗尽')
          : (reset ? `${curWin.label} · ${reset}` : `${curWin.label}额度`)
      }),
      hasDetails ? jsx('button', {
        type: 'button',
        className: 'ocx-expand-btn',
        onClick: onToggleExpand,
        children: isExpanded ? '收起详情' : accounts.length > 1 ? `${accounts.length}个子账户` : '其他维度'
      }) : null
    ]}),

    /* Expanded Content */
    isExpanded && hasDetails ? jsxs('div', { className: 'ocx-details-box', children: [
      otherWins.map(ow => {
        const isOwBlocked = isProviderBlockedByWeekly(quota, ow.key)
        const owP = calcProviderRemaining(quota, ow.key)
        const isOwPinned = pinnedWinKeys?.has(ow.key)
        return jsxs('div', { className: 'ocx-sub-row', children: [
          jsx('span', { children: `${ow.label}剩余` }),
          jsx('div', { className: 'ocx-track', style: { marginTop: 0 }, children: jsx('i', { style: { width: `${owP}%`, background: quotaColor(owP, isOwBlocked) } }) }),
          jsxs('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }, children: [
            jsx('strong', { style: { color: quotaColor(owP, isOwBlocked) }, children: `${Math.round(owP)}%` }),
            jsx('button', {
              type: 'button',
              className: `ocx-pin-btn${isOwPinned ? ' is-pinned' : ''}`,
              style: { width: '16px', height: '16px' },
              onClick: () => onTogglePinWindow(ow.key),
              title: isOwPinned ? `取消在状态栏固定 ${ow.label}` : `在状态栏固定 ${ow.label}`,
              children: jsx(PinIcon, { filled: isOwPinned })
            })
          ]})
        ]}, ow.key)
      }),
      accounts.length > 1 ? jsx('div', { className: 'ocx-accounts-box', children: accounts.map(acc => {
        const isPinnedAcc = pinnedAccountIds?.has(acc.id)
        let accResetTime = null
        let winLabel = '额度'
        if (Array.isArray(acc.customWindows) && acc.customWindows.length > 0) {
          const matched = acc.customWindows.find(cw => cw.key === curWin.key)
          if (matched) {
            accResetTime = matched.resetAt
            winLabel = `${matched.label}额度`
          }
        }
        if (accResetTime == null) {
          const isShort = curWin.key === 'fiveHour' || curWin.key === 'claude-rolling'
          accResetTime = isShort && acc.fiveHourResetAt ? acc.fiveHourResetAt : acc.weeklyResetAt
          winLabel = isShort ? '5小时额度' : '每周额度'
        }
        const isAccBlocked = isAccountBlockedByWeekly(acc, curWin.key)
        const accP = calcAccountRemaining(acc, curWin.key)
        const accReset = resetInfo(accResetTime)
        const accLabel = acc.email || acc.label || '账户'
        return jsxs('div', { className: `ocx-acc-row${isPinnedAcc ? ' is-pinned' : ''}`, children: [
          jsxs('div', { className: 'ocx-acc-head', children: [
            jsxs('div', { className: 'ocx-acc-left', children: [
              jsx('span', { className: 'ocx-acc-email', title: accLabel, children: accLabel }),
              jsxs('span', { className: 'ocx-acc-badges', children: [
                acc.active ? jsx('span', { className: 'ocx-badge-active', children: '当前' }) : null,
                acc.needsReauth ? jsx('span', { className: 'ocx-badge-reauth', children: '需重登' }) : null,
                isAccBlocked ? jsx('span', { className: 'ocx-badge-ceiling', title: '周额度已耗尽', children: '周额度耗尽' }) : null
              ]})
            ]}),
            jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' }, children: [
              accP != null
                ? jsx('span', { className: 'ocx-acc-pct', style: { color: quotaColor(accP, isAccBlocked) }, children: `${Math.round(accP)}%` })
                : jsx('span', { style: { color: 'var(--ui-text-quaternary)', fontSize: '9px' }, children: '无数据' }),
              jsx('button', {
                type: 'button',
                className: `ocx-pin-btn${isPinnedAcc ? ' is-pinned' : ''}`,
                style: { width: '16px', height: '16px' },
                onClick: () => onTogglePinAccount(acc.id),
                title: isPinnedAcc ? `取消在状态栏固定 ${accLabel}` : `在状态栏固定单个子账户 ${accLabel}`,
                children: jsx(PinIcon, { filled: isPinnedAcc })
              })
            ]})
            ]}),
            accP != null ? jsx('div', { className: 'ocx-acc-track', children: jsx('i', { style: { width: `${accP}%`, background: quotaColor(accP, isAccBlocked) } }) }) : null,
          accReset ? jsxs('div', { className: 'ocx-acc-meta', children: [
            jsx('span', { children: isAccBlocked ? '周额度耗尽' : winLabel }),
            jsx('span', { children: accReset })
          ]}) : null
        ]}, acc.id)
      }) }) : null
    ]}) : null
  ]})
}

function UsageMeter() {
  const [open, setOpen] = useState(false)
  const [expandedMap, setExpandedMap] = useState({})
  const [draggedProvider, setDraggedProvider] = useState(null)
  const [dropTargetProvider, setDropTargetProvider] = useState(null)
  const [compactMap, setCompactMap] = useState(() => {
    try {
      const stored = globalThis.localStorage?.getItem(COMPACT_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })
  const [pinnedTargets, setPinnedTargets] = useState(() => {
    try {
      const stored = globalThis.localStorage?.getItem(PINS_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        // Upgrade legacy raw provider names ['openai', 'google-antigravity'] to 'provider:xxx'
        return parsed.map(item => typeof item === 'string' && !item.startsWith('provider:') && !item.startsWith('account:') ? `provider:${item}` : item)
      }
      return []
    } catch { return [] }
  })
  const [providerOrder, setProviderOrder] = useState(() => {
    try {
      const stored = globalThis.localStorage?.getItem(ORDER_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [windowPrefs, setWindowPrefs] = useState(() => {
    try {
      const stored = globalThis.localStorage?.getItem(WINDOW_PREFS_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  const queryClient = useQueryClient()

  // Background auto-refresh every 5 seconds for snappy updates
  const query = useQuery({
    queryKey: [ID, 'usage', '7d'],
    queryFn: () => rest('/usage?range=7d', { timeoutMs: 25000 }),
    refetchInterval: 5000,
    staleTime: 2000,
    refetchIntervalInBackground: true,
    retry: 2
  })

  const data = query.data
  const quotas = Array.isArray(data?.quotas) ? data.quotas : []

  // Sort providers according to customized order
  const orderedQuotas = [...quotas].sort((a, b) => {
    const idxA = providerOrder.indexOf(a.provider)
    const idxB = providerOrder.indexOf(b.provider)
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return 0
  })

  const reorderProviders = (sourceProvider, targetProvider) => {
    if (!sourceProvider || !targetProvider || sourceProvider === targetProvider) return
    const list = orderedQuotas.map(q => q.provider)
    const fromIdx = list.indexOf(sourceProvider)
    const toIdx = list.indexOf(targetProvider)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    setProviderOrder(list)
    try { globalThis.localStorage?.setItem(ORDER_KEY, JSON.stringify(list)) } catch {}
  }

  const toggleCompact = provider => {
    setCompactMap(prev => {
      const next = { ...prev, [provider]: !prev[provider] }
      try { globalThis.localStorage?.setItem(COMPACT_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const togglePinWindow = (provider, winKey) => {
    const key = `window:${provider}:${winKey}`
    const legacyKey = `provider:${provider}`
    setPinnedTargets(prev => {
      let next
      if (prev.includes(key)) {
        next = prev.filter(p => p !== key)
      } else {
        next = prev.filter(p => p !== legacyKey && p !== provider)
        next.push(key)
      }
      try { globalThis.localStorage?.setItem(PINS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const togglePinProvider = provider => {
    const activeWinKey = windowPrefs[provider] || defaultWindow((quotas || []).find(q => q.provider === provider))?.key
    if (activeWinKey) {
      togglePinWindow(provider, activeWinKey)
      return
    }
    const key = `provider:${provider}`
    setPinnedTargets(prev => {
      const next = (prev.includes(key) || prev.includes(provider))
        ? prev.filter(p => p !== key && p !== provider)
        : [...prev, key]
      try { globalThis.localStorage?.setItem(PINS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const togglePinAccount = (provider, accountId) => {
    const key = `account:${provider}:${accountId}`
    setPinnedTargets(prev => {
      // Toggle child account pin without deleting provider-level pin
      const next = prev.includes(key)
        ? prev.filter(p => p !== key)
        : [...prev, key]
      try { globalThis.localStorage?.setItem(PINS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const changeWindow = (provider, winKey) => {
    setWindowPrefs(prev => {
      const next = { ...prev, [provider]: winKey }
      try { globalThis.localStorage?.setItem(WINDOW_PREFS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const manualRefresh = () => {
    queryClient.fetchQuery({
      queryKey: [ID, 'usage', '7d'],
      queryFn: () => rest('/usage?range=7d&refresh=1', { timeoutMs: 45000 }),
      staleTime: 0
    }).catch(() => {})
  }

  // Pinned accounts set per provider
  const pinnedAccountsMap = new Map()
  // Pinned explicit windows set per provider
  const pinnedWindowsMap = new Map()
  for (const t of pinnedTargets) {
    if (t.startsWith('account:')) {
      const [, provider, ...idParts] = t.split(':')
      const id = idParts.join(':')
      if (!pinnedAccountsMap.has(provider)) pinnedAccountsMap.set(provider, new Set())
      pinnedAccountsMap.get(provider).add(id)
    } else if (t.startsWith('window:')) {
      const [, provider, winKey] = t.split(':')
      if (!pinnedWindowsMap.has(provider)) pinnedWindowsMap.set(provider, new Set())
      pinnedWindowsMap.get(provider).add(winKey)
    }
  }

  // Status-bar items to display
  const chips = []
  if (pinnedTargets.length > 0) {
    // Group pinned items by provider, following providerOrder
    const pinnedByProvider = new Map()
    for (const t of pinnedTargets) {
      if (t.startsWith('account:')) {
        const [, provider, ...idParts] = t.split(':')
        const id = idParts.join(':')
        if (!pinnedByProvider.has(provider)) pinnedByProvider.set(provider, { providerPin: false, winKeys: [], accountIds: [] })
        pinnedByProvider.get(provider).accountIds.push(id)
      } else if (t.startsWith('window:')) {
        const [, provider, winKey] = t.split(':')
        if (!pinnedByProvider.has(provider)) pinnedByProvider.set(provider, { providerPin: false, winKeys: [], accountIds: [] })
        pinnedByProvider.get(provider).winKeys.push(winKey)
      } else {
        const provider = t.startsWith('provider:') ? t.replace('provider:', '') : t
        if (!pinnedByProvider.has(provider)) pinnedByProvider.set(provider, { providerPin: false, winKeys: [], accountIds: [] })
        pinnedByProvider.get(provider).providerPin = true
      }
    }

    for (const q of orderedQuotas) {
      const pinInfo = pinnedByProvider.get(q.provider)
      if (!pinInfo) continue

      // 1. Explicit window-level pins (e.g. AGY Gemini & AGY Claude)
      for (const wKey of pinInfo.winKeys) {
        const win = (q.windows || []).find(w => w.key === wKey)
        if (win) {
          const provPct = calcProviderRemaining(q, wKey)
          const isBlocked = isProviderBlockedByWeekly(q, wKey)
          let title = providerTitle(q)
          if (q.provider === 'google-antigravity') {
            title = win.label
          } else if (pinInfo.winKeys.length > 1) {
            title = `${providerTitle(q)} ${win.label}`
          }
          chips.push({
            key: `window:${q.provider}:${wKey}`,
            title,
            pct: provPct,
            isBlocked
          })
        }
      }

      // 2. Legacy / default provider-level pin (if no explicit windows pinned)
      if (pinInfo.providerPin && !pinInfo.winKeys.length) {
        const wKey = windowPrefs[q.provider]
        const provPct = calcProviderRemaining(q, wKey)
        const isBlocked = isProviderBlockedByWeekly(q, wKey)
        chips.push({ key: `provider:${q.provider}`, title: providerTitle(q), pct: provPct, isBlocked })
      }

      // 3. Sub-accounts pinned for this provider
      for (const id of pinInfo.accountIds) {
        const acc = (q?.accounts || []).find(a => a.id === id)
        if (acc) {
          const wKey = windowPrefs[q.provider]
          const p = calcAccountRemaining(acc, wKey)
          const isBlocked = isAccountBlockedByWeekly(acc, wKey)
          const email = acc.email || acc.label || '账户'
          const label = email.includes('@') ? email.split('@')[0] : email
          if (p != null) chips.push({ key: `account:${q.provider}:${id}`, title: label, pct: p, isBlocked })
        }
      }
    }
  }
  if (!chips.length && quotas.length > 0) {
    let lowest = null
    for (const q of quotas) {
      const wKey = windowPrefs[q.provider]
      const p = calcProviderRemaining(q, wKey)
      const isBlocked = isProviderBlockedByWeekly(q, wKey)
      if (!lowest || p < lowest.pct) {
        lowest = { key: q.provider, title: providerTitle(q), pct: p, isBlocked }
      }
    }
    if (lowest) {
      chips.push(lowest)
    }
  }

  const handleOpenChange = nextOpen => {
    setOpen(nextOpen)
    if (nextOpen) query.refetch?.()
  }

  return jsxs(Popover, {
    open,
    onOpenChange: handleOpenChange,
    children: [
      /* Chip trigger: click to toggle */
      jsx(PopoverTrigger, { asChild: true, children: jsxs('button', {
        type: 'button',
        onClick: () => setOpen(prev => !prev),
        style: {
          display: 'inline-flex', height: '22px', alignItems: 'center', gap: '5px',
          padding: '0 4px', border: 'none', background: 'transparent',
          color: 'var(--ui-text-secondary)', cursor: 'pointer', fontSize: '11px',
          fontVariantNumeric: 'tabular-nums'
        },
        children: [
          jsx(OpenCodexMark, { size: 12 }),
          query.isError
            ? jsx('strong', { style: { color: 'var(--ui-red)' }, children: '—' })
            : chips.length
              ? chips.map((c, idx) => jsxs('span', {
                  key: c.key,
                  style: { display: 'inline-flex', alignItems: 'center', gap: '3px' },
                  title: c.isBlocked ? `${c.title}: 5小时剩余 ${Math.round(c.pct)}%，但周额度已耗尽` : `${c.title}: ${Math.round(c.pct)}%`,
                  children: [
                    idx > 0 ? jsx('span', { style: { color: 'var(--ui-text-quaternary)' }, children: '/' }) : null,
                    jsx('span', { style: { color: 'var(--ui-text-tertiary)' }, children: c.title }),
                    jsx('strong', { style: { color: quotaColor(c.pct, c.isBlocked) }, children: `${Math.round(c.pct)}%` })
                  ]
                }))
              : jsx('strong', { children: '…' })
        ]
      })}),

      /* Panel */
      jsx(PopoverContent, {
        side: 'top',
        align: 'end',
        sideOffset: 2,
        style: {
          width: 'min(326px, calc(100vw - 20px))', maxWidth: 'calc(100vw - 20px)',
          padding: 0, backgroundColor: 'var(--ui-bg-elevated, var(--background))',
          backgroundImage: 'none', isolation: 'isolate', border: '1px solid var(--ui-stroke-tertiary)',
          borderRadius: '8px', overflow: 'hidden'
        },
        children: jsxs('div', { className: 'ocx-panel', children: [
          jsx('style', { children: CSS }),
          data && quotas.length ? jsxs('div', { children: [
            /* Header */
            jsxs('div', { className: 'ocx-header', children: [
              jsxs('div', { className: 'ocx-brand', children: [
                jsx('i', { className: `ocx-dot${data.stale ? ' stale' : ''}` }),
                jsx('span', { children: 'OpenCodex 配额与用量' }),
              ]}),
              jsxs('div', { className: 'ocx-header-actions', children: [
                jsx('span', { children: formatTime(data.fetchedAt) }),
                jsx('button', {
                  type: 'button',
                  className: `ocx-icon-btn${query.isFetching ? ' is-loading' : ''}`,
                  onClick: manualRefresh,
                  disabled: query.isFetching,
                  title: '刷新额度',
                  children: jsx(RefreshIcon, {})
                })
              ]})
            ]}),

            /* Cards */
            jsx('div', { className: 'ocx-cards', children: orderedQuotas.map((q, idx) => {
              const activeWinKey = windowPrefs[q.provider] || defaultWindow(q)?.key
              const pinnedWinSet = pinnedWindowsMap.get(q.provider) || new Set()
              const isCurWinPinned = pinnedWinSet.has(activeWinKey) || (!pinnedWinSet.size && (pinnedTargets.includes(`provider:${q.provider}`) || pinnedTargets.includes(q.provider)))
              return jsx(ProviderCard, {
                quota: q,
                activeWinKey,
                onWindowChange: key => changeWindow(q.provider, key),
                isPinned: isCurWinPinned,
                onTogglePin: () => togglePinWindow(q.provider, activeWinKey),
                pinnedWinKeys: pinnedWinSet,
                onTogglePinWindow: key => togglePinWindow(q.provider, key),
                pinnedAccountIds: pinnedAccountsMap.get(q.provider) || new Set(),
                onTogglePinAccount: accId => togglePinAccount(q.provider, accId),
              isExpanded: Boolean(expandedMap[q.provider]),
              onToggleExpand: () => setExpandedMap(prev => {
                const next = !prev[q.provider]
                if (next) query.refetch?.()
                return { ...prev, [q.provider]: next }
              }),
              isCompact: Boolean(compactMap[q.provider]),
              onToggleCompact: () => toggleCompact(q.provider),
              isDragging: draggedProvider === q.provider,
              isDropTarget: dropTargetProvider === q.provider,
              onDragStart: e => {
                setDraggedProvider(q.provider)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', q.provider)
              },
              onDragOver: e => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dropTargetProvider !== q.provider) setDropTargetProvider(q.provider)
              },
              onDragLeave: e => {
                if (e.currentTarget.contains(e.relatedTarget)) return
                if (dropTargetProvider === q.provider) setDropTargetProvider(null)
              },
              onDrop: e => {
                e.preventDefault()
                const source = draggedProvider || e.dataTransfer.getData('text/plain')
                if (source && source !== q.provider) reorderProviders(source, q.provider)
                setDraggedProvider(null)
                setDropTargetProvider(null)
              },
              onDragEnd: () => {
                setDraggedProvider(null)
                setDropTargetProvider(null)
              }
            }, q.provider)
          }) })
          ] }) : jsxs('div', { className: 'ocx-empty', children: [
            jsx('div', { children: query.isError ? '无法连接 OpenCodex' : '正在读取用量数据...' }),
            jsx('button', {
              type: 'button',
              className: 'ocx-icon-btn',
              style: { margin: '8px auto 0', width: 'auto', padding: '2px 10px' },
              onClick: manualRefresh,
              children: '重试'
            })
          ] })
        ] })
      })
    ]
  })
}

export default {
  id: ID,
  name: 'OpenCodex Usage Meter',
  register(ctx) {
    rest = ctx.rest
    ctx.register({ id: 'status', area: STATUSBAR_AREAS.right, order: 112, render: () => jsx(UsageMeter, {}) })
  }
}
