-- Block 7 · Places / attendance / events / vibe / lost-found RPCs (PRD 6.3-6.8).

create or replace function private.require_registered()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (
    select 1 from public.profiles
    where id = v_uid and onboarded_at is not null and not banned and not suspended
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_uid;
end
$$;

create or replace function private.require_age_verified()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
begin
  if not private.is_age_verified(v_uid) then
    raise exception 'age verification required' using errcode = '42501';
  end if;
  return v_uid;
end
$$;


-- Every read/write resolves the target before SECURITY DEFINER accesses it.
create or replace function private.require_place(p_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_test boolean;
begin
  perform private.require_registered();
  select is_test into v_test from public.venues where id=p_id;
  if not found then
    select is_test into v_test from public.events where id=p_id
      and status in ('unconfirmed','confirmed','official') and hidden_at is null and ends_at>now();
  end if;
  if v_test is null or (v_test and not private.sees_test_data()) then
    raise exception 'not found' using errcode='P0002';
  end if;
  return v_test;
end $$;
revoke all on function private.require_place(uuid) from public,anon,authenticated;

create table private.places_action_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null, bucket bigint not null, hits integer not null,
  created_at timestamptz not null default now(),
  primary key(user_id,action,bucket)
);
alter table private.places_action_limits enable row level security;
revoke all on private.places_action_limits from public,anon,authenticated;
create or replace function private.place_limit(p_action text,p_max integer,p_seconds integer default 3600)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_registered(); v_hits integer;
begin
 insert into private.places_action_limits(user_id,action,bucket,hits)
 values(v_uid,p_action,floor(extract(epoch from now())/p_seconds)::bigint,1)
 on conflict(user_id,action,bucket) do update set hits=private.places_action_limits.hits+1
 returning hits into v_hits;
 if v_hits>p_max then raise exception 'rate limited' using errcode='54000'; end if;
end $$;
revoke all on function private.place_limit(text,integer,integer) from public,anon,authenticated;

-- Thresholded stats payload (PRD 4.3).
create or replace function private.threshold_stats(
  p_people integer, p_average_age numeric, p_green integer, p_ratio jsonb, p_going integer
)
returns jsonb
language sql immutable set search_path = ''
as $$
  select case
    when p_people >= 5 then jsonb_build_object(
      'people', case when p_people=0 then 0 else 4 end,
      'averageAge', p_average_age,
      'greenPercent', p_green,
      'ratio', p_ratio,
      'goingTonight', coalesce(p_going, 0)
    )
    else jsonb_build_object(
      'people', p_people,
      'averageAge', null,
      'greenPercent', null,
      'ratio', null,
      'goingTonight', coalesce(p_going, 0)
    )
  end
$$;


-- Unique partial indexes for place_stats upsert (venue_id / event_id already UNIQUE nullable).
-- Postgres UNIQUE allows multiple NULLs; our CHECK ensures one of them. ON CONFLICT needs constraint.

create or replace function private.venue_open(p_hours jsonb,p_at timestamptz default now())
returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_hours)='array' then p_hours else '[]'::jsonb end) x
 where (x->>'day')::integer=extract(isodow from p_at at time zone 'Europe/Madrid')::integer-1
 and (((x->>'closes')::time > (x->>'opens')::time
       and (p_at at time zone 'Europe/Madrid')::time >= (x->>'opens')::time
       and (p_at at time zone 'Europe/Madrid')::time < (x->>'closes')::time)
   or ((x->>'closes')::time <= (x->>'opens')::time
       and (p_at at time zone 'Europe/Madrid')::time >= (x->>'opens')::time))
 ) or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_hours)='array' then p_hours else '[]'::jsonb end) x
 where (x->>'day')::integer=(extract(isodow from p_at at time zone 'Europe/Madrid')::integer+5)%7
 and (x->>'closes')::time <= (x->>'opens')::time
 and (p_at at time zone 'Europe/Madrid')::time < (x->>'closes')::time)
$$;
revoke all on function private.venue_open(jsonb,timestamptz) from public,anon,authenticated;
-- ── search_places ────────────────────────────────────────────────────────────
create or replace function private.search_places(
  p_lat double precision default null,
  p_lng double precision default null,
  p_query text default null,
  p_types text[] default null,
  p_city text default null,
  p_min_people integer default null,
  p_max_people integer default null,
  p_min_age integer default null,
  p_max_age integer default null,
  p_min_green integer default null,
  p_open_now boolean default null,
  p_sort text default 'distance',
  p_limit integer default 100
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_origin extensions.geography;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  perform private.place_limit('search',120);
  if (p_lat is null) <> (p_lng is null) then raise exception 'bad request' using errcode='22023'; end if;
  if p_lat is not null and p_lng is not null then
    if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
      raise exception 'bad request' using errcode = '22023';
    end if;
    v_origin := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.sort_key, x.name)
    from (
      select
        v.id,
        v.name,
        v.type::text as type,
        v.city,
        v.address,
        v.price,
        v.hours,
        v.phone,
        v.website,
        v.opening_hours as "openingHours",
        v.rating,
        v.rating_count as "ratingCount",
        v.music,
        v.dress_code as "dressCode",
        v.min_age as "minAge",
        v.accessibility,
        v.business_status as "businessStatus",
        v.google_maps_uri as "googleMapsUri",
        v.google_place_id as "googlePlaceId",
        v.catalog_owned as "catalogOwned",
        (v.google_expires_at is null or v.google_expires_at > now()) as "coordsValid",
        case when v.location_source<>'google' or v.google_expires_at>now()
          then extensions.st_y(v.location::extensions.geometry) end as lat,
        case when v.location_source<>'google' or v.google_expires_at>now()
          then extensions.st_x(v.location::extensions.geometry) end as lng,
        private.venue_open(v.opening_hours) as "openNow",
        case when v_origin is null then null
             else extensions.st_distance(v.location, v_origin)::integer end as "distanceM",
        case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end as people,
        case when coalesce(s.people, 0) >= 5 then s.average_age else null end as "averageAge",
        case when coalesce(s.people, 0) >= 5 then s.green_percent else null end as "greenPercent",
        case when coalesce(s.people, 0) >= 5 then s.ratio else null end as ratio,
        coalesce(s.going_tonight, 0) as "goingTonight",
        coalesce((
          select jsonb_object_agg(r.vibe, r.cnt)
          from (
            select vibe, count(*)::integer as cnt
            from public.ratings
            where venue_id = v.id and night_date = private.nightlife_night_date()
            group by vibe
          ) r
        ), '{}'::jsonb) as vibes,
        case p_sort
          when 'people_desc' then (-coalesce(s.people, 0))::double precision
          when 'people_asc' then coalesce(s.people, 0)::double precision
          when 'age' then coalesce(case when coalesce(s.people,0) >= 5 then s.average_age end, 999)::double precision
          when 'rating' then (-coalesce(v.rating, 0))::double precision
          else coalesce(case when v_origin is null then 0
                             else extensions.st_distance(v.location, v_origin) end, 0)
        end as sort_key
      from public.venues v
      left join public.place_stats s on s.venue_id = v.id
      where (not v.is_test or private.sees_test_data())
        and v.business_status <> 'CLOSED_PERMANENTLY'
        and (p_city is null or v.city = p_city)
        and (p_types is null or v.type::text = any(p_types))
        and (p_query is null or p_query = '' or v.name ilike '%' || p_query || '%'
             or v.address ilike '%' || p_query || '%')
        and (p_open_now is distinct from true or private.venue_open(v.opening_hours))
        and (p_min_people is null or (case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end) >= p_min_people)
        and (p_max_people is null or (case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end) <= p_max_people)
        -- Age / green filters only apply when the place has enough people (PRD 4.3).
        and (p_min_age is null or (coalesce(s.people, 0) >= 5 and s.average_age >= p_min_age))
        and (p_max_age is null or (coalesce(s.people, 0) >= 5 and s.average_age <= p_max_age))
        and (p_min_green is null or (coalesce(s.people, 0) >= 5 and s.green_percent >= p_min_green))
      order by sort_key, v.name
      limit v_limit
    ) x
  ), '[]'::jsonb);
end
$$;
revoke all on function private.search_places(double precision,double precision,text,text[],text,integer,integer,integer,integer,integer,boolean,text,integer) from public,anon,authenticated;
grant execute on function private.search_places(double precision,double precision,text,text[],text,integer,integer,integer,integer,integer,boolean,text,integer) to authenticated;
create or replace function public.search_places(
  p_lat double precision default null,
  p_lng double precision default null,
  p_query text default null,
  p_types text[] default null,
  p_city text default null,
  p_min_people integer default null,
  p_max_people integer default null,
  p_min_age integer default null,
  p_max_age integer default null,
  p_min_green integer default null,
  p_open_now boolean default null,
  p_sort text default 'distance',
  p_limit integer default 100
) returns jsonb
language sql security invoker set search_path='' as $$ select private.search_places(p_lat,p_lng,p_query,p_types,p_city,p_min_people,p_max_people,p_min_age,p_max_age,p_min_green,p_open_now,p_sort,p_limit) $$;
revoke all on function public.search_places(
  double precision, double precision, text, text[], text, integer, integer, integer, integer, integer, boolean, text, integer
) from public, anon;
grant execute on function public.search_places(
  double precision, double precision, text, text[], text, integer, integer, integer, integer, integer, boolean, text, integer
) to authenticated;

create or replace function private.list_cities()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct city order by city), '{}')
  from public.venues
  where not is_test or private.sees_test_data()
$$;
revoke all on function private.list_cities() from public,anon,authenticated;
grant execute on function private.list_cities() to authenticated;
create or replace function public.list_cities() returns text[]
language sql security invoker set search_path='' as $$ select private.list_cities() $$;
revoke all on function public.list_cities() from public, anon;
grant execute on function public.list_cities() to authenticated;

-- ── Attendance ───────────────────────────────────────────────────────────────
create or replace function private.check_in(
  p_place_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_visible boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_venue public.venues;
  v_dist double precision;
  v_expires timestamptz := now() + interval '2 hours';
  v_id uuid;
  v_is_event boolean := false;
  v_event public.events;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  perform private.place_limit('check_in',30);
  perform private.require_place(p_place_id);
  if not private.latest_consent(v_uid,'precise_location') and not
    (private.sees_test_data() and public.feature_enabled('test_tools_enabled') and private.require_place(p_place_id)) then
    raise exception 'no_location' using errcode='22023';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'bad request' using errcode='22023';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'no_location' using errcode = '22023';
  end if;

  select * into v_venue from public.venues where id = p_place_id;
  if v_venue.id is null then
    select * into v_event from public.events
    where id = p_place_id and status in ('confirmed', 'official', 'unconfirmed');
    if v_event.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
    v_is_event := true;
  end if;

  if p_visible and not private.is_age_verified(v_uid) then
    raise exception 'age verification required' using errcode = '42501';
  end if;

  if v_is_event then
    v_dist := extensions.st_distance(
      v_event.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    );
  else
    if v_venue.is_test and not private.sees_test_data() then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if v_venue.location_source='google' and v_venue.google_expires_at<=now() then
      raise exception 'no_location' using errcode='22023';
    end if;
    v_dist := extensions.st_distance(
      v_venue.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    );
  end if;

  if v_dist is null or v_dist >= 150 then
    raise exception 'too_far' using errcode = '22023';
  end if;

  -- One active check-in: close previous.
  update public.attendance
  set expires_at = now()
  where user_id = v_uid and kind = 'check_in' and expires_at > now();

  insert into public.attendance (user_id, venue_id, event_id, kind, visible, expires_at, is_test)
  values (
    v_uid,
    case when v_is_event then null else p_place_id end,
    case when v_is_event then p_place_id else null end,
    'check_in',
    coalesce(p_visible, false),
    v_expires,
    case when v_is_event then v_event.is_test else v_venue.is_test end
  )
  returning id into v_id;

  if v_is_event then
    perform private.recalc_place_stats(null, p_place_id);
  else
    perform private.recalc_place_stats(p_place_id, null);
  end if;

  perform private.recalc_all_active_stats();
  return public.my_attendance();
end
$$;
revoke all on function private.check_in(uuid,double precision,double precision,boolean) from public,anon,authenticated;
grant execute on function private.check_in(uuid,double precision,double precision,boolean) to authenticated;
create or replace function public.check_in(
  p_place_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_visible boolean default false
) returns jsonb
language sql security invoker set search_path='' as $$ select private.check_in(p_place_id,p_lat,p_lng,p_visible) $$;

create or replace function private.check_out()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  r record;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  for r in
    select venue_id, event_id from public.attendance
    where user_id = v_uid and kind = 'check_in' and expires_at > now()
  loop
    update public.attendance set expires_at = now()
    where user_id = v_uid and kind = 'check_in' and expires_at > now();
    perform private.recalc_place_stats(r.venue_id, r.event_id);
  end loop;
  return public.my_attendance();
end
$$;
revoke all on function private.check_out() from public,anon,authenticated;
grant execute on function private.check_out() to authenticated;
create or replace function public.check_out() returns jsonb
language sql security invoker set search_path='' as $$ select private.check_out() $$;

create or replace function private.set_going(p_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_age_verified();
  v_venue public.venues;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  perform private.place_limit('going',30);
  perform private.require_place(p_place_id);
  if not private.going_window_open() then
    raise exception 'outside_window' using errcode = '22023';
  end if;
  select * into v_venue from public.venues where id = p_place_id;
  if v_venue.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_venue.is_test and not private.sees_test_data() then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  update public.attendance set expires_at = now()
  where user_id = v_uid and kind = 'going' and expires_at > now();

  insert into public.attendance (user_id, venue_id, kind, visible, expires_at, is_test)
  values (v_uid, p_place_id, 'going', true, private.going_expires_at(), v_venue.is_test);

  perform private.recalc_place_stats(p_place_id, null);
  perform private.recalc_all_active_stats();
  return public.my_attendance();
end
$$;
revoke all on function private.set_going(uuid) from public,anon,authenticated;
grant execute on function private.set_going(uuid) to authenticated;
create or replace function public.set_going(p_place_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.set_going(p_place_id) $$;

create or replace function private.cancel_going()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  r record;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  for r in
    select venue_id from public.attendance
    where user_id = v_uid and kind = 'going' and expires_at > now()
  loop
    update public.attendance set expires_at = now()
    where user_id = v_uid and kind = 'going' and expires_at > now();
    perform private.recalc_place_stats(r.venue_id, null);
  end loop;
  return public.my_attendance();
end
$$;
revoke all on function private.cancel_going() from public,anon,authenticated;
grant execute on function private.cancel_going() to authenticated;
create or replace function public.cancel_going() returns jsonb
language sql security invoker set search_path='' as $$ select private.cancel_going() $$;

create or replace function private.my_attendance()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_check jsonb;
  v_going jsonb;
  v_last timestamptz;
begin
  select jsonb_build_object(
    'placeId', coalesce(venue_id, event_id),
    'since', created_at,
    'expiresAt', expires_at,
    'visible', visible
  ) into v_check
  from public.attendance
  where user_id = v_uid and kind = 'check_in' and expires_at > now()
  order by created_at desc limit 1;

  select jsonb_build_object(
    'placeId', venue_id,
    'expiresAt', expires_at
  ) into v_going
  from public.attendance
  where user_id = v_uid and kind = 'going' and expires_at > now()
  order by created_at desc limit 1;

  select max(created_at) into v_last
  from public.attendance
  where user_id = v_uid and kind = 'check_in';

  return jsonb_build_object(
    'checkIn', v_check,
    'going', v_going,
    'lastCheckInAt', v_last
  );
end
$$;
revoke all on function private.my_attendance() from public,anon,authenticated;
grant execute on function private.my_attendance() to authenticated;
create or replace function public.my_attendance() returns jsonb
language sql security invoker set search_path='' as $$ select private.my_attendance() $$;

revoke all on function public.check_in(uuid, double precision, double precision, boolean) from public, anon;
revoke all on function public.check_out() from public, anon;
revoke all on function public.set_going(uuid) from public, anon;
revoke all on function public.cancel_going() from public, anon;
revoke all on function public.my_attendance() from public, anon;
grant execute on function public.check_in(uuid, double precision, double precision, boolean) to authenticated;
grant execute on function public.check_out() to authenticated;
grant execute on function public.set_going(uuid) to authenticated;
grant execute on function public.cancel_going() to authenticated;
grant execute on function public.my_attendance() to authenticated;
