import { ImagePlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform, type ImageError } from '@/platform'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'

export const MIN_PHOTOS = 2
export const MAX_PHOTOS = 5

interface PhotoItem {
  id: string
  blob: Blob
  url: string
}

/**
 * 2-5 profile photos (PRD 5.2.6). Every photo is re-encoded on the device by the
 * platform layer, which strips EXIF/GPS before it ever leaves the phone.
 */
export function PhotoPicker({
  initial,
  onChange,
  error,
}: {
  initial: readonly Blob[]
  onChange: (photos: Blob[]) => void
  error?: string
}) {
  const { t } = useTranslation()
  const { camera, images } = usePlatform()
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initial.map((blob) => ({ id: crypto.randomUUID(), blob, url: images.createPreviewUrl(blob) })),
  )
  const [photoError, setPhotoError] = useState<ImageError | null>(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Release preview URLs when leaving the step.
  useEffect(
    () => () => itemsRef.current.forEach((item) => images.revokePreviewUrl(item.url)),
    [images],
  )

  const update = (next: PhotoItem[]) => {
    setItems(next)
    onChange(next.map((item) => item.blob))
  }

  const add = async () => {
    setPhotoError(null)
    const picked = await camera.pickPhoto('gallery')
    if (!picked.ok) return
    const clean = await images.sanitize(picked.value)
    if (!clean.ok) return setPhotoError(clean.error)
    update([
      ...items,
      { id: crypto.randomUUID(), blob: clean.value, url: images.createPreviewUrl(clean.value) },
    ])
  }

  const remove = (id: string) => {
    const target = items.find((item) => item.id === id)
    if (target) images.revokePreviewUrl(target.url)
    update(items.filter((item) => item.id !== id))
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('onboarding.profile.photos')}</legend>
      <p className="text-sm text-muted-foreground">{t('onboarding.profile.photosHint')}</p>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-raised"
          >
            <img
              src={item.url}
              alt={t('onboarding.profile.photoAlt', { n: index + 1 })}
              className="size-full object-cover"
            />
            {index === 0 && (
              <span className="font-label absolute bottom-1.5 left-1.5 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                {t('onboarding.profile.mainPhoto')}
              </span>
            )}
            <Button
              variant="glass"
              size="icon"
              className="absolute top-1 right-1"
              aria-label={t('onboarding.profile.removePhoto', { n: index + 1 })}
              onClick={() => remove(item.id)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
        {items.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              onClick={() => void add()}
              className={cn(
                'flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-sm text-muted-foreground transition-opacity active:opacity-70',
                error ? 'border-danger' : 'border-border',
              )}
            >
              <ImagePlus className="size-6 text-primary" aria-hidden />
              {t('onboarding.profile.addPhoto')}
            </button>
          </li>
        )}
      </ul>
      {(photoError || error) && (
        <p role="alert" className="text-sm text-danger">
          {photoError ? t(`onboarding.profile.photoErrors.${photoError}`) : error}
        </p>
      )}
    </fieldset>
  )
}
