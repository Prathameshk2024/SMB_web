import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@shared/types.js'
import { blockCustomer, blockedBuyers, customerIdFor, ensureCustomer, isCustomerBlocked } from '../src/db/customers.js'
import { closeCustomer } from '../src/db/accountClose.js'
import { createSession, findLiveSession } from '../src/auth/sessions.js'
import { revokeAllForUser } from '../src/auth/sessions.js'
import { emptyDb, type Db } from '../src/db/seed.js'

/**
 * BLOCKING A BUYER.
 *
 * Closing an account is not a ban: the row is rebuilt from the phone the
 * moment she signs in again. A buyer who orders and never opens the door,
 * or who is abusive on the phone to a woman cooking for her, needs to be
 * refused the market, and the refusal has to survive everything she can
 * do from her side - signing out, deleting the account, signing in again.
 */

const NOW = Date.parse('2026-09-27T10:00:00.000Z')
const BY = 'Jyoti Hattarge <jyotihattarge@gmail.com>'
const PHONE = '9011223344'
const ID = customerIdFor(PHONE)
const revoke = (db: Db, userId: string, now: number) => revokeAllForUser(db, userId, 'admin', now)

test('a block needs a 10-digit number and a reason', () => {
  const db = emptyDb()
  assert.equal(blockCustomer(db, '90112', { blocked: true, reason: 'x' }, BY, revoke, NOW).ok, false)
  const noReason = blockCustomer(db, PHONE, { blocked: true }, BY, revoke, NOW)
  assert.equal(noReason.ok, false, 'refusing somebody a market is a judgement somebody has to stand behind')
  assert.equal(isCustomerBlocked(db, ID), false)
})

test('a number with no record yet can be blocked, and the record is made for it', () => {
  const db = emptyDb()
  const r = blockCustomer(db, PHONE, { blocked: true, reason: 'ordered four times, never took delivery' }, BY, revoke, NOW)
  assert.equal(r.ok, true)
  assert.equal(isCustomerBlocked(db, ID), true)
  assert.equal(db.customers[0]!.blockedBy, BY)
  assert.equal(db.customers[0]!.blockedAt, new Date(NOW).toISOString())
})

test('blocking signs her out everywhere at once', () => {
  const db = emptyDb()
  ensureCustomer(db, ID, PHONE, 'प्रिया')
  const s = createSession(db, { role: 'customer', userId: ID, phone: PHONE, customerId: ID })
  assert.ok(findLiveSession(db, s.id, NOW))

  blockCustomer(db, PHONE, { blocked: true, reason: 'abusive to a seller' }, BY, revoke, NOW)
  assert.ok(!findLiveSession(db, s.id, NOW), 'the token in her phone opens nothing now')
})

test('deleting the account does not lift the block', () => {
  const db = emptyDb()
  ensureCustomer(db, ID, PHONE, 'प्रिया')
  db.customers[0]!.addresses.push({ id: 'a1', label: 'घर', line: 'गल्ली 4', pincode: '413601', isDefault: true })
  db.orders.push({ id: 'SMB1', sellerId: 's1', customerId: ID, customerName: 'प्रिया', customerPhone: PHONE, address: 'गल्ली 4', status: 'DELIVERED' } as Order)
  blockCustomer(db, PHONE, { blocked: true, reason: 'never took delivery' }, BY, revoke, NOW)

  closeCustomer(db, ID, PHONE, NOW)

  assert.equal(isCustomerBlocked(db, ID), true, 'she signs in again and is still refused')
  const row = db.customers[0]!
  assert.equal(row.name, '', 'but she is erased from the row')
  assert.deepEqual(row.addresses, [])
  assert.equal(db.orders[0]!.customerPhone, '', 'and from her orders, exactly as for anyone else')
})

test('deleting an unblocked account removes the row, as before', () => {
  const db = emptyDb()
  ensureCustomer(db, ID, PHONE, 'प्रिया')
  closeCustomer(db, ID, PHONE, NOW)
  assert.equal(db.customers.length, 0)
})

test('blocking a number already blocked is refused, and keeps who blocked it and why', () => {
  const db = emptyDb()
  blockCustomer(db, PHONE, { blocked: true, reason: 'first reason' }, BY, revoke, NOW)
  const again = blockCustomer(db, PHONE, { blocked: true, reason: 'second reason' }, 'Someone else', revoke, NOW + 1)
  assert.equal(again.ok, false, 'the desk is told it is already blocked, not "blocked" again')
  assert.equal(db.customers[0]!.blockReason, 'first reason')
  assert.equal(db.customers[0]!.blockedBy, BY)
})

test('unblocking a number that is not blocked is refused, and makes no record for it', () => {
  const db = emptyDb()
  const r = blockCustomer(db, PHONE, { blocked: false }, BY, revoke, NOW)
  assert.equal(r.ok, false)
  assert.equal(db.customers.length, 0, 'a stranger\'s number is not written down by a mistyped unblock')
})

test('the blocked list holds every blocked number, typed-in ones included, and loses one when lifted', () => {
  const db = emptyDb()
  ensureCustomer(db, customerIdFor('9876543210'), '9876543210', 'सीमा')
  blockCustomer(db, PHONE, { blocked: true, reason: 'x' }, BY, revoke, NOW)
  assert.deepEqual(blockedBuyers(db).map((b) => b.phone), [PHONE], 'only blocked numbers are listed')
  assert.equal(blockedBuyers(db)[0]!.blockReason, 'x')

  blockCustomer(db, PHONE, { blocked: false }, BY, revoke, NOW + 1)
  assert.deepEqual(blockedBuyers(db), [])
})

test('unblocking clears every stamp', () => {
  const db = emptyDb()
  blockCustomer(db, PHONE, { blocked: true, reason: 'x' }, BY, revoke, NOW)
  const r = blockCustomer(db, PHONE, { blocked: false }, BY, revoke, NOW + 1)
  assert.equal(r.ok, true)
  assert.equal(isCustomerBlocked(db, ID), false)
  assert.equal(db.customers[0]!.blockReason, undefined)
  assert.equal(db.customers[0]!.blockedBy, undefined)
})
