import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import es from './locales/es.json'

const flatten = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )

describe('translations', () => {
  it('ES and EN expose exactly the same keys', () => {
    expect(flatten(en).sort()).toEqual(flatten(es).sort())
  })

  it('no translation is empty', () => {
    const values = (obj: object): unknown[] =>
      Object.values(obj).flatMap((v: unknown) =>
        typeof v === 'object' && v !== null ? values(v) : [v],
      )
    expect(values(es).every((v) => typeof v === 'string' && v.trim() !== '')).toBe(true)
    expect(values(en).every((v) => typeof v === 'string' && v.trim() !== '')).toBe(true)
  })
})
