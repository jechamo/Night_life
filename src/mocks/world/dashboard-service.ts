import type { DashboardService } from '@/features/home/services/dashboard-service'
import { distanceMeters } from '@/features/places/model/geo'
import type { MockStore } from '../mock-store'
import type { WorldState } from './world-state'

export function createMockDashboardService(state: WorldState, store: MockStore): DashboardService {
  return {
    async summary(city, origin) {
      const places = state.places.filter((p) => p.type !== 'event' && (!p.city || p.city === city))
      const distance = (a: (typeof places)[number], b: (typeof places)[number]) =>
        distanceMeters(origin, a.location) - distanceMeters(origin, b.location)
      const promoted = places
        .filter((p) => p.sponsored)
        .sort(distance)
        .slice(0, 2)
      const conversations = state.matches
        .map((m) =>
          state.messages
            .filter((x) => x.matchId === m.id)
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
            .at(0),
        )
        .filter((x) => x != null)
      const favorites = state.places.filter((p) => p.favorite && p.type !== 'event')
      const verified = (await store.read()).verification.age.state === 'verified'
      return {
        nearby: [
          ...promoted,
          ...places
            .filter((p) => !p.sponsored)
            .sort(distance)
            .slice(0, 5 - promoted.length),
        ],
        tonight: places
          .filter((p) => p.stats.goingTonight > 0)
          .sort((a, b) => b.stats.goingTonight - a.stats.goingTonight)
          .slice(0, 3),
        now: places
          .filter((p) => p.stats.people > 0)
          .sort((a, b) => b.stats.people - a.stats.people)
          .slice(0, 3),
        favorites: favorites.slice(0, 4),
        favoritesTotal: favorites.length,
        social: verified
          ? {
              newLikes: state.people.filter(
                (p) =>
                  p.likesMe &&
                  !state.likesSeen.has(p.id) &&
                  !state.blocked.has(p.id) &&
                  !state.matches.some((m) => m.person.id === p.id),
              ).length,
              pendingChats: conversations.filter((m) => !m.fromMe).length,
              totalChats: conversations.length,
              matches: state.matches.length,
            }
          : null,
      }
    },
    favorites: (offset) => {
      const places = state.places.filter((p) => p.favorite)
      return Promise.resolve({ places: places.slice(offset, offset + 50), total: places.length })
    },
    setFavorite: (id, saved) => {
      state.places = state.places.map((p) => (p.id === id ? { ...p, favorite: saved } : p))
      return Promise.resolve()
    },
  }
}
