import { useState } from 'react'
import { usePlatform } from '@/platform'
import { DEFAULT_CONSENTS, type ConsentChoices, type ConsentKey } from '../model/consents'

/**
 * Local editing state for consents. Turning ON the art. 9 orientation consent
 * requires an explicit signature (sheet); turning anything OFF is one tap.
 * Turning ON precise location asks the OS/browser for permission right away.
 */
export function useConsentEditor(initial?: { choices: ConsentChoices; city: string | null }) {
  const { geolocation } = usePlatform()
  const [choices, setChoices] = useState<ConsentChoices>(
    initial?.choices ?? { ...DEFAULT_CONSENTS },
  )
  const [city, setCity] = useState<string | null>(initial?.city ?? null)
  const [signingOrientation, setSigningOrientation] = useState(false)
  const [locationBlocked, setLocationBlocked] = useState(false)

  const set = (key: ConsentKey, value: boolean) =>
    setChoices((current) => ({ ...current, [key]: value }))

  const toggle = async (key: ConsentKey, value: boolean) => {
    if (key === 'orientation' && value) {
      setSigningOrientation(true)
      return
    }
    if (key === 'precise_location' && value) {
      setLocationBlocked(false)
      // The coordinates are discarded: this only triggers the permission prompt.
      const position = await geolocation.getCurrentPosition({ timeoutMs: 8000 })
      if (!position.ok && position.error === 'permission_denied') {
        setLocationBlocked(true)
        return
      }
    }
    set(key, value)
  }

  return {
    choices,
    city,
    setCity,
    toggle,
    locationBlocked,
    signingOrientation,
    confirmOrientation: () => {
      set('orientation', true)
      setSigningOrientation(false)
    },
    cancelOrientation: () => setSigningOrientation(false),
    /** Without precise location the user explores by choosing a city (PRD 6.1). */
    needsCity: !choices.precise_location,
    isValid: choices.precise_location || city !== null,
  }
}

export type ConsentEditor = ReturnType<typeof useConsentEditor>
