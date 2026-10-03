-- Block 7 · OpenStreetMap catalogue import (owner authorisation 2026-10-03, ADR 0010).
-- OSM data (ODbL) is stored with its reference and shown with attribution. A venue edited
-- in Admin becomes catalogue-owned and is never overwritten by a later import.

alter table public.venues drop constraint if exists venues_location_source_check;
alter table public.venues add constraint venues_location_source_check
  check (location_source = any (array['owner', 'google', 'fixture', 'osm']));

alter table public.venues add column if not exists osm_ref text;
alter table public.venues add constraint venues_osm_ref_key unique (osm_ref);
alter table public.venues add constraint venues_osm_ref_check
  check (osm_ref is null or osm_ref ~ '^(node|way|relation)/[0-9]{1,15}$');

-- OSM rarely knows prices; an unknown price is shown as nothing rather than invented.
alter table public.venues alter column price drop not null;

create or replace function private.city_center(p_city text)
returns extensions.geography language sql immutable set search_path = '' as $$
  select extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography
  from (values
    ('Madrid', 40.4168, -3.7038), ('Barcelona', 41.3874, 2.1686), ('Valencia', 39.4699, -0.3763),
    ('Sevilla', 37.3891, -5.9845), ('Málaga', 36.7213, -4.4214), ('Bilbao', 43.263, -2.935),
    ('Ibiza', 38.9067, 1.4206), ('Zaragoza', 41.6488, -0.8891)
  ) as c(name, lat, lng)
  where c.name = p_city
$$;
revoke all on function private.city_center(text) from public, anon, authenticated;

create or replace function private.import_osm_venues(p_city text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_center extensions.geography := private.city_center(p_city);
  v_item jsonb;
  v_ref text;
  v_name text;
  v_type text;
  v_lat double precision;
  v_lng double precision;
  v_point extensions.geography;
  v_hours text;
  v_inserted boolean;
  v_added integer := 0;
  v_updated integer := 0;
  v_kept integer := 0;
  v_skipped integer := 0;
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.place_limit('osm_import', 40);
  if v_center is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 6000 then
    raise exception 'bad request' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_ref := v_item ->> 'ref';
    v_name := btrim(coalesce(v_item ->> 'name', ''));
    v_type := v_item ->> 'type';
    v_lat := case when jsonb_typeof(v_item -> 'lat') = 'number' then (v_item ->> 'lat')::double precision end;
    v_lng := case when jsonb_typeof(v_item -> 'lng') = 'number' then (v_item ->> 'lng')::double precision end;
    if coalesce(v_ref, '') !~ '^(node|way|relation)/[0-9]{1,15}$'
       or char_length(v_name) not between 1 and 80
       or coalesce(v_type, '') not in ('nightclub', 'pub', 'bar', 'lounge', 'terrace')
       or v_lat is null or v_lng is null
       or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_point := extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography;
    if extensions.st_distance(v_point, v_center) > 40000 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_hours := btrim(coalesce(v_item ->> 'hours', ''));

    v_inserted := null;
    insert into public.venues as v (
      name, type, city, address, location, hours, price, phone, website, opening_hours,
      music, min_age, osm_ref, location_source, catalog_owned
    ) values (
      v_name,
      v_type::public.venue_type,
      p_city,
      left(btrim(coalesce(v_item ->> 'address', '')), 160),
      v_point,
      case when char_length(v_hours) <= 60 then v_hours else '' end,
      null,
      case when char_length(btrim(coalesce(v_item ->> 'phone', ''))) <= 40
        then btrim(coalesce(v_item ->> 'phone', '')) else '' end,
      case when coalesce(v_item ->> 'website', '') ~ '^https://[^[:space:]]{3,290}$'
        then v_item ->> 'website' else '' end,
      case when private.valid_opening_hours(v_item -> 'openingHours')
        then v_item -> 'openingHours' else '[]'::jsonb end,
      private.clean_music(v_item -> 'music'),
      case when coalesce(v_item ->> 'minAge', '') ~ '^(1[89]|2[0-5])$'
        then (v_item ->> 'minAge')::smallint end,
      v_ref,
      'osm',
      false
    )
    on conflict (osm_ref) do update set
      name = excluded.name,
      type = excluded.type,
      address = excluded.address,
      location = excluded.location,
      hours = excluded.hours,
      phone = excluded.phone,
      website = excluded.website,
      opening_hours = excluded.opening_hours,
      music = excluded.music,
      min_age = excluded.min_age,
      updated_at = now()
    where v.catalog_owned = false and v.location_source = 'osm'
    returning (xmax = 0) into v_inserted;

    if v_inserted is null then v_kept := v_kept + 1;
    elsif v_inserted then v_added := v_added + 1;
    else v_updated := v_updated + 1;
    end if;
  end loop;

  if jsonb_array_length(p_items) > 0 then
    perform private.audit('venue.osm_import',
      p_city || ':' || v_added || '/' || v_updated || '/' || v_kept || '/' || v_skipped);
  end if;
  return jsonb_build_object('added', v_added, 'updated', v_updated, 'kept', v_kept, 'skipped', v_skipped);
end $$;
revoke all on function private.import_osm_venues(text, jsonb) from public, anon, authenticated;
grant execute on function private.import_osm_venues(text, jsonb) to authenticated;
create or replace function public.admin_import_osm_venues(p_city text, p_items jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.import_osm_venues(p_city, p_items) $$;
revoke all on function public.admin_import_osm_venues(text, jsonb) from public, anon;
grant execute on function public.admin_import_osm_venues(text, jsonb) to authenticated;

-- ── Admin list with search (the catalogue now holds thousands of venues) ──
drop function if exists public.admin_list_venues();
drop function if exists private.admin_list_venues();
create function private.admin_list_venues(p_query text default null, p_city text default null)
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
  ) order by v.is_test, v.city, v.name) from (
    select * from public.venues
    where (p_city is null or city = p_city)
      and (coalesce(btrim(p_query), '') = ''
           or name ilike '%' || left(btrim(p_query), 80) || '%'
           or address ilike '%' || left(btrim(p_query), 80) || '%')
    order by is_test, city, name
    limit 300
  ) v), '[]'::jsonb);
end $$;
revoke all on function private.admin_list_venues(text, text) from public, anon, authenticated;
grant execute on function private.admin_list_venues(text, text) to authenticated;
create function public.admin_list_venues(p_query text default null, p_city text default null) returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_list_venues(p_query, p_city) $$;
revoke all on function public.admin_list_venues(text, text) from public, anon;
grant execute on function public.admin_list_venues(text, text) to authenticated;

-- ── search_places: expose the data source (OSM attribution) and search around the map ──
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
        v.location_source as source,
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
        and (v_origin is null or extensions.st_dwithin(v.location, v_origin, 40000))
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
