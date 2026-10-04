-- Block 10: crowd privacy applies to both serialization and ordering.
-- When the map client does not send a position, return the venues closest to their
-- city centre so the first page is the centre of the city, not an alphabetical slice.
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
    select jsonb_agg((to_jsonb(x) - 'sort_key') order by x.sort_key, x.name)
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
          when 'people_desc' then (-(case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end))::double precision
          when 'people_asc' then (case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end)::double precision
          when 'age' then coalesce(case when coalesce(s.people,0) >= 5 then s.average_age end, 999)::double precision
          when 'rating' then (-coalesce(v.rating, 0))::double precision
          else coalesce(case when v_origin is null
                               then extensions.st_distance(v.location, private.city_center(v.city))
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
