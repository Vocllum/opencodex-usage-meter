/** OpenCodex Usage Meter v1.0.0 — status-bar chip with provider/account tracking and ranged usage analysis. */
import { Popover, PopoverContent, PopoverTrigger, SegmentedControl, STATUSBAR_AREAS, useQuery, useQueryClient } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useRef, useState, useReducer } from 'react'

const ID = 'opencodex-usage-meter'
const PINS_KEY = `${ID}:pinned-providers`
const LEGACY_PIN_KEY = `${ID}:pinned-provider`
const SHOW_STATUS_LABELS_KEY = `${ID}:show-status-labels`
const RANGE_KEY = `${ID}:usage-range`
let rest

const CSS = `
.ocx-panel{width:352px;max-height:min(680px,calc(100vh - 56px));overflow-y:auto;scrollbar-width:none;color:var(--ui-text-primary);font-size:12.5px;line-height:1.42}
.ocx-panel::-webkit-scrollbar{display:none}
.ocx-panel *{box-sizing:border-box}
.ocx-shell{padding:12px 12px 10px}
.ocx-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.ocx-brand{display:flex;min-width:0;align-items:center;gap:8px;font-size:13.5px;font-weight:600}
.ocx-source{display:flex;align-items:center;gap:5px;color:var(--ui-text-quaternary);font-size:10px;font-weight:400;white-space:nowrap}
.ocx-dot{width:6px;height:6px;border-radius:999px;background:var(--ui-success,var(--ui-green))}
.ocx-dot.stale{background:var(--ui-yellow)}
.ocx-header-actions{display:flex;align-items:center;gap:5px;color:var(--ui-text-quaternary)}
.ocx-label-toggle{display:grid;min-width:25px;height:24px;place-items:center;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ui-text-quaternary);font-size:9px;font-weight:650;cursor:pointer}
.ocx-label-toggle:hover{border-color:var(--ui-stroke-tertiary);background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.ocx-label-toggle.is-active{border-color:var(--ui-stroke-secondary);background:var(--ui-bg-quaternary);color:var(--ui-accent-secondary)}
.ocx-refresh{display:grid;width:24px;height:24px;place-items:center;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ui-text-tertiary);cursor:pointer}
.ocx-refresh:hover{border-color:var(--ui-stroke-tertiary);background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.ocx-refresh:disabled{cursor:default;opacity:.45}
.ocx-refresh.is-loading svg{animation:ocx-spin .8s linear infinite}
@keyframes ocx-spin{to{transform:rotate(360deg)}}
.ocx-focus{padding:10px 11px 9px;border:1px solid var(--ui-stroke-secondary);border-radius:9px;background:transparent}
.ocx-focus-kicker{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;color:var(--ui-text-tertiary);font-size:10.5px;font-weight:500}
.ocx-mode{display:inline-flex;align-items:center;gap:4px;padding:1px 5px;border-radius:5px;background:var(--ui-bg-quaternary);color:var(--ui-text-tertiary);font-size:9px;font-weight:500}
.ocx-focus-main{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.ocx-focus-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-text-primary);font-size:14.5px;font-weight:600}
.ocx-focus-context{margin-top:2px;color:var(--ui-text-tertiary);font-size:9.5px;font-weight:400}
.ocx-focus-number{display:flex;flex-shrink:0;align-items:baseline;gap:4px;font-variant-numeric:tabular-nums}
.ocx-focus-number strong{font-size:26px;line-height:1;font-weight:650;letter-spacing:-.03em}
.ocx-focus-number span{color:var(--ui-text-tertiary);font-size:10px}
.ocx-gauge{height:5px;margin-top:8px;overflow:hidden;border-radius:999px;background:var(--ui-bg-primary)}
.ocx-gauge-fill{height:100%;border-radius:999px;transition:width .25s ease}
.ocx-focus-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px;color:var(--ui-text-tertiary);font-size:10px}
.ocx-focus-list{display:grid}
.ocx-focus-item{padding:8px 0}
.ocx-focus-item + .ocx-focus-item{border-top:1px solid var(--ui-stroke-quaternary)}
.ocx-focus-item:first-child{padding-top:2px}
.ocx-focus-item:last-child{padding-bottom:0}
.ocx-focus-unpin{display:grid;width:20px;height:20px;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--ui-accent-secondary);cursor:pointer}
.ocx-focus-unpin svg{width:11px;height:11px}
.ocx-focus-unpin:hover{background:var(--ui-control-hover-background)}
.ocx-provider-list{margin-top:8px}
.ocx-provider{border-bottom:1px solid var(--ui-stroke-quaternary)}
.ocx-provider:last-child{border-bottom:0}
.ocx-provider-main{display:block;width:100%;min-width:0;border:0;background:transparent;padding:7px 0 6px;color:inherit;text-align:left;cursor:pointer}
.ocx-provider-main:disabled{cursor:default}
.ocx-provider-main:hover .ocx-pin{opacity:1}
.ocx-provider-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.ocx-provider-title{display:flex;min-width:0;align-items:center;gap:6px}
.ocx-provider-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600}
.ocx-track-label{flex-shrink:0;color:var(--ui-accent-secondary);font-size:9px;font-weight:500}
.ocx-provider-value{display:flex;flex-shrink:0;align-items:baseline;gap:3px;font-variant-numeric:tabular-nums}
.ocx-provider-value strong{font-size:15px;font-weight:650}
.ocx-provider-value span{color:var(--ui-text-quaternary);font-size:9px}
.ocx-provider .ocx-gauge{height:4px;margin-top:5px}
.ocx-provider-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;color:var(--ui-text-quaternary);font-size:10px}
.ocx-provider-meta-left{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ocx-pin{display:grid;width:25px;height:25px;flex-shrink:0;place-items:center;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--ui-text-quaternary);opacity:.55;cursor:pointer}
.ocx-pin svg{width:11px;height:11px}
.ocx-pin:hover,.ocx-pin:focus-visible{opacity:1;border-color:var(--ui-stroke-tertiary);background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.ocx-pin.is-pinned{opacity:1;color:var(--ui-accent-secondary)}
.ocx-chevron{display:inline-flex;transition:transform .18s ease}
.ocx-chevron.open{transform:rotate(90deg)}
.ocx-details{padding:0 0 8px}
.ocx-detail-window{padding:6px 8px;margin-top:3px;border-radius:7px;background:var(--ui-bg-quaternary)}
.ocx-detail-window .ocx-note,.ocx-detail-window .ocx-detail-reset{margin-top:5px}
.ocx-detail-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.ocx-detail-head span{color:var(--ui-text-secondary);font-size:11.5px}
.ocx-detail-head strong{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}
.ocx-detail-window .ocx-gauge{margin-top:5px;background:var(--ui-bg-tertiary)}
.ocx-account .ocx-gauge{background:var(--ui-bg-tertiary);margin-top:5px}
.ocx-detail-reset{margin-top:4px;color:var(--ui-text-quaternary);font-size:9px}
.ocx-account-label{margin:6px 0 3px;color:var(--ui-text-quaternary);font-size:9px;text-transform:uppercase;letter-spacing:.08em}
.ocx-account{padding:6px 8px;margin-top:3px;border-radius:7px;background:var(--ui-bg-quaternary)}
.ocx-account-top{display:flex;align-items:center;justify-content:space-between;gap:7px}
.ocx-account-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-text-secondary);font-size:11px}
.ocx-account-badges{display:inline-flex;gap:5px;margin-left:5px;font-size:8px}
.ocx-account-badges .active{color:var(--ui-accent-secondary)}
.ocx-account-badges .reauth{color:var(--ui-red)}
.ocx-account-value-wrap{display:inline-flex;flex-shrink:0;align-items:center;gap:4px}
.ocx-account-value{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.ocx-account-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;color:var(--ui-text-quaternary);font-size:9.5px}
.ocx-account-pin{display:grid;width:20px;height:20px;place-items:center;border:0;border-radius:5px;background:transparent;color:var(--ui-text-quaternary);opacity:.55;cursor:pointer}
.ocx-account-pin svg{width:10px;height:10px}
.ocx-account-pin:hover,.ocx-account-pin:focus-visible{opacity:1;background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.ocx-account .ocx-gauge{margin-top:4px}
.ocx-note{margin-top:5px;color:var(--ui-text-tertiary);font-size:9.5px}
.ocx-note.warning{color:var(--ui-yellow)}
.ocx-muted{color:var(--ui-text-quaternary);font-weight:400;font-size:10px}
.ocx-fold{border-top:1px solid var(--ui-stroke-tertiary)}
.ocx-fold-button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;border:0;background:transparent;padding:9px 0;color:var(--ui-text-secondary);font-size:11px;text-align:left;cursor:pointer}
.ocx-fold-button:hover{color:var(--ui-text-primary)}
.ocx-fold-title{display:flex;align-items:center;gap:6px;font-weight:600}
.ocx-fold-meta{color:var(--ui-text-quaternary);font-size:10px;font-weight:400;font-variant-numeric:tabular-nums}
.ocx-fold-body{padding:0 0 10px}
.ocx-range-wrap{display:flex;margin-bottom:8px}
.ocx-range-wrap>div{width:100%}
.ocx-stat-lead{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
.ocx-stat-card{min-width:0;padding:8px;border-radius:7px;background:var(--ui-bg-quaternary)}
.ocx-stat-card span{display:block;color:var(--ui-text-quaternary);font-size:9px}
.ocx-stat-card strong{display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
.ocx-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 14px}
.ocx-stat{display:flex;align-items:baseline;justify-content:space-between;gap:8px;color:var(--ui-text-tertiary);font-size:10px}
.ocx-stat strong{color:var(--ui-text-secondary);font-weight:500;font-variant-numeric:tabular-nums}
.ocx-model-section{margin-top:10px;padding-top:8px;border-top:1px solid var(--ui-stroke-quaternary)}
.ocx-section-label{margin-bottom:2px;color:var(--ui-text-tertiary);font-size:9px;font-weight:600;letter-spacing:.04em}
.ocx-model{padding:6px 0;border-bottom:1px solid var(--ui-stroke-quaternary)}
.ocx-model:last-child{border-bottom:0}
.ocx-model-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.ocx-model-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-text-secondary);font-size:10px;font-weight:500}
.ocx-model-share{flex-shrink:0;color:var(--ui-text-tertiary);font-size:10px;font-variant-numeric:tabular-nums}
.ocx-model-meta{display:flex;justify-content:space-between;gap:10px;margin-top:3px;color:var(--ui-text-quaternary);font-size:9px}
.ocx-empty{padding:22px 8px;text-align:center;color:var(--ui-text-tertiary)}
.ocx-empty strong{display:block;margin-bottom:5px;color:var(--ui-text-secondary);font-size:12px}
.ocx-retry{margin-top:10px;padding:5px 9px;border:1px solid var(--ui-stroke-secondary);border-radius:6px;background:var(--ui-bg-secondary);color:var(--ui-text-secondary);font-size:10px;cursor:pointer}
.ocx-retry:hover{color:var(--ui-text-primary);border-color:var(--ui-stroke-primary)}
.ocx-skeleton{padding:14px}
.ocx-skeleton-line{height:8px;margin:8px 0;border-radius:999px;background:var(--ui-bg-secondary);animation:ocx-pulse 1.2s ease-in-out infinite alternate}
@keyframes ocx-pulse{to{opacity:.45}}
`

function OpenCodexMark({ size = 12 }) {
  return jsx('svg', {
    viewBox: '0 0 24 24', style: { width: `${size}px`, height: `${size}px` },
    fill: 'currentColor', 'aria-hidden': true,
    children: jsx('path', {
      fillRule: 'evenodd', clipRule: 'evenodd',
      d: 'M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z'
    })
  })
}

function RefreshIcon() {
  return jsx('svg', { viewBox: '0 0 16 16', width: 12, height: 12, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true, children: jsx('path', { d: 'M13.3 5.8A5.5 5.5 0 102.8 9.4M13.4 2.7v3.4H10' }) })
}

function PinIcon({ filled = false }) {
  return jsx('svg', { viewBox: '0 0 16 16', width: 12, height: 12, fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinejoin: 'round', 'aria-hidden': true, children: jsx('path', { d: 'M5.2 2.2h5.6l-.8 3.2 2 2v1H8.7L8 13.8 7.3 8.4H4v-1l2-2-.8-3.2z' }) })
}

function Chevron({ open = false }) {
  return jsx('span', { className: `ocx-chevron${open ? ' open' : ''}`, children: jsx('svg', { viewBox: '0 0 12 12', width: 10, height: 10, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true, children: jsx('path', { d: 'M4.5 2.5 8 6 4.5 9.5' }) }) })
}

function clampPercent(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0
}

function formatCompact(value) {
  const number = Number(value) || 0
  if (number >= 100000000) return `${(number / 100000000).toFixed(number >= 1000000000 ? 1 : 2)}亿`
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 1000000 ? 1 : 2)}万`
  return new Intl.NumberFormat('zh-CN').format(number)
}

function formatMoney(value) {
  const number = Number(value) || 0
  return `$${number >= 1000 ? number.toFixed(0) : number.toFixed(2)}`
}

const PROVIDER_SHORT = {
  openai: 'ChatGPT',
  'openai-codex': 'ChatGPT',
  'opencode-go': 'OpenCode Go',
  'command-code': 'Command Code',
  xai: 'Grok'
}

const USAGE_RANGES = [
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: 'all', label: '全部' }
]

function usageRangeLabel(value) {
  return USAGE_RANGES.find(item => item.key === value)?.label || '7 天'
}

function providerLabel(quota) {
  return PROVIDER_SHORT[quota.provider] || quota.label || quota.provider || '未知 Provider'
}

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

function formatFetchedAt(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(number))
}

function resetInfo(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  const milliseconds = number < 100000000000 ? number * 1000 : number
  const delta = milliseconds - Date.now()
  const absolute = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(milliseconds))
  if (delta <= 0) return { relative: '即将重置', absolute }
  const totalMinutes = Math.ceil(delta / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const relative = days ? `${days}天${hours ? ` ${hours}小时` : ''}后` : hours ? `${hours}小时${minutes ? ` ${minutes}分` : ''}后` : `${minutes}分钟后`
  return { relative, absolute }
}

function resetLabel(quota, window, reset) {
  if (reset) return `${reset.relative}重置`
  if (window?.key === 'weekly' && quota?.accounts?.length > 1) return `${quota.accounts.length} 个账户分别重置`
  return null
}

function windowByKey(quota, key) {
  return (quota?.windows || []).find(item => item.key === key) || null
}

function primaryWindow(quota) {
  return windowByKey(quota, 'weekly') || windowByKey(quota, 'fiveHour') || windowByKey(quota, 'monthly') || quota?.windows?.[0] || null
}

function urgencyColor(remaining) {
  const value = clampPercent(remaining)
  if (value <= 10) return 'var(--ui-red)'
  if (value <= 25) return 'var(--ui-yellow)'
  return 'var(--ui-accent-secondary)'
}

function Gauge({ remaining, label }) {
  const value = clampPercent(remaining)
  return jsx('div', {
    className: 'ocx-gauge', role: 'progressbar', 'aria-label': label,
    'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(value),
    children: jsx('div', { className: 'ocx-gauge-fill', style: { width: `${value}%`, background: urgencyColor(value) } })
  })
}

function DetailWindow({ window }) {
  const reset = resetInfo(window.resetsAt)
  return jsxs('div', { className: 'ocx-detail-window', children: [
    jsxs('div', { className: 'ocx-detail-head', children: [
      jsx('span', { children: `${window.label}剩余` }),
      jsx('strong', { style: { color: urgencyColor(window.remainingPercent) }, children: `${Math.round(window.remainingPercent)}%` })
    ]}),
    jsx(Gauge, { remaining: window.remainingPercent, label: `${window.label}剩余额度` }),
    reset ? jsx('div', { className: 'ocx-detail-reset', children: `${reset.relative}重置 · ${reset.absolute}` }) : null
  ]})
}

function AccountRow({ account, provider, onPin }) {
  const remaining = account.weeklyPercent == null ? null : clampPercent(100 - Number(account.weeklyPercent))
  const reset = resetInfo(account.weeklyResetAt)
  const label = account.email || account.label || '账户'
  return jsxs('div', { className: 'ocx-account', children: [
    jsxs('div', { className: 'ocx-account-top', children: [
      jsxs('div', { className: 'ocx-account-name', children: [
        label,
        jsxs('span', { className: 'ocx-account-badges', children: [
          account.active ? jsx('span', { className: 'active', children: '当前' }) : null,
          account.needsReauth ? jsx('span', { className: 'reauth', children: '需重新登录' }) : null
        ]})
      ]}),
      remaining == null
        ? jsx('span', { className: 'ocx-account-value ocx-muted', children: '暂无数据' })
        : jsx('span', { className: 'ocx-account-value', style: { color: urgencyColor(remaining) }, children: `${Math.round(remaining)}%` })
    ]}),
    remaining == null ? null : jsx(Gauge, { remaining, label: `${label}每周剩余额度` }),
    remaining == null
      ? (account.needsReauth ? jsx('div', { className: 'ocx-note warning', children: '重新登录后更新额度' }) : null)
      : jsxs('div', { className: 'ocx-account-foot', children: [
          reset ? jsx('span', { title: reset.absolute, children: `${reset.relative}重置 · ${reset.absolute}` }) : jsx('span', { children: '独立账户额度' }),
          jsx('button', { type: 'button', className: 'ocx-account-pin', onClick: onPin, title: `在状态栏增加 ${label}`, 'aria-label': `固定 ${label}`, children: jsx(PinIcon, {}) })
        ]})
  ]})
}

function targetResetLabel(target) {
  const reset = resetInfo(target?.resetsAt)
  if (reset) return { text: `${reset.relative}重置`, absolute: reset.absolute }
  if (target?.type === 'provider' && target.quota?.accounts?.length > 1) return { text: `${target.quota.accounts.length} 个账户分别重置`, absolute: undefined }
  return null
}

function FocusBoard({ targets, automatic, expandedKey, onToggleExpand, onUnpin, onPinTarget }) {
  if (!targets.length) return null
  const renderDetails = target => {
    // Same detail payload as ProviderBlock: secondary windows + accounts not
    // pinned elsewhere, so expanding a focus card replaces the old row.
    const quota = target.quota
    const primary = primaryWindow(quota)
    if (!primary) return null
    const details = (quota.windows || []).filter(item => item !== primary)
    const hiddenIds = pinnedAccountIdsForProvider(targets.map(item => item.key), quota.provider)
    const visibleAccounts = (quota.accounts || []).filter(account => !hiddenIds.has(account.id))
    const usageNote = null
    return jsxs('div', { className: 'ocx-details', style: { margin: '0 1px 2px' }, children: [
      ...details.map(item => jsx(DetailWindow, { window: item }, `${quota.provider}/${item.key}`)),
      quota.includedAccounts ? jsx('div', { className: 'ocx-note', children: `${quota.includedAccounts} 个可路由账户 · ${quota.aggregationKind || '上游聚合'}` }) : null,
      visibleAccounts.length ? jsxs('div', { children: [
        jsx('div', { className: 'ocx-account-label', children: accountDetailLabel((quota.accounts || []).length, visibleAccounts.length) }),
        ...visibleAccounts.map(account => jsx(AccountRow, { account, provider: quota.provider, onPin: () => onPinTarget(accountTargetKey(quota.provider, account.id)) }, account.id))
      ]}) : null
    ]}, `${target.key}:details`)
  }
  const expandable = target => {
    const quota = target.quota
    const primary = primaryWindow(quota)
    if (!primary) return false
    const hasSecondary = (quota.windows || []).some(item => item !== primary)
    const hiddenIds = new Set(targets.filter(t => t.type === 'account' && t.provider === quota.provider).map(t => t.account.id))
    const otherAccounts = (quota.accounts || []).filter(a => !hiddenIds.has(a.id)).length
    return Boolean(hasSecondary || otherAccounts || quota.includedAccounts)
  }
  const card = (target, single) => {
    const reset = targetResetLabel(target)
    const canExpand = expandable(target)
    const open = expandedKey === target.key
    const inner = jsxs('div', { children: [
      jsxs('div', { className: 'ocx-focus-main', style: { cursor: canExpand ? 'pointer' : 'default' },
        role: canExpand ? 'button' : undefined, tabIndex: canExpand ? 0 : undefined,
        onClick: canExpand ? () => onToggleExpand(target.key) : undefined,
        onKeyDown: canExpand ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggleExpand(target.key) } } : undefined,
        children: [
          jsxs('div', { children: [
            jsx('div', { className: 'ocx-focus-name', style: { display: 'inline-flex', alignItems: 'baseline', gap: '5px' }, children: [
              target.label,
              canExpand ? jsx(Chevron, { open }) : null
            ]}),
            jsx('div', { className: 'ocx-focus-context', children: target.type === 'account' ? `${target.contextLabel} · 每周` : target.windowLabel })
          ]}),
          jsxs('div', { className: 'ocx-focus-number', children: [
            jsx('strong', { style: { color: urgencyColor(target.remainingPercent) }, children: `${Math.round(target.remainingPercent)}%` }),
            jsx('span', { children: '剩余' })
          ]})
        ]}),
      jsx(Gauge, { remaining: target.remainingPercent, label: `${target.label}剩余额度` }),
      jsxs('div', { className: 'ocx-focus-meta', children: [
        jsx('span', { children: target.type === 'account' ? '独立账户额度' : target.windowLabel }),
        jsxs('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' }, children: [
          reset ? jsx('span', { title: reset.absolute, children: reset.text }) : null,
          jsx('button', { type: 'button', className: 'ocx-focus-unpin', onClick: () => onUnpin(target.key), title: `取消固定 ${target.label}`, 'aria-label': `取消固定 ${target.label}`, children: jsx(PinIcon, { filled: true }) })
        ]})
      ]}),
      open && canExpand ? renderDetails(target) : null
    ]}, target.key)
    return single
      ? inner
      : jsx('div', { className: 'ocx-focus-item', children: inner }, target.key)
  }
  if (!automatic) {
    if (targets.length === 1) {
      return jsxs('section', { className: 'ocx-focus', children: [
        jsxs('div', { className: 'ocx-focus-kicker', children: [
          jsx('span', { children: '固定跟踪' }),
          jsx('span', { className: 'ocx-mode', children: '1 项' })
        ]}),
        card(targets[0], true)
      ]})
    }
    return jsxs('section', { className: 'ocx-focus', children: [
      jsxs('div', { className: 'ocx-focus-kicker', children: [
        jsx('span', { children: '固定跟踪' }),
        jsx('span', { className: 'ocx-mode', children: `${targets.length} 项` })
      ]}),
      jsx('div', { className: 'ocx-focus-list', children: targets.map(target => card(target, false)) })
    ]})
  }
  return null
}

function ProviderBlock({ quota, usage, usageRangeLabel, open, autoTracked, hiddenAccountIds, onToggle, onPin, onPinAccount }) {
  const primary = primaryWindow(quota)
  if (!primary) return null
  const details = (quota.windows || []).filter(item => item !== primary)
  const visibleAccounts = (quota.accounts || []).filter(account => !hiddenAccountIds?.has(account.id))
  const reset = resetInfo(primary.resetsAt)
  const primaryResetLabel = resetLabel(quota, primary, reset)
  const canExpand = Boolean(details.length || visibleAccounts.length || quota.includedAccounts || quota.aggregationIncomplete)
  return jsxs('section', { className: 'ocx-provider', children: [
    jsxs('div', {
      role: 'button', tabIndex: canExpand ? 0 : undefined,
      className: 'ocx-provider-main', onClick: canExpand ? onToggle : undefined,
      onKeyDown: canExpand ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } } : undefined,
      'aria-expanded': canExpand ? open : undefined,
      children: [
        jsxs('div', { className: 'ocx-provider-top', children: [
          jsxs('div', { className: 'ocx-provider-title', children: [
            jsx('span', { className: 'ocx-provider-name', children: providerLabel(quota) }),
            autoTracked ? jsx('span', { className: 'ocx-track-label', children: '自动跟踪' }) : null
          ]}),
          jsxs('div', { className: 'ocx-provider-value', children: [
            jsx('strong', { style: { color: urgencyColor(primary.remainingPercent) }, children: `${Math.round(primary.remainingPercent)}%` }),
            jsx('span', { children: '剩余' })
          ]})
        ]}),
        jsx(Gauge, { remaining: primary.remainingPercent, label: `${providerLabel(quota)}${primary.label}剩余额度` }),
        jsxs('div', { className: 'ocx-provider-meta', children: [
          jsx('span', { className: 'ocx-provider-meta-left', title: reset ? reset.absolute : undefined, children: `${primary.label}${primaryResetLabel ? ` · ${primaryResetLabel}` : ''}${usage ? ` · ${formatCompact(usage.totalTokens)} Token` : ''}` }),
          jsxs('span', { style: { display: 'inline-flex', flexShrink: 0, alignItems: 'center', gap: '5px' }, children: [
            canExpand ? jsx(Chevron, { open }) : null,
            jsx('button', { type: 'button', className: 'ocx-pin', onClick: event => { event.stopPropagation(); onPin() }, title: hiddenAccountIds.size ? `固定 ${providerLabel(quota)}（替换 ${hiddenAccountIds.size} 个子账户）` : `在状态栏增加 ${providerLabel(quota)}`, 'aria-label': hiddenAccountIds.size ? `固定 ${providerLabel(quota)} 并替换已固定子账户` : `固定 ${providerLabel(quota)}`, children: jsx(PinIcon, {}) })
          ]})
        ]})
      ]
    }),
    open && canExpand ? jsxs('div', { className: 'ocx-details', children: [
      ...details.map(item => jsx(DetailWindow, { window: item }, `${quota.provider}/${item.key}`)),
      usage ? jsx('div', { className: 'ocx-note', children: `${usageRangeLabel}：${new Intl.NumberFormat('zh-CN').format(usage.requests)} 次请求 · ${usage.sharePercent}% Token 占比` }) : null,
      quota.includedAccounts ? jsx('div', { className: `ocx-note${quota.aggregationIncomplete ? ' warning' : ''}`, children: quota.aggregationIncomplete ? `${quota.includedAccounts} 个可路由账户，部分额度数据缺失` : `${quota.includedAccounts} 个可路由账户 · ${quota.aggregationKind || '上游聚合'}` }) : null,
      visibleAccounts.length ? jsxs('div', { children: [
        jsx('div', { className: 'ocx-account-label', children: accountDetailLabel((quota.accounts || []).length, visibleAccounts.length) }),
        ...visibleAccounts.map(account => jsx(AccountRow, { account, provider: quota.provider, onPin: () => onPinAccount(account.id) }, account.id))
      ]}) : null
    ]}) : null
  ]})
}

function Disclosure({ title, meta, open, onToggle, children }) {
  return jsxs('section', { className: 'ocx-fold', children: [
    jsxs('button', { type: 'button', className: 'ocx-fold-button', onClick: onToggle, 'aria-expanded': open, children: [
      jsxs('span', { className: 'ocx-fold-title', children: [jsx(Chevron, { open }), title] }),
      meta ? jsx('span', { className: 'ocx-fold-meta', children: meta }) : null
    ]}),
    open ? jsx('div', { className: 'ocx-fold-body', children }) : null
  ]})
}

function UsageStats({ summary, models, historyTruncated, range, onRangeChange }) {
  return jsxs('div', { children: [
    jsx('div', { className: 'ocx-range-wrap', children: jsx(SegmentedControl, { options: USAGE_RANGES.map(item => ({ id: item.key, label: item.label })), value: range, onChange: onRangeChange }) }),
    jsxs('div', { className: 'ocx-stat-lead', children: [
      jsxs('div', { className: 'ocx-stat-card', children: [jsx('span', { children: '请求' }), jsx('strong', { children: new Intl.NumberFormat('zh-CN').format(summary.requests) })] }),
      jsxs('div', { className: 'ocx-stat-card', children: [jsx('span', { children: '总 Token' }), jsx('strong', { children: formatCompact(summary.totalTokens) })] }),
      jsxs('div', { className: 'ocx-stat-card', title: '按模型价格估算的 API 等价成本', children: [jsx('span', { children: '估算成本' }), jsx('strong', { children: formatMoney(summary.estimatedCostUsd) })] })
    ]}),
    jsxs('div', { className: 'ocx-stat-grid', children: [
      jsxs('div', { className: 'ocx-stat', children: [jsx('span', { children: '输入' }), jsx('strong', { children: formatCompact(summary.inputTokens) })] }),
      jsxs('div', { className: 'ocx-stat', children: [jsx('span', { children: '输出' }), jsx('strong', { children: formatCompact(summary.outputTokens) })] }),
      jsxs('div', { className: 'ocx-stat', children: [jsx('span', { children: '缓存读取' }), jsx('strong', { children: formatCompact(summary.cachedInputTokens) })] }),
      jsxs('div', { className: 'ocx-stat', children: [jsx('span', { children: '推理输出' }), jsx('strong', { children: formatCompact(summary.reasoningOutputTokens) })] }),
      jsxs('div', { className: 'ocx-stat', children: [jsx('span', { children: '计价覆盖' }), jsx('strong', { children: `${summary.coveragePercent}%` })] })
    ]}),
    historyTruncated ? jsx('div', { className: 'ocx-note warning', children: '本地历史记录已截断，统计并非完整生命周期总量。' }) : jsx('div', { className: 'ocx-note', children: '成本为 OpenCodex 按模型价格计算的 API 等价估算。' })
  ]})
}

function ModelList({ models }) {
  if (!models.length) return jsx('div', { className: 'ocx-note', children: '暂无模型明细。' })
  return jsx('div', { children: models.map(item => jsxs('div', { className: 'ocx-model', children: [
    jsxs('div', { className: 'ocx-model-top', children: [
      jsx('span', { className: 'ocx-model-name', title: `${item.provider} · ${item.model}`, children: item.model }),
      jsx('span', { className: 'ocx-model-share', children: `${item.sharePercent}%` })
    ]}),
    jsxs('div', { className: 'ocx-model-meta', children: [
      jsx('span', { children: `${item.provider} · ${new Intl.NumberFormat('zh-CN').format(item.requests)} 次` }),
      jsx('span', { children: `${formatCompact(item.totalTokens)} Token · ${formatMoney(item.estimatedCostUsd)}` })
    ]})
  ]}, `${item.provider}/${item.model}`)) })
}
void ModelList

function readPinnedTargets() {
  try {
    const stored = globalThis.localStorage?.getItem(PINS_KEY)
    if (stored) {
      const direct = JSON.parse(stored)
      if (Array.isArray(direct)) return normalizePinnedTargets(direct)
    }
    const legacy = normalizePinnedTarget(globalThis.localStorage?.getItem(LEGACY_PIN_KEY))
    return legacy ? [legacy] : []
  } catch { return [] }
}

function writePinnedTargets(targets) {
  try {
    if (targets.length) globalThis.localStorage?.setItem(PINS_KEY, JSON.stringify(targets))
    else globalThis.localStorage?.removeItem(PINS_KEY)
    globalThis.localStorage?.removeItem(LEGACY_PIN_KEY)
  } catch {}
}

function readShowStatusLabels() {
  try {
    const stored = globalThis.localStorage?.getItem(SHOW_STATUS_LABELS_KEY)
    return stored == null ? true : stored === 'true'
  } catch { return true }
}

function writeShowStatusLabels(value) {
  try { globalThis.localStorage?.setItem(SHOW_STATUS_LABELS_KEY, String(Boolean(value))) } catch {}
}

function readUsageRange() {
  try {
    const stored = globalThis.localStorage?.getItem(RANGE_KEY)
    return USAGE_RANGES.some(item => item.key === stored) ? stored : '7d'
  } catch { return '7d' }
}

function writeUsageRange(value) {
  try { globalThis.localStorage?.setItem(RANGE_KEY, value) } catch {}
}

function EmptyState({ error, loading, onRetry }) {
  if (loading) return jsxs('div', { className: 'ocx-skeleton', children: [
    jsx('div', { className: 'ocx-skeleton-line', style: { width: '42%' } }),
    jsx('div', { className: 'ocx-skeleton-line', style: { width: '100%', height: '68px' } }),
    jsx('div', { className: 'ocx-skeleton-line', style: { width: '88%' } }),
    jsx('div', { className: 'ocx-skeleton-line', style: { width: '72%' } })
  ]})
  return jsxs('div', { className: 'ocx-empty', children: [
    jsx('strong', { children: error ? '暂时无法读取用量' : '没有可显示的额度' }),
    jsx('span', { children: error ? '已保留现有配置，可以立即重试。' : 'OpenCodex 当前没有返回带额度窗口的 Provider。' }),
    jsx('button', { type: 'button', className: 'ocx-retry', onClick: onRetry, children: '重新读取' })
  ]})
}

function UsageMeter() {
  const [open, setOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState({})
  const [focusExpandedKey, setFocusExpandedKey] = useState(null)
  const [pinnedTargetKeys, setPinnedTargetKeys] = useState(readPinnedTargets)
  const [showStatusLabels, setShowStatusLabels] = useState(readShowStatusLabels)
  const usageRangeRef = useRef(readUsageRange())
  const queryCore = useQueryClient()
  const [, forceRender] = useReducer(count => count + 1, 0)
  const closeTimer = useRef(null)
  const keepOpen = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null; setOpen(true) }
  const closeSoon = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 180) }
  // The 7d query feeds the always-visible status chip, so it keeps polling even
  // while the popover or Electron window is backgrounded. 30d/all stay scoped
  // to the open panel to avoid three permanent background polling loops.
  const q7 = useQuery({
    queryKey: [ID, 'usage', '7d'], queryFn: () => rest('/usage?range=7d', { timeoutMs: 45000 }),
    refetchInterval: 30_000, staleTime: 10_000, retry: 2, enabled: true,
    refetchIntervalInBackground: true
  })
  const q30 = useQuery({
    queryKey: [ID, 'usage', '30d'], queryFn: () => rest('/usage?range=30d', { timeoutMs: 45000 }),
    refetchInterval: 30_000, staleTime: 10_000, retry: 2, enabled: open
  })
  const qAll = useQuery({
    queryKey: [ID, 'usage', 'all'], queryFn: () => rest('/usage?range=all', { timeoutMs: 45000 }),
    refetchInterval: 30_000, staleTime: 10_000, retry: 2, enabled: open
  })
  const byRange = { '7d': q7, '30d': q30, all: qAll }
  const query = byRange[usageRangeRef.current] || q7
  const data = query.data
  const quotas = Array.isArray(data?.quotas) ? data.quotas.filter(quota => primaryWindow(quota)) : []
  const summary = data?.summary
  const weeklyQuotas = quotas.filter(quota => windowByKey(quota, 'weekly'))
  const automaticQuota = weeklyQuotas.reduce((lowest, quota) => !lowest || windowByKey(quota, 'weekly').remainingPercent < windowByKey(lowest, 'weekly').remainingPercent ? quota : lowest, null) || quotas[0] || null
  const automaticTarget = automaticQuota ? resolvePinnedTarget(providerTargetKey(automaticQuota.provider), quotas) : null
  const pinnedTargets = pinnedTargetKeys.map(key => resolvePinnedTarget(key, quotas)).filter(Boolean)
  const statusTargets = pinnedTargets.length ? pinnedTargets : (automaticTarget ? [automaticTarget] : [])
  const focusTargets = statusTargets
  // Pinned PROVIDERS disappear from the list — the focus board card replaces
  // the row and expands for details on click. Pinned ACCOUNTS stay hidden
  // from their provider's account list.
  const pinnedProviderKeys = new Set(pinnedTargets.filter(target => target.type === 'provider').map(target => target.provider))
  const pinnedAccountsByProvider = new Map(
    quotas.map(quota => [quota.provider, pinnedAccountIdsForProvider(pinnedTargetKeys, quota.provider)])
  )
  const visibleQuotas = quotas.filter(quota => !pinnedProviderKeys.has(quota.provider))
  const usageMap = new Map((data?.providers || []).map(item => [String(item.provider || '').toLowerCase(), item]))
  const toggleTarget = targetKey => {
    const next = togglePinnedTarget(pinnedTargetKeys, targetKey)
    setPinnedTargetKeys(next)
    setFocusExpandedKey(current => current && !next.includes(current) ? null : current)
    writePinnedTargets(next)
  }
  const toggleStatusLabels = () => {
    const next = !showStatusLabels
    setShowStatusLabels(next)
    writeShowStatusLabels(next)
  }
  const changeUsageRange = value => {
    if (value === usageRangeRef.current) return
    usageRangeRef.current = value
    writeUsageRange(value)
    forceRender()
  }
  // Manual refresh bypasses the backend cache (`refresh=1`) and writes the
  // fresh payload into the active range's cache slot. Always refetch — the
  // old isFetching guard silently swallowed clicks that raced a poll.
  const refresh = () => {
    const range = usageRangeRef.current
    queryCore.fetchQuery({
      queryKey: [ID, 'usage', range],
      queryFn: () => rest(`/usage?range=${encodeURIComponent(range)}&refresh=1`, { timeoutMs: 60000 }),
      staleTime: 0
    }).catch(() => {})
  }
  const hasData = Boolean(summary && quotas.length)
  const currentRangeLabel = usageRangeLabel(usageRangeRef.current)

  return jsx(Popover, { open, onOpenChange: setOpen, children: jsxs('div', {
    onMouseEnter: keepOpen, onMouseLeave: closeSoon,
    children: [
      jsx(PopoverTrigger, { asChild: true, children: jsxs('button', {
        type: 'button',
        className: 'ocx-chip',
        style: { display: 'inline-flex', height: '22px', alignItems: 'center', gap: '7px', padding: '0 9px', border: '1px solid color-mix(in srgb, var(--theme-primary, var(--ui-accent-secondary, #0053fd)) 45%, transparent)', borderRadius: '7px', background: 'var(--ui-bg-card, var(--ui-bg-primary))', boxShadow: '0 1px 3px rgba(16,24,40,.16)', color: 'var(--ui-text-secondary)', cursor: 'pointer' },
        title: statusTargets.length ? `${pinnedTargets.length ? '固定' : '自动'}跟踪：${statusTargets.map(target => `${target.label} ${Math.round(target.remainingPercent)}%`).join(' | ')}` : '打开 OpenCodex 用量',
        onMouseEnter: event => { event.currentTarget.style.borderColor = 'var(--theme-primary, var(--ui-accent-secondary, #0053fd))'; },
        onMouseLeave: event => { event.currentTarget.style.borderColor = 'color-mix(in srgb, var(--theme-primary, var(--ui-accent-secondary, #0053fd)) 45%, transparent)'; },
        children: [
          jsx(OpenCodexMark, { size: 13 }),
          query.isError
            ? jsx('strong', { style: { color: 'var(--ui-red)' }, children: '—' })
            : statusTargets.length
              ? statusTargets.map((target, index) => jsxs('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' }, children: [
                  index ? jsx('span', { style: { color: 'var(--ui-text-quaternary)', fontWeight: 400 }, children: '|' }) : null,
                  showStatusLabels ? jsx('span', { style: { color: 'var(--ui-text-secondary)', maxWidth: '88px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }, children: target.statusLabel }) : null,
                  jsx('strong', { style: { color: urgencyColor(target.remainingPercent), fontSize: '12px', lineHeight: 1, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }, children: `${Math.round(target.remainingPercent)}%` })
                ]}, target.key))
              : jsx('strong', { children: '…' })
        ]
      })}),
      jsx(PopoverContent, {
        align: 'end', sideOffset: 6, onMouseEnter: keepOpen, onMouseLeave: closeSoon,
        style: { width: '352px', padding: 0, overflow: 'hidden' },
        children: jsxs('div', { className: 'ocx-panel', children: [
          jsx('style', { children: CSS }),
          hasData ? jsxs('div', { className: 'ocx-shell', children: [
            jsxs('header', { className: 'ocx-header', children: [
              jsxs('div', { className: 'ocx-brand', children: [
                jsx(OpenCodexMark, { size: 13 }),
                jsx('span', { title: 'OpenCodex Usage Meter v1.0.0', children: 'OpenCodex 用量' }),
                jsxs('span', { className: 'ocx-source', children: [jsx('i', { className: `ocx-dot${data.stale ? ' stale' : ''}` }), data.stale ? '缓存数据' : '实时数据'] })
              ]}),
              jsxs('div', { className: 'ocx-header-actions', children: [
                jsx('span', { title: `最近成功读取：${formatFetchedAt(data.fetchedAt)}`, children: formatFetchedAt(data.fetchedAt) }),
                jsx('button', { type: 'button', className: `ocx-label-toggle${showStatusLabels ? ' is-active' : ''}`, onClick: toggleStatusLabels, title: showStatusLabels ? '隐藏状态栏名称' : '显示状态栏名称', 'aria-label': showStatusLabels ? '隐藏状态栏名称' : '显示状态栏名称', 'aria-pressed': showStatusLabels, children: 'Aa' }),
                jsx('button', { type: 'button', className: `ocx-refresh${query.isFetching ? ' is-loading' : ''}`, onClick: refresh, disabled: query.isFetching, title: query.isFetching ? '正在读取' : '刷新数据', 'aria-label': query.isFetching ? '正在读取' : '刷新数据', children: jsx(RefreshIcon, {}) })
              ]})
            ]}),
            jsx(FocusBoard, {
              targets: focusTargets, automatic: !pinnedTargets.length,
              expandedKey: focusExpandedKey,
              onToggleExpand: key => setFocusExpandedKey(current => current === key ? null : key),
              onUnpin: toggleTarget,
              onPinTarget: toggleTarget
            }),
            visibleQuotas.length ? jsx('div', { className: 'ocx-provider-list', children: visibleQuotas.map(quota => jsx(ProviderBlock, {
              quota,
              usage: usageMap.get(String(quota.provider || '').toLowerCase()),
              usageRangeLabel: currentRangeLabel,
              open: Boolean(providerOpen[quota.provider]),
              autoTracked: !pinnedTargets.length && automaticQuota?.provider === quota.provider,
              hiddenAccountIds: pinnedAccountsByProvider.get(quota.provider) || new Set(),
              onToggle: () => setProviderOpen(value => ({ ...value, [quota.provider]: !value[quota.provider] })),
              onPin: () => toggleTarget(providerTargetKey(quota.provider)),
              onPinAccount: accountId => toggleTarget(accountTargetKey(quota.provider, accountId))
            }, quota.provider)) }) : null,
            jsx(Disclosure, {
              title: '近期使用', meta: `${currentRangeLabel} · ${formatCompact(summary.totalTokens)} Token`, open: usageOpen,
              onToggle: () => setUsageOpen(value => !value),
              children: jsx(UsageStats, { summary, models: data.models || [], historyTruncated: data.historyTruncated, range: usageRangeRef.current, onRangeChange: changeUsageRange })
            })
          ]}) : jsx(EmptyState, { error: query.isError, loading: !data && !query.isError, onRetry: refresh })
        ]})
      })
    ]
  }) })
}

export default {
  id: ID,
  name: 'OpenCodex Usage Meter',
  register(ctx) {
    rest = ctx.rest
    ctx.register({ id: 'status', area: STATUSBAR_AREAS.right, order: 114, render: () => jsx(UsageMeter, {}) })
  }
}
