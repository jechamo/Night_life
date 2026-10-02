import { err, ok } from '@/shared/lib/result'
import { isAllowedExternalUrl } from './allowlist'
import type { InAppBrowserService } from './in-app-browser'

export function createWebInAppBrowser(): InAppBrowserService {
  return {
    openExternalFlow(url) {
      if (!isAllowedExternalUrl(url)) return Promise.resolve(err('host_not_allowed'))
      try {
        window.location.assign(url)
        return Promise.resolve(ok(undefined))
      } catch {
        return Promise.resolve(err('failed'))
      }
    },
  }
}
