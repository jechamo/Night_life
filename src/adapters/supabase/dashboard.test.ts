import { describe, expect, it, vi } from 'vitest'
import { createDashboardService } from './dashboard'
import { createPlacesService } from './places'
import type { Db } from './client'

const venue = {
  id: 'v1',
  name: 'Local',
  type: 'club',
  lat: 40.4,
  lng: -3.7,
  favorite: true,
  sponsored: true,
}
const data = {
  nearby: [venue],
  tonight: [],
  now: [],
  favorites: [venue],
  favoritesTotal: 360,
  social: { newLikes: 1200, pendingChats: 210, totalChats: 400, matches: 520 },
}
function backend(value: unknown, error: unknown = null) {
  const rpc = vi
    .fn<(name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>>()
    .mockResolvedValue({ data: value, error })
  return { rpc, db: { rpc } as unknown as Db }
}

describe('map-free server adapter', () => {
  it('retains full server totals and only calls the aggregated endpoint', async () => {
    const { db, rpc } = backend(data)
    const result = await createDashboardService(db).summary('Madrid', { lat: 40.4, lng: -3.7 })
    expect(result.social?.newLikes).toBe(1200)
    expect(result.social?.totalChats).toBe(400)
    expect(result.favoritesTotal).toBe(360)
    expect(result.nearby[0]).toMatchObject({ favorite: true, sponsored: true })
    expect(rpc.mock.calls).toEqual([
      ['home_summary', { p_city: 'Madrid', p_lat: 40.4, p_lng: -3.7 }],
    ])
  })
  it('preserves a restricted social metric instead of replacing it with zero', async () => {
    const { db } = backend({ ...data, social: null })
    expect(
      (await createDashboardService(db).summary('Madrid', { lat: 40.4, lng: -3.7 })).social,
    ).toBeNull()
  })
  it('propagates backend failure without falling back to incomplete list totals', async () => {
    const { db } = backend(null, new Error('offline'))
    await expect(
      createDashboardService(db).summary('Madrid', { lat: 40.4, lng: -3.7 }),
    ).rejects.toThrow('offline')
  })
  it('loads favorites by page with full totals and sends explicit desired state', async () => {
    const { db, rpc } = backend({ places: [venue], total: 360 })
    expect((await createDashboardService(db).favorites(100)).total).toBe(360)
    await createDashboardService(db).setFavorite('v1', false)
    expect(rpc.mock.calls).toEqual([
      ['favorites_list', { p_offset: 100 }],
      ['favorite_set', { p_place: 'v1', p_saved: false }],
    ])
  })
  it.each([true, false])(
    'accepts the empty response of a successful favorite write (%s)',
    async (saved) => {
      const { db, rpc } = backend(null)
      await expect(createDashboardService(db).setFavorite('v1', saved)).resolves.toBeUndefined()
      expect(rpc).toHaveBeenCalledWith('favorite_set', { p_place: 'v1', p_saved: saved })
    },
  )
  it('still rejects failed favorite writes', async () => {
    const error = { code: '54000', message: 'rate limited' }
    const { db } = backend(null, error)
    await expect(createDashboardService(db).setFavorite('v1', true)).rejects.toEqual(error)
  })
  it('loads a place by ID, and represents a missing or hidden venue as unavailable', async () => {
    const { db, rpc } = backend(venue)
    expect((await createPlacesService(db).getById('v1'))?.id).toBe('v1')
    expect(rpc.mock.calls).toEqual([['place_detail', { p_place: 'v1' }]])
    const absent = backend(null)
    expect(await createPlacesService(absent.db).getById('hidden')).toBeNull()
  })
})
