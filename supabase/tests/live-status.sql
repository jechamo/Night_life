-- Roadmap R2 «Cómo está ahora»: flag, check-in, manager, threshold, history, export and
-- retention. One transaction that always ends in an error (= rollback): nothing is left.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000d2'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009993'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,7) i;
-- 01-04 voters, 05 venue manager, 06 test account, 07 tester (sees test data)
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
select ('00000000-0000-4000-8000-00000000d2'||lpad(i::text,2,'0'))::uuid,'Live status '||i,'1995-01-01','woman',now(),i=6
from generate_series(1,7) i;
insert into public.user_roles(user_id,role) values
 ('00000000-0000-4000-8000-00000000d207','tester');
insert into public.venues(id,name,type,address,location,city,is_test) values
 ('00000000-0000-4000-8000-0000000d2e01','Live status venue','club','Test',
  extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Madrid',false);
insert into public.venue_managers(venue_id,user_id) values
 ('00000000-0000-4000-8000-0000000d2e01','00000000-0000-4000-8000-00000000d205');
insert into public.attendance(user_id,venue_id,kind,visible,expires_at,is_test)
select ('00000000-0000-4000-8000-00000000d2'||lpad(i::text,2,'0'))::uuid,'00000000-0000-4000-8000-0000000d2e01',
 'check_in',true,now()+interval '1 hour',false from generate_series(2,7) i;
update public.app_settings set value='off' where key='live_status_enabled';
create temp table _ls(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _ls,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or invalid_parameter_value or no_data_found then return true; end $$;
create function pg_temp.as_user(n int) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',
  '00000000-0000-4000-8000-00000000d2'||lpad(n::text,2,'0'),'role','authenticated','aal','aal1')::text, true) $$;

insert into _ls values
 ('anon cannot read live status', not has_function_privilege('anon','public.place_live_status(uuid)','execute')),
 ('anon cannot vote', not has_function_privilege('anon','public.report_place_status(uuid,text,text)','execute')),
 ('votes table closed to clients', not has_table_privilege('authenticated','private.place_reports','select')),
 ('retention not callable', not has_function_privilege('authenticated','private.place_reports_retention()','execute')),
 ('no public definer', not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prosecdef));

set local role authenticated;
select pg_temp.as_user(2);
insert into _ls select 'flag off: reading denied', pg_temp.denied($q$select public.place_live_status('00000000-0000-4000-8000-0000000d2e01')$q$);
insert into _ls select 'flag off: voting denied', pg_temp.denied($q$select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','busy')$q$);
reset role;
update public.app_settings set value='on' where key='live_status_enabled';

set local role authenticated;
select pg_temp.as_user(1);
insert into _ls select 'no check-in: vote denied', pg_temp.denied($q$select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','busy')$q$);
select pg_temp.as_user(2);
insert into _ctx values('first', public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','busy'));
insert into _ls select 'own vote returned', value->'mine'->>'crowd'='busy' from _ctx where key='first';
insert into _ls select 'one vote stays hidden', (value->'crowd'->>'total')::int=1 and value->'crowd'->'counts'='null'::jsonb from _ctx where key='first';
insert into _ls select 'invalid answer rejected', pg_temp.denied($q$select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','wild')$q$);
insert into _ls select 'invalid question rejected', pg_temp.denied($q$select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','age','30')$q$);
select pg_temp.as_user(3); select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','packed');
select pg_temp.as_user(4); select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','busy');
insert into _ctx values('three', public.place_live_status('00000000-0000-4000-8000-0000000d2e01'));
insert into _ls select 'three votes shown aggregated', value->'crowd'->'counts'='{"busy":2,"packed":1}'::jsonb from _ctx where key='three';
insert into _ls select 'no identities exposed', not (value::text ~ '00000000-0000-4000-8000-00000000d2') from _ctx where key='three';
select pg_temp.as_user(4); select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','packed');
insert into _ls select 'changing a vote does not add one',
 public.place_live_status('00000000-0000-4000-8000-0000000d2e01')->'crowd'->'counts'='{"busy":1,"packed":2}'::jsonb;
select pg_temp.as_user(5);
insert into _ls select 'manager cannot vote own venue', pg_temp.denied($q$select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','crowd','packed')$q$);
select pg_temp.as_user(6); select public.report_place_status('00000000-0000-4000-8000-0000000d2e01','queue','long');
select pg_temp.as_user(2);
insert into _ls select 'test votes hidden from real users',
 (public.place_live_status('00000000-0000-4000-8000-0000000d2e01')->'queue'->>'total')::int=0;
select pg_temp.as_user(7);
insert into _ls select 'test votes visible to testers',
 (public.place_live_status('00000000-0000-4000-8000-0000000d2e01')->'queue'->>'total')::int=1;

-- Venue-declared music.
select pg_temp.as_user(2);
insert into _ls select 'non-manager cannot declare music', pg_temp.denied($q$select public.venue_set_music('00000000-0000-4000-8000-0000000d2e01',array['techno'],'DJ')$q$);
select pg_temp.as_user(5);
insert into _ctx values('music', public.venue_set_music('00000000-0000-4000-8000-0000000d2e01',array['techno','house'],'  DJ Test  '));
insert into _ls select 'declared music and tonight line-up', value->'declared'='{"genres":["house","techno"],"lineup":"DJ Test"}'::jsonb from _ctx where key='music';
insert into _ls select 'unknown style rejected', pg_temp.denied($q$select public.venue_set_music('00000000-0000-4000-8000-0000000d2e01',array['polka'],null)$q$);
insert into _ls select 'more than 3 styles rejected', pg_temp.denied($q$select public.venue_set_music('00000000-0000-4000-8000-0000000d2e01',array['techno','house','pop','rock'],null)$q$);
reset role;
update public.venues set lineup_night=private.nightlife_night_date()-1 where id='00000000-0000-4000-8000-0000000d2e01';
set local role authenticated; select pg_temp.as_user(2);
insert into _ls select 'yesterday line-up expires', public.place_live_status('00000000-0000-4000-8000-0000000d2e01')->'declared'->'lineup'='null'::jsonb;
reset role;

-- Window and history (inserted as the owner, like past nights).
update private.place_reports set updated_at=now()-interval '2 hours'
 where user_id='00000000-0000-4000-8000-00000000d203' and dimension='crowd';
insert into private.place_reports(user_id,venue_id,dimension,value,night_date,updated_at)
select u,'00000000-0000-4000-8000-0000000d2e01','crowd','packed',private.nightlife_night_date()-7*w,now()-make_interval(days=>7*w)
from unnest(array['00000000-0000-4000-8000-00000000d201','00000000-0000-4000-8000-00000000d202']::uuid[]) u,
 generate_series(1,3) w;
set local role authenticated; select pg_temp.as_user(2);
insert into _ctx values('later', public.place_live_status('00000000-0000-4000-8000-0000000d2e01'));
insert into _ls select 'votes older than 90 minutes stop counting', (value->'crowd'->>'total')::int=2 from _ctx where key='later';
insert into _ls select 'usually from 5 past votes same night and hour', value->>'usually'='packed' from _ctx where key='later';
insert into _ls select 'export includes own votes', jsonb_array_length(public.export_my_data()->'place_reports')>=1;
reset role;
update private.place_reports set updated_at=now()-interval '61 days' where user_id='00000000-0000-4000-8000-00000000d206';
select private.place_reports_retention();
insert into _ls select 'retention deletes votes after 60 days',
 not exists(select 1 from private.place_reports where user_id='00000000-0000-4000-8000-00000000d206');

do $$ begin
 raise exception 'LIVE STATUS RESULTS % passed / % failed: %',
  (select count(*) from _ls where ok),(select count(*) from _ls where not ok),
  coalesce((select string_agg(test,'; ') from _ls where not ok),'none failed');
end $$;
