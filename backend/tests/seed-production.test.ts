import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

/**
 * The demo seed never reaches production.
 *
 * SEED_DEMO_DATA fills an EMPTY database with three invented sellers. On a
 * laptop that is the point; on the live host it is invented women in front
 * of real customers, and a variable copied from a .env into a Cloud Run
 * revision is exactly how it would happen. So the server refuses to boot.
 *
 * config.ts throws at import, so this runs it in a child process with the
 * other production requirements satisfied and only this one wrong.
 */

const backend = path.resolve(import.meta.dirname, '..')
const production = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'a-long-enough-secret-for-a-test',
  MSG91_AUTH_KEY: 'x',
  MSG91_WIDGET_ID: 'x',
}

function boot(env: Record<string, string>): { status: number | null; stderr: string } {
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', '-e', "import('./src/config.ts').then(() => process.exit(0))"],
    { cwd: backend, env: { ...process.env, ...env }, encoding: 'utf8' },
  )
  return { status: r.status, stderr: r.stderr }
}

test('production refuses to start with SEED_DEMO_DATA set', () => {
  const r = boot({ ...production, SEED_DEMO_DATA: 'true' })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /SEED_DEMO_DATA/)
})

test('and starts without it', () => {
  const r = boot({ ...production, SEED_DEMO_DATA: '' })
  assert.equal(r.status, 0, r.stderr)
})
