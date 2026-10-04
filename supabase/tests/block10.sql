-- Transactional abuse regressions; final exception intentionally rolls back fixtures.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,email,email_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000b10'||i)::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','44999000010'||i,case when i<>3 then now() end,'block10-'||i||'@nightlife.test',now(),now(),now() from generate_series(1,4)i;
create temp table _b10_results(test text primary key,ok boolean not null);
create temp table _b10_payload as select jsonb_build_object('name','Block10 fixture','birthdate','1995-01-01','gender','man','signed',(select jsonb_agg(jsonb_build_object('slug',slug,'version',private.current_document_version(slug))) from unnest(array['terms','community','privacy']) slug),'photos',jsonb_build_array('00000000-0000-4000-8000-00000000b101/00000000-0000-4000-8000-00000000b111.png','00000000-0000-4000-8000-00000000b101/00000000-0000-4000-8000-00000000b112.png')) as p;
grant all on _b10_results,_b10_payload to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when insufficient_privilege or invalid_parameter_value then return true; end $$;
insert into public.ban_identifiers(kind,hmac,reason) values('phone',private.hmac_hex('phone:+449990000101'),'block10_fixture'),('device',private.hmac_hex('device:block10-banned-device'),'block10_fixture');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b101","role":"authenticated","aal":"aal1"}',true);
insert into _b10_results select 'banned phone cannot bypass precheck',pg_temp.denied($q$select public.complete_onboarding(p) from _b10_payload$q$);
insert into _b10_results select 'phone denial is atomic',not exists(select 1 from public.profiles where id=auth.uid());
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b102","role":"authenticated","aal":"aal1"}',true);
update _b10_payload set p=jsonb_set(p,'{photos}',replace((p->'photos')::text,'b101/','b102/')::jsonb);
insert into _b10_results select 'banned device cannot bypass precheck',pg_temp.denied($q$select public.complete_onboarding(p||'{"deviceId":"block10-banned-device"}') from _b10_payload$q$);
select public.complete_onboarding(p) from _b10_payload;
insert into _b10_results select 'verified unbanned phone completes',exists(select 1 from public.profiles where id=auth.uid() and onboarded_at is not null);
insert into _b10_results select 'flat photo path accepted',private.allow_profile_photo_upload('00000000-0000-4000-8000-00000000b102/00000000-0000-4000-8000-00000000b111.png');
insert into _b10_results select 'nested photo path denied',not private.allow_profile_photo_upload('00000000-0000-4000-8000-00000000b102/nested/photo.png');
insert into _b10_results select 'cross UID upload denied',not private.allow_profile_photo_upload('00000000-0000-4000-8000-00000000b101/00000000-0000-4000-8000-00000000b111.png');
select public.sign_documents(array['terms','terms']);
insert into _b10_results select 'signing current evidence idempotent',(select count(*) from public.consent_records where user_id=auth.uid() and document_slug='terms')=1;
insert into _b10_results select 'large signature array denied',pg_temp.denied($q$select public.sign_documents(array_fill('terms'::text,array[1000]))$q$);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b103","role":"authenticated","aal":"aal1"}',true);
insert into _b10_results select 'unconfirmed phone cannot onboard',pg_temp.denied($q$select public.complete_onboarding(p) from _b10_payload$q$);
reset role;
insert into storage.objects(bucket_id,name) select 'profile-photos','00000000-0000-4000-8000-00000000b102/'||gen_random_uuid()||'.png' from generate_series(1,10);
insert into user_roles(user_id,role) values('00000000-0000-4000-8000-00000000b102','admin');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b102","role":"authenticated","aal":"aal2"}',true);
insert into _b10_results select 'eleventh photo denied',not private.allow_profile_photo_upload('00000000-0000-4000-8000-00000000b102/00000000-0000-4000-8000-00000000b199.png');
insert into _b10_results select 'active admin admitted',private.is_admin();
reset role;
update profiles set suspended=true where id='00000000-0000-4000-8000-00000000b102';
set local role authenticated;
insert into _b10_results select 'suspended admin denied',not private.is_admin();
insert into _b10_results select 'suspended admin cannot change flags',pg_temp.denied($q$select public.admin_set_flag('premium_enabled','off')$q$);
reset role;
delete from private.document_delivery_limits; -- rolled back, no provider calls.
insert into _b10_results select 'three email attempts allowed',private.reserve_document_email('00000000-0000-4000-8000-00000000b104') and private.reserve_document_email('00000000-0000-4000-8000-00000000b104') and private.reserve_document_email('00000000-0000-4000-8000-00000000b104');
insert into _b10_results select 'fourth email attempt denied',not private.reserve_document_email('00000000-0000-4000-8000-00000000b104');
update private.document_delivery_limits set used=50 where subject='global';
insert into _b10_results select 'global email ceiling enforced',not private.reserve_document_email('00000000-0000-4000-8000-00000000b101');
insert into _b10_results select 'email reservation not client callable',not has_function_privilege('authenticated','public.reserve_document_email(uuid)','execute');
insert into _b10_results select 'private limits not client readable',not has_table_privilege('authenticated','private.document_delivery_limits','select');
do $$ declare summary jsonb; begin
 select jsonb_build_object('passed',count(*) filter(where ok),'total',count(*),'failed',coalesce(jsonb_agg(test) filter(where not ok),'[]')) into summary from _b10_results;
 raise exception 'BLOCK10_RESULTS %',summary;
end $$;
rollback;
