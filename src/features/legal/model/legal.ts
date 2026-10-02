/** Documents signed before creating the account (PRD 6.1 "Pantalla de firma"). */
export const SIGNUP_DOCUMENTS = ['terms', 'community', 'privacy'] as const
export type LegalDocumentSlug =
  | (typeof SIGNUP_DOCUMENTS)[number]
  | 'legal_notice'
  | 'cookies'
  | 'ranking'
  | 'venues'
  | 'sponsorship'
  | 'premium'
  | 'third_parties'

export interface LegalSection {
  heading: string
  body: string
}

export interface LegalDocument {
  slug: LegalDocumentSlug
  /** Semantic version: any change requires re-acceptance. */
  version: string
  /** ISO date (UTC) the version became effective. */
  effectiveAt: string
  title: string
  summary: string
  sections: readonly LegalSection[]
}

export interface SignedDocument {
  slug: LegalDocumentSlug
  version: string
  signedAt: string
}

/** Documents whose current version the user has not signed (PRD 6.1 reacceptance). */
export function documentsToReaccept(
  current: readonly Pick<LegalDocument, 'slug' | 'version'>[],
  signed: readonly SignedDocument[],
): LegalDocumentSlug[] {
  return current
    .filter((doc) => !signed.some((s) => s.slug === doc.slug && s.version === doc.version))
    .map((doc) => doc.slug)
}
