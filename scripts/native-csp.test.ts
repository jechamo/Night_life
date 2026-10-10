// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nativeCsp } from './native-csp'

const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')

describe('native CSP (Block 11)', () => {
  it('keeps the web policy and drops what a meta tag cannot carry', () => {
    const csp = nativeCsp(vercel)
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain('connect-src')
    expect(csp).not.toContain('frame-ancestors')
  })

  it('fails the build when vercel.json loses its policy', () => {
    expect(() => nativeCsp(JSON.stringify({ headers: [] }))).toThrow()
  })
})
