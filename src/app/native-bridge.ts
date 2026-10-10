import type { Platform } from '@/platform'

/** The subset of the data router the bridge needs (keeps it testable). */
export interface BridgeRouter {
  navigate(to: string | number): Promise<void> | void
}

/** React Router stores the history index in `history.state.idx`. */
const historyIndex = (): number => {
  const state: unknown = window.history.state
  const idx = state && typeof state === 'object' ? (state as { idx?: unknown }).idx : undefined
  return typeof idx === 'number' ? idx : 0
}

/**
 * Connects native shell events to the router (Block 11): links opened by the OS
 * (provider returns, App Links, custom scheme) and the Android back button.
 * On the web both subscriptions are no-ops. Returns the unsubscribe.
 */
export function connectNativeBridge(platform: Platform, router: BridgeRouter): () => void {
  const stopLinks = platform.deepLinks.onUrlOpen(
    (url) => void router.navigate(`${url.pathname}${url.search}`),
  )
  const stopBack = platform.appState.onBackButton(() => {
    if (historyIndex() > 0) void router.navigate(-1)
    else platform.appState.exit()
  })
  return () => {
    stopLinks()
    stopBack()
  }
}
