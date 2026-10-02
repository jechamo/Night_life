// Account deletion (PRD 6.12 G, 6.15 A07). Requires a FRESH sign-in (the client just
// re-verified an SMS OTP): we accept only sessions whose last sign-in is < 10 minutes.
// Deletes photos and the Auth user; rows cascade, consent evidence keeps a null owner.
import { json, preflight } from '../_shared/http.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'

const MAX_REAUTH_AGE_MS = 10 * 60 * 1000

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  const { user } = auth
  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0
  if (Date.now() - lastSignIn > MAX_REAUTH_AGE_MS)
    return json(req, { error: 'reauth_required' }, 403)

  const service = serviceClient()
  // Active subscriptions are cancelled before erasure (PRD 6.12 G). Stripe/stores: Block 9.
  await service
    .from('subscriptions')
    .update({ status: 'expired', cancel_at_period_end: true })
    .eq('user_id', user.id)
    .in('status', ['active', 'cancel_at_period_end', 'past_due'])

  const { data: files } = await service.storage.from('profile-photos').list(user.id, { limit: 100 })
  if (files?.length) {
    await service.storage.from('profile-photos').remove(files.map((f) => `${user.id}/${f.name}`))
  }
  await service
    .from('gdpr_audit_log')
    .insert({ actor_id: user.id, subject_id: user.id, action: 'account.delete' })

  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('delete-account failed', error.message)
    return json(req, { error: 'failed' }, 500)
  }
  return json(req, { deleted: true })
})
