import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownImageProblem } from '../src/db/images.js'
import { screenshotProblem } from '../src/db/payments.js'
import { CATEGORIES, isCategoryId } from '../src/db/seed.js'

/**
 * A URL IS A URL.
 *
 * A seller's photo, her bank's QR image and every product picture are stored
 * as URLs and reach buyers - the QR on the checkout of every one of her
 * orders. The routes used to accept whatever they were sent. Only an image
 * that came through the app's own picker, into this Cloudinary account's
 * folders, can be one of ours; the payment screenshot has followed that
 * rule since it was required, and now everything else does too.
 */

const cloud = { cloudName: 'smb-live', folder: 'shanta-mahila-bazar' }
const ours = (kind: string) => `https://res.cloudinary.com/smb-live/image/upload/v1726/shanta-mahila-bazar/${kind}/abc123.jpg`

test('an image uploaded through the app is accepted; absent is fine', () => {
  assert.equal(ownImageProblem(ours('product'), cloud, 'product'), null)
  assert.equal(ownImageProblem(undefined, cloud, 'product'), null, 'no photo is a choice, not a fault')
  assert.equal(ownImageProblem('', cloud, 'product'), null)
})

test('a pasted link is refused, wherever it points', () => {
  assert.ok(ownImageProblem('https://example.com/qr.png', cloud, 'product'))
  assert.ok(ownImageProblem('https://res.cloudinary.com/somebody-else/image/upload/v1/shanta-mahila-bazar/product/x.jpg', cloud, 'product'), 'another account')
  assert.ok(ownImageProblem('https://res.cloudinary.com/smb-live/image/upload/v1/other-app/product/x.jpg', cloud, 'product'), 'another folder in ours')
  assert.ok(ownImageProblem(42, cloud, 'product'), 'not even a string')
})

test('a payment screenshot cannot stand in for a product photo, or the reverse', () => {
  assert.ok(ownImageProblem(ours('payment'), cloud, 'product'))
  assert.ok(ownImageProblem(ours('product'), cloud, 'payment'))
  assert.equal(screenshotProblem(ours('payment'), cloud), null, 'and the screenshot rule is the same rule')
  assert.ok(screenshotProblem(ours('product'), cloud))
})

test('with uploads off, nothing can have been uploaded, so any URL is a pasted one', () => {
  assert.ok(ownImageProblem('https://example.com/x.jpg', null, 'product'))
  assert.equal(ownImageProblem(undefined, null, 'product'), null)
})

/**
 * THE CATEGORY LIST IS THE LIST. A listing filed under an id nobody has
 * heard of falls out of every category filter; there was a `pickles`,
 * plural, in production.
 */
test('a category id is one from the list, and nothing else', () => {
  for (const c of CATEGORIES) assert.equal(isCategoryId(c.id), true, c.id)
  assert.equal(isCategoryId('pickles'), false, 'plural is not a category')
  assert.equal(isCategoryId(''), false)
  assert.equal(isCategoryId(undefined), false)
  assert.equal(isCategoryId({ id: 'pickle' }), false)
})

test('the beauty category no longer names health', () => {
  // A category named for wellness invites the cure claims the terms forbid.
  const beauty = CATEGORIES.find((c) => c.id === 'beauty')!
  assert.doesNotMatch(beauty.en, /wellness|health/i)
  assert.doesNotMatch(beauty.mr, /आरोग्य/)
})
