// Test tools (PRD 6.14): double gate on the server — role tester/admin AND the flag
// `test_tools_enabled`. Creates throw-away `is_test` people (Auth users without phone,
// undeliverable @nightlife.test emails, illustrated avatars, never real photos).
import { json, preflight } from '../_shared/http.ts'
import { requireUser, serviceClient } from '../_shared/supabase.ts'

const NAMES = [
  'Lucía',
  'Alex',
  'Nerea',
  'Clara',
  'Inés',
  'Marco',
  'Dani',
  'Sara',
  'Leo',
  'Paula',
  'Iker',
  'Noa',
  'Hugo',
  'Vera',
  'Bruno',
]
const GENDERS = ['woman', 'man', 'non_binary', 'other'] as const
const LIGHTS = ['green', 'green', 'yellow', 'red'] as const
const BIOS = [
  'Techno y terrazas',
  'Siempre en primera fila',
  'Plan tranquilo y buena música',
  'Bailar hasta el cierre',
  '',
]
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

function birthdateForAge(age: number): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - age)
  d.setUTCDate(d.getUTCDate() - 1 - Math.floor(Math.random() * 300))
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  const early = preflight(req)
  if (early) return early
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405)

  const auth = await requireUser(req)
  if (!auth) return json(req, { error: 'unauthorized' }, 401)
  const { db } = auth
  const [{ data: roles }, { data: enabled }] = await Promise.all([
    db.from('user_roles').select('role').eq('user_id', auth.user.id),
    db.rpc('feature_enabled', { _key: 'test_tools_enabled' }),
  ])
  const allowed = (roles ?? []).some((r) => r.role === 'tester' || r.role === 'admin')
  if (!allowed || enabled !== true) return json(req, { error: 'forbidden' }, 403)

  let count = 10
  try {
    const body = (await req.json()) as { action?: unknown; count?: unknown }
    if (body.action !== 'generate_people') return json(req, { error: 'bad_request' }, 400)
    count = Math.min(Math.max(Number(body.count) || 10, 1), 30)
  } catch {
    return json(req, { error: 'bad_request' }, 400)
  }

  const service = serviceClient()
  const { data: owner } = await service
    .from('profiles')
    .select('city')
    .eq('id', auth.user.id)
    .single()
  let created = 0
  for (let i = 0; i < count; i++) {
    const { data, error } = await service.auth.admin.createUser({
      email: `test+${crypto.randomUUID()}@nightlife.test`,
      email_confirm: true,
      user_metadata: { is_test: true },
    })
    if (error || !data.user) continue
    const id = data.user.id
    const age = 18 + Math.floor(Math.random() * 22)
    const profile = await service.from('profiles').insert({
      id,
      name: pick(NAMES),
      birthdate: birthdateForAge(age),
      gender: pick(GENDERS),
      bio: pick(BIOS),
      traffic_light: pick(LIGHTS),
      is_test: true,
      city: owner?.city ?? 'Madrid',
      onboarded_at: new Date().toISOString(),
    })
    if (profile.error) {
      await service.auth.admin.deleteUser(id)
      continue
    }
    const parts = await Promise.all([
      service.from('verification_status').insert({
        user_id: id,
        age_verified: true,
        age_mode: 'sandbox',
        age_verification_method: 'manual',
      }),
      service.from('user_roles').insert({ user_id: id, role: 'tester' }),
      service.from('consent_records').insert({
        user_id: id,
        kind: 'consent',
        consent_key: 'orientation',
        granted: true,
        method: 'signature',
      }),
      service.from('user_preferences').insert({
        user_id: id,
        interested_in: ['women', 'men', 'non_binary'],
        age_min: 18,
        age_max: 45,
      }),
    ])
    if (parts.some((part) => part.error)) {
      await service.auth.admin.deleteUser(id)
      continue
    }
    created++
  }
  await service.from('admin_audit_log').insert({
    actor_id: auth.user.id,
    action: 'test_tool.generate_people',
    detail: `${created} test users`,
  })
  return json(req, { created })
})
