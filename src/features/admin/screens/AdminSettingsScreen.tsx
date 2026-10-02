import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { TextField } from '@/shared/ui/text-field'
import { useAdminSettings, useSetSetting } from '../hooks/use-admin'
import type { AdminSetting } from '../services/admin-service'

function SettingRow({ setting }: { setting: AdminSetting }) {
  const { t } = useTranslation()
  const save = useSetSetting()
  const [value, setValue] = useState(String(setting.value))
  const number = Number(value)
  const valid = Number.isInteger(number) && number >= setting.min && number <= setting.max
  return (
    <GlassCard className="space-y-2">
      <TextField
        type="number"
        min={setting.min}
        max={setting.max}
        label={t(`admin.settings.items.${setting.key}`)}
        hint={t('admin.settings.range', { min: setting.min, max: setting.max })}
        error={valid ? undefined : t('admin.settings.invalid')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={!valid || number === setting.value || save.isPending}
        onClick={() => save.mutate({ key: setting.key, value: number })}
      >
        {t('common.save')}
      </Button>
    </GlassCard>
  )
}

/** Admin › Configuración: tunable limits from `app_settings`, bounded and audited. */
export function AdminSettingsScreen() {
  const { t } = useTranslation()
  const { data: settings = [] } = useAdminSettings()
  return (
    <>
      <ScreenHeader title={t('admin.nav.settings')} description={t('admin.settings.body')} />
      <div className="px-safe mt-4 grid gap-3 md:grid-cols-2">
        {settings.map((s) => (
          <SettingRow key={s.key} setting={s} />
        ))}
      </div>
    </>
  )
}
