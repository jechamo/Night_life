-- Block 9 final delivery fixes, stable checkout intents and conversations.
create or replace function private.premium_paid_dm(p_person uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); m uuid; mode text:='live'; balance int;
begin
 if not public.feature_enabled('paid_dm_enabled') or not public.feature_enabled('premium_enabled') then return '{"error":"disabled"}'; end if;
 if p_text is null or char_length(btrim(p_text)) not between 1 and 300 then raise exception 'invalid message' using errcode='22023'; end if;
 perform private.social_limit('paid-dm',10);
 if not private.social_pair(u,p_person,true) then return '{"error":"red_light"}'; end if;
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
create or replace function private.billing_start_order(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=private.require_payment_access(); mode text:=private.flag_value('payments_mode'); p public.plans; o public.purchase_orders;
begin
 perform private.case_limit('checkout',20);
 perform pg_advisory_xact_lock(hashtextextended('billing:'||u::text,0));
 update public.purchase_orders set status='expired' where user_id=u and status='pending' and created_at<=now()-interval '24 hours';
 select * into p from public.plans where code=p_code and active and kind<>'b2b';
 if not found then raise exception 'invalid plan' using errcode='22023'; end if;
 if p.kind='subscription' and exists(select 1 from public.subscriptions where user_id=u and subscriptions.mode=mode and status in('active','cancel_at_period_end','past_due') and current_period_end>now()) then
  raise exception 'already_subscribed' using errcode='23505'; end if;
 -- Reuse a pending intent for retry. Concurrent calls serialize by user.
 if p.kind='subscription' and exists(select 1 from public.purchase_orders po join public.plans pl on pl.code=po.plan_code
 where po.user_id=u and po.mode=mode and po.status='pending' and pl.kind='subscription' and po.plan_code<>p_code) then raise exception 'already_subscribed' using errcode='23505'; end if;
 select * into o from public.purchase_orders where user_id=u and plan_code=p_code and purchase_orders.mode=mode and status='pending' and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if not found then
  insert into public.purchase_orders(user_id,plan_code,mode,amount_cents,price_id)
   values(u,p_code,mode,p.price_cents,case when mode='test' then p.stripe_price_id_test else p.stripe_price_id_live end) returning * into o;
 end if;
 return jsonb_build_object('createdAt',o.created_at,'id',o.id,'userId',u,'code',p.code,'kind',p.kind,'mode',mode,'priceId',o.price_id,'amount',o.amount_cents,'sessionId',o.provider_session_id);
end $$;
create or replace function private.social_like(p_from uuid,p_to uuid) returns jsonb
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
  where user_id=p_from and key='unlimited_likes' and status='active' and starts_at<=now() and (ends_at is null or ends_at>now()) and (mode='live' or (mode='test' and private.sees_test_data() and private.flag_value('payments_mode')<>'live')));
 if not exists(select 1 from public.likes where from_user=p_from and to_user=p_to) then
  if not v_unlimited and v_used>=coalesce(v_limit,5) then return jsonb_build_object('error','limit_reached'); end if;
  insert into public.likes(from_user,to_user) values(p_from,p_to); v_used:=v_used+1;
  insert into private.social_daily_likes(user_id,day,used) values(p_from,(now() at time zone 'Europe/Madrid')::date,v_used)
  on conflict(user_id,day) do update set used=excluded.used;
 end if;
 if exists(select 1 from public.likes where from_user=p_to and to_user=p_from) then
  insert into public.matches(user_a,user_b) values(least(p_from,p_to),greatest(p_from,p_to))
  on conflict(user_a,user_b) do update set contact_kind='mutual' where matches.contact_kind='paid_dm' returning id into v_match;
  v_created:=v_match is not null;
  if v_match is null then select id into v_match from public.matches where user_a=least(p_from,p_to) and user_b=greatest(p_from,p_to); end if;
  if v_created then
   perform realtime.send(jsonb_build_object('matchId',v_match),'match','social:'||p_from,true);
   perform realtime.send(jsonb_build_object('matchId',v_match),'match','social:'||p_to,true);
  end if;
 end if;
 return jsonb_build_object('usedToday',v_used,'match',private.social_match(v_match,p_from));
end $$;
create or replace function private.social_match(p_match uuid,p_user uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'person',private.social_profile(case when user_a=p_user then user_b else user_a end),'context',private.social_context(p_user,case when user_a=p_user then user_b else user_a end),'createdAt',created_at,'contactKind',contact_kind) from public.matches where id=p_match and p_user in(user_a,user_b)
$$;
