import type { Firestore } from 'firebase-admin/firestore'
import type { CloudinaryConfig } from '../config.js'
import { sign } from '../routes/uploads.routes.js'
import {
  SNAPSHOT_COLLECTION, joinSnapshot, planCollection, snapshotPartId, splitSnapshot, type SnapshotPart,
} from './backupPlan.js'

/**
 * The reading and writing that `npm run backup` and `npm run restore` share.
 * One copy of it, so a restore moves documents and photos exactly the way the
 * backup that made them did - and a fix to one is a fix to both.
 */

export type Docs = Map<string, Record<string, unknown>>
export type Collections = Record<string, Docs>

export async function readCollections(db: Firestore, names: readonly string[]): Promise<Collections> {
  const out: Collections = {}
  for (const name of names) {
    const snap = await db.collection(name).get()
    out[name] = new Map(snap.docs.map((d) => [d.id, d.data()]))
  }
  return out
}

export function countsOf(data: Collections): Record<string, number> {
  return Object.fromEntries(Object.entries(data).map(([name, docs]) => [name, docs.size]))
}

/**
 * Make `target` match `source`, collection by collection, writing only what
 * differs. Only the collections named in `source` are touched, so a snapshot
 * that predates a collection leaves that collection alone rather than
 * emptying it.
 *
 * `current` is what the target holds now, read by the caller - who also
 * decides, before calling this, whether the change is safe to make.
 */
export async function applyMirror(
  db: Firestore,
  source: Collections,
  current: Collections,
  dryRun: boolean,
): Promise<{ written: number; removed: number }> {
  let batch = db.batch()
  let pending = 0
  let written = 0
  let removed = 0
  const commit = async () => {
    if (pending === 0) return
    if (!dryRun) await batch.commit()
    batch = db.batch()
    pending = 0
  }

  for (const [name, docs] of Object.entries(source)) {
    const plan = planCollection(docs, current[name] ?? new Map())
    for (const id of plan.write) {
      batch.set(db.collection(name).doc(id), docs.get(id)!)
      written++
      if (++pending >= 450) await commit()
    }
    for (const id of plan.remove) {
      batch.delete(db.collection(name).doc(id))
      removed++
      if (++pending >= 450) await commit()
    }
  }
  await commit()
  return { written, removed }
}

/* ------------------------------------------------------------------ */
/* Dated copies stored in a backup project                             */
/* ------------------------------------------------------------------ */

/**
 * Store one dated copy, split into as many documents as it needs. The bytes
 * are stored as Firestore bytes, not base64, so a part carries no overhead.
 *
 * One write per part, not one batch: a batch is capped at 10 MiB, which a
 * copy of a dozen parts would exceed. A run that dies between parts leaves a
 * copy that is not whole, and `storedSnapshotsToPrune` removes those.
 */
export async function storeSnapshot(db: Firestore, name: string, gz: Uint8Array, takenAt: Date): Promise<number> {
  const chunks = splitSnapshot(gz)
  // A second run inside the same minute reuses the name. Its old parts go
  // first, or a leftover third part beside a new two-part copy makes the
  // new one look broken and the prune takes it.
  const stale = await db.collection(SNAPSHOT_COLLECTION).where('snapshot', '==', name).select().get()
  await deleteSnapshotParts(db, stale.docs.map((d) => d.id))
  for (const [part, data] of chunks.entries()) {
    await db.collection(SNAPSHOT_COLLECTION).doc(snapshotPartId(name, part)).set({
      snapshot: name, part, parts: chunks.length, takenAt: takenAt.toISOString(), data: Buffer.from(data),
    })
  }
  return chunks.length
}

/** Every stored part, without its bytes - a listing, not a download. */
export async function listSnapshotParts(db: Firestore): Promise<SnapshotPart[]> {
  const snap = await db.collection(SNAPSHOT_COLLECTION).select('snapshot', 'part', 'parts').get()
  return snap.docs.map((d) => {
    const data = d.data() as { snapshot?: unknown; part?: unknown; parts?: unknown }
    return {
      id: d.id,
      snapshot: String(data.snapshot ?? ''),
      part: Number(data.part),
      parts: Number(data.parts),
    }
  })
}

export async function deleteSnapshotParts(db: Firestore, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 450) {
    const batch = db.batch()
    for (const id of ids.slice(i, i + 450)) batch.delete(db.collection(SNAPSHOT_COLLECTION).doc(id))
    await batch.commit()
  }
}

/** One stored copy's gzipped bytes, put back together. */
export async function fetchSnapshot(db: Firestore, name: string): Promise<Uint8Array> {
  const snap = await db.collection(SNAPSHOT_COLLECTION).where('snapshot', '==', name).get()
  return joinSnapshot(snap.docs.map((d) => {
    const data = d.data() as { part: number; parts: number; data: Uint8Array }
    return { part: data.part, parts: data.parts, data: data.data }
  }))
}

export interface Asset {
  public_id: string
  format: string
  secure_url: string
}

/** Every image under the app's folder. The Admin API pages at 500. */
export async function listAssets(account: CloudinaryConfig, folder: string): Promise<Asset[]> {
  const auth = Buffer.from(`${account.apiKey}:${account.apiSecret}`).toString('base64')
  const out: Asset[] = []
  let cursor: string | undefined
  do {
    const query = new URLSearchParams({ prefix: `${folder}/`, max_results: '500' })
    if (cursor) query.set('next_cursor', cursor)
    const resp = await fetch(
      `https://api.cloudinary.com/v1_1/${account.cloudName}/resources/image/upload?${query}`,
      { headers: { Authorization: `Basic ${auth}` } },
    )
    if (!resp.ok) throw new Error(`listing ${account.cloudName} failed: HTTP ${resp.status} ${await resp.text()}`)
    const page = (await resp.json()) as { resources: Asset[]; next_cursor?: string }
    out.push(...page.resources)
    cursor = page.next_cursor
  } while (cursor)
  return out
}

/**
 * Remove images from a backup account, by public_id. The Admin API takes
 * up to a hundred at a time. Only the backup script calls this, only with
 * ids `photosToPrune` chose, and never against the live account - the
 * script refuses a live target before it gets here.
 */
export async function deleteAssets(account: CloudinaryConfig, publicIds: string[]): Promise<number> {
  const auth = Buffer.from(`${account.apiKey}:${account.apiSecret}`).toString('base64')
  let deleted = 0
  for (let i = 0; i < publicIds.length; i += 100) {
    const body = new URLSearchParams()
    for (const id of publicIds.slice(i, i + 100)) body.append('public_ids[]', id)
    const resp = await fetch(
      `https://api.cloudinary.com/v1_1/${account.cloudName}/resources/image/upload`,
      { method: 'DELETE', headers: { Authorization: `Basic ${auth}` }, body },
    )
    if (!resp.ok) throw new Error(`deleting from ${account.cloudName} failed: HTTP ${resp.status} ${await resp.text()}`)
    const result = (await resp.json()) as { deleted?: Record<string, string> }
    deleted += Object.values(result.deleted ?? {}).filter((v) => v === 'deleted').length
  }
  return deleted
}

/**
 * Upload one image under a given public_id, never replacing one already
 * there. `file` is either a URL, which Cloudinary fetches itself so nothing
 * passes through this machine, or the bytes of a file on disk.
 *
 * Keeping the public_id is the point: the database stores full URLs, and an
 * image put back under its old id answers at its old address.
 */
export async function uploadAsset(to: CloudinaryConfig, file: string | Blob, publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000)
  const body = new FormData()
  body.append('file', file)
  body.append('overwrite', 'false')
  body.append('public_id', publicId)
  body.append('timestamp', String(timestamp))
  body.append('api_key', to.apiKey)
  body.append('signature', sign({ overwrite: 'false', public_id: publicId, timestamp }, to.apiSecret))

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${to.cloudName}/image/upload`, {
    method: 'POST',
    body,
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${await resp.text()}`)
}
