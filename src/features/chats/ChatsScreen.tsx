import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'

/** Placeholder: matches list and real-time chat arrive in Block 3 (mock) / 8 (real). */
export function ChatsScreen() {
  const { t } = useTranslation()
  return (
    <>
      <ScreenHeader title={t('tabs.chats')} />
      <EmptyState
        icon={MessageCircle}
        title={t('placeholders.chats.title')}
        description={t('placeholders.chats.description')}
        footnote={t('placeholders.upcomingBlock', { block: 3 })}
      />
    </>
  )
}
