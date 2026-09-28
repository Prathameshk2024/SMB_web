import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_PHONE, demoHidden, demoOrderProblem, isDemoSeller, isDemoViewer } from '../src/demo.js'
import { SEND_LIMIT_EXEMPT } from '../src/auth/rateLimit.js'

/**
 * THE DEMO ACCOUNT, KEPT AWAY FROM REAL PEOPLE.
 *
 * Google Play's reviewers sign in with one number as both a seller and a
 * buyer. A reviewer who orders from a real woman has made her cook for
 * nobody; a real buyer who finds the demo shop has been shown a stall that
 * never delivers. Both are stopped on the server, because reviewers do not
 * read instructions and buyers do not know which shop is the demo.
 */

const demoShop = { phone: DEMO_PHONE }
const realShop = { phone: '9822011223' }
const demoBuyer = { role: 'customer', phone: DEMO_PHONE }
const realBuyer = { role: 'customer', phone: '9011223344' }

test('one number is the demo account, and the send-limit exemption is built from it', () => {
  assert.equal(isDemoSeller(demoShop), true)
  assert.equal(isDemoSeller({ phone: '+91 99999 99999' }), true, 'however the record spells it')
  assert.equal(isDemoSeller(realShop), false)
  assert.equal(isDemoViewer(demoBuyer), true)
  assert.equal(isDemoViewer(undefined), false)
  assert.deepEqual([...SEND_LIMIT_EXEMPT], [DEMO_PHONE], 'two copies of the number is one that drifts')
})

test('the demo shop is hidden from everyone but the demo buyer', () => {
  assert.equal(demoHidden(demoShop, realBuyer), true)
  assert.equal(demoHidden(demoShop, undefined), true, 'and from anyone not signed in')
  assert.equal(demoHidden(demoShop, demoBuyer), false)
  assert.equal(demoHidden(demoShop, { role: 'seller', phone: DEMO_PHONE }), false, 'or the demo seller looking at her own shop')
})

test('a real shop is never hidden, whoever is looking', () => {
  assert.equal(demoHidden(realShop, demoBuyer), false)
  assert.equal(demoHidden(realShop, realBuyer), false)
  assert.equal(demoHidden(undefined, realBuyer), false)
})

test('the demo buyer orders from the demo shop and nowhere else', () => {
  assert.equal(demoOrderProblem(demoShop, demoBuyer), null)
  const problem = demoOrderProblem(realShop, demoBuyer)
  assert.ok(problem, 'a reviewer must not make a real woman cook for nobody')
  assert.match(problem!.messageMr, /डेमो/)
})

test('a real buyer never orders from the demo shop', () => {
  assert.ok(demoOrderProblem(demoShop, realBuyer))
  assert.equal(demoOrderProblem(realShop, realBuyer), null)
})
