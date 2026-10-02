/**
 * Turns the theme registry into CSS custom properties scoped by `[data-theme]`.
 * Because the variables are scoped by attribute, any element can preview another
 * theme just by setting `data-theme` (used by the theme picker cards).
 */
import { DEFAULT_THEME_ID, THEME_IDS, THEMES, type ThemeDefinition } from './themes.ts'

export const GENERATED_CSS_HEADER =
  '/* AUTO-GENERATED from src/shared/theme/themes.ts by `npm run tokens`. Do not edit. */'

const toKebab = (value: string): string => value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

function themeVariables(theme: ThemeDefinition): string[] {
  const vars: string[] = [`color-scheme: ${theme.colorScheme};`]
  for (const [key, value] of Object.entries(theme.colors)) {
    vars.push(`--nl-${toKebab(key)}: ${value};`)
  }
  for (const [key, value] of Object.entries(theme.accents)) {
    vars.push(`--nl-accent-${key.replace(/_/g, '-')}: ${value};`)
  }
  for (const [key, value] of Object.entries(theme.fonts)) {
    vars.push(`--nl-font-${key}: ${value};`)
  }
  theme.heatmap.forEach((value, index) => vars.push(`--nl-heatmap-${index}: ${value};`))
  vars.push(`--nl-radius: ${theme.radius};`)
  vars.push(`--nl-glass-blur: ${theme.glassBlur};`)
  return vars
}

export function buildThemeCss(): string {
  const blocks = THEME_IDS.map((id) => {
    const selector =
      id === DEFAULT_THEME_ID ? `:root,\n[data-theme='${id}']` : `[data-theme='${id}']`
    const body = themeVariables(THEMES[id])
      .map((line) => `  ${line}`)
      .join('\n')
    return `${selector} {\n${body}\n}`
  })
  return `${GENERATED_CSS_HEADER}\n\n${blocks.join('\n\n')}\n`
}
