import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_PHONES, demoHidden, demoOrderProblem, isDemoSeller, isDemoViewer } from '../src/demo.js'
import { SEND_LIMIT_EXEMPT } from '../src/auth/rateLimit.js'

/**
 * THE DEMO ACCOUNT, KEPT AWAY FROM REAL PEOPLE.
 *
 * Google Play's reviewers sign in with a demo number as both a seller and a
 * buyer. A reviewer who orders from a real woman has made her cook for
 * nobody; a real buyer who finds the demo shop has been shown a stall that
 * never delivers. Both are stopped on the server, because reviewers do not
 * read instructions and buyers do not know which shop is the demo.
 */

const [DEMO_A, DEMO_B] = DEMO_PHONES
const demoShop = { phone: DEMO_A }
const otherDemoShop = { phone: DEMO_B }
const realShop = { phone: '9822011223' }
const demoBuyer = { role: 'customer', phone: DEMO_A }
const otherDemoBuyer = { role: 'customer', phone: DEMO_B }
const realBuyer = { role: 'customer', phone: '9011223344' }

test('the demo numbers are the demo accounts, and the send-limit exemption is built from them', () => {
  assert.equal(DEMO_PHONES.length, 2)
  assert.equal(isDemoSeller(demoShop), true)
  assert.equal(isDemoSeller(otherDemoShop), true)
  assert.equal(isDemoSeller({ phone: '+91 99999 99999' }), true, 'however the record spells it')
  assert.equal(isDemoSeller({ phone: '+91 95796 42050' }), true)
  assert.equal(isDemoSeller(realShop), false)
  assert.equal(isDemoViewer(demoBuyer), true)
  assert.equal(isDemoViewer(otherDemoBuyer), true)
  assert.equal(isDemoViewer(undefined), false)
  assert.deepEqual([...SEND_LIMIT_EXEMPT], [...DEMO_PHONES], 'two copies of the list is one that drifts')
})

test('the demo shop is hidden from everyone but the demo buyers', () => {
  assert.equal(demoHidden(demoShop, realBuyer), true)
  assert.equal(demoHidden(demoShop, undefined), true, 'and from anyone not signed in')
  assert.equal(demoHidden(demoShop, demoBuyer), false)
  assert.equal(demoHidden(demoShop, otherDemoBuyer), false, 'the demo numbers are one demo world')
  assert.equal(demoHidden(demoShop, { role: 'seller', phone: DEMO_A }), false, 'or the demo seller looking at her own shop')
})

test('a real shop is never hidden, whoever is looking', () => {
  assert.equal(demoHidden(realShop, demoBuyer), false)
  assert.equal(demoHidden(realShop, realBuyer), false)
  assert.equal(demoHidden(undefined, realBuyer), false)
})

test('the demo buyers order from the demo shops and nowhere else', () => {
  assert.equal(demoOrderProblem(demoShop, demoBuyer), null)
  assert.equal(demoOrderProblem(otherDemoShop, demoBuyer), null, 'either demo shop, from either demo number')
  const problem = demoOrderProblem(realShop, otherDemoBuyer)
  assert.ok(problem, 'a reviewer must not make a real woman cook for nobody')
  assert.match(problem!.messageMr, /डेमो/)
})

test('a real buyer never orders from a demo shop', () => {
  assert.ok(demoOrderProblem(demoShop, realBuyer))
  assert.ok(demoOrderProblem(otherDemoShop, realBuyer))
  assert.equal(demoOrderProblem(realShop, realBuyer), null)
})
