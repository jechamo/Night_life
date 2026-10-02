import { useEffect, useState } from 'react'

/** Seconds left until `until` (epoch ms); re-renders once per second while running. */
export function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [until])
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))
}
