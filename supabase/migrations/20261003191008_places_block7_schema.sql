-- Block 7 · Enriched venues, event states, provider access (PRD 6.3-6.8, ADR 0010).

-- ── Event status: under_review (3 fake reports) and archived (ended) ──────────
alter type public.event_status add value if not exists 'under_review';
alter type public.event_status add value if not exists 'archived';

-- ── Venues: catalog fields + Google discovery metadata (EEA-compliant) ───────
alter table public.venues
  add column if not exists city text not null default 'Madrid'
    check (char_length(city) between 1 and 40),
  add column if not exists phone text not null default '' check (char_length(phone) <= 40),
  add column if not exists website text not null default '' check (char_length(website) <= 300),
  add column if not exists opening_hours jsonb not null default '[]'::jsonb,
  add column if not exists rating numeric(2, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  add column if not exists rating_count integer not null default 0 check (rating_count >= 0),
  add column if not exists photos jsonb not null default '[]'::jsonb,
  add column if not exists accessibility jsonb not null default '{}'::jsonb,
  add column if not exists business_status text not null default 'OPERATIONAL'
    check (business_status in ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY', 'UNKNOWN')),
  add column if not exists google_maps_uri text not null default '' check (char_length(google_maps_uri) <= 500),
  add column if not exists music text[] not null default '{}',
  add column if not exists dress_code text not null default '' check (char_length(dress_code) <= 80),
  add column if not exists min_age smallint check (min_age is null or (min_age between 18 and 25)),
  add column if not exists notes text not null default '' check (char_length(notes) <= 500),
  add column if not exists google_fetched_at timestamptz,
  add column if not exists google_expires_at timestamptz,
  add column if not exists catalog_owned boolean not null default true,
  add column if not exists location_source text not null default 'owner'
    check (location_source in ('owner', 'google', 'fixture'));

alter table public.venues alter column location drop not null;
alter table public.venues add constraint venues_google_cache_window check (
  location_source <> 'google' or location is null or (google_fetched_at is not null and google_expires_at is not null
    and google_expires_at <= google_fetched_at + interval '30 days')
);

create index if not exists venues_city_idx on public.venues (city);
create index if not exists venues_type_idx on public.venues (type);
create index if not exists venues_google_expires_idx on public.venues (google_expires_at)
  where google_expires_at is not null;

comment on column public.venues.catalog_owned is
  'Only independently supplied owner/manager/fixture content is editorial. Import does not transfer Google provenance.';
comment on column public.venues.google_expires_at is
  'EEA: lat/lng cache max 30 calendar days. Null = no Google coords to expire.';

-- ── Events: import identity + moderation hide ────────────────────────────────
alter table public.events
  add column if not exists hidden_at timestamptz,
  add column if not exists external_id text,
  add column if not exists source text not null default 'user'
    check (source in ('user', 'venue', 'import', 'fixture'));

create unique index if not exists events_external_id_uidx
  on public.events (source, external_id)
  where external_id is not null;

-- ── Ratings: one vote per user / place / night (Europe/Madrid) ───────────────
alter table public.ratings
  add column if not exists night_date date;

update public.ratings
set night_date = ((created_at at time zone 'Europe/Madrid') - interval '6 hours')::date
where night_date is null;

alter table public.ratings alter column night_date set not null;
alter table public.ratings alter column night_date set default
  (((now() at time zone 'Europe/Madrid') - interval '6 hours')::date);

drop index if exists ratings_user_venue_night_uidx;
create unique index ratings_user_venue_night_uidx
  on public.ratings (user_id, venue_id, night_date)
  where venue_id is not null;
drop index if exists ratings_user_event_night_uidx;
create unique index ratings_user_event_night_uidx
  on public.ratings (user_id, event_id, night_date)
  where event_id is not null;

-- ── Provider access (maps / places / events) — mirrors verification pattern ──
create table if not exists private.provider_access (
  capability text not null check (capability in ('mapbox', 'google_places', 'events_import')),
  mode text not null check (mode in ('demo', 'sandbox', 'live', 'fixture')),
  available boolean not null default false,
  free_access_confirmed boolean not null default false,
  expires_at timestamptz,
  confirmed_at timestamptz not null default now(),
  daily_budget integer not null default 0 check (daily_budget >= 0),
  daily_used integer not null default 0 check (daily_used >= 0),
  daily_reset_on date not null default (timezone('utc', now()))::date,
  monthly_budget integer not null default 0 check (monthly_budget >= 0),
  monthly_used integer not null default 0 check (monthly_used >= 0),
  monthly_reset_on date not null default date_trunc('month',now() at time zone 'UTC')::date,
  notes text not null default '',
  primary key (capability, mode)
);
alter table private.provider_access enable row level security;
revoke all on table private.provider_access from public, anon, authenticated;

insert into private.provider_access (capability, mode, available, expires_at, daily_budget, notes)
values
  ('mapbox', 'demo', false, null, 0, 'Awaiting proof of Demo without billing; account-specific monthly cap'),
  ('google_places', 'sandbox', false, null, 0, 'Awaiting Free Trial eligibility/end; no pay-as-you-go calls'),
  ('events_import', 'fixture', true, null, 0, 'Fixtures until a free authorised source exists')
on conflict (capability, mode) do nothing;

create or replace function private.provider_consume(p_capability text, p_mode text, p_n integer default 1)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v private.provider_access;
begin
  if p_n is null or p_n < 1 or p_n > 100 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  select * into v from private.provider_access
  where capability = p_capability and mode = p_mode for update;
  if v.capability is null or not v.available or not v.free_access_confirmed then return false; end if;
  if v.expires_at is not null and v.expires_at <= now() then return false; end if;
  if v.daily_reset_on < (timezone('utc', now()))::date then
    update private.provider_access
    set daily_used = 0, daily_reset_on = (timezone('utc', now()))::date
    where capability = p_capability and mode = p_mode;
    v.daily_used := 0;
  end if;
  if v.monthly_reset_on < date_trunc('month',now() at time zone 'UTC')::date then
    update private.provider_access set monthly_used=0,
      monthly_reset_on=date_trunc('month',now() at time zone 'UTC')::date
      where capability=p_capability and mode=p_mode;
    v.monthly_used:=0;
  end if;
  if v.monthly_budget=0 or v.monthly_used+p_n>v.monthly_budget then return false; end if;
  if v.daily_budget = 0 or v.daily_used + p_n > v.daily_budget then
    return false;
  end if;
  update private.provider_access
  set daily_used = daily_used + p_n, monthly_used=monthly_used+p_n
  where capability = p_capability and mode = p_mode;
  return true;
end
$$;
revoke all on function private.provider_consume(text, text, integer) from public, anon, authenticated;

create or replace function private.provider_available(p_capability text, p_mode text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.provider_access
    where capability = p_capability and mode = p_mode and available and free_access_confirmed
      and (expires_at is null or expires_at > now())
      and daily_budget > 0 and (daily_used < daily_budget
           or daily_reset_on < (timezone('utc', now()))::date)
      and monthly_budget>0 and (monthly_used<monthly_budget
           or monthly_reset_on<date_trunc('month',now() at time zone 'UTC')::date)
  )
$$;
revoke all on function private.provider_available(text, text) from public, anon, authenticated;

-- Admin read of provider budgets (MFA).
create or replace function private.admin_provider_access()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'capability', capability, 'mode', mode, 'available', available,
      'expiresAt', expires_at, 'dailyBudget', daily_budget,
      'dailyUsed', daily_used, 'dailyResetOn', daily_reset_on, 'notes', notes
    ) order by capability)
    from private.provider_access
  ), '[]'::jsonb);
end
$$;
revoke all on function private.admin_provider_access() from public,anon,authenticated;
grant execute on function private.admin_provider_access() to authenticated;
create or replace function public.admin_provider_access() returns jsonb
language sql security invoker set search_path='' as $$ select private.admin_provider_access() $$;
revoke all on function public.admin_provider_access() from public, anon;
grant execute on function public.admin_provider_access() to authenticated;

-- ── Night helper (18:00 → 06:00 Europe/Madrid) ───────────────────────────────
create or replace function private.nightlife_night_date(p_at timestamptz default now())
returns date
language sql immutable set search_path = ''
as $$
  select ((p_at at time zone 'Europe/Madrid') - interval '6 hours')::date
$$;

create or replace function private.going_window_open(p_at timestamptz default now())
returns boolean
language sql stable set search_path = ''
as $$
  select extract(hour from (p_at at time zone 'Europe/Madrid')) >= 18
      or extract(hour from (p_at at time zone 'Europe/Madrid')) < 6
$$;

create or replace function private.going_expires_at(p_at timestamptz default now())
returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Europe/Madrid';
  v_end timestamp;
begin
  if extract(hour from v_local) >= 18 then
    v_end := date_trunc('day', v_local) + interval '1 day' + interval '6 hours';
  else
    v_end := date_trunc('day', v_local) + interval '6 hours';
  end if;
  return v_end at time zone 'Europe/Madrid';
end
$$;
