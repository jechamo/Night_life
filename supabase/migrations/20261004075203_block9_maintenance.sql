-- Block 9: retry leases, scheduled notices, credit expiry and erasure.
create or replace function private.premium_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); sub jsonb; inv jsonb; credits jsonb; night timestamptz;
begin
 select jsonb_build_object('id',id,'productCode',plan_code,'provider',provider,'status',status,'startedAt',started_at,'currentPeriodEnd',current_period_end,'simulated',simulated)
 into sub from public.subscriptions where user_id=u and (mode='live' or private.sees_test_data()) order by started_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'productCode',plan_code,'amountCents',amount_cents,'issuedAt',issued_at,'status',status,'url',hosted_url) order by issued_at desc),'[]')
 into inv from public.invoices where user_id=u and (mode='live' or private.sees_test_data());
 select jsonb_object_agg(kind,amount) into credits from(select kind,greatest(0,coalesce((select sum(delta) from public.credit_ledger where user_id=u and credit_ledger.kind=ck.kind and (mode='live' or private.sees_test_data())),0)) amount from unnest(array['spark','spotlight','paid_dm']) ck(kind)) balances;
 select max(ends_at) into night from public.entitlements where user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and status='active' and ends_at>now() and origin_ref in(select id::text from public.purchase_orders where user_id=u and plan_code='one_night' and status='paid');
 return jsonb_build_object('subscription',sub,'invoices',inv,'credits',credits,'oneNightUntil',night,'notifyMe',coalesce((select notify_me from private.billing_profiles where user_id=u),false));
end $$;
create or replace function private.admin_dashboard() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 return jsonb_build_object('users',(select count(*) from public.profiles),
 'ageVerifiedPercent',(select coalesce(round(100.0*count(*) filter(where age_verified)/nullif(count(*),0)),0) from public.verification_status),
 'matchesToday',(select count(*) from public.matches where created_at>=current_date),
 'pendingReports',(select count(*) from public.reports where status='open'),
 'pendingVerifications',(select count(*) from public.verification_sessions where state in('pending','manual_review')),
 'pendingClaims',(select count(*) from public.venue_claims where status='pending'),
 'openDataRequests',(select count(*) from public.data_requests where status='open'),
 'testRevenueCents',(select coalesce(sum(amount_cents),0) from public.purchase_orders where mode='test' and status='paid'));
end $$;
create or replace function private.prepare_erasure(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into private.erasure_evidence(subject_hmac,category,evidence,expires_at)
 select private.hmac_hex('erased:'||p_user::text),'moderation',jsonb_build_object('action',action,'reason',reason,'explanation',explanation,'createdAt',created_at),greatest(now(),created_at+interval '2 years')
 from public.moderation_decisions where user_id=p_user;
 -- No document, photo, DOB or provider response is copied.
 insert into private.erasure_evidence(subject_hmac,category,evidence,expires_at)
 select private.hmac_hex('erased:'||p_user::text),'verification',jsonb_build_object('ageVerified',age_verified,'idVerified',identity_verified,'photoVerified',photo_verified),now()+interval '2 years'
 from public.verification_status where user_id=p_user and (age_verified or identity_verified or photo_verified);
 delete from public.events where created_by=p_user and origin='community';
 insert into public.data_requests(user_id,kind,status,closed_at) values(p_user,'delete','done',now());
 insert into public.gdpr_audit_log(actor_id,subject_id,action) values(p_user,p_user,'account.delete');
end $$;
alter table public.profiles add column inactivity_warned_at timestamptz;
alter table public.billing_notices add column lease_token uuid;
create table private.provider_erasure_queue(
 id uuid primary key default gen_random_uuid(), provider text not null check(provider in('veriff','yoti')),
 provider_session_id text not null, next_attempt_at timestamptz not null default now(), attempts int not null default 0,
 http_status int, created_at timestamptz not null default now(), unique(provider,provider_session_id)
);
alter table private.provider_erasure_queue enable row level security;
revoke all on private.provider_erasure_queue from public,anon,authenticated;
create function private.defer_provider_erasure(p_provider text,p_session text,p_status int) returns void
language sql security definer set search_path='' as $$
 insert into private.provider_erasure_queue(provider,provider_session_id,http_status)
 values(p_provider,p_session,p_status) on conflict(provider,provider_session_id) do update set http_status=excluded.http_status
$$;
-- Random worker authentication stays in Vault; it is never returned to a client.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'billing_worker_key','Nightlife cron authentication');
create function private.claim_billing_work(p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; purge jsonb; cleanup jsonb;
begin
 if p_key is null or p_key is distinct from (select decrypted_secret from vault.decrypted_secrets where name='billing_worker_key') then raise exception 'forbidden' using errcode='42501'; end if;
 with candidates as (
 select id from public.billing_notices where (status='pending' and next_attempt_at<=now() or status='sending' and lease_until<now()) and attempts<10
 order by created_at limit 20 for update skip locked), updated as (
 update public.billing_notices b set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
 from candidates c where b.id=c.id returning b.*)
 select coalesce(jsonb_agg(to_jsonb(u)||jsonb_build_object('language',p.language,'isTest',p.is_test)),'[]') into result
 from updated u join public.profiles p on p.id=u.user_id;
 select coalesce(jsonb_agg(id),'[]') into purge from (select id from public.profiles
 where last_active_at<=now()-interval '24 months' and inactivity_warned_at<=now()-interval '30 days' limit 10) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into cleanup from (
 select * from private.provider_erasure_queue where next_attempt_at<=now() and attempts<10 limit 10) q;
 return jsonb_build_object('notices',result,'purge',purge,'cleanup',cleanup);
end $$;
create function private.finish_billing_notice(p_id uuid,p_lease uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in('sent','simulated','retry') then raise exception 'invalid result' using errcode='22023'; end if;
 update public.billing_notices set status=case when p_status='retry' then case when attempts>=10 then 'failed' else 'pending' end else p_status end,
 sent_at=case when p_status in('sent','simulated') then now() end,
 next_attempt_at=now()+make_interval(secs=>least(86400,power(2,attempts)::int*60)),lease_until=null,lease_token=null
 where id=p_id and status='sending' and lease_token=p_lease;
end $$;
create function private.account_activity() returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.profiles set last_active_at=now(),inactivity_warned_at=null where id=auth.uid() and last_active_at<now()-interval '1 hour';
end $$;
create function private.billing_maintenance() returns void
language plpgsql security definer set search_path='' as $$
declare sub record; c jsonb; ref text; a record; worker text;
begin
 perform pg_advisory_xact_lock(hashtextextended('billing-maintenance',0));
 update public.entitlements set status='expired' where status='active' and ends_at<=now();
 update public.subscriptions set status='expired' where status in('active','cancel_at_period_end','past_due') and current_period_end<=now();
 update public.sponsorships set status='ended' where status='active' and ends_on<current_date;
 update public.flash_alerts set status='ended' where status='active' and ends_at<=now();
 -- Weekly VIP grants start one week after purchase, with unique origins.
 for sub in select s.* from public.subscriptions s where status in('active','cancel_at_period_end') and current_period_end>now() and plan_code='vip_monthly'
 and exists(select 1 from public.purchase_orders where provider_subscription_id=s.provider_subscription_id and status='paid') loop
  if now()>=sub.started_at+interval '7 days' then
   ref:=sub.provider_subscription_id||':week:'||floor(extract(epoch from(now()-sub.started_at))/604800)::int::text;
   for c in select value from public.plans p,jsonb_array_elements(p.credits) where p.code=sub.plan_code loop
    insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref)
    values(sub.user_id,c->>'kind',(c->>'amount')::int,'vip_week',sub.mode,ref) on conflict do nothing;
   end loop;
  end if;
  if exists(select 1 from public.plans where code=sub.plan_code and billing_interval='year') and sub.current_period_end between now() and now()+interval '7 days' then
   perform private.billing_queue(sub.user_id,'annual_renewal',sub.provider_subscription_id||':'||sub.current_period_end::text);
  end if;
 end loop;
 for a in select id,last_active_at from public.profiles where last_active_at<=now()-interval '23 months' and inactivity_warned_at is null for update loop
  update public.profiles set inactivity_warned_at=now() where id=a.id;
  perform private.billing_queue(a.id,'inactive_account',a.id::text||':'||a.last_active_at::text);
 end loop;
 delete from private.case_limits where created_at<now()-interval '90 days';
 delete from private.erasure_evidence where expires_at<=now();
 delete from public.payment_events where created_at<now()-interval '90 days';
 delete from public.billing_notices where status in('sent','simulated') and created_at<now()-interval '90 days';
 delete from public.invoices where issued_at<now()-interval '6 years';
 delete from public.purchase_orders o where created_at<now()-interval '6 years' and not exists(
 select 1 from public.subscriptions s where s.provider_subscription_id=o.provider_subscription_id and s.status in('active','cancel_at_period_end'));
 select decrypted_secret into worker from vault.decrypted_secrets where name='billing_worker_key';
 perform net.http_post(url:='https://ocrpfeqfqzchhrghqcfb.supabase.co/functions/v1/billing-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-worker-key',worker),body:='{}',timeout_milliseconds:=30000);
end $$;

do $$
declare f record; roles text;
begin
 for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) ia,p.proargnames
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in(
 'claim_billing_work','finish_billing_notice','account_activity','defer_provider_erasure') loop
 execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $fn$ select private.%I(%s) $fn$',f.proname,f.args,pg_get_function_result(f.oid),f.proname,array_to_string(f.proargnames,','));
 execute format('revoke all on function public.%I(%s),private.%I(%s) from public,anon,authenticated',f.proname,f.ia,f.proname,f.ia);
 roles:=case when f.proname='account_activity' then 'authenticated' else 'service_role' end;
 execute format('grant execute on function public.%I(%s),private.%I(%s) to %s',f.proname,f.ia,f.proname,f.ia,roles);
 end loop;
end $$;
revoke all on function private.billing_maintenance() from public,anon,authenticated;
select cron.schedule('nl_billing_maintenance','*/5 * * * *','select private.billing_maintenance()');
