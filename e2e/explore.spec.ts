import { expect, signedIn, t, test, watchErrors } from './support'

test.describe('Explorar la noche', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('inicio → ficha de un local → favorito y vuelta', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/home')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page
      .getByRole('link', { name: /Sala Aurora/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/places\/v-aurora$/)
    await expect(page.getByRole('heading', { name: 'Sala Aurora', level: 1 })).toBeVisible()
    await expect(page.getByRole('region', { name: t('places.whoIsThere') })).toBeVisible()

    await page.getByRole('button', { name: t('home.favorite', { name: 'Sala Aurora' }) }).click()
    await expect(
      page.getByRole('button', { name: t('home.unfavorite', { name: 'Sala Aurora' }) }),
    ).toBeVisible()
    await page.getByRole('link', { name: t('common.back') }).click()
    await page.getByRole('link', { name: t('home.viewAll', { count: 1 }) }).click()
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(page.getByText('Sala Aurora').first()).toBeVisible()
    errors.expectNone()
  })

  test('descubre: mapa, búsqueda y vista de lista', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/discover')
    await expect(page.getByRole('application')).toBeVisible()
    await page.getByRole('searchbox').fill('Aurora')
    await page.getByRole('button', { name: t('places.listView') }).click()
    await expect(page.getByText('Sala Aurora').first()).toBeVisible()
    errors.expectNone()
  })

  test('sin verificar la edad, "Ver perfiles" pide verificación', async ({ page }) => {
    await page.goto('/places/v-aurora')
    await page
      .getByRole('region', { name: t('places.actions') })
      .getByRole('button', { name: t('places.viewProfiles') })
      .click()
    await expect(page.getByRole('button', { name: t('verification.gate.verifyNow') })).toBeVisible()
  })
})
