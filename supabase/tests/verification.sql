-- Run after the block 6 migration inside a disposable transaction; always rollback.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at) values
('00000000-0000-4000-8000-000000000091','00000000-0000-0000-0000-000000000000','authenticated','authenticated','34600111991',now(),now(),now()),
('00000000-0000-4000-8000-000000000092','00000000-0000-0000-0000-000000000000','authenticated','authenticated','34600111992',now(),now(),now());
insert into public.profiles(id,name,birthdate,gender,onboarded_at) values
('00000000-0000-4000-8000-000000000091','Fixture','1990-01-01','man',now()),
('00000000-0000-4000-8000-000000000092','Tester','1990-01-01','woman',now());
insert into public.user_roles(user_id,role) values
('00000000-0000-4000-8000-000000000091','user'),('00000000-0000-4000-8000-000000000092','tester');
update public.app_settings set value = 'sandbox' where key = 'verification_mode';
update public.app_settings set value = 'on' where key = 'test_tools_enabled';
update public.app_settings set value = 'simulator' where key = 'verification_provider';
insert into public.likes(from_user,to_user) values('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092');
insert into public.matches(id,user_a,user_b) values('00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092');
insert into public.messages(match_id,sender_id,text) values('00000000-0000-4000-8000-000000000095','00000000-0000-4000-8000-000000000092','fixture');
create temp table _verification_results(test text,ok boolean not null) on commit drop;
grant all on _verification_results to authenticated,service_role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000091","role":"authenticated"}',true);
insert into _verification_results select 'unverified cannot read own likes',count(*) = 0 from public.likes;
insert into _verification_results select 'unverified cannot read own matches',count(*) = 0 from public.matches;
insert into _verification_results select 'unverified cannot read own messages',count(*) = 0 from public.messages;
do $$ begin
  begin perform public.begin_verification('age'); insert into _verification_results values('normal user cannot simulate',false);
  exception when insufficient_privilege then insert into _verification_results values('normal user cannot simulate',true); end;
  begin update public.verification_status set age_verified = true;
  insert into _verification_results values('client cannot assign verification',false);
  exception when insufficient_privilege then insert into _verification_results values('client cannot assign verification',true); end;
  begin perform public.complete_provider_verification('veriff','00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000096','verified',true,true,now());
  insert into _verification_results values('client cannot complete provider',false);
  exception when insufficient_privilege then insert into _verification_results values('client cannot complete provider',true); end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
insert into _verification_results select 'tester role is not age proof',count(*) = 0 from public.search_public_profiles(50);
select public.begin_verification('age');
select public.simulate_verification_result('age','approved');
insert into _verification_results select 'sandbox proof persists',public.verification_snapshot()->'age'->>'state' = 'verified';
insert into _verification_results select 'verified can read own match',count(*) = 1 from public.matches;
insert into _verification_results select 'verified can read own message',count(*) = 1 from public.messages;
do $$ begin
  begin perform public.begin_verification('photo'); insert into _verification_results values('optional requires consent',false);
  exception when insufficient_privilege then insert into _verification_results values('optional requires consent',true); end;
end $$;
select public.begin_verification('photo','facial_estimation',true);
select public.simulate_verification_result('photo','approved');
reset role;
update public.profiles set photos = array['fixture-changed'] where id = '00000000-0000-4000-8000-000000000092';
insert into _verification_results select 'photo change revokes badge',not photo_verified from public.verification_status where user_id = '00000000-0000-4000-8000-000000000092';
update public.verification_status set age_verified = false, identity_verified = false where user_id = '00000000-0000-4000-8000-000000000092';
update public.app_settings set value = 'veriff' where key = 'verification_provider';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
insert into _verification_results select 'veriff forces document',(public.begin_verification('age','facial_estimation')->>'method') = 'document';
insert into _verification_results select 'veriff stays sandbox',(select mode from public.verification_sessions where user_id = '00000000-0000-4000-8000-000000000092' and level = 'age' and active) = 'sandbox';
reset role;
create temp table _veriff_session as select id from public.verification_sessions where user_id = '00000000-0000-4000-8000-000000000092' and level = 'age' and active;
grant select on _veriff_session to service_role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.attach_verification_provider((select id from _veriff_session),'00000000-0000-4000-8000-000000000093');
insert into _verification_results select 'veriff result accepted',public.complete_provider_verification('veriff','00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000093',(select id from _veriff_session),'verified',true,true,now(),'document',18);
insert into _verification_results select 'veriff duplicate idempotent',public.complete_provider_verification('veriff','00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000093',(select id from _veriff_session),'verified',true,true,now(),'document',18);
reset role;
insert into _verification_results select 'veriff grants identity too',identity_verified and identity_mode = 'sandbox' from public.verification_status where user_id = '00000000-0000-4000-8000-000000000092';
insert into _verification_results select 'one minimal event persisted',count(*) = 1 from private.verification_notifications;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
insert into _verification_results select 'veriff sandbox proof authorizes',public.verification_snapshot()->'age'->>'state' = 'verified';
reset role;
update public.app_settings set value = 'live' where key = 'verification_mode';
update public.app_settings set value = 'yoti' where key = 'verification_provider';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
insert into _verification_results select 'sandbox proof invalid in live',public.verification_snapshot()->'age'->>'state' <> 'verified';
select public.begin_verification('age','document');
insert into _verification_results select 'IDOR sessions hidden',count(*) = 0 from public.verification_sessions where user_id = '00000000-0000-4000-8000-000000000091';
reset role;
create temp table _fixture_session as select id from public.verification_sessions where user_id = '00000000-0000-4000-8000-000000000092' and level = 'age' and active and provider = 'yoti';
grant select on _fixture_session to service_role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.attach_verification_provider((select id from _fixture_session),'00000000-0000-4000-8000-000000000097');
insert into _verification_results select 'wrong threshold rejected',not public.complete_provider_verification('yoti','00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000097',(select id from _fixture_session),'verified',true,false,now(),'document',21);
insert into _verification_results select 'document cannot downgrade to face',not public.complete_provider_verification('yoti','00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000097',(select id from _fixture_session),'verified',true,false,now(),'facial_estimation',18);
insert into _verification_results select 'provider result accepted',public.complete_provider_verification('yoti','00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000097',(select id from _fixture_session),'verified',true,false,now(),'document',18);
insert into _verification_results select 'yoti duplicate idempotent',public.complete_provider_verification('yoti','00000000-0000-4000-8000-000000000098','00000000-0000-4000-8000-000000000097',(select id from _fixture_session),'verified',true,false,now(),'document',18);
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
insert into _verification_results select 'live proof authorizes',public.verification_snapshot()->'age'->>'state' = 'verified';
reset role;
insert into public.reports(reporter_id,target_user_id,reason) values('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000092','possible_minor');
insert into _verification_results select 'minor report suspends and revokes',p.suspended and not v.age_verified and v.reverification_required from public.profiles p join public.verification_status v on v.user_id=p.id where p.id='00000000-0000-4000-8000-000000000092';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000092","role":"authenticated"}',true);
insert into _verification_results select 'reverification forces document',(public.begin_verification('age','facial_estimation')->>'method') = 'document';
reset role;
update public.profiles set banned = true where id = '00000000-0000-4000-8000-000000000092';
insert into _verification_results select 'ban revokes age access',not private.is_age_verified('00000000-0000-4000-8000-000000000092');
insert into _verification_results select 'ban stores keyed phone hash',exists(select 1 from public.ban_identifiers where kind='phone' and hmac=private.hmac_hex(private.normalize_phone('34600111992')));
do $$ begin
  if exists(select 1 from _verification_results where not ok) then
    raise exception 'verification failed: %',(select string_agg(test,', ') from _verification_results where not ok);
  end if;
end $$;
select * from _verification_results;
rollback;
