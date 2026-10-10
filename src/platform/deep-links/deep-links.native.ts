import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { listen } from '../native-listener'
import { createWebDeepLinks } from './deep-links.web'
import type { DeepLinksService } from './deep-links'

/** Custom scheme registered in the native projects (same as the appId). */
export const APP_URL_SCHEME = 'com.nightlifeconnect.app'

/**
 * Maps an opened link to an in-app URL, or `null` for anything that is not ours.
 * Accepted: `https://<public app host>/path` (App Links / Universal Links) and
 * `com.nightlifeconnect.app://path` (custom scheme). Credentials, ports and other
 * hosts are rejected so a third-party link cannot drive the router.
 */
export function toAppUrl(raw: string, baseUrl: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.username || url.password || url.port) return null
  const base = new URL(baseUrl)
  if (url.protocol === 'https:' && url.hostname === base.hostname)
    return new URL(`${url.pathname}${url.search}`, base)
  if (url.protocol === `${APP_URL_SCHEME}:`) {
    // `com.nightlifeconnect.app://premium/return` parses "premium" as the host.
    const path = `/${url.host}${url.pathname}`.replace(/\/{2,}/g, '/')
    return new URL(`${path}${url.search}`, base)
  }
  return null
}

/**
 * Return URLs stay on the public HTTPS origin (providers require HTTPS); the app
 * receives them through App Links / Universal Links once the stores are configured
 * (Block 12) or through the custom scheme.
 */
export function createNativeDeepLinks(baseUrl: string): DeepLinksService {
  const web = createWebDeepLinks(baseUrl)
  return {
    buildReturnUrl: (path, params) => web.buildReturnUrl(path, params),
    onUrlOpen(handler) {
      const deliver = (raw: string | undefined) => {
        const url = raw ? toAppUrl(raw, baseUrl) : null
        if (!url) return
        // The external flow (system browser sheet) is over: bring the app back.
        void Browser.close().catch(() => undefined)
        handler(url)
      }
      // A link that cold-started the app was opened before anyone subscribed.
      void App.getLaunchUrl().then(
        (launch) => deliver(launch?.url),
        () => undefined,
      )
      return listen(() => App.addListener('appUrlOpen', ({ url }) => deliver(url)))
    },
  }
}
