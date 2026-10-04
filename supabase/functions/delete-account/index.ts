import { json, preflight } from '../_shared/http.ts'
import { requireUser } from '../_shared/supabase.ts'
import { eraseAccount, recentlyAuthenticated } from '../_shared/erasure.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
  if (!recentlyAuthenticated(token, auth.user.id))
    return json(req, { error: 'reauth_required' }, 403)
  try {
    await eraseAccount(auth.user.id)
    return json(req, { deleted: true })
  } catch {
    console.error('delete-account failed')
    return json(req, { error: 'failed' }, 503)
  }
})
