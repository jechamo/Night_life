import type { Result } from '@/shared/lib/result'

export type CameraError = 'permission_denied' | 'unavailable' | 'cancelled' | 'unsupported'
export type CameraFacing = 'user' | 'environment'

export interface LiveCameraStream {
  stream: MediaStream
  stop(): void
}

/**
 * Port for the camera: profile photos and the live selfie of "Foto verificada"
 * (PRD 6.2). Images are processed and discarded; nothing is persisted here.
 */
export interface CameraService {
  pickPhoto(source: 'camera' | 'gallery'): Promise<Result<File, CameraError>>
  openLiveStream(facing: CameraFacing): Promise<Result<LiveCameraStream, CameraError>>
}
