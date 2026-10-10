-- Bloque 11b: Modo viaje. Flag, ventaja, validación, ciudad efectiva en el swipe (quien
-- viaja ve y aparece en el destino), Foco en la ciudad del viaje, exportación y privilegios.
-- One transaction that always ends in an error (= rollback).
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000f2'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009995'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,4) i;
-- 1 travels (Pass), 2 has no Pass, 3 lives in Barcelona, 4 lives in Madrid.
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test,city)
select ('00000000-0000-4000-8000-00000000f2'||lpad(i::text,2,'0'))::uuid,'Travel SQL '||i,'1996-01-01','woman',now(),true,
 case when i=3 then 'Barcelona' else 'Madrid' end from generate_series(1,4) i;
insert into public.user_roles(user_id,role) select id,'tester' from public.profiles where name like 'Travel SQL %';
insert into public.verification_status(user_id,age_verified,age_mode) select id,true,'sandbox' from public.profiles where name like 'Travel SQL %';
insert into public.user_preferences(user_id,interested_in,age_min,age_max)
select id,array['women','men','non_binary'],18,60 from public.profiles where name like 'Travel SQL %';
insert into public.consent_records(user_id,kind,consent_key,granted,method)
select id,'consent','orientation',true,'signature' from public.profiles where name like 'Travel SQL %';
update public.app_settings set value='sandbox' where key='verification_mode';
update public.app_settings set value='test' where key='payments_mode';
update public.app_settings set value='on' where key='premium_enabled';
update public.app_settings set value='off' where key='travel_mode_enabled';
insert into public.entitlements(user_id,key,source,mode,origin_ref)
values('00000000-0000-4000-8000-00000000f201','travel_mode','tester','test','travel-sql');
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _p,_ctx to authenticated;
create function pg_temp.uid(n int) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000f2'||lpad(n::text,2,'0'))::uuid $$;
create function pg_temp.as_user(n int) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',pg_temp.uid(n),'role','authenticated','aal','aal1')::text, true),
  set_config('request.headers', json_build_object('x-real-ip','10.12.0.'||n)::text, true) $$;
create function pg_temp.sees(viewer int, other int) returns boolean language sql as $$
 select exists(select 1 from jsonb_array_elements(public.matching_candidates()) c where (c->'profile'->>'id')::uuid=pg_temp.uid(other)) $$;

-- 1) Privileges.
insert into _p values
 ('anon cannot use travel mode', not has_function_privilege('anon','public.travel_set(text,integer)','execute')
   and not has_function_privilege('anon','public.travel_state()','execute')),
 ('effective city is server-only', not has_function_privilege('authenticated','private.effective_city(uuid)','execute')),
 ('travel plans are not readable directly', not has_table_privilege('authenticated','private.travel_plans','select'));

-- 2) Flag off, then no Pass, then validation.
set local role authenticated; select pg_temp.as_user(1);
insert into _p select 'closed while the flag is off', public.travel_set('Barcelona',7)->>'error'='disabled';
reset role; update public.app_settings set value='on' where key='travel_mode_enabled';
set local role authenticated; select pg_temp.as_user(2);
insert into _p select 'requires the travel_mode benefit', public.travel_set('Barcelona',7)->>'error'='premium_required';
select pg_temp.as_user(1);
insert into _p select 'only launch cities and up to 30 days', public.travel_set('Paris',7)->>'error'='invalid'
 and public.travel_set('Barcelona',31)->>'error'='invalid' and public.travel_set('Barcelona',0)->>'error'='invalid';
insert into _p select 'not to the home city', public.travel_set('Madrid',3)->>'error'='same_city';
insert into _ctx values('set', public.travel_set('Barcelona',7));
insert into _p select 'travel active in Barcelona', (select value->>'city'='Barcelona' and (value->>'active')::boolean
 and value->>'homeCity'='Madrid' from _ctx where key='set');

-- 3) Swipe uses the effective city on both sides.
insert into _p select 'traveller sees people in the destination', pg_temp.sees(1,3) and not pg_temp.sees(1,4);
select pg_temp.as_user(3);
insert into _p select 'traveller appears in the destination deck', pg_temp.sees(3,1);
select pg_temp.as_user(4);
insert into _p select 'traveller leaves the home deck while travelling', not pg_temp.sees(4,1);

-- 4) Spotlight goes to the travel city.
reset role;
insert into public.credit_ledger(user_id,kind,delta,reason,mode,origin_ref) values(pg_temp.uid(1),'spotlight',1,'purchase','test','travel-sql:initial');
set local role authenticated; select pg_temp.as_user(1);
select public.premium_spotlight(null);
reset role;
insert into _p select 'spotlight lands in the travel city', exists(select 1 from private.social_spotlights where user_id=pg_temp.uid(1) and city='Barcelona');

-- 5) Export includes the plan (personal data).
set local role authenticated; select pg_temp.as_user(1);
insert into _p select 'export includes the travel plan', public.export_my_data()->'travel_plan'->>'city'='Barcelona';

-- 6) Switching the flag off or losing the benefit restores the home city.
reset role; update public.app_settings set value='off' where key='travel_mode_enabled';
set local role authenticated; select pg_temp.as_user(1);
insert into _p select 'flag off restores the home deck', pg_temp.sees(1,4) and not pg_temp.sees(1,3);
reset role; update public.app_settings set value='on' where key='travel_mode_enabled';
update public.entitlements set status='revoked' where origin_ref='travel-sql';
set local role authenticated; select pg_temp.as_user(1);
insert into _p select 'losing the Pass ends travel', not (public.travel_state()->>'active')::boolean and pg_temp.sees(1,4);

-- 7) Clearing removes the plan.
insert into _p select 'clear removes the plan', public.travel_clear()->>'city' is null;
reset role;
insert into _p select 'no plan rows left', not exists(select 1 from private.travel_plans where user_id=pg_temp.uid(1));

do $$ begin
 raise exception 'TRAVEL RESULTS % passed / % failed: %',
  (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
