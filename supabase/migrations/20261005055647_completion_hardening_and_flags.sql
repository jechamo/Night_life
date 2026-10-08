-- A pending manual request without an invoice can be replaced by a paid checkout.
-- Existing active/invoiced sponsorships remain protected from duplicate purchases.
create or replace function private.prepare_venue_checkout(p_venue uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_venue_manager(p_venue);
 if p_code like 'sponsor_%' then
  update public.sponsorships set status='rejected' where venue_id=p_venue and status='requested' and purchase_order_id is null and invoice_ref is null;
 end if;
end $$;
revoke all on function private.prepare_venue_checkout(uuid,text) from public,anon,authenticated;

-- Flags are capabilities; the existing payment gate still restricts TEST checkout to testers.
update public.app_settings set value='on' where key in('paid_dm_enabled','sponsored_cards_enabled','sponsorship_self_service_enabled');

create or replace function private.billing_start_venue_order(p_code text,p_venue uuid,p_from date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare u uuid:=private.require_payment_access(); payment_mode text:=private.flag_value('payments_mode'); plan public.plans; o public.purchase_orders; city_name text; capacity int;
begin
 perform private.require_venue_manager(p_venue);
 if not public.feature_enabled('sponsorship_self_service_enabled') then raise exception 'forbidden' using errcode='42501'; end if;
 perform private.case_limit('checkout',20);
 perform pg_advisory_xact_lock(hashtextextended('billing:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended('venue-billing:'||p_venue::text,0));
 perform private.prepare_venue_checkout(p_venue,p_code);
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
