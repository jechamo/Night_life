import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { err } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

test('unverified direct chat URLs cannot show conversations', async () => {
  renderApp('/chats')
  expect(await screen.findByRole('link', { name: 'Verificar ahora' })).toBeInTheDocument()
  expect(screen.queryByText('Marta')).not.toBeInTheDocument()
})

test('a provider error offers an explicit simulator start for testers', async () => {
  const user = userEvent.setup()
  const { services } = renderApp('/verification/age')
  const start = vi.spyOn(services.verification, 'start').mockResolvedValueOnce(err('unavailable'))
  await user.click(await screen.findByRole('button', { name: 'Continuar la verificación' }))
  await user.click(await screen.findByRole('button', { name: 'Usar simulación de prueba' }))
  expect(start).toHaveBeenLastCalledWith('age', 'document', undefined, true)
  await user.click(await screen.findByRole('button', { name: 'Aprobado' }))
  expect(await screen.findByText('¡Verificación completada!')).toBeInTheDocument()
})

test('normal users never get the simulator fallback button', async () => {
  const user = userEvent.setup()
  const { services } = renderApp('/verification/age', { services: { roles: ['user'] } })
  vi.spyOn(services.verification, 'start').mockResolvedValue(err('unavailable'))
  await user.click(await screen.findByRole('button', { name: 'Continuar la verificación' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('no está disponible')
  expect(
    screen.queryByRole('button', { name: 'Usar simulación de prueba' }),
  ).not.toBeInTheDocument()
})

test('return URL parameters cannot claim successful verification', async () => {
  renderApp('/profile/verification?level=age&result=verified')
  await screen.findByRole('button', { name: 'Actualizar estado' })
  expect(screen.queryByText('¡Verificación completada!')).not.toBeInTheDocument()
})
