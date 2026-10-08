-- Roadmap 2026-10 R4 (3/4): venue-facing and public showcase RPCs (flag on).
create function private.venue_photos_manage(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_showcase(); perform private.require_venue_manager(p_venue);
 return jsonb_build_object('limit', private.venue_photo_limit(p_venue), 'plan', private.venue_has_plan(p_venue),
  'photos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'status', p.status,
    'reason', p.reason, 'isCover', p.is_cover, 'createdAt', p.created_at,
    'visible', exists(select 1 from private.visible_venue_photos(p_venue) v where v.id = p.id))
   order by p.is_cover desc, p.created_at, p.id) from private.venue_photos p where p.venue_id = p_venue), '[]'));
end $$;

create function private.venue_photo_add(p_venue uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_showcase();
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-photo', 30);
 if private.venue_photo_folder(p_path) is distinct from p_venue
  or not exists(select 1 from storage.objects where bucket_id = 'venue-photos' and name = p_path) then
  raise exception 'invalid photo' using errcode = '22023';
 end if;
 perform 1 from public.venues where id = p_venue for update;
 if (select count(*) from private.venue_photos where venue_id = p_venue and status <> 'rejected')
  >= private.venue_photo_limit(p_venue) then raise exception 'photo_limit' using errcode = '54000'; end if;
 insert into private.venue_photos(venue_id, path, uploaded_by, is_test)
 select p_venue, p_path, u, v.is_test from public.venues v where v.id = p_venue
 on conflict (path) do nothing;
 return private.venue_photos_manage(p_venue);
end $$;

-- Removes the row and returns the path; the client then deletes the object.
create function private.venue_photo_remove(p_venue uuid, p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_path text;
begin
 perform private.require_showcase(); perform private.require_venue_manager(p_venue);
 perform private.case_limit('venue-photo', 30);
 delete from private.venue_photos where id = p_photo and venue_id = p_venue returning path into v_path;
 if v_path is null then raise exception 'not found' using errcode = 'P0002'; end if;
 return v_path;
end $$;

create function private.venue_photo_set_cover(p_venue uuid, p_photo uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_showcase(); perform private.require_venue_manager(p_venue);
 perform private.case_limit('venue-photo', 30);
 if not exists(select 1 from private.venue_photos where id = p_photo and venue_id = p_venue and status = 'approved') then
  raise exception 'invalid photo' using errcode = '22023';
 end if;
 update private.venue_photos set is_cover = false where venue_id = p_venue and is_cover and id <> p_photo;
 update private.venue_photos set is_cover = true where id = p_photo;
 return private.venue_photos_manage(p_venue);
end $$;

create function private.venue_details_json(p_venue uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('dressCode', dress_code, 'minAge', min_age, 'entryPriceCents', entry_price_cents,
  'drinkPriceCents', drink_price_cents, 'terrace', terrace, 'accessible', accessible)
 from private.venue_details where venue_id = p_venue
$$;

create function private.venue_details_save(p_venue uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_showcase();
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-edit', 30);
 if jsonb_typeof(p) <> 'object' or (p - 'dressCode' - 'minAge' - 'entryPriceCents' - 'drinkPriceCents'
  - 'terrace' - 'accessible') <> '{}' then raise exception 'invalid fields' using errcode = '22023'; end if;
 insert into private.venue_details(venue_id, dress_code, min_age, entry_price_cents, drink_price_cents,
  terrace, accessible, updated_by, updated_at)
 values (p_venue, p ->> 'dressCode', (p ->> 'minAge')::smallint, (p ->> 'entryPriceCents')::integer,
  (p ->> 'drinkPriceCents')::integer, (p ->> 'terrace')::boolean, (p ->> 'accessible')::boolean, u, clock_timestamp())
 on conflict (venue_id) do update set dress_code = excluded.dress_code, min_age = excluded.min_age,
  entry_price_cents = excluded.entry_price_cents, drink_price_cents = excluded.drink_price_cents,
  terrace = excluded.terrace, accessible = excluded.accessible, updated_by = u, updated_at = clock_timestamp();
 return private.venue_details_json(p_venue);
exception when invalid_text_representation or numeric_value_out_of_range or check_violation then
 raise exception 'invalid fields' using errcode = '22023';
end $$;

create function private.venue_notices_json(p_venue uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'value', value, 'until', until, 'setAt', set_at)
  order by kind), '[]') from private.venue_notices where venue_id = p_venue and until > now()
$$;

create function private.venue_notice_set(p_venue uuid, p_kind text, p_value text, p_until timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_showcase(); v_until timestamptz;
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-notice', 60);
 if p_kind = 'door' then
  if p_value is null or p_value not in ('no_queue', 'short_queue', 'long_queue', 'almost_full', 'full') then
   raise exception 'invalid notice' using errcode = '22023'; end if;
  v_until := now() + interval '90 minutes';
 elsif p_kind in ('free_entry', 'happy_hour') and p_value is null then
  if p_until is null or p_until <= now() or p_until > now() + interval '8 hours' then
   raise exception 'invalid notice' using errcode = '22023'; end if;
  v_until := p_until;
 else raise exception 'invalid notice' using errcode = '22023';
 end if;
 insert into private.venue_notices(venue_id, kind, value, until, set_by, set_at)
 values (p_venue, p_kind, p_value, v_until, u, clock_timestamp())
 on conflict (venue_id, kind) do update set value = excluded.value, until = excluded.until,
  set_by = u, set_at = clock_timestamp();
 return private.venue_notices_json(p_venue);
end $$;

create function private.venue_notice_clear(p_venue uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_showcase(); perform private.require_venue_manager(p_venue);
 perform private.case_limit('venue-notice', 60);
 delete from private.venue_notices where venue_id = p_venue and kind = p_kind;
 return private.venue_notices_json(p_venue);
end $$;

-- What any registered user sees on the venue page.
create function private.venue_showcase(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_showcase(); perform private.require_place(p_venue);
 if not exists(select 1 from public.venues where id = p_venue) then
  return jsonb_build_object('photos', '[]'::jsonb, 'details', null, 'notices', '[]'::jsonb);
 end if;
 return jsonb_build_object(
  'photos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'path', path)) from private.visible_venue_photos(p_venue)), '[]'),
  'details', private.venue_details_json(p_venue), 'notices', private.venue_notices_json(p_venue));
end $$;

-- Covers for lists and the map: first visible photo of each visible venue.
create function private.venue_covers() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_showcase(); perform private.place_limit('venue-covers', 240);
 return coalesce((select jsonb_agg(jsonb_build_object('venueId', v.id, 'path', c.path))
  from public.venues v
  cross join lateral (select path from private.visible_venue_photos(v.id) limit 1) c
  where (not v.is_test or private.sees_test_data())
   and exists(select 1 from private.venue_photos p where p.venue_id = v.id and p.status = 'approved')), '[]');
end $$;

-- One view per person, venue and night; managers of the venue and test accounts on real
-- venues are not counted.
create function private.place_view(p_venue uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_showcase(); n date := private.nightlife_night_date(); v_test boolean;
begin
 perform private.place_limit('place-view', 300);
 select is_test into v_test from public.venues where id = p_venue and (not is_test or private.sees_test_data());
 if not found or private.manages_venue(p_venue) then return; end if;
 if not v_test and exists(select 1 from public.profiles where id = u and is_test) then return; end if;
 insert into private.venue_view_marks(venue_id, night_date, viewer_hmac)
 values (p_venue, n, private.hmac_hex('venue-view:' || u::text || ':' || p_venue::text || ':' || n::text))
 on conflict do nothing;
 if found then
  insert into private.venue_daily_views(venue_id, night_date, views) values (p_venue, n, 1)
  on conflict (venue_id, night_date) do update set views = private.venue_daily_views.views + 1;
 end if;
end $$;

revoke all on function private.venue_photos_manage(uuid), private.venue_photo_add(uuid, text),
 private.venue_photo_remove(uuid, uuid), private.venue_photo_set_cover(uuid, uuid),
 private.venue_details_json(uuid), private.venue_details_save(uuid, jsonb), private.venue_notices_json(uuid),
 private.venue_notice_set(uuid, text, text, timestamptz), private.venue_notice_clear(uuid, text),
 private.venue_showcase(uuid), private.venue_covers(), private.place_view(uuid) from public, anon;
grant execute on function private.venue_photos_manage(uuid), private.venue_photo_add(uuid, text),
 private.venue_photo_remove(uuid, uuid), private.venue_photo_set_cover(uuid, uuid),
 private.venue_details_save(uuid, jsonb), private.venue_notice_set(uuid, text, text, timestamptz),
 private.venue_notice_clear(uuid, text), private.venue_showcase(uuid), private.venue_covers(),
 private.place_view(uuid) to authenticated;
