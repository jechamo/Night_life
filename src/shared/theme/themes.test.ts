import { describe, expect, it } from 'vitest'
import { ACCENT_KEYS } from '@/shared/domain/venue-types'
import { AA_NON_TEXT, AA_TEXT, composite, contrastRatio, parseColor } from './contrast'
import { THEME_IDS, THEMES } from './themes'

const toCss = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

describe.each(THEME_IDS)('theme %s meets WCAG 2.1 AA', (id) => {
  const { colors, accents } = THEMES[id]
  // Glass panels are translucent: measure them as they render over the background.
  const glass = toCss(composite(parseColor(colors.glass), parseColor(colors.background)))
  const textSurfaces = {
    background: colors.background,
    surface: colors.surface,
    surfaceRaised: colors.surfaceRaised,
    glass,
  }

  it.each(Object.entries(textSurfaces))('body and muted text on %s', (_name, surface) => {
    expect(contrastRatio(colors.foreground, surface)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrastRatio(colors.mutedForeground, surface)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('filled buttons keep readable labels', () => {
    expect(contrastRatio(colors.primaryForeground, colors.primary)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrastRatio(colors.secondaryForeground, colors.secondary)).toBeGreaterThanOrEqual(
      AA_TEXT,
    )
    expect(contrastRatio(colors.dangerForeground, colors.danger)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('status colours are legible as text on background and glass', () => {
    for (const color of [
      colors.primary,
      colors.live,
      colors.success,
      colors.warning,
      colors.danger,
    ]) {
      expect(contrastRatio(color, colors.background)).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrastRatio(color, glass)).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it('focus ring is visible (non-text contrast)', () => {
    expect(contrastRatio(colors.ring, colors.background)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })

  it.each(ACCENT_KEYS)('accent %s works as text and as filled chip', (key) => {
    const accent = accents[key]
    expect(contrastRatio(accent, colors.background)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrastRatio(accent, colors.surface)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrastRatio(accent, glass)).toBeGreaterThanOrEqual(AA_TEXT)
  })
})

describe('theme registry', () => {
  it('only free base themes ship in the MVP', () => {
    expect(THEME_IDS).toHaveLength(5)
    expect(THEME_IDS.every((id) => !THEMES[id].premium)).toBe(true)
  })
})
