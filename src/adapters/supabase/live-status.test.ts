import { describe, expect, it, vi } from 'vitest'
import type { Db } from './client'
import { createVenuePanelService } from './business'
import { createPlacesService } from './places'

const payload = {
  windowMinutes: 90,
  minVotes: 3,
  crowd: { total: 3, counts: { busy: 3 } },
  queue: { total: 0, counts: null },
  music_like: { total: 0, counts: null },
  music_genre: { total: 0, counts: null },
  mine: { crowd: 'busy' },
  declared: null,
  usually: null,
}

const dbWith = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as Db

describe('roadmap R2: Supabase live status adapter', () => {
  it('reads and reports through the RPCs with the expected arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null })
    const places = createPlacesService(dbWith(rpc))
    const status = await places.liveStatus('v1')
    expect(rpc).toHaveBeenCalledWith('place_live_status', { p_place: 'v1' })
    expect(status.tallies.crowd.counts).toEqual({ busy: 3 })
    const result = await places.reportLiveStatus('v1', 'crowd', 'busy')
    expect(rpc).toHaveBeenLastCalledWith('report_place_status', {
      p_place: 'v1',
      p_dimension: 'crowd',
      p_value: 'busy',
    })
    expect(result.ok && result.value.mine.crowd).toBe('busy')
  })

  it('maps the server refusals and rethrows anything else', async () => {
    const refuse = (message: string) =>
      createPlacesService(
        dbWith(vi.fn().mockResolvedValue({ data: null, error: { message, code: '22023' } })),
      )
    expect(await refuse('no_check_in').reportLiveStatus('v1', 'queue', 'long')).toEqual({
      ok: false,
      error: 'no_check_in',
    })
    expect(await refuse('own_venue').reportLiveStatus('v1', 'queue', 'long')).toEqual({
      ok: false,
      error: 'own_venue',
    })
    await expect(refuse('disabled').reportLiveStatus('v1', 'queue', 'long')).rejects.toThrow(
      'disabled',
    )
    await expect(refuse('disabled').liveStatus('v1')).rejects.toThrow('disabled')
  })

  it('the venue declares its music through venue_set_music', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: payload, error: null })
    const panel = createVenuePanelService(dbWith(rpc))
    await panel.setMusic('v1', ['techno', 'house'], 'DJ Uno')
    expect(rpc).toHaveBeenCalledWith('venue_set_music', {
      p_venue: 'v1',
      p_genres: ['techno', 'house'],
      p_lineup: 'DJ Uno',
    })
  })
})
