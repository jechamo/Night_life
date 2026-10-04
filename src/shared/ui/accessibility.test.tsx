import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test } from 'vitest'
import { renderApp } from '@/test/render-app'
import { THEME_IDS } from '@/shared/theme/themes'
import { CheckboxField } from './checkbox'
import { Switch } from './switch'
import { RangeSlider } from './range-slider'
import { TextField } from './text-field'

function Controls() {
  const [checked, setChecked] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [range, setRange] = useState<[number, number]>([20, 35])
  return (
    <>
      <CheckboxField checked={checked} onCheckedChange={setChecked}>
        Acepto el documento
      </CheckboxField>
      <Switch aria-label="Ubicación" checked={enabled} onCheckedChange={setEnabled} />
      <RangeSlider
        label="Edad"
        thumbLabels={['Edad mínima', 'Edad máxima']}
        min={18}
        max={99}
        value={range}
        onChange={setRange}
        formatValue={(n) => `${n} años`}
      />
      <TextField label="Nombre" error="Introduce tu nombre" />
    </>
  )
}

test('consents and ranges are operable with keyboard and expose names, values and errors', async () => {
  const user = userEvent.setup()
  render(<Controls />)
  await user.tab()
  expect(screen.getByRole('checkbox', { name: 'Acepto el documento' })).toHaveFocus()
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  await user.keyboard(' ')
  expect(screen.getByRole('checkbox')).toBeChecked()
  await user.tab()
  expect(screen.getByRole('switch', { name: 'Ubicación' })).toHaveFocus()
  await user.keyboard(' ')
  expect(screen.getByRole('switch')).toBeChecked()
  await user.tab()
  const minimum = screen.getByRole('slider', { name: 'Edad mínima' })
  expect(minimum).toHaveFocus()
  await user.keyboard('{ArrowRight}')
  expect(minimum).toHaveAttribute('aria-valuenow', '21')
  expect(minimum).toHaveAttribute('aria-valuetext', '21 años')
  const field = screen.getByRole('textbox', { name: 'Nombre' })
  expect(field).toHaveAccessibleDescription('Introduce tu nombre')
  expect(field).toHaveAttribute('aria-invalid', 'true')
})

test.each(THEME_IDS)('navigation has one keyboard stop per link in %s', async (themeId) => {
  const user = userEvent.setup()
  renderApp('/profile', { settings: { themeId, reduceMotion: true } })
  const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
  const links = within(nav).getAllByRole('link')
  links[0]!.focus()
  for (const link of links.slice(1)) {
    await user.tab()
    expect(link).toHaveFocus()
  }
})
