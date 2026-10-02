import { useTranslation } from 'react-i18next'
import { ConsentEditorView } from '@/features/consents/components/ConsentEditorView'
import { useConsentEditor } from '@/features/consents/hooks/use-consent-editor'
import { useSaveConsents } from '@/features/consents/hooks/use-consents'
import { LayeredInfoBox } from '@/features/legal/components/LayeredInfoBox'
import { Illustration } from '@/shared/images/Illustration'
import { Button } from '@/shared/ui/button'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import type { StepProps } from './types'

/** Specific consents (PRD 5.2.5, 6.1): all OFF by default, each with its legal basis. */
export function ConsentsStep({ data, dispatch }: StepProps) {
  const { t } = useTranslation()
  const editor = useConsentEditor(
    data.consents ? { choices: data.consents, city: data.city ?? null } : undefined,
  )
  const save = useSaveConsents()

  const onContinue = () =>
    save.mutate(
      { choices: editor.choices, city: editor.needsCity ? editor.city : null },
      {
        onSuccess: () =>
          dispatch({
            type: 'CONSENTS_SAVED',
            consents: editor.choices,
            ...(editor.needsCity && editor.city ? { city: editor.city } : {}),
          }),
      },
    )

  return (
    <OnboardingStepLayout
      step="consents"
      title={t('onboarding.consents.title')}
      description={t('onboarding.consents.body')}
      hero={<Illustration name="location" className="mt-2 size-32" />}
      footer={
        <>
          {!editor.isValid && (
            <p className="text-sm text-muted-foreground">{t('onboarding.consents.cityRequired')}</p>
          )}
          <Button block size="lg" disabled={!editor.isValid || save.isPending} onClick={onContinue}>
            {t('common.continue')}
          </Button>
        </>
      }
    >
      <LayeredInfoBox form="consents" />
      <ConsentEditorView editor={editor} />
    </OnboardingStepLayout>
  )
}
