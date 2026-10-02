import { Copy, Gift, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CATALOG, formatPrice, type ProductCode } from '@/features/premium/model/catalog'
import { ENTITLEMENT_KEYS, type EntitlementKey } from '@/shared/entitlements/entitlements'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { ListRow } from '@/shared/ui/list-row'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextField } from '@/shared/ui/text-field'
import { useCreatePromoCode, useGrantEntitlement } from '../hooks/use-admin'

const SUBSECTIONS = ['subscriptions', 'entitlements', 'promoCodes', 'paymentEvents'] as const

function PromoCodeForm() {
  const { t } = useTranslation()
  const create = useCreatePromoCode()
  const [product, setProduct] = useState<ProductCode>('vip_monthly')
  const [days, setDays] = useState('7')
  const [maxUses, setMaxUses] = useState('50')
  const valid =
    Number(days) >= 1 && Number(days) <= 365 && Number(maxUses) >= 1 && Number(maxUses) <= 10_000
  return (
    <GlassCard className="space-y-3">
      <SingleChoice
        label={t('admin.payments.product')}
        value={product}
        onChange={setProduct}
        options={CATALOG.filter((p) => p.kind !== 'credits').map((p) => ({
          value: p.code,
          label: t(`premium.products.${p.code}.name`),
        }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          type="number"
          min={1}
          max={365}
          label={t('admin.payments.days')}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <TextField
          type="number"
          min={1}
          max={10000}
          label={t('admin.payments.maxUses')}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
        />
      </div>
      <Button
        block
        disabled={!valid || create.isPending}
        onClick={() =>
          create.mutate({ productCode: product, days: Number(days), maxUses: Number(maxUses) })
        }
      >
        <Gift aria-hidden />
        {t('admin.payments.createCode')}
      </Button>
      {typeof create.data === 'string' && (
        <p role="status" className="flex items-center gap-2 text-sm text-success">
          <Copy className="size-4" aria-hidden />
          {t('admin.payments.codeCreated', { code: create.data })}
        </p>
      )}
    </GlassCard>
  )
}

function GrantForm() {
  const { t } = useTranslation()
  const grant = useGrantEntitlement()
  const [user, setUser] = useState('')
  const [key, setKey] = useState<EntitlementKey>('unlimited_likes')
  const [days, setDays] = useState('7')
  return (
    <GlassCard className="space-y-3">
      <TextField
        label={t('admin.payments.user')}
        hint={t('admin.payments.userHint')}
        value={user}
        maxLength={60}
        onChange={(e) => setUser(e.target.value)}
      />
      <SingleChoice
        label={t('admin.payments.entitlement')}
        value={key}
        onChange={setKey}
        options={ENTITLEMENT_KEYS.map((k) => ({ value: k, label: k }))}
      />
      <TextField
        type="number"
        min={0}
        max={365}
        label={t('admin.payments.daysOrForever')}
        value={days}
        onChange={(e) => setDays(e.target.value)}
      />
      <Button
        block
        disabled={user.trim().length < 2 || grant.isPending}
        onClick={() =>
          grant.mutate({ user: user.trim(), key, days: Number(days) > 0 ? Number(days) : null })
        }
      >
        <KeyRound aria-hidden />
        {t('admin.payments.grant')}
      </Button>
      {grant.isSuccess && (
        <p role="status" className="text-sm text-success">
          {t('admin.payments.granted')}
        </p>
      )}
    </GlassCard>
  )
}

/** Admin › Pagos (PRD 6.10, 6.13): catalog, subscriptions, entitlements, codes, events. */
export function AdminPaymentsScreen() {
  const { t, i18n } = useTranslation()
  const mode = useFeatureFlag('payments_mode')
  const audience = useFeatureFlag('payments_audience')
  return (
    <>
      <ScreenHeader
        title={t('admin.nav.payments')}
        description={t('admin.payments.body', { mode, audience })}
      />
      <Section title={t('admin.payments.catalog')}>
        <div className="glass overflow-x-auto rounded-theme">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('admin.payments.product')}</th>
                <th className="px-4 py-2 font-medium">{t('admin.payments.kind')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('admin.payments.price')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CATALOG.map((p) => (
                <tr key={p.code}>
                  <td className="px-4 py-2">
                    {t(`premium.products.${p.code}.name`)}{' '}
                    <span className="font-label text-xs text-muted-foreground">{p.code}</span>
                  </td>
                  <td className="px-4 py-2">{t(`admin.payments.kinds.${p.kind}`)}</td>
                  <td className="px-4 py-2 text-right">
                    {formatPrice(p.priceCents, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={t('admin.payments.records')}>
        <GlassCard className="divide-y divide-border p-0">
          {SUBSECTIONS.map((s) => (
            <ListRow
              key={s}
              to={`/admin/s/${s}`}
              icon={KeyRound}
              label={t(`admin.sections.${s}.title`)}
              hint={t(`admin.sections.${s}.body`)}
            />
          ))}
        </GlassCard>
      </Section>
      <Section title={t('admin.payments.promoTitle')}>
        <PromoCodeForm />
      </Section>
      <Section title={t('admin.payments.grantTitle')}>
        <GrantForm />
      </Section>
    </>
  )
}
