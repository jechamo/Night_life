import { Moon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router'
import { useLanguage } from '@/i18n/use-language'
import { SegmentedControl } from '@/shared/ui/segmented-control'

/**
 * Public legal website (PRD 5.1 "Web pública, sin login"). Lives outside the app shell
 * and the onboarding guard so anyone (stores, authorities, non-users) can read it.
 */
export function PublicLayout() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="pt-safe px-safe border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 py-3">
          <Link to="/legal" className="font-display flex items-center gap-2 text-lg font-semibold">
            <Moon className="size-5 text-primary" aria-hidden />
            {t('app.name')}
          </Link>
          <SegmentedControl
            label={t('settings.language.label')}
            value={language}
            options={[
              { value: 'es', label: 'ES' },
              { value: 'en', label: 'EN' },
            ]}
            onChange={setLanguage}
          />
        </div>
      </header>
      <main className="px-safe mx-auto max-w-3xl pb-16">
        <Outlet />
      </main>
      <footer className="px-safe border-t border-border">
        <nav
          aria-label={t('publicWeb.footerNav')}
          className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-2 py-6 text-sm text-muted-foreground"
        >
          <Link to="/legal">{t('publicWeb.index')}</Link>
          <Link to="/legal/legal_notice">{t('publicWeb.docs.legal_notice')}</Link>
          <Link to="/legal/privacy">{t('publicWeb.docs.privacy')}</Link>
          <Link to="/legal/delete-account">{t('publicWeb.deleteAccount.title')}</Link>
          <Link to="/legal/illegal-content">{t('publicWeb.illegal.title')}</Link>
          <Link to="/legal/contact">{t('publicWeb.contact.title')}</Link>
          <Link to="/">{t('publicWeb.openApp')}</Link>
        </nav>
      </footer>
    </div>
  )
}
