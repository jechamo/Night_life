// Public provider endpoint: HMAC-SHA256 of the raw body replaces user authentication.
import { json } from '../_shared/http.ts'
import { boundedText } from '../_shared/request-body.ts'
import { serviceClient } from '../_shared/supabase.ts'
import {
  deleteVeriffSession,
  minimizeVeriffDecision,
  shouldDeleteVeriffSession,
  veriffBaseUrl,
  verifyVeriffSignature,
} from '../_shared/veriff.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  try {
    const raw = await boundedText(req, 16_384)
    const apiKey = Deno.env.get('VERIFF_API_KEY') ?? ''
    // Dashboard secret name is VERIF_SHARED_SECRET (one F); accept VERIFF_ as alias.
    const secret = Deno.env.get('VERIF_SHARED_SECRET') ?? Deno.env.get('VERIFF_SHARED_SECRET') ?? ''
    const client = req.headers.get('x-auth-client')
    if (!apiKey || client !== apiKey) return json(req, { error: 'invalid_signature' }, 401)
    if (!(await verifyVeriffSignature(raw, req.headers.get('x-hmac-signature'), secret)))
      return json(req, { error: 'invalid_signature' }, 401)
    const event = await minimizeVeriffDecision(JSON.parse(raw))
    if (!event) return json(req, { accepted: false })
    const db = serviceClient()
    const { data, error } = await db.rpc('complete_provider_verification', {
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
    // Identity can be final without a birth date, while age must stay in review.
    // Use the persisted decision, including human overrides, before deleting provider evidence.
    const finalCandidate = event.outcome === 'verified' || event.outcome === 'expired'
    const finalSession =
      data === true && finalCandidate
        ? await db
            .from('verification_sessions')
            .select('state')
            .eq('id', event.referenceId)
            .eq('provider', 'veriff')
            .eq('provider_session_id', event.providerSessionId)
            .maybeSingle()
        : null
    if (
      finalSession?.data &&
      !finalSession.error &&
      shouldDeleteVeriffSession(event, finalSession.data.state)
    ) {
      // The runtime may stop right after the response; keep the provider deletion alive.
      const deletion = (async () => {
        const status = await deleteVeriffSession({
          baseUrl: veriffBaseUrl(Deno.env.get('VERIFF_BASE_URL') ?? undefined),
          apiKey,
          secret,
          sessionId: event.providerSessionId,
        })
        await db.rpc('record_verification_cleanup', {
          p_session: event.referenceId,
          p_http_status: status,
        })
      })()
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(deletion)
      else await deletion
    }
    return json(req, { accepted: data === true })
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }
})
