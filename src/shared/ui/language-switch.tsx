import { useTranslation } from 'react-i18next'
import { useLanguage } from '@/i18n/use-language'
import { SegmentedControl } from './segmented-control'

/** Compact ES/EN switch for screens before Settings is reachable (welcome, public web). */
export function LanguageSwitch() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  return (
    <SegmentedControl
      label={t('settings.language.label')}
      value={language}
      options={[
        { value: 'es', label: 'ES' },
        { value: 'en', label: 'EN' },
      ]}
      onChange={setLanguage}
    />
  )
}
