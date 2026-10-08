-- Paid social actions are server-authorized and serialized against the wallet.
create table private.social_premium_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 incognito boolean not null default false, sparks_seen_at timestamptz not null default '-infinity'
);
create table private.social_sparks (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
 unique(sender_id,recipient_id), check(sender_id<>recipient_id)
);
create index social_sparks_recipient_idx on private.social_sparks(recipient_id,created_at);
create table private.social_spotlights (
 user_id uuid primary key references auth.users(id) on delete cascade,
 venue_id uuid references public.venues(id) on delete cascade, city text not null,
 ends_at timestamptz not null, mode text not null check(mode in('test','live'))
);
create index social_spotlights_venue_idx on private.social_spotlights(venue_id);
alter table private.social_premium_preferences enable row level security;
alter table private.social_sparks enable row level security;
alter table private.social_spotlights enable row level security;
revoke all on private.social_premium_preferences,private.social_sparks,private.social_spotlights from public,anon,authenticated;

create function private.user_has_entitlement(p_user uuid,p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.feature_enabled('premium_enabled') and exists(select 1 from public.entitlements e
 where e.user_id=p_user and e.key=p_key and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
 and (e.mode='live' or (private.flag_value('payments_mode')<>'live' and exists(select 1 from public.user_roles where user_id=p_user and role in('admin','tester')))))
$$;
create function private.incognito_visible(p_viewer uuid,p_person uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not (coalesce((select incognito from private.social_premium_preferences where user_id=p_person),false)
 and private.user_has_entitlement(p_person,'incognito'))
 or exists(select 1 from public.likes where from_user=p_person and to_user=p_viewer)
 or exists(select 1 from public.matches where p_viewer in(user_a,user_b) and p_person in(user_a,user_b))
$$;

create function private.spend_credit(p_user uuid,p_kind text,p_ref text) returns text
language plpgsql security definer set search_path='' as $$
declare balance int; payment_mode text:='live';
begin
 if p_user is distinct from auth.uid() or not public.feature_enabled('premium_enabled') then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('credits:'||p_user::text,0));
 if exists(select 1 from public.credit_ledger where user_id=p_user and kind=p_kind and origin_ref=p_ref) then
  return (select mode from public.credit_ledger where user_id=p_user and kind=p_kind and origin_ref=p_ref limit 1);
 end if;
 select coalesce(sum(delta),0) into balance from public.credit_ledger where user_id=p_user and kind=p_kind and mode='live';
 if balance<=0 and private.sees_test_data() and private.flag_value('payments_mode')<>'live' then
  payment_mode:='test'; select coalesce(sum(delta),0) into balance from public.credit_ledger where user_id=p_user and kind=p_kind and mode='test';
 end if;
 if balance<=0 then return null; end if;
 insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(p_user,p_kind,-1,'spent',payment_mode,p_ref);
 return payment_mode;
end $$;
create function private.premium_social_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified();
begin
 return jsonb_build_object('incognito',coalesce((select incognito from private.social_premium_preferences where user_id=u),false) and private.user_has_entitlement(u,'incognito'),
 'spotlightUntil',(select ends_at from private.social_spotlights where user_id=u and ends_at>now() and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'))),
 'sparksUnread',(select count(*) from private.social_sparks s where recipient_id=u and created_at>coalesce((select sparks_seen_at from private.social_premium_preferences where user_id=u),'-infinity')
 and private.social_pair(u,s.sender_id)));
end $$;
create function private.premium_incognito(p_on boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified();
begin
 if p_on and not public.has_entitlement('incognito') then raise exception 'forbidden' using errcode='42501'; end if;
 insert into private.social_premium_preferences(user_id,incognito) values(u,p_on) on conflict(user_id) do update set incognito=excluded.incognito;
 return private.premium_social_state();
end $$;
create function private.premium_sparks_seen() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified();
begin
 insert into private.social_premium_preferences(user_id,sparks_seen_at) values(u,now()) on conflict(user_id) do update set sparks_seen_at=excluded.sparks_seen_at;
 return private.premium_social_state();
end $$;
create function private.premium_spark(p_person uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); result jsonb; spark_id uuid;
begin
 perform private.social_limit('sparks',30);
 -- Match the lock order of ordinary likes: profile, pair, then wallet.
 perform 1 from public.profiles where id=u for update;
 perform pg_advisory_xact_lock(hashtextextended(least(u,p_person)::text||greatest(u,p_person)::text,8));
 if not private.social_pair(u,p_person) then raise exception 'not found' using errcode='P0002'; end if;
 if exists(select 1 from private.social_sparks where sender_id=u and recipient_id=p_person) then
  return jsonb_build_object('usedToday',private.matching_status()->'usedToday','match',null,'duplicate',true);
 end if;
 if exists(select 1 from public.matches where u in(user_a,user_b) and p_person in(user_a,user_b)) then return '{"error":"already_matched"}'; end if;
 -- No credit is spent when the daily like quota rejects the action.
 if not exists(select 1 from public.likes where from_user=u and to_user=p_person) and not public.has_entitlement('unlimited_likes')
 and (private.matching_status()->>'usedToday')::int>=private.setting_int('free_daily_likes',5) then return '{"error":"limit_reached"}'; end if;
 spark_id:=gen_random_uuid();
 if private.spend_credit(u,'spark',spark_id::text||':spent') is null then return '{"error":"no_credits"}'; end if;
 result:=private.social_like(u,p_person);
 insert into private.social_sparks(id,sender_id,recipient_id) values(spark_id,u,p_person);
 perform realtime.send('{}','refresh','social:'||p_person::text,true);
 perform realtime.send('{}','refresh','social:'||u::text,true);
 return result;
end $$;
create function private.premium_spotlight(p_place uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); payment_mode text; city_name text;
begin
 perform private.social_limit('spotlights',10);
 perform pg_advisory_xact_lock(hashtextextended('credits:'||u::text,0));
 if exists(select 1 from private.social_spotlights where user_id=u and ends_at>now()) then return '{"error":"already_active"}'; end if;
 select city into city_name from public.profiles where id=u and traffic_light<>'red' and not discreet;
 if nullif(city_name,'') is null then return '{"error":"unavailable"}'; end if;
 if p_place is not null then
  perform private.require_place(p_place);
  if not exists(select 1 from public.attendance where user_id=u and venue_id=p_place and visible and expires_at>now()) then return '{"error":"wrong_place"}'; end if;
 end if;
 payment_mode:=private.spend_credit(u,'spotlight',gen_random_uuid()::text||':spent');
 if payment_mode is null then return '{"error":"no_credits"}'; end if;
 insert into private.social_spotlights(user_id,venue_id,city,ends_at,mode) values(u,p_place,city_name,now()+interval '30 minutes',payment_mode)
 on conflict(user_id) do update set venue_id=excluded.venue_id,city=excluded.city,ends_at=excluded.ends_at,mode=excluded.mode;
 return private.premium_social_state();
end $$;

create function public.premium_social_state() returns jsonb language sql security invoker set search_path='' as $$ select private.premium_social_state() $$;
create function public.premium_incognito(p_on boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.premium_incognito(p_on) $$;
create function public.premium_sparks_seen() returns jsonb language sql security invoker set search_path='' as $$ select private.premium_sparks_seen() $$;
create function public.premium_spark(p_person uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.premium_spark(p_person) $$;
create function public.premium_spotlight(p_place uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.premium_spotlight(p_place) $$;
revoke all on function private.user_has_entitlement(uuid,text),private.incognito_visible(uuid,uuid),private.spend_credit(uuid,text,text) from public,anon,authenticated;
do $$ declare n text; args text; begin
 for n,args in select * from (values('premium_social_state',''),('premium_incognito','boolean'),('premium_sparks_seen',''),('premium_spark','uuid'),('premium_spotlight','uuid')) t(n,args) loop
 execute format('revoke all on function private.%I(%s),public.%I(%s) from public,anon,authenticated',n,args,n,args);
 execute format('grant execute on function private.%I(%s),public.%I(%s) to authenticated',n,args,n,args);
 end loop;
end $$;

create or replace function private.social_pair(p_a uuid,p_b uuid,p_discovery boolean default true)
returns boolean language sql stable security definer set search_path='' as $$
 select private.incognito_visible(p_a,p_b) and p_a<>p_b and private.is_age_verified(p_a) and private.is_age_verified(p_b)
 and exists(select 1 from public.profiles a,public.profiles b where a.id=p_a and b.id=p_b
  and (not a.is_test or b.is_test or exists(select 1 from public.user_roles where user_id=p_b and role in ('tester','admin')))
  and (not b.is_test or exists(select 1 from public.user_roles where user_id=p_a and role in ('tester','admin')))
  and (not p_discovery or (a.traffic_light<>'red' and b.traffic_light<>'red' and not a.discreet and not b.discreet)))
 and not exists(select 1 from public.blocks where (blocker_id=p_a and blocked_id=p_b) or (blocker_id=p_b and blocked_id=p_a))
 and (not p_discovery or (private.latest_consent(p_a,'orientation') and private.latest_consent(p_b,'orientation')
  and exists(select 1 from public.profiles a join public.user_preferences ap on ap.user_id=a.id,
   public.profiles b join public.user_preferences bp on bp.user_id=b.id where a.id=p_a and b.id=p_b
   and private.age_years(b.birthdate) between ap.age_min and ap.age_max
   and private.age_years(a.birthdate) between bp.age_min and bp.age_max
   and case b.gender when 'woman' then 'women'=any(ap.interested_in) when 'man' then 'men'=any(ap.interested_in)
    when 'non_binary' then 'non_binary'=any(ap.interested_in) else ap.interested_in @> array['women','men','non_binary'] end
   and case a.gender when 'woman' then 'women'=any(bp.interested_in) when 'man' then 'men'=any(bp.interested_in)
    when 'non_binary' then 'non_binary'=any(bp.interested_in) else bp.interested_in @> array['women','men','non_binary'] end)))
$$;
create or replace function private.matching_candidates(p_place uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_result jsonb;
begin
 perform private.social_limit('profiles',120);
 if p_place is not null then perform private.require_place(p_place); end if;
 select coalesce(jsonb_agg(item order by paid_priority,priority,verified desc,distance nulls last,last_active_at desc,id),'[]') into v_result from (
  select p.id,p.last_active_at,
   case when exists(select 1 from private.social_spotlights s where s.user_id=p.id and s.ends_at>now()
   and (s.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'))
   and ((s.venue_id is null and s.city=(select city from public.profiles where id=v_uid)) or s.venue_id=p_place)) then 0
   when private.user_has_entitlement(p.id,'priority_likes') and exists(select 1 from public.likes where from_user=p.id and to_user=v_uid) then 1 else 2 end as paid_priority,private.social_profile(p.id)->>'photoVerified' as verified,
   case when (c->>'sameVenueNow')::boolean then 0 when (c->>'sameVenueTonight')::boolean then 1 else 2 end as priority,
   (c->>'distanceMeters')::numeric as distance,jsonb_build_object('profile',private.social_profile(p.id),'context',c,'visibilityPriority',case when exists(select 1 from private.social_spotlights s where s.user_id=p.id and s.ends_at>now() and (s.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and ((s.venue_id is null and s.city=(select city from public.profiles where id=v_uid)) or s.venue_id=p_place)) then 0 when private.user_has_entitlement(p.id,'priority_likes') and exists(select 1 from public.likes where from_user=p.id and to_user=v_uid) then 1 else 2 end) as item
  from public.profiles p cross join lateral (select private.social_context(v_uid,p.id) c) ctx
  where private.social_pair(v_uid,p.id) and (p.city=(select city from public.profiles where id=v_uid) or p_place is not null)
  and (p_place is null or exists(select 1 from public.attendance where user_id=p.id and visible and expires_at>now() and coalesce(venue_id,event_id)=p_place))
  and not exists(select 1 from public.likes where from_user=v_uid and to_user=p.id)
  and not exists(select 1 from public.swipe_passes where user_id=v_uid and person_id=p.id)
  and not exists(select 1 from public.matches where v_uid in(user_a,user_b) and p.id in(user_a,user_b))
  order by paid_priority,priority,verified desc,distance nulls last,p.last_active_at desc,p.id limit 50
 ) candidates;
 return v_result;
end $$;
create or replace function private.matching_likes_you() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_profiles jsonb; v_count integer;
begin
 perform private.social_limit('profiles',120);
 select count(*) into v_count from public.likes l where to_user=v_uid and private.social_pair(v_uid,from_user)
  and not exists(select 1 from public.matches where v_uid in(user_a,user_b) and l.from_user in(user_a,user_b));
 if public.has_entitlement('see_likes') then
  select coalesce(jsonb_agg(private.social_profile(from_user) order by paid_priority,created_at desc,from_user),'[]') into v_profiles from (
   select from_user,created_at,case when exists(select 1 from private.social_sparks where sender_id=l.from_user and recipient_id=v_uid) then 0 when private.user_has_entitlement(l.from_user,'priority_likes') then 1 else 2 end paid_priority from public.likes l where to_user=v_uid and private.social_pair(v_uid,from_user)
   and not exists(select 1 from public.matches where v_uid in(user_a,user_b) and l.from_user in(user_a,user_b))
   order by paid_priority,created_at desc,from_user limit 50) likes;
 end if;
 return jsonb_build_object('count',v_count,'profiles',coalesce(v_profiles,'[]'));
end $$;
