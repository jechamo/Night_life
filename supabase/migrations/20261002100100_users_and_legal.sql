-- Block 5 · Users, verification, preferences, bans and legal evidence (PRD 4.1, 6.1, 6.12).

create type public.gender as enum ('woman', 'man', 'non_binary', 'other');
create type public.traffic_light as enum ('green', 'yellow', 'red');

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Private table: only the owner reads it directly. Other people only ever see the
-- columns exposed by `search_public_profiles()` (PRD 6.15 API3).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  birthdate date not null,
  gender public.gender not null,
  bio text not null default '' check (char_length(bio) <= 300),
  photos text[] not null default '{}' check (cardinality(photos) <= 5),
  anthem jsonb,
  traffic_light public.traffic_light not null default 'green',
  discreet boolean not null default false,
  theme_id text not null default 'neon-noir' check (theme_id in ('neon-noir', 'cyberpunk', 'velvet', 'sunset', 'mono')),
  city text check (char_length(city) <= 60),
  language text not null default 'es' check (language in ('es', 'en')),
  banned boolean not null default false,
  suspended boolean not null default false,
  last_active_at timestamptz not null default now(),
  onboarded_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create index profiles_is_test_idx on public.profiles (is_test) where is_test;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create policy "profiles: own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- ── Verification (only booleans and provider metadata, PRD 4.1) ────────────────
create table public.verification_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_verified boolean not null default false,
  age_verified boolean not null default false,
  age_verification_method text check (age_verification_method in ('facial_estimation', 'document', 'manual')),
  age_threshold_used integer check (age_threshold_used between 18 and 30),
  photo_verified boolean not null default false,
  identity_verified boolean not null default false,
  verification_provider text check (char_length(verification_provider) <= 40),
  provider_session_id text check (char_length(provider_session_id) <= 120),
  verification_date timestamptz,
  reverification_required boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.verification_status enable row level security;
create trigger verification_status_touch before update on public.verification_status
  for each row execute function private.touch_updated_at();

create policy "verification_status: own or admin" on public.verification_status
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create function private.is_age_verified(_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select age_verified and not reverification_required
                   from public.verification_status where user_id = _user), false)
$$;

-- ── Preferences (art. 9: only with the orientation consent) ───────────────────
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interested_in text[] not null check (
    cardinality(interested_in) between 1 and 3
    and interested_in <@ array['women', 'men', 'non_binary']
  ),
  age_min integer not null check (age_min between 18 and 99),
  age_max integer not null check (age_max between 18 and 99),
  updated_at timestamptz not null default now(),
  check (age_min <= age_max)
);
alter table public.user_preferences enable row level security;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function private.touch_updated_at();

create policy "user_preferences: own" on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ── Ban identifiers (HMAC-SHA256 with a secret key, PRD 6.15 A04) ──────────────
create table public.ban_identifiers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('phone', 'device')),
  hmac text not null check (hmac ~ '^[0-9a-f]{64}$'),
  reason text not null default '' check (char_length(reason) <= 200),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, hmac)
);
alter table public.ban_identifiers enable row level security;
create policy "ban_identifiers: admin" on public.ban_identifiers
  for select to authenticated
  using ((select private.is_admin()));

-- Device fingerprints (HMAC) linked to accounts, so a ban can cover the device too.
create table public.user_devices (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_hmac text not null check (device_hmac ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default now(),
  primary key (user_id, device_hmac)
);
alter table public.user_devices enable row level security;
create policy "user_devices: admin" on public.user_devices
  for select to authenticated
  using ((select private.is_admin()));

-- Anti-abuse counters for the pre-signup check (IP/phone HMACs only).
create table public.signup_attempts (
  id bigint generated always as identity primary key,
  subject_hmac text not null check (subject_hmac ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.signup_attempts enable row level security;
create index signup_attempts_subject_idx on public.signup_attempts (subject_hmac, created_at desc);
create policy "signup_attempts: admin" on public.signup_attempts
  for select to authenticated
  using ((select private.is_admin()));

-- ── SOS Lite contacts (private to the owner, max 3) ───────────────────────────
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  phone text not null check (phone ~ '^\+?[0-9 ]{9,16}$'),
  created_at timestamptz not null default now()
);
alter table public.emergency_contacts enable row level security;
create index emergency_contacts_user_idx on public.emergency_contacts (user_id);

create policy "emergency_contacts: own read" on public.emergency_contacts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "emergency_contacts: own insert" on public.emergency_contacts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "emergency_contacts: own update" on public.emergency_contacts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "emergency_contacts: own delete" on public.emergency_contacts
  for delete to authenticated using (user_id = (select auth.uid()));

create function private.max_three_contacts()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.emergency_contacts where user_id = new.user_id) >= 3 then
    raise exception 'too many emergency contacts' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger emergency_contacts_max before insert on public.emergency_contacts
  for each row execute function private.max_three_contacts();

-- ── Legal documents (public, versioned, ES/EN) ────────────────────────────────
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug in (
    'legal_notice', 'terms', 'community', 'privacy', 'cookies', 'ranking',
    'venues', 'sponsorship', 'premium', 'third_parties'
  )),
  language text not null check (language in ('es', 'en')),
  version text not null check (version ~ '^\d+\.\d+$'),
  effective_at timestamptz not null,
  title text not null check (char_length(title) <= 120),
  summary text not null check (char_length(summary) <= 500),
  sections jsonb not null check (jsonb_typeof(sections) = 'array'),
  -- Premium terms are loaded `inactive` and published when payments open (PRD 6.1).
  status text not null default 'draft' check (status in ('draft', 'published', 'inactive')),
  created_at timestamptz not null default now(),
  unique (slug, language, version)
);
alter table public.legal_documents enable row level security;

create policy "legal_documents: published or admin" on public.legal_documents
  for select to anon, authenticated
  using (status = 'published' or (select private.is_admin()));

-- Current published version per document (latest effective date).
create function private.current_document_version(_slug text)
returns text
language sql stable security definer set search_path = ''
as $$
  select version from public.legal_documents
  where slug = _slug and language = 'es' and status = 'published' and effective_at <= now()
  order by effective_at desc
  limit 1
$$;

-- ── Consent evidence (append-only, PRD 6.1 "consent_records inmutable") ────────
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('legal', 'consent')),
  document_slug text,
  document_version text,
  consent_key text check (consent_key in ('orientation', 'precise_location', 'marketing', 'analytics')),
  granted boolean not null,
  method text not null check (method in ('checkbox', 'signature', 'toggle')),
  created_at timestamptz not null default now(),
  check (kind <> 'legal' or (document_slug is not null and document_version is not null)),
  check (kind <> 'consent' or consent_key is not null)
);
alter table public.consent_records enable row level security;
create index consent_records_user_idx on public.consent_records (user_id, created_at desc);

create policy "consent_records: own or admin" on public.consent_records
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create trigger consent_records_append_only
  before update or delete on public.consent_records
  for each row execute function private.forbid_mutation();

-- ── GDPR rights requests and audit (PRD 6.12 G) ───────────────────────────────
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('export', 'delete', 'rectify', 'object', 'restrict')),
  status text not null default 'open' check (status in ('open', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  due_at timestamptz not null default (now() + interval '1 month'),
  closed_at timestamptz
);
alter table public.data_requests enable row level security;
create index data_requests_user_idx on public.data_requests (user_id);
create policy "data_requests: own or admin" on public.data_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create table public.gdpr_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  subject_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  created_at timestamptz not null default now()
);
alter table public.gdpr_audit_log enable row level security;
create index gdpr_audit_log_actor_idx on public.gdpr_audit_log (actor_id);
create index gdpr_audit_log_subject_idx on public.gdpr_audit_log (subject_id);
create policy "gdpr_audit_log: admin" on public.gdpr_audit_log
  for select to authenticated
  using ((select private.is_admin()));
create trigger gdpr_audit_log_append_only
  before update or delete on public.gdpr_audit_log
  for each row execute function private.forbid_mutation();

-- ── Email outbox (Transactional outbox pattern, PRD 3.4) ──────────────────────
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template text not null check (template in ('signed_documents')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  last_error text check (char_length(last_error) <= 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.email_outbox enable row level security;
create index email_outbox_pending_idx on public.email_outbox (status, created_at) where status = 'pending';
create index email_outbox_user_idx on public.email_outbox (user_id);
create policy "email_outbox: own or admin" on public.email_outbox
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
