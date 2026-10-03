// Public provider endpoint: RSA-PSS replaces user authentication. Never persist raw payloads.
import { json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { minimizeAgeNotification, verifyAgeNotification } from '../_shared/yoti.ts'
import { boundedJson } from '../_shared/request-body.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  try {
    const payload = await boundedJson(req, 16_384)
    if (!(await verifyAgeNotification(payload)))
      return json(req, { error: 'invalid_signature' }, 401)
    const event = minimizeAgeNotification(payload)
    if (!event) return json(req, { error: 'bad_request' }, 400)
    const { data, error } = await serviceClient().rpc('complete_provider_verification', {
      p_provider: 'yoti',
      p_event: event.eventId,
      p_provider_session: event.providerSessionId,
      p_reference: event.referenceId,
      p_outcome: event.outcome,
      p_over_threshold: event.outcome === 'verified',
      p_identity_ok: false,
      p_occurred: event.occurredAt,
      p_method: event.method,
      p_threshold: event.threshold,
    })
    if (error) return json(req, { error: 'unavailable' }, 503)
    return json(req, { accepted: data === true })
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }
})
