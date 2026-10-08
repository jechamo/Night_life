-- Roadmap 2026-10 R4 (3a/4): venue-facing and public showcase RPCs (flag on).
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

revoke all on function private.venue_photos_manage(uuid), private.venue_photo_add(uuid, text),
 private.venue_photo_remove(uuid, uuid), private.venue_photo_set_cover(uuid, uuid) from public, anon;
grant execute on function private.venue_photos_manage(uuid), private.venue_photo_add(uuid, text),
 private.venue_photo_remove(uuid, uuid), private.venue_photo_set_cover(uuid, uuid) to authenticated;
