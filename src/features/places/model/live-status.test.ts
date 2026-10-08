import { describe, expect, it } from 'vitest'
import { parseLiveStatus, topAnswer } from './live-status'

describe('roadmap R2: live status model', () => {
  it('keeps counts hidden below the server minimum and drops unknown answers', () => {
    const status = parseLiveStatus({
      windowMinutes: 90,
      minVotes: 3,
      crowd: { total: 5, counts: { busy: 2, packed: 3, hacked: 9 } },
      queue: { total: 2, counts: null },
      music_like: { total: 0, counts: null },
      music_genre: { total: 4, counts: { techno: 3, '<script>': 1 } },
      mine: { crowd: 'packed', queue: 'nope' },
      declared: { genres: ['techno', 'jazz-fusion'], lineup: 'DJ Uno' },
      usually: 'busy',
    })
    expect(status.tallies.crowd.counts).toEqual({ busy: 2, packed: 3 })
    expect(status.tallies.queue.counts).toBeNull()
    expect(status.tallies.music_genre.counts).toEqual({ techno: 3 })
    expect(status.mine).toEqual({ crowd: 'packed' })
    expect(status.declared).toEqual({ genres: ['techno'], lineup: 'DJ Uno' })
    expect(status.usually).toBe('busy')
  })

  it('tolerates an empty or malformed payload', () => {
    const status = parseLiveStatus(null)
    expect(status.windowMinutes).toBe(90)
    expect(status.tallies.crowd).toEqual({ total: 0, counts: null })
    expect(status.declared).toBeNull()
    expect(status.usually).toBeNull()
    expect(parseLiveStatus({ usually: 'invented' }).usually).toBeNull()
  })

  it('topAnswer returns the most voted answer with its share, or null', () => {
    expect(topAnswer({ total: 10, counts: { busy: 4, packed: 6 } })).toEqual({
      value: 'packed',
      percent: 60,
    })
    expect(topAnswer({ total: 2, counts: null })).toBeNull()
    expect(topAnswer({ total: 0, counts: {} })).toBeNull()
  })
})
