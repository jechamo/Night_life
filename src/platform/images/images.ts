import type { Result } from '@/shared/lib/result'

export type ImageError = 'unsupported_type' | 'too_large' | 'decode_failed'

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const MAX_IMAGE_INPUT_BYTES = 15 * 1024 * 1024

/**
 * Port for user images (PRD 6.15 API4/D): every photo is re-encoded on the device
 * before upload, which drops ALL metadata (EXIF, GPS of the user's home…), caps the
 * size and normalises the format. Native (Annex B) can use the camera plugin's own
 * resizing; callers do not change.
 */
export interface ImagesService {
  sanitize(file: Blob, options?: { maxSide?: number }): Promise<Result<Blob, ImageError>>
  createPreviewUrl(blob: Blob): string
  revokePreviewUrl(url: string): void
}
