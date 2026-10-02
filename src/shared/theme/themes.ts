/**
 * Single source of truth for the 5 visual themes (PRD 8.2).
 *
 * Everything a theme changes lives here: colours, typography, map style, heatmap
 * palette and motion intensity. `scripts/generate-theme-css.ts` turns this file
 * into CSS variables, and `themes.test.ts` checks WCAG AA contrast for every theme,
 * so tokens can never drift from the accessibility guarantee.
 *
 * NOTE: imports use explicit `.ts` extensions because this module is also executed
 * by Node (type stripping) when generating the CSS.
 */
import type { AccentKey } from '../domain/venue-types.ts'

export const THEME_IDS = ['neon-noir', 'cyberpunk', 'velvet', 'sunset', 'mono'] as const
export type ThemeId = (typeof THEME_IDS)[number]
export const DEFAULT_THEME_ID: ThemeId = 'neon-noir'

/**
 * How much a theme moves. `minimal` behaves like "reduce motion" (fades only);
 * `calm` slows springs down; `expressive` enables the brief Cyberpunk glitch.
 */
export type MotionProfile = 'standard' | 'expressive' | 'calm' | 'minimal'

export interface ThemeColors {
  background: string
  surface: string
  surfaceRaised: string
  /** Translucent panel colour; contrast is checked composited over `background`. */
  glass: string
  glassBorder: string
  foreground: string
  mutedForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  border: string
  ring: string
  live: string
  success: string
  warning: string
  danger: string
  dangerForeground: string
  /** Soft glow used in shadows (never animated). */
  glow: string
}

export interface ThemeFonts {
  display: string
  body: string
  mono: string
  /** Small labels/chips. Cyberpunk uses monospace accents here. */
  label: string
}

/** Mapbox Standard configuration (applied in Block 7). */
export interface ThemeMapStyle {
  lightPreset: 'night' | 'dusk'
  theme: 'default' | 'faded' | 'monochrome'
}

export interface ThemeDefinition {
  id: ThemeId
  colorScheme: 'dark' | 'light'
  colors: ThemeColors
  accents: Record<AccentKey, string>
  fonts: ThemeFonts
  radius: string
  glassBlur: string
  motion: MotionProfile
  map: ThemeMapStyle
  /** Heatmap ramp from "few people" to "packed" (PRD 5.3, 8.1). */
  heatmap: readonly [string, string, string, string, string]
  /** The 5 base themes are free; `premium_themes` unlocks future extra ones. */
  premium: boolean
}

const FONT = {
  inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
  spaceGrotesk: "'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif",
  unbounded: "'Unbounded', 'Inter', ui-sans-serif, system-ui, sans-serif",
  playfair: "'Playfair Display', ui-serif, Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

const neonNoir: ThemeDefinition = {
  id: 'neon-noir',
  colorScheme: 'dark',
  colors: {
    background: '#07060d',
    surface: '#12101c',
    surfaceRaised: '#1b1828',
    glass: 'rgba(20, 17, 33, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.10)',
    foreground: '#f4f2ff',
    mutedForeground: '#aaa4c8',
    primary: '#a78bfa',
    primaryForeground: '#0b0716',
    secondary: '#22d3ee',
    secondaryForeground: '#04121a',
    border: '#2a2540',
    ring: '#22d3ee',
    live: '#22d3ee',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    dangerForeground: '#1a0505',
    glow: 'rgba(167, 139, 250, 0.35)',
  },
  accents: {
    nightclub: '#a78bfa',
    club: '#22d3ee',
    pub: '#fbbf24',
    bar: '#f5b544',
    dive_bar: '#f87171',
    lounge: '#e9c46a',
    terrace: '#fb923c',
    beach_club: '#2dd4bf',
    event: '#e879f9',
  },
  fonts: { display: FONT.spaceGrotesk, body: FONT.inter, mono: FONT.mono, label: FONT.inter },
  radius: '1.25rem',
  glassBlur: '20px',
  motion: 'standard',
  map: { lightPreset: 'night', theme: 'default' },
  heatmap: [
    'rgba(34, 211, 238, 0)',
    'rgba(34, 211, 238, 0.55)',
    'rgba(167, 139, 250, 0.75)',
    'rgba(232, 121, 249, 0.9)',
    'rgba(253, 244, 255, 1)',
  ],
  premium: false,
}

const cyberpunk: ThemeDefinition = {
  id: 'cyberpunk',
  colorScheme: 'dark',
  colors: {
    background: '#0a0a12',
    surface: '#15121f',
    surfaceRaised: '#1f1a2e',
    glass: 'rgba(21, 16, 33, 0.76)',
    glassBorder: 'rgba(255, 43, 214, 0.30)',
    foreground: '#f8f8f2',
    mutedForeground: '#b9b4d2',
    primary: '#ff2bd6',
    primaryForeground: '#14001c',
    secondary: '#e6ff00',
    secondaryForeground: '#121400',
    border: '#3a2346',
    ring: '#00f0ff',
    live: '#00f0ff',
    success: '#3dff8f',
    warning: '#ffd400',
    danger: '#ff5577',
    dangerForeground: '#1a0008',
    glow: 'rgba(255, 43, 214, 0.40)',
  },
  accents: {
    nightclub: '#b98cff',
    club: '#00f0ff',
    pub: '#ffc400',
    bar: '#ffd84d',
    dive_bar: '#ff4d6d',
    lounge: '#ffd166',
    terrace: '#ff9f1c',
    beach_club: '#00f5d4',
    event: '#ff2bd6',
  },
  fonts: { display: FONT.unbounded, body: FONT.inter, mono: FONT.mono, label: FONT.mono },
  radius: '0.75rem',
  glassBlur: '16px',
  motion: 'expressive',
  map: { lightPreset: 'night', theme: 'default' },
  heatmap: [
    'rgba(0, 240, 255, 0)',
    'rgba(0, 240, 255, 0.6)',
    'rgba(255, 43, 214, 0.8)',
    'rgba(230, 255, 0, 0.9)',
    'rgba(255, 255, 255, 1)',
  ],
  premium: false,
}

const velvet: ThemeDefinition = {
  id: 'velvet',
  colorScheme: 'dark',
  colors: {
    background: '#0e0809',
    surface: '#1a1012',
    surfaceRaised: '#25171b',
    glass: 'rgba(30, 18, 21, 0.80)',
    glassBorder: 'rgba(212, 175, 55, 0.24)',
    foreground: '#f5ede4',
    mutedForeground: '#c4b4a8',
    primary: '#d4af37',
    primaryForeground: '#1a1206',
    secondary: '#9f2b45',
    secondaryForeground: '#fff5f0',
    border: '#3a2629',
    ring: '#e5c35a',
    live: '#f2c14e',
    success: '#8fd19e',
    warning: '#f2c14e',
    danger: '#f08a8a',
    dangerForeground: '#1f0606',
    glow: 'rgba(212, 175, 55, 0.25)',
  },
  accents: {
    nightclub: '#c4a1ff',
    club: '#7fd8e6',
    pub: '#f2b544',
    bar: '#f5c76a',
    dive_bar: '#f07a7a',
    lounge: '#d4af37',
    terrace: '#f4a261',
    beach_club: '#6fd3c6',
    event: '#e79bd8',
  },
  fonts: { display: FONT.playfair, body: FONT.inter, mono: FONT.mono, label: FONT.inter },
  radius: '0.875rem',
  glassBlur: '24px',
  motion: 'calm',
  map: { lightPreset: 'night', theme: 'faded' },
  heatmap: [
    'rgba(159, 43, 69, 0)',
    'rgba(159, 43, 69, 0.6)',
    'rgba(212, 175, 55, 0.75)',
    'rgba(242, 193, 78, 0.9)',
    'rgba(255, 245, 230, 1)',
  ],
  premium: false,
}

const sunset: ThemeDefinition = {
  id: 'sunset',
  colorScheme: 'dark',
  colors: {
    background: '#0b1026',
    surface: '#141a36',
    surfaceRaised: '#1d2448',
    glass: 'rgba(20, 26, 54, 0.74)',
    glassBorder: 'rgba(255, 159, 104, 0.24)',
    foreground: '#fff4ec',
    mutedForeground: '#bcc1de',
    primary: '#ff8a5b',
    primaryForeground: '#1f0a02',
    secondary: '#ff6fa5',
    secondaryForeground: '#24040f',
    border: '#2b3560',
    ring: '#ffb088',
    live: '#ff6fa5',
    success: '#6ee7b7',
    warning: '#ffc15e',
    danger: '#ff7a7a',
    dangerForeground: '#200404',
    glow: 'rgba(255, 138, 91, 0.32)',
  },
  accents: {
    nightclub: '#b69cff',
    club: '#5fd4f0',
    pub: '#ffc15e',
    bar: '#ffd27a',
    dive_bar: '#ff7a7a',
    lounge: '#f4cf6b',
    terrace: '#ff8a5b',
    beach_club: '#4fe3c8',
    event: '#ff6fd8',
  },
  fonts: { display: FONT.spaceGrotesk, body: FONT.inter, mono: FONT.mono, label: FONT.inter },
  radius: '1.5rem',
  glassBlur: '20px',
  motion: 'standard',
  map: { lightPreset: 'dusk', theme: 'default' },
  heatmap: [
    'rgba(255, 111, 165, 0)',
    'rgba(255, 111, 165, 0.55)',
    'rgba(255, 138, 91, 0.75)',
    'rgba(255, 193, 94, 0.9)',
    'rgba(255, 244, 236, 1)',
  ],
  premium: false,
}

const mono: ThemeDefinition = {
  id: 'mono',
  colorScheme: 'dark',
  colors: {
    background: '#000000',
    surface: '#0f0f0f',
    surfaceRaised: '#1a1a1a',
    glass: 'rgba(10, 10, 10, 0.94)',
    glassBorder: 'rgba(255, 255, 255, 0.65)',
    foreground: '#ffffff',
    mutedForeground: '#d4d4d4',
    primary: '#ffffff',
    primaryForeground: '#000000',
    secondary: '#e5e5e5',
    secondaryForeground: '#000000',
    border: '#8a8a8a',
    ring: '#ffe600',
    live: '#ffe600',
    success: '#9dffb0',
    warning: '#ffe600',
    danger: '#ffb3b3',
    dangerForeground: '#000000',
    glow: 'rgba(255, 255, 255, 0)',
  },
  accents: {
    nightclub: '#dccbff',
    club: '#a8f4ff',
    pub: '#ffe08a',
    bar: '#ffecb3',
    dive_bar: '#ffb8b8',
    lounge: '#f5e3a6',
    terrace: '#ffcda6',
    beach_club: '#a6fff0',
    event: '#ffbdf6',
  },
  fonts: { display: FONT.inter, body: FONT.inter, mono: FONT.mono, label: FONT.inter },
  radius: '0.75rem',
  glassBlur: '0px',
  motion: 'minimal',
  map: { lightPreset: 'night', theme: 'monochrome' },
  heatmap: [
    'rgba(255, 255, 255, 0)',
    'rgba(255, 255, 255, 0.45)',
    'rgba(255, 255, 255, 0.7)',
    'rgba(255, 230, 0, 0.9)',
    'rgba(255, 230, 0, 1)',
  ],
  premium: false,
}

export const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> = {
  'neon-noir': neonNoir,
  cyberpunk,
  velvet,
  sunset,
  mono,
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)
}
