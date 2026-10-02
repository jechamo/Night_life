import { Map } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'

/** Placeholder: the 3D night map, pins and "Quién hay" arrive in Block 3 (mock) / 7 (real). */
export function DiscoverScreen() {
  const { t } = useTranslation()
  return (
    <>
      <ScreenHeader title={t('tabs.discover')} />
      <EmptyState
        icon={Map}
        title={t('placeholders.discover.title')}
        description={t('placeholders.discover.description')}
        footnote={t('placeholders.upcomingBlock', { block: 3 })}
      />
    </>
  )
}
