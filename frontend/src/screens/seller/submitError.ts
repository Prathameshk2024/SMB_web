import { ApiError } from '../../lib/api.js'

/**
 * What to say when the server refuses a listing the screen let through.
 *
 * The two refusals that name the ₹50 - slots full (402) and the six months
 * ended (403) - are drawn from the dictionary, not the server's `messageMr`:
 * the server's sentence is Marathi in an English app, and it names the price
 * inside the APK, where the `.apk` twins exist to keep it out. Anything else
 * is the server's own words, as before.
 */
export function submitErrorText(err: ApiError, t: (key: string) => string): string {
  if (err.status === 402) return t('prod.slotsFullErr')
  if (err.status === 403 && err.message === 'Subscription expired') return t('prod.expiredErr')
  return err.messageMr ?? err.message
}
