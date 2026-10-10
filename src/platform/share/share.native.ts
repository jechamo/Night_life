import { Share } from '@capacitor/share'
import { err, ok } from '@/shared/lib/result'
import { isCancellation } from '../native-errors'
import type { ShareService } from './share'

export function createNativeShare(): ShareService {
  return {
    async share({ title, text, url }) {
      try {
        await Share.share({ title, text, url, dialogTitle: title })
        return ok('shared')
      } catch (error) {
        return isCancellation(error) ? ok('cancelled') : err('failed')
      }
    },
  }
}
