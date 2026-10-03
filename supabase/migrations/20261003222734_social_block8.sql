-- Block 8: private server rules, transactional mutual likes and private realtime.
create table public.swipe_passes (
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,person_id), check(user_id<>person_id)
);
alter table public.swipe_passes enable row level security;
create policy "passes: own" on public.swipe_passes for select to authenticated
using(user_id=(select auth.uid()));
create index swipe_passes_person_idx on public.swipe_passes(person_id);
revoke all on public.swipe_passes from anon,authenticated;
grant select on public.swipe_passes to authenticated;
create index likes_daily_idx on public.likes(from_user,created_at);
create table private.social_daily_likes (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null, used integer not null default 0 check(used>=0), primary key(user_id,day)
);
alter table private.social_daily_likes enable row level security;
revoke all on private.social_daily_likes from public,anon,authenticated;

create table private.social_ip_limits (
  ip_hmac text not null, action text not null, bucket bigint not null, hits integer not null,
  created_at timestamptz not null default now(), primary key(ip_hmac,action,bucket)
);
alter table private.social_ip_limits enable row level security;
revoke all on private.social_ip_limits from public,anon,authenticated;

create function private.social_limit(p_action text,p_max integer) returns void
language plpgsql security definer set search_path='' as $$
declare v_headers jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
 v_ip text; v_hits integer;
begin
 perform private.place_limit('social:'||p_action,p_max,3600);
 v_ip:=coalesce(v_headers->>'cf-connecting-ip',v_headers->>'x-real-ip',split_part(v_headers->>'x-forwarded-for',',',1));
 if nullif(btrim(v_ip),'') is not null then
  insert into private.social_ip_limits(ip_hmac,action,bucket,hits)
  values(private.hmac_hex('social-ip:'||btrim(v_ip)),p_action,floor(extract(epoch from now())/3600)::bigint,1)
  on conflict(ip_hmac,action,bucket) do update set hits=private.social_ip_limits.hits+1 returning hits into v_hits;
  if v_hits>p_max*10 then raise exception 'rate limited' using errcode='54000'; end if;
 end if;
 delete from private.social_ip_limits where created_at<now()-interval '2 days';
end $$;

-- Existing matches survive changes to preferences/visibility; blocks and invalid age never do.
create function private.social_pair(p_a uuid,p_b uuid,p_discovery boolean default true)
returns boolean language sql stable security definer set search_path='' as $$
 select p_a<>p_b and private.is_age_verified(p_a) and private.is_age_verified(p_b)
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

create function private.social_profile(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'age',private.age_years(p.birthdate),'gender',p.gender,
  'bio',p.bio,'photos',p.photos,'trafficLight',p.traffic_light,'anthem',p.anthem,
  'photoVerified',coalesce(v.photo_verified and (v.photo_mode='live' or
   (v.photo_mode='sandbox' and private.flag_value('verification_mode')='sandbox'
    and exists(select 1 from public.user_roles where user_id=p.id and role in ('tester','admin')))),false))
 from public.profiles p left join public.verification_status v on v.user_id=p.id where p.id=p_id
$$;

create function private.social_context(p_a uuid,p_b uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with shared as (
  select coalesce(a.venue_id,a.event_id) as place_id,a.kind from public.attendance a join public.attendance b
  on coalesce(a.venue_id,a.event_id)=coalesce(b.venue_id,b.event_id) and a.kind=b.kind
  where a.user_id=p_a and b.user_id=p_b and a.visible and b.visible and a.expires_at>now() and b.expires_at>now()
  order by (a.kind='check_in') desc limit 1
 ), distance as (
  select round((extensions.st_distance(av.location,bv.location)/100)::numeric)*100 as meters
  from public.attendance a join public.venues av on av.id=a.venue_id,
   public.attendance b join public.venues bv on bv.id=b.venue_id
  where a.user_id=p_a and b.user_id=p_b and a.visible and b.visible and a.kind='check_in' and b.kind='check_in'
   and a.expires_at>now() and b.expires_at>now() limit 1
 ) select jsonb_build_object('sameVenueNow',coalesce((select kind='check_in' from shared),false),
  'sameVenueTonight',coalesce((select kind='going' from shared),false),'distanceMeters',(select meters from distance),
  'venueName',coalesce((select name from public.venues where id=(select place_id from shared)),
   (select title from public.events where id=(select place_id from shared))),
  'sharedArtist',(select case when nullif(a.anthem->>'artist','')=b.anthem->>'artist' then a.anthem->>'artist' end
   from public.profiles a,public.profiles b where a.id=p_a and b.id=p_b))
$$;

create function private.social_match(p_match uuid,p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'createdAt',created_at,
  'person',private.social_profile(case when user_a=p_user then user_b else user_a end),
  'context',private.social_context(p_user,case when user_a=p_user then user_b else user_a end))
 from public.matches where id=p_match and p_user in(user_a,user_b)
$$;

create function private.matching_candidates(p_place uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_result jsonb;
begin
 perform private.social_limit('profiles',120);
 if p_place is not null then perform private.require_place(p_place); end if;
 select coalesce(jsonb_agg(item order by priority,verified desc,distance nulls last,last_active_at desc,id),'[]') into v_result from (
  select p.id,p.last_active_at,private.social_profile(p.id)->>'photoVerified' as verified,
   case when (c->>'sameVenueNow')::boolean then 0 when (c->>'sameVenueTonight')::boolean then 1 else 2 end as priority,
   (c->>'distanceMeters')::numeric as distance,jsonb_build_object('profile',private.social_profile(p.id),'context',c) as item
  from public.profiles p cross join lateral (select private.social_context(v_uid,p.id) c) ctx
  where private.social_pair(v_uid,p.id) and (p.city=(select city from public.profiles where id=v_uid) or p_place is not null)
  and (p_place is null or exists(select 1 from public.attendance where user_id=p.id and visible and expires_at>now() and coalesce(venue_id,event_id)=p_place))
  and not exists(select 1 from public.likes where from_user=v_uid and to_user=p.id)
  and not exists(select 1 from public.swipe_passes where user_id=v_uid and person_id=p.id)
  and not exists(select 1 from public.matches where v_uid in(user_a,user_b) and p.id in(user_a,user_b))
  order by priority,verified desc,distance nulls last,p.last_active_at desc,p.id limit 50
 ) candidates;
 return v_result;
end $$;

create function private.matching_person(p_person uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified();
begin
 perform private.social_limit('profiles',120);
 if not private.social_pair(v_uid,p_person) and not (private.social_pair(v_uid,p_person,false) and
  exists(select 1 from public.matches where v_uid in(user_a,user_b) and p_person in(user_a,user_b))) then return null; end if;
 return private.social_profile(p_person);
end $$;

create function private.matching_status() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified();
begin
 return jsonb_build_object('usedToday',coalesce((select used from private.social_daily_likes where user_id=v_uid
  and day=(now() at time zone 'Europe/Madrid')::date),0),
  'limit',(select value::integer from public.app_settings where key='free_daily_likes'),
  'unlimited',public.has_entitlement('unlimited_likes'));
end $$;

-- Serialize a user's daily quota and each pair. Concurrent reciprocal likes create one match.
create function private.social_like(p_from uuid,p_to uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_used integer; v_limit integer; v_match uuid; v_created boolean:=false; v_unlimited boolean;
begin
 perform 1 from public.profiles where id=p_from for update;
 perform pg_advisory_xact_lock(hashtextextended(least(p_from,p_to)::text||greatest(p_from,p_to)::text,8));
 if not private.social_pair(p_from,p_to) then raise exception 'not found' using errcode='P0002'; end if;
 select coalesce((select used from private.social_daily_likes where user_id=p_from
  and day=(now() at time zone 'Europe/Madrid')::date),0) into v_used;
 select value::integer into v_limit from public.app_settings where key='free_daily_likes';
 v_unlimited:=public.feature_enabled('premium_enabled') and exists(select 1 from public.entitlements
  where user_id=p_from and key='unlimited_likes' and status='active' and starts_at<=now() and (ends_at is null or ends_at>now()));
 if not exists(select 1 from public.likes where from_user=p_from and to_user=p_to) then
  if not v_unlimited and v_used>=coalesce(v_limit,5) then return jsonb_build_object('error','limit_reached'); end if;
  insert into public.likes(from_user,to_user) values(p_from,p_to); v_used:=v_used+1;
  insert into private.social_daily_likes(user_id,day,used) values(p_from,(now() at time zone 'Europe/Madrid')::date,v_used)
  on conflict(user_id,day) do update set used=excluded.used;
 end if;
 if exists(select 1 from public.likes where from_user=p_to and to_user=p_from) then
  insert into public.matches(user_a,user_b) values(least(p_from,p_to),greatest(p_from,p_to))
  on conflict(user_a,user_b) do nothing returning id into v_match;
  v_created:=v_match is not null;
  if v_match is null then select id into v_match from public.matches where user_a=least(p_from,p_to) and user_b=greatest(p_from,p_to); end if;
  if v_created then
   perform realtime.send(jsonb_build_object('matchId',v_match),'match','social:'||p_from,true);
   perform realtime.send(jsonb_build_object('matchId',v_match),'match','social:'||p_to,true);
  end if;
 end if;
 return jsonb_build_object('usedToday',v_used,'match',private.social_match(v_match,p_from));
end $$;
create function private.matching_like(p_person uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified();
begin perform private.social_limit('likes',100); return private.social_like(v_uid,p_person); end $$;

create function private.matching_pass(p_person uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified();
begin
 perform private.social_limit('passes',300);
 if not private.social_pair(v_uid,p_person) then raise exception 'not found' using errcode='P0002'; end if;
 insert into public.swipe_passes(user_id,person_id) values(v_uid,p_person) on conflict do nothing;
end $$;
create function private.matching_undo() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_person uuid;
begin
 if not public.has_entitlement('undo') then raise exception 'entitlement required' using errcode='42501'; end if;
 perform private.social_limit('undo',60);
 select person_id into v_person from public.swipe_passes where user_id=v_uid order by created_at desc,person_id limit 1 for update;
 if v_person is null then return null; end if;
 delete from public.swipe_passes where user_id=v_uid and person_id=v_person;
 if not private.social_pair(v_uid,v_person) then return null; end if;
 return jsonb_build_object('profile',private.social_profile(v_person),'context',private.social_context(v_uid,v_person));
end $$;

create function private.matching_likes_you() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_profiles jsonb; v_count integer;
begin
 perform private.social_limit('profiles',120);
 select count(*) into v_count from public.likes l where to_user=v_uid and private.social_pair(v_uid,from_user)
  and not exists(select 1 from public.matches where v_uid in(user_a,user_b) and l.from_user in(user_a,user_b));
 if public.has_entitlement('see_likes') then
  select coalesce(jsonb_agg(private.social_profile(from_user)),'[]') into v_profiles from (
   select from_user from public.likes l where to_user=v_uid and private.social_pair(v_uid,from_user)
   and not exists(select 1 from public.matches where v_uid in(user_a,user_b) and l.from_user in(user_a,user_b))
   order by created_at desc limit 50) likes;
 end if;
 return jsonb_build_object('count',v_count,'profiles',coalesce(v_profiles,'[]'));
end $$;

create function private.matching_matches() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_result jsonb;
begin
 select coalesce(jsonb_agg(private.social_match(id,v_uid) order by created_at desc),'[]') into v_result
 from (select * from public.matches where v_uid in(user_a,user_b)
  and private.social_pair(v_uid,case when user_a=v_uid then user_b else user_a end,false)
  order by created_at desc limit 100) m;
 return v_result;
end $$;

create or replace function private.in_match(_match uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.matches where id=_match and (select auth.uid()) in(user_a,user_b)
  and private.social_pair((select auth.uid()),case when user_a=(select auth.uid()) then user_b else user_a end,false))
$$;
create function private.require_social_match(p_match uuid) returns public.matches
language plpgsql security definer set search_path='' as $$
declare v_match public.matches;
begin
 perform private.require_age_verified();
 select * into v_match from public.matches where id=p_match for update;
 if v_match.id is null or not private.in_match(p_match) then raise exception 'not found' using errcode='P0002'; end if;
 return v_match;
end $$;

create function private.matching_unmatch(p_match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_m public.matches;
begin
 select * into v_m from public.matches where id=p_match;
 if v_m.id is null then raise exception 'not found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_m.user_a::text||v_m.user_b::text,8));
 v_m:=private.require_social_match(p_match);
 delete from public.likes where (from_user=v_m.user_a and to_user=v_m.user_b) or (from_user=v_m.user_b and to_user=v_m.user_a);
 insert into public.swipe_passes(user_id,person_id) values(v_m.user_a,v_m.user_b),(v_m.user_b,v_m.user_a) on conflict do nothing;
 delete from public.matches where id=p_match;
 perform realtime.send(jsonb_build_object('matchId',p_match),'removed','social:'||v_m.user_a,true);
 perform realtime.send(jsonb_build_object('matchId',p_match),'removed','social:'||v_m.user_b,true);
end $$;

create function private.matching_block(p_person uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_registered(); v_mid uuid;
begin
 perform private.social_limit('blocks',60);
 if p_person=v_uid or not exists(select 1 from public.profiles where id=p_person and (not is_test or private.sees_test_data()))
  then raise exception 'not found' using errcode='P0002'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(v_uid,p_person)::text||greatest(v_uid,p_person)::text,8));
 insert into public.blocks(blocker_id,blocked_id) values(v_uid,p_person) on conflict do nothing;
 for v_mid in select id from public.matches where v_uid in(user_a,user_b) and p_person in(user_a,user_b) loop
  delete from public.matches where id=v_mid;
  perform realtime.send(jsonb_build_object('matchId',v_mid),'removed','social:'||v_uid,true);
  perform realtime.send(jsonb_build_object('matchId',v_mid),'removed','social:'||p_person,true);
 end loop;
 delete from public.likes where (from_user=v_uid and to_user=p_person) or (from_user=p_person and to_user=v_uid);
 perform realtime.send('{}','refresh','social:'||v_uid,true);
 perform realtime.send('{}','refresh','social:'||p_person,true);
end $$;

create function private.matching_report(p_person uuid,p_reason text,p_comment text) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_registered();
begin
 perform private.social_limit('reports',10);
 if p_reason not in ('possible_minor','harassment','feel_followed','fake_profile','inappropriate','spam','other')
  or p_comment is null or char_length(p_comment)>2000 then raise exception 'bad request' using errcode='22023'; end if;
 if p_person=v_uid or not exists(select 1 from public.profiles where id=p_person and (not is_test or private.sees_test_data()))
  then raise exception 'not found' using errcode='P0002'; end if;
 insert into public.reports(reporter_id,target_user_id,reason,comment) values(v_uid,p_person,p_reason,p_comment);
end $$;

create function private.chat_message(p_id uuid,p_user uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'matchId',match_id,'fromMe',sender_id=p_user,'text',text,'sentAt',created_at,'readAt',read_at)
 from public.messages where id=p_id
$$;
create function private.chat_messages(p_match uuid,p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_uid uuid:=private.require_age_verified();
begin
 perform private.require_social_match(p_match); perform private.social_limit('messages-read',300);
 select coalesce(jsonb_agg(private.chat_message(id,v_uid) order by created_at,id),'[]') into v_result from (
  select id,created_at from public.messages where match_id=p_match and (p_before is null or created_at<p_before)
  order by created_at desc,id desc limit 100) messages;
 return v_result;
end $$;
create function private.chat_send(p_match uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_m public.matches; v_id uuid;
begin
 v_m:=private.require_social_match(p_match); perform private.social_limit('messages-send',120);
 if p_text is null or char_length(btrim(p_text)) not between 1 and 1000 then raise exception 'bad request' using errcode='22023'; end if;
 insert into public.messages(match_id,sender_id,text) values(p_match,v_uid,btrim(p_text)) returning id into v_id;
 -- Broadcast identifiers only. Every recipient re-authorizes and loads the persisted message.
 perform realtime.send(jsonb_build_object('matchId',p_match),'message','social:'||v_m.user_a,true);
 perform realtime.send(jsonb_build_object('matchId',p_match),'message','social:'||v_m.user_b,true);
 return private.chat_message(v_id,v_uid);
end $$;
create function private.chat_read(p_match uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_m public.matches; v_n integer;
begin
 v_m:=private.require_social_match(p_match); perform private.social_limit('read',300);
 update public.messages set read_at=now() where match_id=p_match and sender_id<>v_uid and read_at is null;
 get diagnostics v_n=row_count;
 if v_n>0 then
  perform realtime.send(jsonb_build_object('matchId',p_match),'read','social:'||v_m.user_a,true);
  perform realtime.send(jsonb_build_object('matchId',p_match),'read','social:'||v_m.user_b,true);
 end if;
end $$;
create function private.chat_typing(p_match uuid,p_typing boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_m public.matches;
begin
 v_m:=private.require_social_match(p_match); perform private.social_limit('typing',1200);
 perform realtime.send(jsonb_build_object('matchId',p_match,'typing',coalesce(p_typing,false)),'typing',
  'social:'||case when v_m.user_a=v_uid then v_m.user_b else v_m.user_a end,true);
end $$;
create function private.chat_summaries() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_age_verified(); v_result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('matchId',m.id,'last',private.chat_message(l.id,v_uid),
  'unread',(select count(*) from public.messages where match_id=m.id and sender_id<>v_uid and read_at is null))),'[]') into v_result
 from (select * from public.matches where v_uid in(user_a,user_b) and private.in_match(id) order by created_at desc limit 100) m
 left join lateral (select id from public.messages where match_id=m.id order by created_at desc,id desc limit 1) l on true;
 return v_result;
end $$;

create function private.sim_social(p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.assert_test_tools(); v_person uuid; v_m public.matches; v_result jsonb;
begin
 perform private.require_age_verified(); perform private.social_limit('simulator',30);
 if p_action='like' then
  select id into v_person from public.profiles p where p.is_test and private.social_pair(v_uid,p.id)
   and not exists(select 1 from public.likes where from_user=p.id and to_user=v_uid)
   order by last_active_at desc,id limit 1;
  if v_person is null then return jsonb_build_object('result','none'); end if;
  v_result:=private.social_like(v_person,v_uid);
 elsif p_action='message' then
  select m.* into v_m from public.matches m join public.profiles p on p.id=case when user_a=v_uid then user_b else user_a end
   where v_uid in(user_a,user_b) and p.is_test and private.in_match(m.id) order by m.created_at desc limit 1 for update of m;
  if v_m.id is null then return jsonb_build_object('result','none'); end if;
  v_person:=case when v_m.user_a=v_uid then v_m.user_b else v_m.user_a end;
  insert into public.messages(match_id,sender_id,text) values(v_m.id,v_person,'Test: hello / hola');
  perform realtime.send(jsonb_build_object('matchId',v_m.id),'message','social:'||v_uid,true);
  v_result:=jsonb_build_object('result','message');
 else raise exception 'bad request' using errcode='22023'; end if;
 perform private.audit('test_tool.social_'||p_action,'test profile '||v_person::text);
 perform realtime.send('{}','refresh','social:'||v_uid,true);
 return v_result;
end $$;

create function private.set_anthem(p_anthem jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_registered();
begin
 if p_anthem is not null and p_anthem<>'null'::jsonb then
  if jsonb_typeof(p_anthem)<>'object' or jsonb_typeof(p_anthem->'title') is distinct from 'string'
   or jsonb_typeof(p_anthem->'artist') is distinct from 'string'
   or char_length(btrim(p_anthem->>'title')) not between 1 and 80
   or char_length(btrim(p_anthem->>'artist')) not between 1 and 80 then raise exception 'bad request' using errcode='22023'; end if;
  -- Explicit persisted test Anthem; no Spotify account is configured or activated.
  perform private.assert_test_tools();
  update public.profiles set anthem=jsonb_build_object('title',btrim(p_anthem->>'title'),'artist',btrim(p_anthem->>'artist'),'simulated',true) where id=v_uid;
 else update public.profiles set anthem=null where id=v_uid; end if;
 perform private.audit('profile.anthem','persisted test anthem');
end $$;

-- Every API wrapper is invoker. Helpers remain inaccessible from the API.
do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and (p.proname like 'social_%' or p.proname like 'matching_%' or p.proname like 'chat_%'
  or p.proname in ('sim_social','set_anthem','require_social_match')) loop
  execute 'revoke all on function '||r.signature||' from public,anon,authenticated';
 end loop;
end $$;
create function public.matching_candidates(p_place uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.matching_candidates(p_place) $$;
create function public.matching_person(p_person uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.matching_person(p_person) $$;
create function public.matching_status() returns jsonb language sql security invoker set search_path='' as $$ select private.matching_status() $$;
create function public.matching_like(p_person uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.matching_like(p_person) $$;
create function public.matching_pass(p_person uuid) returns void language sql security invoker set search_path='' as $$ select private.matching_pass(p_person) $$;
create function public.matching_undo() returns jsonb language sql security invoker set search_path='' as $$ select private.matching_undo() $$;
create function public.matching_likes_you() returns jsonb language sql security invoker set search_path='' as $$ select private.matching_likes_you() $$;
create function public.matching_matches() returns jsonb language sql security invoker set search_path='' as $$ select private.matching_matches() $$;
create function public.matching_unmatch(p_match uuid) returns void language sql security invoker set search_path='' as $$ select private.matching_unmatch(p_match) $$;
create function public.matching_block(p_person uuid) returns void language sql security invoker set search_path='' as $$ select private.matching_block(p_person) $$;
create function public.matching_report(p_person uuid,p_reason text,p_comment text) returns void language sql security invoker set search_path='' as $$ select private.matching_report(p_person,p_reason,p_comment) $$;
create function public.chat_messages(p_match uuid,p_before timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$ select private.chat_messages(p_match,p_before) $$;
create function public.chat_send(p_match uuid,p_text text) returns jsonb language sql security invoker set search_path='' as $$ select private.chat_send(p_match,p_text) $$;
create function public.chat_read(p_match uuid) returns void language sql security invoker set search_path='' as $$ select private.chat_read(p_match) $$;
create function public.chat_typing(p_match uuid,p_typing boolean) returns void language sql security invoker set search_path='' as $$ select private.chat_typing(p_match,p_typing) $$;
create function public.chat_summaries() returns jsonb language sql security invoker set search_path='' as $$ select private.chat_summaries() $$;
create function public.sim_social(p_action text) returns jsonb language sql security invoker set search_path='' as $$ select private.sim_social(p_action) $$;
create function public.set_anthem(p_anthem jsonb) returns void language sql security invoker set search_path='' as $$ select private.set_anthem(p_anthem) $$;
do $$ declare r record; begin
 for r in select n.nspname,p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and (p.proname like 'matching_%' or
  p.proname in ('chat_messages','chat_send','chat_read','chat_typing','chat_summaries','sim_social','set_anthem')) loop
  execute 'revoke all on function '||r.signature||' from public,anon,authenticated';
  execute 'grant execute on function '||r.signature||' to authenticated';
 end loop;
end $$;
create policy "social: own private inbox" on realtime.messages for select to authenticated
using(extension='broadcast' and realtime.topic()='social:'||(select auth.uid())::text
 and private.is_age_verified((select auth.uid())));
-- No INSERT policy: clients cannot forge matches, messages or typing events.
drop policy "matches: verified participants" on public.matches;
create policy "matches: active verified participants" on public.matches for select to authenticated using(private.in_match(id));

create function private.can_read_social_photo(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p_path=any(p.photos)
  and (private.social_pair((select auth.uid()),p.id) or (private.social_pair((select auth.uid()),p.id,false)
   and exists(select 1 from public.matches where (select auth.uid()) in(user_a,user_b) and p.id in(user_a,user_b)))))
$$;
revoke all on function private.can_read_social_photo(text) from public,anon,authenticated;
grant execute on function private.can_read_social_photo(text) to authenticated;
create policy "profile photos: visible social profiles" on storage.objects for select to authenticated
using(bucket_id='profile-photos' and private.can_read_social_photo(name));
