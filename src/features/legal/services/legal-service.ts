import type { Language } from '@/i18n'
import type { LegalDocument, LegalDocumentSlug, SignedDocument } from '../model/legal'

/** Port for versioned legal documents and immutable signature evidence (consent_records). */
export interface LegalService {
  getDocuments(slugs: readonly LegalDocumentSlug[], language: Language): Promise<LegalDocument[]>
  sign(documents: readonly Pick<LegalDocument, 'slug' | 'version'>[]): Promise<SignedDocument[]>
  getSigned(): Promise<SignedDocument[]>
}
