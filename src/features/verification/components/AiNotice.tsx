import { Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Prior AI notice with the right to human review (PRD 6.2, 6.12 C, AI Act art. 50). */
export function AiNotice() {
  const { t } = useTranslation()
  return (
    <aside className="flex gap-3 rounded-2xl border border-warning bg-surface p-4 text-sm">
      <Bot className="size-5 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="font-semibold">{t('verification.aiNotice.title')}</p>
        <p className="mt-1 text-muted-foreground">{t('verification.aiNotice.body')}</p>
      </div>
    </aside>
  )
}
