import type { Page } from '@playwright/test'
import { expect, MOCK_OTP, signedIn, t, test, watchErrors } from './support'

// Roadmap R2: «Cómo está ahora» behind `live_status_enabled` (simulated backend).
// Flags live in memory, so after turning it on every step navigates inside the app.
async function enableLiveStatus(page: Page) {
  await page.goto('/admin')
  await page.getByRole('textbox', { name: t('admin.mfa.code') }).fill(MOCK_OTP)
  await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
  await page.getByRole('link', { name: t('admin.nav.flags') }).click()
  const flag = page.getByRole('radiogroup', { name: 'live_status_enabled' })
  await flag.getByRole('radio', { name: 'on' }).click()
  await expect(flag.getByRole('radio', { name: 'on' })).toBeChecked()
  await page.getByRole('link', { name: t('admin.exit') }).click()
}

test.describe('Cómo está ahora (flag)', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('con el flag apagado la ficha no cambia: solo Vibe Check', async ({ page }) => {
    await page.goto('/places/v-aurora')
    await expect(page.getByRole('heading', { name: t('places.vibe.title') })).toBeVisible()
    await expect(page.getByRole('heading', { name: t('places.live.title') })).toHaveCount(0)
  })

  test('admin lo activa, la gente vota con check-in y ve el resumen', async ({ page, context }) => {
    const errors = watchErrors(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 40.0, longitude: -3.0 })
    await enableLiveStatus(page)
    await page
      .getByRole('link', { name: t('tabs.discover') })
      .first()
      .click()
    await page.getByRole('searchbox').fill('Aurora')
    await page.getByRole('button', { name: t('places.listView') }).click()
    await page.getByText('Sala Aurora').first().click()
    const live = page.locator('#live-status')
    await expect(live.getByRole('heading', { name: t('places.live.title') })).toBeVisible()
    await expect(
      live.getByText(t('places.live.share', { answer: 'A tope', percent: 60 })),
    ).toBeVisible()
    await expect(
      live.getByText(t('places.live.venueSays', { genres: 'Reguetón · Comercial' })),
    ).toBeVisible()
    await expect(live.getByText(t('places.live.needsCheckIn'))).toBeVisible()

    // Check-in (simulated by the test tools) and one-tap answers.
    await page
      .getByRole('button', { name: t('places.checkIn.cta') })
      .first()
      .click()
    await page.getByRole('button', { name: t('places.checkIn.simulate') }).click()
    const crowd = live.getByRole('group', {
      name: `${t('places.live.yourAnswer')}: ${t('places.live.questions.crowd')}`,
    })
    await crowd.getByRole('button', { name: t('places.live.answers.crowd.packed') }).click()
    await expect(
      crowd.getByRole('button', { name: t('places.live.answers.crowd.packed') }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      live.getByText(t('places.live.share', { answer: 'A tope', percent: 64 })),
    ).toBeVisible()
    errors.expectNone()
  })

  test('el local declara su música y line-up en el panel', async ({ page }) => {
    const errors = watchErrors(page)
    await enableLiveStatus(page)
    await page.getByRole('link', { name: new RegExp(t('venuePanel.title')) }).click()
    await page.getByRole('link', { name: /Bar Cobalto/ }).click()
    await expect(page.getByText(t('venuePanel.music.title'))).toBeVisible()
    await page.getByRole('button', { name: 'Techno' }).click()
    await page.getByLabel(t('venuePanel.music.lineup')).fill('DJ Uno')
    await page.getByRole('button', { name: t('venuePanel.music.save') }).click()
    await expect(page.getByText(t('venuePanel.music.saved'))).toBeVisible()
    await expect(page.getByText(t('places.live.lineup', { lineup: 'DJ Uno' }))).toBeVisible()
    errors.expectNone()
  })
})
