// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildThemeCss } from '../src/shared/theme/theme-css.ts'

describe('generated theme CSS', () => {
  it('matches the theme registry (run `npm run tokens` if this fails)', () => {
    const committed = readFileSync(resolve('src/styles/themes.generated.css'), 'utf8')
    expect(committed).toBe(buildThemeCss())
  })
})
