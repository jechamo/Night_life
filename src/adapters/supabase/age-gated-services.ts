import { isAgeVerified } from '@/features/verification/model/verification'
import type { VerificationService } from '@/features/verification/services/verification-service'
import type { AppServices } from '@/shared/services/services'

/**
 * Blocks 7–8 still use preview services. Every sensitive operation must recheck
 * persisted verification, even when called directly without a screen guard.
 * Supabase RLS independently enforces access to actual social rows.
 */
export function withPersistedAgeGate(
  base: AppServices,
  verification: VerificationService,
): Pick<AppServices, 'matching' | 'chat' | 'attendance' | 'places' | 'premium' | 'realtime'> {
  const requireVerified = async () => {
    if (!isAgeVerified(await verification.getSnapshot())) throw new Error('not_verified')
  }
  const guarded =
    <Args extends unknown[], T>(fn: (...args: Args) => Promise<T>) =>
    async (...args: Args): Promise<T> => {
      await requireVerified()
      return fn(...args)
    }
  return {
    matching: {
      ...base.matching,
      candidates: guarded(base.matching.candidates.bind(base.matching)),
      like: guarded(base.matching.like.bind(base.matching)),
      pass: guarded(base.matching.pass.bind(base.matching)),
      undo: guarded(base.matching.undo.bind(base.matching)),
      likesYou: guarded(base.matching.likesYou.bind(base.matching)),
      matches: guarded(base.matching.matches.bind(base.matching)),
      person: guarded(base.matching.person.bind(base.matching)),
    },
    chat: {
      ...base.chat,
      summaries: guarded(base.chat.summaries.bind(base.chat)),
      messages: guarded(base.chat.messages.bind(base.chat)),
      send: guarded(base.chat.send.bind(base.chat)),
      markRead: guarded(base.chat.markRead.bind(base.chat)),
      setTyping(matchId, typing) {
        void requireVerified()
          .then(() => base.chat.setTyping(matchId, typing))
          .catch(() => {})
      },
    },
    attendance: {
      ...base.attendance,
      setGoing: guarded(base.attendance.setGoing.bind(base.attendance)),
      async checkIn(placeId, position, options) {
        if (options.visible) await requireVerified()
        return base.attendance.checkIn(placeId, position, options)
      },
    },
    places: { ...base.places, createEvent: guarded(base.places.createEvent.bind(base.places)) },
    premium: { ...base.premium, sendPaidDm: guarded(base.premium.sendPaidDm.bind(base.premium)) },
    realtime: {
      subscribe(handler) {
        let active = true
        const unsubscribe = base.realtime.subscribe((event) => {
          if (event.type === 'stats') {
            handler(event)
            return
          }
          void requireVerified()
            .then(() => {
              if (active) handler(event)
            })
            .catch(() => {})
        })
        return () => {
          active = false
          unsubscribe()
        }
      },
    },
  }
}
