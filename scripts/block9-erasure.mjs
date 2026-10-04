import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Disposable, explicit test fixtures only; no credentials or tokens are logged.
const fixturePath = process.argv[2] ?? '.tmp/block9-live-credentials.json'
const c = JSON.parse(readFileSync(fixturePath, 'utf8'))
const [userA, userB] = c.ids
Object.assign(c, { userA, userB })
assert.ok(c.userA.endsWith('e901') && c.userB.endsWith('e902'), 'fixture IDs required')
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]
    }),
)
const client = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
const a = client(),
  b = client(),
  checks = []
const check = (name, value) => {
  assert.ok(value, name)
  checks.push(name)
}
const call = async (db, name, args = {}) => {
  const r = await db.rpc(name, args)
  assert.equal(r.error, null, name)
  return r.data
}
check(
  'fixture A password authentication',
  !(await a.auth.signInWithPassword({ email: c.emails[0], password: c.password })).error,
)
check(
  'fixture B password authentication',
  !(await b.auth.signInWithPassword({ email: c.emails[1], password: c.password })).error,
)
await call(a, 'matching_like', { p_person: c.userB })
const match = (await call(b, 'matching_like', { p_person: c.userA })).match
check('real conversation created', Boolean(match?.id))
await call(a, 'chat_send', { p_match: match.id, p_text: 'Block9 authored erasure fixture' })
await call(b, 'chat_send', { p_match: match.id, p_text: 'Block9 peer erasure fixture' })
const path = `${c.userA}/block9-erasure.png`
const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
  'base64',
)
check(
  'private photo uploaded',
  !(
    await a.storage
      .from('profile-photos')
      .upload(path, photo, { contentType: 'image/png', upsert: true })
  ).error,
)
const exported = await call(a, 'export_my_data')
check(
  'export includes authored messages',
  JSON.stringify(exported).includes('Block9 authored erasure fixture'),
)
check(
  'export excludes peer message contents',
  !JSON.stringify(exported).includes('Block9 peer erasure fixture'),
)
check(
  'rectification registered',
  Boolean(await call(a, 'request_data_right', { p_kind: 'rectify' })),
)
const deleted = await a.functions.invoke('delete-account', { body: {} })
if (deleted.error) {
  console.error({
    status: deleted.error.context?.status,
    body: await deleted.error.context?.json?.(),
  })
  throw Error('erasure failed')
}
check('delete-account accepts fresh verified authentication', Boolean(deleted.data?.deleted))
check(
  'deleted user cannot authenticate',
  Boolean(
    (await client().auth.signInWithPassword({ email: c.emails[0], password: c.password })).error,
  ),
)
check(
  'peer conversation removed',
  !(await call(b, 'matching_matches')).some((m) => m.id === match.id),
)
writeFileSync(
  '.tmp/block9-erasure-evidence.json',
  JSON.stringify({ ok: true, checks, matchId: match.id, path }, null, 2),
)
console.log({ ok: true, checks, matchId: match.id })
