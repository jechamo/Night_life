-- Editing an OpenStreetMap venue in Admin keeps its source (ODbL attribution) while making
-- it catalogue-owned, so later imports never overwrite the edit.
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
    location_source = case when v_lat is not null and location_source <> 'osm' then 'owner' else location_source end,
    google_fetched_at = case when v_lat is not null then null else google_fetched_at end,
    google_expires_at = case when v_lat is not null then null else google_expires_at end,
    catalog_owned = true,
    updated_at = now()
  where id = p_venue;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.audit('venue.update', p_venue::text);
end $$;
