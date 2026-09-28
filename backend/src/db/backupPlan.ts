import { gunzipSync } from 'node:zlib'
import { parseCloudinaryUrl, parseServiceAccount, type CloudinaryConfig } from '../config.js'
import { COLLECTIONS, isBulkDelete } from './firestore.js'

/**
 * THE RULES OF `npm run backup`
 * =============================
 * The live project is on the Spark plan, so there are no managed backups and
 * no point-in-time recovery - only the one hour of version history that
 * rescued six sellers on 10 September 2026. The backup is instead a copy into
 * separate free Firebase and Cloudinary accounts, and this file decides what
 * that copy does. scripts/backup.ts does the reading and writing.
 *
 * Nothing here ever writes to the live project. It is read, once per run.
 */

/**
 * `sessions` holds live credentials. Copying it to another account only
 * widens who could steal one; losing it in a disaster means everybody signs
 * in again, which is the cheapest thing on this list.
 */
export const BACKED_UP = COLLECTIONS.filter((name) => name !== 'sessions')
export type BackedUp = (typeof BACKED_UP)[number]

/**
 * A rolling log the app prunes on its own schedule, so a large drop there is
 * housekeeping rather than a wipe. Exempt from the shrink check below.
 */
const ROLLING: readonly string[] = ['authEvents']

/**
 * Key order is not part of a document, so two copies of the same one must
 * compare equal however each read happened to order its fields.
 */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/**
 * What one collection in a backup must change to match the live one: the
 * documents that differ, and the ones the live project no longer has.
 *
 * The backup MIRRORS deletions rather than keeping everything forever. A copy
 * that never deletes brings back every purged demo seller and every deleted
 * draft on the day it is restored, and it only ever grows, so no shrink check
 * could be measured against it. What stops a wipe being mirrored is
 * `shrinkProblems`, the rotation between targets, and the dated local files.
 */
export function planCollection(
  live: Map<string, unknown>,
  backup: Map<string, unknown>,
): { write: string[]; remove: string[] } {
  const write: string[] = []
  for (const [id, doc] of live) {
    if (!backup.has(id) || stableJson(backup.get(id)) !== stableJson(doc)) write.push(id)
  }
  const remove = [...backup.keys()].filter((id) => !live.has(id))
  return { write, remove }
}

/**
 * Reasons NOT to copy into this backup today.
 *
 * The same line the live app draws in `isBulkDelete`: no collection may lose
 * more than half its documents in one step. On 10 September the live project
 * held empty `sellers` and `products` for a few minutes; a backup taken in
 * those minutes would have faithfully deleted its own copy of six women. So a
 * live project that has shrunk that far since the backup was taken is treated
 * as the problem, and the backup is left as the evidence.
 *
 * `ALLOW_BULK_DELETE=true` on the command is the override, as everywhere else.
 */
export function shrinkProblems(
  liveCounts: Record<string, number>,
  backupCounts: Record<string, number>,
  // A restore runs the same check the other way round - a local file as the
  // source, the live project as the target - and says so in its own words.
  labels = { source: 'live', sourceWhole: 'the live project', target: 'the backup' },
): string[] {
  const problems: string[] = []
  const liveTotal = Object.values(liveCounts).reduce((a, b) => a + b, 0)
  const backupTotal = Object.values(backupCounts).reduce((a, b) => a + b, 0)
  if (liveTotal === 0 && backupTotal > 0) {
    problems.push(`${labels.sourceWhole} read as EMPTY, and ${labels.target} holds ${backupTotal} documents`)
  }
  for (const [name, before] of Object.entries(backupCounts)) {
    if (ROLLING.includes(name)) continue
    const now = liveCounts[name] ?? 0
    if (isBulkDelete(before - now, before)) {
      problems.push(`${name}: ${before} in ${labels.target}, only ${now} ${labels.source}`)
    }
  }
  return problems
}

/**
 * The dated copy's name, stored or on disk. Gzipped: it is JSON, which
 * compresses about tenfold, and one is written per run, so it is the
 * difference between megabytes and gigabytes a year once the order history
 * grows.
 */
export function snapshotName(now: Date): string {
  return `firestore-${now.toISOString().slice(0, 16).replace(':', '-')}.json.gz`
}

const SNAPSHOT = /^firestore-(\d{4})-(\d{2})-(\d{2})T\d{2}-\d{2}\.json(\.gz)?$/

export function isSnapshotName(name: string): boolean {
  return SNAPSHOT.test(name)
}

/**
 * Slack on the twelve months, in days. The dated copies are pruned by the
 * nightly run, and a scheduled GitHub run can start late or skip a night;
 * a week early means a copy one night short of its anniversary is never the
 * one that outlives the promise.
 */
export const PRUNE_AHEAD_DAYS = 7

/**
 * Which dated copies to delete: everything older than `keepDays`, except the
 * earliest copy of each calendar month, which is kept for `keepMonths`.
 *
 * Every day of the last month, because damage is usually noticed within days
 * and the day before it is the copy wanted. One per month after that, because
 * "what did the shop look like in March" is a question a funder's report will
 * ask, and a year of monthly copies costs less than a week of daily ones.
 *
 * And not for good. Each copy holds every phone number and address in the
 * database on that day, including those of people who have since deleted
 * their accounts; the privacy policy promises backups are kept for a
 * limited time, and a monthly file kept for ever is not a limited time. The
 * default is twelve months - a year of monthly copies is what a funder's
 * report needs, and after a year the numbers in it are somebody else's.
 *
 * Names this function does not recognise are never touched.
 */
export function snapshotsToPrune(
  names: string[],
  now: Date,
  keepDays: number,
  keepMonths = Number.POSITIVE_INFINITY,
): string[] {
  // Whole days: a copy dated exactly `keepDays` ago is inside the window all
  // that day, not only until the hour it happened to be taken.
  const then = new Date(now.getTime() - keepDays * 86_400_000)
  const cutoff = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate())
  // By the copy's own date, not by calendar month. The privacy policy says
  // deleted information leaves the monthly copies WITHIN 12 months, so a copy
  // goes on the day it turns `keepMonths` old. Counting whole months let the
  // copy of 1 September live until October of the next year - 13 months for
  // anything deleted on 2 September.
  //
  // And a week early (`PRUNE_AHEAD_DAYS`): a copy is only pruned when a run
  // happens, and a run can be late.
  const monthCutoff = Number.isFinite(keepMonths)
    ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - keepMonths, now.getUTCDate() + PRUNE_AHEAD_DAYS)
    : Number.NEGATIVE_INFINITY
  const dated = names
    .map((name) => ({ name, m: SNAPSHOT.exec(name) }))
    .filter((f): f is { name: string; m: RegExpExecArray } => f.m !== null)
    .sort((a, b) => a.name.localeCompare(b.name))

  const monthly = new Set<string>()
  const firstOfMonth = new Set<string>()
  for (const { name, m } of dated) {
    const month = `${m[1]}-${m[2]}`
    if (!monthly.has(month)) {
      monthly.add(month)
      firstOfMonth.add(name)
    }
  }

  return dated
    .filter(({ name, m }) => {
      const day = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      if (day >= cutoff) return false
      return !firstOfMonth.has(name) || day <= monthCutoff
    })
    .map(({ name }) => name)
}

/**
 * THE DATED COPIES LIVE IN THE BACKUP PROJECT, AND PRUNE THEMSELVES.
 *
 * They used to be files on a laptop, pruned only when somebody ran the backup
 * there - so the privacy policy's "within 12 months" held exactly as long as
 * somebody remembered. The nightly GitHub run now stores each night's copy in
 * the backup Firestore and prunes the old ones by `snapshotsToPrune`, the same
 * rule the files followed, with nobody in the loop.
 *
 * A collection of its own, which is not in `COLLECTIONS`: the mirror and the
 * restore only touch the collections they are handed, so neither ever reads,
 * copies or empties it, and the app never loads it if the backup project is
 * ever made the live one.
 */
export const SNAPSHOT_COLLECTION = 'snapshots'

/**
 * A Firestore document holds at most 1 MiB, field names included. Today's copy
 * is about 42 KB gzipped; a copy that outgrows one document is split into
 * parts rather than refused, because the day it outgrows it is not a day to
 * find the backup has stopped.
 */
export const SNAPSHOT_PART_BYTES = 900_000

export function splitSnapshot(bytes: Uint8Array, max = SNAPSHOT_PART_BYTES): Uint8Array[] {
  const parts: Uint8Array[] = []
  for (let i = 0; i < bytes.length; i += max) parts.push(bytes.subarray(i, i + max))
  return parts.length ? parts : [bytes]
}

/** `firestore-2026-09-28T21-30.json.gz~0` - the copy's name, then which part. */
export function snapshotPartId(name: string, part: number): string {
  return `${name}~${part}`
}

export interface SnapshotPart {
  id: string
  snapshot: string
  part: number
  parts: number
}

/**
 * Which stored documents to delete: every part of every copy `snapshotsToPrune`
 * would delete, and every part of a copy that is not whole.
 *
 * A copy missing a part is a run that died halfway through writing it. It can
 * never be restored, and it must not be the one kept as its month's copy - it
 * would push the whole copy of the same month out.
 */
export function storedSnapshotsToPrune(
  parts: SnapshotPart[],
  now: Date,
  keepDays: number,
  keepMonths: number,
): string[] {
  const byName = new Map<string, SnapshotPart[]>()
  for (const p of parts) byName.set(p.snapshot, [...(byName.get(p.snapshot) ?? []), p])

  const whole: string[] = []
  const broken: string[] = []
  for (const [name, found] of byName) {
    const expected = found[0]!.parts
    const complete = new Set(found.map((p) => p.part)).size === expected
      && found.every((p) => p.parts === expected && p.part >= 0 && p.part < expected)
    ;(complete ? whole : broken).push(name)
  }
  const doomed = new Set([...snapshotsToPrune(whole, now, keepDays, keepMonths), ...broken])
  return parts.filter((p) => doomed.has(p.snapshot)).map((p) => p.id)
}

/** The parts of one copy put back together, or an error naming what is missing. */
export function joinSnapshot(parts: { part: number; parts: number; data: Uint8Array }[]): Uint8Array {
  if (parts.length === 0) throw new Error('no such copy')
  const expected = parts[0]!.parts
  const sorted = [...parts].sort((a, b) => a.part - b.part)
  if (sorted.length !== expected || sorted.some((p, i) => p.part !== i)) {
    throw new Error(`the copy is incomplete: ${sorted.length} of ${expected} parts`)
  }
  return Buffer.concat(sorted.map((p) => p.data))
}

/**
 * Is the copy that came back from the backup project the copy that went in?
 *
 * The backup keys live only in GitHub, so no laptop ever reads a stored copy
 * until the day one is needed - and a copy nobody has read back is a hope,
 * not a backup. The nightly run therefore reads tonight's copy straight back
 * and asks this: the same bytes, unpacking to the same number of documents
 * in every collection the live project had. A null is a copy that restores.
 */
export function readBackProblem(
  stored: Uint8Array,
  sent: Uint8Array,
  liveCounts: Record<string, number>,
): string | null {
  if (Buffer.compare(Buffer.from(stored), Buffer.from(sent)) !== 0) {
    return `read back ${stored.length} bytes, but ${sent.length} were stored and they differ`
  }
  let json: unknown
  try {
    json = JSON.parse(gunzipSync(stored).toString('utf8'))
  } catch (err) {
    return `does not unpack as a database copy: ${(err as Error).message}`
  }
  const { collections, problems } = parseSnapshot(json)
  if (problems.length) return problems.join('; ')
  const wrong = Object.entries(liveCounts)
    .filter(([name, n]) => (collections.get(name)?.size ?? -1) !== n)
    .map(([name, n]) => `${name}: ${collections.get(name)?.size ?? 'missing'} in the copy, ${n} live`)
  return wrong.length ? wrong.join('; ') : null
}

/**
 * Which photos a backup holds that the live account no longer does.
 *
 * Photos used to be kept in every copy for ever, on the argument that the
 * payment screenshots are the proof behind approvals. Two things changed
 * it: a seller who deletes her account has her screenshots and her product
 * photos destroyed on the live account, as the privacy policy says - and a
 * backup that kept them was keeping exactly what she had been told was
 * gone; and a photo of a product she took down is nobody's to keep either.
 *
 * The same line as the database: if more than half the backup's photos
 * would go, or the live account reads as empty, that is a problem with the
 * live account, named in `problem`, and the caller removes nothing unless
 * `ALLOW_BULK_DELETE=true` says the shrink is deliberate.
 */
export function photosToPrune(
  livePublicIds: Iterable<string>,
  backupPublicIds: Iterable<string>,
  labels = { source: 'live', target: 'the backup' },
): { remove: string[]; problem: string | null } {
  const live = new Set(livePublicIds)
  const backup = [...backupPublicIds]
  const remove = backup.filter((id) => !live.has(id))
  if (remove.length === 0) return { remove, problem: null }
  if (live.size === 0) {
    return { remove, problem: `the ${labels.source} account lists no photos, and ${labels.target} holds ${backup.length}` }
  }
  if (isBulkDelete(remove.length, backup.length)) {
    return { remove, problem: `${remove.length} of ${backup.length} photos in ${labels.target} are gone from ${labels.source}` }
  }
  return { remove, problem: null }
}

/**
 * A local copy, as the collections a restore would write.
 *
 * Only backed-up collections are taken: `sessions` is empty in every copy by
 * design, and a restore must never touch the live one - that would sign out
 * everybody who is using the app while it runs. A collection the file does
 * not have is left out rather than read as empty, so an old file never
 * empties a collection that did not exist when it was written.
 */
export function parseSnapshot(json: unknown): {
  collections: Map<string, Map<string, Record<string, unknown>>>
  problems: string[]
} {
  const collections = new Map<string, Map<string, Record<string, unknown>>>()
  const problems: string[] = []
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { collections, problems: ['the file is not a database copy (expected an object of collections)'] }
  }
  const obj = json as Record<string, unknown>
  for (const name of BACKED_UP) {
    const rows = obj[name]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) {
      problems.push(`${name} is not a list`)
      continue
    }
    const docs = new Map<string, Record<string, unknown>>()
    for (const row of rows) {
      const id = (row as { id?: unknown } | null)?.id
      if (typeof id !== 'string' || !id) {
        problems.push(`${name} has a document with no id`)
        continue
      }
      docs.set(id, row as Record<string, unknown>)
    }
    collections.set(name, docs)
  }
  if (collections.size === 0 && problems.length === 0) {
    problems.push('the file holds none of the backed-up collections')
  }
  return { collections, problems }
}

/**
 * The public_id each downloaded photo was stored under, read back from where
 * the backup put it: `images/<public_id>.<format>`. Paths outside the app's
 * folder are ignored - nothing else in that directory was put there by us.
 */
export function imagePublicIds(relativePaths: string[], folder: string): { path: string; publicId: string }[] {
  return relativePaths
    .map((p) => ({ path: p, publicId: p.replace(/\\/g, '/').replace(/\.[^./]+$/, '') }))
    .filter(({ publicId }) => publicId.startsWith(`${folder}/`))
}

export interface BackupTarget {
  name: string
  firestore?: { projectId: string; clientEmail: string; privateKey: string; databaseId?: string }
  cloudinary?: CloudinaryConfig
}

/**
 * Targets come from the environment, so no key is ever in the repo:
 *
 *   BACKUP_TARGETS=a,b
 *   BACKUP_A_FIREBASE_SERVICE_ACCOUNT=<json or base64>
 *   BACKUP_A_FIRESTORE_DATABASE_ID=      (optional, named database)
 *   BACKUP_A_CLOUDINARY_URL=cloudinary://key:secret@cloud
 *
 * A target may have either half. One with neither is a mistake, not a choice.
 */
export function readTargets(
  env: Record<string, string | undefined>,
  folder: string,
): { targets: BackupTarget[]; problems: string[] } {
  const targets: BackupTarget[] = []
  const problems: string[] = []
  const names = (env.BACKUP_TARGETS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  for (const name of names) {
    const key = name.toUpperCase().replace(/[^A-Z0-9]/g, '_')
    const target: BackupTarget = { name }

    const raw = env[`BACKUP_${key}_FIREBASE_SERVICE_ACCOUNT`]?.trim()
    if (raw) {
      const account = parseServiceAccount(raw)
      if (account) {
        const databaseId = env[`BACKUP_${key}_FIRESTORE_DATABASE_ID`]?.trim() || undefined
        target.firestore = { ...account, databaseId }
      } else {
        problems.push(`BACKUP_${key}_FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64 JSON`)
      }
    }

    const url = env[`BACKUP_${key}_CLOUDINARY_URL`]?.trim()
    if (url) {
      const parsed = parseCloudinaryUrl(url, folder)
      if (parsed) target.cloudinary = parsed
      else problems.push(`BACKUP_${key}_CLOUDINARY_URL is malformed; expected cloudinary://key:secret@cloud`)
    }

    if (!raw && !url) problems.push(`backup target "${name}" has neither a Firebase key nor a Cloudinary URL`)
    targets.push(target)
  }
  return { targets, problems }
}

/**
 * Which targets this run copies into.
 *
 * Named on the command line, those. Otherwise ONE target, rotating by day,
 * because two backups taken at the same moment are one backup twice: damage
 * nobody notices until tomorrow is then in both. With two targets, the one
 * not copied today still holds yesterday.
 */
export function pickTargets(
  targets: BackupTarget[],
  requested: string[],
  now: Date,
): { chosen: BackupTarget[]; unknown: string[] } {
  if (requested.length > 0) {
    const unknown = requested.filter((r) => !targets.some((t) => t.name === r))
    return { chosen: targets.filter((t) => requested.includes(t.name)), unknown }
  }
  if (targets.length === 0) return { chosen: [], unknown: [] }
  const day = Math.floor(now.getTime() / 86_400_000)
  return { chosen: [targets[day % targets.length]!], unknown: [] }
}
