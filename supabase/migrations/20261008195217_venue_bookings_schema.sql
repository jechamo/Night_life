-- Roadmap 2026-10 R5 (1/3): table reservations without payment and guest lists. Additive;
-- nothing is reachable until an admin turns `venue_bookings_enabled` on.
insert into public.app_settings (key, kind, value, allowed_values)
values ('venue_bookings_enabled', 'flag', 'off', array['on', 'off'])
on conflict (key) do nothing;

-- Each venue opts in from its panel (free for every venue).
create table private.venue_booking_settings (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  reservations boolean not null default false,
  guestlists boolean not null default false,
  max_party smallint not null default 10 check (max_party between 2 and 20),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);
create index venue_booking_settings_updated_by_idx on private.venue_booking_settings(updated_by);

-- `user_id` becomes null after 90 days (only totals remain).
create table private.venue_reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  night_date date not null,
  arrive_at timestamptz not null,
  party smallint not null check (party between 1 and 20),
  kind text not null check (kind in ('table', 'bottle')),
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'rejected', 'cancelled', 'expired')),
  reason text check (char_length(reason) <= 200),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index venue_reservations_venue_idx on private.venue_reservations(venue_id, night_date);
create index venue_reservations_user_idx on private.venue_reservations(user_id, status);
create index venue_reservations_decided_by_idx on private.venue_reservations(decided_by);
create unique index venue_reservations_one_active on private.venue_reservations(venue_id, user_id, night_date)
  where status in ('requested', 'accepted') and user_id is not null;

-- One guest list per venue and night.
create table private.venue_guestlists (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  night_date date not null,
  title text not null check (char_length(btrim(title)) between 3 and 60),
  valid_until timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  unique (venue_id, night_date)
);
create index venue_guestlists_created_by_idx on private.venue_guestlists(created_by);

-- The door code is derived with an HMAC of the entry id (never stored).
create table private.venue_guestlist_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  list_id uuid not null references private.venue_guestlists(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'checked_in')),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id) on delete set null,
  is_test boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create unique index venue_guestlist_entries_one on private.venue_guestlist_entries(list_id, user_id)
  where user_id is not null;
create index venue_guestlist_entries_user_idx on private.venue_guestlist_entries(user_id);
create index venue_guestlist_entries_checked_in_by_idx on private.venue_guestlist_entries(checked_in_by);

alter table private.venue_booking_settings enable row level security;
alter table private.venue_reservations enable row level security;
alter table private.venue_guestlists enable row level security;
alter table private.venue_guestlist_entries enable row level security;
revoke all on private.venue_booking_settings, private.venue_reservations, private.venue_guestlists,
  private.venue_guestlist_entries from public, anon, authenticated;

-- Helpers.
create function private.require_bookings_flag() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.require_registered();
begin
 if coalesce(private.flag_value('venue_bookings_enabled'), 'off') <> 'on' then
  raise exception 'disabled' using errcode = '42501';
 end if;
 return u;
end $$;

-- Booking or joining a list also needs the verified age (owner decision).
create function private.require_bookings() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag();
begin
 if not private.is_age_verified(u) then raise exception 'age_required' using errcode = '42501'; end if;
 return u;
end $$;

create function private.guest_code(p_entry uuid) returns text
language sql stable security definer set search_path = '' as $$
 select upper(substr(private.hmac_hex('guest-entry:' || p_entry::text), 1, 10))
$$;

create function private.booking_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
 select coalesce((select btrim(name) from public.profiles where id = p_user), '—')
$$;

revoke all on function private.require_bookings_flag(), private.require_bookings(),
 private.guest_code(uuid), private.booking_name(uuid) from public, anon, authenticated;
