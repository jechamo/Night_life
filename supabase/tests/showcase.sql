-- Roadmap R4 «Escaparate del local»: flag, Storage predicates, photo moderation and plan
-- limits, details, notices, view counting and the thresholded report, by role. One
-- transaction that always ends in an error (= rollback): nothing is left.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000d4'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009995'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,10) i;
-- 01 admin, 02 manager of venue 1, 03 manager of venue 2, 04 plain user, 05-10 more people
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
select ('00000000-0000-4000-8000-00000000d4'||lpad(i::text,2,'0'))::uuid,'Showcase test '||i,'1990-01-01','woman',now(),false
from generate_series(1,10) i;
insert into public.user_roles(user_id,role) values ('00000000-0000-4000-8000-00000000d401','admin');
insert into public.venues(id,name,type,address,location,city,is_test)
select ('00000000-0000-4000-8000-0000000d4e0'||i)::uuid,'R4 venue '||i,'club','Test',
 extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'R4 Test City',false
from generate_series(1,2) i;
insert into public.venue_managers(venue_id,user_id) values
 ('00000000-0000-4000-8000-0000000d4e01','00000000-0000-4000-8000-00000000d402'),
 ('00000000-0000-4000-8000-0000000d4e02','00000000-0000-4000-8000-00000000d403');
update public.app_settings set value='off' where key='venue_showcase_enabled';
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _p,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or invalid_parameter_value or no_data_found or program_limit_exceeded
 or invalid_authorization_specification then return true; end $$;
create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create function pg_temp.as_user(n int, aal text default 'aal1') returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',
  '00000000-0000-4000-8000-00000000d4'||lpad(n::text,2,'0'),'role','authenticated','aal',aal)::text, true) $$;
create function pg_temp.path(v int, n int) returns text language sql as $$
 select '00000000-0000-4000-8000-0000000d4e0'||v||'/00000000-0000-4000-8000-0000000000'||lpad(n::text,2,'0')||'.webp' $$;
create function pg_temp.photo(n int) returns uuid language sql as $$
 select (value#>>'{}')::uuid from _ctx where key='photo'||n $$;

insert into _p values
 ('anon cannot run any showcase RPC', not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname in ('public','private') and p.proname in ('venue_photos_manage','venue_photo_add','venue_photo_set_cover',
   'venue_details_save','venue_notice_set','venue_notice_clear','venue_showcase','venue_covers','place_view','venue_report',
   'admin_venue_photos','admin_venue_photo_review','can_upload_venue_photo','can_read_venue_photo','can_delete_venue_photo')
   and has_function_privilege('anon',p.oid,'execute'))),
 ('showcase tables closed to clients', not has_table_privilege('authenticated','private.venue_photos','select')
   and not has_table_privilege('authenticated','private.venue_view_marks','select')
   and not has_table_privilege('authenticated','private.venue_daily_views','select')
   and not has_table_privilege('authenticated','private.venue_notices','insert')),
 ('helpers not callable', not has_function_privilege('authenticated','private.venue_has_plan(uuid)','execute')
   and not has_function_privilege('authenticated','private.visible_venue_photos(uuid)','execute')
   and not has_function_privilege('authenticated','private.venue_period(uuid,date,date)','execute')),
 ('bucket private, 5 MB, images only', exists(select 1 from storage.buckets where id='venue-photos' and not public
   and file_size_limit=5242880 and allowed_mime_types=array['image/webp','image/jpeg','image/png'])),
 ('no update policy on venue photos', not exists(select 1 from pg_policies where schemaname='storage'
   and tablename='objects' and policyname like 'venue photos%' and cmd='UPDATE'));

-- Flag off: nothing reachable, uploads refused.
set local role authenticated; select pg_temp.as_user(2);
insert into _p select 'flag off: manager cannot manage photos', pg_temp.denied(format('select public.venue_photos_manage(%L)','00000000-0000-4000-8000-0000000d4e01'));
insert into _p select 'flag off: upload refused', not private.can_upload_venue_photo(pg_temp.path(1,1));
select pg_temp.as_user(4);
insert into _p select 'flag off: page closed', pg_temp.denied(format('select public.venue_showcase(%L)','00000000-0000-4000-8000-0000000d4e01'));
reset role; update public.app_settings set value='on' where key='venue_showcase_enabled';

-- Storage upload predicate.
set local role authenticated; select pg_temp.as_user(2);
insert into _p select 'manager may upload into own venue folder', private.can_upload_venue_photo(pg_temp.path(1,1));
insert into _p select 'manager cannot upload into another venue', not private.can_upload_venue_photo(pg_temp.path(2,1));
insert into _p select 'odd paths refused', not private.can_upload_venue_photo('00000000-0000-4000-8000-0000000d4e01/../x.webp')
 and not private.can_upload_venue_photo('00000000-0000-4000-8000-0000000d4e01/photo.gif');
select pg_temp.as_user(4);
insert into _p select 'plain user cannot upload', not private.can_upload_venue_photo(pg_temp.path(1,1));
reset role;
insert into storage.objects(bucket_id,name) select 'venue-photos', pg_temp.path(1,n) from generate_series(1,8) n;
insert into storage.objects(bucket_id,name) values ('venue-photos', pg_temp.path(1,9));

-- Registering photos.
set local role authenticated; select pg_temp.as_user(4);
insert into _p select 'plain user cannot register photos', pg_temp.denied(format('select public.venue_photo_add(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.path(1,1)));
select pg_temp.as_user(2);
insert into _p select 'photo must be in the venue folder', pg_temp.err(format('select public.venue_photo_add(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.path(2,1))) like '%invalid photo%';
insert into _p select 'photo object must exist', pg_temp.err(format('select public.venue_photo_add(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.path(1,20))) like '%invalid photo%';
insert into _ctx select 'm'||n, public.venue_photo_add('00000000-0000-4000-8000-0000000d4e01', pg_temp.path(1,n)) from generate_series(1,3) n;
insert into _p select 'free venues: 3 photos', pg_temp.err(format('select public.venue_photo_add(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.path(1,4))) like '%photo_limit%';
insert into _ctx select 'photo'||n, to_jsonb(p->>'id') from (select p, row_number() over () n from
 jsonb_array_elements((select value->'photos' from _ctx where key='m3')) p) q;
insert into _p select 'new photos are pending', (select bool_and(p->>'status'='pending') from jsonb_array_elements((select value->'photos' from _ctx where key='m3')) p)
 and (select (value->>'limit')::int from _ctx where key='m3')=3;
select pg_temp.as_user(4);
insert into _p select 'pending photos are not public', jsonb_array_length(public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'photos')=0
 and not private.can_read_venue_photo(pg_temp.path(1,1));
select pg_temp.as_user(3);
insert into _p select 'other venue manager cannot read pending', not private.can_read_venue_photo(pg_temp.path(1,1));
select pg_temp.as_user(2);
insert into _p select 'own manager reads pending', private.can_read_venue_photo(pg_temp.path(1,1));

-- Moderation.
select pg_temp.as_user(4);
insert into _p select 'user cannot moderate', pg_temp.denied($q$select public.admin_venue_photos('pending')$q$);
select pg_temp.as_user(1);
insert into _p select 'admin without MFA cannot moderate', pg_temp.denied($q$select public.admin_venue_photos('pending')$q$);
select pg_temp.as_user(1,'aal2');
insert into _p select 'admin lists pending photos', (select count(*) from jsonb_array_elements(public.admin_venue_photos('pending')) x
 where x->>'venueId'='00000000-0000-4000-8000-0000000d4e01')=3;
insert into _p select 'rejection needs a reason', pg_temp.err(format('select public.admin_venue_photo_review(%L,false,%L)',pg_temp.photo(3),'')) like '%invalid review%';
select public.admin_venue_photo_review(pg_temp.photo(3), false, 'Sale una persona');
select public.admin_venue_photo_review(pg_temp.photo(n), true, null) from generate_series(1,2) n;
select pg_temp.as_user(4);
insert into _ctx values ('page', public.venue_showcase('00000000-0000-4000-8000-0000000d4e01'));
insert into _p select 'approved photos are public', jsonb_array_length((select value->'photos' from _ctx where key='page'))=2
 and private.can_read_venue_photo(pg_temp.path(1,1)) and not private.can_read_venue_photo(pg_temp.path(1,3));
insert into _p select 'cover = first approved', exists(select 1 from jsonb_array_elements(public.venue_covers()) c
 where c->>'venueId'='00000000-0000-4000-8000-0000000d4e01' and c->>'path'=pg_temp.path(1,1));
select pg_temp.as_user(2);
insert into _p select 'rejected photo frees its slot and shows the reason',
 (select p->>'reason' from jsonb_array_elements(public.venue_photos_manage('00000000-0000-4000-8000-0000000d4e01')->'photos') p
  where p->>'status'='rejected')='Sale una persona'
 and pg_temp.err(format('select public.venue_photo_add(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.path(1,4)))='ok';
insert into _p select 'only approved photos can be the cover', pg_temp.err(format('select public.venue_photo_set_cover(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.photo(3))) like '%invalid photo%';
select public.venue_photo_set_cover('00000000-0000-4000-8000-0000000d4e01', pg_temp.photo(2));
select pg_temp.as_user(3);
insert into _p select 'other manager cannot set the cover', pg_temp.denied(format('select public.venue_photo_set_cover(%L,%L)','00000000-0000-4000-8000-0000000d4e01',pg_temp.photo(1)));
select pg_temp.as_user(4);
insert into _p select 'chosen cover goes first', exists(select 1 from jsonb_array_elements(public.venue_covers()) c
 where c->>'venueId'='00000000-0000-4000-8000-0000000d4e01' and c->>'path'=pg_temp.path(1,2));

-- Plan limits: 10 with an active sponsorship; extra photos hidden (not deleted) after it.
reset role;
insert into public.sponsorships(venue_id,tier,status,starts_on,ends_on) values
 ('00000000-0000-4000-8000-0000000d4e01','featured','active',current_date,current_date+29);
set local role authenticated; select pg_temp.as_user(2);
select public.venue_photo_add('00000000-0000-4000-8000-0000000d4e01', pg_temp.path(1,n)) from generate_series(5,6) n;
insert into _p select 'plan raises the limit to 10', (public.venue_photos_manage('00000000-0000-4000-8000-0000000d4e01')->>'limit')::int=10;
select pg_temp.as_user(1,'aal2');
select public.admin_venue_photo_review((x->>'id')::uuid, true, null)
 from jsonb_array_elements(public.admin_venue_photos('pending')) x where x->>'venueId'='00000000-0000-4000-8000-0000000d4e01';
select pg_temp.as_user(4);
insert into _p select 'with plan all 5 approved photos show', jsonb_array_length(public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'photos')=5;
reset role; update public.sponsorships set status='ended' where venue_id='00000000-0000-4000-8000-0000000d4e01';
set local role authenticated; select pg_temp.as_user(4);
insert into _p select 'after the plan only 3 show', jsonb_array_length(public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'photos')=3;
select pg_temp.as_user(2);
insert into _p select 'extra photos kept but marked hidden', (select count(*) from jsonb_array_elements(public.venue_photos_manage('00000000-0000-4000-8000-0000000d4e01')->'photos') p
 where p->>'status'='approved' and not (p->>'visible')::boolean)=2;

-- Storage delete predicate: only objects no photo row points to (the RPC removes the row first).
insert into _p select 'registered photos cannot be deleted directly', not private.can_delete_venue_photo(pg_temp.path(1,1));
insert into _p select 'manager deletes orphan uploads', private.can_delete_venue_photo(pg_temp.path(1,9));
select pg_temp.as_user(4);
insert into _p select 'plain user cannot delete', not private.can_delete_venue_photo(pg_temp.path(1,9));

-- Details.
select pg_temp.as_user(2);
insert into _p select 'unknown detail fields refused', pg_temp.err(format('select public.venue_details_save(%L,%L)','00000000-0000-4000-8000-0000000d4e01','{"price":1}')) like '%invalid fields%';
insert into _p select 'invalid dress code refused', pg_temp.err(format('select public.venue_details_save(%L,%L)','00000000-0000-4000-8000-0000000d4e01','{"dressCode":"black_tie"}')) like '%invalid fields%';
insert into _p select 'minimum age under 18 refused', pg_temp.err(format('select public.venue_details_save(%L,%L)','00000000-0000-4000-8000-0000000d4e01','{"minAge":16}')) like '%invalid fields%';
select public.venue_details_save('00000000-0000-4000-8000-0000000d4e01',
 '{"dressCode":"smart","minAge":21,"entryPriceCents":0,"drinkPriceCents":950,"terrace":true,"accessible":null}');
select pg_temp.as_user(3);
insert into _p select 'other manager cannot edit details', pg_temp.denied(format('select public.venue_details_save(%L,%L)','00000000-0000-4000-8000-0000000d4e01','{"terrace":false}'));
select pg_temp.as_user(4);
insert into _p select 'details are public', (public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'details')
 = '{"dressCode":"smart","minAge":21,"entryPriceCents":0,"drinkPriceCents":950,"terrace":true,"accessible":null}'::jsonb;

-- Notices («Lo dice el local»).
select pg_temp.as_user(2);
insert into _p select 'unknown door value refused', pg_temp.err(format('select public.venue_notice_set(%L,%L,%L,null)','00000000-0000-4000-8000-0000000d4e01','door','empty')) like '%invalid notice%';
insert into _p select 'offers end within 8 hours', pg_temp.err(format('select public.venue_notice_set(%L,%L,null,%L)','00000000-0000-4000-8000-0000000d4e01','happy_hour',now()+interval '9 hours')) like '%invalid notice%'
 and pg_temp.err(format('select public.venue_notice_set(%L,%L,null,%L)','00000000-0000-4000-8000-0000000d4e01','happy_hour',now()-interval '1 minute')) like '%invalid notice%';
select public.venue_notice_set('00000000-0000-4000-8000-0000000d4e01','door','long_queue',null);
select public.venue_notice_set('00000000-0000-4000-8000-0000000d4e01','free_entry',null,now()+interval '2 hours');
insert into _p select 'door status lasts 90 minutes', (select (n->>'until')::timestamptz between now()+interval '89 minutes' and now()+interval '91 minutes'
 from jsonb_array_elements(public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'notices') n where n->>'kind'='door');
select pg_temp.as_user(3);
insert into _p select 'other manager cannot post notices', pg_temp.denied(format('select public.venue_notice_set(%L,%L,%L,null)','00000000-0000-4000-8000-0000000d4e01','door','full'));
select pg_temp.as_user(4);
insert into _p select 'people see the notices', jsonb_array_length(public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'notices')=2;
select pg_temp.as_user(2);
select public.venue_notice_clear('00000000-0000-4000-8000-0000000d4e01','door');
select pg_temp.as_user(4);
insert into _p select 'cleared notice disappears', (select array_agg(n->>'kind') from jsonb_array_elements(public.venue_showcase('00000000-0000-4000-8000-0000000d4e01')->'notices') n)=array['free_entry'];

-- Views: one per person and night, managers not counted, no user id stored.
select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select pg_temp.as_user(2); select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select pg_temp.as_user(5); select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select pg_temp.as_user(6); select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select pg_temp.as_user(7); select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select pg_temp.as_user(8); select public.place_view('00000000-0000-4000-8000-0000000d4e01');
select pg_temp.as_user(9); select public.place_view('00000000-0000-4000-8000-0000000d4e01');
reset role;
insert into _p select 'one view per person and night; managers excluded',
 (select views from private.venue_daily_views where venue_id='00000000-0000-4000-8000-0000000d4e01')=6;
insert into _p select 'view marks hold no user id', not exists(select 1 from private.venue_view_marks
 where venue_id='00000000-0000-4000-8000-0000000d4e01' and viewer_hmac like '%00000000-0000-4000-8000-00000000d4%');

-- Report: thresholded aggregates only.
insert into public.attendance(user_id,venue_id,kind,expires_at)
select ('00000000-0000-4000-8000-00000000d4'||lpad(i::text,2,'0'))::uuid,'00000000-0000-4000-8000-0000000d4e01','going',now()+interval '6 hours'
from generate_series(4,8) i;
insert into public.attendance(user_id,venue_id,kind,expires_at)
select ('00000000-0000-4000-8000-00000000d4'||lpad(i::text,2,'0'))::uuid,'00000000-0000-4000-8000-0000000d4e01','check_in',now()+interval '3 hours'
from generate_series(4,6) i;
set local role authenticated; select pg_temp.as_user(4);
insert into _p select 'people cannot read the report', pg_temp.denied(format('select public.venue_report(%L)','00000000-0000-4000-8000-0000000d4e01'));
select pg_temp.as_user(3);
insert into _p select 'other manager cannot read the report', pg_temp.denied(format('select public.venue_report(%L)','00000000-0000-4000-8000-0000000d4e01'));
select pg_temp.as_user(2);
insert into _ctx values ('report', public.venue_report('00000000-0000-4000-8000-0000000d4e01'));
insert into _p select 'report: views and going shown from 5', (select value#>'{summary,views}' from _ctx where key='report')='6'
 and (select value#>'{summary,going}' from _ctx where key='report')='5';
insert into _p select 'report: fewer than 5 check-ins hidden', (select value#>'{summary,checkIns}' from _ctx where key='report')='0';
insert into _p select 'report: going → check-in rate', (select value#>'{summary,conversion}' from _ctx where key='report')='60';
insert into _p select 'report: Pro detail only with Pro', (select value->'daily' from _ctx where key='report')='null'::jsonb
 and (select value->>'pro' from _ctx where key='report')='false';
insert into _p select 'report: recent sponsorship listed', (select jsonb_array_length(value->'sponsorships') from _ctx where key='report')=1;

-- Flag off again: people lose access at once; managers keep their own files.
reset role; update public.app_settings set value='off' where key='venue_showcase_enabled';
set local role authenticated; select pg_temp.as_user(4);
insert into _p select 'flag off: approved photos no longer readable', not private.can_read_venue_photo(pg_temp.path(1,1));
insert into _p select 'flag off: covers closed', pg_temp.denied('select public.venue_covers()');
select pg_temp.as_user(2);
insert into _p select 'flag off: manager still reads own files', private.can_read_venue_photo(pg_temp.path(1,1));
reset role;
insert into _p select 'moderation audited', (select count(*) from public.admin_audit_log where action in ('venue_photo.approve','venue_photo.reject')
 and created_at>=now()-interval '1 minute')>=6;

do $$ begin
 raise exception 'SHOWCASE RESULTS % passed / % failed: %',
  (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
