create or replace function private.billing_maintenance() returns void
language plpgsql security definer set search_path='' as $$
declare sub record; c jsonb; ref text; a record; worker text;
begin
 perform pg_advisory_xact_lock(hashtextextended('billing-maintenance',0));
 update public.entitlements set status='expired' where status='active' and ends_at<=now();
 update public.subscriptions set status='expired' where status in('active','cancel_at_period_end','past_due') and current_period_end<=now();
 update public.sponsorships set status='ended' where status='active' and ends_on<current_date;
 update public.flash_alerts set status='ended' where status='active' and ends_at<=now();
 -- Weekly VIP grants start one week after purchase, with unique origins.
 for sub in select s.* from public.subscriptions s where s.user_id is not null and status in('active','cancel_at_period_end') and current_period_end>now()
 and exists(select 1 from public.purchase_orders where provider_subscription_id=s.provider_subscription_id and status='paid') loop
  if sub.plan_code='vip_monthly' and now()>=sub.started_at+interval '7 days' then
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
 delete from public.payment_events where processed_at<now()-interval '90 days';
 delete from public.billing_notices where status in('sent','simulated') and created_at<now()-interval '90 days';
 delete from public.invoices where issued_at<now()-interval '6 years';
 delete from public.purchase_orders o where created_at<now()-interval '6 years' and not exists(
 select 1 from public.subscriptions s where s.provider_subscription_id=o.provider_subscription_id and s.status in('active','cancel_at_period_end'));
 select decrypted_secret into worker from vault.decrypted_secrets where name='billing_worker_key';
 perform net.http_post(url:='https://ocrpfeqfqzchhrghqcfb.supabase.co/functions/v1/billing-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-worker-key',worker),body:='{}',timeout_milliseconds:=30000);
end $$;