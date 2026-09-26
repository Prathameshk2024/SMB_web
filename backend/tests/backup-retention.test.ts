import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SESSION_SECRET = 'test-secret-for-unit-tests'

const { photosToPrune, snapshotsToPrune } = await import('../src/db/backupPlan.js')

/**
 * BACKUPS ARE KEPT FOR A LIMITED TIME, AND THIS IS THE TIME.
 *
 * Every dated copy holds every phone number and address in the database
 * that day - including those of people who have since deleted their
 * accounts. The privacy policy promises backups are kept "for a limited
 * time"; a monthly file kept for good, and a backup Cloudinary that never
 * deleted a photo, made that sentence untrue. Twelve months of monthly
 * copies is what a funder's report needs; photos follow the live account.
 */

test('monthly copies are kept for twelve months, not for good', () => {
  const now = new Date('2026-09-23T10:00:00Z')
  const names = [
    'firestore-2025-08-01T02-00.json.gz', // 13 months ago - pruned
    'firestore-2025-09-01T02-00.json.gz', // 12 months ago - kept
    'firestore-2026-03-01T02-00.json.gz', // kept
    'firestore-2026-09-22T02-00.json.gz', // yesterday - kept
  ]
  assert.deepEqual(snapshotsToPrune(names, now, 30, 12), ['firestore-2025-08-01T02-00.json.gz'])
})

test('without a month limit the old behaviour holds', () => {
  const now = new Date('2026-09-23T10:00:00Z')
  assert.deepEqual(snapshotsToPrune(['firestore-2020-01-01T02-00.json.gz'], now, 30), [])
})

test('photos the live account destroyed are removed from a backup', () => {
  const { remove, problem } = photosToPrune(['smb/product/a', 'smb/product/b'], ['smb/product/a', 'smb/product/b', 'smb/payment/gone'])
  assert.equal(problem, null)
  assert.deepEqual(remove, ['smb/payment/gone'])
})

test('a backup with nothing extra removes nothing', () => {
  assert.deepEqual(photosToPrune(['a', 'b'], ['a']), { remove: [], problem: null })
})

/**
 * The same line as the database: a live account that has lost more than
 * half its photos, or reads as empty, is the problem, and the backup is
 * the evidence. Nothing is removed until somebody has looked.
 */
test('a live account that lost most of its photos is named as the problem', () => {
  // The list is still returned - ALLOW_BULK_DELETE=true is the caller saying
  // the shrink is deliberate - but the script removes nothing without it.
  const backup = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const wiped = photosToPrune(['a'], backup)
  assert.equal(wiped.remove.length, 7)
  assert.match(wiped.problem!, /7 of 8 photos/)

  const empty = photosToPrune([], backup)
  assert.match(empty.problem!, /lists no photos/)
})
