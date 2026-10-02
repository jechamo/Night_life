import { Info } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLegalDocuments } from '../hooks/use-legal-documents'
import { LegalDocumentSheet } from './LegalDocumentSheet'

type FormKey = 'phone' | 'profile' | 'consents'

const PRIVACY = ['privacy'] as const

/** First layer of data protection information on every form (PRD 6.1 "información por capas"). */
export function LayeredInfoBox({ form }: { form: FormKey }) {
  const { t } = useTranslation()
  const { data: docs } = useLegalDocuments(PRIVACY)
  const [open, setOpen] = useState(false)
  const rows = [
    [t('onboarding.layered.controller'), t('onboarding.layered.controllerValue')],
    [t('onboarding.layered.purpose'), t(`onboarding.layered.forms.${form}.purpose`)],
    [t('onboarding.layered.basis'), t(`onboarding.layered.forms.${form}.basis`)],
    [t('onboarding.layered.rights'), t('onboarding.layered.rightsValue')],
  ] as const

  return (
    <details className="group rounded-2xl border border-border bg-surface text-sm">
      <summary className="touch-target flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">{t('onboarding.layered.title')}</span>
      </summary>
      <dl className="space-y-2 px-4 pb-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="font-label text-xs text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="touch-target px-4 pb-3 text-left font-medium text-primary underline underline-offset-4"
        onClick={() => setOpen(true)}
      >
        {t('onboarding.layered.more')}
      </button>
      <LegalDocumentSheet
        document={open ? (docs?.[0] ?? null) : null}
        onClose={() => setOpen(false)}
      />
    </details>
  )
}
