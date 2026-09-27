/**
 * RESTORE FROM A DATED COPY
 * =========================
 * The other half of `npm run backup`. It puts back a dated copy - one the
 * nightly run stored in a backup project, or one a `--local` run saved in
 * backend/data/backups/:
 *
 *   --snapshot list          the copies stored in a backup project, oldest
 *                            first. Reads the project from BACKUP_<X>_FIREBASE_
 *                            SERVICE_ACCOUNT; `--from <x>` picks the target
 *                            when there is more than one.
 *   --snapshot <name>        one of those copies, restored exactly as --file
 *                            would restore it.
 *   --file <path>    a database copy (firestore-<date>.json.gz, or unpacked
 *                    .json) into the Firestore that FIREBASE_SERVICE_ACCOUNT
 *                    names. The project is made to MATCH the file: documents
 *                    that differ are written, documents the file does not
 *                    have are removed, and collections the file does not
 *                    have are left alone. `sessions` is never touched.
 *   --images [dir]   downloaded photos (default backend/data/backups/images)
 *                    into the Cloudinary account that CLOUDINARY_* names,
 *                    each under the public_id it was saved from. Only photos
 *                    the account does not have are uploaded; none is replaced
 *                    and none deleted.
 *                    Into the SAME account this is the whole fix. Into a
 *                    different one, the photos arrive but the database still
 *                    stores URLs naming the old account, so the app shows none
 *                    of them. Rewriting those URLs is not built yet - what it
 *                    has to do is in docs/BACKUP.md, "Not built: moving the
 *                    photos to a new Cloudinary account".
 *
 * Reports and changes nothing unless `--commit` is passed.
 *
 *   npm run restore -- --snapshot list
 *   npm run restore -- --snapshot firestore-2026-09-23T21-30.json.gz
 *   npm run restore -- --file backend/data/backups/firestore-2026-09-23T17-41.json.gz
 *   npm run restore -- --images
 *   npm run restore -- --file <path> --images --commit
 *
 * BEFORE A REAL RESTORE (docs/BACKUP.md §4):
 *   - Disable the Backup workflow, or tonight's run copies the half-restored
 *     live project over the good backup.
 *   - Afterwards, restart the API. It holds the database in memory and would
 *     otherwise go on writing its old copy back over the restored one.
 *
 * The same guard as everywhere else: if the target holds more than twice what
 * the file has in any collection, nothing is written unless
 * ALLOW_BULK_DELETE=true - a file picked by mistake must not empty a project.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { cert, deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { ALLOW_BULK_DELETE, cloudinary, firebase } from '../src/config.js'
import { getFirestoreDb } from '../src/db/firestore.js'
import { imagePublicIds, isSnapshotName, parseSnapshot, readTargets, shrinkProblems } from '../src/db/backupPlan.js'
import {
  applyMirror, countsOf, fetchSnapshot, listAssets, listSnapshotParts, readCollections, uploadAsset, type Collections,
} from '../src/db/backupIo.js'

const args = process.argv.slice(2)
const commit = args.includes('--commit')
const here = path.dirname(fileURLToPath(import.meta.url))

function valueAfter(flag: string): string | undefined {
  const i = args.indexOf(flag)
  const next = args[i + 1]
  return i >= 0 && next && !next.startsWith('--') ? next : undefined
}
// npm runs a workspace script from inside backend/, so a path typed at the
// repository root would otherwise be looked for in backend/backend/...
// INIT_CWD is where the command was actually typed.
const typedFrom = process.env.INIT_CWD ?? process.cwd()
const fileArg = valueAfter('--file')
const file = fileArg ? path.resolve(typedFrom, fileArg) : undefined
const imagesArg = valueAfter('--images')
const images = args.includes('--images')
  ? imagesArg ? path.resolve(typedFrom, imagesArg) : path.join(here, '../data/backups/images')
  : undefined
const snapshotArg = args.includes('--snapshot') ? valueAfter('--snapshot') ?? 'list' : undefined
const fromArg = valueAfter('--from')

let failed = false
function fail(message: string): void {
  console.error(`  FAILED  ${message}`)
  failed = true
}

async function restoreFile(filePath: string): Promise<void> {
  if (!fs.existsSync(filePath)) {
    fail(`${filePath}: no such file`)
    return
  }
  let json: unknown
  try {
    const bytes = fs.readFileSync(filePath)
    const text = filePath.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8')
    json = JSON.parse(text)
  } catch (err) {
    fail(`${filePath}: could not be read as a database copy - ${(err as Error).message}`)
    return
  }
  await restoreDatabase(path.basename(filePath), json)
}

/**
 * A copy the nightly run stored in a backup project. The backup key comes
 * from the same BACKUP_<X>_* variables the backup run reads, so the one
 * project this ever reads copies from is one already configured as a backup.
 */
async function restoreStored(which: string): Promise<void> {
  const folder = process.env.CLOUDINARY_FOLDER?.trim() || 'shanta-mahila-bazar'
  const { targets, problems } = readTargets(process.env, folder)
  for (const p of problems) fail(p)
  const withFirestore = targets.filter((t) => t.firestore)
  const target = fromArg ? withFirestore.find((t) => t.name === fromArg) : withFirestore.length === 1 ? withFirestore[0] : undefined
  if (!target) {
    fail(fromArg
      ? `--from ${fromArg}: no backup target of that name with a Firebase key in BACKUP_TARGETS`
      : withFirestore.length === 0
        ? 'no backup project configured - set BACKUP_TARGETS and BACKUP_<X>_FIREBASE_SERVICE_ACCOUNT'
        : `more than one backup project - say which with --from ${withFirestore.map((t) => t.name).join('|')}`)
    return
  }
  if (which !== 'list' && !isSnapshotName(which)) {
    fail(`--snapshot ${which}: not a copy's name - run --snapshot list to see them`)
    return
  }

  const config = target.firestore!
  let app: App | null = null
  try {
    app = initializeApp({ credential: cert(config), projectId: config.projectId }, `restore-from-${target.name}`)
    const db = config.databaseId ? getFirestore(app, config.databaseId) : getFirestore(app)

    if (which === 'list') {
      const parts = await listSnapshotParts(db)
      const names = [...new Set(parts.map((p) => p.snapshot))].sort()
      console.log(`  copies stored in ${config.projectId}: ${names.length}`)
      for (const name of names) {
        const found = parts.filter((p) => p.snapshot === name)
        const whole = found.length === found[0]!.parts
        console.log(`           ${name}${whole ? '' : `   INCOMPLETE (${found.length} of ${found[0]!.parts} parts)`}`)
      }
      return
    }

    const gz = await fetchSnapshot(db, which)
    let json: unknown
    try {
      json = JSON.parse(gunzipSync(gz).toString('utf8'))
    } catch (err) {
      fail(`${which}: could not be read as a database copy - ${(err as Error).message}`)
      return
    }
    await restoreDatabase(`${which} (from ${config.projectId})`, json)
  } catch (err) {
    fail(`${which} from ${config.projectId}: ${(err as Error).message}`)
  } finally {
    if (app) await deleteApp(app)
  }
}

async function restoreDatabase(label: string, json: unknown): Promise<void> {
  if (!firebase) {
    fail('no Firestore to restore into - set FIREBASE_SERVICE_ACCOUNT to the project to restore')
    return
  }

  const { collections, problems } = parseSnapshot(json)
  for (const p of problems) fail(`${label}: ${p}`)
  if (problems.length > 0) return

  const source: Collections = Object.fromEntries(collections)
  const db = getFirestoreDb()
  const current = await readCollections(db, Object.keys(source))

  console.log(`  database ${label} → ${firebase.projectId}`)
  for (const name of Object.keys(source)) {
    console.log(`           ${name.padEnd(12)} file ${String(source[name]!.size).padStart(5)}   now ${String(current[name]!.size).padStart(5)}`)
  }

  // Here the file plays the part the live project plays in a backup: a
  // target much larger than the file means the wrong file, or the wrong
  // project, far more often than it means a restore.
  const shrink = shrinkProblems(countsOf(source), countsOf(current), {
    source: 'in the file',
    sourceWhole: 'the file',
    target: firebase.projectId,
  })
  if (shrink.length > 0 && !ALLOW_BULK_DELETE) {
    for (const p of shrink) console.error(`           ${p}`)
    fail(
      `${firebase.projectId} holds far more than this file. Nothing was written. Check it is the right file ` +
        'and the right project; if it is, re-run with ALLOW_BULK_DELETE=true.',
    )
    return
  }

  const { written, removed } = await applyMirror(db, source, current, !commit)
  console.log(`  database ${commit ? 'wrote' : 'would write'} ${written}, ${commit ? 'removed' : 'would remove'} ${removed}`)
}

async function restoreImages(dir: string): Promise<void> {
  if (!cloudinary) {
    fail('no Cloudinary to restore into - set CLOUDINARY_* to the account to restore')
    return
  }
  if (!fs.existsSync(dir)) {
    fail(`${dir}: no such folder`)
    return
  }

  const files = (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((rel) => fs.statSync(path.join(dir, rel)).isFile())
  const photos = imagePublicIds(files, cloudinary.folder)
  const have = new Set((await listAssets(cloudinary, cloudinary.folder)).map((a) => a.public_id))
  const missing = photos.filter((p) => !have.has(p.publicId))

  console.log(`  photos   ${dir} → ${cloudinary.cloudName}`)
  console.log(`           ${photos.length} on disk, ${have.size} in the account, ${missing.length} missing from it`)
  if (!commit) {
    console.log(`  photos   would upload ${missing.length}`)
    return
  }

  let uploaded = 0
  for (const photo of missing) {
    try {
      await uploadAsset(cloudinary, new Blob([fs.readFileSync(path.join(dir, photo.path))]), photo.publicId)
      uploaded++
    } catch (err) {
      fail(`photo ${photo.publicId}: ${(err as Error).message}`)
    }
  }
  console.log(`  photos   uploaded ${uploaded}`)
}

async function main(): Promise<void> {
  if (file && snapshotArg) {
    console.log('')
    console.log('  Pass --file or --snapshot, not both: a database is restored from one copy.')
    console.log('')
    process.exitCode = 1
    return
  }
  if (snapshotArg === 'list') {
    console.log('')
    await restoreStored('list')
    console.log('')
    if (failed) process.exitCode = 1
    return
  }
  if (!file && !snapshotArg && !images) {
    console.log('')
    console.log('  Nothing to restore. Pass --snapshot list|<name>, --file <database copy>, --images [folder], or a copy and --images.')
    console.log('  See the top of backend/scripts/restore.ts, and docs/BACKUP.md §4.')
    console.log('')
    process.exitCode = 1
    return
  }

  console.log('')
  console.log(`  restore${commit ? '' : ' (DRY RUN - add --commit to write)'}`)
  console.log('')

  try {
    if (file) await restoreFile(file)
    if (snapshotArg) await restoreStored(snapshotArg)
  } catch (err) {
    fail(`database: ${(err as Error).message}`)
  }
  try {
    if (images) await restoreImages(images)
  } catch (err) {
    fail(`photos: ${(err as Error).message}`)
  }

  console.log('')
  if (failed) {
    console.log('  FINISHED WITH FAILURES - see above.')
  } else if (commit) {
    console.log('  RESTORED.')
    if (file || snapshotArg) {
      console.log('  Restart the API now, so it reads the restored data instead of writing its old copy back:')
      console.log('    gcloud run services update shantai-api --region asia-south1 --update-env-vars RESTORED_AT=' +
        new Date().toISOString().slice(0, 16).replace(':', '-'))
    }
    console.log('  Re-enable the Backup workflow once the live project is right.')
  } else {
    console.log('  DRY RUN - nothing was written. Re-run with --commit to apply.')
  }
  console.log('')
  if (failed) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error('[restore] failed:', err)
  process.exitCode = 1
})
