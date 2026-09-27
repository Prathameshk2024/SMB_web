import type { OutsidePaymentMethod, Seller, SubscriptionPayment } from '@shared/types.js'
import {
  RENEW_REMINDER_DAYS, SUBSCRIPTION_MONTHS, addMonths, endsAtAfterApproval, isExpired,
  paymentKindProblem, type PaymentKind,
} from '@shared/subscription.js'
import { PLAN, slotInfo } from '@shared/seller.js'
import { normalizeUtr, paidAtProblem, utrProblem } from '@shared/payment.js'
import { appendNotice } from './notices.js'
import { newId } from './ids.js'
import type { Db } from './seed.js'

export const OUTSIDE_PAYMENT_METHODS: readonly OutsidePaymentMethod[] = ['CASH', 'UPI', 'OTHER']

type Refusal = { status: number; error: string; messageMr: string }

/**
 * A payment staff took outside the app, recorded as approved in one step.
 *
 * The APK shows no price and takes no money - Google Play requires its own
 * billing for anything that unlocks the app, and this ₹50 buys slots and time.
 * So a seller on the APK pays the college desk, a coordinator, or the website,
 * and staff record the first two here. It is the same approval as the queue's
 * (`applyApprovedPayment`), which is the point: a renewal recorded here moves
 * her six months exactly as one approved there would. `grant-slots` cannot
 * stand in for it, because goodwill never extends a term.
 *
 * Refused while one of hers waits in the queue: recording the same ₹50 a
 * second time would grant two packs for one payment.
 */
export function recordOutsidePayment(
  db: Pick<Db, 'payments' | 'products'>,
  seller: Seller,
  input: { kind?: unknown; method?: unknown; paidAt?: unknown; utr?: unknown; note?: unknown },
  verifiedBy: string,
  now = new Date(),
): { payment: SubscriptionPayment } | Refusal {
  if (seller.status === 'CLOSED') {
    return { status: 409, error: 'Account is closed', messageMr: 'हे खाते बंद झाले आहे' }
  }
  if (db.payments.some((p) => p.sellerId === seller.id && p.status === 'PENDING')) {
    return {
      status: 409,
      error: 'A payment from her is waiting in the queue - decide that one first',
      messageMr: 'तिचा एक भरणा आधीच तपासणीसाठी थांबला आहे. आधी त्यावर निर्णय घ्या',
    }
  }

  const method = OUTSIDE_PAYMENT_METHODS.find((m) => m === input.method)
  if (!method) return { status: 400, error: 'Choose how it was paid', messageMr: 'पैसे कसे भरले ते निवडा' }

  const kind: PaymentKind | null = input.kind === 'PACK' || input.kind === 'RENEWAL' ? input.kind : null
  if (!kind) return { status: 400, error: 'Choose what it pays for', messageMr: 'भरणा कशासाठी आहे ते निवडा' }
  // What she may pay for on her own screen is what staff may take money for:
  // five slots while she still has empty ones is selling her what she has.
  const slots = slotInfo(seller, db.products.filter((p) => p.sellerId === seller.id))
  const kindFault = paymentKindProblem(kind, seller, slots.left, now.getTime())
  if (kindFault) return { status: 409, error: `Nothing to pay for as ${kind}`, messageMr: kindFault }

  const paidAtFault = paidAtProblem(input.paidAt, now.getTime())
  if (paidAtFault) return { status: 400, error: 'Invalid payment time', messageMr: paidAtFault }

  // A UPI payment is matched against the college's statement by its UTR, so
  // it needs one; cash has none, and "other" may.
  const utr = normalizeUtr(typeof input.utr === 'string' ? input.utr : '')
  if (utr || method === 'UPI') {
    const utrFault = utrProblem(utr)
    if (utrFault) return { status: 400, error: 'Invalid UTR', messageMr: utrFault }
    if (db.payments.some((p) => p.utr === utr)) {
      return { status: 409, error: 'This UTR is already on another payment', messageMr: 'हा UTR आधीच दुसऱ्या भरण्यावर आहे' }
    }
  }

  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : ''
  const at = now.toISOString()
  const payment: SubscriptionPayment = {
    id: newId('sp'),
    kind,
    method,
    ...(note ? { note } : {}),
    sellerId: seller.id,
    sellerName: seller.name,
    womenBizId: seller.womenBizId,
    phone: seller.phone,
    amount: PLAN.price,
    utr,
    payerUpi: '',
    paidAt: new Date(input.paidAt as string).toISOString(),
    submittedAt: at,
    status: 'APPROVED',
    duplicateUtr: false,
    verifiedAt: at,
    verifiedBy,
  }
  db.payments.unshift(payment)
  applyApprovedPayment(seller, payment, at)
  return { payment }
}

/**
 * What approving a payment does to her account.
 *
 * Out of the route so the rules can be tested without a server. The payment
 * has already been checked (UTR, time, receipt) by the admin.
 *
 * - A PACK adds five slots, as it always did.
 * - Either kind may move the end date - see `endsAtAfterApproval`.
 * - She is told what changed, in her own updates list: the slots, and the new
 *   date when there is one.
 * - A blocked seller stays blocked. Paying is not how a block is lifted.
 */
export function applyApprovedPayment(
  seller: Seller,
  payment: SubscriptionPayment,
  approvedAt: string,
): void {
  const kind = payment.kind ?? 'PACK'
  const wasExpired = isExpired(seller, new Date(approvedAt).getTime())
  const before = seller.subscriptionEndsAt

  if (kind === 'PACK') seller.packsApproved += 1
  if (seller.status !== 'BLOCKED') seller.status = 'ACTIVE'

  seller.subscriptionEndsAt = endsAtAfterApproval(seller, kind, approvedAt)
  payment.termEndsAt = seller.subscriptionEndsAt

  if (kind === 'PACK') appendNotice(seller, 'PAYMENT_APPROVED', { n: PLAN.slotsPerPack }, approvedAt)
  // A renewal always says so; a pack only when it happened to reopen a paused
  // shop, which she would otherwise discover by finding her products back.
  if (kind === 'RENEWAL' || (wasExpired && seller.subscriptionEndsAt !== before)) {
    appendNotice(seller, 'SUBSCRIPTION_RENEWED', { note: seller.subscriptionEndsAt }, approvedAt)
  }
}

/**
 * Give every seller who already sells a term, once, when this rule ships.
 *
 * Packs used to last for ever, so nobody has an end date. Each gets six months
 * from her most recent approved payment - the rule as if it had always been
 * there - but never fewer than RENEW_REMINDER_DAYS from today: a shop must not
 * close the morning after a deploy with no warning at all.
 *
 * Packs an admin granted with no payment behind them count from today.
 * Idempotent: a seller who already has a date is left alone.
 */
export function backfillSubscriptionTerms(db: Pick<Db, 'sellers' | 'payments'>, now = new Date()): number {
  const floor = now.getTime() + RENEW_REMINDER_DAYS * 86_400_000
  let changed = 0
  for (const seller of db.sellers) {
    if (seller.subscriptionEndsAt || !seller.packsApproved) continue
    const lastApproval = db.payments
      .filter((p) => p.sellerId === seller.id && p.status === 'APPROVED' && p.verifiedAt)
      .map((p) => p.verifiedAt!)
      .sort()
      .pop()
    const ends = addMonths(lastApproval ?? now.toISOString(), SUBSCRIPTION_MONTHS)
    seller.subscriptionEndsAt = new Date(Math.max(new Date(ends).getTime(), floor)).toISOString()
    changed += 1
  }
  return changed
}
