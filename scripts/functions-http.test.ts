// @vitest-environment node
import { expect, test } from 'vitest'
import { corsHeaders } from '../supabase/functions/_shared/http.ts'

test('local development and production origins can invoke Edge Functions', () => {
  for (const origin of [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    'https://nightlife-connect-beige.vercel.app',
  ]) {
    expect(corsHeaders(new Request('https://example.com', { headers: { origin } }))).toMatchObject({
      'Access-Control-Allow-Origin': origin,
    })
  }
})

test('lookalikes and other local ports are not allowed origins', () => {
  for (const origin of [
    'http://127.0.0.1:9999',
    'http://127.0.0.1.evil.example:5173',
    'https://nightlife-connect-beige.vercel.app.evil.example',
  ]) {
    expect(
      corsHeaders(new Request('https://example.com', { headers: { origin } })),
    ).not.toHaveProperty('Access-Control-Allow-Origin')
  }
})
