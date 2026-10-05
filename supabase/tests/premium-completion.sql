-- Isolated, deliberate final exception rolls back every fixture and flag change.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000c8'||lpad(i::text,2,'0'))::uuid,
'00000000-0000-0000-0000-000000000000','authenticated','authenticated','346009992'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,7)i;
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test,city)
select ('00000000-0000-4000-8000-00000000c8'||lpad(i::text,2,'0'))::uuid,'Completion SQL '||i,'1996-01-01','man',now(),true,'Completion Test' from generate_series(1,7)i;
insert into public.verification_status(user_id,age_verified,age_mode)
select id,true,'sandbox' from public.profiles where name like 'Completion SQL %';
insert into public.user_roles(user_id,role) select id,'tester' from public.profiles where name like 'Completion SQL %';
insert into public.user_preferences(user_id,interested_in,age_min,age_max)
select id,array['women','men','non_binary'],18,60 from public.profiles where name like 'Completion SQL %';
insert into public.consent_records(user_id,kind,consent_key,granted,method)
select id,'consent','orientation',true,'signature' from public.profiles where name like 'Completion SQL %';
update public.app_settings set value='sandbox' where key='verification_mode';
update public.app_settings set value='test' where key='payments_mode';
update public.app_settings set value='testers' where key='payments_audience';
update public.app_settings set value='on' where key in('test_tools_enabled','premium_enabled','paid_dm_enabled','sponsored_cards_enabled','sponsorship_self_service_enabled');
insert into public.venues(id,name,type,address,location,city,is_test,opening_hours)
select ('00000000-0000-4000-8000-0000000ce8'||lpad(i::text,2,'0'))::uuid,'Completion venue '||i,'club','Test',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Completion Test',true,
(select jsonb_agg(jsonb_build_object('day',d,'opens','00:00','closes','23:59')) from generate_series(0,6)d) from generate_series(1,5)i;
insert into public.venue_managers(venue_id,user_id) select id,'00000000-0000-4000-8000-00000000c801' from public.venues where name like 'Completion venue %';
insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values
('00000000-0000-4000-8000-00000000c801','spark',1,'fixture','test','completion:spark'),
('00000000-0000-4000-8000-00000000c803','spotlight',1,'fixture','test','completion:spotlight');
create temp table _completion_results(test text primary key,ok boolean not null);
create temp table _completion_ctx(key text primary key,value jsonb);
grant all on _completion_results,_completion_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q;return false;exception when insufficient_privilege or no_data_found or invalid_parameter_value or program_limit_exceeded or unique_violation then return true;end $$;
insert into _completion_results values
('no anonymous spending',not has_function_privilege('anon','public.premium_spark(uuid)','execute')),
('wallet helper closed',not has_function_privilege('authenticated','private.spend_credit(uuid,text,text)','execute')),
('spark identities private',not has_table_privilege('authenticated','private.social_sparks','select')),
('cannot invoke billing core',not has_function_privilege('authenticated','private.billing_apply_core(jsonb)','execute')),
('no public definer',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c801","role":"authenticated"}',true);
insert into _completion_ctx values('spark',public.premium_spark('00000000-0000-4000-8000-00000000c802'));
insert into _completion_results select 'spark performs like',not(value?'error') and (value->>'usedToday')::int=1 from _completion_ctx where key='spark';
insert into _completion_results select 'spark spends exactly one',public.premium_state()->'credits'->>'spark'='0';
insert into _completion_results select 'spark retry is idempotent',public.premium_spark('00000000-0000-4000-8000-00000000c802')->>'duplicate'='true';
insert into _completion_results select 'empty wallet refuses spend',public.premium_spark('00000000-0000-4000-8000-00000000c803')->>'error'='no_credits';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c802","role":"authenticated"}',true);
insert into _completion_results select 'anonymous spark notice',public.premium_social_state()->>'sparksUnread'='1' and not(public.premium_social_state()?'senderId');
insert into _completion_results select 'free counter keeps locked like',public.matching_likes_you()->>'count'='1' and public.matching_likes_you()->'profiles'='[]'::jsonb;
insert into _completion_results select 'notice acknowledgement persists',public.premium_sparks_seen()->>'sparksUnread'='0' and public.premium_social_state()->>'sparksUnread'='0';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c803","role":"authenticated"}',true);
insert into _completion_results select 'wrong venue does not spend',public.premium_spotlight('00000000-0000-4000-8000-0000000ce801')->>'error'='wrong_place' and public.premium_state()->'credits'->>'spotlight'='1';
insert into _completion_ctx values('spotlight',public.premium_spotlight());
insert into _completion_results select 'spotlight lasts 30 minutes',abs(extract(epoch from ((value->>'spotlightUntil')::timestamptz-now()))-1800)<1 from _completion_ctx where key='spotlight';
insert into _completion_results select 'spotlight retry does not spend twice',public.premium_spotlight()->>'error'='already_active' and public.premium_state()->'credits'->>'spotlight'='0';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c804","role":"authenticated"}',true);
insert into _completion_results select 'spotlight leads compatible deck',public.matching_candidates()->0->'profile'->>'id'='00000000-0000-4000-8000-00000000c803';
reset role;
update private.social_spotlights set ends_at=now()-interval '1 second' where user_id='00000000-0000-4000-8000-00000000c803';
insert into public.entitlements(user_id,key,source,mode,origin_ref) values
('00000000-0000-4000-8000-00000000c805','priority_likes','tester','test','completion:priority'),
('00000000-0000-4000-8000-00000000c804','see_likes','tester','test','completion:see'),
('00000000-0000-4000-8000-00000000c806','incognito','tester','test','completion:incognito');
insert into public.likes(from_user,to_user,created_at) values
('00000000-0000-4000-8000-00000000c805','00000000-0000-4000-8000-00000000c804',now()-interval '1 day'),
('00000000-0000-4000-8000-00000000c807','00000000-0000-4000-8000-00000000c804',now());
set local role authenticated;
insert into _completion_results select 'expired spotlight gone',public.matching_candidates()->0->'profile'->>'id'='00000000-0000-4000-8000-00000000c805';
insert into _completion_results select 'VIP like precedes newer ordinary like',public.matching_likes_you()->'profiles'->0->>'id'='00000000-0000-4000-8000-00000000c805';
insert into _completion_results select 'incognito denied without VIP',pg_temp.denied('select public.premium_incognito(true)');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c806","role":"authenticated"}',true);
select public.premium_incognito(true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c804","role":"authenticated"}',true);
insert into _completion_results select 'incognito hides direct profile',public.matching_person('00000000-0000-4000-8000-00000000c806') is null;
reset role;
insert into public.likes(from_user,to_user) values('00000000-0000-4000-8000-00000000c806','00000000-0000-4000-8000-00000000c804');
set local role authenticated;
insert into _completion_results select 'incognito reveals to liked person',public.matching_person('00000000-0000-4000-8000-00000000c806') is not null;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c807","role":"authenticated"}',true);
insert into _completion_results select 'non-manager cannot buy Pro',pg_temp.denied($q$select public.billing_start_venue_order('venue_pro_monthly','00000000-0000-4000-8000-0000000ce801')$q$);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000c801","role":"authenticated"}',true);
insert into _completion_results select 'basic stats withhold Pro',public.venue_stats('00000000-0000-4000-8000-0000000ce801')->>'pro'='false' and public.venue_stats('00000000-0000-4000-8000-0000000ce801')->'byHour'='[]'::jsonb;
insert into _completion_ctx values('pro',public.billing_start_venue_order('venue_pro_monthly','00000000-0000-4000-8000-0000000ce801'));
insert into _completion_results select 'Pro uses recurring checkout',value->>'kind'='subscription' and value->>'amount'='1999' from _completion_ctx where key='pro';
insert into _completion_results select 'Pro intent retry reused',public.billing_start_venue_order('venue_pro_monthly','00000000-0000-4000-8000-0000000ce801')->>'id'=(select value->>'id' from _completion_ctx where key='pro');
reset role;
select private.billing_apply(jsonb_build_object('eventId','completion:pro-paid','type','checkout','mode','test','simulated',true,'orderId',(select value->>'id' from _completion_ctx where key='pro'),'amount',1999,'currency','eur','subscriptionId','sub_completion_pro','customerId','cus_completion','paymentIntentId','pi_completion_pro','periodEnd',now()+interval '30 days'));
set local role authenticated;
insert into _completion_results select 'Pro scoped to purchased venue',public.venue_billing_state('00000000-0000-4000-8000-0000000ce801')->>'pro'='true' and public.venue_billing_state('00000000-0000-4000-8000-0000000ce802')->>'pro'='false';
insert into _completion_results select 'Pro grants no personal Pass',not public.has_entitlement('unlimited_likes') and public.premium_state()->'subscription'='null'::jsonb;
insert into _completion_results select 'Pro hides small cohorts',public.venue_stats('00000000-0000-4000-8000-0000000ce801')->>'pro'='true' and public.venue_stats('00000000-0000-4000-8000-0000000ce801')->'averageAge'='null'::jsonb;
reset role;
select private.billing_apply(jsonb_build_object('eventId','completion:pro-cancel','type','subscription','mode','test','simulated',true,'subscriptionId','sub_completion_pro','status','active','cancelAtPeriodEnd',true,'periodEnd',now()+interval '30 days'));
set local role authenticated;
insert into _completion_results select 'Pro cancellation keeps current period',public.venue_billing_state('00000000-0000-4000-8000-0000000ce801')->>'pro'='true';
reset role;
select private.billing_apply(jsonb_build_object('eventId','completion:pro-past-due','type','subscription','mode','test','simulated',true,'subscriptionId','sub_completion_pro','status','past_due','periodEnd',now()+interval '30 days'));
set local role authenticated;
insert into _completion_results select 'unpaid Pro loses access',public.venue_billing_state('00000000-0000-4000-8000-0000000ce801')->>'pro'='false';
reset role;
select private.billing_apply(jsonb_build_object('eventId','completion:pro-renewed','type','subscription','mode','test','simulated',true,'subscriptionId','sub_completion_pro','status','active','periodEnd',now()+interval '30 days'));
set local role authenticated;
insert into _completion_results select 'paid Pro restores access',public.venue_billing_state('00000000-0000-4000-8000-0000000ce801')->>'pro'='true';
insert into _completion_results select 'personal Pass can coexist',public.billing_start_order('pass_quarterly')->>'intervalCount'='3';
insert into _completion_ctx values('sponsor',public.billing_start_venue_order('sponsor_top','00000000-0000-4000-8000-0000000ce801',current_date));
reset role;
select private.billing_apply(jsonb_build_object('eventId','completion:sponsor-paid','type','checkout','mode','test','simulated',true,'orderId',(select value->>'id' from _completion_ctx where key='sponsor'),'amount',7900,'currency','eur','paymentIntentId','pi_completion_sponsor'));
insert into _completion_results select 'sponsor activates for 30 days',status='active' and ends_on-starts_on=29 and tier='top' and mode='test' from public.sponsorships where purchase_order_id=(select (value->>'id')::uuid from _completion_ctx where key='sponsor');
select private.billing_apply(jsonb_build_object('eventId','completion:sponsor-paid','type','checkout','mode','test','simulated',true,'orderId',(select value->>'id' from _completion_ctx where key='sponsor'),'amount',7900,'currency','eur','paymentIntentId','pi_completion_sponsor'));
insert into _completion_results select 'sponsor event retry unique',count(*)=1 from public.sponsorships where purchase_order_id=(select (value->>'id')::uuid from _completion_ctx where key='sponsor');
insert into public.attendance(user_id,venue_id,kind,visible,expires_at,is_test) values('00000000-0000-4000-8000-00000000c801','00000000-0000-4000-8000-0000000ce801','check_in',true,now()+interval '1 hour',true);
set local role authenticated;
insert into _completion_results select 'near open sponsored card',jsonb_array_length(public.matching_sponsored_cards())=1;
insert into _completion_results select 'Top tier is published',public.visible_sponsorships()->0->>'tier'='top';
select public.venue_flash_alert('00000000-0000-4000-8000-0000000ce801',jsonb_build_object('title','Completion notice','body','Fixture only','startsAt',now(),'endsAt',now()+interval '1 hour'));
insert into _completion_results select 'Flash requires commercial consent',public.visible_flash_alerts('00000000-0000-4000-8000-0000000ce801')='[]'::jsonb;
reset role;
insert into public.consent_records(user_id,kind,consent_key,granted,method) values('00000000-0000-4000-8000-00000000c801','consent','marketing',true,'signature');
set local role authenticated;
insert into _completion_results select 'Top Flash reaches consenting adult',jsonb_array_length(public.visible_flash_alerts('00000000-0000-4000-8000-0000000ce801'))=1;
reset role;
update public.sponsorships set tier='featured_plus' where purchase_order_id=(select (value->>'id')::uuid from _completion_ctx where key='sponsor');
set local role authenticated;
insert into _completion_results select 'Plus cannot create Top Flash',pg_temp.denied($q$select public.venue_flash_alert('00000000-0000-4000-8000-0000000ce801',jsonb_build_object('title','Completion denied','body','Fixture only','startsAt',now(),'endsAt',now()+interval '1 hour'))$q$);
reset role;
update public.sponsorships set tier='top' where purchase_order_id=(select (value->>'id')::uuid from _completion_ctx where key='sponsor');
insert into public.entitlements(user_id,key,source,mode,origin_ref) values('00000000-0000-4000-8000-00000000c801','no_sponsored_cards','tester','test','completion:noads');
set local role authenticated;
insert into _completion_results select 'Pass removes sponsored cards',public.matching_sponsored_cards()='[]'::jsonb;
select public.billing_start_venue_order('sponsor_featured','00000000-0000-4000-8000-0000000ce802',current_date);
select public.billing_start_venue_order('sponsor_featured','00000000-0000-4000-8000-0000000ce803',current_date);
insert into _completion_results select 'city capacity reserves unpaid checkout',pg_temp.denied($q$select public.billing_start_venue_order('sponsor_featured','00000000-0000-4000-8000-0000000ce804',current_date)$q$);
reset role;
select private.billing_apply('{"eventId":"completion:pro-refund","type":"refund","mode":"test","simulated":true,"paymentIntentId":"pi_completion_pro","refundedAmount":1999}');
select private.billing_apply('{"eventId":"completion:sponsor-refund","type":"refund","mode":"test","simulated":true,"paymentIntentId":"pi_completion_sponsor","refundedAmount":7900}');
set local role authenticated;
insert into _completion_results select 'refunded Pro revoked',public.venue_billing_state('00000000-0000-4000-8000-0000000ce801')->>'pro'='false';
reset role;
insert into _completion_results select 'refunded sponsor ended',status='ended' from public.sponsorships where purchase_order_id=(select (value->>'id')::uuid from _completion_ctx where key='sponsor');
insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values('00000000-0000-4000-8000-00000000c801','spark',1,'fixture','test','completion:limit-credit');
update private.social_daily_likes set used=5 where user_id='00000000-0000-4000-8000-00000000c801';
set local role authenticated;
insert into _completion_results select 'daily quota does not spend Spark',public.premium_spark('00000000-0000-4000-8000-00000000c803')->>'error'='limit_reached' and public.premium_state()->'credits'->>'spark'='1';
reset role;
update public.app_settings set value='live' where key='payments_mode';
set local role authenticated;
insert into _completion_results select 'LIVE mode never displays TEST credits',public.premium_state()->'credits'->>'spark'='0';
reset role;
do $$ declare results jsonb;begin select jsonb_build_object('total',count(*),'passed',count(*) filter(where ok),'failed',coalesce(jsonb_agg(test) filter(where not ok),'[]')) into results from _completion_results;raise exception 'COMPLETION_RESULTS %',results;end $$;
