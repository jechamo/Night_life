import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Negative probes only: no credentials, provider calls, SMS, email or paid actions.
const root = 'https://ocrpfeqfqzchhrghqcfb.supabase.co/functions/v1'
let passed = 0
for (const name of [
  'create-checkout-session',
  'billing-account',
  'create-portal-session',
  'request-withdrawal',
  'delete-account',
  'billing-worker',
  'signed-documents',
  'stripe-webhook',
  'test-tools',
  'verification',
  'veriff-webhook',
  'yoti-webhook',
  'osm-import',
]) {
  const gatewayJwt = name === 'osm-import'
  const get = await fetch(`${root}/${name}`)
  assert.equal(get.status, gatewayJwt ? 401 : 405, `${name}: method/authentication gate`)
  passed += 1
  const unsigned = await fetch(`${root}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  assert.equal(unsigned.status, name === 'stripe-webhook' ? 400 : 401, `${name}: unsigned`)
  passed += 1
}
const foreign = await fetch(`${root}/create-checkout-session`, {
  method: 'OPTIONS',
  headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
})
assert.notEqual(foreign.headers.get('access-control-allow-origin'), 'https://evil.example')
passed += 1
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')]
    }),
)
for (const schema of ['private', 'net']) {
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/http_request_queue`, {
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'accept-profile': schema },
  })
  assert.equal(response.status, 406, `${schema}: schema gate`)
  assert.equal((await response.json()).code, 'PGRST106')
  passed += 1
}
console.log({ ok: true, passed, failed: 0 })
