-- Roadmap R5 «Reservas y lista de invitados»: flag, verified age, venue opt-in, limits,
-- venue decisions, guest list capacity, door codes (once, own venue, tonight), GDPR export
-- and maintenance, by role. One transaction that always ends in an error (= rollback).
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000d6'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009997'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,8) i;
-- 01 manager of venue 1, 02 manager of venue 2, 03 verified, 04 NOT verified, 05-08 verified
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
select ('00000000-0000-4000-8000-00000000d6'||lpad(i::text,2,'0'))::uuid,'Booker '||i,'1990-01-01','woman',now(),false
from generate_series(1,8) i;
insert into public.verification_status(user_id,phone_verified,age_verified,age_mode)
select ('00000000-0000-4000-8000-00000000d6'||lpad(i::text,2,'0'))::uuid,true,i<>4,case when i<>4 then 'live' end
from generate_series(1,8) i;
insert into public.venues(id,name,type,address,location,city,is_test)
select ('00000000-0000-4000-8000-0000000d6e0'||i)::uuid,'R5 venue '||i,'club','Test',
 extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'R5 Test City',false
from generate_series(1,2) i;
insert into public.venue_managers(venue_id,user_id) values
 ('00000000-0000-4000-8000-0000000d6e01','00000000-0000-4000-8000-00000000d601'),
 ('00000000-0000-4000-8000-0000000d6e02','00000000-0000-4000-8000-00000000d602');
update public.app_settings set value='off' where key='venue_bookings_enabled';
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _p,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or no_data_found or invalid_authorization_specification then return true; end $$;
create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create function pg_temp.as_user(n int) returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-00000000d6'||lpad(n::text,2,'0'),
  'role','authenticated','aal','aal1')::text, true),
  set_config('request.headers', json_build_object('x-real-ip','10.6.0.'||n)::text, true) $$;
create function pg_temp.v(n int) returns uuid language sql as $$ select ('00000000-0000-4000-8000-0000000d6e0'||n)::uuid $$;
create function pg_temp.req(n int, hours int, party int default 4, kind text default 'table') returns text language sql as $$
 select pg_temp.err(format('select public.reservation_request(%L,%L,%s,%L)', pg_temp.v(n), now()+make_interval(hours=>hours), party, kind)) $$;

insert into _p values
 ('anon cannot run any booking RPC', not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname in ('public','private') and p.proname in ('venue_bookings','reservation_request','reservation_cancel',
   'guestlist_join','guestlist_leave','my_bookings','venue_booking_settings_save','venue_reservations','venue_reservation_decide',
   'venue_guestlist','venue_guestlist_save','venue_guestlist_close','venue_guestlist_checkin') and has_function_privilege('anon',p.oid,'execute'))),
 ('booking tables closed to clients', not has_table_privilege('authenticated','private.venue_reservations','select')
   and not has_table_privilege('authenticated','private.venue_guestlist_entries','select')
   and not has_table_privilege('authenticated','private.venue_booking_settings','insert')),
 ('helpers not callable', not has_function_privilege('authenticated','private.guest_code(uuid)','execute')
   and not has_function_privilege('authenticated','private.booking_name(uuid)','execute')
   and not has_function_privilege('authenticated','private.venue_bookings_maintenance()','execute')),
 ('door codes are never stored', not exists(select 1 from information_schema.columns where table_schema='private'
   and table_name='venue_guestlist_entries' and column_name like '%code%'));

-- Flag off.
set local role authenticated; select pg_temp.as_user(3);
insert into _p select 'flag off: booking options closed', pg_temp.denied(format('select public.venue_bookings(%L)',pg_temp.v(1)));
select pg_temp.as_user(1);
insert into _p select 'flag off: venue settings closed', pg_temp.denied(format('select public.venue_booking_settings_save(%L,true,true,6)',pg_temp.v(1)));
reset role; update public.app_settings set value='on' where key='venue_bookings_enabled';

-- Venue opt-in.
set local role authenticated; select pg_temp.as_user(3);
insert into _p select 'venues start with bookings off', (public.venue_bookings(pg_temp.v(1))->>'reservations')='false'
 and public.venue_bookings(pg_temp.v(1))->'guestlist'='null'::jsonb;
insert into _p select 'cannot book a venue without reservations', pg_temp.req(1,2) like '%not_available%';
select pg_temp.as_user(2);
insert into _p select 'other manager cannot change settings', pg_temp.denied(format('select public.venue_booking_settings_save(%L,true,true,6)',pg_temp.v(1)));
select pg_temp.as_user(1);
insert into _p select 'party limit checked', pg_temp.err(format('select public.venue_booking_settings_save(%L,true,true,30)',pg_temp.v(1))) like '%invalid settings%';
select public.venue_booking_settings_save(pg_temp.v(1), true, true, 6);
insert into _p select 'manager cannot book own venue', pg_temp.req(1,2) like '%own_venue%';

-- Reservations.
select pg_temp.as_user(4);
insert into _p select 'unverified age cannot book', pg_temp.req(1,2) like '%age_required%';
insert into _p select 'unverified people still see the options', (public.venue_bookings(pg_temp.v(1))->>'ageVerified')='false';
select pg_temp.as_user(3);
insert into _p select 'party over the venue maximum refused', pg_temp.req(1,2,7) like '%invalid booking%';
insert into _p select 'too soon refused', pg_temp.err(format('select public.reservation_request(%L,%L,2,%L)',pg_temp.v(1),now()+interval '10 minutes','table')) like '%invalid booking%';
insert into _p select 'more than 14 days ahead refused', pg_temp.req(1,24*15) like '%invalid booking%';
insert into _p select 'unknown kind refused', pg_temp.req(1,2,2,'vip') like '%invalid booking%';
insert into _p select 'request ok', pg_temp.req(1,2)='ok';
insert into _p select 'one request per venue and night', pg_temp.req(1,3) like '%already_booked%';
insert into _p select 'second and third nights ok', pg_temp.req(1,26,2,'bottle')='ok' and pg_temp.req(1,50)='ok';
insert into _p select 'max 3 active requests', pg_temp.req(1,74) like '%booking_limit%';
insert into _ctx select 'r'||n, to_jsonb(r->>'id') from (select r, row_number() over (order by r->>'arriveAt') n
 from jsonb_array_elements(public.my_bookings()->'reservations') r) q;
select pg_temp.as_user(5);
insert into _p select 'others cannot cancel my request', pg_temp.denied(format('select public.reservation_cancel(%L)',(select value#>>'{}' from _ctx where key='r1')));
select pg_temp.as_user(2);
insert into _p select 'other manager cannot see the requests', pg_temp.denied(format('select public.venue_reservations(%L)',pg_temp.v(1)));
insert into _p select 'other manager cannot decide', pg_temp.denied(format('select public.venue_reservation_decide(%L,%L,true,null)',pg_temp.v(1),(select value#>>'{}' from _ctx where key='r1')));
select pg_temp.as_user(1);
insert into _ctx values ('list', public.venue_reservations(pg_temp.v(1)));
insert into _p select 'venue sees name, party and time only', jsonb_array_length(value->'items')=3
 and (select bool_and(i->>'name'='Booker 3' and not (i ? 'phone') and not (i ? 'userId')) from jsonb_array_elements(value->'items') i)
 from _ctx where key='list';
select public.venue_reservation_decide(pg_temp.v(1),(select (value#>>'{}')::uuid from _ctx where key='r1'),true,null);
select public.venue_reservation_decide(pg_temp.v(1),(select (value#>>'{}')::uuid from _ctx where key='r2'),false,'Completo esa noche');
insert into _p select 'decisions are final', pg_temp.denied(format('select public.venue_reservation_decide(%L,%L,false,null)',pg_temp.v(1),(select value#>>'{}' from _ctx where key='r1')));
select pg_temp.as_user(3);
insert into _ctx values ('mine', public.my_bookings());
insert into _p select 'person sees accepted and rejected with reason',
 (select array_agg(r->>'status' order by r->>'arriveAt') from jsonb_array_elements((select value->'reservations' from _ctx where key='mine')) r)
  = array['accepted','rejected','requested']
 and exists(select 1 from jsonb_array_elements((select value->'reservations' from _ctx where key='mine')) r where r->>'reason'='Completo esa noche');
select public.reservation_cancel((select (value#>>'{}')::uuid from _ctx where key='r3'));
insert into _p select 'person cancels a request', exists(select 1 from jsonb_array_elements(public.my_bookings()->'reservations') r
 where r->>'id'=(select value#>>'{}' from _ctx where key='r3') and r->>'status'='cancelled');

-- Guest list.
select pg_temp.as_user(1);
insert into _p select 'list title checked', pg_temp.err(format('select public.venue_guestlist_save(%L,%L,%L,2)',pg_temp.v(1),'ab',now()+interval '3 hours')) like '%invalid list%';
insert into _p select 'list ends within 12 hours', pg_temp.err(format('select public.venue_guestlist_save(%L,%L,%L,2)',pg_temp.v(1),'Gratis antes de la 1:30',now()+interval '13 hours')) like '%invalid list%';
select public.venue_guestlist_save(pg_temp.v(1), 'Gratis antes de la 1:30', now()+interval '3 hours', 2);
select pg_temp.as_user(3);
insert into _ctx select 'listId', public.venue_bookings(pg_temp.v(1))#>'{guestlist,id}';
insert into _ctx select 'e3', public.guestlist_join((select (value#>>'{}')::uuid from _ctx where key='listId'));
insert into _p select 'joining gives a 10-character code', (select value->>'code' from _ctx where key='e3') ~ '^[0-9A-F]{10}$';
insert into _p select 'joining twice keeps the same entry', public.guestlist_join((select (value#>>'{}')::uuid from _ctx where key='listId'))->>'id'
 = (select value->>'id' from _ctx where key='e3');
select pg_temp.as_user(4);
insert into _p select 'unverified age cannot join', pg_temp.denied(format('select public.guestlist_join(%L)',(select value#>>'{}' from _ctx where key='listId')));
select pg_temp.as_user(5);
insert into _ctx select 'e5', public.guestlist_join((select (value#>>'{}')::uuid from _ctx where key='listId'));
select pg_temp.as_user(6);
insert into _p select 'list capacity enforced', pg_temp.err(format('select public.guestlist_join(%L)',(select value#>>'{}' from _ctx where key='listId'))) like '%list_full%';
select pg_temp.as_user(5);
select public.guestlist_leave((select (value->>'id')::uuid from _ctx where key='e5'));
select pg_temp.as_user(6);
insert into _p select 'leaving frees a place', pg_temp.err(format('select public.guestlist_join(%L)',(select value#>>'{}' from _ctx where key='listId')))='ok';

-- The door.
select pg_temp.as_user(2);
insert into _p select 'other manager cannot check in', pg_temp.denied(format('select public.venue_guestlist_checkin(%L,%L)',pg_temp.v(1),(select value->>'code' from _ctx where key='e3')));
insert into _p select 'code does not work at another venue', pg_temp.err(format('select public.venue_guestlist_checkin(%L,%L)',pg_temp.v(2),(select value->>'code' from _ctx where key='e3'))) like '%invalid_code%';
select pg_temp.as_user(1);
insert into _p select 'wrong code refused', pg_temp.err(format('select public.venue_guestlist_checkin(%L,%L)',pg_temp.v(1),'0000000000')) like '%invalid_code%';
insert into _p select 'code accepted (spaces, dashes, lower case)', public.venue_guestlist_checkin(pg_temp.v(1),
 lower('NL-'||substr((select value->>'code' from _ctx where key='e3'),1,5)||' '||substr((select value->>'code' from _ctx where key='e3'),6)))->>'result'='ok';
insert into _p select 'a code works once', public.venue_guestlist_checkin(pg_temp.v(1),(select value->>'code' from _ctx where key='e3'))->>'result'='already_used';
insert into _p select 'cancelled entries cannot enter', pg_temp.err(format('select public.venue_guestlist_checkin(%L,%L)',pg_temp.v(1),(select value->>'code' from _ctx where key='e5'))) like '%invalid_code%';
insert into _p select 'door list shows names and states', (select array_agg(e->>'status' order by e->>'name') from jsonb_array_elements(public.venue_guestlist(pg_temp.v(1))#>'{list,entries}') e)
 = array['checked_in','confirmed'];
select pg_temp.as_user(3);
insert into _p select 'used entry no longer shows its code', (select e->>'code' from jsonb_array_elements(public.my_bookings()->'entries') e) is null;
insert into _p select 'export includes bookings without codes', jsonb_array_length(public.export_my_data()->'reservations')=3
 and not (public.export_my_data()#>'{guestlist_entries,0}' ? 'code');

-- Flag off again: people lose access at once.
reset role; update public.app_settings set value='off' where key='venue_bookings_enabled';
set local role authenticated; select pg_temp.as_user(3);
insert into _p select 'flag off: my bookings closed', pg_temp.denied('select public.my_bookings()');
reset role;

-- Maintenance: expire unanswered requests, close past lists, unlink after 90 days.
update public.app_settings set value='on' where key='venue_bookings_enabled';
set local role authenticated; select pg_temp.as_user(7);
select pg_temp.req(1,2);
reset role;
update private.venue_reservations set arrive_at=now()-interval '1 hour' where user_id='00000000-0000-4000-8000-00000000d607';
update private.venue_reservations set created_at=now()-interval '91 days' where user_id='00000000-0000-4000-8000-00000000d603' and status='rejected';
update private.venue_guestlists set night_date=night_date-2 where venue_id='00000000-0000-4000-8000-0000000d6e01';
select private.venue_bookings_maintenance();
insert into _p select 'unanswered request expires', (select status from private.venue_reservations where user_id='00000000-0000-4000-8000-00000000d607')='expired';
insert into _p select 'past list closed', (select status from private.venue_guestlists where venue_id='00000000-0000-4000-8000-0000000d6e01')='closed';
insert into _p select 'old booking unlinked from the person', exists(select 1 from private.venue_reservations where venue_id='00000000-0000-4000-8000-0000000d6e01'
 and user_id is null and status='rejected');
insert into _p select 'venue decisions and door audited', (select count(*) from public.admin_audit_log where action in
 ('reservation.accept','reservation.reject','guestlist.checkin') and created_at>=now()-interval '1 minute')=3;
update public.app_settings set value='off' where key='venue_bookings_enabled';

do $$ begin
 raise exception 'BOOKINGS RESULTS % passed / % failed: %',
  (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
