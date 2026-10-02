// Signed documents (PRD 6.1): PDF generated from the immutable evidence in
// `consent_records` and the exact versions signed; sent by email to the CONFIRMED
// address only. Auth: user JWT (verify_jwt) + RLS reads as the caller.
import { corsHeaders, json, preflight } from '../_shared/http.ts'
import { buildPdf, type PdfLine } from '../_shared/pdf.ts'
import { sendMail } from '../_shared/smtp.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'

type Language = 'es' | 'en'

const COPY = {
  es: {
    title: 'Nightlife Connect — Documentos firmados',
    holder: 'Titular de la cuenta',
    account: 'Cuenta',
    generated: 'Generado el',
    signed: 'Firmado el',
    version: 'versión',
    note: 'Evidencia inmutable conservada en nuestros sistemas (consent_records).',
    subject: 'Tus documentos firmados — Nightlife Connect',
    body: 'Hola:\n\nAdjuntamos el PDF con los documentos que aceptaste en Nightlife Connect.\n\nSi no has pedido este email, ignóralo.',
  },
  en: {
    title: 'Nightlife Connect — Signed documents',
    holder: 'Account holder',
    account: 'Account',
    generated: 'Generated on',
    signed: 'Signed on',
    version: 'version',
    note: 'Immutable evidence kept in our systems (consent_records).',
    subject: 'Your signed documents — Nightlife Connect',
    body: 'Hi,\n\nAttached is the PDF with the documents you accepted on Nightlife Connect.\n\nIf you did not ask for this email, ignore it.',
  },
} as const

type Auth = NonNullable<Awaited<ReturnType<typeof requireUser>>>

async function renderPdf({ db, user }: Auth, language: Language): Promise<Uint8Array> {
  const copy = COPY[language]
  const { data: records } = await db
    .from('consent_records')
    .select('document_slug, document_version, created_at')
    .eq('user_id', user.id)
    .eq('kind', 'legal')
    .order('created_at', { ascending: false })
  const latest = new Map<string, { version: string; at: string }>()
  for (const r of records ?? []) {
    if (r.document_slug && r.document_version && !latest.has(r.document_slug)) {
      latest.set(r.document_slug, { version: r.document_version, at: r.created_at })
    }
  }
  const { data: profile } = await db.from('profiles').select('name').eq('id', user.id).maybeSingle()
  const lines: PdfLine[] = [
    { text: copy.title, size: 16, bold: true },
    { text: `${copy.holder}: ${profile?.name ?? '—'}`, gapBefore: 8 },
    { text: `${copy.account}: ${user.id}` },
    { text: `${copy.generated}: ${new Date().toISOString()}` },
    { text: copy.note, size: 9 },
  ]
  for (const [slug, signed] of latest) {
    const { data: doc } = await db
      .from('legal_documents')
      .select('title, summary, sections')
      .eq('slug', slug)
      .eq('version', signed.version)
      .eq('language', language)
      .maybeSingle()
    lines.push({ text: doc?.title ?? slug, size: 13, bold: true, gapBefore: 14 })
    lines.push({ text: `${copy.version} ${signed.version} · ${copy.signed} ${signed.at}`, size: 9 })
    if (doc) {
      lines.push({ text: doc.summary, gapBefore: 4 })
      for (const section of (doc.sections ?? []) as { heading: string; body: string }[]) {
        lines.push({ text: section.heading, bold: true, gapBefore: 6 })
        lines.push({ text: section.body })
      }
    }
  }
  return buildPdf(lines)
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  let action = 'pdf'
  let language: Language = 'es'
  try {
    const body = (await req.json()) as { action?: unknown; language?: unknown }
    action = body.action === 'email' ? 'email' : 'pdf'
    language = body.language === 'en' ? 'en' : 'es'
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }

  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)

  if (action === 'pdf') {
    const pdf = await renderPdf(auth, language)
    return new Response(pdf, {
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    })
  }

  // email
  const { user } = auth
  if (!user.email || !user.email_confirmed_at) return json(req, { result: 'no_email' })
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!gmailUser || !gmailPassword) return json(req, { result: 'not_configured' })

  const service = serviceClient()
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
    return json(req, { result: 'sent' })
  } catch (error) {
    // Log the type only: never addresses, tokens or document content (PRD 3.2).
    console.error(
      'signed-documents email failed',
      error instanceof Error ? error.message : 'unknown',
    )
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
