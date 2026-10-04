-- Own fixtures, uncommitted throughout; final result exception forces rollback.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
values('00000000-0000-4000-8000-00000000ba10','00000000-0000-0000-0000-000000000000','authenticated','authenticated','449990009910',now(),now(),now());
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
values('00000000-0000-4000-8000-00000000ba10','Privacy fixture','1995-01-01','man',now(),false);
insert into public.venues(id,name,type,address,location,city,is_test) values
('00000000-0000-4000-8000-00000000bb11','B10Privacy Z single','club','Fixture',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Madrid',false),
('00000000-0000-4000-8000-00000000bb14','B10Privacy A four','club','Fixture',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Madrid',false),
('00000000-0000-4000-8000-00000000bb15','B10Privacy M five','club','Fixture',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Madrid',false);
insert into public.place_stats(venue_id,people) values
('00000000-0000-4000-8000-00000000bb11',1),
('00000000-0000-4000-8000-00000000bb14',4),
('00000000-0000-4000-8000-00000000bb15',5)
on conflict(venue_id) do update set people=excluded.people;
create temp table _privacy_results(test text primary key,ok boolean not null);
create temp table _privacy_output(sort text primary key,data jsonb not null);
grant all on _privacy_results,_privacy_output to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ba10","role":"authenticated","aal":"aal1"}',true);
insert into _privacy_output select 'asc',public.search_places(p_query=>'B10Privacy',p_sort=>'people_asc');
insert into _privacy_output select 'desc',public.search_places(p_query=>'B10Privacy',p_sort=>'people_desc');
insert into _privacy_results select 'sort metadata never public',not exists(select 1 from _privacy_output,jsonb_array_elements(data) x where x?'sort_key');
insert into _privacy_results select 'small counts bucketed and five retained',
 (select array_agg((x->>'people')::int order by x->>'name') from _privacy_output,jsonb_array_elements(data)x where sort='asc')=array[4,5,4];
insert into _privacy_results select 'ascending order uses public bucket',
 (select array_agg(x->>'name' order by n) from _privacy_output,jsonb_array_elements(data) with ordinality a(x,n) where sort='asc')=array['B10Privacy A four','B10Privacy Z single','B10Privacy M five'];
insert into _privacy_results select 'descending order uses public bucket',
 (select array_agg(x->>'name' order by n) from _privacy_output,jsonb_array_elements(data) with ordinality a(x,n) where sort='desc')=array['B10Privacy M five','B10Privacy A four','B10Privacy Z single'];
reset role;
do $$ declare summary jsonb; begin
 select jsonb_build_object('passed',count(*) filter(where ok),'total',count(*),'failed',coalesce(jsonb_agg(test) filter(where not ok),'[]')) into summary from _privacy_results;
 raise exception 'BLOCK10_PRIVACY_RESULTS %',summary;
end $$;
rollback;
