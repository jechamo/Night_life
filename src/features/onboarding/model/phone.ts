/** Country prefixes offered in the phone step (Spain first, then EU neighbours). */
export const COUNTRY_PREFIXES = ['+34', '+351', '+33', '+39', '+49', '+44', '+353'] as const
export type CountryPrefix = (typeof COUNTRY_PREFIXES)[number]

const E164 = /^\+[1-9]\d{7,14}$/

/** Joins prefix + national number into E.164, ignoring spaces, dots and dashes. */
export function toE164(prefix: CountryPrefix, national: string): string | null {
  const digits = national.replace(/[\s.\-()]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const full = `${prefix}${digits.replace(/^0+/, '')}`
  return E164.test(full) ? full : null
}

/** Masked for display ("+34 ••• ••• 678"): the full number is never echoed back in UI copy. */
export function maskPhone(e164: string): string {
  const prefix = COUNTRY_PREFIXES.find((p) => e164.startsWith(p)) ?? e164.slice(0, 3)
  return `${prefix} ••• ••• ${e164.slice(-3)}`
}

export const OTP_LENGTH = 6
export const isOtpFormat = (code: string): boolean => new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)
