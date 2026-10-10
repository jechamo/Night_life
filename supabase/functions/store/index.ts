// Store purchases for the native app (Bloque 11b). `config` hands the public SDK key and
// the product map to an allowed tester; `sync` re-reads the caller's purchases from the
// RevenueCat API and applies them. The client never grants anything by itself.
import { json, preflight } from '../_shared/http.ts'
import { boundedJson } from '../_shared/request-body.ts'
import { revenueCatClient } from '../_shared/revenuecat.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  let action = ''
  try {
    const body = (await boundedJson(req, 1024)) as { action?: unknown }
    action = typeof body.action === 'string' ? body.action : ''
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }

  if (action === 'config') {
    const { data, error } = await auth.db.rpc('store_access')
    if (error) return json(req, { error: 'store_disabled' }, 403)
    const apiKey = Deno.env.get('REVENUECAT_SDK_TEST') ?? ''
    if (!apiKey) return json(req, { error: 'unavailable' }, 503)
    const access = data as { mode: string; products: Record<string, string> }
    // The store's app user id is always the caller's own account id.
    return json(req, { apiKey, userId: auth.user.id, mode: access.mode, products: access.products })
  }

  if (action === 'sync') {
    const { error } = await auth.db.rpc('store_sync_access')
    if (error)
      return json(
        req,
        { error: error.code === '54000' ? 'rate_limited' : 'store_disabled' },
        error.code === '54000' ? 429 : 403,
      )
    try {
      const snapshot = await revenueCatClient().customerSnapshot(
        auth.user.id,
        `sync:${crypto.randomUUID()}`,
        'sync',
      )
      const { data, error: applyError } = await serviceClient().rpc('store_apply', {
        p_user: auth.user.id,
        p: snapshot,
      })
      if (applyError) throw new Error('apply_failed')
      return json(req, data)
    } catch {
      // Status only: never log provider bodies, keys or purchase details.
      console.error('store sync failed')
      return json(req, { error: 'unavailable' }, 503)
    }
  }

  return json(req, { error: 'bad_request' }, 400)
})
