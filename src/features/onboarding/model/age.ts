import { differenceInYears, isValid, parseISO } from 'date-fns'

/** PRD 2.2: adults only, no upper limit. */
export const MIN_AGE = 18
/** Sanity bound for typos (e.g. 1095 instead of 1995), not an age limit. */
export const MAX_PLAUSIBLE_AGE = 110

export type BirthdateError = 'invalid' | 'future' | 'implausible'

/** Parses a `YYYY-MM-DD` date as a calendar day (no time zone shifts). */
export function parseBirthdate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = parseISO(value)
  return isValid(date) ? date : null
}

export function ageOn(birthdate: Date, today: Date): number {
  return differenceInYears(today, birthdate)
}

export function validateBirthdate(
  value: string,
  today: Date,
): { ok: true; age: number } | { ok: false; error: BirthdateError } {
  const date = parseBirthdate(value)
  if (!date) return { ok: false, error: 'invalid' }
  if (date > today) return { ok: false, error: 'future' }
  const age = ageOn(date, today)
  if (age > MAX_PLAUSIBLE_AGE) return { ok: false, error: 'implausible' }
  return { ok: true, age }
}

export const isAdult = (age: number): boolean => age >= MIN_AGE
