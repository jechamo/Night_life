-- Desistimiento: créditos solo sin usar, servicios por tiempo prorrateados, B2B excluido,
-- sin consentimiento reembolso completo, ventana de 14 días, propiedad y privilegios.
-- One transaction that always ends in an error (= rollback).
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000e7'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009996'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,8) i;
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test,city)
select ('00000000-0000-4000-8000-00000000e7'||lpad(i::text,2,'0'))::uuid,'Withdrawal SQL '||i,'1995-01-01','woman',now(),true,'Withdrawal Test'
from generate_series(1,8) i;
insert into public.verification_status(user_id,age_verified,age_mode)
select id,true,'sandbox' from public.profiles where name like 'Withdrawal SQL %';
insert into public.user_roles(user_id,role) select id,'tester' from public.profiles where name like 'Withdrawal SQL %';
update public.app_settings set value='test' where key='payments_mode';
update public.app_settings set value='testers' where key='payments_audience';
update public.app_settings set value='on' where key in('test_tools_enabled','premium_enabled');
insert into public.venues(id,name,type,address,location,city,is_test)
values('00000000-0000-4000-8000-0000000e7e01','Withdrawal venue','club','Test',
 extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Withdrawal Test',true);
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _p,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or no_data_found then return true; end $$;
create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000e7'||lpad(n::text,2,'0'))::uuid $$;
create function pg_temp.as_user(n int) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',pg_temp.uid(n),'role','authenticated','aal','aal1')::text, true),
  set_config('request.headers', json_build_object('x-real-ip','10.7.0.'||n)::text, true) $$;
create function pg_temp.last_order(n int, code text) returns uuid language sql as $$
 select id from public.purchase_orders where user_id=pg_temp.uid(n) and plan_code=code order by created_at desc limit 1 $$;
create function pg_temp.o(k text) returns uuid language sql as $$ select (value#>>'{}')::uuid from _ctx where key=k $$;
create function pg_temp.balance(n int, k text) returns int language sql as $$
 select coalesce(sum(delta),0)::int from public.credit_ledger where user_id=pg_temp.uid(n) and kind=k and mode='test' $$;

insert into _p values
 ('anon cannot quote or simulate', not has_function_privilege('anon','public.withdrawal_quote(uuid)','execute')
   and not has_function_privilege('anon','public.simulate_withdrawal(uuid)','execute')),
 ('clients cannot apply refunds or consent', not has_function_privilege('authenticated','public.billing_withdrawal_apply(uuid,integer,text)','execute')
   and not has_function_privilege('authenticated','private.billing_withdrawal_apply(uuid,integer,text)','execute')
   and not has_function_privilege('authenticated','public.billing_record_consent(uuid,uuid)','execute')
   and not has_function_privilege('authenticated','private.billing_record_consent(uuid,uuid)','execute')),
 ('raw quote helper closed', not has_function_privilege('authenticated','private.withdrawal_quote(uuid,uuid)','execute')),
 ('service role can apply', has_function_privilege('service_role','public.billing_withdrawal_apply(uuid,integer,text)','execute')
   and has_function_privilege('service_role','public.billing_record_consent(uuid,uuid)','execute')),
 ('no public definer', not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef));

-- 1) Credits untouched: full refund. 2) Credits used: no refund.
set local role authenticated;
select pg_temp.as_user(1); select public.simulate_billing('sparks_5');
select pg_temp.as_user(2); select public.simulate_billing('sparks_5');
reset role;
insert into _ctx values('o1',to_jsonb(pg_temp.last_order(1,'sparks_5'))),('o2',to_jsonb(pg_temp.last_order(2,'sparks_5')));
insert into _p select 'simulated purchase records immediate-start consent',
 (select immediate_start_at is not null from public.purchase_orders where id=pg_temp.last_order(1,'sparks_5'));
insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(pg_temp.uid(1),'spark',-1,'spend','test','wd:spend1');
set local role authenticated; select pg_temp.as_user(1);
insert into _ctx values('q1', public.withdrawal_quote(pg_temp.o('o1')));
insert into _ctx values('w1', public.simulate_withdrawal(pg_temp.o('o1')));
select pg_temp.as_user(2);
insert into _ctx values('q2', public.withdrawal_quote(pg_temp.o('o2')));
insert into _ctx values('other', public.withdrawal_quote(pg_temp.o('o1')));
insert into _p select 'cannot withdraw another person''s order', pg_temp.denied(format('select public.simulate_withdrawal(%L)',pg_temp.o('o1')));
insert into _ctx values('w2', public.simulate_withdrawal(pg_temp.o('o2')));
reset role;
insert into _p select 'used credits: not eligible', value->>'eligible'='false' and value->>'reason'='credits_used' from _ctx where key='q1';
insert into _p select 'used credits: withdrawal refused', value->>'error'='credits_used' from _ctx where key='w1';
insert into _p select 'used credits: order stays paid', (select status from public.purchase_orders where id=pg_temp.last_order(1,'sparks_5'))='paid';
insert into _p select 'unused credits: full refund quoted', value->>'eligible'='true' and (value->>'refundCents')::int=499 and value->>'basis'='unused' from _ctx where key='q2';
insert into _p select 'quote of someone else''s order is not found', value->>'reason'='not_found' from _ctx where key='other';
insert into _p select 'unused credits: refunded and taken back', (select status='refunded' and refunded_cents=499 from public.purchase_orders where id=pg_temp.last_order(2,'sparks_5'))
 and pg_temp.balance(2,'spark')=0;
insert into _p select 'invoice marked refunded', (select status from public.invoices where payment_intent_id='sim_'||pg_temp.last_order(2,'sparks_5'))='refunded';
insert into _p select 'second apply is ignored', private.billing_withdrawal_apply(pg_temp.last_order(2,'sparks_5'),499,'again')->>'ignored'='true';

-- 3) Subscription: the part not enjoyed is refunded.
set local role authenticated; select pg_temp.as_user(3); select public.simulate_billing('pass_monthly'); reset role;
update public.purchase_orders set paid_at=now()-interval '10 days' where id=pg_temp.last_order(3,'pass_monthly');
update public.subscriptions set current_period_end=now()+interval '20 days'
 where provider_subscription_id=(select provider_subscription_id from public.purchase_orders where id=pg_temp.last_order(3,'pass_monthly'));
set local role authenticated; select pg_temp.as_user(3);
insert into _ctx values('q3', public.withdrawal_quote(null));
insert into _ctx values('w3', public.simulate_billing('pass_monthly','withdraw'));
reset role;
insert into _p select 'subscription quote found without order id', value->>'orderId'=pg_temp.last_order(3,'pass_monthly')::text from _ctx where key='q3';
insert into _p select 'subscription prorated (2/3 of 9.99 €)', value->>'basis'='prorated' and (value->>'refundCents')::int between 660 and 667 from _ctx where key='q3';
insert into _p select 'subscription withdrawn with prorated refund',
 (select status from public.subscriptions where provider_subscription_id=(select provider_subscription_id from public.purchase_orders where id=pg_temp.last_order(3,'pass_monthly')))='withdrawn'
 and (select refunded_cents between 660 and 667 from public.purchase_orders where id=pg_temp.last_order(3,'pass_monthly'));
insert into _p select 'subscription perks revoked', not exists(select 1 from public.entitlements where user_id=pg_temp.uid(3) and status='active'
 and origin_ref=(select provider_subscription_id from public.purchase_orders where id=pg_temp.last_order(3,'pass_monthly')));

-- 4) VIP with used weekly credits: balance never goes negative.
set local role authenticated; select pg_temp.as_user(4); select public.simulate_billing('vip_monthly'); reset role;
insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(pg_temp.uid(4),'spark',-3,'spend','test','wd:spend4');
set local role authenticated; select pg_temp.as_user(4); select public.simulate_billing('vip_monthly','withdraw'); reset role;
insert into _p select 'VIP withdrawn, balances not negative', pg_temp.balance(4,'spark')=0 and pg_temp.balance(4,'spotlight')=0 and pg_temp.balance(4,'paid_dm')=0
 and (select status from public.purchase_orders where id=pg_temp.last_order(4,'vip_monthly'))='refunded';

-- 5) One-night pass: prorated while active, nothing once over; no consent = full refund.
set local role authenticated; select pg_temp.as_user(5); select public.simulate_billing('one_night'); reset role;
insert into _ctx values('o5',to_jsonb(pg_temp.last_order(5,'one_night')));
set local role authenticated; select pg_temp.as_user(5);
insert into _ctx values('q5', public.withdrawal_quote(pg_temp.o('o5')));
reset role;
insert into _p select 'one-night quoted prorated', value->>'eligible'='true' and value->>'basis'='prorated' and (value->>'refundCents')::int<=299 from _ctx where key='q5';
update public.entitlements set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 minute' where user_id=pg_temp.uid(5) and origin_ref=pg_temp.last_order(5,'one_night')::text;
insert into _p select 'one-night over: nothing to refund', private.withdrawal_quote(pg_temp.last_order(5,'one_night'),pg_temp.uid(5))->>'reason'='used';
update public.purchase_orders set immediate_start_at=null where id=pg_temp.last_order(5,'one_night');
insert into _p select 'without consent: full refund', (private.withdrawal_quote(pg_temp.last_order(5,'one_night'),pg_temp.uid(5))->>'refundCents')::int=299;

-- 6) Window and business purchases.
update public.purchase_orders set paid_at=now()-interval '15 days' where id=pg_temp.last_order(1,'sparks_5');
insert into _p select 'after 14 days the window is closed', private.withdrawal_quote(pg_temp.last_order(1,'sparks_5'),pg_temp.uid(1))->>'reason'='window_closed';
insert into public.purchase_orders(user_id,plan_code,mode,status,amount_cents,price_id,venue_id,paid_at,provider_payment_intent_id)
values(pg_temp.uid(6),'sponsor_featured','test','paid',2900,'price_test','00000000-0000-4000-8000-0000000e7e01',now(),'pi_wd_b2b');
insert into _p select 'business purchases have no consumer withdrawal',
 private.withdrawal_quote((select id from public.purchase_orders where provider_payment_intent_id='pi_wd_b2b'),pg_temp.uid(6))->>'reason'='business';

-- 7) Consent is recorded server-side only for the owner's pending consumer order.
set local role authenticated; select pg_temp.as_user(7);
insert into _ctx values('o7', public.billing_start_order('sparks_1'));
reset role;
select public.billing_record_consent((value->>'id')::uuid, pg_temp.uid(8)) from _ctx where key='o7';
insert into _p select 'consent ignored for another user', (select immediate_start_at is null from public.purchase_orders where id=(select (value->>'id')::uuid from _ctx where key='o7'));
select public.billing_record_consent((value->>'id')::uuid, pg_temp.uid(7)) from _ctx where key='o7';
insert into _p select 'consent recorded for the owner', (select immediate_start_at is not null from public.purchase_orders where id=(select (value->>'id')::uuid from _ctx where key='o7'));

-- 8) Legal texts.
insert into _p select 'premium terms 1.1 explain the new rules', exists(select 1 from public.legal_documents where slug='premium' and version='1.1' and language='es'
 and sections::text like '%no has usado ninguno%');
insert into _p select 'sponsorship terms 1.2 exclude consumer withdrawal', exists(select 1 from public.legal_documents where slug='sponsorship' and version='1.2' and language='es' and status='published'
 and sections::text like '%entre empresas%');

do $$ begin
 raise exception 'WITHDRAWAL RESULTS % passed / % failed: %',
  (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
