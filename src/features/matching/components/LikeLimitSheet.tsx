import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'

/** Daily free likes used up (PRD 6.6). Honest paywall: no fake urgency, clear "Ahora no". */
export function LikeLimitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const paywall = usePaywallState()
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('matching.limit.title')}
      description={t('matching.limit.body')}
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      {paywall !== 'hidden' && (
        <p className="glass mb-4 flex items-center gap-2 rounded-2xl p-3 text-sm">
          <Crown className="size-5 shrink-0 text-warning" aria-hidden />
          {paywall === 'checkout' ? t('matching.limit.premium') : t('matching.limit.comingSoon')}
        </p>
      )}
      <Button block variant="outline" onClick={onClose}>
        {t('verification.gate.notNow')}
      </Button>
    </BottomSheet>
  )
}
