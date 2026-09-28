/**
 * REMOVE EVERY SELLER BUT THE ONES NAMED - AND PUT ONE BACK
 * =========================================================
 * For handover: the live database still holds the sellers, buyers, orders and
 * photos made while the app was being tested. This keeps the sellers named by
 * SMB ID, the buyers on their orders and the staff accounts, and removes the
 * rest from Firestore and Cloudinary. The rules are in src/db/purgeSellers.ts.
 *
 *   npm run purge:sellers -- --keep SMB-BHOSGA-01,SMB-NALADURG-01            # dry run
 *   ALLOW_BULK_DELETE=true npm run purge:sellers -- --keep ... --commit
 *
 * Every record it removes is written first to
 * backend/data/backups/purged-<date>.json, and it refuses to destroy a photo
 * that is not already on disk under backend/data/backups/images/ - so run
 * `npm run backup` first. That file is what puts a seller back:
 *
 *   npm run purge:sellers -- --restore <purged file> --seller SMB-ANADUR-01 [--commit]
 *
 * which re-adds her, her products, orders, payments and their buyers, and
 * re-uploads her photos under their old ids so the stored URLs answer again.
 * `npm run restore` (scripts/restore.ts) is the whole-database way back.
 *
 * Firestore is changed underneath the running API, which holds the old copy in
 * memory. Restart it straight afterwards (the command is printed), then run the
 * dry run again: anything the old process wrote back in between shows up there.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudinary } from '../src/config.js'
import { flush, getDb, initStore } from '../src/db/store.js'
import { listAssets, uploadAsset, type Asset } from '../src/db/backupIo.js'
import { destroyImage } from '../src/routes/uploads.routes.js'
import { PURGED, planPurge, sellerRecords, type Purged } from '../src/db/purgeSellers.js'
import type { Db } from '../src/db/seed.js'

const args = process.argv.slice(2)
const commit = args.includes('--commit')
const valueAfter = (flag: string) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith('--') ? args[i + 1] : undefined
}
const typedFrom = process.env.INIT_CWD ?? process.cwd()
const BACKUPS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/backups')
const IMAGES = path.join(BACKUPS, 'images')
const onDisk = (a: Asset) => path.join(IMAGES, `${a.public_id}.${a.format}`)

interface PurgeFile { at: string; keep: string[]; doomed: Purged; photos: Asset[] }

function counts(c: Partial<Purged>): string {
  return Object.entries(c).map(([k, v]) => `${k} ${v.length}`).join(', ')
}

async function purge(keep: string[]): Promise<void> {
  const db = getDb()
  const { doomed, missing } = planPurge(db, keep)
  if (missing.length) {
    // Never guess: a keep list with a typo in it would delete the woman it meant to keep.
    console.error(`  REFUSED  no seller has SMB ID ${missing.join(', ')}. Nothing was changed.`)
    process.exitCode = 1
    return
  }

  const gone = Object.fromEntries(PURGED.map((k) => [k, new Set<unknown>(doomed[k])])) as Record<string, Set<unknown>>
  const kept = Object.fromEntries(PURGED.map((k) => [k, (db[k] as unknown[]).filter((r) => !gone[k]!.has(r))]))

  console.log('  KEEPING')
  for (const s of kept.sellers as Db['sellers']) console.log(`    ${s.womenBizId.padEnd(20)} ${s.name}`)
  console.log(`    ${counts(kept as Partial<Purged>)}`)
  console.log('  REMOVING')
  for (const s of doomed.sellers) {
    const n = (k: 'products' | 'orders' | 'payments') => doomed[k].filter((r) => r.sellerId === s.id).length
    console.log(`    ${s.womenBizId.padEnd(20)} ${s.name.padEnd(22)} ${s.status.padEnd(11)} products ${n('products')}, orders ${n('orders')}, payments ${n('payments')}`)
  }
  console.log(`    ${counts(doomed)}`)

  // A photo stays if anything kept still names it - a URL carries its
  // public_id. Everything else in the folder goes, abandoned uploads included.
  let photos: Asset[] = []
  if (cloudinary) {
    const keptText = JSON.stringify(kept)
    photos = (await listAssets(cloudinary, cloudinary.folder)).filter((a) => !keptText.includes(a.public_id))
    console.log(`  PHOTOS   removing ${photos.length} from ${cloudinary.cloudName}/${cloudinary.folder}`)
  }

  if (!commit) {
    console.log('\n  DRY RUN - nothing was changed. Re-run with --commit to apply.\n')
    return
  }

  const unsaved = photos.filter((a) => !fs.existsSync(onDisk(a)))
  if (unsaved.length) {
    console.error(`  REFUSED  ${unsaved.length} photo(s) are not in ${IMAGES}, so could never be put back.`)
    console.error('           Run `npm run backup` first. Nothing was changed.')
    process.exitCode = 1
    return
  }

  const file = path.join(BACKUPS, `purged-${new Date().toISOString().slice(0, 16).replace(':', '-')}.json`)
  fs.mkdirSync(BACKUPS, { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), keep, doomed, photos } satisfies PurgeFile, null, 2))
  console.log(`  SAVED    every removed record: ${file}`)

  Object.assign(db, kept)
  if (!(await flush())) {
    console.error('  FAILED   Firestore refused the deletes (set ALLOW_BULK_DELETE=true). No photo was touched.')
    process.exitCode = 1
    return
  }
  let destroyed = 0
  for (const a of photos) if (await destroyImage(a.public_id)) destroyed++
  console.log(`  COMMITTED  Firestore done; ${destroyed}/${photos.length} photos destroyed.`)
  if (destroyed < photos.length) process.exitCode = 1
  console.log('\n  Restart the API now, so it drops its in-memory copy:')
  console.log(`    gcloud run services update shantai-api --region asia-south1 --update-env-vars PURGED_AT=${Date.now()}`)
  console.log('  Then run the dry run again - it should find nothing to remove.\n')
}

async function restore(fileArg: string, bizId: string): Promise<void> {
  const db = getDb()
  const saved = JSON.parse(fs.readFileSync(path.resolve(typedFrom, fileArg), 'utf8')) as PurgeFile
  const back = sellerRecords(saved.doomed, bizId)
  if (!back) {
    console.error(`  REFUSED  ${bizId} is not in that file.`)
    process.exitCode = 1
    return
  }
  const her = back.sellers[0]!
  // Her phone and SMB ID may have been given to somebody new since she left.
  const clash = db.sellers.find((s) => s.id === her.id || s.womenBizId === her.womenBizId || (her.phone && s.phone === her.phone))
  if (clash) {
    console.error(`  REFUSED  ${clash.womenBizId} (${clash.name}) already holds her id, SMB ID or phone.`)
    process.exitCode = 1
    return
  }
  // A buyer who has since signed up again keeps her new account; the orders
  // carry her name and phone themselves.
  back.customers = back.customers.filter((c) => !db.customers.some((x) => x.id === c.id || x.phone === c.phone))
  const text = JSON.stringify(back)
  const photos = saved.photos.filter((a) => text.includes(a.public_id))
  console.log(`  RESTORING ${bizId} ${her.name}: ${counts(back)}, photos ${photos.length}`)

  if (!commit) {
    console.log('\n  DRY RUN - nothing was changed. Re-run with --commit to apply.\n')
    return
  }
  for (const [k, rows] of Object.entries(back) as [keyof typeof back, { id: string }[]][]) {
    const have = new Set((db[k] as { id: string }[]).map((r) => r.id))
    ;(db[k] as unknown[]).push(...rows.filter((r) => !have.has(r.id)))
  }
  if (!(await flush())) {
    console.error('  FAILED   Firestore did not accept the write.')
    process.exitCode = 1
    return
  }
  let uploaded = 0
  for (const a of photos) {
    try {
      if (!cloudinary) throw new Error('Cloudinary is not configured')
      await uploadAsset(cloudinary, new Blob([fs.readFileSync(onDisk(a))]), a.public_id)
      uploaded++
    } catch (err) {
      console.error(`  FAILED   photo ${a.public_id}: ${(err as Error).message}`)
      process.exitCode = 1
    }
  }
  console.log(`  RESTORED  records written; ${uploaded}/${photos.length} photos uploaded. Restart the API.\n`)
}

async function main(): Promise<void> {
  const keep = valueAfter('--keep')
  const from = valueAfter('--restore')
  const bizId = valueAfter('--seller')
  if (!keep && !(from && bizId)) {
    console.error('  Pass --keep <SMB IDs, comma-separated>, or --restore <purged file> --seller <SMB ID>.')
    process.exitCode = 1
    return
  }
  await initStore()
  console.log('')
  if (from && bizId) await restore(from, bizId)
  else await purge(keep!.split(',').map((s) => s.trim()).filter(Boolean))
  process.exit()
}

main().catch((err: unknown) => {
  console.error('[purge-sellers] failed:', err)
  process.exit(1)
})
