import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { TextField } from '@/shared/ui/text-field'
import { useRedeemCode } from '../hooks/use-premium'

/** Redeem a promo code (PRD 5.1). Long codes + attempt limits against brute force. */
export function RedeemScreen() {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const redeem = useRedeemCode()
  const result = redeem.data
  return (
    <>
      <ScreenHeader
        title={t('premium.redeem.title')}
        description={t('premium.redeem.body')}
        backTo="/premium"
      />
      <div className="px-safe mt-4 space-y-4">
        <TextField
          label={t('premium.redeem.label')}
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={result && !result.ok ? t(`premium.redeem.errors.${result.error}`) : undefined}
          className="font-mono tracking-widest uppercase"
        />
        <Button block disabled={!code || redeem.isPending} onClick={() => redeem.mutate(code)}>
          {t('premium.redeem.submit')}
        </Button>
        {result?.ok && (
          <p role="status" className="text-live">
            {t('premium.redeem.success', {
              product: t(`premium.products.${result.value.productCode}.name`),
              days: result.value.days,
            })}
          </p>
        )}
      </div>
    </>
  )
}
