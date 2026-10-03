-- Catalogue CSV import and venue removal (owner request 2026-10-03).
-- Import only adds or updates. A row without coordinates updates a same-name venue in
-- the city; a new pin needs coordinates. Nothing is deleted because it is missing
-- from the file. Google links are not a column this function reads.

create or replace function private.venue_name_key(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(p, ''))),
      'áàäâéèëêíìïîóòöôúùüûñç',
      'aaaaeeeeiiiioooouuuunc'),
    '[^a-z0-9]+', '', 'g')
$$;
revoke all on function private.venue_name_key(text) from public, anon, authenticated;

create or replace function private.import_catalogue_venues(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_name text;
  v_key text;
  v_type text;
  v_city text;
  v_center extensions.geography;
  v_lat double precision;
  v_lng double precision;
  v_point extensions.geography;
  v_address text;
  v_phone text;
  v_website text;
  v_hours text;
  v_opening jsonb;
  v_music text[];
  v_dress text;
  v_description text;
  v_price smallint;
  v_min_age smallint;
  v_id uuid;
  v_added integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.place_limit('catalogue_import', 20);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 2000 then
    raise exception 'bad request' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_name := btrim(coalesce(v_item ->> 'name', ''));
    v_key := private.venue_name_key(v_name);
    v_type := v_item ->> 'type';
    v_city := btrim(coalesce(v_item ->> 'city', ''));
    v_center := private.city_center(v_city);
    v_lat := case when jsonb_typeof(v_item -> 'lat') = 'number' then (v_item ->> 'lat')::double precision end;
    v_lng := case when jsonb_typeof(v_item -> 'lng') = 'number' then (v_item ->> 'lng')::double precision end;
    if char_length(v_name) not between 1 and 80 or char_length(v_key) < 1
       or coalesce(v_type, '') not in ('nightclub', 'club', 'pub', 'bar', 'dive_bar', 'lounge', 'terrace', 'beach_club')
       or v_center is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_point := case
      when v_lat between -90 and 90 and v_lng between -180 and 180
        then extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography
    end;
    if v_point is not null and extensions.st_distance(v_point, v_center) > 40000 then
      v_point := null;
    end if;
    v_address := left(btrim(coalesce(v_item ->> 'address', '')), 160);
    v_phone := btrim(coalesce(v_item ->> 'phone', ''));
    if char_length(v_phone) > 40 or v_phone !~ '^\+?[0-9 ()-]{6,20}$' then v_phone := ''; end if;
    v_website := coalesce(v_item ->> 'website', '');
    if char_length(v_website) > 300 or v_website !~ '^https://[^[:space:]]+$' then v_website := ''; end if;
    v_hours := btrim(coalesce(v_item ->> 'hours', ''));
    if char_length(v_hours) > 60 then v_hours := ''; end if;
    v_opening := case when private.valid_opening_hours(v_item -> 'openingHours')
      then v_item -> 'openingHours' else '[]'::jsonb end;
    v_music := private.clean_music(v_item -> 'music');
    v_dress := left(btrim(coalesce(v_item ->> 'dressCode', '')), 80);
    v_description := left(btrim(coalesce(v_item ->> 'description', '')), 500);
    v_price := case when coalesce(v_item ->> 'price', '') ~ '^[1-4]$' then (v_item ->> 'price')::smallint end;
    v_min_age := case when coalesce(v_item ->> 'minAge', '') ~ '^(1[89]|2[0-5])$'
      then (v_item ->> 'minAge')::smallint end;

    select v.id into v_id
    from public.venues v
    where v.city = v_city and not v.is_test and private.venue_name_key(v.name) = v_key
    order by v.catalog_owned desc, v.created_at
    limit 1;

    if v_id is null then
      if v_point is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      insert into public.venues (
        name, type, city, address, location, hours, price, phone, website, opening_hours,
        music, dress_code, min_age, description, location_source, catalog_owned
      ) values (
        v_name, v_type::public.venue_type, v_city, v_address, v_point, v_hours, v_price,
        v_phone, v_website, v_opening, v_music, v_dress, v_min_age, v_description, 'owner', true
      );
      v_added := v_added + 1;
    else
      update public.venues set
        type = v_type::public.venue_type,
        address = case when v_address <> '' then v_address else address end,
        phone = case when v_phone <> '' then v_phone else phone end,
        website = case when v_website <> '' then v_website else website end,
        hours = case when v_hours <> '' then v_hours else hours end,
        opening_hours = case when jsonb_array_length(v_opening) > 0 then v_opening else opening_hours end,
        music = case when cardinality(v_music) > 0 then v_music else music end,
        dress_code = case when v_dress <> '' then v_dress else dress_code end,
        min_age = coalesce(v_min_age, min_age),
        description = case when v_description <> '' then v_description else description end,
        price = coalesce(v_price, price),
        location = coalesce(v_point, location),
        catalog_owned = true,
        updated_at = now()
      where id = v_id;
      v_updated := v_updated + 1;
    end if;
  end loop;

  if jsonb_array_length(p_items) > 0 then
    perform private.audit('venue.catalogue_import',
      v_added || '/' || v_updated || '/' || v_skipped);
  end if;
  return jsonb_build_object('added', v_added, 'updated', v_updated, 'skipped', v_skipped);
end $$;
revoke all on function private.import_catalogue_venues(jsonb) from public, anon, authenticated;
grant execute on function private.import_catalogue_venues(jsonb) to authenticated;
create or replace function public.admin_import_catalogue(p_items jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select private.import_catalogue_venues(p_items) $$;
revoke all on function public.admin_import_catalogue(jsonb) from public, anon;
grant execute on function public.admin_import_catalogue(jsonb) to authenticated;

create or replace function private.admin_delete_venue(p_venue uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.venues where id = p_venue;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.audit('venue.delete', p_venue::text);
end $$;
revoke all on function private.admin_delete_venue(uuid) from public, anon, authenticated;
grant execute on function private.admin_delete_venue(uuid) to authenticated;
create or replace function public.admin_delete_venue(p_venue uuid) returns void
language sql security invoker set search_path = '' as $$ select private.admin_delete_venue(p_venue) $$;
revoke all on function public.admin_delete_venue(uuid) from public, anon;
grant execute on function public.admin_delete_venue(uuid) to authenticated;
