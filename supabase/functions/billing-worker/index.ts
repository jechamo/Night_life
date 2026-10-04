import { json } from '../_shared/http.ts'
import { serviceClient } from '../_shared/supabase.ts'
import { rpc, APP_URL } from '../_shared/stripe.ts'
import { eraseAccount } from '../_shared/erasure.ts'
import { sendMail } from '../_shared/smtp.ts'
import { deleteVeriffSession, veriffBaseUrl } from '../_shared/veriff.ts'
import { DOCUMENT_COPY, renderSignedPdf } from '../_shared/signed-pdf.ts'

const COPY: Record<string, [string, string]> = {
  purchase: [
    'Pago confirmado. Consulta tus ventajas y el recibo en Mi suscripción.',
    'Payment confirmed. View your benefits and receipt in My subscription.',
  ],
  cancellation: [
    'Tu suscripción no se renovará. Conservas las ventajas hasta el final del periodo pagado.',
    'Your subscription will not renew. Benefits remain until the paid period ends.',
  ],
  withdrawal: [
    'Tu desistimiento y reembolso están confirmados. Las ventajas se han retirado.',
    'Your withdrawal and refund are confirmed. The benefits have been removed.',
  ],
  payment_failed: [
    'El pago ha fallado. Revisa tu método de pago en el Portal de Stripe.',
    'Payment failed. Review your payment method in the Stripe Portal.',
  ],
  trial_ending: [
    'Tu prueba gratuita termina próximamente. Revisa la fecha y el precio antes de la renovación.',
    'Your free trial ends soon. Review the date and price before renewal.',
  ],
  annual_renewal: [
    'Tu suscripción anual se renueva en los próximos siete días. Puedes cancelarla en Mi suscripción.',
    'Your annual subscription renews within seven days. You can cancel in My subscription.',
  ],
  price_change: [
    'Se ha comunicado un cambio de precio. Consulta el importe antes de la próxima renovación o cancela en Mi suscripción.',
    'A price change has been communicated. Review the amount before the next renewal or cancel in My subscription.',
  ],
  inactive_account: [
    'Tu cuenta lleva casi 24 meses inactiva. Inicia sesión durante los próximos 30 días para evitar su borrado.',
    'Your account has been inactive for almost 24 months. Sign in within the next 30 days to prevent its deletion.',
  ],
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)
  const key = req.headers.get('x-worker-key')
  if (!key || !/^[0-9a-f]{64}$/.test(key)) return json(req, { error: 'unauthorized' }, 401)
  const db = serviceClient()
  let work: {
    notices: {
      id: string
      user_id: string
      template: string
      language: string
      isTest: boolean
      lease_token: string
    }[]
    purge: string[]
    documents: {
      id: string
      user_id: string
      lease_token: string
      language: string
      isTest: boolean
    }[]
    cleanup: { id: string; provider: string; provider_session_id: string }[]
  }
  try {
    work = await rpc(db, 'claim_billing_work', { p_key: key })
  } catch {
    return json(req, { error: 'unauthorized' }, 401)
  }
  let sent = 0,
    simulated = 0,
    failed = 0,
    purged = 0
  for (const item of work.documents) {
    let status = 'retry'
    try {
      const { data, error } = await db.auth.admin.getUserById(item.user_id)
      if (error || !data.user) throw new Error('user_unavailable')
      if (item.isTest) {
        status = 'simulated'
        simulated++
      } else {
        const user = data.user,
          username = Deno.env.get('GMAIL_USER'),
          password = Deno.env.get('GMAIL_APP_PASSWORD'),
          language = item.language === 'en' ? 'en' : 'es'
        if (!user.email || !user.email_confirmed_at || !username || !password)
          throw new Error('email_unavailable')
        if (!(await rpc<boolean>(db, 'reserve_document_email', { p_user: user.id })))
          throw new Error('delivery_limit')
        const bytes = await renderSignedPdf({ db, user }, language)
        await sendMail(
          {
            host: 'smtp.gmail.com',
            port: 465,
            user: username,
            password,
            fromName: 'Nightlife Connect',
          },
          {
            to: user.email,
            subject: DOCUMENT_COPY[language].subject,
            text: DOCUMENT_COPY[language].body,
            attachment: {
              filename: 'nightlife-connect-documentos.pdf',
              contentType: 'application/pdf',
              bytes,
            },
          },
        )
        status = 'sent'
        sent++
      }
    } catch {
      failed++
    }
    await rpc(db, 'finish_signed_email', {
      p_id: item.id,
      p_lease: item.lease_token,
      p_status: status,
    })
  }
  for (const notice of work.notices) {
    let status = 'retry'
    try {
      const { data, error } = await db.auth.admin.getUserById(notice.user_id)
      if (error || !data.user) throw new Error('user_unavailable')
      if (notice.isTest) {
        status = 'simulated'
        simulated++
      } else {
        const user = data.user,
          username = Deno.env.get('GMAIL_USER'),
          password = Deno.env.get('GMAIL_APP_PASSWORD')
        if (!user.email || !user.email_confirmed_at || !username || !password)
          throw new Error('email_unavailable')
        const text = COPY[notice.template]?.[notice.language === 'en' ? 1 : 0]
        if (!text) throw new Error('unknown_template')
        await sendMail(
          {
            host: 'smtp.gmail.com',
            port: 465,
            user: username,
            password,
            fromName: 'Nightlife Connect',
          },
          {
            to: user.email,
            subject:
              notice.language === 'en'
                ? 'Nightlife Connect — account notice'
                : 'Nightlife Connect — aviso de tu cuenta',
            text: `${text}\n\n${APP_URL}/premium/subscription\n\n${notice.id}`,
          },
        )
        status = 'sent'
        sent++
      }
    } catch {
      failed++
    }
    await rpc(db, 'finish_billing_notice', {
      p_id: notice.id,
      p_lease: notice.lease_token,
      p_status: status,
    })
  }
  for (const id of work.purge) {
    // Recheck after claiming: signing in during the batch cancels automatic erasure.
    const { data: profile, error } = await db
      .from('profiles')
      .select('last_active_at,inactivity_warned_at')
      .eq('id', id)
      .maybeSingle()
    if (
      error ||
      !profile ||
      !profile.inactivity_warned_at ||
      Date.now() - Date.parse(profile.inactivity_warned_at) < 30 * 86400000 ||
      Date.parse(profile.last_active_at) > Date.now() - 730 * 86400000
    )
      continue
    try {
      await eraseAccount(id)
      purged++
    } catch {
      failed++
    }
  }
  for (const item of work.cleanup) {
    let status = 503
    try {
      const apiKey = Deno.env.get('VERIFF_API_KEY'),
        secret = Deno.env.get('VERIF_SHARED_SECRET') ?? Deno.env.get('VERIFF_SHARED_SECRET')
      if (item.provider === 'veriff' && apiKey && secret)
        status = await deleteVeriffSession({
          baseUrl: veriffBaseUrl(Deno.env.get('VERIFF_BASE_URL') ?? undefined),
          apiKey,
          secret,
          sessionId: item.provider_session_id,
        })
    } catch {
      /* Persist a bounded retry without logging personal data. */
    }
    await rpc(db, 'provider_erasure_result', { p_id: item.id, p_status: status })
  }
  return json(req, { sent, simulated, failed, purged })
})
