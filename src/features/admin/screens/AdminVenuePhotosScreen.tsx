import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PHOTO_STATUSES, type PhotoStatus } from '@/features/places/model/showcase'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { SegmentedControl } from '@/shared/ui/segmented-control'
import { TextField } from '@/shared/ui/text-field'
import { useAdminVenuePhotos, useReviewVenuePhoto } from '../hooks/use-admin'
import type { AdminVenuePhoto } from '../services/admin-service'

function PhotoReview({ photo }: { photo: AdminVenuePhoto }) {
  const { t, i18n } = useTranslation()
  const review = useReviewVenuePhoto()
  const [reason, setReason] = useState('')
  const reasonOk = reason.trim().length >= 3 && reason.trim().length <= 200
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <GlassCard
      className="space-y-3"
      role="region"
      aria-label={t('admin.venuePhotos.alt', { venue: photo.venueName })}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-theme bg-surface-raised">
        <img
          src={photo.url}
          alt={t('admin.venuePhotos.alt', { venue: photo.venueName })}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {photo.venueName}
          {photo.city && ` · ${photo.city}`}
        </p>
        {photo.isCover && <Badge>{t('admin.venuePhotos.cover')}</Badge>}
        {photo.isTest && <Badge tone="unconfirmed">{t('admin.venuePhotos.test')}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">{date.format(new Date(photo.createdAt))}</p>
      {photo.reason && (
        <p className="text-sm text-muted-foreground">
          {t('admin.venuePhotos.reason', { reason: photo.reason })}
        </p>
      )}
      {photo.status !== 'approved' && (
        <Button
          block
          disabled={review.isPending}
          onClick={() => review.mutate({ photoId: photo.id, approve: true })}
        >
          <Check aria-hidden />
          {t('admin.venuePhotos.approve')}
        </Button>
      )}
      {photo.status !== 'rejected' && (
        <div className="space-y-2">
          <TextField
            label={t('admin.venuePhotos.reasonLabel')}
            hint={t('admin.venuePhotos.reasonHint')}
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            block
            variant="outline"
            disabled={!reasonOk || review.isPending}
            onClick={() =>
              review.mutate({ photoId: photo.id, approve: false, reason: reason.trim() })
            }
          >
            <X aria-hidden />
            {photo.status === 'approved'
              ? t('admin.venuePhotos.withdraw')
              : t('admin.venuePhotos.reject')}
          </Button>
        </div>
      )}
    </GlassCard>
  )
}

/** Roadmap R4: venue photos are only shown in the app once an admin approves them. */
export function AdminVenuePhotosScreen() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<PhotoStatus>('pending')
  const { data: photos, isPending } = useAdminVenuePhotos(status)
  return (
    <>
      <ScreenHeader
        title={t('admin.venuePhotos.title')}
        description={t('admin.venuePhotos.body')}
      />
      <Section title={t('admin.nav.venuePhotos')}>
        <div className="space-y-4">
          <SegmentedControl
            label={t('admin.venuePhotos.filter')}
            value={status}
            onChange={setStatus}
            options={PHOTO_STATUSES.map((value) => ({
              value,
              label: t(`admin.venuePhotos.status.${value}`),
            }))}
          />
          {!isPending && photos?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('admin.venuePhotos.empty')}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {photos?.map((photo) => (
              <PhotoReview key={photo.id} photo={photo} />
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}
