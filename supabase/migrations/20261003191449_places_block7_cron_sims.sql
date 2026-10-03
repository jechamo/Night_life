-- Block 7 · Expiry jobs, pg_cron, simuladores persistidos, Realtime RLS, venue upsert.

create or replace function private.threshold_stats(
 p_people integer,p_average_age numeric,p_green integer,p_ratio jsonb,p_going integer
) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('people',case when p_people>=5 then p_people when p_people=0 then 0 else 4 end,
 'averageAge',case when p_people>=5 then p_average_age end,
 'greenPercent',case when p_people>=5 then p_green end,
 'ratio',case when p_people>=5 then p_ratio end,'goingTonight',coalesce(p_going,0))
$$;
revoke all on function private.threshold_stats(integer,numeric,integer,jsonb,integer) from public,anon,authenticated;

-- Cleaner vibe vote (one per user/place/night).
create or replace function private.vote_vibe(p_place_id uuid, p_vibe text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_is_venue boolean;
begin
  perform private.require_place(p_place_id);
  perform private.place_limit('vibe',60);
  if p_vibe not in ('fire', 'music', 'chill', 'packed', 'friendly') then
    raise exception 'bad request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.attendance
    where user_id = v_uid and kind = 'check_in' and expires_at > now()
      and (venue_id = p_place_id or event_id = p_place_id)
  ) then
    raise exception 'no_check_in' using errcode = '22023';
  end if;

  v_is_venue := exists (select 1 from public.venues where id = p_place_id);
  if v_is_venue then
    insert into public.ratings (user_id, venue_id, vibe, night_date)
    values (v_uid, p_place_id, p_vibe, private.nightlife_night_date())
    on conflict (user_id, venue_id, night_date) where venue_id is not null
    do update set vibe = excluded.vibe, created_at = now();
  else
    insert into public.ratings (user_id, event_id, vibe, night_date)
    values (v_uid, p_place_id, p_vibe, private.nightlife_night_date())
    on conflict (user_id, event_id, night_date) where event_id is not null
    do update set vibe = excluded.vibe, created_at = now();
  end if;
  return jsonb_build_object('ok', true, 'vibe', p_vibe);
end
$$;
revoke all on function private.vote_vibe(uuid,text) from public,anon,authenticated;
grant execute on function private.vote_vibe(uuid,text) to authenticated;
create or replace function public.vote_vibe(p_place_id uuid, p_vibe text) returns jsonb
language sql security invoker set search_path='' as $$ select private.vote_vibe(p_place_id,p_vibe) $$;

-- Unique indexes that support ON CONFLICT ... WHERE
drop index if exists ratings_user_venue_night_uidx;
create unique index ratings_user_venue_night_uidx
  on public.ratings (user_id, venue_id, night_date)
  where venue_id is not null;
drop index if exists ratings_user_event_night_uidx;
create unique index ratings_user_event_night_uidx
  on public.ratings (user_id, event_id, night_date)
  where event_id is not null;

-- ── Expiry / maintenance ─────────────────────────────────────────────────────
create or replace function private.run_places_expiry(p_test_only boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_events integer; v_lost integer; v_coords integer;
begin
 update public.events set status='removed',hidden_at=now()
 where status='unconfirmed' and created_at<=now()-interval '24 hours' and (not p_test_only or is_test);
 get diagnostics v_events=row_count;
 update public.events set status='archived' where status in ('confirmed','official') and ends_at<=now() and (not p_test_only or is_test);
 delete from public.lost_and_found where expires_at<=now() and (not p_test_only or is_test);
 get diagnostics v_lost=row_count;
 update public.venues set location=null,google_fetched_at=null
 where location_source='google' and google_expires_at<=now() and (not p_test_only or is_test);
 get diagnostics v_coords=row_count;
 delete from private.places_action_limits where created_at<now()-interval '2 days';
 return jsonb_build_object('unconfirmedRemoved',v_events,'lostDeleted',v_lost,'coordsCleared',v_coords);
end $$;
revoke all on function private.run_places_expiry(boolean) from public, anon, authenticated;

create or replace function private.recalc_all_active_stats()
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  for r in
    select distinct venue_id as id, 'venue'::text as kind from public.attendance
    where kind = 'check_in' and expires_at > now() and venue_id is not null
    union
    select distinct event_id, 'event' from public.attendance
    where kind = 'check_in' and expires_at > now() and event_id is not null
    union
    select venue_id, 'venue' from public.place_stats where venue_id is not null
    union select event_id, 'event' from public.place_stats where event_id is not null
  loop
    if r.kind = 'venue' then
      perform private.recalc_place_stats(r.id, null);
    else
      perform private.recalc_place_stats(null, r.id);
    end if;
  end loop;
end
$$;
revoke all on function private.recalc_all_active_stats() from public, anon, authenticated;

-- Cron wrapper callable by Edge with service role / vault secret via RPC.
create or replace function private.cron_places_tick()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_exp jsonb;
begin
  -- Only service_role (no JWT user) or admin.
  if coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_exp := private.run_places_expiry();
  perform private.recalc_all_active_stats();
  return v_exp || jsonb_build_object('statsRecalc', true);
end
$$;
revoke all on function private.cron_places_tick() from public,anon,authenticated;
grant execute on function private.cron_places_tick() to service_role;
create or replace function public.cron_places_tick() returns jsonb
language sql security invoker set search_path='' as $$ select private.cron_places_tick() $$;
revoke all on function public.cron_places_tick() from public, anon, authenticated;
grant execute on function public.cron_places_tick() to service_role;

-- Enable pg_cron if available and schedule jobs.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise exception 'pg_cron not available: %', sqlerrm;
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in (
      'nl_places_stats', 'nl_places_expiry', 'nl_places_coords_refresh'
    );
    perform cron.schedule('nl_places_stats', '* * * * *',
      $cron$ select private.recalc_all_active_stats() $cron$);
    perform cron.schedule('nl_places_expiry', '* * * * *',
      $cron$ select private.run_places_expiry() $cron$);
  end if;
exception when others then
  raise exception 'cron schedule failed: %',sqlerrm;
end
$$;

-- ── Venue upsert for Edge import (service_role) ──────────────────────────────
create or replace function private.upsert_venue_from_google(p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_lat float8:=(p->>'lat')::float8; v_lng float8:=(p->>'lng')::float8;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p->>'googlePlaceId' is null or v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then raise exception 'bad request' using errcode='22023'; end if;
 insert into public.venues(name,type,address,location,google_place_id,city,google_fetched_at,google_expires_at,location_source,catalog_owned)
 values('place:'||left(p->>'googlePlaceId',60),coalesce((p->>'type')::public.venue_type,'bar'),'',extensions.st_setsrid(extensions.st_makepoint(v_lng,v_lat),4326)::extensions.geography,p->>'googlePlaceId',p->>'city',now(),now()+interval '30 days','google',false)
 on conflict(google_place_id) do update set
 location=case when public.venues.location_source='owner' then public.venues.location else excluded.location end,
 google_fetched_at=excluded.google_fetched_at,google_expires_at=excluded.google_expires_at
 returning id into v_id;
 return v_id;
end $$;
revoke all on function private.upsert_venue_from_google(jsonb) from public, anon, authenticated;
grant execute on function private.upsert_venue_from_google(jsonb) to service_role;

create or replace function public.admin_upsert_venue_from_google(p jsonb)
returns uuid language sql security invoker set search_path='' as $$ select private.upsert_venue_from_google(p) $$;
revoke all on function public.admin_upsert_venue_from_google(jsonb) from public, anon;
revoke all on function public.admin_upsert_venue_from_google(jsonb) from authenticated;
grant execute on function public.admin_upsert_venue_from_google(jsonb) to service_role;

-- ── Simulators (tester/admin + flag, is_test only) ───────────────────────────
create or replace function private.assert_test_tools()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := private.require_registered();
begin
  if not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_uid;
end
$$;

create or replace function private.sim_fill_venue(p_venue uuid, p_count integer default 25)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.assert_test_tools();
  v_n integer := least(greatest(coalesce(p_count, 25), 1), 40);
  r record;
  v_added integer := 0;
begin
  if not exists(select 1 from public.venues where id=p_venue and is_test) then
    raise exception 'not found' using errcode='P0002';
  end if;

  for r in
    select p.id from public.profiles p
    where p.is_test and p.onboarded_at is not null and not p.banned
      and not exists (
        select 1 from public.attendance a
        where a.user_id = p.id and a.kind = 'check_in' and a.expires_at > now()
      )
    limit v_n
  loop
    insert into public.attendance (user_id, venue_id, kind, visible, expires_at, is_test)
    values (r.id, p_venue, 'check_in', true, now() + interval '2 hours', true);
    v_added := v_added + 1;
  end loop;

  perform private.recalc_place_stats(p_venue, null);
  perform private.audit('test_tool.fill_venue', p_venue::text || ':' || v_added::text);
  return jsonb_build_object('added', v_added, 'venueId', p_venue);
end
$$;
revoke all on function private.sim_fill_venue(uuid,integer) from public,anon,authenticated;
grant execute on function private.sim_fill_venue(uuid,integer) to authenticated;
create or replace function public.sim_fill_venue(p_venue uuid, p_count integer default 25) returns jsonb
language sql security invoker set search_path='' as $$ select private.sim_fill_venue(p_venue,p_count) $$;

create or replace function private.sim_advance_expiry()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.assert_test_tools();
  v_events integer;
  v_att integer;
  v_lost integer;
begin
  update public.events
  set created_at = now() - interval '25 hours'
  where is_test and status = 'unconfirmed';
  get diagnostics v_events = row_count;

  update public.attendance
  set expires_at = now() - interval '1 minute'
  where is_test and expires_at > now();
  get diagnostics v_att = row_count;

  update public.lost_and_found
  set expires_at = now() - interval '1 minute'
  where is_test and expires_at > now();
  get diagnostics v_lost = row_count;

  perform private.run_places_expiry(true);
  perform private.recalc_all_active_stats();
  perform private.audit('test_tool.expire_everything',
    format('events=%s attendance=%s lost=%s', v_events, v_att, v_lost));
  return jsonb_build_object(
    'eventsBackdated', v_events, 'attendanceExpired', v_att, 'lostExpired', v_lost
  );
end
$$;
revoke all on function private.sim_advance_expiry() from public,anon,authenticated;
grant execute on function private.sim_advance_expiry() to authenticated;
create or replace function public.sim_advance_expiry() returns jsonb
language sql security invoker set search_path='' as $$ select private.sim_advance_expiry() $$;

create or replace function private.sim_import_events(p_city text default 'Madrid', p_count integer default 3)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.assert_test_tools();
  v_n integer := least(greatest(coalesce(p_count, 3), 1), 10);
  v_venue public.venues;
  i integer;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  select * into v_venue from public.venues
  where city = coalesce(p_city, 'Madrid') and is_test
  order by is_test desc, name limit 1;
  if v_venue.id is null then raise exception 'not found' using errcode = 'P0002'; end if;

  for i in 1..v_n loop
    insert into public.events (
      venue_id, title, category, place_name, address, location,
      starts_at, ends_at, description, status, origin, source, external_id, is_test
    ) values (
      v_venue.id,
      'Fixture ' || p_city || ' #' || i,
      (array['party', 'concert', 'meetup', 'other'])[1 + ((i - 1) % 4)],
      v_venue.name, v_venue.address, v_venue.location,
      now() + (i || ' hours')::interval,
      now() + ((i + 4) || ' hours')::interval,
      'Evento de prueba importado',
      'confirmed', 'import', 'fixture',
      'fixture:' || p_city || ':' || i || ':' || (now() at time zone 'Europe/Madrid')::date,
      true
    ) on conflict(source,external_id) where external_id is not null
      do update set title=excluded.title returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  perform private.audit('test_tool.import_events', p_city || ':' || v_n::text);
  return jsonb_build_object('ids', to_jsonb(v_ids), 'count', v_n);
end
$$;
revoke all on function private.sim_import_events(text,integer) from public,anon,authenticated;
grant execute on function private.sim_import_events(text,integer) to authenticated;
create or replace function public.sim_import_events(p_city text default 'Madrid', p_count integer default 3) returns jsonb
language sql security invoker set search_path='' as $$ select private.sim_import_events(p_city,p_count) $$;

revoke all on function public.sim_fill_venue(uuid, integer) from public, anon;
revoke all on function public.sim_advance_expiry() from public, anon;
revoke all on function public.sim_import_events(text, integer) from public, anon;
grant execute on function public.sim_fill_venue(uuid, integer) to authenticated;
grant execute on function public.sim_advance_expiry() to authenticated;
grant execute on function public.sim_import_events(text, integer) to authenticated;

-- ── Realtime: authenticated can receive private broadcast on place-stats ─────
do $$
begin
  -- Supabase Realtime authorization (broadcast).
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'realtime' and table_name = 'messages'
  ) then
    execute $pol$
      drop policy if exists "place-stats read" on realtime.messages;
      create policy "place-stats read" on realtime.messages
        for select to authenticated
        using (
          realtime.messages.extension = 'broadcast'
          and exists(select 1 from public.profiles where id=(select auth.uid())
            and onboarded_at is not null and not banned and not suspended)
          and (realtime.topic()='place-stats:live' or (realtime.topic()='place-stats:test' and private.sees_test_data()))
        );
    $pol$;
  end if;
exception when others then
  raise notice 'realtime policy skipped: %', sqlerrm;
end
$$;

-- Read place_stats via thresholded RPC for clients (admin raw table stays admin-only).
create or replace function private.get_place_stats(p_place_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare s public.place_stats;
begin
  perform private.require_place(p_place_id);
  select * into s from public.place_stats
  where venue_id = p_place_id or event_id = p_place_id;
  if s.id is null then
    return private.threshold_stats(0, null, null, null, 0);
  end if;
  return private.threshold_stats(s.people, s.average_age, s.green_percent, s.ratio, s.going_tonight);
end
$$;
revoke all on function private.get_place_stats(uuid) from public,anon,authenticated;
grant execute on function private.get_place_stats(uuid) to authenticated;
create or replace function public.get_place_stats(p_place_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_place_stats(p_place_id) $$;
revoke all on function public.get_place_stats(uuid) from public, anon;
grant execute on function public.get_place_stats(uuid) to authenticated;

-- Read-only clients cannot fetch expired Google coordinates or hidden events directly.
drop policy "venues: registered users" on public.venues;
create policy "venues: registered users" on public.venues for select to authenticated
using ((not is_test or (select private.sees_test_data()))
  and (location_source<>'google' or google_expires_at>now())
  and exists(select 1 from public.profiles where id=(select auth.uid())
    and onboarded_at is not null and not banned and not suspended));
drop policy "events: registered users" on public.events;
create policy "events: registered users" on public.events for select to authenticated
using ((status in ('unconfirmed','confirmed','official') and hidden_at is null
  and (not is_test or (select private.sees_test_data()))) or (select private.is_admin()));
revoke all on function private.require_registered(),private.require_age_verified()
  from public,anon,authenticated;

alter table public.venues add column fixture_key text unique;
create or replace function private.sim_seed_places()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.assert_test_tools(); c record; i integer; v_id uuid; v_count integer:=0;
begin
 for c in select * from (values
  ('Madrid',40.4168,-3.7038),('Barcelona',41.3874,2.1686),('Valencia',39.4699,-0.3763),
  ('Sevilla',37.3891,-5.9845),('Málaga',36.7213,-4.4214),('Bilbao',43.263,-2.935),
  ('Ibiza',38.9067,1.4206),('Zaragoza',41.6488,-0.8891)
 ) as cities(city,lat,lng) loop
  for i in 1..2 loop
   insert into public.venues(name,type,address,location,city,description,hours,opening_hours,
    music,dress_code,min_age,notes,is_test,location_source,fixture_key)
   values('DEMO · '||c.city||' · '||case when i=1 then 'Club' else 'Bar' end,
    case when i=1 then 'club'::public.venue_type else 'bar'::public.venue_type end,
    'Dirección ficticia · '||c.city,
    extensions.st_setsrid(extensions.st_makepoint(c.lng+i*0.0003,c.lat+i*0.0003),4326)::extensions.geography,
    c.city,'Local ficticio para probar el catálogo.','18:00–06:00',
    (select jsonb_agg(jsonb_build_object('day',d,'opens','18:00','closes','06:00')) from generate_series(0,6) d),
    array['house','pop'],'Casual',18,'Datos de prueba; no es un negocio real.',true,'fixture','block7:'||c.city||':'||i)
   on conflict(fixture_key) do update set fixture_key=excluded.fixture_key returning id into v_id;
   v_count:=v_count+1;
  end loop;
 end loop;
 perform private.audit('test_tool.seed_places',v_count::text||' fixtures;8 cities');
 return jsonb_build_object('count',v_count,'cities',8);
end $$;
revoke all on function private.sim_seed_places() from public,anon,authenticated;
grant execute on function private.sim_seed_places() to authenticated;
create or replace function public.sim_seed_places() returns jsonb
language sql security invoker set search_path='' as $$ select private.sim_seed_places() $$;
revoke all on function public.sim_seed_places() from public,anon;
grant execute on function public.sim_seed_places() to authenticated;

create or replace function private.provider_reserve(p_capability text,p_mode text,p_n integer default 1)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 return private.provider_consume(p_capability,p_mode,p_n);
end $$;
revoke all on function private.provider_reserve(text,text,integer) from public,anon,authenticated;
grant execute on function private.provider_reserve(text,text,integer) to service_role;
create or replace function public.provider_reserve(p_capability text,p_mode text,p_n integer default 1)
returns boolean language sql security invoker set search_path='' as $$ select private.provider_reserve(p_capability,p_mode,p_n) $$;
revoke all on function public.provider_reserve(text,text,integer) from public,anon,authenticated;
grant execute on function public.provider_reserve(text,text,integer) to service_role;

create schema if not exists api;
revoke all on schema api from public,anon;
grant usage on schema api to authenticated,service_role;
create view api.venues_public with(security_invoker=true) as
select id,name,type,address,city,description,music,dress_code,min_age,hours,opening_hours,
 phone,website,is_test,google_place_id,google_fetched_at,google_expires_at,
 case when location_source<>'google' or google_expires_at>now() then location end as location
from public.venues;
grant select on api.venues_public to authenticated;
