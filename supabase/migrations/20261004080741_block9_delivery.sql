-- Block 9 delivery: labelled sponsorships, paid contact and provider cleanup.
alter table public.matches add column contact_kind text not null default 'mutual' check(contact_kind in('mutual','paid_dm'));
create function private.premium_paid_dm(p_person uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); m uuid; mode text:='live'; balance int;
begin
 if not public.feature_enabled('paid_dm_enabled') or not public.feature_enabled('premium_enabled') then return '{"error":"disabled"}'; end if;
 if char_length(btrim(p_text)) not between 1 and 300 then raise exception 'invalid message' using errcode='22023'; end if;
 perform private.social_limit('paid-dm',10);
 if not private.social_pair(u,p_person,true) then return '{"error":"red_light"}'; end if;
 perform pg_advisory_xact_lock(hashtextextended('credits:'||u::text,0));
 if exists(select 1 from public.matches where user_a=least(u,p_person) and user_b=greatest(u,p_person)) then
 return '{"error":"disabled"}'; end if;
 select coalesce(sum(delta),0) into balance from public.credit_ledger where user_id=u and kind='paid_dm' and mode='live';
 if balance<=0 and private.sees_test_data() and private.flag_value('payments_mode')<>'live' then
  mode:='test';select coalesce(sum(delta),0) into balance from public.credit_ledger where user_id=u and kind='paid_dm' and credit_ledger.mode='test';
 end if;
 if balance<=0 then return '{"error":"no_credits"}'; end if;
 insert into public.matches(user_a,user_b,contact_kind) values(least(u,p_person),greatest(u,p_person),'paid_dm') returning id into m;
 insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(u,'paid_dm',-1,'paid_dm',mode,m::text||':spent');
 insert into public.messages(match_id,sender_id,text) values(m,u,btrim(p_text));
 perform private.social_refresh(u,p_person);
 return '{"sent":true}';
end $$;
create function private.visible_sponsors() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_registered();
 return (select coalesce(jsonb_agg(distinct s.venue_id),'[]') from public.sponsorships s join public.venues v on v.id=s.venue_id
 where s.status='active' and current_date between starts_on and ends_on and (not v.is_test or private.sees_test_data()));
end $$;
create function private.provider_erasure_result(p_id uuid,p_status int) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status between 200 and 299 or p_status=404 then delete from private.provider_erasure_queue where id=p_id;
 else update private.provider_erasure_queue set attempts=attempts+1,http_status=p_status,next_attempt_at=now()+interval '1 day' where id=p_id; end if;
end $$;
-- Service normalization records price notices without trusting a client or external URL.
create function private.billing_price_notice(p_subscription text,p_mode text,p_ref text) returns void
language sql security definer set search_path='' as $$
 insert into public.billing_notices(user_id,template,source_ref)
 select user_id,'price_change',p_ref from public.subscriptions where provider_subscription_id=p_subscription and mode=p_mode and user_id is not null
 on conflict do nothing
$$;
do $$
declare f record; roles text;
begin
 for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) ia,p.proargnames
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in(
 'premium_paid_dm','visible_sponsors','provider_erasure_result','billing_price_notice') loop
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $fn$ select private.%I(%s) $fn$',f.proname,f.args,pg_get_function_result(f.oid),f.proname,array_to_string(f.proargnames,','));
 execute format('revoke all on function public.%I(%s),private.%I(%s) from public,anon,authenticated',f.proname,f.ia,f.proname,f.ia);
 roles:=case when f.proname in('provider_erasure_result','billing_price_notice') then 'service_role' else 'authenticated' end;
 execute format('grant execute on function public.%I(%s),private.%I(%s) to %s',f.proname,f.ia,f.proname,f.ia,roles);
 end loop;
end $$;
