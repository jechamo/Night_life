import { BookOpen, FileText, Mail, ShieldAlert, Store, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LegalDocumentSlug } from '@/features/legal/model/legal'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { GlassCard } from '@/shared/ui/card'
import { ListRow } from '@/shared/ui/list-row'

export const PUBLIC_DOCUMENTS: readonly LegalDocumentSlug[] = [
  'legal_notice',
  'terms',
  'community',
  'privacy',
  'cookies',
  'ranking',
  'venues',
  'sponsorship',
  'third_parties',
]

/** Premium terms are loaded but only published once payments are open (PRD 6.1 doc 9). */
export function usePublishedDocuments(): readonly LegalDocumentSlug[] {
  return usePaywallState() === 'checkout' ? [...PUBLIC_DOCUMENTS, 'premium'] : PUBLIC_DOCUMENTS
}

export function LegalIndexScreen() {
  const { t } = useTranslation()
  const documents = usePublishedDocuments()
  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold">{t('publicWeb.title')}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t('publicWeb.intro')}</p>
      <section className="mt-8">
        <h2 className="font-label mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t('guide.nav.title')}
        </h2>
        <GlassCard className="divide-y divide-border p-0">
          <ListRow
            to="/guia"
            icon={BookOpen}
            label={t('guide.nav.user')}
            hint={t('guide.nav.userHint')}
          />
          <ListRow
            to="/guia/locales"
            icon={Store}
            label={t('guide.nav.venues')}
            hint={t('guide.nav.venuesHint')}
          />
        </GlassCard>
      </section>
      <section className="mt-8">
        <h2 className="font-label mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t('publicWeb.documents')}
        </h2>
        <GlassCard className="divide-y divide-border p-0">
          {documents.map((slug) => (
            <ListRow
              key={slug}
              to={`/legal/${slug}`}
              icon={FileText}
              label={t(`publicWeb.docs.${slug}`)}
            />
          ))}
        </GlassCard>
      </section>
      <section className="mt-8">
        <h2 className="font-label mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {t('publicWeb.rights')}
        </h2>
        <GlassCard className="divide-y divide-border p-0">
          <ListRow
            to="/legal/delete-account"
            icon={Trash2}
            label={t('publicWeb.deleteAccount.title')}
            hint={t('publicWeb.deleteAccount.hint')}
          />
          <ListRow
            to="/legal/illegal-content"
            icon={ShieldAlert}
            label={t('publicWeb.illegal.title')}
            hint={t('publicWeb.illegal.hint')}
          />
          <ListRow
            to="/legal/contact"
            icon={Mail}
            label={t('publicWeb.contact.title')}
            hint={t('publicWeb.contact.hint')}
          />
        </GlassCard>
      </section>
    </>
  )
}
