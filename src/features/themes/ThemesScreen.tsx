import { useTranslation } from 'react-i18next'
import { useTheme } from '@/shared/theme/ThemeProvider'
import { THEME_IDS, THEMES } from '@/shared/theme/themes'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { useNavigate } from 'react-router'
import { useThemeSwitch } from '@/shared/theme/use-theme-switch'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { ThemePreviewCard } from './components/ThemePreviewCard'

/** Theme picker (PRD 5.3 Perfil → Temas, 8.2). The 5 base themes are free. */
export function ThemesScreen() {
  const { t } = useTranslation()
  const { themeId } = useTheme()
  const switchTheme = useThemeSwitch()
  const { granted } = useEntitlement('premium_themes')
  const navigate = useNavigate()
  return (
    <>
      <ScreenHeader
        title={t('themes.title')}
        description={t('themes.description')}
        backTo="/profile"
      />
      <ul className="px-safe mt-6 grid gap-3 sm:grid-cols-2">
        {THEME_IDS.map((id) => (
          <li key={id}>
            <ThemePreviewCard
              themeId={id}
              selected={id === themeId}
              onSelect={(next) =>
                THEMES[next].premium && !granted ? void navigate('/premium') : switchTheme(next)
              }
            />
          </li>
        ))}
      </ul>
    </>
  )
}
