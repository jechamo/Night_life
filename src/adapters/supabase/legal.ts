import { z } from 'zod'
import type { LegalDocument, LegalDocumentSlug, SignedDocument } from '@/features/legal/model/legal'
import type { LegalService } from '@/features/legal/services/legal-service'
import { err, ok } from '@/shared/lib/result'
import { currentUserId, invokeFunction, type Db } from './client'
import { must } from './errors'

const SectionsSchema = z.array(z.object({ heading: z.string(), body: z.string() }))

/**
 * Versioned documents from `legal_documents` and immutable evidence in
 * `consent_records`. During onboarding there is no account yet: signatures are kept
 * in memory and recorded by `complete_onboarding` in the same transaction.
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
      if (await currentUserId(db)) {
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
