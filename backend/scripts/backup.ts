/**
 * BACK UP THE LIVE DATABASE AND PHOTOS
 * ====================================
 * One run does three things for each backup target it copies into:
 *
 *   1. Reads every backed-up Firestore collection from the live project and
 *      stores it as a dated, gzipped copy in the target's `snapshots`
 *      collection, then prunes that collection: every copy from the last
 *      BACKUP_KEEP_DAYS (30), and the first of each month until a week
 *      before it is BACKUP_KEEP_MONTHS (12) old. This is what keeps the
 *      privacy policy's "within 12 months" without anybody remembering to.
 *      `npm run restore -- --snapshot list` shows them; `--snapshot <name>`
 *      loads one back.
 *   2. Mirrors the same documents into the target's own collections -
 *      unless the live project has shrunk suspiciously since the backup was
 *      last taken (see shrinkProblems in src/db/backupPlan.ts).
 *   3. Copies every photo the backup Cloudinary account does not have yet,
 *      Cloudinary to Cloudinary, keeping the same public_id. Photos the live
 *      account no longer has are removed - a deleted account's screenshots
 *      and product photos are destroyed live, and the privacy policy says
 *      backups follow within a limited time - under the same shrink check
 *      as the database (photosToPrune).
 *
 * With --local it also writes the dated copy to backend/data/backups/ and
 * downloads the photos to backend/data/backups/images/, pruning both by the
 * same rules. That copy survives losing every account, but it is pruned only
 * when somebody runs this on that machine again - so it is off by default,
 * and a copy taken for a restore drill should be deleted afterwards.
 * Unpacked, a copy is db.json's shape, so the JSON driver boots from it:
 *   node -e "process.stdout.write(require('zlib').gunzipSync(require('fs').readFileSync(process.argv[1])))" <file> > data/db.json
 *
 * The live project is only ever READ. Its free plan allows 50,000 reads a
 * day and one run costs one read per document - the same as one API start -
 * so run this once a day, not every hour.
 *
 *   npm run backup                   # today's target, by rotation
 *   npm run backup -- --to a         # a named target (repeatable)
 *   npm run backup -- --dry-run      # report, write nothing anywhere
 *   npm run backup -- --local        # also a copy on this machine
 *   npm run backup -- --no-copies    # mirror only, no dated copy stored
 *                                    # (implied for a target named `live`)
 *   npm run backup -- --local --no-local-images
 *
 * Targets are configured in the environment - see readTargets() and the
 * BACKUP_ block in .env.example. With none configured, nothing is stored
 * unless --local says so. Exits non-zero if anything was refused or failed,
 * so a scheduled run that did not complete is visible as a failure.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { cert, deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { ALLOW_BULK_DELETE, cloudinary, firebase } from '../src/config.js'
import { getFirestoreDb } from '../src/db/firestore.js'
import {
  BACKED_UP, imagePublicIds, photosToPrune, pickTargets, readTargets, shrinkProblems, snapshotName,
  readBackProblem, snapshotsToPrune, storedSnapshotsToPrune, type BackupTarget,
} from '../src/db/backupPlan.js'
import {
  applyMirror, countsOf, deleteAssets, deleteSnapshotParts, fetchSnapshot, listAssets, listSnapshotParts, readCollections,
  storeSnapshot, uploadAsset, type Asset, type Collections,
} from '../src/db/backupIo.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const local = args.includes('--local')
const storeCopies = !args.includes('--no-copies')
const localImages = local && !args.includes('--no-local-images')
const requested = args.flatMap((a, i) => (a === '--to' && args[i + 1] ? [args[i + 1]!] : []))

const here = path.dirname(fileURLToPath(import.meta.url))
// A relative BACKUP_DIR means relative to where the command was typed, not to
// backend/, which is where npm runs a workspace script from.
const BACKUP_DIR = process.env.BACKUP_DIR?.trim()
  ? path.resolve(process.env.INIT_CWD ?? process.cwd(), process.env.BACKUP_DIR.trim())
  : path.join(here, '../data/backups')
const KEEP_DAYS = Math.max(1, Number(process.env.BACKUP_KEEP_DAYS) || 30)
// Twelve is a ceiling, not only a default: the privacy policy and the delete
// page say deleted information leaves the monthly copies within 12 months,
// so an environment variable may shorten that but never stretch it.
const MAX_KEEP_MONTHS = 12
const KEEP_MONTHS = Math.min(MAX_KEEP_MONTHS, Math.max(1, Number(process.env.BACKUP_KEEP_MONTHS) || MAX_KEEP_MONTHS))

let failed = false
function fail(message: string): void {
  console.error(`  FAILED  ${message}`)
  failed = true
}

/* ------------------------------------------------------------------ */
/* Firestore                                                           */
/* ------------------------------------------------------------------ */

/**
 * The dated copy, gzipped: db.json's shape, with `sessions` empty rather than
 * absent so the JSON driver takes it as it is. The same bytes go to every
 * target and to the local file, so a copy restores the same from either.
 */
function snapshotBytes(live: Collections): Buffer {
  const snapshot: Record<string, unknown[]> = { sessions: [] }
  for (const [name, docs] of Object.entries(live)) {
    snapshot[name] = [...docs].map(([id, data]) => ({ id, ...data }))
  }
  return gzipSync(JSON.stringify(snapshot, null, 2))
}

function writeLocalSnapshot(gz: Buffer, now: Date): void {
  const file = path.join(BACKUP_DIR, snapshotName(now))
  const existing = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR) : []
  const doomed = snapshotsToPrune([...existing, path.basename(file)], now, KEEP_DAYS, KEEP_MONTHS)

  if (dryRun) {
    console.log(`  local    would write ${file}`)
    if (doomed.length) console.log(`  local    would prune ${doomed.length} older copies`)
    return
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  fs.writeFileSync(file, gz)
  console.log(`  local    wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`)

  // Only after today's copy is safely on disk, so a run that fails to write
  // never shrinks the history it was meant to add to.
  for (const name of doomed) fs.rmSync(path.join(BACKUP_DIR, name))
  if (doomed.length) {
    console.log(`  local    pruned ${doomed.length} copies older than ${KEEP_DAYS} days (first of each month kept ${KEEP_MONTHS} months)`)
  }
}

/**
 * Tonight's copy into the target's `snapshots`, then the old ones out.
 *
 * Before the shrink check, and whatever it says: a copy is only ever added,
 * so storing one of a live project that looks damaged loses nothing - and
 * pruning is by age alone, because a shrink that went unnoticed for weeks
 * must not also stop the privacy policy's twelve months from being kept.
 * Pruning happens only after tonight's copy is stored, so a run that fails
 * to write never shrinks the history it was meant to add to.
 */
async function keepSnapshot(db: Firestore, label: string, gz: Buffer, now: Date, live: Collections): Promise<void> {
  const name = snapshotName(now)
  try {
    const existing = await listSnapshotParts(db)
    if (dryRun) {
      const doomed = storedSnapshotsToPrune(
        [...existing, { id: `${name}~0`, snapshot: name, part: 0, parts: 1 }], now, KEEP_DAYS, KEEP_MONTHS,
      )
      console.log(`  copies   → ${label}: would store ${name} (${(gz.length / 1024).toFixed(0)} KB), would prune ${doomed.length} parts`)
      return
    }
    const parts = await storeSnapshot(db, name, gz, now)
    // Read it straight back, the way a restore would. The keys are only in
    // GitHub, so this is the one place a stored copy is ever proven to work
    // before the day it is needed. Pruning goes ahead either way: it is by
    // age, and the twelve months are kept whether or not tonight went well.
    const problem = readBackProblem(await fetchSnapshot(db, name), gz, countsOf(live))
    if (problem) fail(`copies → ${label}: ${name} did not read back as stored - ${problem}`)
    const doomed = storedSnapshotsToPrune(await listSnapshotParts(db), now, KEEP_DAYS, KEEP_MONTHS)
    await deleteSnapshotParts(db, doomed)
    const kept = new Set((await listSnapshotParts(db)).map((p) => p.snapshot)).size
    console.log(`  copies   → ${label}: stored ${name} (${(gz.length / 1024).toFixed(0)} KB, ${parts} part${parts === 1 ? '' : 's'})${problem ? '' : ', read back and checked'}, pruned ${doomed.length} parts, ${kept} copies kept`)
  } catch (err) {
    fail(`copies → ${label}: ${(err as Error).message}`)
  }
}

async function mirrorFirestore(target: BackupTarget, live: Collections, gz: Buffer, now: Date): Promise<void> {
  const config = target.firestore!
  // The one mistake this script could make with the live data is taking it for
  // a backup: mirroring deletes a live project's documents to match whatever
  // it was handed.
  if (config.projectId === firebase?.projectId && config.databaseId === firebase?.databaseId) {
    fail(`target "${target.name}" is the LIVE Firebase project (${config.projectId}) - refusing`)
    return
  }

  let app: App | null = null
  try {
    app = initializeApp(
      { credential: cert(config), projectId: config.projectId },
      `backup-${target.name}`,
    )
    const db = config.databaseId ? getFirestore(app, config.databaseId) : getFirestore(app)
    // A restore runs this script in reverse, with the live project as the
    // target (docs/BACKUP.md §4) - and a dated copy of everybody stored inside
    // the live database is the last thing it should leave behind. The docs
    // name that target `live`, so the name alone stops it as well as the flag.
    if (storeCopies && target.name !== 'live') await keepSnapshot(db, config.projectId, gz, now, live)
    const backup = await readCollections(db, BACKED_UP)

    const problems = shrinkProblems(countsOf(live), countsOf(backup))
    if (problems.length > 0 && !ALLOW_BULK_DELETE) {
      for (const p of problems) console.error(`           ${p}`)
      fail(
        `firestore → ${config.projectId}: the live project has shrunk since this backup was taken. ` +
          'Nothing was copied, so the backup still holds the older data. Find out why before trusting ' +
          'the live project; if the shrink is deliberate, re-run with ALLOW_BULK_DELETE=true.',
      )
      return
    }

    const { written, removed } = await applyMirror(db, live, backup, dryRun)
    const verb = dryRun ? 'would write' : 'wrote'
    console.log(`  firestore → ${config.projectId}: ${verb} ${written}, ${dryRun ? 'would remove' : 'removed'} ${removed}`)
  } catch (err) {
    fail(`firestore → ${config.projectId}: ${(err as Error).message}`)
  } finally {
    if (app) await deleteApp(app)
  }
}

/* ------------------------------------------------------------------ */
/* Cloudinary                                                          */
/* ------------------------------------------------------------------ */

async function mirrorCloudinary(target: BackupTarget, assets: Asset[], folder: string): Promise<void> {
  const to = target.cloudinary!
  if (to.cloudName === cloudinary?.cloudName) {
    fail(`target "${target.name}" is the LIVE Cloudinary account (${to.cloudName}) - refusing`)
    return
  }
  try {
    const have = new Set((await listAssets(to, folder)).map((a) => a.public_id))
    const missing = assets.filter((a) => !have.has(a.public_id))
    // Photos the live account has destroyed - a closed account's, a deleted
    // listing's - go from the backup too, unless so many are missing that
    // the live account itself looks damaged.
    const prune = photosToPrune(assets.map((a) => a.public_id), have, { source: 'live', target: to.cloudName })
    if (prune.problem && !ALLOW_BULK_DELETE) {
      fail(`photos → ${to.cloudName}: ${prune.problem}. Nothing was removed; re-run with ALLOW_BULK_DELETE=true if the live account is right.`)
    }
    const remove = prune.problem && !ALLOW_BULK_DELETE ? [] : prune.remove
    if (dryRun) {
      console.log(`  photos   → ${to.cloudName}: would copy ${missing.length} of ${assets.length}, would remove ${remove.length}`)
      return
    }
    let copied = 0
    for (const asset of missing) {
      try {
        // By URL: Cloudinary fetches it from the live account itself.
        await uploadAsset(to, asset.secure_url, asset.public_id)
        copied++
      } catch (err) {
        fail(`photo ${asset.public_id} → ${to.cloudName}: ${(err as Error).message}`)
      }
    }
    const removed = remove.length ? await deleteAssets(to, remove) : 0
    console.log(`  photos   → ${to.cloudName}: copied ${copied} new, removed ${removed}, ${assets.length} in total`)
  } catch (err) {
    fail(`photos → ${to.cloudName}: ${(err as Error).message}`)
  }
}

/** Every file under the images directory, as paths relative to it. */
function localImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  const walk = (sub: string) => {
    for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(rel)
      else out.push(rel)
    }
  }
  walk('')
  return out
}

/**
 * Only files not already on disk, so each run downloads just the new ones -
 * and files the live account no longer has are removed, under the same
 * check as the backup account's copy.
 */
async function downloadAssets(assets: Asset[], folder: string): Promise<void> {
  const dir = path.join(BACKUP_DIR, 'images')
  const missing = assets.filter((a) => !fs.existsSync(path.join(dir, `${a.public_id}.${a.format}`)))
  const onDisk = imagePublicIds(localImageFiles(dir), folder)
  const prune = photosToPrune(assets.map((a) => a.public_id), onDisk.map((f) => f.publicId), { source: 'live', target: 'the local copy' })
  if (prune.problem && !ALLOW_BULK_DELETE) {
    fail(`photos local: ${prune.problem}. Nothing was removed; re-run with ALLOW_BULK_DELETE=true if the live account is right.`)
  }
  const doomed = new Set(prune.problem && !ALLOW_BULK_DELETE ? [] : prune.remove)
  const remove = onDisk.filter((f) => doomed.has(f.publicId)).map((f) => f.path)
  if (dryRun) {
    console.log(`  photos   local: would download ${missing.length} of ${assets.length}, would remove ${remove.length}`)
    return
  }
  let saved = 0
  for (const asset of missing) {
    const file = path.join(dir, `${asset.public_id}.${asset.format}`)
    try {
      const resp = await fetch(asset.secure_url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()))
      saved++
    } catch (err) {
      fail(`download ${asset.public_id}: ${(err as Error).message}`)
    }
  }
  for (const rel of remove) fs.rmSync(path.join(dir, rel), { force: true })
  console.log(`  photos   local: downloaded ${saved} new, removed ${remove.length}, ${assets.length} in total`)
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const folder = cloudinary?.folder ?? process.env.CLOUDINARY_FOLDER?.trim() ?? 'shanta-mahila-bazar'
  const { targets, problems } = readTargets(process.env, folder)
  for (const p of problems) fail(p)

  const { chosen, unknown } = pickTargets(targets, requested, new Date())
  for (const u of unknown) fail(`--to ${u}: no such target in BACKUP_TARGETS`)

  // A target that expects a copy the live side cannot supply is a broken
  // setup, not a quiet night. Without this a scheduled run whose live key
  // failed to parse skipped the database and still went green.
  for (const t of chosen) {
    if (t.firestore && !firebase) {
      fail(`target "${t.name}" has a Firebase key, but the live Firebase is not configured - check FIREBASE_SERVICE_ACCOUNT`)
    }
    if (t.cloudinary && !cloudinary) {
      fail(`target "${t.name}" has a Cloudinary account, but the live Cloudinary is not configured - check CLOUDINARY_*`)
    }
  }

  console.log('')
  console.log(`  backup${dryRun ? ' (DRY RUN - nothing is written)' : ''}`)
  console.log(`  targets  ${chosen.length ? chosen.map((t) => t.name).join(', ') : local ? '(none - local copy only)' : '(none - nothing will be stored; set BACKUP_TARGETS or pass --local)'}`)
  console.log('')

  if (firebase) {
    try {
      const live = await readCollections(getFirestoreDb(), BACKED_UP)
      const total = Object.values(live).reduce((n, docs) => n + docs.size, 0)
      console.log(`  firestore read ${total} documents from ${firebase.projectId}`)
      const now = new Date()
      const gz = snapshotBytes(live)
      if (local) writeLocalSnapshot(gz, now)
      for (const t of chosen) if (t.firestore) await mirrorFirestore(t, live, gz, now)
    } catch (err) {
      fail(`reading the live Firestore: ${(err as Error).message}`)
    }
  } else {
    console.log('  firestore not configured - no database to back up')
  }

  if (cloudinary) {
    try {
      const assets = await listAssets(cloudinary, folder)
      if (localImages) await downloadAssets(assets, folder)
      for (const t of chosen) if (t.cloudinary) await mirrorCloudinary(t, assets, folder)
    } catch (err) {
      fail(`listing the live Cloudinary: ${(err as Error).message}`)
    }
  } else {
    console.log('  cloudinary not configured - no photos to back up')
  }

  console.log('')
  console.log(failed ? '  FINISHED WITH FAILURES - see above.' : '  DONE.')
  console.log('')
  if (failed) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error('[backup] failed:', err)
  process.exitCode = 1
})
