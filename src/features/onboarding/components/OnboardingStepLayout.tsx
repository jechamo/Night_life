import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { ONBOARDING_STEPS, stepNumber, type OnboardingStep } from '../model/onboarding-machine'

/**
 * Shared frame for every onboarding step: progress, optional back, title, content
 * and a sticky footer for the primary action (thumb reach on mobile).
 */
export function OnboardingStepLayout({
  step,
  title,
  description,
  onBack,
  hero,
  footer,
  children,
}: {
  step?: OnboardingStep
  title: string
  description?: string
  onBack?: () => void
  hero?: ReactNode
  footer?: ReactNode
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const total = ONBOARDING_STEPS.length
  const current = step ? stepNumber(step) : 0
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="pt-safe px-safe">
        <div className="flex min-h-14 items-center gap-2">
          {onBack ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.back')}
              onClick={onBack}
              className="-ml-2"
            >
              <ChevronLeft aria-hidden />
            </Button>
          ) : (
            <span className="size-11" aria-hidden />
          )}
          {step && (
            <div
              className="flex flex-1 items-center gap-1.5"
              role="progressbar"
              aria-label={t('common.stepOf', { current, total })}
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={current}
            >
              {ONBOARDING_STEPS.map((s, index) => (
                <span
                  key={s}
                  className={
                    index < current
                      ? 'h-1.5 flex-1 rounded-full bg-primary'
                      : 'h-1.5 flex-1 rounded-full bg-surface-raised'
                  }
                />
              ))}
            </div>
          )}
        </div>
      </header>
      {hero}
      <main className="px-safe flex-1 pb-6">
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        <div className="mt-6 space-y-5">{children}</div>
      </main>
      {footer && (
        <footer className="px-safe glass-strong sticky bottom-0 z-10 space-y-3 border-x-0 border-b-0 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      )}
    </div>
  )
}
