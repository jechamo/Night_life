-- Block 7 · completion: map-load reservation, admin catalogue, safe editorial
-- updates and change-only stats broadcast (PRD 6.3-6.5, ADR 0010).

-- ── Mapbox public token (pk.*) lives server-side; a load is reserved before handing it out ──
alter table private.provider_access
  add column if not exists public_token text not null default ''
    check (public_token = '' or public_token ~ '^pk\.[A-Za-z0-9_.-]{20,290}$');

create or replace function private.reserve_map_load()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  perform private.require_registered();
  perform private.place_limit('map_load', 30);
  select public_token into v_token from private.provider_access
  where capability = 'mapbox' and mode = 'free_quota';
  if coalesce(v_token, '') = '' then
    return jsonb_build_object('granted', false, 'reason', 'no_token');
  end if;
  if not private.provider_consume('mapbox', 'free_quota', 1) then
    return jsonb_build_object('granted', false, 'reason', 'quota');
  end if;
  return jsonb_build_object('granted', true, 'token', v_token);
end $$;
revoke all on function private.reserve_map_load() from public, anon, authenticated;
grant execute on function private.reserve_map_load() to authenticated;
create or replace function public.reserve_map_load() returns jsonb
language sql security invoker set search_path = '' as $$ select private.reserve_map_load() $$;
revoke all on function public.reserve_map_load() from public, anon;
grant execute on function public.reserve_map_load() to authenticated;

create or replace function private.admin_provider_access()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_registered();
 if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'capability', v.capability, 'mode', v.mode, 'sku', v.sku, 'available', v.available,
  'canCall', private.provider_available(v.capability, v.mode),
  'editable', v.capability = 'mapbox' and v.sku = 'map_loads_web',
  'hasToken', v.public_token <> '',
  'expiresAt', v.expires_at, 'dailyBudget', v.daily_budget,
  'dailyUsed', case when daily_reset_on < (now() at time zone 'UTC')::date then 0 else daily_used end,
  'monthlyBudget', v.monthly_budget,
  'monthlyUsed', case when monthly_reset_on < date_trunc('month', now() at time zone 'UTC')::date
    then 0 else monthly_used end,
  'freeMonthlyAllowance', v.free_monthly_allowance, 'safetyMargin', v.safety_margin,
  'observedProviderUsage', v.observed_provider_usage, 'usageObservedAt', v.usage_observed_at,
  'maxBudget', greatest(0, v.free_monthly_allowance - v.safety_margin - v.observed_provider_usage),
  'increaseStep', v.increase_step) order by v.capability)
 from private.provider_access v where mode = 'free_quota'), '[]'::jsonb);
end $$;
revoke all on function private.admin_provider_access() from public, anon, authenticated;
grant execute on function private.admin_provider_access() to authenticated;

create or replace function private.admin_set_map_token(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := btrim(coalesce(p_token, ''));
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_token <> '' and v_token !~ '^pk\.[A-Za-z0-9_.-]{20,290}$' then
    raise exception 'invalid token' using errcode = '22023';
  end if;
  update private.provider_access set public_token = v_token
  where capability = 'mapbox' and mode = 'free_quota';
  perform private.audit('provider.map_token', case when v_token = '' then 'cleared' else 'set' end);
  return private.admin_provider_access();
end $$;
revoke all on function private.admin_set_map_token(text) from public, anon, authenticated;
grant execute on function private.admin_set_map_token(text) to authenticated;
create or replace function public.admin_set_map_token(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_set_map_token(p_token) $$;
revoke all on function public.admin_set_map_token(text) from public, anon;
grant execute on function public.admin_set_map_token(text) to authenticated;

-- ── Editorial input validation (a malformed timetable must never break search_places) ──
create or replace function private.valid_opening_hours(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 14 and not exists (
    select 1 from jsonb_array_elements(p) x
    where jsonb_typeof(x) <> 'object'
       or coalesce(x ->> 'day', '') !~ '^[0-6]$'
       or coalesce(x ->> 'opens', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(x ->> 'closes', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  )
$$;

create or replace function private.clean_music(p jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(left(btrim(x), 30)) filter (where btrim(x) <> ''), '{}')
  from (select x from jsonb_array_elements_text(
    case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) t(x) limit 8) s
$$;
revoke all on function private.valid_opening_hours(jsonb) from public, anon, authenticated;
revoke all on function private.clean_music(jsonb) from public, anon, authenticated;

create or replace function private.update_venue_details(p_venue uuid, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_lat double precision;
  v_lng double precision;
begin
  perform private.require_registered();
  if not (private.is_admin() or private.manages_venue(p_venue)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'bad request' using errcode = '22023'; end if;
  if p ? 'openingHours' and not private.valid_opening_hours(p -> 'openingHours') then
    raise exception 'bad request' using errcode = '22023';
  end if;
  if p ? 'price' and coalesce(p ->> 'price', '') !~ '^[1-4]$' then
    raise exception 'bad request' using errcode = '22023';
  end if;
  if p ? 'minAge' and p ->> 'minAge' is not null and coalesce(p ->> 'minAge', '') !~ '^(1[89]|2[0-5])$' then
    raise exception 'bad request' using errcode = '22023';
  end if;
  -- Coordinates are owner data only when an admin sets them explicitly.
  if p ? 'lat' or p ? 'lng' then
    if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
    v_lat := (p ->> 'lat')::double precision;
    v_lng := (p ->> 'lng')::double precision;
    if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      raise exception 'bad request' using errcode = '22023';
    end if;
  end if;
  update public.venues set
    name = coalesce(nullif(left(btrim(p ->> 'name'), 80), ''), name),
    address = coalesce(left(btrim(p ->> 'address'), 160), address),
    phone = coalesce(left(btrim(p ->> 'phone'), 40), phone),
    website = case when p ? 'website' and (coalesce(p ->> 'website', '') = '' or (p ->> 'website') ~ '^https://')
      then left(coalesce(p ->> 'website', ''), 300) else website end,
    opening_hours = case when p ? 'openingHours' then p -> 'openingHours' else opening_hours end,
    description = coalesce(left(btrim(p ->> 'description'), 500), description),
    music = case when p ? 'music' then private.clean_music(p -> 'music') else music end,
    dress_code = coalesce(left(btrim(p ->> 'dressCode'), 80), dress_code),
    min_age = case when p ? 'minAge' then (p ->> 'minAge')::smallint else min_age end,
    notes = coalesce(left(btrim(p ->> 'notes'), 500), notes),
    type = coalesce((p ->> 'type')::public.venue_type, type),
    hours = coalesce(left(btrim(p ->> 'hours'), 60), hours),
    price = coalesce((p ->> 'price')::smallint, price),
    city = coalesce(nullif(left(btrim(p ->> 'city'), 40), ''), city),
    location = case when v_lat is not null then
      extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography else location end,
    location_source = case when v_lat is not null then 'owner' else location_source end,
    google_fetched_at = case when v_lat is not null then null else google_fetched_at end,
    google_expires_at = case when v_lat is not null then null else google_expires_at end,
    catalog_owned = true,
    updated_at = now()
  where id = p_venue;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.audit('venue.update', p_venue::text);
end $$;
revoke all on function private.update_venue_details(uuid, jsonb) from public, anon, authenticated;
grant execute on function private.update_venue_details(uuid, jsonb) to authenticated;

-- ── Admin catalogue: own venues with own coordinates (never copied from Google) ──
create or replace function private.admin_create_venue(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_city text := btrim(coalesce(p ->> 'city', ''));
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 or char_length(v_city) not between 1 and 40
     or v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  insert into public.venues (name, type, address, location, city, location_source, catalog_owned)
  values (v_name, (p ->> 'type')::public.venue_type, left(btrim(coalesce(p ->> 'address', '')), 160),
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    v_city, 'owner', true)
  returning id into v_id;
  perform private.audit('venue.create', v_id::text);
  perform private.update_venue_details(v_id, p - 'lat' - 'lng' - 'name' - 'city' - 'type' - 'address');
  return v_id;
end $$;
revoke all on function private.admin_create_venue(jsonb) from public, anon, authenticated;
grant execute on function private.admin_create_venue(jsonb) to authenticated;
create or replace function public.admin_create_venue(p jsonb) returns uuid
language sql security invoker set search_path = '' as $$ select private.admin_create_venue(p) $$;
revoke all on function public.admin_create_venue(jsonb) from public, anon;
grant execute on function public.admin_create_venue(jsonb) to authenticated;

create or replace function private.admin_list_venues()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', v.id, 'name', v.name, 'type', v.type, 'city', v.city, 'address', v.address,
    'description', v.description, 'hours', v.hours, 'price', v.price, 'phone', v.phone,
    'website', v.website, 'music', to_jsonb(v.music), 'dressCode', v.dress_code,
    'minAge', v.min_age, 'notes', v.notes, 'openingHours', v.opening_hours,
    'isTest', v.is_test, 'locationSource', v.location_source, 'catalogOwned', v.catalog_owned,
    'googleExpiresAt', v.google_expires_at,
    'lat', case when v.location_source <> 'google' or v.google_expires_at > now()
      then extensions.st_y(v.location::extensions.geometry) end,
    'lng', case when v.location_source <> 'google' or v.google_expires_at > now()
      then extensions.st_x(v.location::extensions.geometry) end
  ) order by v.is_test, v.city, v.name) from (select * from public.venues order by is_test, city, name limit 500) v),
  '[]'::jsonb);
end $$;
revoke all on function private.admin_list_venues() from public, anon, authenticated;
grant execute on function private.admin_list_venues() to authenticated;
create or replace function public.admin_list_venues() returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_list_venues() $$;
revoke all on function public.admin_list_venues() from public, anon;
grant execute on function public.admin_list_venues() to authenticated;

-- ── Stats: only write and broadcast when the thresholded numbers actually change ──
create or replace function private.recalc_place_stats(p_venue uuid default null, p_event uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_people integer;
  v_going integer;
  v_avg numeric(4, 1);
  v_green integer;
  v_ratio jsonb;
  v_women integer;
  v_men integer;
  v_test boolean;
  v_old public.place_stats;
  v_place_id uuid;
begin
  if num_nonnulls(p_venue, p_event) <> 1 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  v_place_id := coalesce(p_venue, p_event);
  v_test := exists(select 1 from public.venues where id = p_venue and is_test)
    or exists(select 1 from public.events where id = p_event and is_test);

  select count(*)::integer,
    round(avg(private.age_years(p.birthdate))::numeric, 1),
    round(100.0 * count(*) filter (where p.traffic_light = 'green') / nullif(count(*), 0))::integer,
    count(*) filter (where p.gender = 'woman'),
    count(*) filter (where p.gender = 'man')
  into v_people, v_avg, v_green, v_women, v_men
  from public.attendance a
  join public.profiles p on p.id = a.user_id
  where a.kind = 'check_in' and a.expires_at > now()
    and (a.venue_id = p_venue or a.event_id = p_event)
    and not p.banned and not p.suspended
    and (not a.is_test or v_test);

  select count(*)::integer into v_going
  from public.attendance a
  where a.kind = 'going' and a.expires_at > now()
    and (a.venue_id = p_venue or a.event_id = p_event)
    and (not a.is_test or v_test);

  if v_people >= 5 then
    v_ratio := jsonb_build_object(
      'women', round(100.0 * v_women / v_people)::integer,
      'men', round(100.0 * v_men / v_people)::integer,
      'other', greatest(0, 100 - round(100.0 * v_women / v_people)::integer
                                - round(100.0 * v_men / v_people)::integer));
  else
    v_avg := null; v_green := null; v_ratio := null;
  end if;

  select * into v_old from public.place_stats
  where (p_venue is not null and venue_id = p_venue) or (p_event is not null and event_id = p_event);
  if v_old.id is not null and v_old.people = v_people and v_old.going_tonight = v_going
     and v_old.average_age is not distinct from v_avg and v_old.green_percent is not distinct from v_green
     and v_old.ratio is not distinct from v_ratio then
    return;
  end if;
  if v_old.id is null and v_people = 0 and v_going = 0 then
    return;
  end if;

  if p_venue is not null then
    insert into public.place_stats (venue_id, people, average_age, green_percent, ratio, going_tonight, updated_at)
    values (p_venue, v_people, v_avg, v_green, v_ratio, v_going, now())
    on conflict (venue_id) do update set
      people = excluded.people, average_age = excluded.average_age,
      green_percent = excluded.green_percent, ratio = excluded.ratio,
      going_tonight = excluded.going_tonight, updated_at = now();
  else
    insert into public.place_stats (event_id, people, average_age, green_percent, ratio, going_tonight, updated_at)
    values (p_event, v_people, v_avg, v_green, v_ratio, v_going, now())
    on conflict (event_id) do update set
      people = excluded.people, average_age = excluded.average_age,
      green_percent = excluded.green_percent, ratio = excluded.ratio,
      going_tonight = excluded.going_tonight, updated_at = now();
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('type', 'stats', 'placeId', v_place_id::text,
        'stats', private.threshold_stats(v_people, v_avg, v_green, v_ratio, v_going)),
      'stats', case when v_test then 'place-stats:test' else 'place-stats:live' end, true);
  exception when undefined_function then raise warning 'realtime.send unavailable';
  end;
end $$;
revoke all on function private.recalc_place_stats(uuid, uuid) from public, anon, authenticated;
