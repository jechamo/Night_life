-- Roadmap 2026-10 R5 (2/3): what people see and do (flag on; acting needs verified age).
create function private.reservation_json(r private.venue_reservations) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id', r.id, 'placeId', r.venue_id,
  'placeName', (select name from public.venues where id = r.venue_id), 'arriveAt', r.arrive_at,
  'party', r.party, 'kind', r.kind, 'reason', r.reason,
  'status', case when r.status = 'requested' and r.arrive_at < now() then 'expired' else r.status end)
$$;

create function private.entry_json(e private.venue_guestlist_entries) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id', e.id, 'listId', l.id, 'placeId', l.venue_id, 'placeName', v.name,
  'title', l.title, 'validUntil', l.valid_until, 'night', l.night_date, 'status', e.status,
  'code', case when e.status = 'confirmed' then private.guest_code(e.id) end)
 from private.venue_guestlists l join public.venues v on v.id = l.venue_id where l.id = e.list_id
$$;

-- Booking options of a venue for the place page.
create function private.venue_bookings(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag(); s private.venue_booking_settings; l private.venue_guestlists;
begin
 perform private.require_place(p_venue);
 select * into s from private.venue_booking_settings where venue_id = p_venue;
 select * into l from private.venue_guestlists where venue_id = p_venue and night_date = private.nightlife_night_date()
  and status = 'open' and valid_until > now() and coalesce(s.guestlists, false);
 return jsonb_build_object('reservations', coalesce(s.reservations, false), 'maxParty', coalesce(s.max_party, 10),
  'ageVerified', private.is_age_verified(u), 'ownVenue', private.manages_venue(p_venue),
  'guestlist', case when l.id is not null then jsonb_build_object('id', l.id, 'title', l.title, 'validUntil', l.valid_until,
   'full', (select count(*) from private.venue_guestlist_entries where list_id = l.id and status <> 'cancelled') >= l.capacity) end,
  'myEntry', (select private.entry_json(e) from private.venue_guestlist_entries e where e.list_id = l.id and e.user_id = u),
  'myReservations', coalesce((select jsonb_agg(private.reservation_json(r) order by r.arrive_at)
   from private.venue_reservations r where r.venue_id = p_venue and r.user_id = u and r.arrive_at > now() - interval '6 hours'), '[]'));
end $$;

create function private.reservation_request(p_venue uuid, p_arrive_at timestamptz, p_party integer, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings(); s private.venue_booking_settings; r private.venue_reservations;
begin
 perform private.require_place(p_venue); perform private.case_limit('booking', 20);
 select * into s from private.venue_booking_settings where venue_id = p_venue;
 if not coalesce(s.reservations, false) then raise exception 'not_available' using errcode = '22023'; end if;
 if private.manages_venue(p_venue) then raise exception 'own_venue' using errcode = '22023'; end if;
 if p_kind not in ('table', 'bottle') or p_party is null or p_party < 1 or p_party > s.max_party
  or p_arrive_at is null or p_arrive_at < now() + interval '30 minutes' or p_arrive_at > now() + interval '14 days' then
  raise exception 'invalid booking' using errcode = '22023';
 end if;
 if (select count(*) from private.venue_reservations where user_id = u and status in ('requested', 'accepted')
  and arrive_at > now()) >= 3 then raise exception 'booking_limit' using errcode = '54000'; end if;
 if exists(select 1 from private.venue_reservations where venue_id = p_venue and user_id = u
  and night_date = private.nightlife_night_date(p_arrive_at) and status in ('requested', 'accepted')) then
  raise exception 'already_booked' using errcode = '23505';
 end if;
 insert into private.venue_reservations(venue_id, user_id, night_date, arrive_at, party, kind, is_test)
 select p_venue, u, private.nightlife_night_date(p_arrive_at), p_arrive_at, p_party, p_kind, v.is_test
 from public.venues v where v.id = p_venue returning * into r;
 return private.reservation_json(r);
end $$;

create function private.reservation_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag(); r private.venue_reservations;
begin
 perform private.case_limit('booking', 20);
 update private.venue_reservations set status = 'cancelled'
 where id = p_id and user_id = u and status in ('requested', 'accepted') and arrive_at > now() returning * into r;
 if r.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
 return private.reservation_json(r);
end $$;

create function private.guestlist_join(p_list uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings(); l private.venue_guestlists; e private.venue_guestlist_entries;
begin
 perform private.case_limit('booking', 20);
 select * into l from private.venue_guestlists where id = p_list for update;
 if l.id is null or l.status <> 'open' or l.valid_until <= now() or l.night_date < private.nightlife_night_date()
  or not exists(select 1 from private.venue_booking_settings where venue_id = l.venue_id and guestlists) then
  raise exception 'not_available' using errcode = '22023';
 end if;
 perform private.require_place(l.venue_id);
 if private.manages_venue(l.venue_id) then raise exception 'own_venue' using errcode = '22023'; end if;
 select * into e from private.venue_guestlist_entries where list_id = l.id and user_id = u;
 if e.status in ('confirmed', 'checked_in') then return private.entry_json(e); end if;
 if (select count(*) from private.venue_guestlist_entries where list_id = l.id and status <> 'cancelled') >= l.capacity then
  raise exception 'list_full' using errcode = '54000';
 end if;
 if e.id is not null then
  update private.venue_guestlist_entries set status = 'confirmed' where id = e.id returning * into e;
 else
  insert into private.venue_guestlist_entries(list_id, user_id, is_test) values (l.id, u, l.is_test) returning * into e;
 end if;
 return private.entry_json(e);
end $$;

create function private.guestlist_leave(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag(); e private.venue_guestlist_entries;
begin
 perform private.case_limit('booking', 20);
 update private.venue_guestlist_entries set status = 'cancelled' where id = p_entry and user_id = u and status = 'confirmed'
 returning * into e;
 if e.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
 return private.entry_json(e);
end $$;

-- «Mis reservas»: upcoming and last night's.
create function private.my_bookings() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_bookings_flag();
begin
 return jsonb_build_object(
  'reservations', coalesce((select jsonb_agg(private.reservation_json(r) order by r.arrive_at)
   from private.venue_reservations r where r.user_id = u and r.arrive_at > now() - interval '12 hours'), '[]'),
  'entries', coalesce((select jsonb_agg(private.entry_json(e) order by l.night_date)
   from private.venue_guestlist_entries e join private.venue_guestlists l on l.id = e.list_id
   where e.user_id = u and l.night_date >= private.nightlife_night_date() - 1), '[]'));
end $$;

-- GDPR access: the export also includes the person's bookings.
alter function private.export_my_data() rename to export_my_data_r2;
create function private.export_my_data() returns jsonb
language sql security definer set search_path = '' as $$
 select private.export_my_data_r2() || jsonb_build_object(
  'reservations', coalesce((select jsonb_agg(private.reservation_json(r) order by r.created_at desc)
   from private.venue_reservations r where r.user_id = (select auth.uid())), '[]'::jsonb),
  'guestlist_entries', coalesce((select jsonb_agg(private.entry_json(e) - 'code' order by e.created_at desc)
   from private.venue_guestlist_entries e where e.user_id = (select auth.uid())), '[]'::jsonb))
$$;

revoke all on function private.reservation_json(private.venue_reservations), private.entry_json(private.venue_guestlist_entries),
 private.export_my_data_r2() from public, anon, authenticated;
revoke all on function private.venue_bookings(uuid), private.reservation_request(uuid, timestamptz, integer, text),
 private.reservation_cancel(uuid), private.guestlist_join(uuid), private.guestlist_leave(uuid), private.my_bookings(),
 private.export_my_data() from public, anon;
grant execute on function private.venue_bookings(uuid), private.reservation_request(uuid, timestamptz, integer, text),
 private.reservation_cancel(uuid), private.guestlist_join(uuid), private.guestlist_leave(uuid), private.my_bookings(),
 private.export_my_data() to authenticated;
