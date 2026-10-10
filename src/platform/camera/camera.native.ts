import { Camera, CameraDirection, MediaTypeSelection, type MediaResult } from '@capacitor/camera'
import { err, ok, type Result } from '@/shared/lib/result'
import { isCancellation, isPermissionDenial } from '../native-errors'
import { createWebCamera } from './camera.web'
import type { CameraError, CameraService } from './camera'

async function toFile(media: MediaResult | undefined): Promise<Result<File, CameraError>> {
  if (!media?.webPath) return err('cancelled')
  try {
    // `webPath` is served by the WebView itself; the bytes never leave the device here.
    const blob = await (await fetch(media.webPath)).blob()
    const type = blob.type || 'image/jpeg'
    return ok(new File([blob], `photo.${type === 'image/png' ? 'png' : 'jpg'}`, { type }))
  } catch {
    return err('unavailable')
  }
}

const toError = (error: unknown): CameraError => {
  if (isCancellation(error)) return 'cancelled'
  if (isPermissionDenial(error)) return 'permission_denied'
  return 'unavailable'
}

/**
 * Photos come from the system camera/gallery. Metadata is not requested and the
 * images port re-encodes every file anyway (PRD 6.15 API4). The live selfie and the
 * QR reader keep using the WebView media APIs (Capacitor grants the camera permission).
 */
export function createNativeCamera(): CameraService {
  const web = createWebCamera()
  return {
    async pickPhoto(source) {
      try {
        if (source === 'camera') {
          return await toFile(
            await Camera.takePhoto({
              quality: 90,
              correctOrientation: true,
              saveToGallery: false,
              cameraDirection: CameraDirection.Front,
              includeMetadata: false,
            }),
          )
        }
        const { results } = await Camera.chooseFromGallery({
          mediaType: MediaTypeSelection.Photo,
          allowMultipleSelection: false,
          limit: 1,
          includeMetadata: false,
        })
        return await toFile(results[0])
      } catch (error) {
        return err(toError(error))
      }
    },
    openLiveStream: (facing) => web.openLiveStream(facing),
    canDetectQr: () => web.canDetectQr(),
    detectQr: (video) => web.detectQr(video),
  }
}
