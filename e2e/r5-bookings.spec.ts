import type { Page } from '@playwright/test'
import { expect, MOCK_OTP, signedIn, t, test, watchErrors } from './support'

// Roadmap R5: reservations and guest lists behind `venue_bookings_enabled` (simulated
// backend). Flags live in memory, so after turning it on every step navigates in the app.
async function enableBookings(page: Page) {
  await page.goto('/admin')
  await page.getByRole('textbox', { name: t('admin.mfa.code') }).fill(MOCK_OTP)
  await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
  await page.getByRole('link', { name: t('admin.nav.flags') }).click()
  const flag = page.getByRole('radiogroup', { name: 'venue_bookings_enabled' })
  await flag.getByRole('radio', { name: 'on' }).click()
  await expect(flag.getByRole('radio', { name: 'on' })).toBeChecked()
  await page.getByRole('link', { name: t('admin.exit') }).click()
}

test.describe('Reservas y lista de invitados (flag)', () => {
  test.beforeEach(async ({ page }) => signedIn(page, { ageVerified: true }))

  test('con el flag apagado la ficha y el perfil no cambian', async ({ page }) => {
    await page.goto('/places/v-aurora')
    await expect(page.getByRole('heading', { name: t('places.vibe.title') })).toBeVisible()
    await expect(page.getByRole('heading', { name: t('bookings.place.title') })).toHaveCount(0)
    await page.goto('/profile')
    await expect(page.getByText(t('venuePanel.title'))).toBeVisible()
    await expect(page.getByText(t('bookings.mine.title'))).toHaveCount(0)
  })

  test('la persona se apunta a la lista y ve su QR; el local valida en la puerta', async ({
    page,
  }) => {
    const errors = watchErrors(page)
    await enableBookings(page)

    // Person: tonight's list at Sala Aurora.
    await page
      .getByRole('link', { name: t('tabs.discover') })
      .first()
      .click()
    await page.getByRole('searchbox').fill('Aurora')
    await page.getByRole('button', { name: t('places.listView') }).click()
    await page.getByText('Sala Aurora').first().click()
    await expect(page.getByRole('heading', { name: t('bookings.place.title') })).toBeVisible()
    await page.getByRole('button', { name: t('bookings.place.join') }).click()
    await expect(page.getByText(t('bookings.place.joined'))).toBeVisible()
    await page.getByRole('link', { name: t('bookings.place.seeMine') }).click()
    await expect(
      page.getByRole('img', { name: t('bookings.mine.qrLabel', { place: 'Sala Aurora' }) }),
    ).toBeVisible()
    await expect(page.getByText(/^Código: NL-[0-9A-F]{5}-[0-9A-F]{5}$/)).toBeVisible()

    // Venue: turn bookings on, accept the simulated request, open a list, check a code.
    await page
      .getByRole('link', { name: t('tabs.profile') })
      .first()
      .click()
    await page.getByRole('link', { name: new RegExp(t('venuePanel.title')) }).click()
    await page.getByRole('link', { name: /Bar Cobalto/ }).click()
    await page.getByText(t('bookings.venue.acceptReservations'), { exact: true }).click()
    await page.getByText(t('bookings.venue.acceptGuestlists'), { exact: true }).click()
    await page.getByRole('button', { name: t('bookings.venue.save'), exact: true }).click()
    await expect(page.getByText(t('bookings.venue.saved'))).toBeVisible()
    await page.getByRole('button', { name: t('bookings.venue.accept'), exact: true }).click()
    await expect(page.getByText(t('bookings.status.accepted'))).toBeVisible()
    await page.getByLabel(t('bookings.venue.listName')).fill('Gratis antes de la 1:30')
    await page.getByRole('button', { name: t('bookings.venue.createList') }).click()
    await page.getByLabel(t('bookings.venue.codeLabel')).fill('NL-A1B2C-3D4E5')
    await page.getByRole('button', { name: t('bookings.venue.check') }).click()
    await expect(page.getByText(t('bookings.venue.ok', { name: 'Lucía' }))).toBeVisible()
    errors.expectNone()
  })
})
