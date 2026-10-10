import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import type { HapticsService } from './haptics'

const IMPACT = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
const NOTIFY = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
}

/** Fire-and-forget: feedback must never block or break a gesture. */
export function createNativeHaptics(): HapticsService {
  const safe = (run: () => Promise<void>) => void run().catch(() => undefined)
  return {
    isSupported: true,
    impact: (style) => safe(() => Haptics.impact({ style: IMPACT[style] })),
    notify: (type) => safe(() => Haptics.notification({ type: NOTIFY[type] })),
    selection: () =>
      safe(async () => {
        await Haptics.selectionStart()
        await Haptics.selectionChanged()
        await Haptics.selectionEnd()
      }),
  }
}
