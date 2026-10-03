-- Fixture avatars are explicitly test assets; real photos remain privately signed.
create or replace function private.social_profile(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'age',private.age_years(p.birthdate),'gender',p.gender,
  'bio',p.bio,'photos',p.photos,'trafficLight',p.traffic_light,'anthem',p.anthem,
  'testAvatar',case when p.is_test then get_byte(decode(md5(p.id::text),'hex'),0)%24 end,
  'photoVerified',coalesce(v.photo_verified and (v.photo_mode='live' or
   (v.photo_mode='sandbox' and private.flag_value('verification_mode')='sandbox'
    and exists(select 1 from public.user_roles where user_id=p.id and role in ('tester','admin')))),false))
 from public.profiles p left join public.verification_status v on v.user_id=p.id where p.id=p_id
$$;
-- Do not grant SELECT on someone else's private channel even when sharing a match.
-- Notifications contain identifiers; payload data is fetched with fresh authorization.
revoke all on function private.social_profile(uuid) from public,anon,authenticated;

-- Compound cursor prevents dropping messages that share a transaction timestamp.
drop function public.chat_messages(uuid,timestamptz);
drop function private.chat_messages(uuid,timestamptz);
create function private.chat_messages(p_match uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_uid uuid:=private.require_age_verified();
begin
 perform private.require_social_match(p_match); perform private.social_limit('messages-read',300);
 select coalesce(jsonb_agg(private.chat_message(id,v_uid) order by created_at,id),'[]') into v_result from (
  select id,created_at from public.messages where match_id=p_match
   and (p_before is null or (created_at,id)<(p_before,coalesce(p_before_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  order by created_at desc,id desc limit 100) messages;
 return v_result;
end $$;
create function public.chat_messages(p_match uuid,p_before timestamptz default null,p_before_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.chat_messages(p_match,p_before,p_before_id) $$;
revoke all on function private.chat_messages(uuid,timestamptz,uuid),public.chat_messages(uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function private.chat_messages(uuid,timestamptz,uuid),public.chat_messages(uuid,timestamptz,uuid) to authenticated;

-- The older public profile RPC must obey the same privacy/verification rules.
create or replace function private.search_public_profiles(p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender,bio text,traffic_light public.traffic_light,is_test boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.name,private.age_years(p.birthdate),p.gender,p.bio,p.traffic_light,p.is_test from public.profiles p
 where private.social_pair((select auth.uid()),p.id)
 order by p.last_active_at desc limit least(greatest(p_limit,1),50)
$$;
