-- OpenStreetMap import gate: admin + aal2 only, server-side validation, idempotent upsert,
-- manual edits never overwritten, attribution source exposed, unknown price kept null.
-- No call to Overpass. Always aborts the transaction with a result summary.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
values('00000000-0000-4000-8000-00000000b801','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','34600999801',now(),now(),now());
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
values('00000000-0000-4000-8000-00000000b801','OSM admin','1990-01-01','woman',now(),false);
insert into public.user_roles(user_id,role) values('00000000-0000-4000-8000-00000000b801','admin');
create temp table _results(test text primary key,ok boolean not null);
create temp table _ctx(key text primary key,value jsonb);
grant all on _results,_ctx to authenticated;

insert into _results values('anon cannot import',not has_function_privilege('anon',
 'public.admin_import_osm_venues(text,jsonb)','execute'));
insert into _results values('no public definer',not exists(select 1 from pg_proc p join pg_namespace n
 on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef));

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.admin_import_osm_venues('Madrid','[]'::jsonb);
  insert into _results values('aal1 admin cannot import',false);
 exception when insufficient_privilege then insert into _results values('aal1 admin cannot import',true); end;
end $$;

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated","aal":"aal2"}',true);
do $$ begin
 begin perform public.admin_import_osm_venues('Lisboa','[]'::jsonb);
  insert into _results values('unknown city rejected',false);
 exception when invalid_parameter_value then insert into _results values('unknown city rejected',true); end;
end $$;
insert into _ctx select 'first',public.admin_import_osm_venues('Madrid','[
 {"ref":"node/990000001","name":"Test OSM Bar","type":"bar","lat":40.4170,"lng":-3.7030,
  "address":"Calle Test 1","website":"https://bar.example","phone":"+34 910 000 000",
  "openingHours":[{"day":4,"opens":"20:00","closes":"03:00"}],"music":["techno"],"minAge":21},
 {"ref":"node/990000002","name":"Bad hours","type":"pub","lat":40.4171,"lng":-3.7031,
  "website":"http://insecure.example","openingHours":[{"day":9,"opens":"x","closes":"y"}],"minAge":30},
 {"ref":"evil/1","name":"Bad ref","type":"bar","lat":40.41,"lng":-3.70},
 {"ref":"node/990000003","name":"Too far","type":"bar","lat":41.3874,"lng":2.1686},
 {"ref":"node/990000004","name":"Bad type","type":"cafe","lat":40.41,"lng":-3.70},
 {"ref":"node/990000005","name":"","type":"bar","lat":40.41,"lng":-3.70},
 {"ref":"node/990000006","name":"String coords","type":"bar","lat":"40.41","lng":"-3.70"}
]'::jsonb);
reset role;
insert into _results select 'valid rows added, invalid skipped',
 (value->>'added')::int=2 and (value->>'skipped')::int=5 from _ctx where key='first';
insert into _results select 'stored as osm, not catalogue-owned, price unknown',
 location_source='osm' and not catalog_owned and price is null and website='https://bar.example'
 and min_age=21 and music='{techno}' and city='Madrid'
 from public.venues where osm_ref='node/990000001';
insert into _results select 'unsafe fields cleaned',website='' and opening_hours='[]'::jsonb and min_age is null
 from public.venues where osm_ref='node/990000002';

set local role authenticated;
insert into _ctx select 'second',public.admin_import_osm_venues('Madrid','[
 {"ref":"node/990000001","name":"Test OSM Bar renamed","type":"pub","lat":40.4170,"lng":-3.7030}
]'::jsonb);
reset role;
insert into _results select 'reimport updates, no duplicate',(value->>'updated')::int=1
 and (select count(*) from public.venues where osm_ref='node/990000001')=1
 and (select name from public.venues where osm_ref='node/990000001')='Test OSM Bar renamed'
 from _ctx where key='second';

set local role authenticated;
select public.update_venue_details((select id from public.venues where osm_ref='node/990000001'),
 '{"name":"Edited by hand","price":3,"lat":40.4172,"lng":-3.7032}'::jsonb);
insert into _ctx select 'third',public.admin_import_osm_venues('Madrid','[
 {"ref":"node/990000001","name":"OSM again","type":"bar","lat":40.4170,"lng":-3.7030}
]'::jsonb);
insert into _ctx select 'search',jsonb_path_query_first(
 public.search_places(40.4172,-3.7032,'Edited by hand',null,null,null,null,null,null,null,null,'distance',5),'$[0]');
insert into _ctx select 'admin_list',public.admin_list_venues('Edited by hand',null);
reset role;
insert into _results select 'manual edit kept on reimport',(value->>'kept')::int=1
 and (select name from public.venues where osm_ref='node/990000001')='Edited by hand'
 from _ctx where key='third';
insert into _results select 'edit keeps osm source (attribution)',location_source='osm' and catalog_owned
 from public.venues where osm_ref='node/990000001';
insert into _results select 'search exposes source and price',value->>'source'='osm'
 and (value->>'price')::int=3 from _ctx where key='search';
insert into _results select 'admin search finds it',jsonb_array_length(value)=1
 from _ctx where key='admin_list';
insert into _results select 'import audited',count(*)>=3 from public.admin_audit_log
 where action='venue.osm_import' and actor_id='00000000-0000-4000-8000-00000000b801';
do $$ begin
 raise exception 'OSM RESULTS % passed / % failed: %',
 (select count(*) from _results where ok),(select count(*) from _results where not ok),
 coalesce((select string_agg(test,'; ') from _results where not ok),'none failed');
end $$;
