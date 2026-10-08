import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/render-app'

const flags = {
  email_login_enabled: 'on',
  live_status_enabled: 'on',
  venue_partners_enabled: 'on',
  venue_showcase_enabled: 'on',
  venue_bookings_enabled: 'on',
} as const
const verification = {
  age: { state: 'verified', verifiedAt: '2026-10-02T21:00:00Z' },
  photo: { state: 'not_started' },
  identity: { state: 'not_started' },
} as const

describe('smoke: all roadmap flags on, signed in', () => {
  it.each([
    '/home',
    '/profile',
    '/discover',
    '/discover?place=v-aurora',
    '/tonight',
    '/venue',
    '/venue/v-cobalto',
    '/reservas',
    '/profile/settings',
    '/guia',
    '/guia/locales',
  ])('%s renders without the error screen', async (path) => {
    renderApp(path, {
      services: { flags, state: { verification } },
      settings: { reduceMotion: true },
    })
    await new Promise((r) => setTimeout(r, 1500))
    expect(screen.queryByText(/Algo no ha ido bien/i)).toBeNull()
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50)
  })
})
