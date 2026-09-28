import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyDb, type Db } from '../src/db/seed.js'
import { planPurge, sellerRecords } from '../src/db/purgeSellers.js'

/**
 * CLEARING THE TEST SELLERS BEFORE HANDOVER.
 *
 * A keep list, run once against the live database. The failure that matters
 * is deleting a real woman, so a keep ID that matches nobody stops the run,
 * and whatever a kept shop's buyer did stays with her.
 */

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort()

function world(): Db {
  const db = emptyDb()
  const row = <T>(r: object) => r as T
  db.sellers.push(row({ id: 'real', womenBizId: 'SMB-BHOSGA-01' }), row({ id: 'test', womenBizId: 'SMB-ANADUR-01' }))
  db.products.push(row({ id: 'p-real', sellerId: 'real' }), row({ id: 'p-test', sellerId: 'test' }))
  db.customers.push(row({ id: 'buyer' }), row({ id: 'tester' }), row({ id: 'browser' }), row({ id: 'banned', blocked: true }))
  db.orders.push(
    row({ id: 'o-real', sellerId: 'real', customerId: 'buyer' }),
    row({ id: 'o-test', sellerId: 'test', customerId: 'buyer' }),
    row({ id: 'o-tester', sellerId: 'test', customerId: 'tester' }),
  )
  db.payments.push(row({ id: 'pay-real', sellerId: 'real' }), row({ id: 'pay-test', sellerId: 'test' }))
  db.reviews.push(row({ id: 'r-real', orderId: 'o-real' }), row({ id: 'r-test', orderId: 'o-test' }))
  db.reports.push(
    row({ id: 'rep-kept', targetType: 'product', targetId: 'p-real', byRole: 'customer', byUserId: 'buyer' }),
    row({ id: 'rep-by-tester', targetType: 'product', targetId: 'p-real', byRole: 'customer', byUserId: 'tester' }),
    row({ id: 'rep-on-gone', targetType: 'review', targetId: 'r-test', byRole: 'seller', byUserId: 'real' }),
    row({ id: 'rep-on-shop', targetType: 'seller', targetId: 'real', byRole: 'customer', byUserId: 'buyer' }),
    row({ id: 'rep-on-banned', targetType: 'customer', targetId: 'banned', byRole: 'seller', byUserId: 'real' }),
  )
  db.sessions.push(
    row({ id: 'ss-admin', role: 'admin' }),
    row({ id: 'ss-real', role: 'seller', sellerId: 'real' }),
    row({ id: 'ss-buyer', role: 'customer', customerId: 'buyer' }),
    row({ id: 'ss-test', role: 'seller', sellerId: 'test' }),
    row({ id: 'ss-half', role: 'seller' }),
  )
  return db
}

test('a keep ID that matches nobody is reported, so the run stops before deleting the woman it meant', () => {
  assert.deepEqual(planPurge(world(), ['SMB-BHOSGA-01', 'SMB-BHOSGA-1']).missing, ['SMB-BHOSGA-1'])
})

test('everything of a seller not kept goes; a kept shop keeps its buyer, orders and reviews', () => {
  const { doomed, missing } = planPurge(world(), ['SMB-BHOSGA-01'])
  assert.deepEqual(missing, [])
  assert.deepEqual(ids(doomed.sellers), ['test'])
  assert.deepEqual(ids(doomed.products), ['p-test'])
  assert.deepEqual(ids(doomed.orders), ['o-test', 'o-tester'])
  assert.deepEqual(ids(doomed.payments), ['pay-test'])
  // `buyer` stays for o-real even though she also bought from a tester; the
  // one who never bought anything goes with the tester. `banned` stays too:
  // her ban is on her row, and deleting it would lift the ban.
  assert.deepEqual(ids(doomed.customers), ['browser', 'tester'])
  assert.deepEqual(ids(doomed.reviews), ['r-test'])
  // A report about a kept shop or a banned buyer is about someone still here.
  assert.deepEqual(ids(doomed.reports), ['rep-by-tester', 'rep-on-gone'])
  assert.deepEqual(ids(doomed.sessions), ['ss-half', 'ss-test'])
})

test('putting one seller back takes her orders and their buyers, and nobody else', () => {
  const back = sellerRecords(planPurge(world(), ['SMB-BHOSGA-01']).doomed, 'SMB-ANADUR-01')!
  assert.deepEqual(ids(back.orders), ['o-test', 'o-tester'])
  assert.deepEqual(ids(back.customers), ['tester'])
  assert.deepEqual(ids(back.reviews), ['r-test'])
  assert.equal(sellerRecords(planPurge(world(), []).doomed, 'SMB-NOBODY-01'), null)
})
