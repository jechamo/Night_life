import { describe, expect, it } from 'vitest'
import { createMemoryPreferences } from '@/platform/preferences/preferences.memory'
import { createMockStore } from '../mock-store'
import { UNVERIFIED } from '@/features/verification/model/verification'
import { createWorldState } from './world-state'
import { createMockDashboardService } from './dashboard-service'
import { createMockMatchingService } from './social-services'

const origin = { lat: 40.42, lng: -3.7 }
function fixture() {
  const state = createWorldState()
  const store = createMockStore(createMemoryPreferences(), {
    verification: {
      ...UNVERIFIED,
      age: { state: 'verified', verifiedAt: new Date().toISOString() },
    },
  })
  return {
    state,
    dashboard: createMockDashboardService(state, store),
    matching: createMockMatchingService(state, () => Promise.resolve(), {
      unlimitedLikes: () => true,
      realtime: false,
    }),
  }
}

describe('dashboard semantics', () => {
  it('counts a read incoming message as pending, drops empty and removed conversations, and clears on reply', async () => {
    const { state, dashboard } = fixture()
    for (const m of state.messages) m.readAt = new Date().toISOString()
    expect((await dashboard.summary('Madrid', origin)).social).toMatchObject({
      pendingChats: 2,
      totalChats: 2,
    })
    state.messages.push({
      id: 'own-reply',
      matchId: state.matches[0]!.id,
      fromMe: true,
      text: 'Reply',
      sentAt: new Date().toISOString(),
      readAt: null,
    })
    expect((await dashboard.summary('Madrid', origin)).social).toMatchObject({
      pendingChats: 1,
      totalChats: 2,
    })
    state.matches.pop()
    expect((await dashboard.summary('Madrid', origin)).social).toMatchObject({
      pendingChats: 0,
      totalChats: 1,
      matches: 1,
    })
    state.messages = []
    expect((await dashboard.summary('Madrid', origin)).social).toMatchObject({
      totalChats: 0,
      matches: 1,
    })
  })

  it('keeps a like arriving after the snapshot new and makes repeated acknowledgments idempotent', async () => {
    const { state, dashboard, matching } = fixture()
    const newcomer = state.people.find(
      (p) => !p.likesMe && !state.matches.some((m) => m.person.id === p.id),
    )!
    const snapshot = await matching.likesSnapshot!()
    newcomer.likesMe = true
    await matching.markLikesSeen!(snapshot.snapshotId)
    await matching.markLikesSeen!(snapshot.snapshotId)
    expect((await dashboard.summary('Madrid', origin)).social?.newLikes).toBe(1)
    expect((await matching.likesYou()).length).toBe(snapshot.count + 1)
    await expect(matching.markLikesSeen!('foreign-token')).rejects.toThrow('invalid snapshot')
  })

  it('shows at most two sponsors, without duplicates, and keeps favorites across cities', async () => {
    const { state, dashboard } = fixture()
    state.places.forEach((p, i) => {
      p.city = 'Madrid'
      p.sponsored = i < 3
    })
    const elsewhere = [...state.places].reverse().find((p) => p.type !== 'event')!
    elsewhere.city = 'Barcelona'
    await dashboard.setFavorite(elsewhere.id, true)
    await dashboard.setFavorite(elsewhere.id, true)
    const home = await dashboard.summary('Madrid', origin)
    expect(home.nearby).toHaveLength(5)
    expect(home.nearby.filter((p) => p.sponsored)).toHaveLength(2)
    expect(new Set(home.nearby.map((p) => p.id)).size).toBe(5)
    expect(home.favoritesTotal).toBe(1)
    expect(home.favorites[0]?.id).toBe(elsewhere.id)
    await dashboard.setFavorite(elsewhere.id, false)
    await dashboard.setFavorite(elsewhere.id, false)
    expect((await dashboard.favorites(0)).total).toBe(0)
  })
})
