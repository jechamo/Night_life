import { err, ok } from '@/shared/lib/result'
import type { ShareService } from './share'

export function createWebShare(): ShareService {
  return {
    async share(payload) {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share(payload)
          return ok('shared')
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return ok('cancelled')
          // Fall through to the clipboard on any other failure.
        }
      }
      const text = payload.url ?? payload.text
      if (!text || !navigator.clipboard) return err('unsupported')
      try {
        await navigator.clipboard.writeText(text)
        return ok('copied')
      } catch {
        return err('failed')
      }
    },
  }
}
