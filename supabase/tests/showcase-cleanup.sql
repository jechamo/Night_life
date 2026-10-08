-- Roadmap R4 part 5: removing a photo (row first, then the object) and the daily retention
-- job. One transaction that always ends in an error (= rollback): nothing is left.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000d5'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009996'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,4) i;
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
select ('00000000-0000-4000-8000-00000000d5'||lpad(i::text,2,'0'))::uuid,'Cleanup test '||i,'1990-01-01','woman',now(),false from generate_series(1,4) i;
insert into public.venues(id,name,type,address,location,city,is_test)
select ('00000000-0000-4000-8000-0000000d5e0'||i)::uuid,'R4c venue '||i,'club','Test',
 extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'R4 Test City',false from generate_series(1,2) i;
insert into public.venue_managers(venue_id,user_id) values
 ('00000000-0000-4000-8000-0000000d5e01','00000000-0000-4000-8000-00000000d502'),
 ('00000000-0000-4000-8000-0000000d5e02','00000000-0000-4000-8000-00000000d503');
update public.app_settings set value='on' where key='venue_showcase_enabled';
insert into storage.objects(bucket_id,name) values ('venue-photos','00000000-0000-4000-8000-0000000d5e01/00000000-0000-4000-8000-000000000001.webp');
insert into private.venue_view_marks values ('00000000-0000-4000-8000-0000000d5e01', current_date-10, 'old'), ('00000000-0000-4000-8000-0000000d5e01', private.nightlife_night_date(), 'new');
insert into private.venue_notices(venue_id,kind,until) values ('00000000-0000-4000-8000-0000000d5e01','happy_hour',now()-interval '2 days');
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value text);
grant all on _p,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when insufficient_privilege or no_data_found then return true; end $$;
create function pg_temp.as_user(n int) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-00000000d5'||lpad(n::text,2,'0'),'role','authenticated','aal','aal1')::text, true) $$;
insert into _p values ('maintenance not callable by clients', not has_function_privilege('authenticated','private.venue_showcase_maintenance()','execute')
 and not has_function_privilege('anon','public.venue_photo_remove(uuid,uuid)','execute'));
set local role authenticated; select pg_temp.as_user(2);
insert into _ctx select 'photo', public.venue_photo_add('00000000-0000-4000-8000-0000000d5e01','00000000-0000-4000-8000-0000000d5e01/00000000-0000-4000-8000-000000000001.webp')#>>'{photos,0,id}';
select pg_temp.as_user(4);
insert into _p select 'plain user cannot remove photos', pg_temp.denied(format('select public.venue_photo_remove(%L,%L)','00000000-0000-4000-8000-0000000d5e01',(select value from _ctx where key='photo')));
select pg_temp.as_user(3);
insert into _p select 'other manager cannot remove photos', pg_temp.denied(format('select public.venue_photo_remove(%L,%L)','00000000-0000-4000-8000-0000000d5e01',(select value from _ctx where key='photo')));
insert into _p select 'other venue id does not reach the photo', pg_temp.denied(format('select public.venue_photo_remove(%L,%L)','00000000-0000-4000-8000-0000000d5e02',(select value from _ctx where key='photo')));
select pg_temp.as_user(2);
insert into _p select 'manager removes: path returned', public.venue_photo_remove('00000000-0000-4000-8000-0000000d5e01',(select value::uuid from _ctx where key='photo'))
 = '00000000-0000-4000-8000-0000000d5e01/00000000-0000-4000-8000-000000000001.webp';
insert into _p select 'then the object may be deleted', private.can_delete_venue_photo('00000000-0000-4000-8000-0000000d5e01/00000000-0000-4000-8000-000000000001.webp');
reset role;
insert into _p select 'row gone', not exists(select 1 from private.venue_photos where venue_id='00000000-0000-4000-8000-0000000d5e01');
select private.venue_showcase_maintenance();
insert into _p select 'maintenance drops old marks only', (select array_agg(viewer_hmac) from private.venue_view_marks where venue_id='00000000-0000-4000-8000-0000000d5e01')=array['new'];
insert into _p select 'maintenance drops expired notices', not exists(select 1 from private.venue_notices where venue_id='00000000-0000-4000-8000-0000000d5e01');
do $$ begin
 raise exception 'CLEANUP RESULTS % passed / % failed: %', (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
