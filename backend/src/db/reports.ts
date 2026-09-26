import type { Report } from '@shared/types.js'
import {
  MAX_REPORT_NOTE, type ReportReason, type ReportTarget, isReportTarget, mayReport, reportProblems,
} from '@shared/report.js'
import type { Db } from './seed.js'
import { newId } from './ids.js'
import { PLACEHOLDER_NAME, findCustomer } from './customers.js'

/**
 * SOMEBODY SAYING SOMETHING SHOULD NOT BE HERE, APPLIED.
 *
 * `shared/src/report.ts` says what may be reported, by whom and for which
 * reasons. This file checks that the thing exists and that the person
 * reporting it has actually met it through the app, then writes the row.
 * `POST /reports` is a thin wrapper; the admin routes read the queues below.
 *
 * Reports are stored rather than derived: nothing else changes when somebody
 * reports something, so the row IS the record. Nothing here calls `save()`.
 */

export interface ReportInput {
  byRole: 'customer' | 'seller'
  byUserId: string
  targetType?: unknown
  targetId?: unknown
  reason?: unknown
  note?: unknown
  orderId?: unknown
}

export type FileReportResult =
  | { ok: true; report: Report; duplicate: boolean }
  | { ok: false; status: number; error: string; messageMr: string; fields?: Record<string, string> }

const NOT_FOUND = { status: 404, error: 'Not found', messageMr: 'हे सापडले नाही' } as const

/**
 * What the report is about, looked up so the queue can be read without joins.
 * Null means "nothing to report here", which the route answers as a 404 - the
 * same 404 whether the id never existed or the caller had no business with
 * it, so a stranger probing ids learns nothing.
 */
function describeTarget(
  db: Db,
  input: ReportInput,
  target: ReportTarget,
  targetId: string,
): { sellerId?: string; targetName?: string; orderId?: string } | null {
  switch (target) {
    case 'product': {
      const product = db.products.find((p) => p.id === targetId)
      return product ? { sellerId: product.sellerId, targetName: product.name } : null
    }
    case 'review': {
      const review = db.reviews.find((r) => r.id === targetId)
      return review ? { sellerId: review.sellerId, targetName: review.productName } : null
    }
    case 'seller': {
      // A shop that has been erased is nobody's to report any more; one that
      // is merely closing, blocked or paused still is - the complaint may be
      // about how it got there.
      const seller = db.sellers.find((s) => s.id === targetId && !s.closedAt)
      return seller ? { sellerId: seller.id, targetName: seller.shopName } : null
    }
    case 'customer': {
      /**
       * A seller only ever meets a buyer through an order, so the buyer has
       * to be somebody who ordered from HER. Without that check a seller
       * could report any buyer id she found - and buyer ids are phone
       * numbers, so "found" is not hard.
       */
      const between = db.orders.filter((o) => o.sellerId === input.byUserId && o.customerId === targetId)
      if (between.length === 0) return null
      const named = typeof input.orderId === 'string' && input.orderId
        ? between.find((o) => o.id === input.orderId)
        : between[0]
      if (!named) return null
      const row = findCustomer(db, targetId)
      return { targetName: row?.name || named.customerName, orderId: named.id }
    }
  }
}

export function fileReport(db: Db, input: ReportInput, now = Date.now()): FileReportResult {
  const target = input.targetType
  const targetId = typeof input.targetId === 'string' ? input.targetId : ''
  if (!isReportTarget(target) || !targetId) {
    return { ok: false, status: 400, error: 'Unknown target', messageMr: 'हे नोंदवता आले नाही' }
  }
  // 403 rather than 404: the thing may well exist, it is just not hers to
  // flag. A seller reporting a rival's listing is the case this stops.
  if (!mayReport(input.byRole, target)) {
    return { ok: false, status: 403, error: 'Not allowed', messageMr: 'तुम्हाला परवानगी नाही' }
  }

  const fields = reportProblems({ reason: input.reason, note: input.note }, target)
  if (Object.keys(fields).length) {
    return { ok: false, status: 400, error: 'Validation failed', messageMr: 'कारण निवडा', fields }
  }

  const about = describeTarget(db, input, target, targetId)
  if (!about) return { ok: false, ...NOT_FOUND }

  /**
   * One report per person per thing. A second tap is a woman making sure it
   * went, not a second complaint, and counting it twice would make three
   * annoyed people look like a scandal in the admin queue.
   */
  const already = db.reports.find(
    (r) => r.byUserId === input.byUserId && r.targetId === targetId && !r.reviewedAt,
  )
  if (already) return { ok: true, report: already, duplicate: true }

  const reason = input.reason as ReportReason
  const report: Report = {
    id: newId('rep'),
    targetType: target,
    targetId,
    sellerId: about.sellerId,
    targetName: about.targetName,
    reason,
    note: reason === 'other' ? String(input.note ?? '').trim().slice(0, MAX_REPORT_NOTE) : undefined,
    byUserId: input.byUserId,
    byRole: input.byRole,
    orderId: about.orderId,
    at: new Date(now).toISOString(),
  }
  db.reports.push(report)
  return { ok: true, report, duplicate: false }
}

/* ------------------------------------------------------------------ */
/* What the console reads                                              */
/* ------------------------------------------------------------------ */

/** Open reports about one thing. */
export function openReportsFor(db: Db, targetId: string, targetType?: ReportTarget): Report[] {
  return db.reports.filter(
    (r) => r.targetId === targetId && !r.reviewedAt && (!targetType || r.targetType === targetType),
  )
}

/**
 * Looked at, and the thing stays. The reports are closed rather than
 * deleted: "three people complained and an admin disagreed" is a different
 * fact from "nobody ever complained", and the next report starts a new row.
 */
export function closeReports(db: Db, targetId: string, by: string, now = Date.now()): number {
  const at = new Date(now).toISOString()
  let closed = 0
  for (const r of db.reports) {
    if (r.targetId === targetId && !r.reviewedAt) {
      r.reviewedAt = at
      r.reviewedBy = by
      closed++
    }
  }
  return closed
}

/** Open reports about shops, keyed by seller id - what the register decorates rows with. */
export function reportsBySeller(db: Db): Map<string, Report[]> {
  const out = new Map<string, Report[]>()
  for (const r of db.reports) {
    if (r.targetType !== 'seller' || r.reviewedAt) continue
    const list = out.get(r.targetId) ?? []
    list.push(r)
    out.set(r.targetId, list)
  }
  return out
}

/**
 * A reported buyer, as the console shows her. A buyer has no page of her
 * own, so the row carries what the desk needs to ring her, and whether she
 * is already blocked - read off the customer record at request time, never
 * copied onto the report, so a block made a minute ago shows at once.
 */
export interface ReportedBuyer {
  customerId: string
  name: string
  phone: string
  blocked: boolean
  blockReason?: string
  reports: Report[]
}

export function reportedBuyers(db: Db): ReportedBuyer[] {
  const groups = new Map<string, Report[]>()
  for (const r of db.reports) {
    if (r.targetType !== 'customer' || r.reviewedAt) continue
    const list = groups.get(r.targetId) ?? []
    list.push(r)
    groups.set(r.targetId, list)
  }
  const out: ReportedBuyer[] = []
  for (const [customerId, reports] of groups) {
    const row = findCustomer(db, customerId)
    // A buyer with no row is still on her orders, which carry her number.
    const order = db.orders.find((o) => o.customerId === customerId && o.customerPhone)
    out.push({
      customerId,
      name: row?.name || order?.customerName || PLACEHOLDER_NAME,
      phone: row?.phone || order?.customerPhone || '',
      blocked: !!row?.blocked,
      blockReason: row?.blockReason,
      reports: [...reports].sort((a, b) => b.at.localeCompare(a.at)),
    })
  }
  return out.sort((a, b) => b.reports[0]!.at.localeCompare(a.reports[0]!.at))
}
