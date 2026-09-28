/**
 * Clearing the test sellers out before handover, and putting one back.
 *
 * The rule is a KEEP list, by the SMB ID printed on her packaging: every
 * seller not on it goes, with everything hanging off her. A delete list would
 * have to name twenty-three testers correctly; a keep list names the two real
 * women, and a typo in it stops the run instead of deleting her (see
 * `missing`).
 *
 * `admins` and `authEvents` are never touched: the first are staff, the second
 * holds only masked phones and hashed addresses and prunes itself by age.
 */
import type { ReportTarget } from '@shared/report.js'
import type { Db } from './seed.js'

export const PURGED = [
  'sellers', 'products', 'orders', 'payments', 'customers', 'reviews', 'reports', 'complaints', 'sessions',
] as const
export type Purged = { [K in (typeof PURGED)[number]]: Db[K] }

export function planPurge(db: Db, keepBizIds: string[]): { doomed: Purged; missing: string[] } {
  const missing = keepBizIds.filter((b) => !db.sellers.some((s) => s.womenBizId === b))
  const sellers = new Set(db.sellers.filter((s) => keepBizIds.includes(s.womenBizId)).map((s) => s.id))
  const keptOrders = db.orders.filter((o) => sellers.has(o.sellerId))
  const orders = new Set(keptOrders.map((o) => o.id))
  // A buyer stays only because a kept shop's order names her, or because the
  // desk banned her number: the ban lives on her row, so deleting the row
  // would quietly lift it. Everyone else - including the testers who signed
  // in and never bought - goes.
  const customers = new Set([
    ...keptOrders.map((o) => o.customerId),
    ...db.customers.filter((c) => c.blocked).map((c) => c.id),
  ])
  const reviews = new Set(db.reviews.filter((r) => orders.has(r.orderId)).map((r) => r.id))
  const products = new Set(db.products.filter((p) => sellers.has(p.sellerId)).map((p) => p.id))
  // Typed per target, so a new kind of report is a compile error here rather
  // than a report judged against the wrong list.
  const target: Record<ReportTarget, Set<string>> = { product: products, review: reviews, seller: sellers, customer: customers }

  const person = (role: 'seller' | 'customer', id: string) =>
    role === 'seller' ? sellers.has(id) : customers.has(id)

  return {
    missing,
    doomed: {
      sellers: db.sellers.filter((s) => !sellers.has(s.id)),
      products: db.products.filter((p) => !products.has(p.id)),
      orders: db.orders.filter((o) => !orders.has(o.id)),
      payments: db.payments.filter((p) => !sellers.has(p.sellerId)),
      customers: db.customers.filter((c) => !customers.has(c.id)),
      reviews: db.reviews.filter((r) => !reviews.has(r.id)),
      reports: db.reports.filter((r) => !person(r.byRole, r.byUserId) || !target[r.targetType].has(r.targetId)),
      complaints: db.complaints.filter((c) => !person(c.byRole, c.byUserId)),
      // A session with no kept person behind it is a tester's phone still
      // signed in; one mid-registration has no id yet and signs in again.
      sessions: db.sessions.filter((s) =>
        s.role !== 'admin' && !sellers.has(s.sellerId ?? '') && !customers.has(s.customerId ?? '')),
    },
  }
}

/** One removed seller and what went with her, out of a purge file, for putting back. */
export function sellerRecords(purged: Purged, bizId: string): Omit<Purged, 'sessions'> | null {
  const seller = purged.sellers.find((s) => s.womenBizId === bizId)
  if (!seller) return null
  const orders = purged.orders.filter((o) => o.sellerId === seller.id)
  const orderIds = new Set(orders.map((o) => o.id))
  const buyers = new Set(orders.map((o) => o.customerId))
  return {
    sellers: [seller],
    products: purged.products.filter((p) => p.sellerId === seller.id),
    orders,
    payments: purged.payments.filter((p) => p.sellerId === seller.id),
    customers: purged.customers.filter((c) => buyers.has(c.id)),
    reviews: purged.reviews.filter((r) => orderIds.has(r.orderId)),
    reports: purged.reports.filter((r) => r.sellerId === seller.id),
    complaints: purged.complaints.filter((c) => c.byUserId === seller.id),
  }
}
