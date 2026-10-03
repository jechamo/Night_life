import { z } from 'zod'
import type { LegalDocument, LegalDocumentSlug, SignedDocument } from '@/features/legal/model/legal'
import type { LegalService } from '@/features/legal/services/legal-service'
import type { Platform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { err, ok } from '@/shared/lib/result'
import { currentUserId, invokeFunction, isOnboarded, type Db } from './client'
import { must } from './errors'

const SectionsSchema = z.array(z.object({ heading: z.string(), body: z.string() }))

let flushing = false

/**
 * Sends the pending "signed documents" email (PRD 6.1, outbox) once the address is
 * confirmed. Cheap when there is nothing to do: one RLS read, no function call.
 */
export async function flushEmailOutbox(db: Db, platform: Platform): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    const { data } = await db.auth.getUser()
    if (!data.user?.email || !data.user.email_confirmed_at) return
    const { count } = await db
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', data.user.id)
      .eq('status', 'pending')
    if (!count) return
    const language = await platform.preferences.get(PREFERENCE_KEYS.language)
    await invokeFunction(db, 'signed-documents', {
      action: 'outbox',
      language: language === 'en' ? 'en' : 'es',
    })
  } finally {
    flushing = false
  }
}

/** Retries the outbox when the app opens or someone signs in (e.g. after confirming). */
export function startEmailOutbox(db: Db, platform: Platform): void {
  db.auth.onAuthStateChange((event, session) => {
    if (!session || (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN')) return
    // Never await Supabase calls inside the auth callback (supabase-js lock).
    setTimeout(() => void flushEmailOutbox(db, platform), 0)
  })
}

/**
 * Versioned documents from `legal_documents` and immutable evidence in
 * `consent_records`. During onboarding the account is not finished yet: signatures
 * are kept in memory and recorded by `complete_onboarding` in the same transaction.
 */
export function createLegalService(db: Db): LegalService {
  return {
    async getDocuments(slugs, language) {
      if (slugs.length === 0) return []
      const rows = must(
        await db
          .from('legal_documents')
          .select('slug, version, effective_at, title, summary, sections')
          .in('slug', [...slugs])
          .eq('language', language)
          .eq('status', 'published')
          .lte('effective_at', new Date().toISOString())
          .order('effective_at', { ascending: false }),
      )
      const latest = new Map<string, LegalDocument>()
      for (const row of rows) {
        if (latest.has(row.slug)) continue
        const sections = SectionsSchema.safeParse(row.sections)
        latest.set(row.slug, {
          slug: row.slug as LegalDocumentSlug,
          version: row.version,
          effectiveAt: row.effective_at,
          title: row.title,
          summary: row.summary,
          sections: sections.success ? sections.data : [],
        })
      }
      return slugs.flatMap((slug) => latest.get(slug) ?? [])
    },

    async sign(documents) {
      const signedAt = new Date().toISOString()
      if (await isOnboarded(db)) {
        const { error } = await db.rpc('sign_documents', { p_slugs: documents.map((d) => d.slug) })
        if (error) throw error
      }
      return documents.map(({ slug, version }) => ({ slug, version, signedAt }))
    },

    async getSigned() {
      const uid = await currentUserId(db)
      if (!uid) return []
      const rows = must(
        await db
          .from('consent_records')
          .select('document_slug, document_version, created_at')
          .eq('user_id', uid)
          .eq('kind', 'legal')
          .order('created_at', { ascending: false }),
      )
      const latest = new Map<string, SignedDocument>()
      for (const row of rows) {
        if (!row.document_slug || !row.document_version || latest.has(row.document_slug)) continue
        latest.set(row.document_slug, {
          slug: row.document_slug as LegalDocumentSlug,
          version: row.document_version,
          signedAt: row.created_at,
        })
      }
      return [...latest.values()]
    },

    async downloadSignedPdf(language) {
      const { data, failed } = await invokeFunction<Blob>(db, 'signed-documents', {
        action: 'pdf',
        language,
      })
      return failed || !(data instanceof Blob) ? err('failed') : ok(data)
    },

    async emailSignedDocuments(language) {
      const { data, failed } = await invokeFunction<{ result: string }>(db, 'signed-documents', {
        action: 'email',
        language,
      })
      if (failed || !data) return err('failed')
      if (data.result === 'sent') return ok('sent')
      if (data.result === 'no_email') return err('no_email')
      if (data.result === 'not_configured') return err('not_configured')
      return err('failed')
    },
  }
}
