import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalDocumentSheet } from '@/features/legal/components/LegalDocumentSheet'
import { useLegalDocuments } from '@/features/legal/hooks/use-legal-documents'
import type { LegalDocument } from '@/features/legal/model/legal'
import { Button } from '@/shared/ui/button'
import { CheckboxField } from '@/shared/ui/checkbox'

const VENUE_TERMS = ['venues'] as const

/** Roadmap R3: explicit acceptance of the current «Condiciones para Locales» (never pre-checked). */
export function VenueTermsCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const { t } = useTranslation()
  const { data: documents } = useLegalDocuments(VENUE_TERMS)
  const [reading, setReading] = useState<LegalDocument | null>(null)
  const terms = documents?.[0]
  return (
    <div className="space-y-1">
      <CheckboxField checked={checked} onCheckedChange={onCheckedChange}>
        {t('venuePanel.partners.invite.acceptTerms', { version: terms?.version ?? '' })}
      </CheckboxField>
      <Button
        size="sm"
        variant="ghost"
        disabled={!terms}
        onClick={() => terms && setReading(terms)}
      >
        {t('venuePanel.partners.invite.readTerms')}
      </Button>
      <LegalDocumentSheet document={reading} onClose={() => setReading(null)} />
    </div>
  )
}
