-- Home: additive, map-free aggregate API. Existing social/card APIs stay compatible.
create table public.venue_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,venue_id)
);
alter table public.venue_favorites enable row level security;
create policy "favorites: own visible venues" on public.venue_favorites for select to authenticated
using(user_id=(select auth.uid()) and exists(select 1 from public.venues v where v.id=venue_id
  and (not v.is_test or private.sees_test_data())));
revoke all on public.venue_favorites from public,anon,authenticated;
grant select on public.venue_favorites to authenticated;
create index venue_favorites_venue_idx on public.venue_favorites(venue_id);
create index venue_favorites_recent_idx on public.venue_favorites(user_id,created_at desc,venue_id);

-- Receipts acknowledge only likes present in a server snapshot. A late transaction,
-- a new like during rendering, and simultaneous visits cannot consume newer likes.
create table private.likes_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  like_created_at timestamptz not null,
  seen_at timestamptz not null default clock_timestamp(),
  primary key(user_id,sender_id,like_created_at)
);
create table private.likes_view_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  visited_at timestamptz
);
create index likes_view_snapshots_user_idx on private.likes_view_snapshots(user_id,created_at);
alter table private.likes_seen enable row level security;
alter table private.likes_view_snapshots enable row level security;
revoke all on private.likes_seen,private.likes_view_snapshots from public,anon,authenticated;
create index likes_received_recent_idx on public.likes(to_user,created_at,from_user);

-- Internal serializer is inaccessible directly. Every caller enforces registration.
create function private.home_place(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',v.id,'name',v.name,'type',v.type,'city',v.city,
  'address',v.address,'description',v.description,'price',v.price,'hours',v.hours,
  'phone',v.phone,'website',v.website,'openingHours',v.opening_hours,'music',v.music,
  'dressCode',v.dress_code,'minAge',v.min_age,'source',v.location_source,'rating',v.rating,
  'lat',extensions.st_y(v.location::extensions.geometry),'lng',extensions.st_x(v.location::extensions.geometry),
  'openNow',private.venue_open(v.opening_hours),
  'people',case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end,
  'averageAge',case when s.people>=5 then s.average_age end,
  'greenPercent',case when s.people>=5 then s.green_percent end,
  'ratio',case when s.people>=5 then s.ratio end,'goingTonight',coalesce(s.going_tonight,0),
  'vibes',coalesce((select jsonb_object_agg(r.vibe,r.cnt) from (
    select vibe,count(*)::integer cnt from public.ratings
    where venue_id=v.id and night_date=private.nightlife_night_date() group by vibe
  ) r),'{}'::jsonb),
  'favorite',exists(select 1 from public.venue_favorites f where f.user_id=(select auth.uid()) and f.venue_id=v.id),
  'sponsored',sponsor.tier is not null,'sponsorshipTier',sponsor.tier)
 from public.venues v left join public.place_stats s on s.venue_id=v.id
 left join lateral (
  select x->>'tier' tier from jsonb_array_elements(private.visible_sponsorships()) x where x->>'id'=v.id::text limit 1
 ) sponsor on true
 where v.id=p_id and (not v.is_test or private.sees_test_data())
 and v.business_status<>'CLOSED_PERMANENTLY'
 and (v.location_source<>'google' or v.google_expires_at>now())
$$;
revoke all on function private.home_place(uuid) from public,anon,authenticated;

create function private.place_detail(p_place uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_registered(); perform private.place_limit('home-detail',240);
 return private.home_place(p_place);
end $$;

create function private.favorite_set(p_place uuid,p_saved boolean) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered();
begin
 perform private.place_limit('favorite',240);
 if p_saved is null then raise exception 'bad request' using errcode='22023'; end if;
 if not p_saved then
  delete from public.venue_favorites where user_id=u and venue_id=p_place;
  perform realtime.send('{}','home','social:'||u,true);
  return;
 end if;
 if private.home_place(p_place) is null then raise exception 'not found' using errcode='P0002'; end if;
 insert into public.venue_favorites(user_id,venue_id) values(u,p_place) on conflict do nothing;
 perform realtime.send('{}','home','social:'||u,true);
end $$;

create function private.favorites_list(p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered(); result jsonb;
begin
 perform private.place_limit('favorites-read',240);
 if p_offset<0 or p_offset is null then raise exception 'bad request' using errcode='22023'; end if;
 with eligible as materialized (
  select f.venue_id,f.created_at from public.venue_favorites f join public.venues v on v.id=f.venue_id
  where f.user_id=u and (not v.is_test or private.sees_test_data())
  and v.business_status<>'CLOSED_PERMANENTLY' and (v.location_source<>'google' or v.google_expires_at>now())
 ), page as (select * from eligible order by created_at desc,venue_id limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from eligible),'places',
  coalesce((select jsonb_agg(private.home_place(venue_id) order by created_at desc,venue_id) from page),'[]')) into result;
 return result;
end $$;

create function private.home_summary(p_city text,p_lat double precision default null,p_lng double precision default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered(); origin extensions.geography; result jsonb; social jsonb:=null;
begin
 perform private.place_limit('home-read',600);
 if p_city is null or p_city not in('Madrid','Barcelona','Valencia','Sevilla','Málaga','Bilbao','Ibiza','Zaragoza')
 or (p_lat is null)<>(p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
  raise exception 'bad request' using errcode='22023';
 end if;
 origin:=case when p_lat is null then private.city_center(p_city)
  else extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography end;
 if private.is_age_verified(u) then
  with valid_matches as materialized (select id from public.matches where u in(user_a,user_b) and private.in_match(id)),
  conversations as (select m.id,l.sender_id from valid_matches m cross join lateral
   (select sender_id from public.messages where match_id=m.id order by created_at desc,id desc limit 1) l)
  select jsonb_build_object('matches',(select count(*) from valid_matches),
   'totalChats',(select count(*) from conversations),'pendingChats',(select count(*) from conversations where sender_id<>u),
   'newLikes',(select count(*) from public.likes l where to_user=u and private.social_pair(u,from_user)
    and not exists(select 1 from public.matches where u in(user_a,user_b) and l.from_user in(user_a,user_b))
    and not exists(select 1 from private.likes_seen r where r.user_id=u and r.sender_id=l.from_user and r.like_created_at=l.created_at))) into social;
 end if;
 with sponsors as materialized (select x->>'id' id from jsonb_array_elements(private.visible_sponsorships()) x),
 eligible as materialized (
  select v.id,v.name,extensions.st_distance(v.location,origin) distance,
   case when coalesce(s.people,0)>=5 then s.people when coalesce(s.people,0)=0 then 0 else 4 end people,
   coalesce(s.going_tonight,0) going,
   exists(select 1 from sponsors x where x.id=v.id::text) sponsored
  from public.venues v left join public.place_stats s on s.venue_id=v.id
  where v.city=p_city and (not v.is_test or private.sees_test_data()) and v.business_status<>'CLOSED_PERMANENTLY'
  and (v.location_source<>'google' or v.google_expires_at>now())
 ), promoted as (select *,0 lane from eligible where sponsored order by distance,id limit 2),
 organic as (select *,1 lane from eligible where not sponsored order by distance,id limit 5-(select count(*) from promoted)),
 nearby as (select * from promoted union all select * from organic),
 tonight as (select * from eligible where going>0 order by going desc,distance,id limit 3),
 now_here as (select * from eligible where people>0 order by people desc,distance,id limit 3),
 favs as materialized (select f.venue_id,f.created_at from public.venue_favorites f join public.venues v on v.id=f.venue_id
  where f.user_id=u and (not v.is_test or private.sees_test_data()) and v.business_status<>'CLOSED_PERMANENTLY'
  and (v.location_source<>'google' or v.google_expires_at>now())),
 favorites as (select * from favs order by created_at desc,venue_id limit 4)
 select jsonb_build_object(
  'nearby',coalesce((select jsonb_agg(private.home_place(id) order by lane,distance,id) from nearby),'[]'),
  'tonight',coalesce((select jsonb_agg(private.home_place(id) order by going desc,distance,id) from tonight),'[]'),
  'now',coalesce((select jsonb_agg(private.home_place(id) order by people desc,distance,id) from now_here),'[]'),
  'favorites',coalesce((select jsonb_agg(private.home_place(venue_id) order by created_at desc,venue_id) from favorites),'[]'),
  'favoritesTotal',(select count(*) from favs),'social',social) into result;
 return result;
end $$;

create function private.matching_likes_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); items jsonb; profiles jsonb:='[]'; token uuid; total integer;
begin
 perform private.social_limit('profiles',120);
 delete from private.likes_view_snapshots where user_id=u and created_at<now()-interval '1 hour';
 select coalesce(jsonb_agg(jsonb_build_object('sender',from_user,'at',created_at)),'[]'),count(*) into items,total
 from public.likes l where to_user=u and private.social_pair(u,from_user)
 and not exists(select 1 from public.matches where u in(user_a,user_b) and l.from_user in(user_a,user_b));
 insert into private.likes_view_snapshots(user_id,items) values(u,items) returning id into token;
 if public.has_entitlement('see_likes') then
  select coalesce(jsonb_agg(private.social_profile(l.from_user) order by priority,l.created_at desc,l.from_user),'[]') into profiles
  from (select l.from_user,l.created_at,
   case when exists(select 1 from private.social_sparks where sender_id=l.from_user and recipient_id=u) then 0
    when private.user_has_entitlement(l.from_user,'priority_likes') then 1 else 2 end priority
   from public.likes l join jsonb_array_elements(items) x on l.from_user=(x->>'sender')::uuid and l.created_at=(x->>'at')::timestamptz
   where l.to_user=u order by priority,l.created_at desc,l.from_user limit 50) l;
 end if;
 return jsonb_build_object('count',total,'profiles',profiles,'snapshotId',token);
end $$;

create function private.matching_likes_seen(p_snapshot uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); items jsonb;
begin
 perform private.social_limit('likes-seen',240);
 select s.items into items from private.likes_view_snapshots s where s.id=p_snapshot and s.user_id=u
 and s.created_at>=now()-interval '1 hour' for update;
 if items is null then raise exception 'invalid snapshot' using errcode='22023'; end if;
 insert into private.likes_seen(user_id,sender_id,like_created_at)
 select u,l.from_user,l.created_at from public.likes l join jsonb_array_elements(items) x
 on l.from_user=(x->>'sender')::uuid and l.created_at=(x->>'at')::timestamptz where l.to_user=u
 on conflict do nothing;
 update private.likes_view_snapshots set visited_at=coalesce(visited_at,clock_timestamp()) where id=p_snapshot;
 perform realtime.send('{}','home','social:'||u,true);
end $$;

create function public.home_summary(p_city text,p_lat double precision default null,p_lng double precision default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.home_summary(p_city,p_lat,p_lng) $$;
create function public.place_detail(p_place uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.place_detail(p_place) $$;
create function public.favorites_list(p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select private.favorites_list(p_offset) $$;
create function public.favorite_set(p_place uuid,p_saved boolean) returns void language sql security invoker set search_path='' as $$ select private.favorite_set(p_place,p_saved) $$;
create function public.matching_likes_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select private.matching_likes_snapshot() $$;
create function public.matching_likes_seen(p_snapshot uuid) returns void language sql security invoker set search_path='' as $$ select private.matching_likes_seen(p_snapshot) $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('private','public') and p.proname in('home_summary','place_detail','favorites_list','favorite_set','matching_likes_snapshot','matching_likes_seen') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
notify pgrst,'reload schema';
