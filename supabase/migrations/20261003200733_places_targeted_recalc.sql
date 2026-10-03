-- Block 7: a check-in or "voy esta noche" only recalculates the places it touches (the new one
-- and the one just left). The full sweep stays in the per-minute cron (nl_places_stats).

create or replace function private.check_in(
  p_place_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_visible boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_venue public.venues;
  v_dist double precision;
  v_expires timestamptz := now() + interval '2 hours';
  v_id uuid;
  v_is_event boolean := false;
  v_event public.events;
  v_prev_venue uuid;
  v_prev_event uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  perform private.place_limit('check_in',30);
  perform private.require_place(p_place_id);
  if not private.latest_consent(v_uid,'precise_location') and not
    (private.sees_test_data() and public.feature_enabled('test_tools_enabled') and private.require_place(p_place_id)) then
    raise exception 'no_location' using errcode='22023';
  end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'bad request' using errcode='22023';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'no_location' using errcode = '22023';
  end if;

  select * into v_venue from public.venues where id = p_place_id;
  if v_venue.id is null then
    select * into v_event from public.events
    where id = p_place_id and status in ('confirmed', 'official', 'unconfirmed');
    if v_event.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
    v_is_event := true;
  end if;

  if p_visible and not private.is_age_verified(v_uid) then
    raise exception 'age verification required' using errcode = '42501';
  end if;

  if v_is_event then
    v_dist := extensions.st_distance(
      v_event.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    );
  else
    if v_venue.is_test and not private.sees_test_data() then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if v_venue.location_source='google' and v_venue.google_expires_at<=now() then
      raise exception 'no_location' using errcode='22023';
    end if;
    v_dist := extensions.st_distance(
      v_venue.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    );
  end if;

  if v_dist is null or v_dist >= 150 then
    raise exception 'too_far' using errcode = '22023';
  end if;

  -- One active check-in: close the previous one and remember where it was.
  with closed as (
    update public.attendance
    set expires_at = now()
    where user_id = v_uid and kind = 'check_in' and expires_at > now()
    returning venue_id, event_id
  )
  select venue_id, event_id into v_prev_venue, v_prev_event from closed limit 1;

  insert into public.attendance (user_id, venue_id, event_id, kind, visible, expires_at, is_test)
  values (
    v_uid,
    case when v_is_event then null else p_place_id end,
    case when v_is_event then p_place_id else null end,
    'check_in',
    coalesce(p_visible, false),
    v_expires,
    case when v_is_event then v_event.is_test else v_venue.is_test end
  )
  returning id into v_id;

  if v_is_event then
    perform private.recalc_place_stats(null, p_place_id);
  else
    perform private.recalc_place_stats(p_place_id, null);
  end if;
  if coalesce(v_prev_venue, v_prev_event) is not null
     and coalesce(v_prev_venue, v_prev_event) <> p_place_id then
    perform private.recalc_place_stats(v_prev_venue, v_prev_event);
  end if;
  return public.my_attendance();
end
$$;
revoke all on function private.check_in(uuid,double precision,double precision,boolean) from public,anon,authenticated;
grant execute on function private.check_in(uuid,double precision,double precision,boolean) to authenticated;

create or replace function private.set_going(p_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_age_verified();
  v_venue public.venues;
  v_prev uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  perform private.place_limit('going',30);
  perform private.require_place(p_place_id);
  if not private.going_window_open() then
    raise exception 'outside_window' using errcode = '22023';
  end if;
  select * into v_venue from public.venues where id = p_place_id;
  if v_venue.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if v_venue.is_test and not private.sees_test_data() then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  with closed as (
    update public.attendance set expires_at = now()
    where user_id = v_uid and kind = 'going' and expires_at > now()
    returning venue_id
  )
  select venue_id into v_prev from closed limit 1;

  insert into public.attendance (user_id, venue_id, kind, visible, expires_at, is_test)
  values (v_uid, p_place_id, 'going', true, private.going_expires_at(), v_venue.is_test);

  perform private.recalc_place_stats(p_place_id, null);
  if v_prev is not null and v_prev <> p_place_id then
    perform private.recalc_place_stats(v_prev, null);
  end if;
  return public.my_attendance();
end
$$;
revoke all on function private.set_going(uuid) from public,anon,authenticated;
grant execute on function private.set_going(uuid) to authenticated;
