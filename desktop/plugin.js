/** OpenCodex Usage Meter v1.1.1 — Native Hermes cards, sub-account pinning, hidden scrollbars, no stats clutter. */
import { Popover, PopoverContent, PopoverTrigger, STATUSBAR_AREAS, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useRef, useState } from 'react'

const ID = 'opencodex-usage-meter'
const ORDER_KEY = `${ID}:provider-order`
const PINS_KEY = `${ID}:pinned-providers`
const WINDOW_PREFS_KEY = `${ID}:window-prefs`
let rest

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

const CSS = `
.ocx-panel {
  width: 326px;
  max-width: calc(100vw - 20px);
  max-height: min(620px, calc(100vh - 48px));
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
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid var(--ui-stroke-quaternary);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ocx-sub-row {
  display: grid;
  grid-template-columns: minmax(72px, max-content) minmax(0, 1fr) 34px;
  gap: 6px;
  align-items: center;
  font-size: 10px;
  color: var(--ui-text-tertiary);
  font-variant-numeric: tabular-nums;
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
  margin-top: 5px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ocx-acc-row {
  padding: 5px 7px;
  border: 1px solid var(--ui-stroke-quaternary);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ui-text-primary) 2%, transparent);
}
.ocx-acc-row.is-pinned {
  border-color: color-mix(in srgb, var(--ui-accent-secondary) 30%, transparent);
  background: color-mix(in srgb, var(--ui-accent-secondary) 5%, transparent);
}
.ocx-acc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  font-size: 10.5px;
}
.ocx-acc-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}
.ocx-acc-email {
  color: var(--ui-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ocx-acc-pct {
  font-family: ${MONO};
  font-weight: 650;
  flex-shrink: 0;
}
.ocx-acc-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  color: var(--ui-text-quaternary);
  margin-top: 2px;
}
.ocx-acc-badges {
  display: inline-flex;
  gap: 3px;
  font-size: 8px;
}
.ocx-badge-active { color: var(--ui-accent-secondary); font-weight: 600; }
.ocx-badge-reauth { color: var(--ui-red); font-weight: 600; }

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

function accountDetailLabel(totalAccounts, visibleAccounts) {
  const hidden = Math.max(0, Number(totalAccounts || 0) - Number(visibleAccounts || 0))
  return `账户明细 · ${visibleAccounts}${hidden ? `（另 ${hidden} 个已固定）` : ''}`
}

function resolvePinnedTarget(targetKey, quotas) {
  const [type, provider, ...identity] = String(targetKey || '').split(':')
  const quota = (quotas || []).find(item => item.provider === provider)
  if (!quota) return null
  const providerNames = { openai: 'ChatGPT', 'openai-codex': 'ChatGPT', 'opencode-go': 'OpenCode Go', 'command-code': 'Command Code', xai: 'Grok' }
  if (type === 'account') {
    const accountId = identity.join(':')
    const account = (quota.accounts || []).find(item => item.id === accountId)
    if (!account || !Number.isFinite(Number(account.weeklyPercent))) return null
    const label = account.email || account.label || '账户'
    const localPart = label.includes('@') ? label.split('@')[0] : label
    return {
      key: targetKey, type, provider, quota, account,
      label, statusLabel: localPart, contextLabel: providerNames[provider] || quota.label || provider,
      windowLabel: '每周', remainingPercent: Math.max(0, Math.min(100, 100 - Number(account.weeklyPercent))),
      resetsAt: account.weeklyResetAt || null
    }
  }
  if (type !== 'provider') return null
  const window = (quota.windows || []).find(item => item.key === 'weekly') || (quota.windows || [])[0]
  if (!window) return null
  const label = providerNames[provider] || quota.label || provider
  return {
    key: targetKey, type, provider, quota, window,
    label, statusLabel: label, contextLabel: window.label,
    windowLabel: window.label, remainingPercent: Number(window.remainingPercent), resetsAt: window.resetsAt || null
  }
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

function quotaColor(p) {
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

/* Tabler Chevron Up icon */
function ChevronUpIcon() {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: jsx('path', { d: 'M6 15l6 -6l6 6' })
  })
}

/* Tabler Chevron Down icon */
function ChevronDownIcon() {
  return jsx('svg', {
    viewBox: '0 0 24 24', width: '12', height: '12', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round',
    children: jsx('path', { d: 'M6 9l6 6l6 -6' })
  })
}

function ProviderCard({
  quota,
  activeWinKey,
  onWindowChange,
  isPinned,
  onTogglePin,
  pinnedAccountIds,
  onTogglePinAccount,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isExpanded,
  onToggleExpand
}) {
  const wins = quota?.windows || []
  const curWin = wins.find(w => w.key === activeWinKey) || defaultWindow(quota)
  if (!curWin) return null

  const p = clampPercent(curWin.remainingPercent)
  const reset = resetInfo(curWin.resetsAt)
  const accounts = quota?.accounts || []
  const otherWins = wins.filter(w => w.key !== curWin.key)
  const hasDetails = otherWins.length > 0 || accounts.length > 0

  return jsxs('div', { className: `ocx-card${isPinned ? ' primary' : ''}`, children: [
    /* Head */
    jsxs('div', { className: 'ocx-card-head', children: [
      jsxs('div', { className: 'ocx-card-left', children: [
        jsx('span', { className: 'ocx-card-title', children: providerTitle(quota) }),
      ]}),
      jsxs('div', { className: 'ocx-card-actions', children: [
        jsx('button', {
          type: 'button', className: 'ocx-order-btn',
          disabled: !canMoveUp, onClick: onMoveUp, title: '向上移动',
          children: jsx(ChevronUpIcon, {})
        }),
        jsx('button', {
          type: 'button', className: 'ocx-order-btn',
          disabled: !canMoveDown, onClick: onMoveDown, title: '向下移动',
          children: jsx(ChevronDownIcon, {})
        }),
        jsx('button', {
          type: 'button',
          className: `ocx-pin-btn${isPinned ? ' is-pinned' : ''}`,
          onClick: onTogglePin,
          title: isPinned ? '取消状态栏固定' : '固定整个 Provider 到状态栏',
          children: jsx(PinIcon, { filled: isPinned })
        })
      ]})
    ]}),

    /* Primary Metric */
    jsxs('div', { className: 'ocx-card-main', children: [
      jsx('span', { className: 'ocx-card-window-tag', children: `${curWin.label}剩余` }),
      jsx('span', { className: 'ocx-card-pct', style: { color: quotaColor(p) }, children: `${Math.round(p)}%` })
    ]}),

    /* Progress bar */
    jsx('div', { className: 'ocx-track', children: jsx('i', { style: { width: `${p}%`, background: quotaColor(p) } }) }),

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
      jsx('span', { children: reset || `${curWin.label}额度` }),
      hasDetails ? jsx('button', {
        type: 'button',
        className: 'ocx-expand-btn',
        onClick: onToggleExpand,
        children: isExpanded ? '收起详情' : accounts.length ? `${accounts.length}个子账户` : '其他维度'
      }) : null
    ]}),

    /* Expanded Content */
    isExpanded && hasDetails ? jsxs('div', { className: 'ocx-details-box', children: [
      otherWins.map(ow => {
        const owP = clampPercent(ow.remainingPercent)
        return jsxs('div', { className: 'ocx-sub-row', children: [
          jsx('span', { children: `${ow.label}剩余` }),
          jsx('div', { className: 'ocx-track', style: { marginTop: 0 }, children: jsx('i', { style: { width: `${owP}%`, background: quotaColor(owP) } }) }),
          jsx('strong', { style: { color: quotaColor(owP) }, children: `${Math.round(owP)}%` })
        ]}, ow.key)
      }),
      accounts.length ? jsx('div', { className: 'ocx-accounts-box', children: accounts.map(acc => {
        const isPinnedAcc = pinnedAccountIds?.has(acc.id)
        const isShort = curWin.key === 'fiveHour'
        const accUsed = isShort && acc.fiveHourPercent != null ? acc.fiveHourPercent : acc.weeklyPercent
        const accResetTime = isShort && acc.fiveHourResetAt ? acc.fiveHourResetAt : acc.weeklyResetAt
        const accP = accUsed == null ? null : clampPercent(100 - Number(accUsed))
        const accReset = resetInfo(accResetTime)
        const accLabel = acc.email || acc.label || '账户'
        return jsxs('div', { className: `ocx-acc-row${isPinnedAcc ? ' is-pinned' : ''}`, children: [
          jsxs('div', { className: 'ocx-acc-head', children: [
            jsxs('div', { className: 'ocx-acc-left', children: [
              jsx('span', { className: 'ocx-acc-email', title: accLabel, children: accLabel }),
              jsxs('span', { className: 'ocx-acc-badges', children: [
                acc.active ? jsx('span', { className: 'ocx-badge-active', children: '当前' }) : null,
                acc.needsReauth ? jsx('span', { className: 'ocx-badge-reauth', children: '需重登' }) : null
              ]})
            ]}),
            jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' }, children: [
              accP != null
                ? jsx('span', { className: 'ocx-acc-pct', style: { color: quotaColor(accP) }, children: `${Math.round(accP)}%` })
                : jsx('span', { style: { color: 'var(--ui-text-quaternary)', fontSize: '10px' }, children: '无数据' }),
              jsx('button', {
                type: 'button',
                className: `ocx-order-btn${isPinnedAcc ? ' is-pinned' : ''}`,
                style: { width: '20px', height: '20px', color: isPinnedAcc ? 'var(--ui-accent-secondary)' : 'var(--ui-text-quaternary)' },
                onClick: () => onTogglePinAccount(acc.id),
                title: isPinnedAcc ? `取消在状态栏固定 ${accLabel}` : `在状态栏固定单个子账户 ${accLabel}`,
                children: jsx(PinIcon, { filled: isPinnedAcc })
              })
            ]})
          ]}),
          accP != null ? jsx('div', { className: 'ocx-track', style: { marginTop: '4px' }, children: jsx('i', { style: { width: `${accP}%`, background: quotaColor(accP) } }) }) : null,
          accReset ? jsxs('div', { className: 'ocx-acc-meta', children: [
            jsx('span', { children: isShort ? '5小时额度' : '每周额度' }),
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
  const [pinnedTargets, setPinnedTargets] = useState(() => {
    try {
      const stored = globalThis.localStorage?.getItem(PINS_KEY)
      return stored ? JSON.parse(stored) : []
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
  const closeTimer = useRef(null)
  const keepOpen = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null; setOpen(true) }
  const closeSoon = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 180) }

  // Background auto-refresh every 20 seconds
  const query = useQuery({
    queryKey: [ID, 'usage', '7d'],
    queryFn: () => rest('/usage?range=7d', { timeoutMs: 25000 }),
    refetchInterval: 20000,
    staleTime: 8000,
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

  const moveCard = (idx, direction) => {
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= orderedQuotas.length) return
    const list = orderedQuotas.map(q => q.provider)
    const [moved] = list.splice(idx, 1)
    list.splice(targetIdx, 0, moved)
    setProviderOrder(list)
    try { globalThis.localStorage?.setItem(ORDER_KEY, JSON.stringify(list)) } catch {}
  }

  const togglePinProvider = provider => {
    const key = `provider:${provider}`
    setPinnedTargets(prev => {
      // Toggle provider target key, remove any child account targets of this provider
      const next = prev.includes(key)
        ? prev.filter(p => p !== key)
        : [...prev.filter(p => !p.startsWith(`account:${provider}:`)), key]
      try { globalThis.localStorage?.setItem(PINS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const togglePinAccount = (provider, accountId) => {
    const key = `account:${provider}:${accountId}`
    const pKey = `provider:${provider}`
    setPinnedTargets(prev => {
      let next
      if (prev.includes(key)) {
        next = prev.filter(p => p !== key)
      } else {
        // Pinning an account removes the provider-level pin of the same provider
        next = [...prev.filter(p => p !== pKey), key]
      }
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
  for (const t of pinnedTargets) {
    if (t.startsWith('account:')) {
      const [, provider, ...idParts] = t.split(':')
      const id = idParts.join(':')
      if (!pinnedAccountsMap.has(provider)) pinnedAccountsMap.set(provider, new Set())
      pinnedAccountsMap.get(provider).add(id)
    }
  }

  // Status-bar items to display
  const chips = []
  if (pinnedTargets.length > 0) {
    for (const t of pinnedTargets) {
      if (t.startsWith('account:')) {
        const [, provider, ...idParts] = t.split(':')
        const id = idParts.join(':')
        const q = quotas.find(item => item.provider === provider)
        const acc = (q?.accounts || []).find(a => a.id === id)
        if (q && acc) {
          const wKey = windowPrefs[q.provider]
          const isShort = wKey === 'fiveHour'
          const used = isShort && acc.fiveHourPercent != null ? acc.fiveHourPercent : acc.weeklyPercent
          const p = used == null ? null : clampPercent(100 - Number(used))
          const email = acc.email || acc.label || '账户'
          const label = email.includes('@') ? email.split('@')[0] : email
          if (p != null) chips.push({ key: t, title: label, pct: p })
        }
      } else {
        const provider = t.replace('provider:', '')
        const q = quotas.find(item => item.provider === provider)
        if (q) {
          const wKey = windowPrefs[q.provider]
          const w = (q.windows || []).find(win => win.key === wKey) || defaultWindow(q)
          if (w) chips.push({ key: t, title: providerTitle(q), pct: w.remainingPercent })
        }
      }
    }
  }
  if (!chips.length && quotas.length > 0) {
    let lowest = null
    for (const q of quotas) {
      const wKey = windowPrefs[q.provider]
      const w = (q.windows || []).find(win => win.key === wKey) || defaultWindow(q)
      if (w && (!lowest || w.remainingPercent < lowest.pct)) {
        lowest = { key: q.provider, title: providerTitle(q), pct: w.remainingPercent }
      }
    }
    if (lowest) chips.push(lowest)
  }

  return jsx(Popover, { open, onOpenChange: setOpen, children: jsxs('div', {
    onMouseEnter: keepOpen, onMouseLeave: closeSoon,
    children: [
      /* Chip trigger */
      jsx(PopoverTrigger, { asChild: true, children: jsxs('button', {
        type: 'button',
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
                  children: [
                    idx > 0 ? jsx('span', { style: { color: 'var(--ui-text-quaternary)' }, children: '/' }) : null,
                    jsx('span', { style: { color: 'var(--ui-text-tertiary)' }, children: c.title }),
                    jsx('strong', { style: { color: quotaColor(c.pct) }, children: `${Math.round(c.pct)}%` })
                  ]
                }))
              : jsx('strong', { children: '…' })
        ]
      })}),

      /* Panel */
      jsx(PopoverContent, {
        align: 'end', sideOffset: 6,
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
            jsx('div', { className: 'ocx-cards', children: orderedQuotas.map((q, idx) => jsx(ProviderCard, {
              quota: q,
              activeWinKey: windowPrefs[q.provider] || defaultWindow(q)?.key,
              onWindowChange: key => changeWindow(q.provider, key),
              isPinned: pinnedTargets.includes(`provider:${q.provider}`),
              onTogglePin: () => togglePinProvider(q.provider),
              pinnedAccountIds: pinnedAccountsMap.get(q.provider) || new Set(),
              onTogglePinAccount: accId => togglePinAccount(q.provider, accId),
              canMoveUp: idx > 0,
              canMoveDown: idx < orderedQuotas.length - 1,
              onMoveUp: () => moveCard(idx, -1),
              onMoveDown: () => moveCard(idx, 1),
              isExpanded: Boolean(expandedMap[q.provider]),
              onToggleExpand: () => setExpandedMap(prev => ({ ...prev, [q.provider]: !prev[q.provider] }))
            }, q.provider)) })
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
  }) })
}

export default {
  id: ID,
  name: 'OpenCodex Usage Meter',
  register(ctx) {
    rest = ctx.rest
    ctx.register({ id: 'status', area: STATUSBAR_AREAS.right, order: 112, render: () => jsx(UsageMeter, {}) })
  }
}
