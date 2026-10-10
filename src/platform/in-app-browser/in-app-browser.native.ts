import { Browser } from '@capacitor/browser'
import { err, ok } from '@/shared/lib/result'
import { isAllowedExternalUrl } from './allowlist'
import type { InAppBrowserService } from './in-app-browser'

/**
 * SFSafariViewController / Custom Tabs: the provider page runs in the system browser,
 * isolated from the WebView (no shared cookies or JS bridge). Same allowlist as the web.
 */
export function createNativeInAppBrowser(): InAppBrowserService {
  return {
    async openExternalFlow(url) {
      if (!isAllowedExternalUrl(url)) return err('host_not_allowed')
      try {
        await Browser.open({ url, presentationStyle: 'fullscreen' })
        return ok(undefined)
      } catch {
        return err('failed')
      }
    },
  }
}
