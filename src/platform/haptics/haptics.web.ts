import type { HapticsService } from './haptics'

export function createWebHaptics(): HapticsService {
  const noop = () => undefined
  return { isSupported: false, impact: noop, notify: noop, selection: noop }
}
