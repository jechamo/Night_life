import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { Button } from '@/shared/ui/button'
import type { Invitation } from '../model/partners'

/**
 * A just-created invitation. The code is only returned once by the server, so it is shown
 * here and shared through the platform share sheet (or copied when there is none).
 */
export function InvitationNotice({ invitation, body }: { invitation: Invitation; body: string }) {
  const { t, i18n } = useTranslation()
  const { share, deepLinks } = usePlatform()
  const [copied, setCopied] = useState(false)
  const link = deepLinks.buildReturnUrl(`/invitacion/${encodeURIComponent(invitation.code)}`)
  return (
    <div
      role="status"
      className="space-y-2 rounded-2xl border border-success bg-surface p-3 text-sm"
    >
      <p>{body}</p>
      <p className="font-label text-lg tracking-widest">
        {t('admin.partners.invitation.code', { code: invitation.code })}
      </p>
      <p className="text-xs text-muted-foreground">
        {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
          new Date(invitation.expiresAt),
        )}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          void share
            .share({ title: t('venuePanel.partners.landing.title'), url: link })
            .then((result) => setCopied(result.ok && result.value === 'copied'))
        }
      >
        <Share2 aria-hidden />
        {t('admin.partners.invitation.copy')}
      </Button>
      {copied && <p className="text-xs text-success">{t('admin.partners.invitation.copied')}</p>}
    </div>
  )
}
