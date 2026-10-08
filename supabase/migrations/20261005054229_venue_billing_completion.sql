-- Prices are TEST-only. Venue purchases never grant personal entitlements.
alter table public.plans add column billing_interval_count integer not null default 1 check(billing_interval_count between 1 and 12);
alter table public.purchase_orders add column venue_id uuid references public.venues(id) on delete set null,
 add column sponsorship_from date;
alter table public.subscriptions add column venue_id uuid references public.venues(id) on delete set null;
create index purchase_orders_venue_idx on public.purchase_orders(venue_id);
create index subscriptions_venue_idx on public.subscriptions(venue_id);
alter table public.sponsorships add column mode text not null default 'live' check(mode in('test','live')),
 add column purchase_order_id uuid unique references public.purchase_orders(id) on delete set null;

insert into public.plans(code,kind,price_cents,billing_interval,billing_interval_count,entitlements,credits,stripe_price_id_test) values
 ('sparks_1','credits',149,null,1,'{}','[{"kind":"spark","amount":1}]','price_1UN4ZqJrzx7OE9xvGKeOrRdV'),
 ('sparks_15','credits',1199,null,1,'{}','[{"kind":"spark","amount":15}]','price_1UN4a9Jrzx7OE9xvwexooO4M'),
 ('pass_quarterly','subscription',2699,'month',3,array['unlimited_likes','undo','travel_mode','premium_themes','no_sponsored_cards'],'[]','price_1UN4aEJrzx7OE9xvyfNohEdq'),
 ('pass_annual','subscription',8999,'year',1,array['unlimited_likes','undo','travel_mode','premium_themes','no_sponsored_cards'],'[]','price_1UN4aIJrzx7OE9xvfxrZhAxA'),
 ('sponsor_featured','b2b',2900,null,1,'{}','[]','price_1UN4aNJrzx7OE9xvLlMEoVXp'),
 ('sponsor_featured_plus','b2b',4900,null,1,'{}','[]','price_1UN4aSJrzx7OE9xv4ITkDZJo'),
 ('sponsor_top','b2b',7900,null,1,'{}','[]','price_1UN4aWJrzx7OE9xvI5IB5Hhb'),
 ('venue_pro_monthly','b2b',1999,'month',1,'{}','[]','price_1UN4aaJrzx7OE9xvlGBUL0Ad');

create function private.billing_start_venue_order(p_code text,p_venue uuid,p_from date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=private.require_payment_access(); payment_mode text:=private.flag_value('payments_mode'); plan public.plans; o public.purchase_orders; city_name text; capacity int;
begin
 perform private.require_venue_manager(p_venue);
 if not public.feature_enabled('sponsorship_self_service_enabled') then raise exception 'forbidden' using errcode='42501'; end if;
 perform private.case_limit('checkout',20);
 perform pg_advisory_xact_lock(hashtextextended('billing:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended('venue-billing:'||p_venue::text,0));
 select * into plan from public.plans where code=p_code and kind='b2b' and active;
 if not found then raise exception 'invalid plan' using errcode='22023'; end if;
 update public.purchase_orders set status='expired' where venue_id=p_venue and status='pending' and created_at<=now()-interval '24 hours';
 select * into o from public.purchase_orders where user_id=u and venue_id=p_venue and plan_code=p_code and mode=payment_mode and status='pending' and sponsorship_from is not distinct from p_from order by created_at desc limit 1;
 if not found then
  if p_code='venue_pro_monthly' then
   if p_from is not null then raise exception 'invalid dates' using errcode='22023'; end if;
   if exists(select 1 from public.subscriptions where venue_id=p_venue and mode=payment_mode and plan_code=p_code and status in('active','cancel_at_period_end','past_due') and current_period_end>now())
   or exists(select 1 from public.purchase_orders where venue_id=p_venue and mode=payment_mode and plan_code=p_code and status='pending') then raise exception 'already_subscribed' using errcode='23505'; end if;
  else
   if p_from is null or p_from<current_date or p_from>current_date+90 then raise exception 'invalid dates' using errcode='22023'; end if;
   select city into city_name from public.venues where id=p_venue;
   perform pg_advisory_xact_lock(hashtextextended('sponsor-city:'||lower(city_name),0));
   if exists(select 1 from public.sponsorships where venue_id=p_venue and mode=payment_mode and status in('requested','active') and starts_on<=p_from+29 and ends_on>=p_from)
   or exists(select 1 from public.purchase_orders where venue_id=p_venue and mode=payment_mode and status='pending' and plan_code like 'sponsor_%' and sponsorship_from<=p_from+29 and sponsorship_from+29>=p_from and created_at>now()-interval '24 hours') then raise exception 'already_subscribed' using errcode='23505'; end if;
   select max(n)::int into capacity from(select d,
    (select count(*) from public.sponsorships s join public.venues v on v.id=s.venue_id where lower(v.city)=lower(city_name) and s.mode=payment_mode and s.status in('requested','active') and d between s.starts_on and s.ends_on)
    +(select count(*) from public.purchase_orders po join public.venues v on v.id=po.venue_id where lower(v.city)=lower(city_name) and po.mode=payment_mode and po.status='pending' and po.plan_code like 'sponsor_%' and po.created_at>now()-interval '24 hours' and d between po.sponsorship_from and po.sponsorship_from+29) n
    from generate_series(p_from::timestamp,(p_from+29)::timestamp,interval '1 day') d) counts;
   if capacity>=private.setting_int('sponsorship_slots',3) then raise exception 'no_slots' using errcode='54000'; end if;
  end if;
  insert into public.purchase_orders(user_id,plan_code,mode,amount_cents,price_id,venue_id,sponsorship_from)
  values(u,p_code,payment_mode,plan.price_cents,case when payment_mode='test' then plan.stripe_price_id_test else plan.stripe_price_id_live end,p_venue,p_from) returning * into o;
 end if;
 return jsonb_build_object('id',o.id,'createdAt',o.created_at,'userId',u,'code',plan.code,'kind',case when plan.billing_interval is not null then 'subscription' else 'payment' end,
 'mode',payment_mode,'priceId',o.price_id,'amount',o.amount_cents,'sessionId',o.provider_session_id,'interval',plan.billing_interval,'intervalCount',plan.billing_interval_count);
end $$;
create function public.billing_start_venue_order(p_code text,p_venue uuid,p_from date default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.billing_start_venue_order(p_code,p_venue,p_from) $$;
revoke all on function public.billing_start_venue_order(text,uuid,date),private.billing_start_venue_order(text,uuid,date) from public,anon,authenticated;
grant execute on function public.billing_start_venue_order(text,uuid,date),private.billing_start_venue_order(text,uuid,date) to authenticated;

-- Keep the signed event normalization and all existing idempotency checks.
alter function private.billing_apply(jsonb) rename to billing_apply_core;
create function private.billing_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; o public.purchase_orders; sub_id text:=p->>'subscriptionId';
begin
 result:=private.billing_apply_core(p);
 if coalesce((result->>'deferred')::boolean,false) then return result; end if;
 if p->>'type'='checkout' then
  select * into o from public.purchase_orders where id=(p->>'orderId')::uuid and venue_id is not null and status='paid';
  if found then
   if o.plan_code='venue_pro_monthly' then
    update public.subscriptions set venue_id=o.venue_id where provider_subscription_id=o.provider_subscription_id;
   elsif o.plan_code like 'sponsor_%' then
    insert into public.sponsorships(venue_id,tier,status,starts_on,ends_on,requested_by,invoice_ref,mode,purchase_order_id)
    values(o.venue_id,substr(o.plan_code,9),'active',o.sponsorship_from,o.sponsorship_from+29,o.user_id,'Stripe Checkout',o.mode,o.id)
    on conflict(purchase_order_id) do nothing;
   end if;
  end if;
 elsif p->>'type'='refund' then
  update public.sponsorships s set status='ended' from public.purchase_orders po where s.purchase_order_id=po.id and po.provider_payment_intent_id=p->>'paymentIntentId' and po.status='refunded' and po.mode=p->>'mode';
 end if;
 return result;
end $$;
revoke all on function private.billing_apply_core(jsonb),private.billing_apply(jsonb) from public,anon,authenticated;
grant execute on function private.billing_apply(jsonb) to service_role;

create function private.venue_has_pro(p_venue uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subscriptions where venue_id=p_venue and plan_code='venue_pro_monthly' and status in('active','cancel_at_period_end') and current_period_end>now()
 and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')))
$$;
create function private.venue_billing_state(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sub jsonb;
begin
 perform private.require_venue_manager(p_venue);
 select jsonb_build_object('id',id,'status',status,'currentPeriodEnd',current_period_end) into sub from public.subscriptions where venue_id=p_venue and plan_code='venue_pro_monthly' and (mode='live' or private.sees_test_data()) order by started_at desc limit 1;
 return jsonb_build_object('pro',private.venue_has_pro(p_venue),'subscription',sub);
end $$;
create function public.venue_billing_state(p_venue uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.venue_billing_state(p_venue) $$;
revoke all on function private.venue_has_pro(uuid),private.venue_billing_state(uuid),public.venue_billing_state(uuid) from public,anon,authenticated;
grant execute on function private.venue_billing_state(uuid),public.venue_billing_state(uuid) to authenticated;

create function private.matching_sponsored_cards(p_place uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); city_name text; origin extensions.geography;
begin
 if not public.feature_enabled('sponsored_cards_enabled') or public.has_entitlement('no_sponsored_cards') then return '[]'; end if;
 perform private.social_limit('sponsored-cards',120);
 select city into city_name from public.profiles where id=u;
 if p_place is not null then perform private.require_place(p_place); select location into origin from public.venues where id=p_place; end if;
 if origin is null then select v.location into origin from public.attendance a join public.venues v on v.id=a.venue_id where a.user_id=u and a.expires_at>now() order by a.created_at desc limit 1; end if;
 -- No precise origin means no ad, rather than advertising an arbitrary distant venue.
 if origin is null then return '[]'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from (
 select distinct v.id,v.name from public.sponsorships s join public.venues v on v.id=s.venue_id
 where s.status='active' and current_date between s.starts_on and s.ends_on and lower(v.city)=lower(city_name)
 and v.business_status='OPERATIONAL' and private.venue_open(v.opening_hours) and extensions.st_dwithin(v.location,origin,5000)
 and (not v.is_test or private.sees_test_data()) and (s.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'))
 order by v.name,v.id limit 5) cards);
end $$;
create function public.matching_sponsored_cards(p_place uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.matching_sponsored_cards(p_place) $$;
revoke all on function private.matching_sponsored_cards(uuid),public.matching_sponsored_cards(uuid) from public,anon,authenticated;
grant execute on function private.matching_sponsored_cards(uuid),public.matching_sponsored_cards(uuid) to authenticated;

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
 if p.kind='subscription' and exists(select 1 from public.subscriptions where user_id=u and venue_id is null and subscriptions.mode=mode and status in('active','cancel_at_period_end','past_due') and current_period_end>now()) then
  raise exception 'already_subscribed' using errcode='23505'; end if;
 -- Reuse a pending intent for retry. Concurrent calls serialize by user.
 if p.kind='subscription' and exists(select 1 from public.purchase_orders po join public.plans pl on pl.code=po.plan_code
 where po.user_id=u and po.mode=mode and po.status='pending' and pl.kind='subscription' and po.plan_code<>p_code) then raise exception 'already_subscribed' using errcode='23505'; end if;
 select * into o from public.purchase_orders where user_id=u and plan_code=p_code and purchase_orders.mode=mode and status='pending' and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if not found then
  insert into public.purchase_orders(user_id,plan_code,mode,amount_cents,price_id)
   values(u,p_code,mode,p.price_cents,case when mode='test' then p.stripe_price_id_test else p.stripe_price_id_live end) returning * into o;
 end if;
 return jsonb_build_object('createdAt',o.created_at,'id',o.id,'userId',u,'code',p.code,'kind',p.kind,'mode',mode,'priceId',o.price_id,'amount',o.amount_cents,'sessionId',o.provider_session_id,'interval',p.billing_interval,'intervalCount',p.billing_interval_count);
end $$;
create or replace function private.premium_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); sub jsonb; inv jsonb; credits jsonb; night timestamptz;
begin
 select jsonb_build_object('id',id,'productCode',plan_code,'provider',provider,'status',status,'startedAt',started_at,'currentPeriodEnd',current_period_end,'simulated',simulated)
 into sub from public.subscriptions where venue_id is null and user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) order by started_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'productCode',plan_code,'amountCents',amount_cents,'issuedAt',issued_at,'status',status,'url',hosted_url,'orderId',(select po.id from public.purchase_orders po where po.provider_payment_intent_id=invoices.payment_intent_id and po.user_id=u limit 1)) order by issued_at desc),'[]')
 into inv from public.invoices where user_id=u and (mode='live' or private.sees_test_data());
 select jsonb_object_agg(kind,amount) into credits from(select kind,greatest(0,coalesce((select sum(delta) from public.credit_ledger where user_id=u and credit_ledger.kind=ck.kind and (mode='live' or private.sees_test_data())),0)) amount from unnest(array['spark','spotlight','paid_dm']) ck(kind)) balances;
 select max(ends_at) into night from public.entitlements where user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and status='active' and ends_at>now() and origin_ref in(select id::text from public.purchase_orders where user_id=u and plan_code='one_night' and status='paid');
 return jsonb_build_object('subscription',sub,'invoices',inv,'credits',credits,'oneNightUntil',night,'notifyMe',coalesce((select notify_me from private.billing_profiles where user_id=u),false));
end $$;
create or replace function private.venue_stats(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; by_hour jsonb; n int; pro boolean; zone_average numeric;
begin
 perform private.require_venue_manager(p_venue);
 pro:=private.venue_has_pro(p_venue);
 if pro then
 select case when count(distinct a.user_id)>=5 and count(distinct a.venue_id)>=3 then round(count(*)::numeric/count(distinct a.venue_id),1) end into zone_average
 from public.attendance a join public.venues v on v.id=a.venue_id join public.venues own on own.id=p_venue
 where a.kind='check_in' and a.created_at>=now()-interval '7 days' and a.venue_id<>p_venue
 and extensions.st_dwithin(v.location,own.location,5000) and (not v.is_test or private.sees_test_data());
 end if;
 -- No individual identities or fine-grained timestamps; small hourly cohorts hidden.
 select coalesce(jsonb_agg(jsonb_build_object('hour',hour_of_day,'people',case when people>=5 then people else 0 end) order by hour_of_day),'[]') into by_hour
 from(select extract(hour from created_at at time zone 'Europe/Madrid')::int as hour_of_day,count(distinct user_id) people
 from public.attendance where venue_id=p_venue and kind='check_in' and created_at>=now()-interval '7 days' group by 1) h;
 select count(distinct user_id) into n from public.attendance where venue_id=p_venue and kind='check_in' and created_at>=now()-interval '7 days';
 select private.threshold_stats(people,average_age,green_percent,ratio,going_tonight) into s from public.place_stats where venue_id=p_venue;
 return jsonb_build_object('pro',pro,'zoneAverageCheckIns',zone_average,'byHour',case when pro then by_hour else '[]'::jsonb end,'averageAge',case when pro then s->'averageAge' else 'null'::jsonb end,'greenPercent',case when pro then s->'greenPercent' else 'null'::jsonb end,
 'checkInsWeek',case when n>=5 then n else 0 end,'goingTonight',coalesce(s->'goingTonight','0'));
end $$;
create or replace function private.visible_sponsors() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_registered();
 return (select coalesce(jsonb_agg(distinct s.venue_id),'[]') from public.sponsorships s join public.venues v on v.id=s.venue_id
 where (s.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and s.status='active' and current_date between starts_on and ends_on and (not v.is_test or private.sees_test_data()));
end $$;
