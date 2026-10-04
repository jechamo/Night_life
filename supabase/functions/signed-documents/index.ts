// Signed documents (PRD 6.1): PDF generated from the immutable evidence in
// `consent_records` and the exact versions signed; sent by email to the CONFIRMED
// address only. Auth: user JWT (verify_jwt) + RLS reads as the caller.
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import { sendMail } from '../_shared/smtp.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'
import { rpc } from '../_shared/stripe.ts'
import { boundedJson } from '../_shared/request-body.ts'

import { DOCUMENT_COPY as COPY, renderSignedPdf as renderPdf } from '../_shared/signed-pdf.ts'
type Language = 'es' | 'en'
Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)

  let action = 'pdf'
  let language: Language = 'es'
  try {
    const body = (await boundedJson(req, 2048)) as { action?: unknown; language?: unknown }
    action = body.action === 'email' || body.action === 'outbox' ? body.action : 'pdf'
    language = body.language === 'en' ? 'en' : 'es'
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }

  if (action === 'pdf') {
    const pdf = await renderPdf(auth, language)
    return new Response(new Uint8Array(pdf).buffer, {
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    })
  }

  // email (on request) · outbox (automatic: only if an email is pending)
  const { user } = auth
  if (!user.email || !user.email_confirmed_at) return json(req, { result: 'no_email' })
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!gmailUser || !gmailPassword) return json(req, { result: 'not_configured' })

  const service = serviceClient()
  let lease: { id: string; lease_token: string }[] = []
  if (action === 'outbox') {
    lease = await rpc(service, 'claim_signed_email', { p_user: user.id })
    if (!lease.length) return json(req, { result: 'nothing_pending' })
  }
  if (!(await rpc<boolean>(service, 'reserve_document_email', { p_user: user.id }))) {
    for (const item of lease)
      await rpc(service, 'finish_signed_email', {
        p_id: item.id,
        p_lease: item.lease_token,
        p_status: 'retry',
      })
    return json(req, { result: 'rate_limited' }, 429)
  }
  try {
    const pdf = await renderPdf(auth, language)
    await sendMail(
      {
        host: 'smtp.gmail.com',
        port: 465,
        user: gmailUser,
        password: gmailPassword,
        fromName: 'Nightlife Connect',
      },
      {
        to: user.email,
        subject: COPY[language].subject,
        text: COPY[language].body,
        attachment: {
          filename: 'nightlife-connect-documentos.pdf',
          contentType: 'application/pdf',
          bytes: pdf,
        },
      },
    )
    await service
      .from('email_outbox')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('template', 'signed_documents')
      .eq('status', 'pending')
    for (const item of lease)
      await rpc(service, 'finish_signed_email', {
        p_id: item.id,
        p_lease: item.lease_token,
        p_status: 'sent',
      })
    return json(req, { result: 'sent' })
  } catch {
    for (const item of lease)
      await rpc(service, 'finish_signed_email', {
        p_id: item.id,
        p_lease: item.lease_token,
        p_status: 'retry',
      })
    // Log the type only: never addresses, tokens or document content (PRD 3.2).
    console.error('signed-documents email failed')
    const { data: pending } = await service
      .from('email_outbox')
      .select('id, attempts')
      .eq('user_id', user.id)
      .eq('status', 'pending')
    for (const row of pending ?? []) {
      await service
        .from('email_outbox')
        .update({
          attempts: Math.min(row.attempts + 1, 10),
          last_error: 'smtp',
          status: row.attempts + 1 >= 10 ? 'failed' : 'pending',
        })
        .eq('id', row.id)
    }
    return json(req, { result: 'failed' })
  }
})
