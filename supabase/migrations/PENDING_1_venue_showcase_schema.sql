-- Roadmap 2026-10 R4 (1/4): venue showcase schema (photos, details, notices, views).
-- Additive only; nothing is reachable until an admin turns `venue_showcase_enabled` on.
insert into public.app_settings (key, kind, value, allowed_values)
values ('venue_showcase_enabled', 'flag', 'off', array['on', 'off'])
on conflict (key) do nothing;

-- Private bucket (PRD 6.15 D): photos re-encoded on the device without EXIF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('venue-photos', 'venue-photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create table private.venue_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  path text not null unique check (char_length(path) <= 120),
  is_cover boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text check (char_length(reason) <= 200),
  uploaded_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);
create index venue_photos_venue_idx on private.venue_photos(venue_id, status, created_at);
create index venue_photos_pending_idx on private.venue_photos(created_at) where status = 'pending';
create index venue_photos_uploaded_by_idx on private.venue_photos(uploaded_by);
create index venue_photos_reviewed_by_idx on private.venue_photos(reviewed_by);
create unique index venue_photos_one_cover on private.venue_photos(venue_id) where is_cover;

create table private.venue_details (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  dress_code text check (dress_code in ('none', 'casual', 'smart', 'elegant')),
  min_age smallint check (min_age between 18 and 30),
  entry_price_cents integer check (entry_price_cents between 0 and 50000),
  drink_price_cents integer check (drink_price_cents between 0 and 10000),
  terrace boolean,
  accessible boolean,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp()
);
create index venue_details_updated_by_idx on private.venue_details(updated_by);

-- «Lo dice el local»: door status (90 min) and offers with an end time (max 8 h).
create table private.venue_notices (
  venue_id uuid not null references public.venues(id) on delete cascade,
  kind text not null check (kind in ('door', 'free_entry', 'happy_hour')),
  value text check (value in ('no_queue', 'short_queue', 'long_queue', 'almost_full', 'full')),
  until timestamptz not null,
  set_by uuid references auth.users(id) on delete set null,
  set_at timestamptz not null default clock_timestamp(),
  primary key (venue_id, kind),
  check ((kind = 'door') = (value is not null))
);
create index venue_notices_set_by_idx on private.venue_notices(set_by);

-- One view per person, venue and night. The mark is an HMAC (no user id) and lives 2 days;
-- the daily counter is all that is kept (400 days).
create table private.venue_view_marks (
  venue_id uuid not null references public.venues(id) on delete cascade,
  night_date date not null,
  viewer_hmac text not null,
  primary key (venue_id, night_date, viewer_hmac)
);
create table private.venue_daily_views (
  venue_id uuid not null references public.venues(id) on delete cascade,
  night_date date not null,
  views integer not null default 0 check (views >= 0),
  primary key (venue_id, night_date)
);

alter table private.venue_photos enable row level security;
alter table private.venue_details enable row level security;
alter table private.venue_notices enable row level security;
alter table private.venue_view_marks enable row level security;
alter table private.venue_daily_views enable row level security;
revoke all on private.venue_photos, private.venue_details, private.venue_notices,
  private.venue_view_marks, private.venue_daily_views from public, anon, authenticated;
