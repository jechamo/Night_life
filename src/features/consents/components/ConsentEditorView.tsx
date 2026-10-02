import { ShieldAlert } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { MOCK_CITIES } from '@/mocks/cities.mock'
import { GlassCard } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'
import type { ConsentEditor } from '../hooks/use-consent-editor'
import { CONSENT_DEFINITIONS, type ConsentKey } from '../model/consents'
import { OrientationConsentSheet } from './OrientationConsentSheet'

function ConsentRow({
  consentKey,
  special,
  checked,
  onToggle,
}: {
  consentKey: ConsentKey
  special: boolean
  checked: boolean
  onToggle: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const switchId = useId()
  const descriptionId = useId()
  const base = `onboarding.consents.items.${consentKey}` as const
  return (
    <GlassCard className="space-y-3">
      <div className="flex items-start gap-4">
        <label htmlFor={switchId} className="flex-1 cursor-pointer">
          <span className="flex items-center gap-2 font-medium">
            {t(`${base}.title`)}
            {special && <ShieldAlert className="size-4 text-warning" aria-hidden />}
          </span>
          <span id={descriptionId} className="mt-1 block text-sm text-muted-foreground">
            {t(`${base}.description`)}
          </span>
        </label>
        <Switch
          id={switchId}
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={onToggle}
        />
      </div>
      <dl className="grid gap-1 text-xs">
        <div className="flex gap-1">
          <dt className="font-label text-muted-foreground">
            {t('onboarding.consents.basisLabel')}:
          </dt>
          <dd>{t(`${base}.basis`)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-label text-muted-foreground">
            {t('onboarding.consents.withoutLabel')}:
          </dt>
          <dd>{t(`${base}.without`)}</dd>
        </div>
      </dl>
    </GlassCard>
  )
}

/** Consent list + city fallback + signature sheet. Used in onboarding and in Profile. */
export function ConsentEditorView({ editor }: { editor: ConsentEditor }) {
  const { t } = useTranslation()
  const cityId = useId()
  return (
    <div className="space-y-3">
      {CONSENT_DEFINITIONS.map(({ key, special }) => (
        <ConsentRow
          key={key}
          consentKey={key}
          special={special}
          checked={editor.choices[key]}
          onToggle={(value) => void editor.toggle(key, value)}
        />
      ))}
      {editor.locationBlocked && (
        <p role="alert" className="text-sm text-warning">
          {t('onboarding.consents.locationBlocked')}
        </p>
      )}
      {editor.needsCity && (
        <div className="space-y-1.5">
          <label htmlFor={cityId} className="text-sm font-medium">
            {t('onboarding.consents.city')}
          </label>
          <select
            id={cityId}
            value={editor.city ?? ''}
            onChange={(event) => editor.setCity(event.target.value || null)}
            className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground"
          >
            <option value="">{t('onboarding.consents.cityPlaceholder')}</option>
            {MOCK_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      )}
      <OrientationConsentSheet
        open={editor.signingOrientation}
        onConfirm={editor.confirmOrientation}
        onCancel={editor.cancelOrientation}
      />
    </div>
  )
}
