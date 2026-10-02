import { EASE_OUT } from './tokens'

const ROOT_ID = 'root'

/**
 * Runs a DOM update inside the View Transitions API (crossfade, opacity only).
 * Fallback for browsers without it: apply instantly and fade the app back in
 * with the Web Animations API (also opacity only, PRD 3.2).
 */
export async function runViewTransition(update: () => void, fallbackMs = 250): Promise<void> {
  if (typeof document.startViewTransition === 'function') {
    try {
      await document.startViewTransition(update).finished
    } catch {
      // A skipped/aborted transition still applied the update; nothing to recover.
    }
    return
  }
  update()
  const root = document.getElementById(ROOT_ID)
  if (root && typeof root.animate === 'function') {
    await root
      .animate([{ opacity: 0.35 }, { opacity: 1 }], {
        duration: fallbackMs,
        easing: `cubic-bezier(${EASE_OUT.join(',')})`,
      })
      .finished.catch(() => undefined)
  }
}

/** Brief Cyberpunk glitch (PRD 8.2): a 280 ms transform jitter, skipped when reduced. */
export function playGlitch(): void {
  const root = document.getElementById(ROOT_ID)
  if (!root) return
  root.classList.remove('nl-glitch')
  // Force a reflow so the animation restarts if it is triggered twice in a row.
  void root.offsetWidth
  root.classList.add('nl-glitch')
  root.addEventListener('animationend', () => root.classList.remove('nl-glitch'), { once: true })
}
