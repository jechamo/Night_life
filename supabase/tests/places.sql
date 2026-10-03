-- Block 7 publication gate: thresholds, 150 m, is_test isolation, 24 h expiry, change-only
-- broadcast and map-load reservation. No calls to Mapbox/Google.
-- Always aborts the transaction with a result summary; owner data is untouched.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000b7'||lpad(i::text,2,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 '346009997'||lpad(i::text,2,'0'),now(),now(),now()
from generate_series(1,7) i;
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
select ('00000000-0000-4000-8000-00000000b7'||lpad(i::text,2,'0'))::uuid,'Places test '||i,
 '1996-01-01',(case when i%2=0 then 'woman' else 'man' end)::public.gender,now(),false
from generate_series(1,7) i;
insert into public.consent_records(user_id,kind,consent_key,granted,method)
values('00000000-0000-4000-8000-00000000b701','consent','precise_location',true,'toggle');
insert into public.venues(id,name,type,address,location,city,is_test) values
 ('00000000-0000-4000-8000-0000000be701','Real test venue','club','Sol 1',
  extensions.st_setsrid(extensions.st_makepoint(-3.7035,40.4169),4326)::extensions.geography,'Madrid',false),
 ('00000000-0000-4000-8000-0000000be702','Fixture venue','bar','Sol 2',
  extensions.st_setsrid(extensions.st_makepoint(-3.7036,40.4170),4326)::extensions.geography,'Madrid',true);
create temp table _results(test text primary key,ok boolean not null);
create temp table _ctx(key text primary key,value jsonb);
grant all on _results,_ctx to authenticated;

insert into _results values('anon cannot check in',not has_function_privilege('anon',
 'public.check_in(uuid,double precision,double precision,boolean)','execute'));
insert into _results values('anon cannot reserve map',not has_function_privilege('anon',
 'public.reserve_map_load()','execute'));
insert into _results values('token table private',not has_table_privilege('authenticated',
 'private.provider_access','select'));
insert into _results values('no public definer',not exists(select 1 from pg_proc p join pg_namespace n
 on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef));

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b701","role":"authenticated","aal":"aal1"}',true);
insert into _results select 'test venue hidden from users',not exists(
 select 1 from jsonb_array_elements(public.search_places(40.4169,-3.7035,null,null,null,null,null,null,null,null,null,'distance',200)) x
 where x->>'id'='00000000-0000-4000-8000-0000000be702');
do $$ begin
 begin perform public.check_in('00000000-0000-4000-8000-0000000be702',40.4170,-3.7036,false);
  insert into _results values('test venue check-in denied',false);
 exception when no_data_found then insert into _results values('test venue check-in denied',true); end;
 begin perform public.check_in('00000000-0000-4000-8000-0000000be701',40.4189,-3.7035,false);
  insert into _results values('check-in beyond 150 m denied',false);
 exception when invalid_parameter_value then
  insert into _results values('check-in beyond 150 m denied',sqlerrm='too_far'); end;
end $$;
insert into _results select 'check-in within 150 m',
 (public.check_in('00000000-0000-4000-8000-0000000be701',40.4170,-3.7035,false)
  ->'checkIn'->>'placeId')='00000000-0000-4000-8000-0000000be701';
insert into _results select 'under 5: no age, ratio or green',(x->>'people')::int between 1 and 4
 and x->'averageAge'='null'::jsonb and x->'greenPercent'='null'::jsonb and x->'ratio'='null'::jsonb
 from jsonb_array_elements(public.search_places(40.4169,-3.7035,null,null,null,null,null,null,null,null,null,'distance',200)) x
 where x->>'id'='00000000-0000-4000-8000-0000000be701';
reset role;

insert into _ctx select 'before',to_jsonb(count(*)) from realtime.messages where topic='place-stats:live';
insert into public.attendance(user_id,venue_id,kind,visible,expires_at,is_test)
select ('00000000-0000-4000-8000-00000000b7'||lpad(i::text,2,'0'))::uuid,
 '00000000-0000-4000-8000-0000000be701','check_in',false,now()+interval '1 hour',false
from generate_series(2,6) i;
select private.recalc_place_stats('00000000-0000-4000-8000-0000000be701',null);
insert into _results select 'from 5: aggregated stats',people=6 and average_age is not null
 and green_percent is not null and ratio is not null
 from public.place_stats where venue_id='00000000-0000-4000-8000-0000000be701';
insert into _ctx select 'changed',to_jsonb(count(*)) from realtime.messages where topic='place-stats:live';
select private.recalc_place_stats('00000000-0000-4000-8000-0000000be701',null);
insert into _results select 'broadcast when stats change',
 (select (value)::int from _ctx where key='changed')>(select (value)::int from _ctx where key='before');
insert into _results select 'no broadcast without change',count(*)=(select (value)::int from _ctx where key='changed')
 from realtime.messages where topic='place-stats:live';

insert into public.events(id,title,category,place_name,address,location,starts_at,ends_at,status,origin,created_at,is_test)
values
 ('00000000-0000-4000-8000-0000000ee701','Old unconfirmed','party','Sol','Sol 1',
  extensions.st_setsrid(extensions.st_makepoint(-3.7035,40.4169),4326)::extensions.geography,
  now()+interval '2 hours',now()+interval '6 hours','unconfirmed','user',now()-interval '25 hours',false),
 ('00000000-0000-4000-8000-0000000ee702','Fresh unconfirmed','party','Sol','Sol 1',
  extensions.st_setsrid(extensions.st_makepoint(-3.7035,40.4169),4326)::extensions.geography,
  now()+interval '2 hours',now()+interval '6 hours','unconfirmed','user',now()-interval '23 hours',false);
select private.run_places_expiry();
insert into _results select 'unconfirmed removed at 24 h',status::text='removed' and hidden_at is not null
 from public.events where id='00000000-0000-4000-8000-0000000ee701';
insert into _results select 'unconfirmed kept before 24 h',status::text='unconfirmed'
 from public.events where id='00000000-0000-4000-8000-0000000ee702';

update private.provider_access set public_token='',monthly_used=0,daily_used=0,daily_budget=1,
 monthly_budget=1,available=true,free_access_confirmed=true,observed_provider_usage=0,
 usage_observed_at=now(),expires_at=now()+interval '1 hour'
 where capability='mapbox' and mode='free_quota';
set local role authenticated;
insert into _results select 'no token: test map',public.reserve_map_load()->>'reason'='no_token';
reset role;
update private.provider_access set public_token='pk.'||repeat('a',30)
 where capability='mapbox' and mode='free_quota';
set local role authenticated;
insert into _ctx values('first',public.reserve_map_load());
insert into _ctx values('second',public.reserve_map_load());
reset role;
insert into _results select 'token only after reservation',(value->>'granted')::boolean
 and value->>'token' like 'pk.%' from _ctx where key='first';
insert into _results select 'budget exhausted: test map',value->>'reason'='quota'
 and not value ? 'token' from _ctx where key='second';
insert into _results select 'reservation counted',monthly_used=1 from private.provider_access
 where capability='mapbox' and mode='free_quota';
do $$ begin
 begin update private.provider_access set public_token='sk.'||repeat('a',30)
  where capability='mapbox' and mode='free_quota';
  insert into _results values('secret token rejected',false);
 exception when check_violation then insert into _results values('secret token rejected',true); end;
end $$;
do $$ begin
 raise exception 'PLACES RESULTS % passed / % failed: %',
 (select count(*) from _results where ok),(select count(*) from _results where not ok),
 coalesce((select string_agg(test,'; ') from _results where not ok),'none failed');
end $$;
