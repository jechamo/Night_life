import { CreditCard, FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useCompleteTestPurchase } from '../hooks/use-premium'
import { formatPrice, productByCode } from '../model/catalog'

/**
 * Stand-in for Stripe Checkout in test mode (Block 9 redirects to the real hosted page,
 * where the Stripe test cards are used). Paying simulates the signed webhook.
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
          <p className="font-mono text-sm text-muted-foreground">
            4242 4242 4242 4242 · 12/34 · 123
          </p>
        </GlassCard>
        <Button
          block
          size="lg"
          disabled={complete.isPending}
          onClick={() =>
            complete.mutate(product.code, {
              onSuccess: () => void navigate('/premium/return?status=success', { replace: true }),
            })
          }
        >
          <CreditCard aria-hidden />
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
