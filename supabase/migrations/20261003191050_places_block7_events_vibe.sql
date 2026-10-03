-- Block 7 · Events, vibe check, lost & found, venue edit (PRD 6.7, 6.8).

-- Fix place_stats upsert (venue OR event exclusive).
create or replace function private.recalc_place_stats(p_venue uuid default null, p_event uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_people integer;
  v_going integer;
  v_avg numeric(4, 1);
  v_green integer;
  v_ratio jsonb;
  v_women integer;
  v_men integer;
  v_other integer;
  v_payload jsonb;
  v_place_id uuid;
begin
  if num_nonnulls(p_venue, p_event) <> 1 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  v_place_id := coalesce(p_venue, p_event);

  select count(*)::integer into v_people
  from public.attendance a
  join public.profiles p on p.id = a.user_id
  where a.kind = 'check_in' and a.expires_at > now()
    and ((p_venue is not null and a.venue_id = p_venue)
      or (p_event is not null and a.event_id = p_event))
    and not p.banned and not p.suspended
    and (not a.is_test or exists(select 1 from public.venues where id=p_venue and is_test)
      or exists(select 1 from public.events where id=p_event and is_test));

  select count(*)::integer into v_going
  from public.attendance a
  where a.kind = 'going' and a.expires_at > now()
    and ((p_venue is not null and a.venue_id = p_venue)
      or (p_event is not null and a.event_id = p_event));

  select
    round(avg(private.age_years(p.birthdate))::numeric, 1),
    round(100.0 * count(*) filter (where p.traffic_light = 'green') / nullif(count(*), 0))::integer,
    count(*) filter (where p.gender = 'woman'),
    count(*) filter (where p.gender = 'man'),
    count(*) filter (where p.gender not in ('woman', 'man'))
  into v_avg, v_green, v_women, v_men, v_other
  from public.attendance a
  join public.profiles p on p.id = a.user_id
  where a.kind = 'check_in' and a.expires_at > now()
    and ((p_venue is not null and a.venue_id = p_venue)
      or (p_event is not null and a.event_id = p_event))
    and not p.banned and not p.suspended
    and (not a.is_test or exists(select 1 from public.venues where id=p_venue and is_test)
      or exists(select 1 from public.events where id=p_event and is_test));

  if v_people >= 5 then
    v_ratio := jsonb_build_object(
      'women', round(100.0 * v_women / v_people)::integer,
      'men', round(100.0 * v_men / v_people)::integer,
      'other', greatest(0, 100 - round(100.0 * v_women / v_people)::integer
                                - round(100.0 * v_men / v_people)::integer)
    );
  else
    v_avg := null; v_green := null; v_ratio := null;
  end if;

  if p_venue is not null then
    insert into public.place_stats (venue_id, people, average_age, green_percent, ratio, going_tonight, updated_at)
    values (p_venue, v_people, v_avg, v_green, v_ratio, v_going, now())
    on conflict (venue_id) do update set
      people = excluded.people, average_age = excluded.average_age,
      green_percent = excluded.green_percent, ratio = excluded.ratio,
      going_tonight = excluded.going_tonight, updated_at = now();
  else
    insert into public.place_stats (event_id, people, average_age, green_percent, ratio, going_tonight, updated_at)
    values (p_event, v_people, v_avg, v_green, v_ratio, v_going, now())
    on conflict (event_id) do update set
      people = excluded.people, average_age = excluded.average_age,
      green_percent = excluded.green_percent, ratio = excluded.ratio,
      going_tonight = excluded.going_tonight, updated_at = now();
  end if;

  v_payload := private.threshold_stats(v_people, v_avg, v_green, v_ratio, v_going);
  begin
    perform realtime.send(
      jsonb_build_object('type', 'stats', 'placeId', v_place_id::text, 'stats', v_payload),
      'stats', case when exists(select 1 from public.venues where id=p_venue and is_test)
        or exists(select 1 from public.events where id=p_event and is_test)
        then 'place-stats:test' else 'place-stats:live' end, true
    );
  exception when undefined_function then raise warning 'realtime.send unavailable';
  end;
end
$$;

-- ── Create / confirm / report events ─────────────────────────────────────────
create or replace function private.create_event(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_age_verified();
  v_title text := btrim(coalesce(p ->> 'title', ''));
  v_category text := coalesce(p ->> 'category', '');
  v_place text := btrim(coalesce(p ->> 'placeName', ''));
  v_address text := btrim(coalesce(p ->> 'address', ''));
  v_lat double precision := (p ->> 'lat')::double precision;
  v_lng double precision := (p ->> 'lng')::double precision;
  v_starts timestamptz := (p ->> 'startsAt')::timestamptz;
  v_ends timestamptz := (p ->> 'endsAt')::timestamptz;
  v_desc text := left(btrim(coalesce(p ->> 'description', '')), 300);
  v_public boolean := coalesce((p ->> 'publicPlaceConfirmed')::boolean, false);
  v_id uuid;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid';
begin
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,7));
  perform private.place_limit('event_create',2,86400);
  if not v_public then raise exception 'not_public' using errcode = '22023'; end if;
  if char_length(v_title) < 3 or char_length(v_title) > 60 then
    raise exception 'bad request' using errcode = '22023';
  end if;
  if v_category not in ('party', 'concert', 'meetup', 'other') then
    raise exception 'bad request' using errcode = '22023';
  end if;
  if v_starts is null or v_ends is null or v_ends <= v_starts then
    raise exception 'bad request' using errcode = '22023';
  end if;
  if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then raise exception 'bad request' using errcode = '22023'; end if;

  if (select count(*) from public.events
      where created_by = v_uid and created_at >= v_day_start and origin = 'user') >= 2 then
    raise exception 'daily_limit' using errcode = '54000';
  end if;

  -- Anti-duplicate: same title near same place within 6 h.
  if exists (
    select 1 from public.events e
    where e.status in ('unconfirmed', 'confirmed', 'official')
      and lower(e.title) = lower(v_title)
      and abs(extract(epoch from (e.starts_at - v_starts))) < 6 * 3600
      and extensions.st_dwithin(
        e.location,
        extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
        80
      )
  ) then
    raise exception 'duplicate' using errcode = '23505';
  end if;

  insert into public.events (
    created_by, title, category, place_name, address, location,
    starts_at, ends_at, description, status, origin, source
  ) values (
    v_uid, v_title, v_category, left(v_place, 80), left(v_address, 160),
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    v_starts, v_ends, v_desc, 'unconfirmed', 'user', 'user'
  ) returning id into v_id;

  insert into public.event_confirmations (event_id, user_id) values (v_id, v_uid);
  return public.get_event(v_id);
end
$$;
revoke all on function private.create_event(jsonb) from public,anon,authenticated;
grant execute on function private.create_event(jsonb) to authenticated;
create or replace function public.create_event(p jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.create_event(p) $$;

create or replace function private.get_event(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e public.events;
  v_conf integer;
  v_fake integer;
begin
  perform private.require_registered();
  select * into e from public.events where id = p_id;
  if e.id is null or e.status not in ('unconfirmed','confirmed','official') or e.hidden_at is not null or e.ends_at<=now() then raise exception 'not found' using errcode = 'P0002'; end if;
  if e.is_test and not private.sees_test_data() then raise exception 'not found' using errcode = 'P0002'; end if;
  select count(*)::integer into v_conf from public.event_confirmations where event_id = p_id;
  select count(*)::integer into v_fake from public.event_reports
  where event_id = p_id and reason = 'fake';
  return jsonb_build_object(
    'id', e.id, 'title', e.title, 'category', e.category,
    'placeName', e.place_name, 'address', e.address,
    'lat', extensions.st_y(e.location::extensions.geometry),
    'lng', extensions.st_x(e.location::extensions.geometry),
    'startsAt', e.starts_at, 'endsAt', e.ends_at,
    'description', e.description, 'status', e.status, 'origin', e.origin,
    'createdAt', e.created_at, 'confirmations', v_conf, 'fakeReports', v_fake,
    'venueId', e.venue_id
  );
end
$$;
revoke all on function private.get_event(uuid) from public,anon,authenticated;
grant execute on function private.get_event(uuid) to authenticated;
create or replace function public.get_event(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_event(p_id) $$;

create or replace function private.confirm_event(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_age_verified();
  e public.events;
  v_conf integer;
begin
  perform private.require_place(p_id);
  perform private.place_limit('confirm',30);
  select * into e from public.events where id = p_id for update;
  if e.id is null or e.status <> 'unconfirmed' or e.created_at<=now()-interval '24 hours' then
    raise exception 'not_unconfirmed' using errcode = '22023';
  end if;
  if exists (select 1 from public.event_confirmations where event_id = p_id and user_id = v_uid) then
    raise exception 'already_confirmed' using errcode = '23505';
  end if;
  insert into public.event_confirmations (event_id, user_id) values (p_id, v_uid);
  select count(*)::integer into v_conf from public.event_confirmations where event_id = p_id;
  if v_conf >= 3 then
    update public.events set status = 'confirmed' where id = p_id;
  end if;
  return public.get_event(p_id);
end
$$;
revoke all on function private.confirm_event(uuid) from public,anon,authenticated;
grant execute on function private.confirm_event(uuid) to authenticated;
create or replace function public.confirm_event(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.confirm_event(p_id) $$;

create or replace function private.report_event(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_fake integer;
begin
  perform private.require_place(p_id);
  perform private.place_limit('report',30);
  perform 1 from public.events where id=p_id for update;
  if p_reason not in ('fake', 'dangerous', 'inappropriate') then
    raise exception 'bad request' using errcode = '22023';
  end if;
  insert into public.event_reports (event_id, user_id, reason)
  values (p_id, v_uid, p_reason)
  on conflict do nothing;
  select count(*)::integer into v_fake from public.event_reports
  where event_id = p_id and reason = 'fake';
  if v_fake >= 3 then
    update public.events
    set status = 'under_review', hidden_at = now()
    where id = p_id and status in ('unconfirmed', 'confirmed');
  end if;
end
$$;
revoke all on function private.report_event(uuid,text) from public,anon,authenticated;
grant execute on function private.report_event(uuid,text) to authenticated;
create or replace function public.report_event(p_id uuid, p_reason text) returns void
language sql security invoker set search_path='' as $$ select private.report_event(p_id,p_reason) $$;

create or replace function private.list_events(p_city text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_registered();
  return coalesce((
    select jsonb_agg(public.get_event(e.id) order by e.starts_at)
    from public.events e
    where e.status in ('unconfirmed', 'confirmed', 'official')
      and e.ends_at > now()
      and (not e.is_test or private.sees_test_data())
      and e.hidden_at is null
      and (p_city is null or exists(select 1 from public.venues v where v.id=e.venue_id and v.city=p_city))
  ), '[]'::jsonb);
end
$$;
revoke all on function private.list_events(text) from public,anon,authenticated;
grant execute on function private.list_events(text) to authenticated;
create or replace function public.list_events(p_city text default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.list_events(p_city) $$;

revoke all on function public.create_event(jsonb) from public, anon;
revoke all on function public.get_event(uuid) from public, anon;
revoke all on function public.confirm_event(uuid) from public, anon;
revoke all on function public.report_event(uuid, text) from public, anon;
revoke all on function public.list_events(text) from public, anon;
grant execute on function public.create_event(jsonb) to authenticated;
grant execute on function public.get_event(uuid) to authenticated;
grant execute on function public.confirm_event(uuid) to authenticated;
grant execute on function public.report_event(uuid, text) to authenticated;
grant execute on function public.list_events(text) to authenticated;

-- ── Vibe Check ───────────────────────────────────────────────────────────────


create or replace function private.my_vibe(p_place_id uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v text;
begin
  select vibe into v from public.ratings
  where user_id = v_uid and night_date = private.nightlife_night_date()
    and (venue_id = p_place_id or event_id = p_place_id)
  limit 1;
  return v;
end
$$;
revoke all on function private.my_vibe(uuid) from public,anon,authenticated;
grant execute on function private.my_vibe(uuid) to authenticated;
create or replace function public.my_vibe(p_place_id uuid) returns text
language sql security invoker set search_path='' as $$ select private.my_vibe(p_place_id) $$;

revoke all on function public.my_vibe(uuid) from public, anon;
grant execute on function public.my_vibe(uuid) to authenticated;

-- ── Lost & found ─────────────────────────────────────────────────────────────
create or replace function private.had_recent_check_in(p_uid uuid, p_place uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.attendance
    where user_id = p_uid and kind = 'check_in'
      and created_at > now() - interval '12 hours'
      and (venue_id = p_place or event_id = p_place)
  )
$$;

create or replace function private.lost_found_list(p_place_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
begin
  perform private.require_place(p_place_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'placeId', coalesce(p.venue_id, p.event_id),
      'mine', p.user_id = v_uid, 'text', p.text, 'createdAt', p.created_at,
      'replies', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'mine', r.user_id = v_uid, 'text', r.text, 'createdAt', r.created_at
        ) order by r.created_at)
        from public.lost_and_found r
        where r.parent_id = p.id and r.expires_at > now()
      ), '[]'::jsonb)
    ) order by p.created_at desc)
    from public.lost_and_found p
    where p.parent_id is null and p.expires_at > now()
      and (p.venue_id = p_place_id or p.event_id = p_place_id)
      and (not p.is_test or private.sees_test_data())
  ), '[]'::jsonb);
end
$$;
revoke all on function private.lost_found_list(uuid) from public,anon,authenticated;
grant execute on function private.lost_found_list(uuid) to authenticated;
create or replace function public.lost_found_list(p_place_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.lost_found_list(p_place_id) $$;

create or replace function private.lost_found_post(p_place_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_text text := btrim(coalesce(p_text, ''));
  v_id uuid;
  v_is_venue boolean;
begin
  perform private.require_place(p_place_id);
  perform private.place_limit('lost_found',30);
  if v_text = '' then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(v_text) > 280 then raise exception 'too_long' using errcode = '22023'; end if;
  if not private.had_recent_check_in(v_uid, p_place_id) then
    raise exception 'no_recent_check_in' using errcode = '22023';
  end if;
  v_is_venue := exists (select 1 from public.venues where id = p_place_id);
  insert into public.lost_and_found (user_id, venue_id, event_id, text, expires_at, is_test)
  values (
    v_uid,
    case when v_is_venue then p_place_id end,
    case when not v_is_venue then p_place_id end,
    v_text, now() + interval '48 hours', private.require_place(p_place_id)
  ) returning id into v_id;
  return (select jsonb_build_object(
    'id', id, 'placeId', p_place_id, 'mine', true, 'text', text,
    'createdAt', created_at, 'replies', '[]'::jsonb
  ) from public.lost_and_found where id = v_id);
end
$$;
revoke all on function private.lost_found_post(uuid,text) from public,anon,authenticated;
grant execute on function private.lost_found_post(uuid,text) to authenticated;
create or replace function public.lost_found_post(p_place_id uuid, p_text text) returns jsonb
language sql security invoker set search_path='' as $$ select private.lost_found_post(p_place_id,p_text) $$;

create or replace function private.lost_found_reply(p_post_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_text text := btrim(coalesce(p_text, ''));
  v_parent public.lost_and_found;
begin
  perform private.place_limit('lost_found',30);
  if v_text = '' then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(v_text) > 280 then raise exception 'too_long' using errcode = '22023'; end if;
  select * into v_parent from public.lost_and_found where id = p_post_id and parent_id is null;
  if v_parent.id is null or v_parent.expires_at<=now() or (v_parent.is_test and not private.sees_test_data()) then raise exception 'not found' using errcode = 'P0002'; end if;
  if not private.had_recent_check_in(v_uid, coalesce(v_parent.venue_id, v_parent.event_id)) then
    raise exception 'no_recent_check_in' using errcode = '22023';
  end if;
  insert into public.lost_and_found (user_id, venue_id, event_id, parent_id, text, expires_at, is_test)
  values (v_uid, v_parent.venue_id, v_parent.event_id, p_post_id, v_text, least(v_parent.expires_at,now() + interval '48 hours'), v_parent.is_test);
  return public.lost_found_list(coalesce(v_parent.venue_id, v_parent.event_id));
end
$$;
revoke all on function private.lost_found_reply(uuid,text) from public,anon,authenticated;
grant execute on function private.lost_found_reply(uuid,text) to authenticated;
create or replace function public.lost_found_reply(p_post_id uuid, p_text text) returns jsonb
language sql security invoker set search_path='' as $$ select private.lost_found_reply(p_post_id,p_text) $$;

create or replace function private.lost_found_edit(p_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
  v_text text := btrim(coalesce(p_text, ''));
  r public.lost_and_found;
begin
  if v_text = '' then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(v_text) > 280 then raise exception 'too_long' using errcode = '22023'; end if;
  select * into r from public.lost_and_found where id = p_id for update;
  if r.id is null or r.user_id <> v_uid or r.expires_at<=now() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not private.had_recent_check_in(v_uid,coalesce(r.venue_id,r.event_id)) then
    raise exception 'no_recent_check_in' using errcode='22023';
  end if;
  update public.lost_and_found set text = v_text where id = p_id;
  return public.lost_found_list(coalesce(r.venue_id, r.event_id));
end
$$;
revoke all on function private.lost_found_edit(uuid,text) from public,anon,authenticated;
grant execute on function private.lost_found_edit(uuid,text) to authenticated;
create or replace function public.lost_found_edit(p_id uuid, p_text text) returns jsonb
language sql security invoker set search_path='' as $$ select private.lost_found_edit(p_id,p_text) $$;

create or replace function private.lost_found_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_registered();
begin
  delete from public.lost_and_found
  where id = p_id and (user_id = v_uid or private.is_admin());
end
$$;
revoke all on function private.lost_found_delete(uuid) from public,anon,authenticated;
grant execute on function private.lost_found_delete(uuid) to authenticated;
create or replace function public.lost_found_delete(p_id uuid) returns void
language sql security invoker set search_path='' as $$ select private.lost_found_delete(p_id) $$;

revoke all on function public.lost_found_list(uuid) from public, anon;
revoke all on function public.lost_found_post(uuid, text) from public, anon;
revoke all on function public.lost_found_reply(uuid, text) from public, anon;
revoke all on function public.lost_found_edit(uuid, text) from public, anon;
revoke all on function public.lost_found_delete(uuid) from public, anon;
grant execute on function public.lost_found_list(uuid) to authenticated;
grant execute on function public.lost_found_post(uuid, text) to authenticated;
grant execute on function public.lost_found_reply(uuid, text) to authenticated;
grant execute on function public.lost_found_edit(uuid, text) to authenticated;
grant execute on function public.lost_found_delete(uuid) to authenticated;

-- ── Venue editorial update (manager / admin) ─────────────────────────────────
create or replace function private.update_venue_details(p_venue uuid, p jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_registered();
  if not (private.is_admin() or private.manages_venue(p_venue)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.venues set
    name=coalesce(nullif(left(btrim(p->>'name'),80),''),name),
    address=coalesce(left(p->>'address',160),address),
    phone=coalesce(left(p->>'phone',40),phone),
    website=case when p ? 'website' then case when (p->>'website')='' or (p->>'website') ~ '^https?://' then left(p->>'website',300) else website end else website end,
    opening_hours=coalesce(p->'openingHours',opening_hours),
    description = coalesce(left(p ->> 'description', 500), description),
    music = coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'music', '[]'::jsonb)) t(x)),
      music
    ),
    dress_code = coalesce(left(p ->> 'dressCode', 80), dress_code),
    min_age = coalesce((p ->> 'minAge')::smallint, min_age),
    notes = coalesce(left(p ->> 'notes', 500), notes),
    type = coalesce((p ->> 'type')::public.venue_type, type),
    hours = coalesce(left(p ->> 'hours', 60), hours),
    city = coalesce(left(p ->> 'city', 40), city),
    catalog_owned = true,
    updated_at = now()
  where id = p_venue;
  perform private.audit('venue.update', p_venue::text);
end
$$;
revoke all on function private.update_venue_details(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.update_venue_details(uuid,jsonb) to authenticated;
create or replace function public.update_venue_details(p_venue uuid, p jsonb) returns void
language sql security invoker set search_path='' as $$ select private.update_venue_details(p_venue,p) $$;
revoke all on function public.update_venue_details(uuid, jsonb) from public, anon;
grant execute on function public.update_venue_details(uuid, jsonb) to authenticated;

-- Who is there (lists, discrete mode excluded) — age verified.
create or replace function private.who_is_there(p_place_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := private.require_age_verified();
begin
  perform private.require_place(p_place_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'trafficLight', p.traffic_light,
      'photoVerified', coalesce(v.photo_verified, false)
    ) order by a.created_at desc)
    from public.attendance a
    join public.profiles p on p.id = a.user_id
    left join public.verification_status v on v.user_id = p.id
    where a.kind = 'check_in' and a.expires_at > now() and a.visible
      and (a.venue_id = p_place_id or a.event_id = p_place_id)
      and not p.banned and not p.discrete_mode
      and p.id <> v_uid
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_uid and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_uid)
      )
      and (not p.is_test or private.sees_test_data())
  ), '[]'::jsonb);
end
$$;
revoke all on function private.who_is_there(uuid) from public,anon,authenticated;
grant execute on function private.who_is_there(uuid) to authenticated;
create or replace function public.who_is_there(p_place_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.who_is_there(p_place_id) $$;
revoke all on function public.who_is_there(uuid) from public, anon;
grant execute on function public.who_is_there(uuid) to authenticated;
