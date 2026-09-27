import { Router } from 'express'
import { getDb, save } from '../db/store.js'
import { fileReport } from '../db/reports.js'
import { requireRole } from '../middleware/auth.js'

/**
 * SOMEBODY SAYING SOMETHING SHOULD NOT BE HERE.
 *
 * Anyone can list anything in this market and an admin sees a listing only
 * when it is submitted; after that the people looking at it are buyers. This
 * is the route that lets one of them say so - and the in-app reporting that
 * Google Play requires of an app carrying what its users write, including a
 * way to report the account behind a post, not only the post.
 *
 * Which side is asking comes from the session, never the body. The rules -
 * who may report what, with which reasons, and that a seller has actually
 * met the buyer she is reporting - are in db/reports.ts.
 */
export const reportsRouter: Router = Router()

reportsRouter.post('/', requireRole('customer', 'seller'), (req, res) => {
  const db = getDb()
  const byRole = req.auth!.role === 'seller' ? 'seller' as const : 'customer' as const
  const byUserId = (byRole === 'seller' ? req.auth!.sellerId : req.auth!.customerId)!
  const b = req.body ?? {}

  const result = fileReport(db, {
    byRole, byUserId,
    targetType: b.targetType, targetId: b.targetId, reason: b.reason, note: b.note, orderId: b.orderId,
  })
  if (!result.ok) {
    const { status, ...body } = result
    res.status(status).json(body)
    return
  }
  if (result.duplicate) {
    res.json({ ok: true, report: result.report, duplicate: true })
    return
  }
  save()
  res.status(201).json({ ok: true, report: result.report })
})
