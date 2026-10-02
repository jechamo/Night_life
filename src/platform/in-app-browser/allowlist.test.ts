import { describe, expect, it } from 'vitest'
import { isAllowedExternalUrl } from './allowlist'

describe('external URL allowlist (PRD 6.15 A01/API7)', () => {
  it.each([
    'https://checkout.stripe.com/c/pay/cs_test_123',
    'https://billing.stripe.com/p/session/test_123',
    'https://age.yoti.com/age-estimation?sessionId=abc',
    'https://accounts.spotify.com/authorize?client_id=x',
  ])('allows %s', (url) => {
    expect(isAllowedExternalUrl(url)).toBe(true)
  })

  it.each([
    ['plain http', 'http://checkout.stripe.com/c/pay'],
    ['look-alike suffix', 'https://checkout.stripe.com.evil.example/'],
    ['look-alike prefix', 'https://evilyoti.com/'],
    ['credentials trick', 'https://checkout.stripe.com@evil.example/'],
    ['non-default port', 'https://checkout.stripe.com:8443/'],
    ['subdomain not allowed for stripe', 'https://x.checkout.stripe.com/'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['garbage', 'not a url'],
  ])('blocks %s', (_label, url) => {
    expect(isAllowedExternalUrl(url)).toBe(false)
  })
})
