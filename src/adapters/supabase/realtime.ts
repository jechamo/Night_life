import type { RealtimeChannel } from '@supabase/supabase-js'
import type { RealtimeEvent, RealtimeService } from '@/shared/realtime/realtime'
import type { Db } from './client'
import { currentUserId } from './client'
import { asText } from './errors'
import { asStats } from './places'

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
 * registered accounts. Matching/chat events stay simulated until Block 8 and are merged
 * by the composition root.
 */
export function createRealtimeService(db: Db): RealtimeService {
  return {
    subscribe(handler: (event: RealtimeEvent) => void) {
      let active = true
      const channels: RealtimeChannel[] = []
      const join = (topic: string) => {
        const channel = db
          .channel(topic, { config: { private: true } })
          .on('broadcast', { event: 'stats' }, ({ payload }: { payload: unknown }) => {
            if (!active || payload === null || typeof payload !== 'object') return
            const body = payload as Record<string, unknown>
            const placeId = asText(body.placeId)
            if (!placeId || body.stats === null || typeof body.stats !== 'object') return
            handler({
              type: 'stats',
              placeId,
              stats: asStats(body.stats as Record<string, unknown>),
            })
          })
          .subscribe()
        channels.push(channel)
      }
      void (async () => {
        await db.realtime.setAuth()
        if (!active) return
        join(LIVE_TOPIC)
        if ((await seesTestData(db)) && active) join(TEST_TOPIC)
      })().catch(() => {})
      return () => {
        active = false
        for (const channel of channels) void db.removeChannel(channel)
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
