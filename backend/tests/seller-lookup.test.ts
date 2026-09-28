import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Seller } from '@shared/types.js'
import { normalizePhone, samePhone, phoneInput } from '@shared/seller.js'

/**
 * Why an already-registered seller was being asked to register again.
 *
 * Registration stored the phone exactly as she typed it. Login normalised the
 * number to digits before looking it up. "98765 43210" and "+91 9876543210"
 * therefore never matched the stored value, the lookup found nobody, and the
 * app concluded she was new - sending her back through registration, where
 * the duplicate check compared raw strings too and happily let her through.
 *
 * The fix is to compare normalised numbers on both sides, so old records
 * stored in any format still resolve without a migration.
 */

function seller(phone: string): Seller {
  return { id: 's1', name: 'अर्पिता', phone } as Seller
}

test('a phone number reduces to its ten digits', () => {
  assert.equal(normalizePhone('9876543210'), '9876543210')
  assert.equal(normalizePhone('98765 43210'), '9876543210')
  assert.equal(normalizePhone('+91 98765-43210'), '9876543210')
  assert.equal(normalizePhone('  8625981133  '), '8625981133')
})

test('a country code does not become part of the number', () => {
  // Otherwise "+919876543210" stores as 12 digits and never matches the 10
  // she types at login.
  assert.equal(normalizePhone('+919876543210'), '9876543210')
  assert.equal(normalizePhone('919876543210'), '9876543210')
  assert.equal(normalizePhone('09876543210'), '9876543210')
})

test('rubbish in does not throw', () => {
  assert.equal(normalizePhone(undefined), '')
  assert.equal(normalizePhone(''), '')
  assert.equal(normalizePhone('abc'), '')
})

test('two spellings of the same number are the same number', () => {
  assert.equal(samePhone('98765 43210', '9876543210'), true)
  assert.equal(samePhone('+91 9876543210', '9876543210'), true)
  assert.equal(samePhone('9876543210', '9876543211'), false)
})

test('an empty number never matches another empty one', () => {
  // Otherwise a seller with no phone stored would match every login attempt
  // that also had no phone, and hand over her account.
  assert.equal(samePhone('', ''), false)
  assert.equal(samePhone(undefined, ''), false)
})

test('a seller stored with a formatted number is still found at login', () => {
  const sellers = [seller('98765 43210')]
  const typedAtLogin = '9876543210'

  const found = sellers.find((s) => samePhone(s.phone, typedAtLogin))

  assert.ok(found, 'this is the bug: she was told to register again')
})

test('a seller stored with a country code is still found at login', () => {
  const sellers = [seller('+91 9876543210')]

  assert.ok(sellers.find((s) => samePhone(s.phone, '9876543210')))
})

test('a different number still does not match', () => {
  const sellers = [seller('9876543210')]

  assert.equal(sellers.find((s) => samePhone(s.phone, '9000000000')), undefined)
})

/**
 * The phone box used to cap the raw text at ten characters, so "+91 98220
 * 11223" stopped at "9198220112" - valid-looking, and somebody else's number.
 */
test('the phone box lands on the same ten digits typed or pasted', () => {
  assert.equal(phoneInput('+91 98220 11223'), '9822011223')
  assert.equal(phoneInput('098220 11223'), '9822011223')
  assert.equal(phoneInput('98220 11223'), '9822011223')

  // Typed one key at a time, never cut into a stranger's ten digits on the way.
  let box = ''
  for (const key of '+91 98220 11223') box = phoneInput(box + key)
  assert.equal(box, '9822011223')

  // Too many digits stay too many, visibly, rather than being trimmed to ten.
  assert.equal(phoneInput('98220112234'), '98220112234')
})
