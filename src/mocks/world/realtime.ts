import type { RealtimeService } from '@/shared/realtime/realtime'
import { emit, type WorldState } from './world-state'

/**
 * Fake realtime: stats breathe every few seconds and "new people" notices appear,
 * so live counters, the heatmap and notices can be tested without a backend.
 * Timers only run while someone is subscribed.
 */
export function createMockRealtime(state: WorldState, enabled: boolean): RealtimeService {
  let timers: ReturnType<typeof setInterval>[] = []
  const start = () => {
    timers = [
      setInterval(() => {
        const busy = state.places.filter((p) => p.stats.people > 0)
        const place = busy[Math.floor(Math.random() * busy.length)]
        if (!place) return
        const delta = Math.round(Math.random() * 6) - 2
        const people = Math.max(0, place.stats.people + delta)
        const stats = { ...place.stats, people }
        state.places = state.places.map((p) => (p.id === place.id ? { ...p, stats } : p))
        emit(state, { type: 'stats', placeId: place.id, stats })
      }, 6000),
      setInterval(() => {
        const target = state.attendance.checkIn?.placeId ?? state.places[0]?.id
        if (target)
          emit(state, {
            type: 'new_people',
            placeId: target,
            count: 1 + Math.floor(Math.random() * 3),
          })
      }, 25000),
    ]
  }
  return {
    subscribe(handler) {
      state.listeners.add(handler)
      if (enabled && timers.length === 0) start()
      return () => {
        state.listeners.delete(handler)
        if (state.listeners.size === 0) {
          timers.forEach(clearInterval)
          timers = []
        }
      }
    },
  }
}
