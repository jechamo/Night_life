// Public provider endpoint: HMAC-SHA256 of the raw body replaces user authentication.
import { json } from '../_shared/http.ts'
import { boundedText } from '../_shared/request-body.ts'
import { serviceClient } from '../_shared/supabase.ts'
import {
  deleteVeriffSession,
  minimizeVeriffDecision,
  veriffBaseUrl,
  verifyVeriffSignature,
} from '../_shared/veriff.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  try {
    const raw = await boundedText(req, 16_384)
    const apiKey = Deno.env.get('VERIFF_API_KEY') ?? ''
    const secret = Deno.env.get('VERIFF_SHARED_SECRET') ?? ''
    const client = req.headers.get('x-auth-client')
    if (!apiKey || client !== apiKey) return json(req, { error: 'invalid_signature' }, 401)
    if (!(await verifyVeriffSignature(raw, req.headers.get('x-hmac-signature'), secret)))
      return json(req, { error: 'invalid_signature' }, 401)
    const event = minimizeVeriffDecision(JSON.parse(raw))
    if (!event) return json(req, { accepted: false })
    const { data, error } = await serviceClient().rpc('complete_provider_verification', {
      p_provider: 'veriff',
      p_event: event.eventId,
      p_provider_session: event.providerSessionId,
      p_reference: event.referenceId,
      p_outcome: event.outcome,
      p_over_threshold: event.overThreshold,
      p_identity_ok: event.identityOk,
      p_occurred: event.occurredAt,
      p_method: 'document',
      p_threshold: 18,
    })
    if (error) return json(req, { error: 'unavailable' }, 503)
    if (data === true) {
      void deleteVeriffSession({
        baseUrl: veriffBaseUrl(Deno.env.get('VERIFF_BASE_URL') ?? undefined),
        apiKey,
        secret,
        sessionId: event.providerSessionId,
      })
    }
    return json(req, { accepted: data === true })
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }
})
