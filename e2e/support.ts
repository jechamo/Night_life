import { test as base, expect, type Page } from '@playwright/test'
import es from '../src/i18n/locales/es.json' with { type: 'json' }

/**
 * Every spec uses this `test`: the simulated app must never talk to anything but its own
 * local server. Any other request (Supabase, Stripe, maps, analytics…) is aborted and
 * fails the test, so the suite can never touch real data even if misconfigured.
 */
export const test = base.extend<{ localOnly: void }>({
  localOnly: [
    async ({ page, baseURL }, use) => {
      const origin = new URL(baseURL!).origin
      const escaped: string[] = []
      await page.route(
        (url) => url.origin !== origin && !['data:', 'blob:'].includes(url.protocol),
        async (route) => {
          escaped.push(route.request().url())
          await route.abort('blockedbyclient')
        },
      )
      await use()
      expect(escaped, `Peticiones fuera de la app local:\n${escaped.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

/** Spanish copy straight from the locale file, so a reworded text never breaks a test. */
export function t(key: string, values: Record<string, string | number> = {}): string {
  const found = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], es)
  if (typeof found !== 'string') throw new Error(`Missing es.json key: ${key}`)
  return found.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ''))
}

/** Fixed OTP of the simulated backend (src/mocks/mock-auth-services.ts). */
export const MOCK_OTP = '123456'
/** Any local image works for the photo picker; the app icon is always in the repo. */
export const PHOTO = 'public/icons/icon-192.png'

const VERIFIED_AGE = {
  state: 'verified',
  method: 'facial_estimation',
  thresholdUsed: 21,
  verifiedAt: '2026-10-01T20:00:00.000Z',
}

/**
 * Starts the browser as an already onboarded tester (simulated backend state lives
 * under `nl.pref.mock_state`). Set `ageVerified` to reach the age-gated screens.
 */
export async function signedIn(page: Page, { ageVerified = false } = {}) {
  const state = {
    onboarded: true,
    signed: [],
    city: 'Madrid',
    ...(ageVerified
      ? {
          verification: {
            age: VERIFIED_AGE,
            photo: { state: 'not_started' },
            identity: { state: 'not_started' },
          },
        }
      : {}),
  }
  await page.addInitScript((value) => {
    if (!window.localStorage.getItem('nl.pref.mock_state'))
      window.localStorage.setItem('nl.pref.mock_state', value)
    window.localStorage.setItem('nl.pref.reduce_motion', 'true')
  }, JSON.stringify(state))
}

/** Collects uncaught errors and console errors; every journey must finish with none. */
export function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return {
    expectNone: () => expect(errors, errors.join('\n')).toEqual([]),
  }
}
