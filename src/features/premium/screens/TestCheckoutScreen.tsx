import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useCompleteTestPurchase } from '../hooks/use-premium'
import { formatPrice, productByCode } from '../model/catalog'

/**
 * Explicit persisted simulator. Real Stripe test-card purchases use hosted Checkout.
 */
export function TestCheckoutScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { code = '' } = useParams()
  const product = productByCode(code)
  const complete = useCompleteTestPurchase()
  if (!product) return null
  return (
    <>
      <ScreenHeader title={t('premium.testCheckout.title')} />
      <div className="px-safe mt-4 space-y-4">
        <GlassCard className="flex gap-3">
          <FlaskConical className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm">{t('premium.testCheckout.body')}</p>
        </GlassCard>
        <GlassCard className="space-y-1">
          <p className="font-semibold">{t(`premium.products.${product.code}.name`)}</p>
          <p className="font-display text-2xl text-primary">
            {formatPrice(product.priceCents, i18n.language)}
          </p>
        </GlassCard>
        <Button
          block
          size="lg"
          disabled={complete.isPending}
          onClick={() =>
            complete.mutate(product.code, {
              onSuccess: () => void navigate('/premium/return?status=simulated', { replace: true }),
            })
          }
        >
          <FlaskConical aria-hidden />
          {t('premium.testCheckout.pay')}
        </Button>
        <Button
          block
          variant="ghost"
          onClick={() => void navigate('/premium/return?status=cancelled', { replace: true })}
        >
          {t('premium.testCheckout.cancel')}
        </Button>
      </div>
    </>
  )
}
