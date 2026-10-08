import type { Page } from '@playwright/test'
import { expect, MOCK_OTP, PHOTO, signedIn, t, test, watchErrors } from './support'

// Roadmap R4: venue showcase behind `venue_showcase_enabled` (simulated backend).
// Flags live in memory, so after turning it on every step navigates inside the app.
async function enterAdmin(page: Page) {
  await page.getByRole('textbox', { name: t('admin.mfa.code') }).fill(MOCK_OTP)
  await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
}

async function enableShowcase(page: Page) {
  await page.goto('/admin')
  await enterAdmin(page)
  await page.getByRole('link', { name: t('admin.nav.flags') }).click()
  const flag = page.getByRole('radiogroup', { name: 'venue_showcase_enabled' })
  await flag.getByRole('radio', { name: 'on' }).click()
  await expect(flag.getByRole('radio', { name: 'on' })).toBeChecked()
}

async function openVenuePanel(page: Page) {
  await page.getByRole('link', { name: new RegExp(t('venuePanel.title')) }).click()
  await page.getByRole('link', { name: /Bar Cobalto/ }).click()
}

test.describe('Escaparate del local (flag)', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('con el flag apagado el panel y la ficha no cambian', async ({ page }) => {
    await page.goto('/venue/v-cobalto')
    await expect(page.getByRole('heading', { name: 'Bar Cobalto' })).toBeVisible()
    await expect(
      page.getByText(t('venuePanel.showcase.photos.title'), { exact: true }),
    ).toHaveCount(0)
    await page.goto('/places/v-cobalto')
    await expect(page.getByRole('heading', { name: t('places.vibe.title') })).toBeVisible()
    await expect(page.getByRole('heading', { name: t('places.showcase.title') })).toHaveCount(0)
  })

  test('el local sube una foto, el admin la aprueba y se ve en la ficha', async ({ page }) => {
    const errors = watchErrors(page)
    await enableShowcase(page)
    await page.getByRole('link', { name: t('admin.exit') }).click()
    await openVenuePanel(page)

    // Upload through the platform picker (re-encoded on the device, no EXIF).
    await expect(
      page.getByText(t('venuePanel.showcase.photos.limit', { used: 0, limit: 3 })),
    ).toBeVisible()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: t('venuePanel.showcase.photos.add') }).click()
    await (await chooser).setFiles(PHOTO)
    await expect(page.getByText(t('venuePanel.showcase.photos.status.pending'))).toBeVisible()

    // Door status and details.
    const door = page.getByRole('radiogroup', { name: t('venuePanel.showcase.live.door') })
    await door.getByRole('radio', { name: t('places.showcase.door.long_queue') }).click()
    await page.getByRole('radio', { name: t('places.showcase.dress.smart') }).click()
    await page.getByLabel(t('venuePanel.showcase.extras.entry')).fill('0')
    await page.getByRole('button', { name: t('venuePanel.showcase.extras.save') }).click()
    await expect(page.getByText(t('venuePanel.showcase.extras.saved'))).toBeVisible()

    // Admin approves it.
    await page
      .getByRole('link', { name: t('tabs.profile') })
      .first()
      .click()
    await page
      .getByRole('link', { name: new RegExp(t('admin.title')) })
      .first()
      .click()
    const nav = page.getByRole('link', { name: t('admin.nav.venuePhotos') })
    await expect(nav.or(page.getByRole('textbox', { name: t('admin.mfa.code') }))).toBeVisible()
    if (!(await nav.isVisible())) await enterAdmin(page)
    await nav.click()
    const card = page.getByRole('region', {
      name: t('admin.venuePhotos.alt', { venue: 'Bar Cobalto' }),
    })
    await card.getByRole('button', { name: t('admin.venuePhotos.approve') }).click()
    await expect(page.getByText(t('admin.venuePhotos.empty'))).toBeVisible()

    // People see it on the venue page, labelled as said by the venue.
    await page.getByRole('link', { name: t('admin.exit') }).click()
    await page
      .getByRole('link', { name: t('tabs.discover') })
      .first()
      .click()
    await page.getByRole('searchbox').fill('Cobalto')
    await page.getByRole('button', { name: t('places.listView') }).click()
    await page.getByText('Bar Cobalto').first().click()
    await expect(page.getByRole('heading', { name: t('places.showcase.title') })).toBeVisible()
    await expect(
      page.getByRole('img', { name: t('places.showcase.photoAlt', { n: 1, name: 'Bar Cobalto' }) }),
    ).toBeVisible()
    await expect(page.getByText(t('places.showcase.door.long_queue')).first()).toBeVisible()
    await expect(page.getByText(t('places.showcase.dress.smart'))).toBeVisible()
    await expect(page.getByText(t('places.showcase.entryFree'))).toBeVisible()
    errors.expectNone()
  })
})
