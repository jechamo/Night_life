-- Roadmap 2026-10 R2: «Cómo está ahora». Additive: the existing Vibe Check is untouched and
-- nothing is reachable until an admin turns `live_status_enabled` on (checked server-side).
insert into public.app_settings (key, kind, value, allowed_values)
values ('live_status_enabled', 'flag', 'off', array['on', 'off'])
on conflict (key) do nothing;

-- Venue-declared line-up for tonight; it expires by itself when the night changes.
alter table public.venues
  add column if not exists tonight_lineup text check (char_length(tonight_lineup) <= 120),
  add column if not exists lineup_night date;

-- One vote per person, place, question and night (changing it updates the row).
-- Private schema, RLS on and no grants: reachable only through the functions below.
create table private.place_reports (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid references public.venues(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  dimension text not null check (dimension in ('crowd', 'queue', 'music_like', 'music_genre')),
  value text not null check (char_length(value) <= 20),
  night_date date not null,
  is_test boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  check (num_nonnulls(venue_id, event_id) = 1)
);
create unique index place_reports_venue_vote on private.place_reports(user_id, venue_id, dimension, night_date) where venue_id is not null;
create unique index place_reports_event_vote on private.place_reports(user_id, event_id, dimension, night_date) where event_id is not null;
create index place_reports_venue_recent on private.place_reports(venue_id, dimension, updated_at);
create index place_reports_event_recent on private.place_reports(event_id, dimension, updated_at);
alter table private.place_reports enable row level security;
revoke all on private.place_reports from public, anon, authenticated;

create function private.live_status_values(p_dimension text) returns text[]
language sql immutable set search_path = '' as $$
 select case p_dimension
  when 'crowd' then array['empty', 'normal', 'busy', 'packed']
  when 'queue' then array['none', 'short', 'long']
  when 'music_like' then array['yes', 'no']
  when 'music_genre' then array['reggaeton', 'latin', 'commercial', 'pop', 'techno', 'house',
    'electronic', 'hiphop', 'rock', 'indie', 'other']
 end
$$;

-- Fail closed: complete, non-banned account AND the flag on.
create function private.require_live_status() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.require_registered();
begin
 if coalesce(private.flag_value('live_status_enabled'), 'off') <> 'on' then
  raise exception 'disabled' using errcode = '42501';
 end if;
 return u;
end $$;

-- Aggregates only: counts of the last 90 minutes, shown from 3 votes. Test accounts'
-- votes count only for testers/admins. «Usually» = most voted crowd value on the same
-- weekday night and hour over 8 weeks, from 5 votes.
create function private.place_live_status(p_place uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 u uuid := private.require_live_status();
 d text; counts jsonb; total integer; result jsonb := '{}'; mine jsonb; declared jsonb := null;
 usual text; usual_total integer;
begin
 perform private.require_place(p_place);
 perform private.place_limit('live-status-read', 600);
 foreach d in array array['crowd', 'queue', 'music_like', 'music_genre'] loop
  select coalesce(jsonb_object_agg(x.value, x.n), '{}'), coalesce(sum(x.n), 0)::integer
  into counts, total from (
   select r.value, count(*)::integer n from private.place_reports r
   where (r.venue_id = p_place or r.event_id = p_place) and r.dimension = d
    and r.updated_at > now() - interval '90 minutes'
    and (not r.is_test or private.sees_test_data())
   group by r.value) x;
  result := result || jsonb_build_object(d, jsonb_build_object('total', total,
   'counts', case when total >= 3 then counts end));
 end loop;
 select coalesce(jsonb_object_agg(r.dimension, r.value), '{}') into mine from private.place_reports r
 where r.user_id = u and (r.venue_id = p_place or r.event_id = p_place)
  and r.night_date = private.nightlife_night_date() and r.updated_at > now() - interval '90 minutes';
 select jsonb_build_object('genres', to_jsonb(coalesce(v.music, '{}')),
  'lineup', case when v.lineup_night = private.nightlife_night_date() then v.tonight_lineup end)
 into declared from public.venues v where v.id = p_place;
 select x.value, x.slot_total into usual, usual_total from (
  select r.value, count(*) n, sum(count(*)) over ()::integer slot_total from private.place_reports r
  where (r.venue_id = p_place or r.event_id = p_place) and r.dimension = 'crowd'
   and r.night_date < private.nightlife_night_date()
   and r.night_date >= private.nightlife_night_date() - 56
   and extract(isodow from r.night_date) = extract(isodow from private.nightlife_night_date())
   and extract(hour from r.updated_at at time zone 'Europe/Madrid') = extract(hour from now() at time zone 'Europe/Madrid')
   and (not r.is_test or private.sees_test_data())
  group by r.value order by count(*) desc, r.value limit 1) x;
 return jsonb_build_object('windowMinutes', 90, 'minVotes', 3) || result || jsonb_build_object(
  'mine', mine, 'declared', declared,
  'usually', case when coalesce(usual_total, 0) >= 5 then usual end);
end $$;

create function private.report_place_status(p_place uuid, p_dimension text, p_value text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_live_status(); v_test boolean;
begin
 perform private.require_place(p_place);
 perform private.place_limit('live-status', 60);
 if p_dimension is null or private.live_status_values(p_dimension) is null
  or p_value is null or not (p_value = any (private.live_status_values(p_dimension))) then
  raise exception 'bad request' using errcode = '22023';
 end if;
 if not exists (select 1 from public.attendance where user_id = u and kind = 'check_in'
  and expires_at > now() and (venue_id = p_place or event_id = p_place)) then
  raise exception 'no_check_in' using errcode = '22023';
 end if;
 if private.manages_venue(p_place) then raise exception 'own_venue' using errcode = '42501'; end if;
 select is_test into v_test from public.profiles where id = u;
 if exists (select 1 from public.venues where id = p_place) then
  insert into private.place_reports(user_id, venue_id, dimension, value, night_date, is_test)
  values (u, p_place, p_dimension, p_value, private.nightlife_night_date(), coalesce(v_test, false))
  on conflict (user_id, venue_id, dimension, night_date) where venue_id is not null
  do update set value = excluded.value, updated_at = clock_timestamp();
 else
  insert into private.place_reports(user_id, event_id, dimension, value, night_date, is_test)
  values (u, p_place, p_dimension, p_value, private.nightlife_night_date(), coalesce(v_test, false))
  on conflict (user_id, event_id, dimension, night_date) where event_id is not null
  do update set value = excluded.value, updated_at = clock_timestamp();
 end if;
 return private.place_live_status(p_place);
end $$;

-- Venue managers declare up to 3 styles and tonight's line-up.
create function private.venue_set_music(p_venue uuid, p_genres text[], p_lineup text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare lineup text := nullif(btrim(coalesce(p_lineup, '')), '');
begin
 perform private.require_live_status();
 perform private.require_venue_manager(p_venue);
 perform private.case_limit('venue-music', 30);
 if not exists (select 1 from public.venues where id = p_venue) or p_genres is null
  or cardinality(p_genres) > 3
  or exists (select 1 from unnest(p_genres) g where not (g = any (private.live_status_values('music_genre'))))
  or char_length(coalesce(lineup, '')) > 120 then
  raise exception 'bad request' using errcode = '22023';
 end if;
 update public.venues set music = array(select distinct g from unnest(p_genres) g order by g),
  tonight_lineup = lineup, lineup_night = case when lineup is null then null else private.nightlife_night_date() end,
  catalog_owned = true
 where id = p_venue;
 perform private.audit('venue.music', p_venue::text);
 return private.place_live_status(p_venue);
end $$;

-- GDPR access: the export also includes the person's own votes.
alter function private.export_my_data() rename to export_my_data_core;
create function private.export_my_data() returns jsonb
language sql security definer set search_path = '' as $$
 select private.export_my_data_core() || jsonb_build_object('place_reports', coalesce((
  select jsonb_agg(jsonb_build_object('placeId', coalesce(r.venue_id, r.event_id), 'question', r.dimension,
   'answer', r.value, 'night', r.night_date, 'updatedAt', r.updated_at) order by r.updated_at desc)
  from private.place_reports r where r.user_id = (select auth.uid())), '[]'::jsonb))
$$;

-- Retention: votes older than 60 days are deleted every night.
create function private.place_reports_retention() returns void
language sql security definer set search_path = '' as $$
 delete from private.place_reports where updated_at < now() - interval '60 days'
$$;

create function public.place_live_status(p_place uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.place_live_status(p_place) $$;
create function public.report_place_status(p_place uuid, p_dimension text, p_value text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.report_place_status(p_place, p_dimension, p_value) $$;
create function public.venue_set_music(p_venue uuid, p_genres text[], p_lineup text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.venue_set_music(p_venue, p_genres, p_lineup) $$;

revoke all on function private.live_status_values(text), private.require_live_status(),
 private.place_reports_retention(), private.export_my_data_core() from public, anon, authenticated;
revoke all on function private.place_live_status(uuid), private.report_place_status(uuid, text, text),
 private.venue_set_music(uuid, text[], text), private.export_my_data(),
 public.place_live_status(uuid), public.report_place_status(uuid, text, text),
 public.venue_set_music(uuid, text[], text) from public, anon;
grant execute on function private.place_live_status(uuid), private.report_place_status(uuid, text, text),
 private.venue_set_music(uuid, text[], text), private.export_my_data(),
 public.place_live_status(uuid), public.report_place_status(uuid, text, text),
 public.venue_set_music(uuid, text[], text) to authenticated;

select cron.schedule('nl_place_reports_retention', '17 3 * * *', 'select private.place_reports_retention()');
notify pgrst, 'reload schema';
