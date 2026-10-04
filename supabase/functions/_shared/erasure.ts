import { serviceClient } from './supabase.ts'
import { rpc, stripeClient, type PaymentMode } from './stripe.ts'
import { deleteVeriffSession, veriffBaseUrl } from './veriff.ts'
import { eraseProfilePhotos } from './photo-erasure.ts'

// The token must already have been validated by Auth.getUser().
export function recentlyAuthenticated(token: string, userId: string, now = Date.now()): boolean {
  try {
    const claims = JSON.parse(
      atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')),
    ) as { sub?: string; amr?: { method: string; timestamp: number }[] }
    return (
      claims.sub === userId &&
      Boolean(
        claims.amr?.some(
          (a) =>
            ['otp', 'password', 'totp', 'oauth'].includes(a.method) &&
            a.timestamp * 1000 <= now + 30000 &&
            now - a.timestamp * 1000 <= 600000,
        ),
      )
    )
  } catch {
    return false
  }
}
export async function eraseAccount(userId: string): Promise<void> {
  const db = serviceClient()
  for (const mode of ['test', 'live'] as PaymentMode[]) {
    const customer = await rpc<string | null>(db, 'billing_customer', {
      p_user: userId,
      p_mode: mode,
    })
    if (!customer) continue
    const stripe = stripeClient(mode)
    for await (const session of stripe.checkout.sessions.list({
      customer,
      status: 'open',
      limit: 100,
    }))
      await stripe.checkout.sessions.expire(session.id)
    for await (const sub of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
      if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired')
        await stripe.subscriptions.cancel(
          sub.id,
          { prorate: false, invoice_now: false },
          { idempotencyKey: `nightlife:erase:${sub.id}` },
        )
    }
    const current = await stripe.customers.retrieve(customer)
    if (!current.deleted) await stripe.customers.del(customer)
  }
  const { data: verification, error } = await db
    .from('verification_sessions')
    .select('id,provider_session_id,provider')
    .eq('user_id', userId)
  if (error) throw new Error('erasure_failed')
  for (const session of verification ?? []) {
    if (session.provider !== 'veriff' || !session.provider_session_id) continue
    const apiKey = Deno.env.get('VERIFF_API_KEY'),
      secret = Deno.env.get('VERIF_SHARED_SECRET') ?? Deno.env.get('VERIFF_SHARED_SECRET')
    if (!apiKey || !secret) throw new Error('provider_not_configured')
    const status = await deleteVeriffSession({
      baseUrl: veriffBaseUrl(Deno.env.get('VERIFF_BASE_URL') ?? undefined),
      apiKey,
      secret,
      sessionId: session.provider_session_id,
    })
    if (status !== 404 && (status < 200 || status >= 300))
      await rpc(db, 'defer_provider_erasure', {
        p_provider: 'veriff',
        p_session: session.provider_session_id,
        p_status: status,
      })
  }
  await eraseProfilePhotos(db.storage.from('profile-photos'), userId)
  const expired = await db
    .from('subscriptions')
    .update({ status: 'expired', current_period_end: new Date().toISOString() })
    .eq('user_id', userId)
    .neq('status', 'withdrawn')
  if (expired.error) throw new Error('erasure_failed')
  await rpc(db, 'prepare_erasure', { p_user: userId })
  const deleted = await db.auth.admin.deleteUser(userId)
  if (deleted.error) throw new Error('erasure_failed')
}
