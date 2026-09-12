import assert from 'node:assert/strict'
import fs from 'node:fs'

const path = new URL('../desktop/plugin.js', import.meta.url)
const source = fs.readFileSync(path, 'utf8')
// Test target helpers logic
const block = source.match(/\/\/ TARGET_HELPERS_START([\s\S]*?)\/\/ TARGET_HELPERS_END/)
assert.ok(block, 'target helper block must exist')

const helpers = new Function(`${block[1]}; return { normalizePinnedTarget, normalizePinnedTargets, providerTargetKey, accountTargetKey, resolvePinnedTarget, togglePinnedTarget, pinnedAccountIdsForProvider, accountDetailLabel }`)()

assert.equal(helpers.normalizePinnedTarget('openai'), 'provider:openai')
assert.equal(helpers.normalizePinnedTarget('provider:openai'), 'provider:openai')
assert.equal(helpers.accountTargetKey('openai', '__main__'), 'account:openai:__main__')

const quotas = [{
  provider: 'openai',
  label: 'OpenAI',
  windows: [{ key: 'weekly', label: '每周', remainingPercent: 6.5, resetsAt: null }],
  accounts: [{ id: '__main__', email: 'tester@example.com', label: 'plus', weeklyPercent: 89, weeklyResetAt: 123 }]
}]
const account = helpers.resolvePinnedTarget('account:openai:__main__', quotas)
assert.equal(account.type, 'account')
assert.equal(account.label, 'tester@example.com')
assert.equal(account.statusLabel, 'tester')
assert.equal(account.remainingPercent, 11)

const provider = helpers.resolvePinnedTarget('provider:openai', quotas)
assert.equal(provider.type, 'provider')
assert.equal(provider.remainingPercent, 6.5)

const siblingKey = helpers.accountTargetKey('openai', 'secondary')
const providerKey = helpers.providerTargetKey('openai')
const accountKey = helpers.accountTargetKey('openai', '__main__')

// Legacy conflicts preserve the user's last action for each provider.
assert.deepEqual(helpers.normalizePinnedTargets([providerKey, accountKey, 'provider:xai']), [accountKey, 'provider:xai'])
assert.deepEqual(helpers.normalizePinnedTargets([accountKey, siblingKey, providerKey, 'provider:xai']), [providerKey, 'provider:xai'])
// Pinning an account replaces a pinned provider for the same pool.
assert.deepEqual(helpers.togglePinnedTarget([providerKey, 'provider:xai'], accountKey), ['provider:xai', accountKey])
assert.deepEqual(helpers.togglePinnedTarget([providerKey], accountKey), [accountKey])
// A second sibling account can coexist without restoring the provider target.
assert.deepEqual(helpers.togglePinnedTarget([accountKey], siblingKey), [accountKey, siblingKey])
// Pinning a provider replaces every pinned account from that provider.
assert.deepEqual(helpers.togglePinnedTarget([accountKey, siblingKey, 'provider:xai'], providerKey), ['provider:xai', providerKey])
// Toggling the same key removes it without touching unrelated targets.
assert.deepEqual(helpers.togglePinnedTarget([accountKey, 'provider:xai'], accountKey), ['provider:xai'])
assert.deepEqual([...helpers.pinnedAccountIdsForProvider([accountKey, siblingKey], 'openai')], ['__main__', 'secondary'])
assert.equal(helpers.accountDetailLabel(2, 1), '账户明细 · 1（另 1 个已固定）')
assert.equal(helpers.accountDetailLabel(2, 2), '账户明细 · 2')

// Background polling check
assert.match(source, /queryKey: \[ID, 'usage', '7d'\][\s\S]*?refetchIntervalInBackground: true/)
assert.match(source, /refetchInterval: 20000/)

console.log('frontend target tests passed')
