-- Roadmap 2026-10 R4 (2/4): helpers and Storage policies for `venue-photos`.
create function private.require_showcase() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.require_registered();
begin
 if coalesce(private.flag_value('venue_showcase_enabled'), 'off') <> 'on' then
  raise exception 'disabled' using errcode = '42501';
 end if;
 return u;
end $$;

-- «Con plan»: an active sponsorship today or Estadísticas Pro (bought or by contract).
create function private.venue_has_plan(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.sponsorships where venue_id = p_venue and status = 'active'
   and current_date between starts_on and ends_on
   and (mode = 'live' or (private.sees_test_data() and private.flag_value('payments_mode') <> 'live')))
  or private.venue_has_pro(p_venue)
$$;

create function private.venue_photo_limit(p_venue uuid) returns integer
language sql stable security definer set search_path = '' as $$
 select case when private.venue_has_plan(p_venue) then 10 else 3 end
$$;

-- Photos anyone may see: approved, cover first, capped by the current plan (extra photos
-- are hidden, not deleted, when the plan ends).
create function private.visible_venue_photos(p_venue uuid) returns setof private.venue_photos
language sql stable security definer set search_path = '' as $$
 select * from private.venue_photos where venue_id = p_venue and status = 'approved'
 order by is_cover desc, created_at, id limit private.venue_photo_limit(p_venue)
$$;

create function private.venue_photo_folder(p_name text) returns uuid
language sql immutable set search_path = '' as $$
 select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$'
  then split_part(p_name, '/', 1)::uuid end
$$;

create function private.venue_visible_to_caller(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.venues where id = p_venue and (not is_test or private.sees_test_data()))
$$;

-- Upload: flag on, a manager of that venue, strict path, and a cap on stored objects
-- (twice the plan limit, so abandoned uploads cannot fill the bucket).
create function private.can_upload_venue_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := private.venue_photo_folder(p_name);
begin
 if v is null or (select auth.uid()) is null then return false; end if;
 if coalesce(private.flag_value('venue_showcase_enabled'), 'off') <> 'on' then return false; end if;
 if not private.manages_venue(v) then return false; end if;
 return (select count(*) from storage.objects where bucket_id = 'venue-photos' and name like v::text || '/%')
  < 2 * private.venue_photo_limit(v);
end $$;

create function private.can_read_venue_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := private.venue_photo_folder(p_name);
begin
 if v is null or (select auth.uid()) is null then return false; end if;
 if private.is_admin() or private.manages_venue(v) then return true; end if;
 if coalesce(private.flag_value('venue_showcase_enabled'), 'off') <> 'on' then return false; end if;
 if not exists(select 1 from public.profiles where id = (select auth.uid()) and onboarded_at is not null
   and not banned and not suspended) then return false; end if;
 return private.venue_visible_to_caller(v)
  and exists(select 1 from private.visible_venue_photos(v) p where p.path = p_name);
end $$;

-- Delete: admin, or a manager once the photo row is gone (the RPC removes it first).
create function private.can_delete_venue_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := private.venue_photo_folder(p_name);
begin
 if v is null or (select auth.uid()) is null then return false; end if;
 if private.is_admin() then return true; end if;
 return private.manages_venue(v) and not exists(select 1 from private.venue_photos where path = p_name);
end $$;

revoke all on function private.require_showcase(), private.venue_has_plan(uuid),
 private.venue_photo_limit(uuid), private.visible_venue_photos(uuid), private.venue_photo_folder(text),
 private.venue_visible_to_caller(uuid), private.can_upload_venue_photo(text),
 private.can_read_venue_photo(text), private.can_delete_venue_photo(text) from public, anon;
revoke all on function private.require_showcase(), private.venue_has_plan(uuid),
 private.venue_photo_limit(uuid), private.visible_venue_photos(uuid),
 private.venue_visible_to_caller(uuid) from authenticated;
-- Only the policy predicates are callable by signed-in users (as in Block 10).
grant execute on function private.venue_photo_folder(text), private.can_upload_venue_photo(text),
 private.can_read_venue_photo(text), private.can_delete_venue_photo(text) to authenticated;

create policy "venue photos: manager upload" on storage.objects for insert to authenticated
 with check (bucket_id = 'venue-photos' and private.can_upload_venue_photo(name));
create policy "venue photos: read" on storage.objects for select to authenticated
 using (bucket_id = 'venue-photos' and private.can_read_venue_photo(name));
create policy "venue photos: manager delete" on storage.objects for delete to authenticated
 using (bucket_id = 'venue-photos' and private.can_delete_venue_photo(name));
