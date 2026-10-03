-- Postgres caps regex repetition counts at 255: the website length is checked apart.
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
      case when char_length(coalesce(v_item ->> 'website', '')) <= 300
          and coalesce(v_item ->> 'website', '') ~ '^https://[^[:space:]]+$'
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
