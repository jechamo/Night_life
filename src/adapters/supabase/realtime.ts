import { REALTIME_SUBSCRIBE_STATES, type RealtimeChannel } from '@supabase/supabase-js'
import { z } from 'zod'
import type { RealtimeEvent, RealtimeService } from '@/shared/realtime/realtime'
import type { Db } from './client'
import { currentUserId } from './client'
import { asText } from './errors'
import { asStats } from './places'
import { createMatchingService } from './social'

const LIVE_TOPIC = 'place-stats:live'
/** Fixture venues broadcast on their own private topic, readable only by testers/admins. */
const TEST_TOPIC = 'place-stats:test'

async function seesTestData(db: Db): Promise<boolean> {
  const uid = await currentUserId(db)
  if (!uid) return false
  const { data } = await db.from('user_roles').select('role').eq('user_id', uid)
  return (data ?? []).some((r) => r.role === 'tester' || r.role === 'admin')
}

/**
 * Place stats over private Realtime Broadcast (Block 7). Payloads are aggregated and
 * thresholded in the database (`recalc_place_stats`); the topic policy only admits
 * registered accounts. Social inboxes only carry identifiers; RPCs re-authorize reads.
 */
export function createRealtimeService(db: Db): RealtimeService {
  return {
    subscribe(handler: (event: RealtimeEvent) => void) {
      let active = true
      let generation = 0
      const channels: RealtimeChannel[] = []
      const clear = () => {
        for (const channel of channels.splice(0)) void db.removeChannel(channel)
      }
      const join = (topic: string, social = false) => {
        const joinedGeneration = generation
        const current = () => active && generation === joinedGeneration
        const channel = db
          .channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'stats' }, ({ payload }: { payload: unknown }) => {
            if (!current() || social || payload === null || typeof payload !== 'object') return
            const body = payload as Record<string, unknown>
            const placeId = asText(body.placeId)
            if (!placeId || body.stats === null || typeof body.stats !== 'object') return
            handler({
              type: 'stats',
              placeId,
              stats: asStats(body.stats as Record<string, unknown>),
            })
          })
        if (social) {
          const matchId = z.object({ matchId: z.uuid() })
          const event = (name: string, type: 'messages_changed' | 'read' | 'removed') => {
            channel.on('broadcast', { event: name }, ({ payload }: { payload: unknown }) => {
              const parsed = matchId.safeParse(payload)
              if (current() && parsed.success) handler({ type, matchId: parsed.data.matchId })
            })
          }
          event('message', 'messages_changed')
          event('read', 'read')
          event('removed', 'removed')
          channel.on('broadcast', { event: 'refresh' }, () => {
            if (current()) handler({ type: 'refresh' })
          })
          channel.on('broadcast', { event: 'home' }, () => {
            if (current()) handler({ type: 'dashboard_changed' })
          })
          channel.on('broadcast', { event: 'typing' }, ({ payload }: { payload: unknown }) => {
            const parsed = matchId.extend({ typing: z.boolean() }).safeParse(payload)
            if (current() && parsed.success) handler({ type: 'typing', ...parsed.data })
          })
          channel.on('broadcast', { event: 'match' }, ({ payload }: { payload: unknown }) => {
            const parsed = matchId.safeParse(payload)
            if (!current() || !parsed.success) return
            void createMatchingService(db)
              .matches()
              .then((matches) => {
                const match = matches.find((m) => m.id === parsed.data.matchId)
                if (current() && match) handler({ type: 'match', match })
              })
              .catch(() => {})
          })
        }
        channel.subscribe((status) => {
          if (current() && social && status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED)
            handler({ type: 'refresh' })
        })
        channels.push(channel)
      }
      const connect = async (uid: string | undefined, token: string | undefined) => {
        const ownGeneration = ++generation
        clear()
        if (!uid || !token) return
        await db.realtime.setAuth(token)
        if (!active || ownGeneration !== generation) return
        join(LIVE_TOPIC)
        join(`social:${uid}`, true)
        if ((await seesTestData(db)) && active && ownGeneration === generation) join(TEST_TOPIC)
      }
      const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
        queueMicrotask(() => {
          if (active) void connect(session?.user.id, session?.access_token).catch(() => {})
        })
      })
      void db.auth.getSession().then(({ data }) => {
        if (active && generation === 0)
          void connect(data.session?.user.id, data.session?.access_token).catch(() => {})
      })
      return () => {
        active = false
        generation++
        listener.subscription.unsubscribe()
        clear()
      }
    },
  }
}

/**
 * Real place stats plus the simulated match/chat events (Block 8). Simulated place
 * events are dropped: they refer to the illustrated world, not to the real catalogue.
 */
export function mergeRealtime(real: RealtimeService, simulated: RealtimeService): RealtimeService {
  return {
    subscribe(handler) {
      const offReal = real.subscribe(handler)
      const offSimulated = simulated.subscribe((event) => {
        if (event.type !== 'stats' && event.type !== 'new_people') handler(event)
      })
      return () => {
        offReal()
        offSimulated()
      }
    },
  }
}
