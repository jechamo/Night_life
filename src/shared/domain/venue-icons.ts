import {
  AudioWaveform,
  Beer,
  Disc3,
  Guitar,
  Martini,
  PartyPopper,
  Sofa,
  Sunset,
  TreePalm,
  type LucideIcon,
} from 'lucide-react'
import type { AccentKey } from './venue-types'

/** One icon per place type; colour comes from the theme accent (PRD 8.2). */
export const VENUE_ICONS: Record<AccentKey, LucideIcon> = {
  nightclub: Disc3,
  club: AudioWaveform,
  pub: Beer,
  bar: Martini,
  dive_bar: Guitar,
  lounge: Sofa,
  terrace: Sunset,
  beach_club: TreePalm,
  event: PartyPopper,
}
