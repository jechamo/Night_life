import { expect, signedIn, t, test, watchErrors } from './support'

test.describe('Panel de locales y admin', () => {
  test.beforeEach(async ({ page }) => signedIn(page))

  test('reclamar un local: búsqueda, prueba mínima y envío', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/profile')
    await page.getByRole('link', { name: new RegExp(t('venuePanel.title')) }).click()
    await expect(page).toHaveURL(/\/venue$/)

    const submit = page.getByRole('button', { name: t('venuePanel.claim.submit') })
    await page.getByRole('textbox', { name: t('venuePanel.claim.search') }).fill('Aurora')
    await page.getByRole('radio', { name: 'Sala Aurora' }).click()
    const evidence = page.getByRole('textbox', { name: t('venuePanel.claim.evidence') })
    await evidence.fill('CIF B1')
    await expect(submit).toBeDisabled()
    await evidence.fill('CIF B12345678 y factura a nombre del local')
    await submit.click()
    await expect(page.getByText(t('venuePanel.claim.sent', { name: 'Sala Aurora' }))).toBeVisible()
    errors.expectNone()
  })

  test('gestor: estadísticas, editar la ficha y solicitar patrocinio', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/venue')
    await page.getByRole('link', { name: /Bar Cobalto/ }).click()
    await expect(page.getByRole('heading', { name: 'Bar Cobalto', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: t('venuePanel.stats.title') })).toBeVisible()

    await page
      .getByRole('textbox', { name: t('venuePanel.edit.description') })
      .first()
      .fill('Cócteles de autor y vinilos los jueves.')
    await page.getByRole('radio', { name: '€€€', exact: true }).click()
    await page.getByRole('button', { name: t('common.save') }).click()
    await expect(page.getByText(t('common.saved')).first()).toBeVisible()

    await page
      .getByRole('button', { name: new RegExp(t('venuePanel.sponsor.tiers.top.name')) })
      .click()
    await page.getByRole('button', { name: t('venuePanel.sponsor.submit') }).click()
    await expect(page.getByText(t('venuePanel.sponsor.status.requested')).first()).toBeVisible()
    errors.expectNone()
  })

  test('admin: exige segundo factor y aprueba un claim con nota', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: t('admin.mfa.title') })).toBeVisible()
    const code = page.getByRole('textbox', { name: t('admin.mfa.code') })
    await code.fill('000000')
    await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
    await expect(page.getByText(t('admin.mfa.wrong'))).toBeVisible()
    await code.fill('123456')
    await page.getByRole('button', { name: t('admin.mfa.verify') }).click()
    await expect(
      page.getByRole('heading', { name: t('admin.nav.dashboard'), level: 1 }),
    ).toBeVisible()

    await page
      .getByRole('link', { name: t('admin.nav.claims') })
      .first()
      .click()
    await expect(page).toHaveURL(/\/admin\/s\/claims$/)
    await page
      .getByRole('textbox', { name: t('admin.section.note') })
      .first()
      .fill('CIF comprobado')
    await page
      .getByRole('button', { name: t('admin.actions.approve') })
      .first()
      .click()
    await expect(page.getByText(t('admin.status.approved')).first()).toBeVisible()
    errors.expectNone()
  })
})
