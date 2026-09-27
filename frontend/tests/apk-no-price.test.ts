import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dictionaries } from '../src/i18n/strings.js'
import { lookup } from '../src/i18n/I18nProvider.js'
import { inApk } from '../src/lib/inApk.js'

/**
 * INSIDE THE APK, NOTHING NAMES THE PRICE.
 *
 * Google Play requires its own billing for anything that unlocks the app, and
 * the seller's ₹50 buys slots and six months. So in the APK she is never shown
 * the fee or a way to pay it - staff record what she pays at the desk. A new
 * line that mentions the ₹50 and has no `.apk` twin would put the price back
 * on a Play build without anybody noticing, which is what this catches.
 */

const PRICE = /₹\s?50\b|\b50 (रुपय|rupees)/

/** Screens the APK never draws: the website's pay form and its waiting screen. */
const WEBSITE_ONLY = /^(pay\.|wait\.)/

test('every line that names the ₹50 has an APK twin that does not', () => {
  for (const lang of ['mr', 'en'] as const) {
    for (const [key, value] of Object.entries(dictionaries[lang])) {
      if (key.endsWith('.apk') || WEBSITE_ONLY.test(key) || !PRICE.test(value)) continue
      const twin = dictionaries[lang][`${key}.apk`]
      assert.ok(twin, `${lang} ${key} names the price and has no .apk twin`)
      assert.ok(!PRICE.test(twin), `${lang} ${key}.apk still names the price`)
    }
  }
})

test('the twin is read only inside the APK', () => {
  assert.match(lookup('en', 'sub.renewButton', false), /₹50/)
  assert.doesNotMatch(lookup('en', 'sub.renewButton', true), /₹50/)
  // A key with no twin reads the same in both.
  assert.equal(lookup('mr', 'biz.slotsFull', true), lookup('mr', 'biz.slotsFull', false))
})

test('the APK is recognised by the bridge the wrapper injects, and nothing else', () => {
  assert.equal(inApk({ ReactNativeWebView: { postMessage() {} } }), true)
  assert.equal(inApk({}), false)
  assert.equal(inApk(undefined), false)
})
