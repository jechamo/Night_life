import { buildPdf, type PdfLine } from './pdf.ts'
import type { requireUser } from './supabase.ts'
type Language = 'es' | 'en'

export const DOCUMENT_COPY = {
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

export async function renderSignedPdf({ db, user }: Auth, language: Language): Promise<Uint8Array> {
  const copy = DOCUMENT_COPY[language]
  const { data: records, error: recordsError } = await db
    .from('consent_records')
    .select('document_slug, document_version, created_at')
    .eq('user_id', user.id)
    .eq('kind', 'legal')
    .order('created_at', { ascending: false })
  if (recordsError) throw new Error('documents_unavailable')
  const latest = new Map<string, { version: string; at: string }>()
  for (const r of records ?? []) {
    if (r.document_slug && r.document_version && !latest.has(r.document_slug)) {
      latest.set(r.document_slug, { version: r.document_version, at: r.created_at })
    }
  }
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile) throw new Error('documents_unavailable')
  const lines: PdfLine[] = [
    { text: copy.title, size: 16, bold: true },
    { text: `${copy.holder}: ${profile?.name ?? '—'}`, gapBefore: 8 },
    { text: `${copy.account}: ${user.id}` },
    { text: `${copy.generated}: ${new Date().toISOString()}` },
    { text: copy.note, size: 9 },
  ]
  for (const [slug, signed] of latest) {
    const { data: doc, error: docError } = await db
      .from('legal_documents')
      .select('title, summary, sections')
      .eq('slug', slug)
      .eq('version', signed.version)
      .eq('language', language)
      .maybeSingle()
    if (docError || !doc) throw new Error('documents_unavailable')
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
