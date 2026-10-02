import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { CheckboxField } from '@/shared/ui/checkbox'

/** Explicit, signed consent for special-category data (GDPR art. 9.2.a, PRD 6.1). */
export function OrientationConsentSheet({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  const close = () => {
    setChecked(false)
    onCancel()
  }
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t('onboarding.consents.orientationSheet.title')}
      description={t('onboarding.consents.orientationSheet.body')}
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      <CheckboxField checked={checked} onCheckedChange={setChecked}>
        {t('onboarding.consents.orientationSheet.check')}
      </CheckboxField>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={close}>
          {t('onboarding.consents.orientationSheet.cancel')}
        </Button>
        <Button
          disabled={!checked}
          onClick={() => {
            setChecked(false)
            onConfirm()
          }}
        >
          {t('onboarding.consents.orientationSheet.sign')}
        </Button>
      </div>
    </BottomSheet>
  )
}
