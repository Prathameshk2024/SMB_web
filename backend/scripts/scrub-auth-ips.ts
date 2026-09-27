/**
 * HASH THE RAW IP ADDRESSES LEFT IN THE AUTH LOG
 * ===============================================
 * Every auth event stores a keyed hash of the caller's address, never the
 * address itself - except that, for a while, the seller account-close route
 * wrote `callerIp(req)` raw. That was fixed in c48dd96; the rows written
 * before it still hold real addresses, against a privacy policy that says
 * only scrambled ones are kept.
 *
 * This finds every event whose `ip` is not a hash and hashes it in place,
 * with the same key the live code uses, so the rows compare with new ones.
 * Reports and changes nothing unless `--commit` is passed. Run it once,
 * after deploying the fix, against the live database:
 *
 *   npm run scrub:auth-ips              # dry run
 *   npm run scrub:auth-ips -- --commit  # write
 */
import { flush, getDb, initStore } from '../src/db/store.js'
import { hashIp } from '../src/auth/crypto.js'
import { describeConfig } from '../src/config.js'

const commit = process.argv.includes('--commit')

/** What hashIp() produces: sixteen hex characters. Anything else is raw. */
const HASHED = /^[0-9a-f]{16}$/

async function main(): Promise<void> {
  await initStore()
  const db = getDb()

  console.log('')
  console.log(describeConfig())
  console.log('')

  const raw = db.authEvents.filter((e) => e.ip && !HASHED.test(e.ip))
  const byDetail = new Map<string, number>()
  for (const e of raw) byDetail.set(e.detail ?? e.type, (byDetail.get(e.detail ?? e.type) ?? 0) + 1)

  console.log(`  ${db.authEvents.length} auth events, ${raw.length} with a raw address`)
  for (const [detail, n] of byDetail) console.log(`    ${n.toString().padStart(4)}  ${detail}`)
  console.log('')

  if (raw.length === 0) {
    console.log('  Nothing to do.\n')
    return
  }
  if (!commit) {
    console.log('  Dry run. Re-run with --commit to hash them.\n')
    return
  }

  for (const e of raw) e.ip = hashIp(e.ip!)
  const saved = await flush()
  console.log(saved ? `  ✓ Hashed ${raw.length} address(es).\n` : '  ✗ The write was not accepted - nothing changed on the server.\n')
  if (!saved) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error('[scrub-auth-ips] failed:', err)
  process.exitCode = 1
})
