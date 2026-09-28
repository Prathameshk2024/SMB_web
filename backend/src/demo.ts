import type { Seller } from '@shared/types.js'
import { samePhone } from '@shared/seller.js'

/**
 * THE DEMO ACCOUNT, KEPT AWAY FROM REAL PEOPLE.
 *
 * Google Play's reviewers sign in with a demo number, set up in MSG91's OTP
 * widget as "Demo Credentials" so no SMS is sent and a fixed code verifies
 * it. Each number is a seller (a shop named for the review) and a buyer,
 * and the reviewer is asked to order from that shop alone.
 *
 * Asking is not enough. Reviewers do not read instructions, and a reviewer
 * who orders a jar of pickle from a real woman in Anadur has made her cook
 * for nobody; a real buyer who finds the demo shop has been shown a stall
 * that will never deliver. So the demo shop is hidden from everyone but the
 * demo buyer, and orders between the demo account and a real account are
 * refused at the one route that makes them.
 *
 * There are two numbers, because the first one some checks refuse as not a
 * real phone. They are one demo world, not two: either number's buyer may
 * order from either number's shop, and neither may touch a real one.
 *
 * ONE list, in one place. `SEND_LIMIT_EXEMPT` in auth/rateLimit.ts is built
 * from it too, so every number here must be a Demo Credential in MSG91 -
 * anything else is a real phone that anybody could then send unlimited SMS
 * to, on our bill. If they change in MSG91, they change here.
 */
export const DEMO_PHONES: readonly string[] = ['9999999999', '9579642050']

function isDemoPhone(phone: string | undefined): boolean {
  return !!phone && DEMO_PHONES.some((demo) => samePhone(phone, demo))
}

export function isDemoSeller(seller: Pick<Seller, 'phone'> | undefined): boolean {
  return !!seller && isDemoPhone(seller.phone)
}

/** The signed-in caller, if any - `req.auth` as the middleware attaches it. */
export interface Viewer {
  role?: string
  phone?: string
}

export function isDemoViewer(auth: Viewer | undefined): boolean {
  return isDemoPhone(auth?.phone)
}

/**
 * Whether this shop is hidden from this viewer. Only the demo shop is ever
 * hidden, and only from people who are not the demo account - so a real
 * buyer, and anyone not signed in, never sees it in a list, at its id, or
 * in a pincode's counts. Composed with `publiclyVisible`, never instead of it.
 */
export function demoHidden(seller: Pick<Seller, 'phone'> | undefined, auth: Viewer | undefined): boolean {
  return isDemoSeller(seller) && !isDemoViewer(auth)
}

/**
 * Why this buyer may not order from this seller, or null. The demo buyer
 * stays inside the demo shop; a real buyer stays out of it. Both directions
 * matter: hiding the shop stops the second in the app, and this stops it
 * for anyone who kept a product id.
 */
export function demoOrderProblem(
  seller: Pick<Seller, 'phone'>,
  auth: Viewer | undefined,
): { error: string; messageMr: string } | null {
  const demoBuyer = isDemoViewer(auth)
  const demoShop = isDemoSeller(seller)
  if (demoBuyer && !demoShop) {
    return {
      error: 'The demo account may only order from the demo shop',
      messageMr: 'डेमो खात्यातून फक्त डेमो दुकानातूनच ऑर्डर देता येते.',
    }
  }
  if (demoShop && !demoBuyer) {
    return {
      error: 'The demo shop takes no real orders',
      messageMr: 'हे डेमो दुकान आहे. इथून ऑर्डर देता येत नाही.',
    }
  }
  return null
}
