import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ButtonLink } from './button'

/** Screen title bar. Respects the top safe area (notch / status bar). */
export function ScreenHeader({
  title,
  description,
  backTo,
  trailing,
}: {
  title: string
  description?: string
  backTo?: string
  trailing?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <header className="pt-safe px-safe">
      <div className="flex min-h-16 items-center gap-1 pt-2">
        {backTo && (
          <ButtonLink
            to={backTo}
            variant="ghost"
            size="icon"
            aria-label={t('common.back')}
            className="-ml-2"
          >
            <ChevronLeft aria-hidden />
          </ButtonLink>
        )}
        <h1 className="flex-1 text-3xl font-semibold">{title}</h1>
        {trailing}
      </div>
      {description && <p className="mt-1 max-w-prose text-muted-foreground">{description}</p>}
    </header>
  )
}
