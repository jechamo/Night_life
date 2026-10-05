import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRefreshThrottle } from './refresh-throttle'

afterEach(() => vi.useRealTimers())
describe('aggregate refresh under venue bursts', () => {
  it('limits sustained venue activity and still refreshes the last update', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const queue = createRefreshThrottle(refresh, 8000)
    for (let i = 0; i < 25; i++) {
      queue.request()
      vi.advanceTimersByTime(1000)
    }
    expect(refresh).toHaveBeenCalledTimes(4)
    vi.runAllTimers()
    expect(refresh).toHaveBeenCalledTimes(5)
    queue.cancel()
  })
  it('drops a pending refresh when its session subscription is disposed', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const queue = createRefreshThrottle(refresh, 8000)
    queue.request()
    queue.request()
    queue.cancel()
    vi.runAllTimers()
    queue.request()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
