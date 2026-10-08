import { err, ok } from '@/shared/lib/result'
import type { CameraService } from './camera'

/** Chromium/Android expose `BarcodeDetector`; iOS Safari does not (the door types the code). */
interface QrDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type QrDetectorClass = new (options: { formats: string[] }) => QrDetector

const detectorClass = (): QrDetectorClass | undefined =>
  (globalThis as { BarcodeDetector?: QrDetectorClass }).BarcodeDetector

export function createWebCamera(): CameraService {
  return {
    pickPhoto(source) {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/jpeg,image/png,image/webp,image/avif'
        if (source === 'camera') input.capture = 'user'
        input.addEventListener('change', () => {
          const file = input.files?.[0]
          resolve(file ? ok(file) : err('cancelled'))
        })
        input.addEventListener('cancel', () => resolve(err('cancelled')))
        input.click()
      })
    },

    async openLiveStream(facing) {
      if (!navigator.mediaDevices?.getUserMedia) return err('unsupported')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        return ok({ stream, stop: () => stream.getTracks().forEach((track) => track.stop()) })
      } catch (error) {
        const name = error instanceof DOMException ? error.name : ''
        return err(name === 'NotAllowedError' ? 'permission_denied' : 'unavailable')
      }
    },
    canDetectQr: () => detectorClass() !== undefined,
    async detectQr(video) {
      const Detector = detectorClass()
      if (!Detector) return null
      try {
        const codes = await new Detector({ formats: ['qr_code'] }).detect(video)
        return codes[0]?.rawValue ?? null
      } catch {
        return null
      }
    },
  }
}
