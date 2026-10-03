import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { Section } from '@/shared/ui/section'
import { Switch } from '@/shared/ui/switch'
import { TextField } from '@/shared/ui/text-field'
import { useConfigureProvider, useProviderQuotas, useSetMapToken } from '../hooks/use-admin'
import { quotaWarning, type ProviderQuota } from '../model/provider-quota'

const MAP_TOKEN_RE = /^pk\.[A-Za-z0-9_.-]{20,297}$/

/** Public, URL-restricted token only (pk.*). Secret tokens (sk.*) are rejected here and in SQL. */
function MapTokenField({ hasToken }: { hasToken: boolean }) {
  const { t } = useTranslation()
  const save = useSetMapToken()
  const [token, setToken] = useState('')
  const valid = MAP_TOKEN_RE.test(token.trim())
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-sm">
        {t(hasToken ? 'admin.providers.token.set' : 'admin.providers.token.missing')}
      </p>
      <TextField
        label={t('admin.providers.token.label')}
        hint={t('admin.providers.token.hint')}
        value={token}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setToken(e.target.value)}
        {...(token && !valid ? { error: t('admin.providers.token.invalid') } : {})}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!valid || save.isPending}
          onClick={() => save.mutate(token.trim(), { onSuccess: () => setToken('') })}
        >
          {t('admin.providers.token.save')}
        </Button>
        {hasToken && (
          <Button
            size="sm"
            variant="secondary"
            disabled={save.isPending}
            onClick={() => save.mutate('')}
          >
            {t('admin.providers.token.clear')}
          </Button>
        )}
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('admin.providers.error')}
        </p>
      )}
    </div>
  )
}

function QuotaRow({ quota }: { quota: ProviderQuota }) {
  const { t } = useTranslation()
  const save = useConfigureProvider()
  const [daily, setDaily] = useState(String(quota.dailyBudget))
  const [monthly, setMonthly] = useState(String(quota.monthlyBudget))
  const [observed, setObserved] = useState(String(quota.observedProviderUsage))
  const [confirm, setConfirm] = useState(false)
  const [enabled, setEnabled] = useState(quota.available)
  const nDaily = Number(daily),
    nMonthly = Number(monthly),
    nObserved = Number(observed)
  const max = Math.max(
    0,
    quota.freeMonthlyAllowance -
      quota.safetyMargin -
      (confirm ? nObserved : quota.observedProviderUsage),
  )
  const valid =
    daily.trim() !== '' &&
    monthly.trim() !== '' &&
    Number.isInteger(nDaily) &&
    nDaily >= 0 &&
    Number.isInteger(nMonthly) &&
    nMonthly >= nDaily &&
    nMonthly <= max &&
    (!confirm ||
      (observed.trim() !== '' &&
        Number.isInteger(nObserved) &&
        nObserved >= 0 &&
        nObserved <= quota.freeMonthlyAllowance))
  const warning = quotaWarning(quota)
  const changed =
    nDaily !== quota.dailyBudget ||
    nMonthly !== quota.monthlyBudget ||
    enabled !== quota.available ||
    confirm
  return (
    <GlassCard className="space-y-3">
      <h3 className="font-semibold">{t(`admin.providers.names.${quota.capability}`)}</h3>
      <p className="text-sm text-muted-foreground">
        {t('admin.providers.usage', {
          used: quota.monthlyUsed,
          budget: quota.monthlyBudget,
          free: quota.freeMonthlyAllowance,
        })}
      </p>
      <p className="text-sm">
        {t(quota.canCall ? 'admin.providers.ready' : 'admin.providers.paused')}
      </p>
      {warning && (
        <p role="status" className="text-sm text-warning">
          {t(`admin.providers.warnings.${warning}`)}
        </p>
      )}
      {!quota.editable ? (
        <p className="text-sm text-muted-foreground">{t('admin.providers.unconfirmed')}</p>
      ) : (
        <>
          <TextField
            type="number"
            min={0}
            max={max}
            label={t('admin.providers.monthly')}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!valid || nMonthly + quota.increaseStep > max || save.isPending}
            onClick={() => setMonthly(String(nMonthly + quota.increaseStep))}
          >
            {t('admin.providers.increase', { count: quota.increaseStep })}
          </Button>
          <TextField
            type="number"
            min={0}
            max={nMonthly}
            label={t('admin.providers.daily')}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {t('admin.providers.margin', { margin: quota.safetyMargin, max })}
          </p>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t('admin.providers.enabled')}
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t('admin.providers.confirmUsage')}
            <Switch checked={confirm} onCheckedChange={setConfirm} />
          </label>
          {confirm && (
            <TextField
              type="number"
              min={0}
              max={quota.freeMonthlyAllowance}
              label={t('admin.providers.observed')}
              hint={t('admin.providers.observedHint')}
              value={observed}
              onChange={(e) => setObserved(e.target.value)}
            />
          )}
          {!valid && (
            <p role="alert" className="text-sm text-danger">
              {t('admin.providers.invalid')}
            </p>
          )}
          {save.isError && (
            <p role="alert" className="text-sm text-danger">
              {t('admin.providers.error')}
            </p>
          )}
          {save.isSuccess && (
            <p role="status" className="text-sm">
              {t('admin.providers.saved')}
            </p>
          )}
          <Button
            size="sm"
            disabled={!valid || !changed || save.isPending}
            onClick={() =>
              save.mutate({
                capability: quota.capability,
                dailyBudget: nDaily,
                monthlyBudget: nMonthly,
                enabled,
                ...(confirm ? { observedProviderUsage: nObserved } : {}),
              })
            }
          >
            {t('common.save')}
          </Button>
        </>
      )}
      {quota.capability === 'mapbox' && <MapTokenField hasToken={quota.hasToken} />}
    </GlassCard>
  )
}

export function ProviderQuotas() {
  const { t } = useTranslation()
  const quotas = useProviderQuotas()
  return (
    <Section title={t('admin.providers.title')}>
      <p className="mb-3 text-sm text-muted-foreground">{t('admin.providers.body')}</p>
      {quotas.isPending && <p role="status">{t('admin.providers.loading')}</p>}
      {quotas.isError && (
        <div role="alert">
          <p>{t('admin.providers.error')}</p>
          <Button size="sm" onClick={() => void quotas.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}
      {quotas.data?.length === 0 && <p>{t('admin.providers.empty')}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {quotas.data?.map((q) => (
          <QuotaRow
            key={`${q.capability}:${q.dailyBudget}:${q.monthlyBudget}:${q.available}:${q.usageObservedAt}`}
            quota={q}
          />
        ))}
      </div>
    </Section>
  )
}
