/**
 * WHEN A FAILED READ IS WORTH ONE MORE TRY
 * ========================================
 * Cloud Run stops the API after a while with nobody using it, and the next
 * request waits while a new instance boots - which here means loading the
 * whole database from Firestore before anything is answered. That first
 * request often does not survive the wait: the connection drops, or Cloud
 * Run's own front end gives up on it with a 429 or 503 before our code has
 * started. The screen she opened stayed empty, and the only way to fill it
 * was to go to another tab and come back - by which time the server was up.
 *
 * So `request()` asks once more, after a pause, and only when:
 *
 *  - it is a READ. A dropped connection cannot tell "never arrived" from
 *    "arrived, and the answer was lost", and sending an order or an OTP
 *    twice is worse than an empty screen;
 *  - the failure was not our API answering. Every error the API raises
 *    carries `{ error, messageMr }`; asking it the same question again gets
 *    the same answer, and our own 429 is a real limit, not a cold start.
 *
 * Once, not a loop: if the second try fails too, something is wrong beyond
 * a boot, and the screen's own error state says so.
 */

/** Long enough for a booting instance to finish; short enough to still feel like loading. */
export const COLD_START_RETRY_MS = 3000

/** What Cloud Run's front end, or a proxy in front of it, answers while no instance is ready. */
const BOOTING_STATUS = new Set([429, 500, 502, 503, 504])

const READS = new Set(['GET', 'HEAD'])

/** The body is one of ours: JSON carrying an `error` string. */
export function answeredByApi(text: string): boolean {
  if (!text) return false
  try {
    const body = JSON.parse(text) as unknown
    return typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
  } catch {
    return false
  }
}

export type Failure =
  | { kind: 'network' }
  | { kind: 'status'; status: number; text: string }

export function worthOneRetry(method: string | undefined, failure: Failure): boolean {
  if (!READS.has((method ?? 'GET').toUpperCase())) return false
  if (failure.kind === 'network') return true
  return BOOTING_STATUS.has(failure.status) && !answeredByApi(failure.text)
}
