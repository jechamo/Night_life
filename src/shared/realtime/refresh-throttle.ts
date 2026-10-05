/** Coalesce global venue bursts while retaining the final aggregate refresh. */
export function createRefreshThrottle(refresh: () => void, intervalMs: number) {
  let last = -Infinity
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const run = () => {
    timer = undefined
    if (disposed) return
    last = Date.now()
    refresh()
  }
  return {
    request() {
      if (disposed || timer !== undefined) return
      const delay = Math.max(0, intervalMs - (Date.now() - last))
      if (delay === 0) run()
      else timer = setTimeout(run, delay)
    },
    cancel() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
