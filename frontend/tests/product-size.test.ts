import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CartItem, OrderItem } from '@shared/types.js'
import { sizeLabel } from '@shared/seller.js'

/**
 * WHAT ONE OF THESE IS, on every screen that shows a price.
 *
 * The cart once printed its quantity beside the unit - "1 kg × ₹400" for one
 * 50 kg pack - because a cart line carried the unit and not the size. `qty`
 * counts packs. A buyer reading "₹400 for 1 kg" of something sold at ₹400 for
 * 50 kg has been told a price fifty times what it is, on the screen where she
 * decides to pay it.
 */

const units: Record<string, string> = {
  'unit.kg': 'kg', 'unit.g': 'g', 'unit.set': 'set', 'unit.piece': 'piece',
}
const t = (key: string) => units[key] ?? key

const line = (over: Partial<CartItem> = {}): CartItem => ({
  productId: 'p1', sellerId: 's1', name: 'अनारसे', emoji: '', price: 400,
  unit: 'kg', qty: 1, ...over,
})

test('a cart line says the size of one pack, whatever the quantity', () => {
  assert.equal(sizeLabel(line({ packSize: 50 }), t), '50 kg')
  assert.equal(sizeLabel(line({ packSize: 50, qty: 3 }), t), '50 kg')
  assert.equal(sizeLabel(line({ unit: 'g', packSize: 500 }), t), '500 g')
})

test('a set says what is inside it', () => {
  assert.equal(sizeLabel(line({ unit: 'set', packSize: 1, piecesPerPack: 6 }), t), '1 set (6 piece)')
})

/**
 * A cart saved on the phone before lines carried a size, or a listing from
 * before the size was asked, has only the unit - and the unit alone is still
 * true. A made-up "1" in front of it is what this test exists to stop.
 */
test('with no size known, the unit alone - never a number invented for it', () => {
  assert.equal(sizeLabel(line(), t), 'kg')
})

/**
 * Each line of an ORDER carries the size too, copied at checkout, so the
 * seller's "2 × ₹400" says two of what - and still says it after the listing
 * is edited or gone. An order placed before sizes were copied has no unit at
 * all, and prints nothing rather than a size guessed from today's listing.
 */
test('an order line prints the size it was bought at', () => {
  const orderLine: OrderItem = {
    productId: 'p1', name: 'अनारसे', emoji: '', qty: 2, price: 400, unit: 'kg', packSize: 50,
  }
  assert.equal(sizeLabel(orderLine, t), '50 kg')
})

test('an order from before sizes were copied prints none', () => {
  const old: OrderItem = { productId: 'p1', name: 'अनारसे', emoji: '', qty: 2, price: 400 }
  assert.equal(sizeLabel(old, t), '')
})
