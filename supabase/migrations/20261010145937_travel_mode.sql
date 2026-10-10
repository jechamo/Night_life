-- Bloque 11b: Modo viaje (ventaja `travel_mode` del Pase, MONETIZATION.md). Explorar y
-- aparecer en el swipe de otra ciudad de lanzamiento hasta 30 días, antes de llegar.
-- Aditiva: tabla privada, funciones nuevas y redefinición de matching_candidates,
-- premium_spotlight y export_my_data para usar la ciudad efectiva. Sin borrados.

create table private.travel_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Lista cerrada: las ciudades de lanzamiento (src/features/places/model/cities.ts).
  city text not null check (city in ('Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao', 'Ibiza', 'Zaragoza')),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private.travel_plans enable row level security;
revoke all on private.travel_plans from public, anon, authenticated;

-- Ciudad que cuenta para el swipe y el Foco: la del viaje solo con el flag, la ventaja
-- vigente y el plan sin caducar; si no, la del perfil. Nunca se expone la ciudad real.
create or replace function private.effective_city(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
 select coalesce(
  (select t.city from private.travel_plans t where t.user_id = p_user and t.ends_at > now()
    and public.feature_enabled('travel_mode_enabled') and private.user_has_entitlement(p_user, 'travel_mode')),
  (select city from public.profiles where id = p_user))
$$;

create or replace function private.travel_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_age_verified(); t private.travel_plans;
begin
 select * into t from private.travel_plans where user_id = u and ends_at > now();
 return jsonb_build_object(
  'enabled', public.feature_enabled('travel_mode_enabled'),
  'entitled', private.user_has_entitlement(u, 'travel_mode'),
  'homeCity', (select city from public.profiles where id = u),
  'city', t.city, 'endsAt', t.ends_at,
  'active', t.city is not null and private.effective_city(u) = t.city);
end $$;

create or replace function private.travel_set(p_city text, p_days int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_age_verified();
begin
 perform private.social_limit('travel', 20);
 if not public.feature_enabled('travel_mode_enabled') then return '{"error":"disabled"}'; end if;
 if not private.user_has_entitlement(u, 'travel_mode') then return '{"error":"premium_required"}'; end if;
 if p_days is null or p_days not between 1 and 30
  or p_city is null or p_city not in ('Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao', 'Ibiza', 'Zaragoza') then
  return '{"error":"invalid"}';
 end if;
 if p_city = (select city from public.profiles where id = u) then return '{"error":"same_city"}'; end if;
 insert into private.travel_plans(user_id, city, ends_at) values(u, p_city, now() + make_interval(days => p_days))
 on conflict(user_id) do update set city = excluded.city, ends_at = excluded.ends_at, created_at = now();
 return private.travel_state();
end $$;

create or replace function private.travel_clear()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_age_verified();
begin
 delete from private.travel_plans where user_id = u;
 return private.travel_state();
end $$;

-- Swipe: misma consulta que antes, con la ciudad efectiva de quien mira y de cada candidato.
create or replace function private.matching_candidates(p_place uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_age_verified(); v_result jsonb; v_city text;
begin
 perform private.social_limit('profiles', 120);
 if p_place is not null then perform private.require_place(p_place); end if;
 v_city := private.effective_city(v_uid);
 select coalesce(jsonb_agg(item order by paid_priority, priority, verified desc, distance nulls last, last_active_at desc, id), '[]') into v_result from (
  select p.id, p.last_active_at,
   case when exists(select 1 from private.social_spotlights s where s.user_id = p.id and s.ends_at > now()
   and (s.mode = 'live' or (private.sees_test_data() and private.flag_value('payments_mode') <> 'live'))
   and ((s.venue_id is null and s.city = v_city) or s.venue_id = p_place)) then 0
   when private.user_has_entitlement(p.id, 'priority_likes') and exists(select 1 from public.likes where from_user = p.id and to_user = v_uid) then 1 else 2 end as paid_priority,
   private.social_profile(p.id)->>'photoVerified' as verified,
   case when (c->>'sameVenueNow')::boolean then 0 when (c->>'sameVenueTonight')::boolean then 1 else 2 end as priority,
   (c->>'distanceMeters')::numeric as distance,
   jsonb_build_object('profile', private.social_profile(p.id), 'context', c, 'visibilityPriority',
    case when exists(select 1 from private.social_spotlights s where s.user_id = p.id and s.ends_at > now()
     and (s.mode = 'live' or (private.sees_test_data() and private.flag_value('payments_mode') <> 'live'))
     and ((s.venue_id is null and s.city = v_city) or s.venue_id = p_place)) then 0
    when private.user_has_entitlement(p.id, 'priority_likes') and exists(select 1 from public.likes where from_user = p.id and to_user = v_uid) then 1 else 2 end) as item
  from public.profiles p cross join lateral (select private.social_context(v_uid, p.id) c) ctx
  where private.social_pair(v_uid, p.id) and (private.effective_city(p.id) = v_city or p_place is not null)
  and (p_place is null or exists(select 1 from public.attendance where user_id = p.id and visible and expires_at > now() and coalesce(venue_id, event_id) = p_place))
  and not exists(select 1 from public.likes where from_user = v_uid and to_user = p.id)
  and not exists(select 1 from public.swipe_passes where user_id = v_uid and person_id = p.id)
  and not exists(select 1 from public.matches where v_uid in (user_a, user_b) and p.id in (user_a, user_b))
  order by paid_priority, priority, verified desc, distance nulls last, p.last_active_at desc, p.id limit 50
 ) candidates;
 return v_result;
end $$;

-- Foco sin local: en la ciudad efectiva (la del viaje, si está activo).
create or replace function private.premium_spotlight(p_place uuid default null::uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_age_verified(); payment_mode text; city_name text;
begin
 perform private.social_limit('spotlights', 10);
 perform pg_advisory_xact_lock(hashtextextended('credits:' || u::text, 0));
 if exists(select 1 from private.social_spotlights where user_id = u and ends_at > now()) then return '{"error":"already_active"}'; end if;
 select private.effective_city(u) into city_name from public.profiles where id = u and traffic_light <> 'red' and not discreet;
 if nullif(city_name, '') is null then return '{"error":"unavailable"}'; end if;
 if p_place is not null then
  perform private.require_place(p_place);
  if not exists(select 1 from public.attendance where user_id = u and venue_id = p_place and visible and expires_at > now()) then return '{"error":"wrong_place"}'; end if;
 end if;
 payment_mode := private.spend_credit(u, 'spotlight', gen_random_uuid()::text || ':spent');
 if payment_mode is null then return '{"error":"no_credits"}'; end if;
 insert into private.social_spotlights(user_id, venue_id, city, ends_at, mode) values(u, p_place, city_name, now() + interval '30 minutes', payment_mode)
 on conflict(user_id) do update set venue_id = excluded.venue_id, city = excluded.city, ends_at = excluded.ends_at, mode = excluded.mode;
 return private.premium_social_state();
end $$;

-- Exportación RGPD con el plan de viaje.
create or replace function private.export_my_data()
returns jsonb language sql security definer set search_path = '' as $$
 select private.export_my_data_r2() || jsonb_build_object(
  'reservations', coalesce((select jsonb_agg(private.reservation_json(r) order by r.created_at desc)
   from private.venue_reservations r where r.user_id = (select auth.uid())), '[]'::jsonb),
  'guestlist_entries', coalesce((select jsonb_agg(private.entry_json(e) - 'code' order by e.created_at desc)
   from private.venue_guestlist_entries e where e.user_id = (select auth.uid())), '[]'::jsonb),
  'travel_plan', (select jsonb_build_object('city', t.city, 'endsAt', t.ends_at, 'createdAt', t.created_at)
   from private.travel_plans t where t.user_id = (select auth.uid())))
$$;

-- Envoltorios públicos.
create or replace function public.travel_state()
returns jsonb language sql set search_path = '' as $$ select private.travel_state() $$;
create or replace function public.travel_set(p_city text, p_days int)
returns jsonb language sql set search_path = '' as $$ select private.travel_set(p_city, p_days) $$;
create or replace function public.travel_clear()
returns jsonb language sql set search_path = '' as $$ select private.travel_clear() $$;

revoke all on function private.effective_city(uuid) from public, anon, authenticated;
revoke all on function private.travel_state() from public, anon;
revoke all on function private.travel_set(text, int) from public, anon;
revoke all on function private.travel_clear() from public, anon;
revoke all on function public.travel_state() from public, anon;
revoke all on function public.travel_set(text, int) from public, anon;
revoke all on function public.travel_clear() from public, anon;
grant execute on function private.travel_state() to authenticated;
grant execute on function private.travel_set(text, int) to authenticated;
grant execute on function private.travel_clear() to authenticated;
grant execute on function public.travel_state() to authenticated;
grant execute on function public.travel_set(text, int) to authenticated;
grant execute on function public.travel_clear() to authenticated;
