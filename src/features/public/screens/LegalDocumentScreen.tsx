import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { useLegalDocuments } from '@/features/legal/hooks/use-legal-documents'
import type { LegalDocumentSlug } from '@/features/legal/model/legal'
import { ButtonLink } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { usePublishedDocuments } from './LegalIndexScreen'

/** One public, versioned legal document (PRD 6.1). */
export function LegalDocumentScreen() {
  const { t, i18n } = useTranslation()
  const { slug = '' } = useParams()
  const published = usePublishedDocuments()
  const known = published.includes(slug as LegalDocumentSlug)
  const { data, isPending } = useLegalDocuments(known ? [slug as LegalDocumentSlug] : [])
  const doc = data?.[0]

  if (!known) {
    return (
      <div className="mt-12 space-y-4">
        <h1 className="text-3xl font-semibold">{t('publicWeb.notPublished.title')}</h1>
        <p className="text-muted-foreground">{t('publicWeb.notPublished.body')}</p>
        <ButtonLink to="/legal" variant="outline">
          {t('publicWeb.index')}
        </ButtonLink>
      </div>
    )
  }
  if (isPending || !doc) return <Skeleton className="mt-12 h-64 w-full" />

  return (
    <article className="mt-8">
      <h1 className="text-3xl font-semibold">{doc.title}</h1>
      <p className="font-label mt-2 text-xs text-muted-foreground">
        {t('publicWeb.version', {
          version: doc.version,
          date: new Date(doc.effectiveAt).toLocaleDateString(i18n.language),
        })}
      </p>
      <p role="note" className="mt-4 rounded-theme border border-warning p-3 text-sm text-warning">
        {t('publicWeb.draftNotice')}
      </p>
      <p className="mt-6 text-lg">{doc.summary}</p>
      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-6">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          <p className="mt-2 leading-7 text-muted-foreground">{section.body}</p>
        </section>
      ))}
    </article>
  )
}
