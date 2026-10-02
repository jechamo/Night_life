import type { Language } from '@/i18n'
import type { Result } from '@/shared/lib/result'
import type { LegalDocument, LegalDocumentSlug, SignedDocument } from '../model/legal'

/** Port for versioned legal documents and immutable signature evidence (consent_records). */
export interface LegalService {
  getDocuments(slugs: readonly LegalDocumentSlug[], language: Language): Promise<LegalDocument[]>
  sign(documents: readonly Pick<LegalDocument, 'slug' | 'version'>[]): Promise<SignedDocument[]>
  getSigned(): Promise<SignedDocument[]>
  /** Signed PDF generated on the server from the immutable evidence (PRD 6.1). */
  downloadSignedPdf(language: Language): Promise<Result<Blob, 'failed'>>
  /** Sends the signed PDF to the confirmed email (outbox, retried on failure). */
  emailSignedDocuments(
    language: Language,
  ): Promise<Result<'sent', 'no_email' | 'not_configured' | 'failed'>>
}
