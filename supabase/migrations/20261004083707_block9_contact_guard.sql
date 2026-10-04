create or replace function private.premium_paid_dm(p_person uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); m uuid; mode text:='live'; balance int;
begin
 if not public.feature_enabled('paid_dm_enabled') or not public.feature_enabled('premium_enabled') then return '{"error":"disabled"}'; end if;
 if p_text is null or char_length(btrim(p_text)) not between 1 and 300 then raise exception 'invalid message' using errcode='22023'; end if;
 perform private.social_limit('paid-dm',10);
 if not private.social_pair(u,p_person,true) or (select traffic_light from public.profiles where id=u)<>'green' or (select traffic_light from public.profiles where id=p_person)<>'green' then return '{"error":"red_light"}'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(u,p_person)::text||greatest(u,p_person)::text,8));
 perform pg_advisory_xact_lock(hashtextextended('credits:'||u::text,0));
 if exists(select 1 from public.matches where user_a=least(u,p_person) and user_b=greatest(u,p_person)) then
 return '{"error":"disabled"}'; end if;
 select coalesce(sum(delta),0) into balance from public.credit_ledger where user_id=u and kind='paid_dm' and credit_ledger.mode='live';
 if balance<=0 and private.sees_test_data() and private.flag_value('payments_mode')<>'live' then
  mode:='test';select coalesce(sum(delta),0) into balance from public.credit_ledger where user_id=u and kind='paid_dm' and credit_ledger.mode='test';
 end if;
 if balance<=0 then return '{"error":"no_credits"}'; end if;
 insert into public.matches(user_a,user_b,contact_kind) values(least(u,p_person),greatest(u,p_person),'paid_dm') returning id into m;
 insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(u,'paid_dm',-1,'paid_dm',mode,m::text||':spent');
 insert into public.messages(match_id,sender_id,text) values(m,u,btrim(p_text));
 perform realtime.send(jsonb_build_object('matchId',m),'message','social:'||u,true);
 perform realtime.send(jsonb_build_object('matchId',m),'message','social:'||p_person,true);
 return '{"sent":true}';
end $$;