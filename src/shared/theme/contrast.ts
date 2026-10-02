/**
 * WCAG 2.1 contrast helpers used to prove every theme meets AA (PRD 6.12 F, 8.2).
 * Pure functions: no DOM access, so they run in unit tests and build scripts.
 */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_RE = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

export function parseColor(input: string): Rgba {
  const value = input.trim()
  const hex = HEX_RE.exec(value)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    const channel = (i: number) => parseInt(full.slice(i, i + 2), 16)
    return {
      r: channel(0),
      g: channel(2),
      b: channel(4),
      a: full.length === 8 ? channel(6) / 255 : 1,
    }
  }
  const rgb = RGB_RE.exec(value)
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    }
  }
  throw new Error(`Unsupported colour format: ${input}`)
}

/** Alpha-composites a (possibly translucent) colour over an opaque backdrop. */
export function composite(top: Rgba, backdrop: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a)
  return { r: mix(top.r, backdrop.r), g: mix(top.g, backdrop.g), b: mix(top.b, backdrop.b), a: 1 }
}

function linearize(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * Contrast ratio between two colours. Translucent colours are first composited
 * over `backdrop` (defaults to opaque black, the base of every dark theme).
 */
export function contrastRatio(a: string, b: string, backdrop = '#000000'): number {
  const base = parseColor(backdrop)
  const la = relativeLuminance(composite(parseColor(a), base))
  const lb = relativeLuminance(composite(parseColor(b), base))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** WCAG 2.1 thresholds. */
export const AA_TEXT = 4.5
export const AA_NON_TEXT = 3
