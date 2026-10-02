import { PartyPopper } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'

/** Placeholder: "Aquí Ahora / Esta Noche Voy" and the swipe stack arrive in Block 3. */
export function TonightScreen() {
  const { t } = useTranslation()
  return (
    <>
      <ScreenHeader title={t('tabs.tonight')} />
      <EmptyState
        icon={PartyPopper}
        title={t('placeholders.tonight.title')}
        description={t('placeholders.tonight.description')}
        footnote={t('placeholders.upcomingBlock', { block: 3 })}
      />
    </>
  )
}
