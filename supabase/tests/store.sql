-- Bloque 11b: compras de tienda (RevenueCat Test Store) aplicadas por store_apply.
-- Privilegios, acceso, suscripción (alta, renovación, cancelación, caducidad), consumibles
-- (idempotencia, reembolso sin saldo negativo), Pase de una noche, aislamiento test/live,
-- propiedad de la transacción, reservas de locales y desistimiento propio solo para Stripe.
-- One transaction that always ends in an error (= rollback).
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000f1'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009997'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,4) i;
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test,city)
select ('00000000-0000-4000-8000-00000000f1'||lpad(i::text,2,'0'))::uuid,'Store SQL '||i,'1995-01-01','woman',now(),true,'Madrid'
from generate_series(1,4) i;
insert into public.verification_status(user_id,age_verified,age_mode)
select id,true,'sandbox' from public.profiles where name like 'Store SQL %';
-- User 3 is a normal account (no tester role).
insert into public.user_roles(user_id,role) select id,'tester' from public.profiles where name in ('Store SQL 1','Store SQL 2','Store SQL 4');
update public.app_settings set value='test' where key='payments_mode';
update public.app_settings set value='testers' where key='payments_audience';
update public.app_settings set value='on' where key in('premium_enabled','sponsorship_self_service_enabled');
update public.app_settings set value='off' where key='store_payments_enabled';
insert into public.venues(id,name,type,address,location,city,is_test)
values('00000000-0000-4000-8000-0000000f1e01','Store venue','club','Test',
 extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Store Test',true);
insert into public.venue_managers(venue_id,user_id) values('00000000-0000-4000-8000-0000000f1e01','00000000-0000-4000-8000-00000000f104');
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _p,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or no_data_found then return true; end $$;
create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000f1'||lpad(n::text,2,'0'))::uuid $$;
create function pg_temp.as_user(n int) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',pg_temp.uid(n),'role','authenticated','aal','aal1')::text, true),
  set_config('request.headers', json_build_object('x-real-ip','10.11.0.'||n)::text, true) $$;
create function pg_temp.balance(n int, k text) returns int language sql as $$
 select coalesce(sum(delta),0)::int from public.credit_ledger where user_id=pg_temp.uid(n) and kind=k and mode='test' $$;
create function pg_temp.sub(id text, product text, gives boolean, renewal text, period_start timestamptz, period_end timestamptz,
 store text default 'test_store', env text default 'sandbox') returns jsonb language sql as $$
 select jsonb_build_object('id',id,'store',store,'environment',env,'productIdentifier',product,'givesAccess',gives,
  'autoRenewal',renewal,'status',case when gives then 'active' else 'expired' end,'startsAt',period_start,
  'periodStart',period_start,'periodEnd',period_end) $$;
create function pg_temp.buy(id text, product text, status text default 'owned', at timestamptz default now(),
 store text default 'test_store', env text default 'sandbox') returns jsonb language sql as $$
 select jsonb_build_object('id',id,'store',store,'environment',env,'productIdentifier',product,'status',status,'purchasedAt',at,'quantity',1) $$;
create function pg_temp.snap(subs jsonb, buys jsonb) returns jsonb language sql as $$
 select jsonb_build_object('eventId','sync:'||gen_random_uuid()::text,'source','sync','subscriptions',subs,'purchases',buys) $$;

-- 1) Privileges: only the service role applies store state.
insert into _p values
 ('clients cannot apply store state', not has_function_privilege('authenticated','public.store_apply(uuid,jsonb)','execute')
   and not has_function_privilege('anon','public.store_apply(uuid,jsonb)','execute')
   and not has_function_privilege('authenticated','private.store_apply(uuid,jsonb)','execute')),
 ('anon cannot read store access or reserve', not has_function_privilege('anon','public.store_access()','execute')
   and not has_function_privilege('anon','public.store_start_venue_order(text,uuid,date)','execute')),
 ('grant/revoke helpers are private', not has_function_privilege('authenticated','private.store_grant(uuid,text,text,text,text,timestamptz)','execute')
   and not has_function_privilege('authenticated','private.store_revoke(uuid,text,text)','execute'));

-- 2) Access: flag off, then on; testers only while payments are in test.
set local role authenticated; select pg_temp.as_user(1);
insert into _p select 'store access closed while the flag is off', pg_temp.denied('select public.store_access()');
reset role;
update public.app_settings set value='on' where key='store_payments_enabled';
set local role authenticated; select pg_temp.as_user(1);
insert into _ctx values('access', public.store_access());
select pg_temp.as_user(3);
insert into _p select 'normal accounts get no store access in test', pg_temp.denied('select public.store_access()');
reset role;
insert into _p select 'tester gets the Test Store product map', (select value->'products'->>'pass_monthly'='pass_monthly'
 and value->'products'->>'sponsor_top'='sponsor_top' and value->>'mode'='test' from _ctx where key='access');

-- 3) Subscription: purchase, idempotent replay, renewal, cancellation and expiry.
insert into _ctx values('s1', pg_temp.snap(jsonb_build_array(pg_temp.sub('sub_a','pass_monthly',true,'will_renew',now()-interval '1 minute',now()+interval '5 minutes')),'[]'));
select public.store_apply(pg_temp.uid(1), value) from _ctx where key='s1';
select public.store_apply(pg_temp.uid(1), value) from _ctx where key='s1';
insert into _p select 'subscription stored once with the test_store provider',
 (select count(*)=1 from public.subscriptions where provider_subscription_id='rc:sub_a' and provider='test_store' and status='active' and mode='test');
insert into _p select 'Pass entitlements granted from the store',
 exists(select 1 from public.entitlements where user_id=pg_temp.uid(1) and key='unlimited_likes' and source='test_store' and origin_ref='rc:sub_a' and status='active')
 and private.user_has_entitlement(pg_temp.uid(1),'travel_mode');
insert into _p select 'one paid order and one receipt per period',
 (select count(*)=1 from public.purchase_orders where store_transaction_id='rc:sub_a' and status='paid' and provider='test_store')
 and (select count(*)=1 from public.invoices where provider_invoice_id like 'rc:sub_a:%');
select public.store_apply(pg_temp.uid(1), pg_temp.snap(jsonb_build_array(pg_temp.sub('sub_a','pass_monthly',true,'will_renew',now()+interval '4 minutes',now()+interval '10 minutes')),'[]'));
insert into _p select 'renewal extends the period and adds a receipt',
 (select current_period_end>now()+interval '9 minutes' from public.subscriptions where provider_subscription_id='rc:sub_a')
 and (select count(*)=2 from public.invoices where provider_invoice_id like 'rc:sub_a:%');
select public.store_apply(pg_temp.uid(1), pg_temp.snap(jsonb_build_array(pg_temp.sub('sub_a','pass_monthly',true,'will_not_renew',now()+interval '4 minutes',now()+interval '10 minutes')),'[]'));
insert into _p select 'cancelled in the store keeps benefits until the period end',
 (select status='cancel_at_period_end' from public.subscriptions where provider_subscription_id='rc:sub_a')
 and private.user_has_entitlement(pg_temp.uid(1),'unlimited_likes');
select public.store_apply(pg_temp.uid(1), pg_temp.snap(jsonb_build_array(pg_temp.sub('sub_a','pass_monthly',false,'will_not_renew',now()-interval '10 minutes',now()-interval '1 minute')),'[]'));
insert into _p select 'expiry revokes the Pass',
 (select status='expired' from public.subscriptions where provider_subscription_id='rc:sub_a')
 and not private.user_has_entitlement(pg_temp.uid(1),'unlimited_likes');
insert into _p select 'own Stripe withdrawal is refused for store purchases',
 private.withdrawal_quote((select id from public.purchase_orders where store_transaction_id='rc:sub_a'),pg_temp.uid(1))->>'reason'='store';

-- 4) Consumables: idempotent, refund without negative balance.
select public.store_apply(pg_temp.uid(2), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_sparks','sparks_5'))));
select public.store_apply(pg_temp.uid(2), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_sparks','sparks_5'))));
insert into _p select 'five sparks credited once', pg_temp.balance(2,'spark')=5;
-- One spark spent (same ledger entry spend_credit writes).
insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(pg_temp.uid(2),'spark',-1,'spent','test','store-sql:spent');
select public.store_apply(pg_temp.uid(2), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_sparks','sparks_5','refunded'))));
insert into _p select 'refund removes the remaining sparks without going negative', pg_temp.balance(2,'spark')=0
 and (select status='refunded' from public.purchase_orders where store_transaction_id='rc:p_sparks')
 and (select status='refunded' from public.invoices where provider_invoice_id='rc:p_sparks');

-- 5) One-night pass ends at the next 06:00 (Madrid).
select public.store_apply(pg_temp.uid(2), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_night','one_night'))));
insert into _p select 'one-night pass until the end of the night',
 (select bool_and(ends_at=private.next_night_end(now())) from public.entitlements e join public.purchase_orders o on e.origin_ref=o.id::text
  where o.store_transaction_id='rc:p_night') and private.user_has_entitlement(pg_temp.uid(2),'undo');

-- 6) Isolation: non-testers, live data in test mode, unknown products, foreign transactions.
insert into _ctx values('r3', public.store_apply(pg_temp.uid(3), pg_temp.snap(jsonb_build_array(pg_temp.sub('sub_c','vip_monthly',true,'will_renew',now(),now()+interval '5 minutes')),'[]')));
insert into _p select 'test purchases ignored for normal accounts', (select (value->>'skipped')::int=1 from _ctx where key='r3')
 and not exists(select 1 from public.subscriptions where provider_subscription_id='rc:sub_c');
select public.store_apply(pg_temp.uid(2), pg_temp.snap(jsonb_build_array(pg_temp.sub('sub_live','com.nightlifeconnect.app.vip_monthly',true,'will_renew',now(),now()+interval '30 days','app_store','production')),'[]'));
insert into _p select 'live store data never applies before going live', not exists(select 1 from public.subscriptions where provider_subscription_id='rc:sub_live');
select public.store_apply(pg_temp.uid(2), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_unknown','not_a_product'))));
insert into _p select 'unknown products are skipped', not exists(select 1 from public.purchase_orders where store_transaction_id='rc:p_unknown');
select public.store_apply(pg_temp.uid(1), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_night','one_night'))));
insert into _p select 'a transaction stays with its owner', (select user_id=pg_temp.uid(2) from public.purchase_orders where store_transaction_id='rc:p_night')
 and not exists(select 1 from public.entitlements where user_id=pg_temp.uid(1) and key='undo' and status='active' and source='test_store' and origin_ref<>'rc:sub_a');
do $$ begin
 perform public.store_apply(pg_temp.uid(1), '{"subscriptions":"nope"}');
 insert into _p values('malformed snapshot raises', false);
exception when invalid_parameter_value then insert into _p values('malformed snapshot raises', true); end $$;

-- 7) Venue purchases need a reservation by a manager of that venue.
select public.store_apply(pg_temp.uid(1), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_sponsor_no','sponsor_featured'))));
insert into _p select 'sponsorship without reservation is not applied', not exists(select 1 from public.purchase_orders where store_transaction_id='rc:p_sponsor_no');
set local role authenticated; select pg_temp.as_user(1);
insert into _p select 'only managers reserve a venue purchase',
 pg_temp.denied($q$select public.store_start_venue_order('sponsor_featured','00000000-0000-4000-8000-0000000f1e01',current_date+1)$q$);
select pg_temp.as_user(4);
insert into _ctx values('rv', public.store_start_venue_order('sponsor_featured','00000000-0000-4000-8000-0000000f1e01',current_date+1));
reset role;
insert into _p select 'reservation is a pending Test Store order', (select status='pending' and provider='test_store' and venue_id is not null
 from public.purchase_orders where id=(select (value->>'orderId')::uuid from _ctx where key='rv'))
 and (select value->>'productIdentifier'='sponsor_featured' from _ctx where key='rv');
select public.store_apply(pg_temp.uid(4), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_sponsor','sponsor_featured'))));
insert into _p select 'store purchase activates the reserved sponsorship',
 exists(select 1 from public.sponsorships s join public.purchase_orders o on o.id=s.purchase_order_id
  where o.store_transaction_id='rc:p_sponsor' and s.status='active' and s.invoice_ref='Test Store' and s.starts_on=current_date+1);
select public.store_apply(pg_temp.uid(4), pg_temp.snap('[]',jsonb_build_array(pg_temp.buy('p_sponsor','sponsor_featured','refunded'))));
insert into _p select 'store refund ends the sponsorship',
 (select s.status='ended' from public.sponsorships s join public.purchase_orders o on o.id=s.purchase_order_id where o.store_transaction_id='rc:p_sponsor');

do $$ begin
 raise exception 'STORE RESULTS % passed / % failed: %',
  (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
