-- Roadmap 2026-10 R4 (4/5): results report, admin moderation and API wrappers.
-- Below 5 people every figure is returned as 0 and shown as «menos de 5» (PRD 4.3).
create function private.showcase_t(n bigint) returns integer
language sql immutable set search_path = '' as $$ select case when n >= 5 then n::integer else 0 end $$;

create function private.venue_nights(p_venue uuid, p_kind text, p_from date, p_to date)
returns table(user_id uuid, night_date date)
language sql stable security definer set search_path = '' as $$
 select distinct a.user_id, private.nightlife_night_date(a.created_at) from public.attendance a
 where a.venue_id = p_venue and a.kind = p_kind and (not a.is_test or private.sees_test_data())
  and a.created_at >= ((p_from::timestamp + interval '6 hours') at time zone 'Europe/Madrid')
  and a.created_at < (((p_to + 1)::timestamp + interval '6 hours') at time zone 'Europe/Madrid')
$$;

create function private.venue_period(p_venue uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('from', p_from, 'to', p_to,
  'views', private.showcase_t((select coalesce(sum(views), 0) from private.venue_daily_views
    where venue_id = p_venue and night_date between p_from and p_to)),
  'going', private.showcase_t(g.n), 'checkIns', private.showcase_t(c.n),
  'conversion', case when g.n >= 5 then round(100.0 * b.n / g.n) end)
 from (select count(*) n from private.venue_nights(p_venue, 'going', p_from, p_to)) g,
  (select count(*) n from private.venue_nights(p_venue, 'check_in', p_from, p_to)) c,
  (select count(*) n from private.venue_nights(p_venue, 'going', p_from, p_to) x
    join private.venue_nights(p_venue, 'check_in', p_from, p_to) y using (user_id, night_date)) b
$$;

create function private.venue_report(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t date := private.nightlife_night_date(); f date := t - 29; pro boolean;
begin
 perform private.require_showcase(); perform private.require_venue_manager(p_venue);
 perform private.case_limit('venue-report', 120);
 pro := private.venue_has_pro(p_venue);
 return jsonb_build_object('pro', pro, 'summary', private.venue_period(p_venue, f, t),
  'previous', case when pro then private.venue_period(p_venue, f - 30, f - 1) end,
  'daily', case when pro then (select jsonb_agg(jsonb_build_object('night', d::date,
    'views', private.showcase_t((select coalesce(sum(views), 0) from private.venue_daily_views where venue_id = p_venue and night_date = d::date)),
    'checkIns', private.showcase_t((select count(*) from private.venue_nights(p_venue, 'check_in', d::date, d::date))))
    order by d) from generate_series(f, t, interval '1 day') d) end,
  'sponsorships', coalesce((select jsonb_agg(jsonb_build_object('tier', s.tier, 'from', s.starts_on, 'to', s.ends_on,
    'during', private.venue_period(p_venue, s.starts_on, least(s.ends_on, t)),
    'before', private.venue_period(p_venue, s.starts_on - (least(s.ends_on, t) - s.starts_on + 1), s.starts_on - 1))
    order by s.starts_on desc) from public.sponsorships s where s.venue_id = p_venue and s.status in ('active', 'ended')
    and s.starts_on <= t and s.ends_on >= t - 90
    and (s.mode = 'live' or (private.sees_test_data() and private.flag_value('payments_mode') <> 'live'))), '[]'),
  'flashes', coalesce((select jsonb_agg(jsonb_build_object('title', fa.title, 'startsAt', fa.starts_at, 'endsAt', fa.ends_at,
    'checkIns', private.showcase_t((select count(distinct a.user_id) from public.attendance a where a.venue_id = p_venue
      and a.kind = 'check_in' and (not a.is_test or private.sees_test_data())
      and a.created_at between fa.starts_at and fa.ends_at + interval '3 hours')),
    'weekBefore', private.showcase_t((select count(distinct a.user_id) from public.attendance a where a.venue_id = p_venue
      and a.kind = 'check_in' and (not a.is_test or private.sees_test_data())
      and a.created_at between fa.starts_at - interval '7 days' and fa.ends_at + interval '3 hours' - interval '7 days')))
    order by fa.starts_at desc) from public.flash_alerts fa where fa.venue_id = p_venue and fa.status <> 'draft'
    and fa.starts_at <= now() and fa.starts_at >= now() - interval '90 days'), '[]'));
end $$;

-- Admin moderation (role + aal2, audited).
create function private.admin_venue_photos(p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_admin(); perform private.require_registered();
 if p_status not in ('pending', 'approved', 'rejected') then raise exception 'invalid status' using errcode = '22023'; end if;
 return coalesce((select jsonb_agg(x order by x ->> 'createdAt') from (
  select jsonb_build_object('id', p.id, 'venueId', p.venue_id, 'venueName', v.name, 'city', v.city, 'path', p.path,
   'status', p.status, 'reason', p.reason, 'isCover', p.is_cover, 'createdAt', p.created_at, 'isTest', p.is_test) x
  from private.venue_photos p join public.venues v on v.id = p.venue_id where p.status = p_status
  order by p.created_at limit 100) q), '[]');
end $$;

create function private.admin_venue_photo_review(p_photo uuid, p_approve boolean, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
 perform private.require_admin(); u := private.require_registered();
 if p_approve is null or (not p_approve and (v_reason is null or char_length(v_reason) not between 3 and 200)) then
  raise exception 'invalid review' using errcode = '22023';
 end if;
 update private.venue_photos set status = case when p_approve then 'approved' else 'rejected' end,
  reason = case when p_approve then null else v_reason end, is_cover = is_cover and p_approve,
  reviewed_by = u, reviewed_at = now()
 where id = p_photo;
 if not found then raise exception 'not found' using errcode = 'P0002'; end if;
 perform private.audit(case when p_approve then 'venue_photo.approve' else 'venue_photo.reject' end, p_photo::text);
end $$;

create function public.venue_photos_manage(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_photos_manage(p_venue) $$;
create function public.venue_photo_add(p_venue uuid, p_path text) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_photo_add(p_venue, p_path) $$;
create function public.venue_photo_set_cover(p_venue uuid, p_photo uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_photo_set_cover(p_venue, p_photo) $$;
create function public.venue_details_save(p_venue uuid, p jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_details_save(p_venue, p) $$;
create function public.venue_notice_set(p_venue uuid, p_kind text, p_value text, p_until timestamptz) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_notice_set(p_venue, p_kind, p_value, p_until) $$;
create function public.venue_notice_clear(p_venue uuid, p_kind text) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_notice_clear(p_venue, p_kind) $$;
create function public.venue_showcase(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_showcase(p_venue) $$;
create function public.venue_covers() returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_covers() $$;
create function public.place_view(p_venue uuid) returns void language sql security invoker set search_path = '' as $$ select private.place_view(p_venue) $$;
create function public.venue_report(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_report(p_venue) $$;
create function public.admin_venue_photos(p_status text) returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_venue_photos(p_status) $$;
create function public.admin_venue_photo_review(p_photo uuid, p_approve boolean, p_reason text) returns void language sql security invoker set search_path = '' as $$ select private.admin_venue_photo_review(p_photo, p_approve, p_reason) $$;

revoke all on function private.showcase_t(bigint), private.venue_nights(uuid, text, date, date),
 private.venue_period(uuid, date, date) from public, anon, authenticated;
revoke all on function private.venue_report(uuid), private.admin_venue_photos(text),
 private.admin_venue_photo_review(uuid, boolean, text), public.venue_photos_manage(uuid),
 public.venue_photo_add(uuid, text), public.venue_photo_set_cover(uuid, uuid),
 public.venue_details_save(uuid, jsonb), public.venue_notice_set(uuid, text, text, timestamptz),
 public.venue_notice_clear(uuid, text), public.venue_showcase(uuid), public.venue_covers(), public.place_view(uuid),
 public.venue_report(uuid), public.admin_venue_photos(text), public.admin_venue_photo_review(uuid, boolean, text)
 from public, anon;
grant execute on function private.venue_report(uuid), private.admin_venue_photos(text),
 private.admin_venue_photo_review(uuid, boolean, text), public.venue_photos_manage(uuid),
 public.venue_photo_add(uuid, text), public.venue_photo_set_cover(uuid, uuid),
 public.venue_details_save(uuid, jsonb), public.venue_notice_set(uuid, text, text, timestamptz),
 public.venue_notice_clear(uuid, text), public.venue_showcase(uuid), public.venue_covers(), public.place_view(uuid),
 public.venue_report(uuid), public.admin_venue_photos(text), public.admin_venue_photo_review(uuid, boolean, text)
 to authenticated;
notify pgrst, 'reload schema';
