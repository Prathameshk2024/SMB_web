import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dictionaries } from '../src/i18n/strings.js'

/**
 * THE OFFICE MUST KNOW WHO IS ASKING.
 *
 * Both Help buttons open WhatsApp to the office with a message typed for her.
 * A blank chat from an unknown number was answered with "who is this, which
 * shop?"; these three details are what let the office find her in the console
 * before replying. A rewording that drops one puts that question back.
 */
test('both WhatsApp help messages carry her name, SMB number and phone, in both languages', () => {
  for (const lang of ['mr', 'en'] as const) {
    for (const key of ['help.waRegistered', 'help.waGeneral']) {
      const text = dictionaries[lang][key]
      assert.ok(text, `${lang} ${key} is missing`)
      for (const slot of ['{name}', '{id}', '{phone}']) {
        assert.ok(text.includes(slot), `${lang} ${key} lost ${slot}`)
      }
    }
  }
})
