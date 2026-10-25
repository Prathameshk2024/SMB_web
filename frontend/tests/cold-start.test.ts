import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answeredByApi, worthOneRetry } from '../src/lib/coldStart.js'

const ours = JSON.stringify({ error: 'Too many requests', messageMr: 'खूप वेळा प्रयत्न झाले.' })

test('a read that never reached a waking server is asked once more', () => {
  // The first screen after an idle spell: the connection dropped, or Cloud
  // Run's front end gave up before the instance had loaded the database.
  assert.equal(worthOneRetry('GET', { kind: 'network' }), true)
  assert.equal(worthOneRetry(undefined, { kind: 'network' }), true)
  for (const status of [429, 500, 502, 503, 504]) {
    assert.equal(worthOneRetry('GET', { kind: 'status', status, text: '<html>Service Unavailable</html>' }), true, `HTTP ${status}`)
    assert.equal(worthOneRetry('GET', { kind: 'status', status, text: '' }), true, `empty HTTP ${status}`)
  }
})

test('nothing that writes is ever sent twice', () => {
  // A dropped connection cannot say whether the order was placed. An empty
  // screen is recoverable; two orders, or a fourth OTP against a three-a-day
  // ceiling, are not.
  for (const method of ['POST', 'PATCH', 'DELETE', 'post']) {
    assert.equal(worthOneRetry(method, { kind: 'network' }), false, method)
    assert.equal(worthOneRetry(method, { kind: 'status', status: 503, text: '' }), false, method)
  }
})

test('an answer from our own API is final', () => {
  // It answered: asking the same question again gets the same answer, and
  // its 429 is a real limit rather than a server still booting.
  assert.equal(answeredByApi(ours), true)
  assert.equal(worthOneRetry('GET', { kind: 'status', status: 429, text: ours }), false)
  assert.equal(worthOneRetry('GET', { kind: 'status', status: 503, text: ours }), false)
})

test('an ordinary refusal is not a cold start', () => {
  for (const status of [400, 401, 403, 404, 409]) {
    assert.equal(worthOneRetry('GET', { kind: 'status', status, text: '' }), false, `HTTP ${status}`)
  }
})

test('only our JSON counts as our answer', () => {
  assert.equal(answeredByApi(''), false)
  assert.equal(answeredByApi('<html></html>'), false)
  assert.equal(answeredByApi('{"message":"Rate exceeded."}'), false)
  assert.equal(answeredByApi('null'), false)
})
