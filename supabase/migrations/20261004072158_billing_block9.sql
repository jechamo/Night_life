-- Block 9 billing: authenticated intents, signed fulfillment, isolated test purchases.
alter table public.entitlements add column mode text not null default 'live' check(mode in('test','live')),
 add column origin_ref text;
create unique index entitlements_origin_idx on public.entitlements(user_id,key,origin_ref) where origin_ref is not null;
alter table public.subscriptions add column mode text not null default 'test' check(mode in('test','live')),
 add column simulated boolean not null default false;
alter table public.invoices add column mode text not null default 'test' check(mode in('test','live')),
 add column payment_intent_id text, add column hosted_url text;
alter table public.credit_ledger add column mode text not null default 'test' check(mode in('test','live')),
 add column origin_ref text;
create unique index credit_ledger_origin_idx on public.credit_ledger(user_id,kind,origin_ref) where origin_ref is not null;
alter table public.payment_events add column mode text not null default 'test' check(mode in('test','live')),
 add column simulated boolean not null default false;

create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 plan_code text not null references public.plans(code), mode text not null check(mode in('test','live')),
 status text not null default 'pending' check(status in('pending','paid','refunded','expired')),
 amount_cents int not null check(amount_cents>=0), price_id text not null,
 provider_session_id text unique, provider_payment_intent_id text unique,
 provider_subscription_id text, simulated boolean not null default false,
 created_at timestamptz not null default now(), paid_at timestamptz, refunded_at timestamptz
);
alter table public.purchase_orders enable row level security;
create index purchase_orders_user_idx on public.purchase_orders(user_id,created_at desc);
create index purchase_orders_plan_idx on public.purchase_orders(plan_code);
create index purchase_orders_subscription_idx on public.purchase_orders(provider_subscription_id);
create policy "purchase_orders: own or admin" on public.purchase_orders for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
revoke all on public.purchase_orders from anon,authenticated;
grant select on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;
create table private.billing_customers (
 user_id uuid not null references auth.users(id) on delete cascade, mode text not null check(mode in('test','live')),
 customer_id text not null unique, primary key(user_id,mode)
);
alter table private.billing_customers enable row level security;
create table private.billing_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade, notify_me boolean not null default false
);
alter table private.billing_profiles enable row level security;
create table public.billing_notices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 template text not null check(template in('purchase','cancellation','withdrawal','payment_failed','annual_renewal','trial_ending','price_change','inactive_account')),
 source_ref text not null, status text not null default 'pending' check(status in('pending','sending','sent','failed','simulated')),
 attempts int not null default 0 check(attempts between 0 and 10), next_attempt_at timestamptz not null default now(),
 lease_until timestamptz, created_at timestamptz not null default now(), sent_at timestamptz,
 unique(user_id,template,source_ref)
);
alter table public.billing_notices enable row level security;
create policy "billing_notices: own or admin" on public.billing_notices for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create index billing_notices_pending_idx on public.billing_notices(next_attempt_at) where status in('pending','failed','sending');
revoke all on public.billing_notices from anon,authenticated;
grant select on public.billing_notices to authenticated;
grant all on public.billing_notices to service_role;
revoke all on private.billing_customers,private.billing_profiles from public,anon,authenticated;

create or replace function public.has_entitlement(_key text) returns boolean
language sql stable security invoker set search_path='' as $$
 select public.feature_enabled('premium_enabled') and exists(select 1 from public.entitlements
 where user_id=(select auth.uid()) and key=_key and status='active' and starts_at<=now() and (ends_at is null or ends_at>now())
 and (mode='live' or (private.flag_value('payments_mode')<>'live' and private.sees_test_data())))
$$;
create function private.require_payment_access() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered(); mode text:=private.flag_value('payments_mode'); audience text:=private.flag_value('payments_audience');
begin
 if mode not in('test','live') or audience not in('testers','all') then raise exception 'payments_disabled' using errcode='42501'; end if;
 if (mode='test' or audience='testers') and not private.sees_test_data() then raise exception 'not_allowed' using errcode='42501'; end if;
 -- No automatic live activation in this development block. A live key/config is required by the Edge too.
 return u;
end $$;
create function private.billing_start_order(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=private.require_payment_access(); mode text:=private.flag_value('payments_mode'); p public.plans; o public.purchase_orders;
begin
 perform private.case_limit('checkout',20);
 perform pg_advisory_xact_lock(hashtextextended('billing:'||u::text,0));
 update public.purchase_orders set status='expired' where user_id=u and status='pending' and created_at<=now()-interval '30 minutes';
 select * into p from public.plans where code=p_code and active and kind<>'b2b';
 if not found then raise exception 'invalid plan' using errcode='22023'; end if;
 if p.kind='subscription' and exists(select 1 from public.subscriptions where user_id=u and subscriptions.mode=mode and status in('active','cancel_at_period_end','past_due') and current_period_end>now()) then
  raise exception 'already_subscribed' using errcode='23505'; end if;
 -- Reuse a pending intent for retry. Concurrent calls serialize by user.
 if p.kind='subscription' and exists(select 1 from public.purchase_orders po join public.plans pl on pl.code=po.plan_code
 where po.user_id=u and po.mode=mode and po.status='pending' and pl.kind='subscription' and po.plan_code<>p_code) then raise exception 'already_subscribed' using errcode='23505'; end if;
 select * into o from public.purchase_orders where user_id=u and plan_code=p_code and purchase_orders.mode=mode and status='pending' and created_at>now()-interval '30 minutes' order by created_at desc limit 1;
 if not found then
  insert into public.purchase_orders(user_id,plan_code,mode,amount_cents,price_id)
   values(u,p_code,mode,p.price_cents,case when mode='test' then p.stripe_price_id_test else p.stripe_price_id_live end) returning * into o;
 end if;
 return jsonb_build_object('id',o.id,'userId',u,'code',p.code,'kind',p.kind,'mode',mode,'priceId',o.price_id,'amount',o.amount_cents,'sessionId',o.provider_session_id);
end $$;
create function private.billing_customer(p_user uuid,p_mode text,p_customer text default null) returns text
language plpgsql security definer set search_path='' as $$
declare c text;
begin
 if p_customer is not null then
  insert into private.billing_customers(user_id,mode,customer_id) values(p_user,p_mode,p_customer)
   on conflict(user_id,mode) do nothing;
 end if;
 select customer_id into c from private.billing_customers where user_id=p_user and mode=p_mode; return c;
end $$;
create function private.billing_attach_session(p_order uuid,p_session text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.purchase_orders set provider_session_id=p_session where id=p_order and status='pending' and (provider_session_id is null or provider_session_id=p_session);
 if not found then raise exception 'invalid order' using errcode='22023'; end if;
end $$;
create function private.billing_queue(p_user uuid,p_template text,p_ref text) returns void
language sql security definer set search_path='' as $$
 insert into public.billing_notices(user_id,template,source_ref) values(p_user,p_template,p_ref) on conflict do nothing
$$;
create function private.billing_grant(p_user uuid,p_code text,p_mode text,p_ref text,p_until timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare p public.plans; c jsonb;
begin
 select * into p from public.plans where code=p_code;
 insert into public.entitlements(user_id,key,source,mode,origin_ref,ends_at)
 select p_user,key,'stripe',p_mode,p_ref,p_until from unnest(p.entitlements) key
 on conflict(user_id,key,origin_ref) where origin_ref is not null do update set status='active',ends_at=excluded.ends_at;
 for c in select value from jsonb_array_elements(p.credits) loop
  insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref)
  values(p_user,c->>'kind',(c->>'amount')::int,'purchase',p_mode,p_ref||':initial') on conflict do nothing;
 end loop;
end $$;
create function private.next_night_end(p_at timestamptz) returns timestamptz
language sql immutable set search_path='' as $$
 select ((p_at at time zone 'Europe/Madrid')::date + time '06:00' +
 case when (p_at at time zone 'Europe/Madrid')::time>=time '06:00' then interval '1 day' else interval '0 days' end) at time zone 'Europe/Madrid'
$$;

-- Privileged Edge only. The event is normalized from VERIFIED Stripe data.
-- Subscription resources are fetched fresh at the provider to tolerate reordered events.
create function private.billing_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare ev text:=p->>'eventId'; typ text:=p->>'type'; mode text:=p->>'mode'; u uuid; o public.purchase_orders;
 sub public.subscriptions; code text; until_at timestamptz; inserted bool; sim bool:=coalesce((p->>'simulated')::boolean,false); c record;
begin
 if ev is null or mode not in('test','live') or typ not in('checkout','subscription','invoice_paid','payment_failed','refund','trial_ending','price_change') then raise exception 'invalid event' using errcode='22023'; end if;
 -- Per-resource lock serializes fulfillment/revocation even for different event IDs.
 perform pg_advisory_xact_lock(hashtextextended('billing-event:'||coalesce(p->>'subscriptionId',p->>'orderId',ev),0));
 insert into public.payment_events(provider,provider_event_id,type,mode,simulated)
 values('stripe',ev,typ,mode,sim) on conflict(provider,provider_event_id) do nothing;
 if not found then return jsonb_build_object('duplicate',true); end if;
 if typ='checkout' then
  select * into o from public.purchase_orders where id=(p->>'orderId')::uuid and purchase_orders.mode=mode for update;
  if not found or o.user_id is null or o.status not in('pending','paid') or
   (not sim and o.provider_session_id is distinct from p->>'sessionId') or (p->>'amount')::int<>o.amount_cents or p->>'currency'<>'eur' then
   raise exception 'order mismatch' using errcode='22023'; end if;
  u:=o.user_id; code:=o.plan_code;
  if mode='test' and not exists(select 1 from public.user_roles where user_id=u and role in('tester','admin')) then raise exception 'test recipient forbidden' using errcode='42501'; end if;
  if o.status='pending' then
   update public.purchase_orders set status='paid',paid_at=now(),provider_payment_intent_id=p->>'paymentIntentId',provider_subscription_id=p->>'subscriptionId',simulated=sim where id=o.id;
   select case kind when 'one_night' then private.next_night_end(now()) else (p->>'periodEnd')::timestamptz end into until_at from public.plans where plans.code=code;
   if p->>'subscriptionId' is not null then
    insert into public.subscriptions(user_id,plan_code,provider,provider_customer_id,provider_subscription_id,status,current_period_end,mode,simulated)
     values(u,code,'stripe',p->>'customerId',p->>'subscriptionId','active',until_at,mode,sim) on conflict(provider_subscription_id) do nothing;
   end if;
   perform private.billing_grant(u,code,mode,coalesce(p->>'subscriptionId',o.id::text),until_at);
   insert into public.invoices(user_id,plan_code,provider,provider_invoice_id,amount_cents,status,mode,payment_intent_id,hosted_url)
    values(u,code,'stripe',coalesce(p->>'invoiceId',p->>'sessionId',o.id::text),o.amount_cents,'paid',mode,p->>'paymentIntentId',p->>'invoiceUrl') on conflict(provider_invoice_id) do nothing;
   perform private.billing_queue(u,'purchase',o.id::text);
  end if;
 elsif typ in('subscription','invoice_paid','payment_failed','trial_ending','price_change') then
  select * into sub from public.subscriptions where provider_subscription_id=p->>'subscriptionId' and subscriptions.mode=mode for update;
  -- A creation event may arrive before Checkout. Do not fabricate an owner from metadata.
  if not found then delete from public.payment_events where provider='stripe' and provider_event_id=ev; return jsonb_build_object('deferred',true); end if;
  u:=sub.user_id; code:=sub.plan_code;
  if typ in('subscription','invoice_paid') then
   until_at:=(p->>'periodEnd')::timestamptz;
   if p->>'status' in('canceled','unpaid','incomplete_expired','paused') or sub.status='withdrawn' then
    update public.subscriptions set status=case when status='withdrawn' then 'withdrawn' else 'expired' end,current_period_end=least(current_period_end,now()) where id=sub.id;
    update public.entitlements set status='revoked' where user_id=u and origin_ref=p->>'subscriptionId';
   elsif p->>'status'='past_due' then
    update public.subscriptions set status='past_due' where id=sub.id;
    update public.entitlements set status='revoked' where user_id=u and origin_ref=p->>'subscriptionId';
   elsif p->>'status' in('active','trialing') then
    update public.subscriptions set status=case when coalesce((p->>'cancelAtPeriodEnd')::bool,false) then 'cancel_at_period_end' else 'active' end,
     cancel_at_period_end=coalesce((p->>'cancelAtPeriodEnd')::bool,false),current_period_end=until_at where id=sub.id;
    if exists(select 1 from public.purchase_orders where user_id=u and provider_subscription_id=p->>'subscriptionId' and status='paid') then
     perform private.billing_grant(u,code,mode,p->>'subscriptionId',until_at);
    end if;
    if coalesce((p->>'cancelAtPeriodEnd')::bool,false) then perform private.billing_queue(u,'cancellation',p->>'subscriptionId'||':'||until_at::text); end if;
   end if;
   if typ='invoice_paid' then
    insert into public.invoices(user_id,plan_code,provider,provider_invoice_id,amount_cents,status,mode,payment_intent_id,hosted_url)
     values(u,code,'stripe',p->>'invoiceId',(p->>'amount')::int,'paid',mode,p->>'paymentIntentId',p->>'invoiceUrl') on conflict(provider_invoice_id) do nothing;
   end if;
  else perform private.billing_queue(u,typ,p->>'subscriptionId'||':'||coalesce(p->>'invoiceId',ev)); end if;
 elsif typ='refund' then
  select * into o from public.purchase_orders where provider_payment_intent_id=p->>'paymentIntentId' and purchase_orders.mode=mode for update;
  if not found or o.user_id is null then return jsonb_build_object('ignored',true); end if;
  u:=o.user_id;
  -- A partial refund does not silently revoke a full subscription. Only full refunds fulfill withdrawal.
  if (p->>'refundedAmount')::int>=o.amount_cents and o.status='paid' then
   update public.purchase_orders set status='refunded',refunded_at=now() where id=o.id;
   update public.invoices set status='refunded' where payment_intent_id=o.provider_payment_intent_id;
   update public.entitlements set status='revoked' where user_id=u and origin_ref=coalesce(o.provider_subscription_id,o.id::text);
   update public.subscriptions set status='withdrawn',withdrawal_requested_at=now(),current_period_end=now() where provider_subscription_id=o.provider_subscription_id;
   for c in select kind,sum(delta)::int amount from public.credit_ledger where user_id=u and origin_ref=coalesce(o.provider_subscription_id,o.id::text)||':initial' group by kind loop
    if c.amount>0 then insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(u,c.kind,-c.amount,'refund',mode,o.id::text||':refund') on conflict do nothing; end if;
   end loop;
   perform private.billing_queue(u,'withdrawal',o.id::text);
  end if;
 end if;
 update public.payment_events set user_id=u where provider='stripe' and provider_event_id=ev;
 if u is not null then perform realtime.send('{}','refresh','social:'||u::text,true); end if;
 return jsonb_build_object('processed',true);
end $$;

create function private.premium_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); sub jsonb; inv jsonb; credits jsonb; night timestamptz;
begin
 select jsonb_build_object('id',id,'productCode',plan_code,'provider',provider,'status',status,'startedAt',started_at,'currentPeriodEnd',current_period_end,'simulated',simulated)
 into sub from public.subscriptions where user_id=u and (mode='live' or private.sees_test_data()) order by started_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'productCode',plan_code,'amountCents',amount_cents,'issuedAt',issued_at,'status',status,'url',hosted_url) order by issued_at desc),'[]')
 into inv from public.invoices where user_id=u and (mode='live' or private.sees_test_data());
 select jsonb_object_agg(kind,amount) into credits from(select kind,greatest(0,coalesce((select sum(delta) from public.credit_ledger where user_id=u and credit_ledger.kind=k.kind and (mode='live' or private.sees_test_data())),0)) amount from unnest(array['spark','spotlight','paid_dm']) kind) k;
 select max(ends_at) into night from public.entitlements where user_id=u and status='active' and ends_at>now() and origin_ref in(select id::text from public.purchase_orders where user_id=u and plan_code='one_night' and status='paid');
 return jsonb_build_object('subscription',sub,'invoices',inv,'credits',credits,'oneNightUntil',night,'notifyMe',coalesce((select notify_me from private.billing_profiles where user_id=u),false));
end $$;
create function private.premium_notify(p_on bool) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account();
begin
 if p_on and not private.latest_consent(u,'marketing') then raise exception 'consent required' using errcode='42501'; end if;
 insert into private.billing_profiles(user_id,notify_me) values(u,p_on) on conflict(user_id) do update set notify_me=p_on;
 return private.premium_state();
end $$;
create function private.premium_redeem(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered(); p public.promo_codes; plan public.plans;
begin
 perform private.case_limit('promo',10);
 if not public.feature_enabled('premium_enabled') then return jsonb_build_object('error','invalid'); end if;
 select * into p from public.promo_codes where code=upper(btrim(p_code)) for update;
 if not found then return jsonb_build_object('error','invalid'); end if;
 if p.expires_at<=now() then return jsonb_build_object('error','expired'); end if;
 if p.uses>=p.max_uses or exists(select 1 from public.promo_redemptions where code=p.code and user_id=u) then return jsonb_build_object('error','used'); end if;
 select * into plan from public.plans where code=p.plan_code and active;
 if not found or plan.kind not in('subscription','one_night') then return jsonb_build_object('error','invalid'); end if;
 insert into public.promo_redemptions(code,user_id) values(p.code,u);
 update public.promo_codes set uses=uses+1 where code=p.code;
 insert into public.entitlements(user_id,key,source,ends_at) select u,key,'promo',now()+make_interval(days=>p.days) from unnest(plan.entitlements) key;
 return jsonb_build_object('productCode',p.plan_code,'days',p.days);
end $$;
create function private.simulate_billing(p_code text,p_action text default 'purchase') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); o jsonb; mode text; sub public.subscriptions; ref text;
begin
 if not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') or private.flag_value('payments_mode')<>'test' then raise exception 'simulation forbidden' using errcode='42501'; end if;
 if p_action='purchase' then
  o:=private.billing_start_order(p_code);
  ref:='sim_'||(o->>'id');
  perform private.billing_apply(jsonb_build_object('eventId',ref,'type','checkout','mode','test','simulated',true,'orderId',o->>'id','sessionId',ref,'amount',o->>'amount','currency','eur','paymentIntentId',ref,
   'subscriptionId',case when o->>'kind'='subscription' then ref end,'periodEnd',now()+interval '1 month'));
 elsif p_action in('cancel','resume','withdraw') then
  select * into sub from public.subscriptions where user_id=u and simulated and status in('active','cancel_at_period_end','past_due') order by started_at desc limit 1 for update;
  if not found then raise exception 'simulated subscription required' using errcode='P0002'; end if;
  if p_action='withdraw' then
   if sub.started_at<now()-interval '14 days' then return jsonb_build_object('error','window_closed'); end if;
   select provider_payment_intent_id into ref from public.purchase_orders where provider_subscription_id=sub.provider_subscription_id and status='paid' order by created_at limit 1;
   perform private.billing_apply(jsonb_build_object('eventId',ref||':refund','type','refund','mode','test','simulated',true,'paymentIntentId',ref,'refundedAmount',(select amount_cents from public.purchase_orders where provider_payment_intent_id=ref)));
  else
   perform private.billing_apply(jsonb_build_object('eventId','sim_'||extensions.gen_random_uuid()::text,'type','subscription','mode','test','simulated',true,'subscriptionId',sub.provider_subscription_id,'status','active','periodEnd',sub.current_period_end,'cancelAtPeriodEnd',p_action='cancel'));
  end if;
 else raise exception 'invalid action' using errcode='22023'; end if;
 perform private.audit('test_tool.billing',p_action); return private.premium_state();
end $$;

-- Public user RPCs vs service-only provider RPCs.
do $$
declare f record; roles text;
begin
 for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) identity_args,p.proargnames
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in(
 'billing_start_order','billing_customer','billing_attach_session','billing_apply','premium_state','premium_notify','premium_redeem','simulate_billing') loop
  execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $fn$ select private.%I(%s) $fn$',f.proname,f.args,pg_get_function_result(f.oid),f.proname,coalesce(array_to_string(f.proargnames,','),''));
  execute format('revoke all on function public.%I(%s),private.%I(%s) from public,anon,authenticated',f.proname,f.identity_args,f.proname,f.identity_args);
  roles:=case when f.proname in('billing_customer','billing_attach_session','billing_apply') then 'service_role' else 'authenticated' end;
  execute format('grant execute on function public.%I(%s),private.%I(%s) to %s',f.proname,f.identity_args,f.proname,f.identity_args,roles);
 end loop;
end $$;
revoke all on function private.require_payment_access(),private.billing_queue(uuid,text,text),private.billing_grant(uuid,text,text,text,timestamptz),private.next_night_end(timestamptz) from public,anon,authenticated;
