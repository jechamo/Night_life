// Authenticated session creation. Provider credentials and results never enter the browser.
import { json, preflight } from '../_shared/http.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'
import { ageSessionRequest, type AgeMethod } from '../_shared/yoti.ts'
import { parseVeriffSession, veriffBaseUrl, veriffSessionRequest } from '../_shared/veriff.ts'
import { boundedJson } from '../_shared/request-body.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  try {
    const body = await boundedJson(req, 4096)
    if (
      !isRecord(body) ||
      body.action !== 'start' ||
      !['age', 'photo', 'identity'].includes(String(body.level))
    )
      return json(req, { error: 'bad_request' }, 400)
    const level = String(body.level)
    const method = body.method ?? 'facial_estimation'
    if (!['facial_estimation', 'document', 'digital_id'].includes(String(method)))
      return json(req, { error: 'bad_request' }, 400)
    const { data: session, error } = await auth.db.rpc('begin_verification', {
      p_level: level,
      p_method: method,
      p_consent: body.consent === true,
    })
    if (error || !isRecord(session) || typeof session.id !== 'string')
      return json(req, { error: 'unavailable' }, error?.code === '54000' ? 429 : 403)
    const provider = String(session.provider ?? '')
    if (provider === 'simulator')
      return json(req, { type: 'internal', path: `/verification/sandbox?level=${level}` })
    const appOrigin = new URL(
      Deno.env.get('APP_ORIGIN') ?? 'https://nightlife-connect-beige.vercel.app',
    )
    if (appOrigin.protocol !== 'https:') return json(req, { error: 'unavailable' }, 503)
    const callbackUrl = new URL(`/profile/verification?level=${level}`, appOrigin.origin).href
    if (provider === 'veriff') {
      const apiKey = Deno.env.get('VERIFF_API_KEY') ?? ''
      if (!apiKey) return json(req, { error: 'unavailable' }, 503)
      const created = await fetch(
        `${veriffBaseUrl(Deno.env.get('VERIFF_BASE_URL') ?? undefined)}/v1/sessions`,
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
          headers: { 'X-AUTH-CLIENT': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(veriffSessionRequest({ referenceId: session.id, callbackUrl })),
        },
      )
      if (!created.ok) return json(req, { error: 'unavailable' }, 503)
      const parsed = parseVeriffSession(await created.json())
      if (!parsed) return json(req, { error: 'unavailable' }, 503)
      const { error: attachError } = await serviceClient().rpc('attach_verification_provider', {
        p_session: session.id,
        p_provider: parsed.id,
      })
      if (attachError) return json(req, { error: 'unavailable' }, 503)
      return json(req, { type: 'external', url: parsed.url })
    }
    if (provider !== 'yoti' || level !== 'age' || session.mode !== 'live')
      return json(req, { error: 'unavailable' }, 503)
    const sdkId = Deno.env.get('YOTI_AGE_SDK_ID') ?? ''
    const apiToken = Deno.env.get('YOTI_AGE_API_TOKEN') ?? ''
    if (!UUID.test(sdkId) || !apiToken) return json(req, { error: 'unavailable' }, 503)
    const backendUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const webhookUrl = new URL('/functions/v1/yoti-webhook', backendUrl).href
    const yoti = await fetch('https://age.yoti.com/api/v1/sessions', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Yoti-SDK-Id': sdkId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        ageSessionRequest({
          referenceId: session.id,
          method: session.method as AgeMethod,
          threshold: Number(session.threshold),
          callbackUrl,
          webhookUrl,
        }),
      ),
    })
    if (!yoti.ok) return json(req, { error: 'unavailable' }, 503)
    const response: unknown = await yoti.json()
    if (!isRecord(response) || typeof response.id !== 'string' || !UUID.test(response.id))
      return json(req, { error: 'unavailable' }, 503)
    const { error: attachError } = await serviceClient().rpc('attach_verification_provider', {
      p_session: session.id,
      p_provider: response.id,
    })
    if (attachError) return json(req, { error: 'unavailable' }, 503)
    const url = new URL('https://age.yoti.com')
    url.searchParams.set('sessionId', response.id)
    url.searchParams.set('sdkId', sdkId)
    return json(req, { type: 'external', url: url.href })
  } catch {
    // No raw body, provider errors, account data, secrets or biometric details in logs.
    return json(req, { error: 'unavailable' }, 503)
  }
})
