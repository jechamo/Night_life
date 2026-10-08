import { useCallback, useMemo } from 'react'
import { usePlatform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { isInviteCode, normalizeInviteCode } from '../model/partners'

const KEY = PREFERENCE_KEYS.pendingVenueInvite
/** Same lifetime as the invitation itself: older entries are dropped. */
const MAX_AGE_MS = 7 * 86_400_000

/**
 * Roadmap R3: an invitation link opened before signing in is kept on this device so
 * sign-up or sign-in can continue to the redemption screen.
 */
export function usePendingInvite() {
  const { preferences } = usePlatform()
  return useMemo(
    () => ({
      async save(code: string) {
        if (!isInviteCode(code)) return
        await preferences.set(
          KEY,
          JSON.stringify({ code: normalizeInviteCode(code), savedAt: Date.now() }),
        )
      },
      async read(): Promise<string | null> {
        const raw = await preferences.get(KEY)
        if (!raw) return null
        try {
          const value = JSON.parse(raw) as { code?: unknown; savedAt?: unknown }
          if (
            typeof value.code === 'string' &&
            typeof value.savedAt === 'number' &&
            Date.now() - value.savedAt < MAX_AGE_MS &&
            isInviteCode(value.code)
          )
            return value.code
        } catch {
          // Corrupt entry: dropped below.
        }
        await preferences.remove(KEY)
        return null
      },
      clear: () => preferences.remove(KEY),
    }),
    [preferences],
  )
}

/** Where to go after sign-up or sign-in: the pending invitation, or home. */
export function usePostAuthPath() {
  const pending = usePendingInvite()
  const partners = useFeatureFlag('venue_partners_enabled') === 'on'
  return useCallback(
    async () => (partners && (await pending.read()) ? '/venue/invitacion' : '/home'),
    [partners, pending],
  )
}
