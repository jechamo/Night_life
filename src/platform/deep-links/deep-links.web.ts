import type { DeepLinksService } from './deep-links'

export function createWebDeepLinks(baseUrl: string): DeepLinksService {
  return {
    buildReturnUrl(path, params = {}) {
      const url = new URL(path, baseUrl)
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
      return url.toString()
    },
    // On the web, external flows return with a full page load, so the router
    // already receives the URL; there is nothing to subscribe to.
    onUrlOpen: () => () => undefined,
  }
}
