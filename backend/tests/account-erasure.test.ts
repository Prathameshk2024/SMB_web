import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Order, Product, Review, Seller } from '@shared/types.js'
import { PRODUCT_PII_FIELDS, isClosedCustomerId } from '@shared/accountClose.js'
import { closeCustomer, scrubSeller } from '../src/db/accountClose.js'
import { purgeArchived } from '../src/db/moderation.js'
import { emptyDb, type Db } from '../src/db/seed.js'

/**
 * WHAT DELETION HAS TO REACH.
 *
 * The first version of the close erased the fields that were obviously her
 * and left the ones that were her by another name. Two of them mattered:
 *
 *   1. A buyer's id IS her phone number - `c-9876543210` - and it is the key
 *      `/orders/mine` looks up. Blanking the phone field on her orders while
 *      leaving the id on them erased nothing, and handed her the whole order
 *      history back the next time she signed in with the same number.
 *   2. A seller's listings - each a photograph she took, what she put in it,
 *      her licence number on it - were never touched, though the privacy
 *      policy said her photos go when she does.
 *
 * The rule here is the one the account-close test states: after the erasing,
 * her number appears NOWHERE in the database, however it was spelled.
 */

const DAY = 24 * 60 * 60 * 1000

function seller(over: Partial<Seller> = {}): Seller {
  return {
    id: 's1', womenBizId: 'SMB-ANADUR-01', name: 'सुनीता पाटील', phone: '9822011223',
    shopName: 'सुनीता गृहउद्योग', shopSlug: 'sunita-smb-anadur-01', status: 'ACTIVE',
    pincodes: ['413601'], digital: {}, ...over,
  } as Seller
}

/* ------------------------------------------------------------------ */
/* A deleted buyer does not get her account back                       */
/* ------------------------------------------------------------------ */

test("a closed buyer's number appears nowhere afterwards, id included", () => {
  const db: Db = emptyDb()
  const PHONE = '9876543210'
  const ID = `c-${PHONE}`
  db.customers.push({ id: ID, phone: PHONE, name: 'आशा', addresses: [], createdAt: '', updatedAt: '' })
  db.orders.push({
    id: 'o1', sellerId: 's1', customerId: ID, customerName: 'आशा', customerPhone: PHONE,
    address: 'घर क्र. 4', landmark: 'मंदिरासमोर', pincode: '413601', status: 'DELIVERED', total: 220,
  } as Order)
  db.reviews.push({ id: 'r1', customerId: ID, customerName: 'आशा', sellerId: 's1', productId: 'p1', rating: 5 } as Review)
  db.reports.push(
    { id: 'rep1', targetType: 'product', targetId: 'p1', reason: 'unsafe', byUserId: ID, byRole: 'customer', at: '' },
    { id: 'rep2', targetType: 'customer', targetId: ID, targetName: 'आशा', reason: 'noShow', byUserId: 's1', byRole: 'seller', at: '' },
  )
  db.complaints.push({ id: 'cmp1', byRole: 'customer', byUserId: ID, name: 'आशा', phone: PHONE, subject: 'order', message: 'ऑर्डर आले नाही', at: '' })
  db.sessions.push({
    id: 'b1', role: 'customer', userId: ID, customerId: ID, phone: PHONE,
    createdAt: '', lastSeenAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * DAY).toISOString(),
  })

  closeCustomer(db, ID, PHONE)

  const everything = JSON.stringify(db)
  assert.ok(!everything.includes(PHONE), `her number survived somewhere: ${everything}`)
  assert.ok(!everything.includes(ID))
  const o = db.orders[0]!
  assert.ok(isClosedCustomerId(o.customerId), 'the order points at a tombstone no sign-in can produce')
  assert.equal(o.landmark, undefined, 'the landmark is the doorstep and goes with the address')
  assert.equal(o.total, 220, 'the sale itself is untouched')
  assert.equal(db.reviews[0]!.customerId, o.customerId, 'one tombstone per closing: her rows still group')
  assert.equal(db.reports[0]!.byUserId, o.customerId)
  assert.equal(db.reports[1]!.targetName, 'ग्राहक', 'a report about her stops naming her')
  assert.equal(db.complaints[0]!.message, 'ऑर्डर आले नाही', 'what she wrote to the desk stays')
  assert.equal(db.complaints[0]!.phone, '', 'how to reach her does not')
  assert.equal(db.sessions[0]!.userId, o.customerId, 'her session rows carried the id too')
})

test('two buyers closing get two tombstones', () => {
  const db = emptyDb()
  db.orders.push(
    { id: 'o1', sellerId: 's1', customerId: 'c-9000000001', customerPhone: '9000000001', status: 'DELIVERED' } as Order,
    { id: 'o2', sellerId: 's1', customerId: 'c-9000000002', customerPhone: '9000000002', status: 'DELIVERED' } as Order,
  )
  closeCustomer(db, 'c-9000000001', '9000000001')
  closeCustomer(db, 'c-9000000002', '9000000002')
  assert.notEqual(db.orders[0]!.customerId, db.orders[1]!.customerId, 'or two strangers would share an order history')
})

/* ------------------------------------------------------------------ */
/* Her listings and her complaints go with her                         */
/* ------------------------------------------------------------------ */

test('her listings are emptied and their photographs destroyed', () => {
  const s = seller({ fssai: '12345678901234', closeNote: 'मी गाव सोडले' })
  const db = emptyDb()
  db.sellers.push(s)
  db.products.push(
    { id: 'p1', sellerId: 's1', name: 'लोणचे', nameEn: 'Pickle', status: 'LIVE', imageUrl: 'https://x/a.jpg', imagePublicId: 'smb/product/a', ingredients: 'आंबा, मीठ', fssai: '12345678901234', price: 120 } as Product,
    { id: 'p2', sellerId: 's1', name: 'पापड', status: 'PAUSED', imagePublicId: 'smb/product/b', price: 60 } as Product,
    { id: 'p9', sellerId: 's2', name: 'चिवडा', status: 'LIVE', imagePublicId: 'smb/product/z', price: 80 } as Product,
  )
  db.complaints.push({ id: 'c1', byRole: 'seller', byUserId: 's1', name: 'सुनीता पाटील', phone: '9822011223', womenBizId: 'SMB-ANADUR-01', subject: 'payment', message: 'भरणा मंजूर झाला नाही', at: '' })

  const destroyed: (string | undefined)[] = []
  scrubSeller(db, s, Date.now(), (id) => destroyed.push(id))

  assert.ok(destroyed.includes('smb/product/a') && destroyed.includes('smb/product/b'), 'both photos go')
  assert.ok(!destroyed.includes('smb/product/z'), "and nobody else's")
  for (const p of db.products.filter((x) => x.sellerId === 's1')) {
    assert.equal(p.status, 'ARCHIVED', `${p.id} is a tombstone`)
    for (const field of PRODUCT_PII_FIELDS) {
      const left = (p as unknown as Record<string, unknown>)[field]
      assert.ok(left === undefined || left === '', `${p.id}.${field} survived: ${JSON.stringify(left)}`)
    }
  }
  assert.equal(db.products.find((p) => p.id === 'p9')!.name, 'चिवडा', 'the other shop is untouched')
  assert.equal(s.fssai, undefined, 'her licence number is issued to her by name')
  assert.equal(s.shopSlug, '', 'the share link built from her shop name stops answering')
  assert.equal(s.closeNote, undefined)
  const c = db.complaints[0]!
  assert.equal(c.message, 'भरणा मंजूर झाला नाही', 'her words to the desk stay')
  assert.equal(c.phone, '')
  assert.equal(c.name, 'बंद केलेले दुकान')
  assert.ok(!JSON.stringify(db).includes('9822011223'), 'and her number is nowhere')
})

/**
 * A report copies the name of what it is about, so the admin queue reads
 * without joins - and so every report about her shop was a copy of her shop's
 * name, and every report about a listing a copy of the name `scrubProducts`
 * had just emptied. The privacy policy keeps reports without those names.
 */
test('reports about her shop and her listings stop naming them', () => {
  const s = seller()
  const db = emptyDb()
  db.sellers.push(s)
  db.products.push({ id: 'p1', sellerId: 's1', name: 'आंब्याचे लोणचे', status: 'LIVE', price: 120 } as Product)
  db.reviews.push({ id: 'r1', customerId: 'c-9000000001', customerName: 'आशा', sellerId: 's1', productId: 'p1', productName: 'आंब्याचे लोणचे', rating: 1, comment: 'खराब' } as Review)
  db.reports.push(
    { id: 'rep1', targetType: 'product', targetId: 'p1', sellerId: 's1', targetName: 'आंब्याचे लोणचे', reason: 'unsafe', byUserId: 'c-9000000001', byRole: 'customer', at: '' },
    { id: 'rep2', targetType: 'seller', targetId: 's1', sellerId: 's1', targetName: 'सुनीता गृहउद्योग', reason: 'other', note: 'सुनीताताईंनी पैसे घेतले', byUserId: 'c-9000000001', byRole: 'customer', at: '' },
    { id: 'rep3', targetType: 'review', targetId: 'r1', sellerId: 's1', targetName: 'आंब्याचे लोणचे', reason: 'offensive', byUserId: 's1', byRole: 'seller', at: '' },
    { id: 'rep9', targetType: 'seller', targetId: 's2', sellerId: 's2', targetName: 'गीता मसाले', reason: 'scam', byUserId: 'c-9000000001', byRole: 'customer', at: '' },
  )

  scrubSeller(db, s, Date.now(), () => {})

  for (const id of ['rep1', 'rep2', 'rep3']) {
    const r = db.reports.find((x) => x.id === id)!
    assert.equal(r.targetName, 'बंद केलेले दुकान', `${id} stops naming her`)
    assert.equal(r.note, undefined, `${id} loses the words written about her`)
  }
  assert.equal(db.reports.find((x) => x.id === 'rep1')!.reason, 'unsafe', 'the reason is the record, and it stays')
  assert.equal(db.reports.find((x) => x.id === 'rep9')!.targetName, 'गीता मसाले', "another shop's report is untouched")

  // Reviews stay, with the product's name: they are the buyer's words about
  // something she bought, and the privacy policy says they are kept. So the
  // one place her product's name may survive is a review - nowhere else.
  const rest = JSON.stringify({ ...db, reviews: [] })
  assert.ok(!rest.includes('सुनीता'), 'her name is nowhere, the shop name that carried it included')
  assert.ok(!rest.includes('आंब्याचे लोणचे'), "her listing's name is nowhere but on the review")
  assert.equal(db.reviews[0]!.productName, 'आंब्याचे लोणचे')
})

/**
 * Tombstones wait for a moment when removing them is an ordinary write.
 * Four of six rows would be refused by the persist and leave memory and the
 * server disagreeing; four of forty is nothing.
 */
test('tombstones are swept only when that is not a bulk delete', () => {
  const small = [
    ...['a', 'b'].map((id) => ({ id, sellerId: 's2', status: 'LIVE' } as Product)),
    ...['c', 'd', 'e', 'f'].map((id) => ({ id, sellerId: 's1', status: 'ARCHIVED' } as Product)),
  ]
  assert.equal(purgeArchived(small), 0, 'four of six waits')
  assert.equal(small.length, 6)

  const big = [
    ...Array.from({ length: 36 }, (_, i) => ({ id: `l${i}`, sellerId: 's2', status: 'LIVE' } as Product)),
    ...['c', 'd', 'e', 'f'].map((id) => ({ id, sellerId: 's1', status: 'ARCHIVED' } as Product)),
  ]
  assert.equal(purgeArchived(big), 4)
})
