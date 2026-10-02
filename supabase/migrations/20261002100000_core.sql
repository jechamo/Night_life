-- Block 5 · Core: roles, settings/flags, audit and helper functions (PRD 3.2, 4.1, 6.13, 6.14).
-- Deny by default: RLS on every table, writes only through SECURITY DEFINER functions
-- with an empty search_path. Helpers live in the non-exposed `private` schema.

create extension if not exists postgis with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create type public.app_role as enum ('user', 'tester', 'venue_manager', 'admin');

-- ── Roles ────────────────────────────────────────────────────────────────────
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
create index user_roles_granted_by_idx on public.user_roles (granted_by);

create function private.has_role(_role public.app_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = _role
  )
$$;

-- Admin actions need the role AND a second factor in this session (PRD 6.12 E, A07).
create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role('admin') and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

-- Test data (`is_test`) is only visible to testers and admins (PRD 4.2, 6.14).
create function private.sees_test_data()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role('tester') or private.has_role('admin')
$$;

create policy "user_roles: own or admin" on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ── Settings and feature flags ──────────────────────────────────────────────
create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{3,60}$'),
  kind text not null check (kind in ('flag', 'setting')),
  value text not null,
  allowed_values text[],
  min_value integer,
  max_value integer,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  check (kind = 'setting' or allowed_values is not null),
  check (kind = 'flag' or (min_value is not null and max_value is not null))
);
alter table public.app_settings enable row level security;
create index app_settings_updated_by_idx on public.app_settings (updated_by);

-- Flags and limits are not secret: the paywall must work before login (public web).
create policy "app_settings: readable" on public.app_settings
  for select to anon, authenticated
  using (true);

-- Single SQL entry point for flags (PRD 3.2). Unknown or missing ⇒ off (fail closed).
create function public.feature_enabled(_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select value = 'on' from public.app_settings where key = _key and kind = 'flag'),
    false
  )
$$;

create function private.flag_value(_key text)
returns text
language sql stable security definer set search_path = ''
as $$
  select value from public.app_settings where key = _key and kind = 'flag'
$$;

create function private.setting_int(_key text, _fallback integer)
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select value::integer from public.app_settings where key = _key and kind = 'setting'),
    _fallback
  )
$$;

-- ── Admin audit log (immutable) ─────────────────────────────────────────────
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  detail text not null default '' check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

create policy "admin_audit_log: admin" on public.admin_audit_log
  for select to authenticated
  using ((select private.is_admin()));

create function private.audit(_action text, _detail text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, detail)
  values ((select auth.uid()), left(_action, 80), left(_detail, 500))
$$;

-- Generic guard: rows can only be appended (evidence, audit). FK "set null" on account
-- deletion is the only update allowed, so evidence survives blocked (PRD 6.12 G).
create function private.forbid_mutation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(new) - 'user_id' - 'actor_id' = to_jsonb(old) - 'user_id' - 'actor_id' then
    return new;
  end if;
  raise exception 'append-only table %', tg_table_name using errcode = '42501';
end
$$;

create trigger admin_audit_log_append_only
  before update or delete on public.admin_audit_log
  for each row execute function private.forbid_mutation();

create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ── Seed: flags (PRD 6.13 initial values) and limits ────────────────────────
insert into public.app_settings (key, kind, value, allowed_values) values
  ('payments_mode', 'flag', 'test', array['disabled', 'test', 'live']),
  ('payments_audience', 'flag', 'testers', array['none', 'testers', 'all']),
  ('paywall_visibility', 'flag', 'coming_soon', array['hidden', 'coming_soon', 'visible']),
  ('premium_enabled', 'flag', 'on', array['on', 'off']),
  ('paid_dm_enabled', 'flag', 'off', array['on', 'off']),
  ('sponsorship_self_service_enabled', 'flag', 'off', array['on', 'off']),
  ('flash_alerts_push_enabled', 'flag', 'off', array['on', 'off']),
  ('verification_mode', 'flag', 'sandbox', array['sandbox', 'live']),
  ('test_tools_enabled', 'flag', 'on', array['on', 'off']),
  ('store_payments_enabled', 'flag', 'off', array['on', 'off']),
  ('sponsored_cards_enabled', 'flag', 'off', array['on', 'off']),
  ('travel_mode_enabled', 'flag', 'off', array['on', 'off']);

insert into public.app_settings (key, kind, value, min_value, max_value) values
  ('free_daily_likes', 'setting', '5', 1, 50),
  ('age_threshold', 'setting', '21', 18, 25),
  ('check_in_radius_m', 'setting', '150', 50, 300),
  ('stats_min_people', 'setting', '5', 5, 20),
  ('event_confirmations', 'setting', '3', 2, 10),
  ('reports_strike_window_h', 'setting', '6', 1, 48);
