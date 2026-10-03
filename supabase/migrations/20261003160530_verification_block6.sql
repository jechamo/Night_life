-- Block 6: minimal results only. No documents, selfies, descriptors or raw webhooks.
insert into public.app_settings (key, kind, value, allowed_values) values
  ('verification_provider', 'flag', 'veriff', array['veriff', 'yoti', 'simulator']);

alter table public.verification_status
  add column age_mode text check (age_mode in ('sandbox', 'live')),
  add column photo_mode text check (photo_mode in ('sandbox', 'live')),
  add column identity_mode text check (identity_mode in ('sandbox', 'live'));
-- Existing manual test seeds belong exclusively to the simulated environment.
update public.verification_status set age_mode = 'sandbox'
where age_verified and age_verification_method = 'manual';
alter table public.verification_status drop constraint verification_status_age_verification_method_check;
alter table public.verification_status add constraint verification_status_age_verification_method_check
  check (age_verification_method in ('facial_estimation', 'document', 'digital_id', 'manual'));
alter table public.consent_records drop constraint consent_records_consent_key_check;
alter table public.consent_records add constraint consent_records_consent_key_check
  check (consent_key in ('orientation', 'precise_location', 'marketing', 'analytics', 'photo_verification', 'identity_verification'));

create table public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('age', 'photo', 'identity')),
  mode text not null check (mode in ('sandbox', 'live')),
  provider text not null check (provider in ('veriff', 'yoti', 'simulator')),
  method text not null check (method in ('facial_estimation', 'document', 'digital_id')),
  threshold integer not null check (threshold between 18 and 30),
  provider_session_id uuid unique,
  state text not null default 'pending' check (state in ('pending', 'verified', 'failed', 'manual_review', 'inconclusive', 'reverification_required', 'expired')),
  reason text check (reason in ('requested', 'borderline', 'possible_minor_report', 'photo_changed')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz
);
alter table public.verification_sessions enable row level security;
create unique index verification_sessions_active_idx on public.verification_sessions(user_id, level) where active;
create index verification_sessions_user_idx on public.verification_sessions(user_id, created_at desc);
create policy "verification_sessions: own or admin" on public.verification_sessions
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.verification_sessions from anon, authenticated;
grant select on public.verification_sessions to authenticated;
grant all on public.verification_sessions to service_role;

create table private.verification_notifications (
  event_id uuid primary key,
  session_id uuid not null references public.verification_sessions(id) on delete cascade,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private.verification_notifications enable row level security;
revoke all on private.verification_notifications from public, anon, authenticated;
