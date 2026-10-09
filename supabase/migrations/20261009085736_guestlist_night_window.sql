-- Lista de invitados: la hora límite puede ser cualquier momento antes de que acabe la noche
-- en curso (06:00 de Madrid), en vez de «menos de 12 horas». Así un local puede prepararla
-- por la tarde «hasta la 1:30». Solo cambia esa condición; el resto es idéntico.
create or replace function private.nightlife_night_end(p_at timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((private.nightlife_night_date(p_at) + 1)::timestamp + interval '6 hours') at time zone 'Europe/Madrid'
$$;
revoke all on function private.nightlife_night_end(timestamptz) from public, anon;
grant execute on function private.nightlife_night_end(timestamptz) to authenticated;

create or replace function private.venue_guestlist_save(p_venue uuid, p_title text, p_valid_until timestamptz, p_capacity integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid := private.require_bookings_flag(); n date := private.nightlife_night_date();
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-edit', 30);
 if not exists(select 1 from private.venue_booking_settings where venue_id = p_venue and guestlists) then
  raise exception 'not_available' using errcode = '22023';
 end if;
 if char_length(btrim(coalesce(p_title, ''))) not between 3 and 60 or p_capacity is null or p_capacity not between 1 and 500
  or p_valid_until is null or p_valid_until <= now() or p_valid_until > private.nightlife_night_end() then
  raise exception 'invalid list' using errcode = '22023';
 end if;
 insert into private.venue_guestlists(venue_id, night_date, title, valid_until, capacity, created_by, is_test)
 select p_venue, n, btrim(p_title), p_valid_until, p_capacity, u, v.is_test from public.venues v where v.id = p_venue
 on conflict (venue_id, night_date) do update set title = excluded.title, valid_until = excluded.valid_until,
  capacity = greatest(excluded.capacity, (select count(*) from private.venue_guestlist_entries e
   where e.list_id = private.venue_guestlists.id and e.status <> 'cancelled')::integer), status = 'open';
 return private.venue_guestlist(p_venue);
end $$;
