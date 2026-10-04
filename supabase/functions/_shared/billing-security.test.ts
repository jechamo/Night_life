import { Stripe } from './stripe.ts'
import { recentlyAuthenticated } from './erasure.ts'

function assert(value: unknown): asserts value {
  if (!value) throw new Error('assertion failed')
}
const user = '00000000-0000-4000-8000-00000000a901',
  now = 1791103000000
const token = (method: string, offset = 0, sub = user) =>
  `header.${btoa(JSON.stringify({ sub, amr: [{ method, timestamp: now / 1000 + offset }] }))}.signature`
for (const [name, value] of [
  ['fresh password', recentlyAuthenticated(token('password'), user, now)],
  ['fresh OTP', recentlyAuthenticated(token('otp', -60), user, now)],
  ['stale token rejected', !recentlyAuthenticated(token('password', -601), user, now)],
  ['refresh alone rejected', !recentlyAuthenticated(token('token_refresh'), user, now)],
  ['future authentication rejected', !recentlyAuthenticated(token('otp', 31), user, now)],
  [
    'different account rejected',
    !recentlyAuthenticated(token('password', 0, 'different'), user, now),
  ],
  ['malformed token rejected', !recentlyAuthenticated('bad.token', user, now)],
] as const)
  Deno.test(name, () => assert(value))

const secret = 'whsec_block9_unit_test_only',
  payload = JSON.stringify({
    id: 'evt_block9_test',
    object: 'event',
    type: 'checkout.session.completed',
    livemode: false,
    data: { object: { id: 'cs_test_fixture' } },
  })
const cryptoProvider = Stripe.createSubtleCryptoProvider()
async function header(body = payload, timestamp = Math.floor(Date.now() / 1000)) {
  return await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: body,
    secret,
    timestamp,
    cryptoProvider,
  })
}
async function rejected(body: string, h: string, key = secret) {
  try {
    await Stripe.webhooks.constructEventAsync(body, h, key, 300, cryptoProvider)
    return false
  } catch {
    return true
  }
}
Deno.test('valid raw signature verified by Stripe SDK', async () =>
  assert(
    (
      await Stripe.webhooks.constructEventAsync(
        payload,
        await header(),
        secret,
        300,
        cryptoProvider,
      )
    ).id === 'evt_block9_test',
  ),
)
Deno.test('tampered payload rejected', async () =>
  assert(await rejected(payload + ' ', await header())),
)
Deno.test('wrong signing secret rejected', async () =>
  assert(await rejected(payload, await header(), 'whsec_wrong')),
)
Deno.test('old signature rejected', async () =>
  assert(await rejected(payload, await header(payload, Math.floor(Date.now() / 1000) - 301))),
)
Deno.test('unsigned body rejected', async () => assert(await rejected(payload, '')))
