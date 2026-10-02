import { describe, expect, it } from 'vitest'
import { documentsToReaccept } from './legal'

describe('re-acceptance', () => {
  const current = [
    { slug: 'terms' as const, version: '1.1' },
    { slug: 'privacy' as const, version: '1.0' },
  ]

  it('asks again when a document version changes', () => {
    const signed = [
      { slug: 'terms' as const, version: '1.0', signedAt: '2026-10-01T20:00:00Z' },
      { slug: 'privacy' as const, version: '1.0', signedAt: '2026-10-01T20:00:00Z' },
    ]
    expect(documentsToReaccept(current, signed)).toEqual(['terms'])
  })

  it('asks for everything when nothing was signed', () => {
    expect(documentsToReaccept(current, [])).toEqual(['terms', 'privacy'])
  })
})
