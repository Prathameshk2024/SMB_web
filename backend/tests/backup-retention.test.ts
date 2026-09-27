import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SESSION_SECRET = 'test-secret-for-unit-tests'

const {
  BACKED_UP, SNAPSHOT_COLLECTION, joinSnapshot, photosToPrune, readBackProblem, snapshotPartId, snapshotsToPrune,
  splitSnapshot, storedSnapshotsToPrune,
} = await import('../src/db/backupPlan.js')
const { gzipSync } = await import('node:zlib')
const { COLLECTIONS } = await import('../src/db/firestore.js')

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
    'firestore-2025-09-01T02-00.json.gz', // 12 months and 22 days ago - pruned
    'firestore-2025-10-01T02-00.json.gz', // under 12 months - kept
    'firestore-2026-03-01T02-00.json.gz', // kept
    'firestore-2026-09-22T02-00.json.gz', // yesterday - kept
  ]
  assert.deepEqual(snapshotsToPrune(names, now, 30, 12), [
    'firestore-2025-08-01T02-00.json.gz',
    'firestore-2025-09-01T02-00.json.gz',
  ])
})

/**
 * "Within 12 months" is counted from the day of the copy, not from its
 * month: anything deleted the day after a copy was taken must be gone
 * from every copy twelve months later, not thirteen. A copy is pruned only
 * when a run happens, and a scheduled run can be late, so it goes on the
 * first run inside the last week before its anniversary.
 */
test('a monthly copy is gone before it turns twelve months old', () => {
  const names = ['firestore-2025-10-05T02-00.json.gz']
  assert.deepEqual(snapshotsToPrune(names, new Date('2026-09-27T10:00:00Z'), 30, 12), [], 'eight days short: kept')
  assert.deepEqual(snapshotsToPrune(names, new Date('2026-09-28T10:00:00Z'), 30, 12), names, 'a week short: gone')
})

test('without a month limit the old behaviour holds', () => {
  const now = new Date('2026-09-23T10:00:00Z')
  assert.deepEqual(snapshotsToPrune(['firestore-2020-01-01T02-00.json.gz'], now, 30), [])
})

/* ------------------------------------------------------------------ */
/* The dated copies stored in the backup project                       */
/* ------------------------------------------------------------------ */

/**
 * The dated copies used to be laptop files, pruned only when somebody ran
 * the backup there. They now live in the backup project and the nightly run
 * prunes them, so "within 12 months" holds with nobody in the loop.
 */

test('the stored copies are a collection nothing else reads, copies or empties', () => {
  // The mirror and the restore touch only the collections they are handed,
  // which come from COLLECTIONS; the app loads only COLLECTIONS. A copy of
  // the whole database inside the database would otherwise be mirrored into
  // itself, or restored into the live project.
  assert.ok(!COLLECTIONS.includes(SNAPSHOT_COLLECTION as never))
  assert.ok(!BACKED_UP.includes(SNAPSHOT_COLLECTION as never))
})

test('a copy too big for one document is split and put back byte for byte', () => {
  const bytes = Uint8Array.from({ length: 25 }, (_, i) => i)
  const chunks = splitSnapshot(bytes, 10)
  assert.equal(chunks.length, 3)
  const parts = chunks.map((data, part) => ({ part, parts: chunks.length, data }))
  assert.deepEqual([...joinSnapshot([parts[2]!, parts[0]!, parts[1]!])], [...bytes], 'in any order')
  assert.throws(() => joinSnapshot([parts[0]!, parts[2]!]), /2 of 3 parts/, 'a missing part is never restored as a whole copy')
})

function stored(name: string, parts = 1) {
  return Array.from({ length: parts }, (_, part) => ({ id: snapshotPartId(name, part), snapshot: name, part, parts }))
}

test('stored copies are pruned by the same rule as the files, every part of each', () => {
  const now = new Date('2026-09-23T10:00:00Z')
  const parts = [
    ...stored('firestore-2025-09-01T21-30.json.gz', 2), // past twelve months - both parts go
    ...stored('firestore-2025-10-01T21-30.json.gz'), //    its month's copy, under twelve months - kept
    ...stored('firestore-2025-10-02T21-30.json.gz'), //    not the first of its month - goes
    ...stored('firestore-2026-09-22T21-30.json.gz'), //    last night - kept
  ]
  assert.deepEqual(storedSnapshotsToPrune(parts, now, 30, 12), [
    'firestore-2025-09-01T21-30.json.gz~0',
    'firestore-2025-09-01T21-30.json.gz~1',
    'firestore-2025-10-02T21-30.json.gz~0',
  ])
})

test('a copy a run died writing is removed, and never kept as its month', () => {
  const now = new Date('2026-09-23T10:00:00Z')
  const broken = stored('firestore-2026-03-01T21-30.json.gz', 3).slice(0, 2)
  const whole = stored('firestore-2026-03-02T21-30.json.gz')
  const doomed = storedSnapshotsToPrune([...broken, ...whole], now, 30, 12)
  assert.deepEqual(doomed, broken.map((p) => p.id), 'the broken one goes; the whole one is March')
})

/**
 * The backup keys live only in GitHub, so no laptop reads a stored copy until
 * the day one is needed. The nightly run reads tonight's back instead, and
 * this is the question it asks.
 */
test('a stored copy is checked by reading it back, not by trusting the write', () => {
  const copy = { sessions: [], sellers: [{ id: 's1' }, { id: 's2' }], orders: [{ id: 'o1' }] }
  const gz = gzipSync(JSON.stringify(copy))
  const live = { sellers: 2, orders: 1 }

  assert.equal(readBackProblem(gz, gz, live), null, 'the same bytes, the same documents: it restores')
  assert.match(readBackProblem(gz.subarray(0, 10), gz, live)!, /differ/, 'a part lost on the way back')
  assert.match(readBackProblem(gz, gz, { sellers: 3, orders: 1 })!, /sellers: 2 in the copy, 3 live/, 'a copy short of what live held')
  assert.match(readBackProblem(gz, gz, { ...live, reviews: 4 })!, /reviews: missing/, 'a collection that never made it in')
  const junk = gzipSync('not json')
  assert.match(readBackProblem(junk, junk, live)!, /does not unpack/)
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
