import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Customer, Order, Product, Review, Seller } from '@shared/types.js'
import { closeReports, fileReport, reportedBuyers, reportsBySeller } from '../src/db/reports.js'
import { emptyDb, type Db } from '../src/db/seed.js'

/**
 * REPORTING A SHOP OR A BUYER.
 *
 * Play's User Generated Content policy asks for a way to report the account
 * behind a post, not only the post. The risk in adding it is the opposite
 * of the risk in leaving it out: a report is a line in a queue that a
 * person acts on, so it must not be possible to file one against somebody
 * you have never met through the app. These tests hold that line.
 */

const NOW = Date.parse('2026-09-27T10:00:00.000Z')

function dbWith(): Db {
  const db = emptyDb()
  db.sellers.push(
    { id: 's1', shopName: 'सुनीता गृहउद्योग', phone: '9822011223', status: 'ACTIVE' } as Seller,
    { id: 's2', shopName: 'आशा फूड्स', phone: '9822000000', status: 'ACTIVE' } as Seller,
    { id: 's9', shopName: 'बंद केलेले दुकान', phone: '', status: 'CLOSED', closedAt: '2026-01-01T00:00:00.000Z' } as Seller,
  )
  db.products.push({ id: 'p1', sellerId: 's1', name: 'लोणचे', status: 'LIVE' } as Product)
  db.reviews.push({ id: 'r1', sellerId: 's1', productId: 'p1', productName: 'लोणचे', customerId: 'c-9011223344' } as Review)
  db.customers.push({ id: 'c-9011223344', phone: '9011223344', name: 'प्रिया', addresses: [] } as Customer)
  db.orders.push(
    { id: 'SMB1', sellerId: 's1', customerId: 'c-9011223344', customerName: 'प्रिया', customerPhone: '9011223344', status: 'DELIVERED', placedAt: '2026-09-01T00:00:00.000Z' } as Order,
    { id: 'SMB2', sellerId: 's2', customerId: 'c-9011223344', customerName: 'प्रिया', customerPhone: '9011223344', status: 'CANCELLED', placedAt: '2026-09-02T00:00:00.000Z' } as Order,
  )
  return db
}

const buyer = { byRole: 'customer' as const, byUserId: 'c-9011223344' }
const sunita = { byRole: 'seller' as const, byUserId: 's1' }

test('a buyer can report the shop itself, and the row names the shop', () => {
  const db = dbWith()
  const r = fileReport(db, { ...buyer, targetType: 'seller', targetId: 's1', reason: 'noDelivery' }, NOW)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.report.sellerId, 's1')
  assert.equal(r.report.targetName, 'सुनीता गृहउद्योग')
  assert.deepEqual([...reportsBySeller(db).keys()], ['s1'], 'and it is on her row in the register')
})

test('a seller can report a buyer only from an order between them', () => {
  const db = dbWith()
  const r = fileReport(db, { ...sunita, targetType: 'customer', targetId: 'c-9011223344', reason: 'noShow' }, NOW)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.report.orderId, 'SMB1', 'the order the desk will ask about')

  // Asha (s2) has an order with the same buyer; a third seller does not.
  db.sellers.push({ id: 's3', shopName: 'x', status: 'ACTIVE' } as Seller)
  const stranger = fileReport(db, { byRole: 'seller', byUserId: 's3', targetType: 'customer', targetId: 'c-9011223344', reason: 'noShow' }, NOW)
  assert.equal(stranger.ok, false)
  if (stranger.ok) return
  assert.equal(stranger.status, 404, 'the same answer as a buyer who does not exist')
})

test('naming an order that is not between them is refused', () => {
  const db = dbWith()
  // SMB2 is Asha's order with this buyer, not Sunita's.
  const r = fileReport(db, { ...sunita, targetType: 'customer', targetId: 'c-9011223344', reason: 'noShow', orderId: 'SMB2' }, NOW)
  assert.equal(r.ok, false)
})

test('who may report what is enforced, as 403 rather than 404', () => {
  const db = dbWith()
  // A seller reporting a listing would be reporting a rival.
  const rival = fileReport(db, { ...sunita, targetType: 'product', targetId: 'p1', reason: 'wrongInfo' }, NOW)
  assert.equal(rival.ok, false)
  if (!rival.ok) assert.equal(rival.status, 403)
  // A buyer has never met another buyer through the app.
  const peer = fileReport(db, { ...buyer, targetType: 'customer', targetId: 'c-9011223344', reason: 'abusive' }, NOW)
  assert.equal(peer.ok, false)
  if (!peer.ok) assert.equal(peer.status, 403)
  // The seller may still flag a review written about her products.
  const review = fileReport(db, { ...sunita, targetType: 'review', targetId: 'r1', reason: 'offensive' }, NOW)
  assert.equal(review.ok, true)
})

test('a reason has to be one the target offers', () => {
  const db = dbWith()
  const r = fileReport(db, { ...buyer, targetType: 'seller', targetId: 's1', reason: 'unsafe' }, NOW)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal('reason' in (r.fields ?? {}), true)
})

test('an erased shop is nobody\'s to report', () => {
  const db = dbWith()
  const r = fileReport(db, { ...buyer, targetType: 'seller', targetId: 's9', reason: 'scam' }, NOW)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 404)
})

test('a second tap is the same report, not a second complaint', () => {
  const db = dbWith()
  const first = fileReport(db, { ...buyer, targetType: 'seller', targetId: 's1', reason: 'scam' }, NOW)
  const again = fileReport(db, { ...buyer, targetType: 'seller', targetId: 's1', reason: 'other', note: 'खूप उशीर' }, NOW + 1000)
  assert.equal(again.ok && again.duplicate, true)
  assert.equal(db.reports.length, 1)
  if (first.ok && again.ok) assert.equal(again.report.id, first.report.id)
})

/**
 * A buyer has no page in the console, so the reported-buyers list is her
 * page: name and number to ring, read off her record at request time, and
 * whether she is already blocked.
 */
test('reported buyers are grouped, with her number and her block state', () => {
  const db = dbWith()
  fileReport(db, { ...sunita, targetType: 'customer', targetId: 'c-9011223344', reason: 'noShow' }, NOW)
  fileReport(db, { byRole: 'seller', byUserId: 's2', targetType: 'customer', targetId: 'c-9011223344', reason: 'abusive' }, NOW + 1)

  const [row, ...rest] = reportedBuyers(db)
  assert.equal(rest.length, 0, 'one buyer, however many sellers reported her')
  assert.equal(row!.phone, '9011223344')
  assert.equal(row!.name, 'प्रिया')
  assert.equal(row!.blocked, false)
  assert.equal(row!.reports.length, 2)
  assert.equal(row!.reports[0]!.reason, 'abusive', 'newest first')

  db.customers[0]!.blocked = true
  assert.equal(reportedBuyers(db)[0]!.blocked, true, 'read live, never copied onto the report')
})

test('a buyer with no record is still found through her orders', () => {
  const db = dbWith()
  db.customers.length = 0
  fileReport(db, { ...sunita, targetType: 'customer', targetId: 'c-9011223344', reason: 'noShow' }, NOW)
  assert.equal(reportedBuyers(db)[0]!.phone, '9011223344')
})

test('clearing closes the reports and keeps them, with who looked', () => {
  const db = dbWith()
  fileReport(db, { ...buyer, targetType: 'seller', targetId: 's1', reason: 'scam' }, NOW)
  assert.equal(closeReports(db, 's1', 'Jyoti <j@example.com>', NOW + 5000), 1)
  assert.equal(db.reports.length, 1, 'closed, not deleted')
  assert.equal(db.reports[0]!.reviewedBy, 'Jyoti <j@example.com>')
  assert.equal(reportsBySeller(db).size, 0, 'and off the queue')
  // The next report starts a new row rather than being swallowed as a duplicate.
  const next = fileReport(db, { ...buyer, targetType: 'seller', targetId: 's1', reason: 'scam' }, NOW + 9000)
  assert.equal(next.ok && !next.duplicate, true)
})
