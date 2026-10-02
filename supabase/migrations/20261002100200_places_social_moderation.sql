-- Block 5 · Schema for places, activity, social and moderation (PRD 4.1). Logic arrives in
-- Blocks 7-9: for now these tables are read-only for clients (owner/admin policies) and
-- every write will go through server functions.

create type public.venue_type as enum (
  'nightclub', 'club', 'pub', 'bar', 'dive_bar', 'lounge', 'terrace', 'beach_club'
);
create type public.event_status as enum ('unconfirmed', 'confirmed', 'official', 'removed');

-- ── Venues and events ────────────────────────────────────────────────────────
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  type public.venue_type not null,
  address text not null check (char_length(address) <= 160),
  location extensions.geography (point, 4326) not null,
  hours text not null default '' check (char_length(hours) <= 60),
  price smallint not null default 2 check (price between 1 and 4),
  description text not null default '' check (char_length(description) <= 500),
  google_place_id text unique,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venues enable row level security;
create index venues_location_idx on public.venues using gist (location);
create trigger venues_touch before update on public.venues
  for each row execute function private.touch_updated_at();

-- Registered users see places (PRD 4.2); test places only for testers/admins.
create policy "venues: registered users" on public.venues
  for select to authenticated
  using (not is_test or (select private.sees_test_data()));

create table public.venue_managers (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);
alter table public.venue_managers enable row level security;
create index venue_managers_user_idx on public.venue_managers (user_id);
create policy "venue_managers: own or admin" on public.venue_managers
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create function private.manages_venue(_venue uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.venue_managers
                 where venue_id = _venue and user_id = (select auth.uid()))
$$;

create table public.venue_claims (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  evidence text not null check (char_length(evidence) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (venue_id, user_id)
);
alter table public.venue_claims enable row level security;
create index venue_claims_user_idx on public.venue_claims (user_id);
create index venue_claims_reviewer_idx on public.venue_claims (reviewed_by);
create policy "venue_claims: own or admin" on public.venue_claims
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create table public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  title text not null check (char_length(title) between 3 and 60),
  category text not null check (category in ('party', 'concert', 'meetup', 'other')),
  place_name text not null check (char_length(place_name) <= 80),
  address text not null check (char_length(address) <= 160),
  location extensions.geography (point, 4326) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  description text not null default '' check (char_length(description) <= 300),
  status public.event_status not null default 'unconfirmed',
  origin text not null check (origin in ('user', 'venue', 'import')),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.events enable row level security;
create index events_location_idx on public.events using gist (location);
create index events_venue_idx on public.events (venue_id);
create index events_created_by_idx on public.events (created_by);
create index events_starts_idx on public.events (starts_at);
create policy "events: registered users" on public.events
  for select to authenticated
  using (
    (status <> 'removed' and (not is_test or (select private.sees_test_data())))
    or (select private.is_admin())
  );

create table public.event_confirmations (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_confirmations enable row level security;
create index event_confirmations_user_idx on public.event_confirmations (user_id);
create policy "event_confirmations: own" on public.event_confirmations
  for select to authenticated using (user_id = (select auth.uid()));

create table public.event_reports (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('fake', 'dangerous', 'inappropriate')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_reports enable row level security;
create index event_reports_user_idx on public.event_reports (user_id);
create policy "event_reports: own or admin" on public.event_reports
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ── Activity (never raw GPS, PRD 4.1) ────────────────────────────────────────
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  kind text not null check (kind in ('check_in', 'going')),
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_test boolean not null default false,
  check (num_nonnulls(venue_id, event_id) = 1)
);
alter table public.attendance enable row level security;
create index attendance_user_idx on public.attendance (user_id);
create index attendance_venue_idx on public.attendance (venue_id, expires_at);
create index attendance_event_idx on public.attendance (event_id, expires_at);
create policy "attendance: own" on public.attendance
  for select to authenticated using (user_id = (select auth.uid()));

-- Aggregates only; shown through a thresholded function in Block 7 (PRD 4.3).
create table public.place_stats (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid unique references public.venues (id) on delete cascade,
  event_id uuid unique references public.events (id) on delete cascade,
  people integer not null default 0 check (people >= 0),
  average_age numeric(4, 1),
  green_percent integer check (green_percent between 0 and 100),
  ratio jsonb,
  going_tonight integer not null default 0 check (going_tonight >= 0),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(venue_id, event_id) = 1)
);
alter table public.place_stats enable row level security;
create policy "place_stats: admin" on public.place_stats
  for select to authenticated using ((select private.is_admin()));

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  vibe text not null check (vibe in ('fire', 'music', 'chill', 'packed', 'friendly')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(venue_id, event_id) = 1)
);
alter table public.ratings enable row level security;
create index ratings_user_idx on public.ratings (user_id);
create index ratings_venue_idx on public.ratings (venue_id);
create index ratings_event_idx on public.ratings (event_id);
create policy "ratings: own" on public.ratings
  for select to authenticated using (user_id = (select auth.uid()));

create table public.lost_and_found (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  parent_id uuid references public.lost_and_found (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  is_test boolean not null default false,
  check (num_nonnulls(venue_id, event_id) = 1)
);
alter table public.lost_and_found enable row level security;
create index lost_and_found_user_idx on public.lost_and_found (user_id);
create index lost_and_found_venue_idx on public.lost_and_found (venue_id);
create index lost_and_found_event_idx on public.lost_and_found (event_id);
create index lost_and_found_parent_idx on public.lost_and_found (parent_id);
create policy "lost_and_found: registered users" on public.lost_and_found
  for select to authenticated
  using (expires_at > now() and (not is_test or (select private.sees_test_data())));

-- ── Social ───────────────────────────────────────────────────────────────────
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'spark')),
  venue_id uuid references public.venues (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);
alter table public.likes enable row level security;
create index likes_to_idx on public.likes (to_user);
create index likes_venue_idx on public.likes (venue_id);
-- Likes sent are private (PRD 4.2); "who liked you" arrives as an entitled RPC (Block 8).
create policy "likes: own sent" on public.likes
  for select to authenticated using (from_user = (select auth.uid()));

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
alter table public.matches enable row level security;
create index matches_b_idx on public.matches (user_b);
create index matches_venue_idx on public.matches (venue_id);
create policy "matches: participants" on public.matches
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.messages enable row level security;
create index messages_match_idx on public.messages (match_id, created_at);
create index messages_sender_idx on public.messages (sender_id);

create function private.in_match(_match uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.matches
                 where id = _match and (select auth.uid()) in (user_a, user_b))
$$;

create policy "messages: participants" on public.messages
  for select to authenticated using ((select private.in_match(match_id)));

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create index blocks_blocked_idx on public.blocks (blocked_id);
create policy "blocks: own" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

-- ── Moderation (DSA) ─────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  target_event_id uuid references public.events (id) on delete set null,
  reason text not null check (reason in (
    'possible_minor', 'harassment', 'feel_followed', 'fake_profile', 'inappropriate', 'spam', 'other',
    'dsa_notice'
  )),
  comment text not null default '' check (char_length(comment) <= 2000),
  -- Public DSA notices come without an account (PRD 6.9).
  notice_reference text unique,
  status text not null default 'open' check (status in ('open', 'valid', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_target_user_idx on public.reports (target_user_id, created_at desc);
create index reports_target_event_idx on public.reports (target_event_id);
create policy "reports: own or admin" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));

create table public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  action text not null check (action in ('warning', 'content_removed', 'suspension', 'ban')),
  reason text not null check (char_length(reason) <= 80),
  explanation text not null check (char_length(explanation) between 5 and 2000),
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.moderation_decisions enable row level security;
create index moderation_decisions_user_idx on public.moderation_decisions (user_id);
create index moderation_decisions_report_idx on public.moderation_decisions (report_id);
create index moderation_decisions_by_idx on public.moderation_decisions (decided_by);
create policy "moderation_decisions: own or admin" on public.moderation_decisions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null unique references public.moderation_decisions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.appeals enable row level security;
create index appeals_user_idx on public.appeals (user_id);
create index appeals_resolver_idx on public.appeals (resolved_by);
create policy "appeals: own or admin" on public.appeals
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create table public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) <= 200),
  until timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
create index bans_user_idx on public.bans (user_id);
create index bans_created_by_idx on public.bans (created_by);
create policy "bans: admin" on public.bans
  for select to authenticated using ((select private.is_admin()));
