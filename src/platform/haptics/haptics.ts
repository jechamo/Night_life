export type ImpactStyle = 'light' | 'medium' | 'heavy'
export type NotificationFeedback = 'success' | 'warning' | 'error'

/**
 * Port for haptic feedback (e.g. crossing the swipe threshold, PRD 6.6.1).
 * Vibration is native-only in the PRD (excluded from the web MVP), so the web
 * implementation is a no-op and callers never need to branch on platform.
 */
export interface HapticsService {
  readonly isSupported: boolean
  impact(style: ImpactStyle): void
  notify(type: NotificationFeedback): void
  selection(): void
}
