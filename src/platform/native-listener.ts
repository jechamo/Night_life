import type { PluginListenerHandle } from '@capacitor/core'

/**
 * Capacitor plugin listeners register asynchronously. The ports return a synchronous
 * unsubscribe, so removing before the handle arrives must still detach it.
 */
export function listen(register: () => Promise<PluginListenerHandle>): () => void {
  let removed = false
  let handle: PluginListenerHandle | null = null
  void register().then(
    (value) => {
      if (removed) void value.remove()
      else handle = value
    },
    () => undefined,
  )
  return () => {
    removed = true
    void handle?.remove()
  }
}
