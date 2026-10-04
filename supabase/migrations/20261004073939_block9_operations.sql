-- Block 9: concrete admin queues, rights and scheduled maintenance.
alter table public.bans add column decision_id uuid references public.moderation_decisions(id) on delete set null;
create index bans_decision_idx on public.bans(decision_id);
alter table public.data_requests add column explanation text check(char_length(explanation)<=2000);

create or replace function private.forbid_mutation() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)-'user_id'-'actor_id'-'subject_id'=to_jsonb(old)-'user_id'-'actor_id'-'subject_id'
 then return new; end if;
 raise exception 'append-only table %',tg_table_name using errcode='42501';
end $$;

create function private.lift_ban(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid; d uuid;
begin
 select user_id,decision_id into u,d from public.bans where id=p_id for update;
 perform pg_advisory_xact_lock(hashtextextended('moderation:'||u::text,0));
 update public.bans set until=now() where id=p_id;
 update public.ban_identifiers i set expires_at=now() where exists(select 1 from private.ban_links where ban_id=p_id and identifier_id=i.id)
 and not exists(select 1 from private.ban_links l join public.bans b on b.id=l.ban_id where l.identifier_id=i.id and (b.until is null or b.until>now()));
 update public.moderation_decisions set revoked_at=now() where id=d;
 update public.profiles set banned=exists(select 1 from public.bans where user_id=u and (until is null or until>now())),
 suspended=exists(select 1 from public.moderation_decisions where user_id=u and action in('suspension','ban') and revoked_at is null) where id=u;
end $$;
create or replace function private.admin_moderate(p_section text,p_id uuid,p_action text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reports; a public.appeals; d public.moderation_decisions; u uuid;
 c int; bid uuid; did uuid; iid uuid; s record;
begin
 perform private.require_admin(); perform private.require_registered();
 if char_length(btrim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'explanation required' using errcode='22023'; end if;
 if p_section='reports' then
  select * into r from public.reports where id=p_id for update;
  if not found or r.status<>'open' then raise exception 'not found' using errcode='P0002'; end if;
  u:=r.target_user_id;
  if p_action='escalate' then
   insert into public.safety_escalations(report_id,explanation,created_by) values(r.id,p_note,auth.uid()) on conflict(report_id) do nothing;
  elsif p_action='dismiss' then update public.reports set status='dismissed' where id=r.id;
  elsif p_action in('warn','suspend','ban') and u is not null then
   perform pg_advisory_xact_lock(hashtextextended('moderation:'||u::text,0));
   update public.reports set status='valid',validated_at=now(),validated_by=auth.uid() where id=r.id;
   if r.reason='possible_minor' then update public.verification_status set reverification_required=true where user_id=u; end if;
   select count(distinct reporter_id) into c from public.reports where target_user_id=u
    and status in('valid','actioned') and created_at>=now()-make_interval(hours=>private.setting_int('reports_strike_window_h',6));
   insert into public.moderation_decisions(user_id,report_id,action,reason,explanation,decided_by)
    values(u,r.id,case when p_action='ban' then 'ban' when p_action='suspend' or c>=3 then 'suspension' else 'warning' end,r.reason,p_note,auth.uid()) returning id into did;
   if p_action in('suspend','ban') or c>=3 then
    update public.profiles set suspended=true,banned=(banned or p_action='ban') where id=u;
    perform realtime.send('{}','refresh','social:'||u::text,true);
   end if;
   if p_action='ban' then
    insert into public.bans(user_id,reason,created_by,decision_id) values(u,r.reason,auth.uid(),did) returning id into bid;
    for s in select 'phone' as kind,private.hmac_hex('phone:'||private.normalize_phone(phone)) as hmac from auth.users where id=u and nullif(phone,'') is not null
     union all select 'device',device_hmac from public.user_devices where user_id=u loop
     insert into public.ban_identifiers(kind,hmac,reason) values(s.kind,s.hmac,bid::text)
      on conflict(kind,hmac) do update set expires_at=null returning id into iid;
     insert into private.ban_links(ban_id,identifier_id) values(bid,iid) on conflict do nothing;
    end loop;
   end if;
  elsif p_action='delete' and r.target_event_id is not null then
   update public.events set status='removed',hidden_at=now() where id=r.target_event_id;
   update public.reports set status='actioned',validated_at=now(),validated_by=auth.uid() where id=r.id;
  else raise exception 'invalid action' using errcode='22023'; end if;
 elsif p_section='appeals' then
  select * into a from public.appeals where id=p_id for update;
  if not found or a.status<>'pending' or p_action not in('accept','reject') then raise exception 'not found' using errcode='P0002'; end if;
  select * into d from public.moderation_decisions where id=a.decision_id;
  if d.decided_by=auth.uid() or a.user_id=auth.uid() then raise exception 'independent reviewer required' using errcode='42501'; end if;
  update public.appeals set status=case when p_action='accept' then 'accepted' else 'rejected' end,
   resolved_by=auth.uid(),resolved_at=now(),explanation=p_note where id=a.id;
  if p_action='accept' then
   perform pg_advisory_xact_lock(hashtextextended('moderation:'||a.user_id::text,0));
   for bid in select id from public.bans where decision_id=d.id loop perform private.lift_ban(bid); end loop;
   update public.moderation_decisions set revoked_at=now() where id=d.id;
   update public.reports set status='dismissed' where id=d.report_id;
   update public.profiles set suspended=exists(select 1 from public.moderation_decisions where user_id=a.user_id and action in('suspension','ban') and revoked_at is null),
    banned=exists(select 1 from public.bans where user_id=a.user_id and (until is null or until>now())) where id=a.user_id;
  end if;
 elsif p_section='bans' and p_action='lift' then
  select user_id into u from public.bans where id=p_id for update;
  if not found then raise exception 'not found' using errcode='P0002'; end if;
  perform private.lift_ban(p_id);

 else raise exception 'invalid section' using errcode='22023'; end if;
 perform private.audit('moderation.'||p_action,p_section||':'||p_id::text);
end $$;
create or replace function private.billing_apply(p jsonb) returns jsonb
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
  if not found or o.user_id is null or o.status not in('pending','expired','paid') or
   (not sim and o.provider_session_id is distinct from p->>'sessionId') or (p->>'amount')::int<>o.amount_cents or p->>'currency'<>'eur' then
   raise exception 'order mismatch' using errcode='22023'; end if;
  u:=o.user_id; code:=o.plan_code;
  if mode='test' and not exists(select 1 from public.user_roles where user_id=u and role in('tester','admin')) then raise exception 'test recipient forbidden' using errcode='42501'; end if;
  if o.status in('pending','expired') then
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
create or replace function private.export_my_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); result jsonb:='{}'; t text; field text; data jsonb;
begin
 perform private.case_limit('export',5);
 for t,field in select * from(values('profiles','id'),('verification_status','user_id'),('verification_sessions','user_id'),
 ('user_preferences','user_id'),('user_roles','user_id'),('consent_records','user_id'),('attendance','user_id'),('ratings','user_id'),
 ('lost_and_found','user_id'),('likes','from_user'),('swipe_passes','user_id'),('messages','sender_id'),('blocks','blocker_id'),
 ('reports','reporter_id'),('moderation_decisions','user_id'),('appeals','user_id'),('emergency_contacts','user_id'),
 ('events','created_by'),('venue_claims','user_id'),('venue_managers','user_id'),('sponsorships','requested_by'),
 ('entitlements','user_id'),('subscriptions','user_id'),('invoices','user_id'),('credit_ledger','user_id'),('promo_redemptions','user_id'),
 ('data_requests','user_id'),('purchase_orders','user_id'),('billing_notices','user_id'),('email_outbox','user_id'),('event_confirmations','user_id'),('event_reports','user_id')) tables(t,f) loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from public.%I r where %I=$1',t,field) into data using u;
  result:=result||jsonb_build_object(t,data);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(m)),'[]') into data from public.matches m where u in(user_a,user_b);
 result:=result||jsonb_build_object('matches',data,'exportedAt',now());
 insert into public.data_requests(user_id,kind,status,closed_at) values(u,'export','done',now());
 insert into public.gdpr_audit_log(actor_id,subject_id,action) values(u,u,'account.export');
 return result;
end $$;

create function private.admin_case_list(p_section text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tab text; result jsonb;
begin
 perform private.require_admin(); perform private.require_registered();
 tab:=case p_section when 'reports' then 'reports' when 'appeals' then 'appeals' when 'bans' then 'bans'
 when 'claims' then 'venue_claims' when 'events' then 'events' when 'sponsorships' then 'sponsorships'
 when 'subscriptions' then 'subscriptions' when 'entitlements' then 'entitlements' when 'promoCodes' then 'promo_codes'
 when 'paymentEvents' then 'payment_events' when 'dataRequests' then 'data_requests' when 'legalDocs' then 'legal_documents'
 when 'escalations' then 'safety_escalations' end;
 if tab is null then raise exception 'invalid section' using errcode='22023'; end if;
 execute format('select coalesce(jsonb_agg(jsonb_build_object(
 ''id'',coalesce(r->>''id'',r->>''code''),
 ''title'',coalesce(r->>''title'',r->>''plan_code'',r->>''key'',r->>''code'',r->>''reason'',r->>''type'',r->>''kind'',r->>''report_id'',r->>''venue_id'',''''),
 ''subtitle'',concat_ws('' · '',r->>''user_id'',r->>''target_user_id'',r->>''comment'',r->>''text'',r->>''explanation'',r->>''evidence''),
 ''status'',case when %L=''bans'' then case when r->>''until'' is null or (r->>''until'')::timestamptz>now() then ''active'' else ''lifted'' end else coalesce(r->>''status'',''logged'') end,
 ''createdAt'',coalesce(r->>''created_at'',r->>''started_at'',r->>''issued_at''),
 ''facts'',array_remove(array[r->>''mode'',r->>''tier'',r->>''invoice_ref'',r->>''provider_event_id'',r->>''notice_reference'',r->>''due_at'',r->>''language'',r->>''version''],null)
 ) order by coalesce(r->>''created_at'',r->>''started_at'') desc),''[]'') from
 (select to_jsonb(t) r from public.%I t limit 200) q',p_section,tab) into result;
 -- Exact DSA locator and contact are confined to the authenticated MFA case reviewer.
 if p_section='reports' then
  select coalesce(jsonb_agg(x||jsonb_build_object('subtitle',concat_ws(' · ',x->>'subtitle',n.url,n.email))),'[]') into result
  from jsonb_array_elements(result) x left join public.illegal_content_notices n on n.report_id=(x->>'id')::uuid;
 end if;
 return result;
end $$;

create function private.admin_case_action(p_section text,p_id uuid,p_action text,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
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
   where lower(v.city)=lower(city_name) and sp.status='active' and sp.starts_on<=s.ends_on and sp.ends_on>=s.starts_on;
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

create function private.admin_promo(p_code text,p_days int,p_max int) returns text
language plpgsql security definer set search_path='' as $$
declare code text:=upper(encode(extensions.gen_random_bytes(6),'hex')); result text;
begin
 perform private.require_admin(); perform private.require_registered();
 if not exists(select 1 from public.plans where plans.code=p_code and active and kind in('subscription','one_night')) then raise exception 'invalid plan' using errcode='22023'; end if;
 result:=substr(code,1,4)||'-'||substr(code,5,4)||'-'||substr(code,9,4);
 insert into public.promo_codes(code,plan_code,days,max_uses,expires_at,created_by) values(result,p_code,p_days,p_max,now()+interval '1 year',auth.uid());
 perform private.audit('promo.create',result); return result;
end $$;
create function private.admin_entitlement(p_user uuid,p_key text,p_days int default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin(); perform private.require_registered();
 if p_days is not null and p_days not between 1 and 365 then raise exception 'invalid duration' using errcode='22023'; end if;
 insert into public.entitlements(user_id,key,source,ends_at,granted_by) values(p_user,p_key,'admin',case when p_days is not null then now()+make_interval(days=>p_days) end,auth.uid());
 perform private.audit('entitlement.grant',p_user::text||':'||p_key);
end $$;
create or replace function private.admin_dashboard() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 return jsonb_build_object('users',(select count(*) from public.profiles),
 'ageVerifiedPercent',(select coalesce(round(100.0*count(*) filter(where age_verified)/nullif(count(*),0)),0) from public.verification_status),
 'matchesToday',(select count(*) from public.matches where created_at>=current_date),
 'pendingReports',(select count(*) from public.reports where status='open'),
 'pendingVerifications',(select count(*) from public.verification_sessions where status='pending'),
 'pendingClaims',(select count(*) from public.venue_claims where status='pending'),
 'openDataRequests',(select count(*) from public.data_requests where status='open'),
 'testRevenueCents',(select coalesce(sum(amount_cents),0) from public.purchase_orders where mode='test' and status='paid'));
end $$;

-- Blocked legal evidence is inaccessible to users, including after owner erasure.
create table private.erasure_evidence(
 id uuid primary key default gen_random_uuid(), subject_hmac text not null, category text not null,
 evidence jsonb not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
alter table private.erasure_evidence enable row level security;
revoke all on private.erasure_evidence from public,anon,authenticated;
create function private.prepare_erasure(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into private.erasure_evidence(subject_hmac,category,evidence,expires_at)
 select private.hmac_hex('erased:'||p_user::text),'moderation',jsonb_build_object('action',action,'reason',reason,'explanation',explanation,'createdAt',created_at),greatest(now(),created_at+interval '2 years')
 from public.moderation_decisions where user_id=p_user;
 -- No document, photo, DOB or provider response is copied.
 insert into private.erasure_evidence(subject_hmac,category,evidence,expires_at)
 select private.hmac_hex('erased:'||p_user::text),'verification',jsonb_build_object('ageVerified',age_verified,'idVerified',id_verified,'photoVerified',photo_verified),now()+interval '2 years'
 from public.verification_status where user_id=p_user and (age_verified or id_verified or photo_verified);
 delete from public.events where created_by=p_user and origin='community';
 insert into public.data_requests(user_id,kind,status,closed_at) values(p_user,'delete','done',now());
 insert into public.gdpr_audit_log(actor_id,subject_id,action) values(p_user,p_user,'account.delete');
end $$;

-- Fetch effective benefits through the same SQL check used by social endpoints.
create function private.my_entitlements() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(e)),'[]') into result from public.entitlements e where user_id=u and e.status='active' and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()) and (e.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and public.has_entitlement(e.key);
 return result;
end $$;

do $$
declare f record; roles text;
begin
 for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) ia,p.proargnames
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in(
 'admin_case_list','admin_case_action','admin_promo','admin_entitlement','prepare_erasure','my_entitlements') loop
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $fn$ select private.%I(%s) $fn$',f.proname,f.args,pg_get_function_result(f.oid),f.proname,array_to_string(f.proargnames,','));
 execute format('revoke all on function public.%I(%s),private.%I(%s) from public,anon,authenticated',f.proname,f.ia,f.proname,f.ia);
 roles:=case when f.proname='prepare_erasure' then 'service_role' else 'authenticated' end;
 execute format('grant execute on function public.%I(%s),private.%I(%s) to %s',f.proname,f.ia,f.proname,f.ia,roles);
 end loop;
end $$;
revoke all on function private.lift_ban(uuid) from public,anon,authenticated;
