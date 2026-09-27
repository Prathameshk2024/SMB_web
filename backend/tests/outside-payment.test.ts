import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Product, Seller, SubscriptionPayment } from '@shared/types.js'
import { recordOutsidePayment } from '../src/db/subscription.js'

/**
 * THE ₹50 TAKEN OUTSIDE THE APP.
 *
 * Google Play will not let the APK sell slots or time with anything but its
 * own billing, so the APK shows no price and no pay screen. She pays the
 * college desk or a coordinator, and staff record it. A recorded payment must
 * do exactly what an approved one from the queue does - or a woman who paid
 * in cash gets less for her ₹50 than one who paid through the website.
 */

const NOW = new Date('2026-09-27T06:30:00.000Z')
const DAY = 86_400_000

function seller(over: Partial<Seller> = {}): Seller {
  return {
    id: 's1', name: 'Sunita', phone: '9822011223', womenBizId: 'SMB-ANADUR-01',
    status: 'REGISTERED', isOpen: true, packsApproved: 0, notices: [],
    ...over,
  } as Seller
}

function db(payments: SubscriptionPayment[] = [], products: Product[] = []) {
  return { payments, products }
}

const cash = { kind: 'PACK', method: 'CASH', paidAt: NOW.toISOString() }

test('a first pack paid in cash opens her shop for six months, as an approval would', () => {
  const s = seller()
  const d = db()
  const r = recordOutsidePayment(d, s, cash, 'Desk <desk@example.com>', NOW)
  assert.ok('payment' in r)
  assert.equal(s.status, 'ACTIVE')
  assert.equal(s.packsApproved, 1)
  assert.equal(s.subscriptionEndsAt, '2027-03-27T06:30:00.000Z')
  assert.equal(r.payment.status, 'APPROVED')
  assert.equal(r.payment.method, 'CASH')
  assert.equal(r.payment.verifiedBy, 'Desk <desk@example.com>')
  assert.equal(d.payments.length, 1)
  // She is told in her own updates list, the same notice the queue writes.
  assert.equal(s.notices.at(-1)?.kind, 'PAYMENT_APPROVED')
})

/** The reason this form exists: grant-slots never moves the date. */
test('a renewal recorded in the reminder week adds six months to the current end', () => {
  const ends = new Date(NOW.getTime() + 3 * DAY).toISOString()
  const s = seller({ status: 'ACTIVE', packsApproved: 1, subscriptionEndsAt: ends })
  const r = recordOutsidePayment(db(), s, { ...cash, kind: 'RENEWAL' }, 'Desk', NOW)
  assert.ok('payment' in r)
  assert.equal(s.packsApproved, 1)
  assert.ok(new Date(s.subscriptionEndsAt!).getTime() > new Date(ends).getTime() + 150 * DAY)
})

test('one ₹50 cannot be counted twice: refused while one of hers waits in the queue', () => {
  const pending = { id: 'p0', sellerId: 's1', status: 'PENDING', utr: '111122223333' } as SubscriptionPayment
  const r = recordOutsidePayment(db([pending]), seller(), cash, 'Desk', NOW)
  assert.ok('status' in r)
  assert.equal(r.status, 409)
})

test('a UTR already on file is refused, and UPI to the college needs one', () => {
  const used = { id: 'p0', sellerId: 's9', status: 'APPROVED', utr: '512309887711' } as SubscriptionPayment
  const dup = recordOutsidePayment(db([used]), seller(), { ...cash, method: 'UPI', utr: '5123 0988 7711' }, 'Desk', NOW)
  assert.ok('status' in dup && dup.status === 409)
  const none = recordOutsidePayment(db(), seller(), { ...cash, method: 'UPI' }, 'Desk', NOW)
  assert.ok('status' in none && none.status === 400)
})

test('staff cannot sell her what her own screen would not: slots while she has empty ones', () => {
  const s = seller({ status: 'ACTIVE', packsApproved: 1, subscriptionEndsAt: '2027-03-01T00:00:00.000Z' })
  const r = recordOutsidePayment(db(), s, cash, 'Desk', NOW)
  assert.ok('status' in r && r.status === 409)
  assert.equal(s.packsApproved, 1)
})

test('nothing is recorded for a closed account, an unknown method or a time in the future', () => {
  for (const [over, input] of [
    [{ status: 'CLOSED' }, cash],
    [{}, { ...cash, method: 'CHEQUE' }],
    [{}, { ...cash, paidAt: new Date(NOW.getTime() + DAY).toISOString() }],
  ] as const) {
    const d = db()
    const r = recordOutsidePayment(d, seller(over as Partial<Seller>), input, 'Desk', NOW)
    assert.ok('status' in r)
    assert.equal(d.payments.length, 0)
  }
})
