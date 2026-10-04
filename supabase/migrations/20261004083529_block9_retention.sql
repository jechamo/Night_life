create or replace function private.premium_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); sub jsonb; inv jsonb; credits jsonb; night timestamptz;
begin
 select jsonb_build_object('id',id,'productCode',plan_code,'provider',provider,'status',status,'startedAt',started_at,'currentPeriodEnd',current_period_end,'simulated',simulated)
 into sub from public.subscriptions where user_id=u and (mode='live' or private.sees_test_data()) order by started_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'productCode',plan_code,'amountCents',amount_cents,'issuedAt',issued_at,'status',status,'url',hosted_url,'orderId',(select po.id from public.purchase_orders po where po.provider_payment_intent_id=invoices.payment_intent_id and po.user_id=u limit 1)) order by issued_at desc),'[]')
 into inv from public.invoices where user_id=u and (mode='live' or private.sees_test_data());
 select jsonb_object_agg(kind,amount) into credits from(select kind,greatest(0,coalesce((select sum(delta) from public.credit_ledger where user_id=u and credit_ledger.kind=ck.kind and (mode='live' or private.sees_test_data())),0)) amount from unnest(array['spark','spotlight','paid_dm']) ck(kind)) balances;
 select max(ends_at) into night from public.entitlements where user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and status='active' and ends_at>now() and origin_ref in(select id::text from public.purchase_orders where user_id=u and plan_code='one_night' and status='paid');
 return jsonb_build_object('subscription',sub,'invoices',inv,'credits',credits,'oneNightUntil',night,'notifyMe',coalesce((select notify_me from private.billing_profiles where user_id=u),false));
end $$;
-- Append-only history only permits FK erasure and the closed retention job.
create or replace function private.forbid_mutation() returns trigger language plpgsql set search_path='' as $$
declare col text;
begin
 if tg_op='DELETE' and current_user='postgres' and current_setting('nightlife.retention',true)='on' then return old; end if;
 if tg_op='UPDATE' and to_jsonb(new)-'user_id'-'actor_id'-'subject_id'=to_jsonb(old)-'user_id'-'actor_id'-'subject_id' then
  foreach col in array array['user_id','actor_id','subject_id'] loop
   if to_jsonb(new)->col is distinct from to_jsonb(old)->col and to_jsonb(new)->col is distinct from 'null'::jsonb then raise exception 'append only' using errcode='42501'; end if;
  end loop;
  return new;
 end if;
 raise exception 'append only' using errcode='42501';
end $$;
create function private.block9_retention() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('retention-block9',0));
 perform set_config('nightlife.retention','on',true);
 delete from public.admin_audit_log where created_at<now()-interval '90 days';
 delete from public.gdpr_audit_log where created_at<now()-interval '90 days';
 delete from public.email_outbox where created_at<now()-interval '90 days' and status in('sent','failed');
 delete from public.moderation_decisions d where created_at<now()-interval '2 years' and not exists(select 1 from public.bans b where b.decision_id=d.id and (b.until is null or b.until>now()));
 delete from public.reports r where created_at<now()-interval '2 years' and not exists(select 1 from public.moderation_decisions where report_id=r.id);
 delete from public.bans where created_at<now()-interval '2 years' and until<now();
 delete from public.ban_identifiers where expires_at<now() and not exists(select 1 from private.ban_links where identifier_id=ban_identifiers.id);
 perform set_config('nightlife.retention','off',true);
end $$;
revoke all on function private.block9_retention() from public,anon,authenticated,service_role;
select cron.schedule('nl_block9_retention','0 2 * * *','select private.block9_retention()');
