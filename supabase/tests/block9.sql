-- Transactional acceptance/security suite. Final exception deliberately rolls back.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000a9'||lpad(i::text,2,'0'))::uuid,
'00000000-0000-0000-0000-000000000000','authenticated','authenticated','346009991'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,9)i;
insert into profiles(id,name,birthdate,gender,onboarded_at,is_test,city)
select ('00000000-0000-4000-8000-00000000a9'||lpad(i::text,2,'0'))::uuid,'Block9 SQL '||i,'1996-01-01','man',now(),i<>7,'B9 Test' from generate_series(1,9)i;
insert into verification_status(user_id,age_verified,age_mode)
select id,true,case when is_test then 'sandbox' else 'live' end from profiles where name like 'Block9 SQL %';
insert into user_roles(user_id,role) select id,'tester' from profiles where name like 'Block9 SQL %' and is_test;
insert into user_roles(user_id,role) select id,'admin' from profiles where name in('Block9 SQL 8','Block9 SQL 9');
insert into consent_records(user_id,kind,consent_key,granted,method)
select id,'consent','marketing',true,'signature' from profiles where name like 'Block9 SQL %';
insert into venues(id,name,type,address,city,location,is_test) values
('00000000-0000-4000-8000-0000000a9901','Block9 SQL venue','club','Test','B9 Test',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,true);
update app_settings set value='test' where key='payments_mode';
update app_settings set value='testers' where key='payments_audience';
update app_settings set value='on' where key in('test_tools_enabled','premium_enabled');
update app_settings set value='off' where key='flash_alcohol_allowed';
create temp table _b9_results(test text primary key,ok bool not null);
create temp table _b9_ctx(key text primary key,value jsonb);
grant all on _b9_results,_b9_ctx to authenticated,anon;
create function pg_temp.denied(q text) returns bool language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or no_data_found or invalid_parameter_value or program_limit_exceeded or unique_violation then return true; end $$;
insert into _b9_results values
('client cannot fulfill payments',not has_function_privilege('authenticated','public.billing_apply(jsonb)','execute')),
('anonymous cannot start checkout',not has_function_privilege('anon','public.billing_start_order(text)','execute')),
('client cannot forge orders',not has_table_privilege('authenticated','public.purchase_orders','insert')),
('client cannot forge customer mapping',not has_table_privilege('authenticated','private.billing_customers','select')),
('client cannot forge credits',not has_table_privilege('authenticated','public.credit_ledger','insert')),
('client cannot forge reports moderation',not has_table_privilege('authenticated','public.reports','update')),
('contacts direct insert revoked',not has_table_privilege('authenticated','public.emergency_contacts','insert')),
('worker requires service role',not has_function_privilege('authenticated','public.claim_billing_work(text)','execute')),
('legal evidence closed',not has_table_privilege('authenticated','private.erasure_evidence','select'));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a901","role":"authenticated","aal":"aal1"}',true);
insert into _b9_ctx values('vip',public.simulate_billing('vip_monthly'));
insert into _b9_results select 'VIP benefits granted',public.has_entitlement('see_likes');
insert into _b9_results select 'VIP credit quantities',value->'credits'='{"spark":3,"spotlight":1,"paid_dm":2}'::jsonb from _b9_ctx where key='vip';
insert into _b9_results select 'cannot buy duplicate active subscription',pg_temp.denied($q$select public.billing_start_order('pass_monthly')$q$);
insert into _b9_results select 'cancel keeps benefits',public.simulate_billing('vip_monthly','cancel')->'subscription'->>'status'='cancel_at_period_end' and public.has_entitlement('see_likes');
insert into _b9_results select 'resume removes cancellation',public.simulate_billing('vip_monthly','resume')->'subscription'->>'status'='active';
insert into _b9_ctx values('withdrawn',public.simulate_billing('vip_monthly','withdraw'));
insert into _b9_results select 'withdrawal revokes benefits',not public.has_entitlement('see_likes');
insert into _b9_results select 'withdrawal reverses credits',value->'credits'='{"spark":0,"spotlight":0,"paid_dm":0}'::jsonb from _b9_ctx where key='withdrawn';
insert into _b9_results select 'refund persisted',value->'invoices'->0->>'status'='refunded' from _b9_ctx where key='withdrawn';
insert into _b9_ctx values('night',public.simulate_billing('one_night'));
insert into _b9_results select 'one night has expiry',value->>'oneNightUntil' is not null from _b9_ctx where key='night';
reset role;
insert into _b9_results select 'next night DST calendar',private.next_night_end('2026-10-24T23:00:00Z')='2026-10-25T05:00:00Z';
set local role authenticated;
insert into _b9_results select 'SOS saves atomically',jsonb_array_length(public.save_emergency_contacts('[{"name":"Test","phone":"+34600000100"}]'))=1;
insert into _b9_results select 'SOS cap rejects 4',pg_temp.denied($q$select public.save_emergency_contacts('[{"name":"A","phone":"+34600000101"},{"name":"B","phone":"+34600000102"},{"name":"C","phone":"+34600000103"},{"name":"D","phone":"+34600000104"}]')$q$);
insert into _b9_results select 'failed SOS leaves prior rows',(select count(*) from emergency_contacts)=1;
insert into _b9_ctx values('export',public.export_my_data());
insert into _b9_results select 'complete export includes ledger social and requests',value ?& array['messages','matches','reports','purchase_orders','credit_ledger','data_requests','billing_notices','consent_records'] from _b9_ctx where key='export';
insert into _b9_ctx values('right',to_jsonb(public.request_data_right('restrict')));
insert into _b9_results select 'data right one month',due_at-created_at>interval '27 days' from data_requests where id=(select (value#>>'{}')::uuid from _b9_ctx where key='right');
insert into _b9_results select 'non-manager cannot edit venue',pg_temp.denied($q$select public.venue_edit('00000000-0000-4000-8000-0000000a9901','{"description":"x"}')$q$);
insert into _b9_ctx values('claim',public.venue_claim('00000000-0000-4000-8000-0000000a9901','Evidence for test venue ownership'));
insert into _b9_results select 'claim awaits human approval',value->>'claimStatus'='pending' from _b9_ctx where key='claim';
insert into _b9_results select 'duplicate claim explicit',public.venue_claim('00000000-0000-4000-8000-0000000a9901','Evidence for test venue ownership')->>'error'='already_claimed';
insert into _b9_results select 'admin role needed',pg_temp.denied($q$select public.admin_case_list('reports')$q$);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a907","role":"authenticated"}',true);
insert into _b9_results select 'normal user cannot simulate',pg_temp.denied($q$select public.simulate_billing('vip_monthly')$q$);
insert into _b9_results select 'normal user cannot use test checkout',pg_temp.denied($q$select public.billing_start_order('vip_monthly')$q$);
insert into _b9_results select 'normal user cannot read fixture orders',(select count(*) from purchase_orders)=0;
reset role;
insert into reports(reporter_id,target_user_id,reason) select
('00000000-0000-4000-8000-00000000a9'||lpad(i::text,2,'0'))::uuid,'00000000-0000-4000-8000-00000000a905','harassment' from generate_series(1,3)i;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a908","role":"authenticated","aal":"aal1"}',true);
insert into _b9_results select 'admin MFA required',pg_temp.denied($q$select public.admin_case_list('reports')$q$);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a908","role":"authenticated","aal":"aal2"}',true);
do $$declare r uuid; begin for r in select id from reports where target_user_id='00000000-0000-4000-8000-00000000a905' loop perform public.admin_case_action('reports',r,'warn','Validated human report'); end loop; end $$;
insert into _b9_results select 'three distinct validated reports suspend',(select suspended from profiles where id='00000000-0000-4000-8000-00000000a905');
insert into _b9_results select 'admin real dashboard counters',public.admin_dashboard()->>'pendingClaims'='1';
select public.admin_case_action('claims',(select id from venue_claims where user_id='00000000-0000-4000-8000-00000000a901'),'approve','Ownership checked');
insert into _b9_results select 'claim approval assigns manager',(select count(*) from venue_managers where user_id='00000000-0000-4000-8000-00000000a901')=1;
insert into _b9_ctx values('promo',to_jsonb(public.admin_promo('pass_monthly',7,1)));
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a905","role":"authenticated"}',true);
insert into _b9_results select 'suspension blocks social actions',pg_temp.denied('select public.matching_candidates()');
insert into _b9_ctx select 'appeal',public.moderation_appeal((select (value->>'id')::uuid from jsonb_array_elements(public.moderation_decisions()) where value->>'action'='suspension' limit 1),'Please review this suspension independently.');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a908","role":"authenticated","aal":"aal2"}',true);
insert into _b9_results select 'original reviewer cannot decide appeal',pg_temp.denied(format('select public.admin_case_action(%L,%L,%L,%L)','appeals',(select id from appeals where user_id='00000000-0000-4000-8000-00000000a905'),'accept','Independent review accepted'));
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a909","role":"authenticated","aal":"aal2"}',true);
select public.admin_case_action('appeals',(select id from appeals where user_id='00000000-0000-4000-8000-00000000a905'),'accept','Independent review accepted');
insert into _b9_results select 'successful appeal restores account',not suspended from profiles where id='00000000-0000-4000-8000-00000000a905';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a901","role":"authenticated"}',true);
insert into _b9_results select 'promo redemption atomic',public.premium_redeem((select value#>>'{}' from _b9_ctx where key='promo'))->>'productCode'='pass_monthly';
insert into _b9_results select 'promo duplicate prevented',public.premium_redeem((select value#>>'{}' from _b9_ctx where key='promo'))->>'error'='used';
insert into _b9_results select 'manager edit persisted',public.venue_edit('00000000-0000-4000-8000-0000000a9901','{"description":"Test description","hours":"22:00-06:00","price":2}')->>'description'='Test description';
insert into _b9_results select 'small venue stats threshold',(public.venue_stats('00000000-0000-4000-8000-0000000a9901')->>'checkInsWeek')::int=0;
select public.venue_sponsorship('00000000-0000-4000-8000-0000000a9901','featured',current_date,current_date+10);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a908","role":"authenticated","aal":"aal2"}',true);
insert into _b9_results select 'activation requires manual invoice',pg_temp.denied(format('select public.admin_case_action(%L,%L,%L,%L)','sponsorships',(select id from sponsorships where venue_id='00000000-0000-4000-8000-0000000a9901'),'activate',''));
select public.admin_case_action('sponsorships',(select id from sponsorships where venue_id='00000000-0000-4000-8000-0000000a9901'),'activate','INV-B9-TEST');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a901","role":"authenticated"}',true);
select public.venue_flash_alert('00000000-0000-4000-8000-0000000a9901',jsonb_build_object('title','Test alert','body','In-app test','startsAt',now(),'endsAt',now()+interval '1 hour'));
insert into _b9_results select 'consented verified audience sees Flash',jsonb_array_length(public.visible_flash_alerts('00000000-0000-4000-8000-0000000a9901'))=1;
insert into _b9_results select 'alcohol closed by default',pg_temp.denied(format('select public.venue_flash_alert(%L,%L)','00000000-0000-4000-8000-0000000a9901',jsonb_build_object('title','Alcohol test','body','Test','containsAlcohol',true,'startsAt',now(),'endsAt',now()+interval '1 hour')));
reset role;
-- Fulfillment is service-only, idempotent and cannot restore refunded benefits.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a902","role":"authenticated"}',true);
set local role authenticated;
insert into _b9_ctx values('creditOrder',public.billing_start_order('sparks_5'));
reset role;
insert into _b9_ctx select 'creditEvent',jsonb_build_object('eventId','evt_b9_replay','type','checkout','mode','test','simulated',true,'orderId',value->>'id','amount',499,'currency','eur','paymentIntentId','pi_b9_replay','sessionId','cs_b9_replay') from _b9_ctx where key='creditOrder';
select private.billing_apply(value) from _b9_ctx where key='creditEvent';
insert into _b9_results select 'identical webhook is duplicate',private.billing_apply(value)->>'duplicate'='true' from _b9_ctx where key='creditEvent';
select private.billing_apply(value||'{"eventId":"evt_b9_another"}') from _b9_ctx where key='creditEvent';
insert into _b9_results select 'different events grant credits only once',sum(delta)=5 from public.credit_ledger where user_id='00000000-0000-4000-8000-00000000a902' and kind='spark';
select private.billing_apply('{"eventId":"evt_b9_refund","type":"refund","mode":"test","paymentIntentId":"pi_b9_replay","refundedAmount":499}');
insert into _b9_results select 'full refund reverses purchased credits',sum(delta)=0 from public.credit_ledger where user_id='00000000-0000-4000-8000-00000000a902' and kind='spark';
insert into _b9_results select 'late checkout cannot restore refunded purchase',pg_temp.denied(format('select private.billing_apply(%L)',value||'{"eventId":"evt_b9_late"}')) from _b9_ctx where key='creditEvent';
insert into _b9_results select 'wrong mode rejects fulfillment',pg_temp.denied(format('select private.billing_apply(%L)',value||'{"eventId":"evt_b9_mode","mode":"live"}')) from _b9_ctx where key='creditEvent';
insert into _b9_results select 'retention inaccessible to client',not has_function_privilege('authenticated','private.billing_maintenance()','execute');
set local role authenticated;
insert into _b9_results select 'paid DM flag closed',public.premium_paid_dm('00000000-0000-4000-8000-00000000a903','Hello')->>'error'='disabled';
insert into _b9_results select 'sponsorship labels come from active invoices',public.visible_sponsors() ? '00000000-0000-4000-8000-0000000a9901';
reset role;
update app_settings set value='on' where key='paid_dm_enabled';
insert into user_preferences(user_id,interested_in,age_min,age_max) values('00000000-0000-4000-8000-00000000a902',array['men'],18,99),('00000000-0000-4000-8000-00000000a903',array['men'],18,99);
insert into consent_records(user_id,kind,consent_key,granted,method) values('00000000-0000-4000-8000-00000000a902','consent','orientation',true,'signature'),('00000000-0000-4000-8000-00000000a903','consent','orientation',true,'signature');
set local role authenticated;
insert into _b9_results select 'eligible paid DM requires credit',public.premium_paid_dm('00000000-0000-4000-8000-00000000a903','Hello')->>'error'='no_credits';
reset role;
insert into credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values('00000000-0000-4000-8000-00000000a902','paid_dm',1,'purchase','test','b9-dm-fixture');
update profiles set traffic_light='red' where id='00000000-0000-4000-8000-00000000a903';
set local role authenticated;
insert into _b9_results select 'red traffic light prevents paid contact',public.premium_paid_dm('00000000-0000-4000-8000-00000000a903','Hello')->>'error'='red_light';
reset role;
update profiles set traffic_light='green' where id='00000000-0000-4000-8000-00000000a903';
set local role authenticated;
insert into _b9_results select 'paid contact creates persisted conversation',public.premium_paid_dm('00000000-0000-4000-8000-00000000a903','Hello')->>'sent'='true';
insert into _b9_results select 'paid contact labelled without claiming mutual likes',public.matching_matches()->0->>'contactKind'='paid_dm';
reset role;
insert into _b9_results select 'paid contact deducts exactly one credit',sum(delta)=0 from credit_ledger where user_id='00000000-0000-4000-8000-00000000a902' and kind='paid_dm';
insert into _b9_results select 'retention job inaccessible to users',not has_function_privilege('authenticated','private.block9_retention()','execute');
insert into admin_audit_log(action,detail,created_at) values('b9.retention.fixture','Old technical audit',now()-interval '91 days');
select private.block9_retention();
insert into _b9_results select 'retention deletes expired technical evidence',not exists(select 1 from admin_audit_log where action='b9.retention.fixture');
insert into email_outbox(user_id,template) values('00000000-0000-4000-8000-00000000a902','signed_documents');
insert into _b9_ctx values('docLease',private.claim_signed_email('00000000-0000-4000-8000-00000000a902'));
insert into _b9_results select 'document lease claimed once',jsonb_array_length(value)=1 from _b9_ctx where key='docLease';
insert into _b9_results select 'second worker cannot claim leased document',private.claim_signed_email('00000000-0000-4000-8000-00000000a902')='[]';
select private.finish_signed_email((value->0->>'id')::uuid,gen_random_uuid(),'sent') from _b9_ctx where key='docLease';
insert into _b9_results select 'wrong lease cannot mark delivered',status='sending' from email_outbox where user_id='00000000-0000-4000-8000-00000000a902';
select private.finish_signed_email((value->0->>'id')::uuid,(value->0->>'lease_token')::uuid,'retry') from _b9_ctx where key='docLease';
insert into _b9_results select 'email retry uses backoff',status='pending' and next_attempt_at>now() and attempts=1 from email_outbox where user_id='00000000-0000-4000-8000-00000000a902';
insert into _b9_results select 'email leases service only',not has_function_privilege('authenticated','public.claim_signed_email(uuid)','execute');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a902","role":"authenticated"}',true);
select public.simulate_billing('vip_monthly');
reset role;
update subscriptions set started_at=now()-interval '8 days' where user_id='00000000-0000-4000-8000-00000000a902';
select private.billing_maintenance();
select private.billing_maintenance();
insert into _b9_results select 'cron grants one current weekly VIP bundle',sum(delta)=6 from credit_ledger where user_id='00000000-0000-4000-8000-00000000a902' and kind='spark';
insert into entitlements(user_id,key,source,starts_at,ends_at) values('00000000-0000-4000-8000-00000000a903','undo','promo',now()-interval '2 minutes',now()-interval '1 minute');
select private.billing_maintenance();
insert into _b9_results select 'cron expires past benefits',status='expired' from entitlements where user_id='00000000-0000-4000-8000-00000000a903' and key='undo';
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
insert into _b9_results select 'DSA available without account',public.submit_illegal_content_notice('{"url":"https://nightlife-connect-beige.vercel.app/events/fixture","email":"notice@nightlife.test","reason":"fraud","explanation":"This is a transactional DSA test notice.","goodFaith":true}') like 'DSA-%';
insert into _b9_results select 'DSA requires good faith statement',pg_temp.denied($q$select public.submit_illegal_content_notice('{"url":"https://nightlife-connect-beige.vercel.app/events/fixture","email":"notice@nightlife.test","reason":"fraud","explanation":"This is a transactional DSA test notice.","goodFaith":false}')$q$);
insert into _b9_results select 'DSA rejects external content locator',pg_temp.denied($q$select public.submit_illegal_content_notice('{"url":"https://evil.example/fixture","email":"notice@nightlife.test","reason":"fraud","explanation":"This is a transactional DSA test notice.","goodFaith":true}')$q$);
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000a901","role":"authenticated"}',true);
reset role;
update app_settings set value='none' where key='payments_audience';
set local role authenticated;
insert into _b9_results select 'audience none denies tester checkout',pg_temp.denied($q$select public.billing_start_order('sparks_5')$q$);
insert into _b9_results select 'rollback respects existing promo benefits',public.has_entitlement('unlimited_likes');
reset role;
do $$declare summary jsonb; begin
 select jsonb_build_object('passed',count(*) filter(where ok),'total',count(*),'failed',coalesce(jsonb_agg(test) filter(where not ok),'[]')) into summary from _b9_results;
 raise exception 'BLOCK9_RESULTS %',summary;
end $$;
rollback;
