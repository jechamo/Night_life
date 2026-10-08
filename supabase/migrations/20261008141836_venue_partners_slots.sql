-- Roadmap 2026-10 R3 (3/5): contract sponsorships do not use the 3 city slots (owner decision 08/10/2026).
-- Same definitions as before plus one condition in each slot count.
create or replace function private.admin_case_action(p_section text, p_id uuid, p_action text, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare c public.venue_claims; s public.sponsorships; city_name text; n int; ev public.events;
begin
 perform private.require_admin(); perform private.require_registered();
 if p_section in('reports','appeals','bans') then perform private.admin_moderate(p_section,p_id,p_action,p_note); return; end if;
 if p_section='claims' and p_action in('approve','reject') then
  select * into c from public.venue_claims where id=p_id and status='pending' for update;
  if not found or c.user_id=auth.uid() then raise exception 'independent review required' using errcode='42501'; end if;
  if p_action='reject' and char_length(btrim(p_note))<5 then raise exception 'explanation required' using errcode='22023'; end if;
  update public.venue_claims set status=case when p_action='approve' then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;
  if p_action='approve' then
   insert into public.venue_managers(venue_id,user_id) values(c.venue_id,c.user_id) on conflict do nothing;
   insert into public.user_roles(user_id,role,granted_by) values(c.user_id,'venue_manager',auth.uid()) on conflict(user_id,role) do nothing;
  end if;
 elsif p_section='sponsorships' and p_action in('activate','end') then
  select * into s from public.sponsorships where id=p_id for update;
  if not found then raise exception 'not found' using errcode='P0002'; end if;
  select city into city_name from public.venues where id=s.venue_id;
  perform pg_advisory_xact_lock(hashtextextended('sponsor-city:'||lower(city_name),0));
  if p_action='activate' then
   if s.status<>'requested' or char_length(btrim(p_note)) not between 5 and 40 or s.ends_on<current_date then raise exception 'manual invoice required' using errcode='22023'; end if;
   select count(*) into n from public.sponsorships sp join public.venues v on v.id=sp.venue_id
   where lower(v.city)=lower(city_name) and sp.status='active' and sp.starts_on<=s.ends_on and sp.ends_on>=s.starts_on
   and not exists(select 1 from private.venue_entitlements e where e.sponsorship_id=sp.id);
   if n>=private.setting_int('sponsorship_slots',3) then raise exception 'no slots' using errcode='54000'; end if;
  end if;
  update public.sponsorships set status=case when p_action='activate' then 'active' else 'ended' end,
   invoice_ref=case when p_action='activate' then btrim(p_note) else invoice_ref end where id=p_id;
 elsif p_section='events' and p_action in('hide','delete') then
  if char_length(btrim(p_note))<5 then raise exception 'explanation required' using errcode='22023'; end if;
  select * into ev from public.events where id=p_id for update;
  if not found then raise exception 'not found' using errcode='P0002'; end if;
  update public.events set hidden_at=now(),status='removed' where id=p_id;
  if ev.created_by is not null then insert into public.moderation_decisions(user_id,action,reason,explanation,decided_by)
   values(ev.created_by,'content_removed','inappropriate',p_note,auth.uid()); end if;
 elsif p_section='entitlements' and p_action='revoke' then
  if char_length(btrim(p_note))<5 then raise exception 'explanation required' using errcode='22023'; end if;
  update public.entitlements set status='revoked' where id=p_id;
 elsif p_section='dataRequests' and p_action='done' then
  if char_length(btrim(p_note))<5 then raise exception 'response required' using errcode='22023'; end if;
  update public.data_requests set status='done',closed_at=now(),explanation=p_note where id=p_id and status='open' and kind in('rectify','object','restrict');
 elsif p_section='legalDocs' and p_action='publish' then
  update public.legal_documents set status='published' where id=p_id and status in('inactive','draft');
 elsif p_section='escalations' and p_action='done' then
  if char_length(btrim(p_note))<5 then raise exception 'authority action reference required' using errcode='22023'; end if;
  update public.safety_escalations set status='reviewed',explanation=left(explanation||E'\n'||p_note,2000) where id=p_id and status='pending';
 else raise exception 'unsupported action' using errcode='22023'; end if;
 perform private.audit('case.'||p_action,p_section||':'||p_id::text||':'||left(p_note,200));
end $$;

create or replace function private.billing_start_venue_order(p_code text, p_venue uuid, p_from date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
    (select count(*) from public.sponsorships s join public.venues v on v.id=s.venue_id where lower(v.city)=lower(city_name) and s.mode=payment_mode and s.status in('requested','active') and d between s.starts_on and s.ends_on
     and not exists(select 1 from private.venue_entitlements e where e.sponsorship_id=s.id))
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
