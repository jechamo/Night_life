import { expect, test } from '@playwright/test'
import { MOCK_OTP, PHOTO, t, watchErrors } from './support'

test.describe('Alta y acceso', () => {
  test('alta completa: bienvenida → firma → OTP → consentimientos → perfil → app', async ({
    page,
  }) => {
    const errors = watchErrors(page)
    page.on('filechooser', (chooser) => void chooser.setFiles(PHOTO))

    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    await page.getByRole('button', { name: t('common.skip') }).click()
    await expect(page).toHaveURL(/\/onboarding$/)

    await page.getByLabel(t('onboarding.birthdate.label')).fill('1995-06-15')
    await page.getByRole('button', { name: t('common.continue') }).click()

    // Firma: tres casillas sin marcar y botón deshabilitado hasta marcarlas.
    const sign = page.getByRole('button', { name: t('onboarding.legal.sign') })
    const boxes = page.getByRole('checkbox')
    await expect(boxes).toHaveCount(3)
    for (const box of await boxes.all()) await expect(box).not.toBeChecked()
    await expect(sign).toBeDisabled()
    for (const box of await boxes.all()) await box.check()
    await sign.click()

    await page.getByLabel(t('onboarding.phone.number')).fill('612345678')
    await page.getByRole('button', { name: t('onboarding.phone.send') }).click()
    await page.getByLabel(t('onboarding.phone.codeLabel')).fill(MOCK_OTP)
    await page.getByRole('button', { name: t('onboarding.phone.verify') }).click()
    await page.getByRole('button', { name: t('common.skip') }).click()

    // Consentimientos: todos apagados por defecto.
    await expect(page.getByText(t('onboarding.consents.title'))).toBeVisible()
    for (const toggle of await page.getByRole('switch').all())
      await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await page.getByLabel(t('onboarding.consents.city')).selectOption('Madrid')
    await page.getByRole('button', { name: t('common.continue') }).click()

    for (const n of [1, 2]) {
      await page.getByRole('button', { name: t('onboarding.profile.addPhoto') }).click()
      await expect(
        page.getByRole('img', { name: t('onboarding.profile.photoAlt', { n }) }),
      ).toBeVisible()
    }
    await page.getByLabel(t('onboarding.profile.name')).fill('Alex')
    await page.getByRole('radio', { name: t('onboarding.profile.genders.other') }).check()
    await page.getByRole('button', { name: t('common.continue') }).click()

    await page.getByRole('button', { name: t('onboarding.theme.finish') }).click()
    await expect(page).toHaveURL(/\/home$/)
    errors.expectNone()
  })

  test('menor de 18: pantalla neutra y no se crea nada', async ({ page }) => {
    await page.goto('/onboarding')
    await page.getByLabel(t('onboarding.birthdate.label')).fill('2012-03-03')
    await page.getByRole('button', { name: t('common.continue') }).click()
    await expect(page.getByText(t('onboarding.notEligible.title'))).toBeVisible()
  })
})
