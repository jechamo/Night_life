// Integration gate against two disposable testers. Credentials are never logged.
// Setup/cleanup use the Supabase MCP; this runner uses only public client credentials.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'

const credentials = JSON.parse(readFileSync('.tmp/block8-live-credentials.json', 'utf8'))
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]
    }),
)
const clients = credentials.ids.map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
)
const events = [[], []],
  stats = [],
  channels = []
const checks = []
const check = (name, value) => {
  assert.ok(value, name)
  checks.push(name)
}
const waitFor = async (fn) => {
  const started = Date.now()
  while (!fn()) {
    if (Date.now() - started > 10000) throw new Error('Timed out waiting for realtime')
    await new Promise((r) => setTimeout(r, 50))
  }
  return Date.now() - started
}
async function join(db, topic, handler) {
  const channel = db
    .channel(topic, { config: { private: true } })
    .on('broadcast', { event: '*' }, handler)
  channels.push([db, channel])
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Subscribe timeout')), 12000)
    channel.subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        clearTimeout(timer)
        resolve()
      }
      if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
        clearTimeout(timer)
        reject(new Error('Channel denied'))
      }
    })
  })
  return channel
}
async function rpc(db, name, args) {
  const result = await db.rpc(name, args)
  if (result.error) throw new Error(`${name}: ${result.error.code}`)
  return result.data
}
const result = { checks: [], timings: {}, ok: false }
try {
  for (let i = 0; i < 2; i++) {
    const login = await clients[i].auth.signInWithPassword({
      email: credentials.emails[i],
      password: credentials.password,
    })
    if (login.error) throw new Error(`Test login: ${login.error.code}`)
    await clients[i].realtime.setAuth(login.data.session.access_token)
    await join(clients[i], `social:${credentials.ids[i]}`, (payload) =>
      events[i].push({ ...payload, received: Date.now() }),
    )
  }
  check('two authenticated private inboxes', true)
  try {
    await join(clients[0], `social:${credentials.ids[1]}`, () => {})
    check('foreign inbox denied', false)
  } catch (error) {
    check('foreign inbox denied', error.message === 'Channel denied')
  }
  await join(clients[1], 'place-stats:test', (payload) =>
    stats.push({ ...payload, received: Date.now() }),
  )
  let started = Date.now()
  await rpc(clients[0], 'check_in', {
    p_place_id: '00000000-0000-4000-8000-0000000ee801',
    p_lat: 40.4,
    p_lng: -3.7,
    p_visible: true,
  })
  await waitFor(() =>
    stats.some((e) => e.payload?.placeId === '00000000-0000-4000-8000-0000000ee801'),
  )
  result.timings.checkInMs =
    stats.find((e) => e.payload?.placeId === '00000000-0000-4000-8000-0000000ee801').received -
    started
  check('block 7 check-in reaches second tester within 5 seconds', result.timings.checkInMs < 5000)
  await rpc(clients[1], 'check_in', {
    p_place_id: '00000000-0000-4000-8000-0000000ee801',
    p_lat: 40.4,
    p_lng: -3.7,
    p_visible: true,
  })
  const candidate = await rpc(clients[0], 'matching_candidates', {
    p_place: '00000000-0000-4000-8000-0000000ee801',
  })
  check(
    'real shared venue context',
    candidate[0].context.sameVenueNow && candidate[0].context.venueName === 'Block8 realtime venue',
  )
  started = Date.now()
  const likes = await Promise.all(
    clients.map((db, i) => rpc(db, 'matching_like', { p_person: credentials.ids[1 - i] })),
  )
  await waitFor(() => events.every((list) => list.some((e) => e.event === 'match')))
  const matchId = likes.find((l) => l.match)?.match.id
  check('concurrent mutual likes create a match', !!matchId)
  check(
    'both users receive same match',
    events.every((list) => list.find((e) => e.event === 'match').payload.matchId === matchId),
  )
  result.timings.matchMs = events.map(
    (list) => list.find((e) => e.event === 'match').received - started,
  )
  result.timings.matchSkewMs = Math.abs(result.timings.matchMs[0] - result.timings.matchMs[1])
  check('match broadcast reaches both within 5 seconds', Math.max(...result.timings.matchMs) < 5000)
  check('only one persisted match', (await rpc(clients[0], 'matching_matches')).length === 1)
  started = Date.now()
  await rpc(clients[0], 'chat_send', { p_match: matchId, p_text: 'Block8 realtime message' })
  await waitFor(() => events[1].some((e) => e.event === 'message'))
  result.timings.messageMs = events[1].find((e) => e.event === 'message').received - started
  check('message broadcast within 5 seconds', result.timings.messageMs < 5000)
  const messages = await rpc(clients[1], 'chat_messages', { p_match: matchId })
  check(
    'recipient reads persisted incoming message',
    messages.length === 1 && !messages[0].fromMe && messages[0].text === 'Block8 realtime message',
  )
  check(
    'broadcast excludes message text',
    !events[1].find((e) => e.event === 'message').payload.text,
  )
  await rpc(clients[1], 'chat_read', { p_match: matchId })
  await waitFor(() => events[0].some((e) => e.event === 'read'))
  check(
    'read receipt persists',
    (await rpc(clients[0], 'chat_messages', { p_match: matchId }))[0].readAt !== null,
  )
  await rpc(clients[0], 'chat_typing', { p_match: matchId, p_typing: true })
  await waitFor(() => events[1].some((e) => e.event === 'typing' && e.payload.typing))
  check('typing delivered to other participant', true)
  await rpc(clients[1], 'matching_unmatch', { p_match: matchId })
  await waitFor(() => events.every((list) => list.some((e) => e.event === 'removed')))
  check('unmatch reaches both inboxes', true)
  check(
    'unmatch removed for both',
    (await rpc(clients[0], 'matching_matches')).length === 0 &&
      (await rpc(clients[1], 'matching_matches')).length === 0,
  )
  const denied = await clients[0].rpc('chat_send', { p_match: matchId, p_text: 'denied' })
  check('removed match cannot send', denied.error?.code === 'P0002')
  result.ok = true
} catch (error) {
  result.error = error.message
  process.exitCode = 1
} finally {
  result.checks = checks
  for (const [db, channel] of channels) await db.removeChannel(channel)
  for (const db of clients) await db.auth.signOut({ scope: 'local' })
  writeFileSync('.tmp/block8-realtime-results.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
}
