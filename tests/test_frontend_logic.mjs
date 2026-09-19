import assert from 'node:assert/strict'
import fs from 'node:fs'

const path = `${process.env.HOME}/.hermes/desktop-plugins/opencodex-usage-meter/plugin.js`
const source = fs.readFileSync(path, 'utf8')
const block = source.match(/\/\/ TARGET_HELPERS_START([\s\S]*?)\/\/ TARGET_HELPERS_END/)
assert.ok(block, 'target helper block must exist')

const helpers = new Function(`${block[1]}; return { normalizePinnedTarget, providerTargetKey, accountTargetKey, resolvePinnedTarget, selectedWindowForGroup }`)()

assert.equal(helpers.normalizePinnedTarget('openai'), 'provider:openai')
assert.equal(helpers.normalizePinnedTarget('provider:openai'), 'provider:openai')
assert.equal(helpers.accountTargetKey('openai', '__main__'), 'account:openai:__main__')

const quotas = [{
  provider: 'openai',
  label: 'OpenAI',
  windows: [
    { key: 'fiveHour', label: '5 小时', remainingPercent: 90, resetsAt: 111 },
    { key: 'weekly', label: '每周', remainingPercent: 6.5, resetsAt: 222 }
  ],
  accounts: [{
    id: '__main__', email: 'tester@example.com', label: 'plus',
    fiveHourPercent: 86, fiveHourResetAt: 111,
    weeklyPercent: 79, weeklyResetAt: 222
  }]
}]
const shortAccount = helpers.resolvePinnedTarget('account:openai:__main__', quotas, 'fiveHour')
assert.equal(shortAccount.type, 'account')
assert.equal(shortAccount.label, 'tester@example.com')
assert.equal(shortAccount.statusLabel, 'tester')
assert.equal(shortAccount.windowKey, 'fiveHour')
assert.equal(shortAccount.remainingPercent, 14)

const weeklyAccount = helpers.resolvePinnedTarget('account:openai:__main__', quotas, 'weekly')
assert.equal(weeklyAccount.windowKey, 'weekly')
assert.equal(weeklyAccount.remainingPercent, 21)

const provider = helpers.resolvePinnedTarget('provider:openai', quotas, 'fiveHour')
assert.equal(provider.type, 'provider')
assert.equal(provider.remainingPercent, 90)

assert.equal(helpers.selectedWindowForGroup(quotas[0], { windowKey: 'fiveHour' }, []).key, 'fiveHour')
assert.equal(helpers.selectedWindowForGroup(quotas[0], null, [weeklyAccount]).key, 'weekly')

assert.match(source, /calcAccountRemaining/)
assert.match(source, /calcProviderRemaining/)

// Test cascading logic extracted from source
const calcAccBlock = source.match(/function calcAccountRemaining[\s\S]*?^}/m)
const calcProvBlock = source.match(/function calcProviderRemaining[\s\S]*?^}/m)
const isAccBlockedBlock = source.match(/function isAccountBlockedByWeekly[\s\S]*?^}/m)
const clampPercentBlock = source.match(/function clampPercent[\s\S]*?^}/m)
const defaultWinBlock = source.match(/function defaultWindow[\s\S]*?^}/m)

if (calcAccBlock && calcProvBlock && isAccBlockedBlock && clampPercentBlock && defaultWinBlock) {
  const fns = new Function(`
    ${clampPercentBlock[0]};
    ${defaultWinBlock[0]};
    ${calcAccBlock[0]};
    ${calcProvBlock[0]};
    ${isAccBlockedBlock[0]};
    return { calcAccountRemaining, calcProviderRemaining, isAccountBlockedByWeekly };
  `)()

  const exhaustedAccount = {
    weeklyPercent: 100,
    fiveHourPercent: 0
  }
  // Displays actual five-hour remaining percent (100%), but correctly identified as blocked by weekly
  assert.equal(fns.calcAccountRemaining(exhaustedAccount, 'fiveHour'), 100)
  assert.equal(fns.isAccountBlockedByWeekly(exhaustedAccount, 'fiveHour'), true)
  assert.equal(fns.calcAccountRemaining(exhaustedAccount, 'weekly'), 0)

  const normalAccount = {
    weeklyPercent: 50,
    fiveHourPercent: 20
  }
  assert.equal(fns.calcAccountRemaining(normalAccount, 'fiveHour'), 80)
  assert.equal(fns.isAccountBlockedByWeekly(normalAccount, 'fiveHour'), false)
  assert.equal(fns.calcAccountRemaining(normalAccount, 'weekly'), 50)
}

console.log('frontend target tests passed')
