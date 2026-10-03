import { err, ok } from '@/shared/lib/result'
import type { AudioService } from './audio'

/** User-initiated, local synthesized test sample. Never loads third-party audio. */
export function createWebAudio(): AudioService {
  let player: HTMLAudioElement | null = null
  const stop = () => {
    player?.pause()
    player = null
  }
  return {
    stop,
    async playTestSample() {
      stop()
      try {
        player = new Audio('/audio/test-anthem.wav')
        await player.play()
        return ok(undefined)
      } catch {
        stop()
        return err('failed')
      }
    },
  }
}
