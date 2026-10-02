// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildPdf } from '../supabase/functions/_shared/pdf.ts'

const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')

describe('Edge Function PDF writer (signed documents)', () => {
  it('produces a valid PDF with a consistent cross-reference table', () => {
    const pdf = text(
      buildPdf([{ text: 'Términos y Condiciones', bold: true }, { text: 'Versión 1.0 · firmado' }]),
    )
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)?.[1])
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref')
    // Every xref offset must point at "<n> 0 obj".
    const offsets = [...pdf.slice(startxref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]))
    offsets.forEach((offset, i) =>
      expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
    )
  })

  it('encodes Spanish text in WinAnsi and escapes PDF syntax', () => {
    const pdf = text(buildPdf([{ text: 'Niño (prueba) \\ ¿sí?' }]))
    expect(pdf).toContain('Ni\xf1o \\(prueba\\) \\\\ \xbfs\xed?')
  })

  it('wraps long text and paginates', () => {
    const long = Array.from({ length: 400 }, () => 'palabra').join(' ')
    const pdf = text(buildPdf(Array.from({ length: 20 }, () => ({ text: long }))))
    expect(Number(/\/Count (\d+)/.exec(pdf)?.[1])).toBeGreaterThan(1)
  })
})
