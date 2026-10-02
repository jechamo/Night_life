import { err, ok } from '@/shared/lib/result'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_INPUT_BYTES, type ImagesService } from './images'

const DEFAULT_MAX_SIDE = 1600
const QUALITY = 0.85

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

export function createWebImages(): ImagesService {
  return {
    async sanitize(file, { maxSide = DEFAULT_MAX_SIDE } = {}) {
      if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
        return err('unsupported_type')
      if (file.size > MAX_IMAGE_INPUT_BYTES) return err('too_large')
      try {
        // Drawing the decoded pixels onto a canvas keeps the image and nothing else.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(bitmap.width * scale)
        canvas.height = Math.round(bitmap.height * scale)
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        // Safari cannot encode WebP from a canvas: fall back to JPEG (still metadata-free).
        const blob =
          (await canvasToBlob(canvas, 'image/webp')) ?? (await canvasToBlob(canvas, 'image/jpeg'))
        return blob ? ok(blob) : err('decode_failed')
      } catch {
        return err('decode_failed')
      }
    },
    createPreviewUrl: (blob) => URL.createObjectURL(blob),
    revokePreviewUrl: (url) => URL.revokeObjectURL(url),
  }
}
