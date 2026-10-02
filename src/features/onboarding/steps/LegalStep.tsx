import { FileText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalDocumentSheet } from '@/features/legal/components/LegalDocumentSheet'
import { useLegalDocuments, useSignDocuments } from '@/features/legal/hooks/use-legal-documents'
import { SIGNUP_DOCUMENTS, type LegalDocument } from '@/features/legal/model/legal'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { Skeleton } from '@/shared/ui/skeleton'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import type { StepProps } from './types'

const CHECKS = ['adult', 'terms', 'privacy'] as const
type CheckKey = (typeof CHECKS)[number]

/** Signature screen (PRD 6.1): three unticked boxes, "Firmo y acepto" and an equally visible "No acepto". */
export function LegalStep({ dispatch }: StepProps) {
  const { t } = useTranslation()
  const { data: documents, isPending } = useLegalDocuments(SIGNUP_DOCUMENTS)
  const sign = useSignDocuments()
  const [checked, setChecked] = useState<Record<CheckKey, boolean>>({
    adult: false,
    terms: false,
    privacy: false,
  })
  const [reading, setReading] = useState<LegalDocument | null>(null)
  const allChecked = CHECKS.every((key) => checked[key])

  const onSign = () => {
    if (!documents) return
    sign.mutate(documents, { onSuccess: (signed) => dispatch({ type: 'LEGAL_SIGNED', signed }) })
  }

  return (
    <OnboardingStepLayout
      step="legal"
      title={t('onboarding.legal.title')}
      description={t('onboarding.legal.body')}
      onBack={() => dispatch({ type: 'BACK' })}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => dispatch({ type: 'LEGAL_DECLINED' })}>
            {t('onboarding.legal.decline')}
          </Button>
          <Button disabled={!allChecked || !documents || sign.isPending} onClick={onSign}>
            {t('onboarding.legal.sign')}
          </Button>
        </div>
      }
    >
      <ul className="space-y-2">
        {isPending && <Skeleton className="h-16" />}
        {documents?.map((doc) => (
          <li key={doc.slug}>
            <GlassCard className="flex items-center gap-3 py-3">
              <FileText className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{doc.title}</span>
                <span className="font-label block text-xs text-muted-foreground">
                  {t('onboarding.legal.version', { version: doc.version })}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReading(doc)}
                aria-label={`${t('common.read')}: ${doc.title}`}
              >
                {t('common.read')}
              </Button>
            </GlassCard>
          </li>
        ))}
      </ul>
      <div className="space-y-3">
        {CHECKS.map((key) => (
          <CheckboxField
            key={key}
            checked={checked[key]}
            onCheckedChange={(value) => setChecked((current) => ({ ...current, [key]: value }))}
          >
            {t(`onboarding.legal.checks.${key}`)}
          </CheckboxField>
        ))}
      </div>
      <LegalDocumentSheet document={reading} onClose={() => setReading(null)} />
    </OnboardingStepLayout>
  )
}
