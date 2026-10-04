import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const c = JSON.parse(readFileSync('.tmp/block9-live-credentials.json', 'utf8'))
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]
    }),
)
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
assert.equal(
  (await db.auth.signInWithPassword({ email: c.emails[0], password: c.password })).error,
  null,
)
const checks = []
const rpc = async (name, args = {}) => {
  const r = await db.rpc(name, args)
  assert.equal(r.error, null, name)
  return r.data
}
const check = (name, result) => {
  assert.ok(result, name)
  checks.push(name)
}
const manage = async (action) => {
  const r = await db.functions.invoke('billing-account', { body: { action } })
  if (r.error) {
    console.log({ status: r.error.context?.status, body: await r.error.context?.json?.() })
    throw new Error(action + ' failed')
  }
  return r.data
}
const initial = await rpc('premium_state')
check(
  'VIP active from signed webhook',
  initial.subscription.status === 'active' && initial.subscription.simulated === false,
)
check(
  'VIP credits once',
  JSON.stringify(initial.credits) === '{"spark":3,"paid_dm":2,"spotlight":1}' ||
    (initial.credits.spark === 3 &&
      initial.credits.spotlight === 1 &&
      initial.credits.paid_dm === 2),
)
check('server entitlement granted', await rpc('has_entitlement', { _key: 'see_likes' }))
const portal = await manage('portal')
check('hosted Stripe portal', new URL(portal.url).hostname === 'billing.stripe.com')
writeFileSync('.tmp/block9-portal.json', JSON.stringify(portal))
const cancelled = await manage('cancel')
check('cancel at period end', cancelled.subscription.status === 'cancel_at_period_end')
check('cancel keeps paid benefits', await rpc('has_entitlement', { _key: 'see_likes' }))
const resumed = await manage('resume')
check('resume active', resumed.subscription.status === 'active')
const withdrawn = await manage('withdraw')
check('withdrawal recorded', withdrawn.subscription.status === 'withdrawn')
check('withdrawal revokes benefits', !(await rpc('has_entitlement', { _key: 'see_likes' })))
check(
  'withdrawal reverses credits',
  Object.values(withdrawn.credits).every((v) => v === 0),
)
check(
  'receipt refunded',
  withdrawn.invoices.some((i) => i.status === 'refunded'),
)
writeFileSync(
  '.tmp/block9-billing-evidence.json',
  JSON.stringify(
    {
      ok: true,
      checks,
      subscriptionId: initial.subscription.id,
      invoiceIds: initial.invoices.map((i) => i.id),
    },
    null,
    2,
  ),
)
console.log({ ok: true, checks })
