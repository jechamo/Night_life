import { Download, FileCheck2, Gavel, LogOut, Siren, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ListRow } from '@/shared/ui/list-row'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextField } from '@/shared/ui/text-field'
import {
  useDataRequests,
  useDeleteAccount,
  useExportMyData,
  useLogoutEverywhere,
  useRequestDeletionCode,
  useRequestDataRight,
} from '../hooks/use-privacy'

/**
 * "Privacidad y datos" (PRD 6.12 G): export (JSON), delete with OTP re-authentication,
 * log out everywhere and the history of my requests with their legal deadline.
 */
export function PrivacyDataScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const exportData = useExportMyData()
  const requestCode = useRequestDeletionCode()
  const deleteAccount = useDeleteAccount()
  const logoutAll = useLogoutEverywhere()
  const requestRight = useRequestDataRight()
  const { data: requests = [] } = useDataRequests()
  const [otp, setOtp] = useState('')
  const wrongCode = deleteAccount.data && !deleteAccount.data.ok

  const confirmDelete = () =>
    deleteAccount.mutate(otp, {
      onSuccess: (result) => {
        if (!result.ok) return
        queryClient.clear()
        void navigate('/welcome', { replace: true })
      },
    })

  return (
    <>
      <ScreenHeader
        title={t('privacyData.title')}
        description={t('privacyData.body')}
        backTo="/profile"
      />
      <Section title={t('privacyData.yourData')}>
        <GlassCard className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('privacyData.exportBody')}</p>
          <Button
            block
            variant="outline"
            disabled={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            <Download aria-hidden />
            {t('privacyData.export')}
          </Button>
          {exportData.data?.ok && (
            <p role="status" className="text-sm text-success">
              {t('privacyData.exported')}
            </p>
          )}
        </GlassCard>
        <GlassCard className="mt-3 divide-y divide-border p-0">
          <ListRow
            to="/profile/documents"
            icon={FileCheck2}
            label={t('signedDocs.title')}
            hint={t('signedDocs.hint')}
          />
          <ListRow
            to="/profile/moderation"
            icon={Gavel}
            label={t('moderationCenter.title')}
            hint={t('moderationCenter.hint')}
          />
          <ListRow to="/profile/sos" icon={Siren} label={t('sos.title')} hint={t('sos.hint')} />
        </GlassCard>
      </Section>
      <Section title={t('privacyData.requests')}>
        <GlassCard className="mb-3 space-y-3">
          {(['rectify', 'object', 'restrict'] as const).map((kind) => (
            <Button
              key={kind}
              block
              variant="outline"
              disabled={requestRight.isPending}
              onClick={() => requestRight.mutate(kind)}
            >
              {t(`privacyData.kinds.${kind}`)}
            </Button>
          ))}
          {requestRight.isSuccess && <p role="status">{t('privacyData.requestSent')}</p>}
        </GlassCard>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('privacyData.noRequests')}</p>
        ) : (
          <ul className="glass divide-y divide-border rounded-theme">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {t(`privacyData.kinds.${r.kind}`)} ·{' '}
                  {new Date(r.createdAt).toLocaleDateString(i18n.language)}
                </span>
                <span className={r.status === 'done' ? 'text-success' : 'text-warning'}>
                  {r.status === 'done'
                    ? t('privacyData.done')
                    : t('privacyData.dueOn', {
                        date: new Date(r.dueAt).toLocaleDateString(i18n.language),
                      })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('privacyData.sessions')}>
        <GlassCard className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('privacyData.logoutBody')}</p>
          <Button
            block
            variant="outline"
            disabled={logoutAll.isPending}
            onClick={() => logoutAll.mutate()}
          >
            <LogOut aria-hidden />
            {t('privacyData.logoutAll')}
          </Button>
          {logoutAll.isSuccess && (
            <p role="status" className="text-sm text-success">
              {t('privacyData.loggedOut')}
            </p>
          )}
        </GlassCard>
      </Section>
      <Section title={t('privacyData.deleteTitle')}>
        <GlassCard className="space-y-3 border-danger">
          <p className="text-sm text-muted-foreground">{t('privacyData.deleteBody')}</p>
          {!requestCode.isSuccess ? (
            <Button
              block
              variant="danger"
              disabled={requestCode.isPending}
              onClick={() => requestCode.mutate()}
            >
              <Trash2 aria-hidden />
              {t('privacyData.deleteStart')}
            </Button>
          ) : (
            <>
              <TextField
                label={t('privacyData.otpLabel')}
                hint={t('privacyData.otpHint')}
                error={wrongCode ? t('privacyData.wrongCode') : undefined}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
              <Button
                block
                variant="danger"
                disabled={otp.length !== 6 || deleteAccount.isPending}
                onClick={confirmDelete}
              >
                {t('privacyData.deleteConfirm')}
              </Button>
            </>
          )}
        </GlassCard>
      </Section>
      <div className="h-8" />
      {(exportData.isError ||
        requestRight.isError ||
        requestCode.isError ||
        deleteAccount.isError ||
        logoutAll.isError) && (
        <p role="alert" className="px-safe text-danger">
          {t('privacyData.failed')}
        </p>
      )}
    </>
  )
}
