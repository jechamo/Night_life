-- Roadmap 2026-10 R5 (3/3): the venue side (settings, requests, tonight's list and the door),
-- daily maintenance (updates only) and API wrappers.
create function private.venue_booking_settings_json(p_venue uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('reservations', coalesce(s.reservations, false), 'guestlists', coalesce(s.guestlists, false),
  'maxParty', coalesce(s.max_party, 10))
 from (select 1) x left join private.venue_booking_settings s on s.venue_id = p_venue
$$;

create function private.venue_booking_settings_save(p_venue uuid, p_reservations boolean, p_guestlists boolean, p_max_party integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag();
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-edit', 30);
 if p_reservations is null or p_guestlists is null or p_max_party is null or p_max_party not between 2 and 20 then
  raise exception 'invalid settings' using errcode = '22023';
 end if;
 insert into private.venue_booking_settings(venue_id, reservations, guestlists, max_party, updated_by, updated_at)
 values (p_venue, p_reservations, p_guestlists, p_max_party, u, clock_timestamp())
 on conflict (venue_id) do update set reservations = excluded.reservations, guestlists = excluded.guestlists,
  max_party = excluded.max_party, updated_by = u, updated_at = clock_timestamp();
 return private.venue_booking_settings_json(p_venue);
end $$;

-- Requests: profile name, party, time and kind only (owner decision: no phone).
create function private.venue_reservations(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_bookings_flag(); perform private.require_venue_manager(p_venue);
 return jsonb_build_object('settings', private.venue_booking_settings_json(p_venue),
  'items', coalesce((select jsonb_agg(private.reservation_json(r) - 'placeName' || jsonb_build_object('name', private.booking_name(r.user_id))
   order by r.arrive_at) from private.venue_reservations r
   where r.venue_id = p_venue and r.arrive_at > now() - interval '6 hours' and r.status <> 'cancelled'), '[]'));
end $$;

create function private.venue_reservation_decide(p_venue uuid, p_id uuid, p_accept boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag(); r private.venue_reservations; v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-booking', 120);
 if p_accept is null or char_length(v_reason) > 200 then raise exception 'invalid decision' using errcode = '22023'; end if;
 update private.venue_reservations set status = case when p_accept then 'accepted' else 'rejected' end,
  reason = case when p_accept then null else v_reason end, decided_by = u, decided_at = now()
 where id = p_id and venue_id = p_venue and status = 'requested' and arrive_at > now() returning * into r;
 if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
 perform private.audit(case when p_accept then 'reservation.accept' else 'reservation.reject' end, p_venue::text || ':' || p_id::text);
 return private.reservation_json(r);
end $$;

create function private.venue_guestlist(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l private.venue_guestlists;
begin
 perform private.require_bookings_flag(); perform private.require_venue_manager(p_venue);
 select * into l from private.venue_guestlists where venue_id = p_venue and night_date = private.nightlife_night_date();
 return jsonb_build_object('settings', private.venue_booking_settings_json(p_venue), 'list', case when l.id is not null then
  jsonb_build_object('id', l.id, 'title', l.title, 'validUntil', l.valid_until, 'capacity', l.capacity, 'status', l.status,
   'entries', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', private.booking_name(e.user_id), 'status', e.status,
     'checkedInAt', e.checked_in_at) order by e.created_at)
    from private.venue_guestlist_entries e where e.list_id = l.id and e.status <> 'cancelled'), '[]')) end);
end $$;

create function private.venue_guestlist_save(p_venue uuid, p_title text, p_valid_until timestamptz, p_capacity integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag(); n date := private.nightlife_night_date();
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-edit', 30);
 if not exists(select 1 from private.venue_booking_settings where venue_id = p_venue and guestlists) then
  raise exception 'not_available' using errcode = '22023';
 end if;
 if char_length(btrim(coalesce(p_title, ''))) not between 3 and 60 or p_capacity is null or p_capacity not between 1 and 500
  or p_valid_until is null or p_valid_until <= now() or p_valid_until > now() + interval '12 hours' then
  raise exception 'invalid list' using errcode = '22023';
 end if;
 insert into private.venue_guestlists(venue_id, night_date, title, valid_until, capacity, created_by, is_test)
 select p_venue, n, btrim(p_title), p_valid_until, p_capacity, u, v.is_test from public.venues v where v.id = p_venue
 on conflict (venue_id, night_date) do update set title = excluded.title, valid_until = excluded.valid_until,
  capacity = greatest(excluded.capacity, (select count(*) from private.venue_guestlist_entries e
   where e.list_id = private.venue_guestlists.id and e.status <> 'cancelled')::integer), status = 'open';
 return private.venue_guestlist(p_venue);
end $$;

create function private.venue_guestlist_close(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_bookings_flag(); perform private.require_venue_manager(p_venue);
 update private.venue_guestlists set status = 'closed' where venue_id = p_venue and night_date = private.nightlife_night_date();
 return private.venue_guestlist(p_venue);
end $$;

-- The door: a code is valid once, only for this venue's list tonight. Rate limited.
create function private.venue_guestlist_checkin(p_venue uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag(); v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'));
 e private.venue_guestlist_entries;
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('guest-door', 120);
 select x.* into e from private.venue_guestlist_entries x join private.venue_guestlists l on l.id = x.list_id
 where l.venue_id = p_venue and l.night_date = private.nightlife_night_date() and x.user_id is not null
  and x.status <> 'cancelled' and private.guest_code(x.id) = v_code for update of x;
 if e.id is null or char_length(v_code) <> 10 then raise exception 'invalid_code' using errcode = '22023'; end if;
 if e.status = 'checked_in' then
  return jsonb_build_object('result', 'already_used', 'name', private.booking_name(e.user_id), 'checkedInAt', e.checked_in_at);
 end if;
 update private.venue_guestlist_entries set status = 'checked_in', checked_in_at = now(), checked_in_by = u where id = e.id;
 perform private.audit('guestlist.checkin', p_venue::text || ':' || e.id::text);
 return jsonb_build_object('result', 'ok', 'name', private.booking_name(e.user_id), 'checkedInAt', now());
end $$;

-- Daily: expire unanswered requests, close past lists and unlink people after 90 days.
create function private.venue_bookings_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
begin
 update private.venue_reservations set status = 'expired' where status = 'requested' and arrive_at < now();
 update private.venue_guestlists set status = 'closed' where status = 'open' and night_date < private.nightlife_night_date();
 update private.venue_reservations set user_id = null where user_id is not null and created_at < now() - interval '90 days';
 update private.venue_guestlist_entries set user_id = null where user_id is not null and created_at < now() - interval '90 days';
end $$;
select cron.schedule('nl_venue_bookings_maintenance', '53 3 * * *', 'select private.venue_bookings_maintenance()');

create function public.venue_bookings(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_bookings(p_venue) $$;
create function public.reservation_request(p_venue uuid, p_arrive_at timestamptz, p_party integer, p_kind text) returns jsonb language sql security invoker set search_path = '' as $$ select private.reservation_request(p_venue, p_arrive_at, p_party, p_kind) $$;
create function public.reservation_cancel(p_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.reservation_cancel(p_id) $$;
create function public.guestlist_join(p_list uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.guestlist_join(p_list) $$;
create function public.guestlist_leave(p_entry uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.guestlist_leave(p_entry) $$;
create function public.my_bookings() returns jsonb language sql security invoker set search_path = '' as $$ select private.my_bookings() $$;
create function public.venue_booking_settings_save(p_venue uuid, p_reservations boolean, p_guestlists boolean, p_max_party integer) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_booking_settings_save(p_venue, p_reservations, p_guestlists, p_max_party) $$;
create function public.venue_reservations(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_reservations(p_venue) $$;
create function public.venue_reservation_decide(p_venue uuid, p_id uuid, p_accept boolean, p_reason text) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_reservation_decide(p_venue, p_id, p_accept, p_reason) $$;
create function public.venue_guestlist(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_guestlist(p_venue) $$;
create function public.venue_guestlist_save(p_venue uuid, p_title text, p_valid_until timestamptz, p_capacity integer) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_guestlist_save(p_venue, p_title, p_valid_until, p_capacity) $$;
create function public.venue_guestlist_close(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_guestlist_close(p_venue) $$;
create function public.venue_guestlist_checkin(p_venue uuid, p_code text) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_guestlist_checkin(p_venue, p_code) $$;

revoke all on function private.venue_booking_settings_json(uuid), private.venue_bookings_maintenance() from public, anon, authenticated;
revoke all on function private.venue_booking_settings_save(uuid, boolean, boolean, integer), private.venue_reservations(uuid),
 private.venue_reservation_decide(uuid, uuid, boolean, text), private.venue_guestlist(uuid),
 private.venue_guestlist_save(uuid, text, timestamptz, integer), private.venue_guestlist_close(uuid),
 private.venue_guestlist_checkin(uuid, text), public.venue_bookings(uuid), public.reservation_request(uuid, timestamptz, integer, text),
 public.reservation_cancel(uuid), public.guestlist_join(uuid), public.guestlist_leave(uuid), public.my_bookings(),
 public.venue_booking_settings_save(uuid, boolean, boolean, integer), public.venue_reservations(uuid),
 public.venue_reservation_decide(uuid, uuid, boolean, text), public.venue_guestlist(uuid),
 public.venue_guestlist_save(uuid, text, timestamptz, integer), public.venue_guestlist_close(uuid),
 public.venue_guestlist_checkin(uuid, text) from public, anon;
grant execute on function private.venue_booking_settings_save(uuid, boolean, boolean, integer), private.venue_reservations(uuid),
 private.venue_reservation_decide(uuid, uuid, boolean, text), private.venue_guestlist(uuid),
 private.venue_guestlist_save(uuid, text, timestamptz, integer), private.venue_guestlist_close(uuid),
 private.venue_guestlist_checkin(uuid, text), public.venue_bookings(uuid), public.reservation_request(uuid, timestamptz, integer, text),
 public.reservation_cancel(uuid), public.guestlist_join(uuid), public.guestlist_leave(uuid), public.my_bookings(),
 public.venue_booking_settings_save(uuid, boolean, boolean, integer), public.venue_reservations(uuid),
 public.venue_reservation_decide(uuid, uuid, boolean, text), public.venue_guestlist(uuid),
 public.venue_guestlist_save(uuid, text, timestamptz, integer), public.venue_guestlist_close(uuid),
 public.venue_guestlist_checkin(uuid, text) to authenticated;
notify pgrst, 'reload schema';
