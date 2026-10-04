import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebAppUpdates } from './app-updates.web'

describe('PWA update lifecycle', () => {
  const update = vi.fn<() => Promise<void>>()
  const register = vi.fn<() => Promise<{ update: typeof update }>>()
  const reload = vi.fn()
  let worker: EventTarget & { controller: object | null; register: typeof register }
  let online: boolean
  let service: ReturnType<typeof createWebAppUpdates>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    online = true
    update.mockResolvedValue(undefined)
    register.mockResolvedValue({ update })
    worker = Object.assign(new EventTarget(), { controller: {}, register })
    vi.stubGlobal('navigator', {
      get onLine() {
        return online
      },
      serviceWorker: worker,
    })
    service = createWebAppUpdates({ reload })
  })
  afterEach(() => {
    service.stop()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const start = async () => {
    service.start()
    await vi.advanceTimersByTimeAsync(0)
  }

  it('bypasses HTTP caches and checks again when an existing tab regains focus', async () => {
    await start()
    expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
    expect(update).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('announces a new controller without discarding a form or the saved session', async () => {
    const input = document.createElement('input')
    input.value = 'unfinished message'
    document.body.append(input)
    window.localStorage.setItem('nl.secure.session', 'test-session')
    await start()
    worker.dispatchEvent(new Event('controllerchange'))
    expect(service.getSnapshot().updateAvailable).toBe(true)
    expect(reload).not.toHaveBeenCalled()
    expect(input.value).toBe('unfinished message')
    expect(window.localStorage.getItem('nl.secure.session')).toBe('test-session')
    service.applyUpdate()
    service.applyUpdate()
    expect(reload).toHaveBeenCalledTimes(1)
    input.remove()
    window.localStorage.removeItem('nl.secure.session')
  })

  it('does not treat first installation as an update or cause a reload loop', async () => {
    worker.controller = null
    await start()
    worker.controller = {}
    worker.dispatchEvent(new Event('controllerchange'))
    expect(service.getSnapshot().updateAvailable).toBe(false)
    service.applyUpdate()
    expect(reload).not.toHaveBeenCalled()
    worker.dispatchEvent(new Event('controllerchange'))
    expect(service.getSnapshot().updateAvailable).toBe(true)
  })

  it('pauses checks and reloads offline, then checks on reconnection', async () => {
    await start()
    worker.dispatchEvent(new Event('controllerchange'))
    online = false
    window.dispatchEvent(new Event('offline'))
    service.applyUpdate()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(service.getSnapshot()).toEqual({ online: false, updateAvailable: true })
    expect(update).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    online = true
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(2)
    expect(service.getSnapshot().online).toBe(true)
  })

  it('keeps update and registration errors contained', async () => {
    update.mockRejectedValue(new Error('offline'))
    await start()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(service.getSnapshot().updateAvailable).toBe(false)
    service.stop()
    register.mockRejectedValue(new Error('blocked'))
    await start()
    expect(reload).not.toHaveBeenCalled()
  })

  it('offers recovery for a removed lazy chunk without automatic reload', async () => {
    await start()
    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(service.getSnapshot().updateAvailable).toBe(true)
    expect(reload).not.toHaveBeenCalled()
  })

  it('registers once, releases timers and listeners, and supports unsubscribe', async () => {
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)
    const initial = service.getSnapshot()
    expect(service.getSnapshot()).toBe(initial)
    await start()
    service.start()
    expect(register).toHaveBeenCalledTimes(1)
    worker.dispatchEvent(new Event('controllerchange'))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    service.stop()
    online = false
    window.dispatchEvent(new Event('offline'))
    worker.dispatchEvent(new Event('controllerchange'))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('keeps the app usable when service workers are unsupported', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    await start()
    expect(register).not.toHaveBeenCalled()
    service.applyUpdate()
    expect(reload).not.toHaveBeenCalled()
  })
})
