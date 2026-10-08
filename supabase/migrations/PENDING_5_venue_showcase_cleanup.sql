-- Roadmap 2026-10 R4 (5/5): the only statements that remove rows (a manager removing a
-- photo and the daily retention job), kept apart so they can be confirmed on their own.
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

create function public.venue_photo_remove(p_venue uuid, p_photo uuid) returns text language sql security invoker set search_path = '' as $$ select private.venue_photo_remove(p_venue, p_photo) $$;
revoke all on function private.venue_photo_remove(uuid, uuid), public.venue_photo_remove(uuid, uuid) from public, anon;
grant execute on function private.venue_photo_remove(uuid, uuid), public.venue_photo_remove(uuid, uuid) to authenticated;

create function private.venue_showcase_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
 delete from private.venue_view_marks where night_date < private.nightlife_night_date() - 2;
 delete from private.venue_daily_views where night_date < private.nightlife_night_date() - 400;
 delete from private.venue_notices where until < now() - interval '1 day';
end $$;
select cron.schedule('nl_venue_showcase_maintenance', '41 3 * * *', 'select private.venue_showcase_maintenance()');
revoke all on function private.venue_showcase_maintenance() from public, anon, authenticated;
notify pgrst, 'reload schema';
