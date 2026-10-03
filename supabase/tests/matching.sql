-- Block 8 acceptance/security tests. Deliberate final exception rolls back ALL fixtures.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated','346009998'||lpad(i::text,2,'0'),now(),now(),now()
from generate_series(1,9) i;
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test,city)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,'Social test '||i,'1996-01-01',
 (case when i in(1,8,9) then 'man' else 'woman' end)::public.gender,now(),i<>9,'Madrid' from generate_series(1,9) i;
insert into public.user_roles(user_id,role)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,'tester' from generate_series(1,8) i;
insert into public.verification_status(user_id,age_verified,age_mode)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,i<>8,case when i=9 then 'live' else 'sandbox' end
from generate_series(1,9) i;
insert into public.user_preferences(user_id,interested_in,age_min,age_max)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,array['women','men','non_binary'],18,60 from generate_series(1,9) i;
insert into public.consent_records(user_id,kind,consent_key,granted,method)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,'consent','orientation',true,'signature' from generate_series(1,9) i;
update public.app_settings set value='sandbox' where key='verification_mode';
update public.app_settings set value='on' where key in('test_tools_enabled','premium_enabled');
update public.app_settings set value='5' where key='free_daily_likes';
insert into public.venues(id,name,type,address,location,city,is_test) values
 ('00000000-0000-4000-8000-0000000be801','Social venue','club','Test address',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Madrid',true);
insert into public.attendance(user_id,venue_id,kind,visible,expires_at,is_test)
select ('00000000-0000-4000-8000-00000000b8'||lpad(i::text,2,'0'))::uuid,
 '00000000-0000-4000-8000-0000000be801',case when i=3 then 'going' else 'check_in' end,true,now()+interval '1 hour',true
from generate_series(1,3) i;
create temp table _b8_results(test text primary key,ok boolean not null);
create temp table _b8_ctx(key text primary key,value jsonb);
grant all on _b8_results,_b8_ctx to authenticated;
create function pg_temp.denied(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false;
exception when insufficient_privilege or no_data_found or invalid_parameter_value or program_limit_exceeded then return true;
end $$;
insert into _b8_results values
 ('anonymous cannot like',not has_function_privilege('anon','public.matching_like(uuid)','execute')),
 ('anonymous cannot send',not has_function_privilege('anon','public.chat_send(uuid,text)','execute')),
 ('cannot forge likes',not has_table_privilege('authenticated','public.likes','insert')),
 ('cannot forge messages',not has_table_privilege('authenticated','public.messages','insert')),
 ('cannot invoke like helper',not has_function_privilege('authenticated','private.social_like(uuid,uuid)','execute')),
 ('counter is private',not has_table_privilege('authenticated','private.social_daily_likes','select')),
 ('no public definer',not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated","aal":"aal1"}',true);
insert into _b8_ctx values('candidates',public.matching_candidates());
insert into _b8_results select 'reciprocal compatible candidates',jsonb_array_length(value)=6 from _b8_ctx where key='candidates';
insert into _b8_results select 'same venue now ranked first',value->0->'profile'->>'id'='00000000-0000-4000-8000-00000000b802' from _b8_ctx where key='candidates';
insert into _b8_results select 'context does not expose times or GPS',not (value->0->'context' ?| array['lat','lng','createdAt','expiresAt']) from _b8_ctx where key='candidates';
insert into _b8_results select 'public profile excludes sensitive fields',not (value->0->'profile' ?| array['birthdate','interestedIn','ageMin','is_test','discreet']) from _b8_ctx where key='candidates';
insert into _b8_results values('self like rejected',pg_temp.denied($q$select public.matching_like('00000000-0000-4000-8000-00000000b801')$q$));
insert into _b8_results values('undo needs entitlement',pg_temp.denied('select public.matching_undo()'));
reset role;
update public.profiles set discreet=true where id='00000000-0000-4000-8000-00000000b804';
update public.profiles set traffic_light='red' where id='00000000-0000-4000-8000-00000000b805';
update public.user_preferences set interested_in=array['women'] where user_id='00000000-0000-4000-8000-00000000b806';
update public.user_preferences set age_min=40 where user_id='00000000-0000-4000-8000-00000000b807';
set local role authenticated;
insert into _b8_results select 'discreet red reciprocal gender and age hidden',jsonb_array_length(public.matching_candidates())=2;
insert into _b8_results values('cannot like hidden person',pg_temp.denied($q$select public.matching_like('00000000-0000-4000-8000-00000000b804')$q$));
insert into _b8_ctx values('first_like',public.matching_like('00000000-0000-4000-8000-00000000b802'));
insert into _b8_results select 'one-sided like no match',value->'match'='null' and (value->>'usedToday')::int=1 from _b8_ctx where key='first_like';
insert into _b8_results select 'duplicate like does not consume quota',(public.matching_like('00000000-0000-4000-8000-00000000b802')->>'usedToday')::int=1;
insert into _b8_results select 'liked candidate removed from stack',jsonb_array_length(public.matching_candidates())=1;
select public.matching_pass('00000000-0000-4000-8000-00000000b803');
insert into _b8_results select 'pass persisted',jsonb_array_length(public.matching_candidates())=0;
reset role;
insert into public.entitlements(user_id,key,source,status,starts_at) values('00000000-0000-4000-8000-00000000b801','undo','tester','active',now());
set local role authenticated;
insert into _b8_results select 'entitled undo returns last candidate',public.matching_undo()->'profile'->>'id'='00000000-0000-4000-8000-00000000b803';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b802","role":"authenticated"}',true);
insert into _b8_results select 'likes hidden server-side without see_likes',public.matching_likes_you()->'profiles'='[]' and (public.matching_likes_you()->>'count')::int=1;
insert into _b8_ctx values('mutual',public.matching_like('00000000-0000-4000-8000-00000000b801'));
insert into _b8_results select 'mutual match created',value->'match'->>'id' is not null from _b8_ctx where key='mutual';
insert into _b8_results select 'match visible to second participant',jsonb_array_length(public.matching_matches())=1;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated"}',true);
insert into _b8_results select 'match visible to first participant',jsonb_array_length(public.matching_matches())=1;
insert into _b8_results select 'duplicate mutual like same match',public.matching_like('00000000-0000-4000-8000-00000000b802')->'match'->>'id'=value->'match'->>'id' from _b8_ctx where key='mutual';
insert into _b8_ctx select 'sent',public.chat_send((value->'match'->>'id')::uuid,'<script>plain text</script>') from _b8_ctx where key='mutual';
insert into _b8_results select 'chat persists plain text',value->>'text'='<script>plain text</script>' and (value->>'fromMe')::boolean from _b8_ctx where key='sent';
insert into _b8_results select 'empty message rejected',pg_temp.denied(format('select public.chat_send(%L,%L)',value->'match'->>'id','   ')) from _b8_ctx where key='mutual';
insert into _b8_results select 'oversize message rejected',pg_temp.denied(format('select public.chat_send(%L,%L)',value->'match'->>'id',repeat('x',1001))) from _b8_ctx where key='mutual';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b802","role":"authenticated"}',true);
insert into _b8_results select 'recipient sees incoming message',not (public.chat_messages((value->'match'->>'id')::uuid)->0->>'fromMe')::boolean from _b8_ctx where key='mutual';
insert into _b8_results select 'unread summary', (public.chat_summaries()->0->>'unread')::int=1;
select public.chat_read((value->'match'->>'id')::uuid) from _b8_ctx where key='mutual';
insert into _b8_results select 'mark read persisted', (public.chat_summaries()->0->>'unread')::int=0;
reset role;
insert into public.messages(match_id,sender_id,text)
select (value->'match'->>'id')::uuid,'00000000-0000-4000-8000-00000000b801','Page '||i
from _b8_ctx cross join generate_series(1,105) i where key='mutual';
set local role authenticated;
insert into _b8_ctx select 'page1',public.chat_messages((value->'match'->>'id')::uuid) from _b8_ctx where key='mutual';
insert into _b8_ctx select 'page2',public.chat_messages((m.value->'match'->>'id')::uuid,(p.value->0->>'sentAt')::timestamptz,(p.value->0->>'id')::uuid)
from _b8_ctx m,_b8_ctx p where m.key='mutual' and p.key='page1';
insert into _b8_results select 'messages capped at 100',jsonb_array_length(value)=100 from _b8_ctx where key='page1';
insert into _b8_results select 'compound cursor keeps same-time messages',jsonb_array_length(value)=6 from _b8_ctx where key='page2';
insert into _b8_results select 'pagination never duplicates messages',count(*)=count(distinct x->>'id') from _b8_ctx c cross join jsonb_array_elements(c.value) x where c.key in('page1','page2');
select public.chat_typing((value->'match'->>'id')::uuid,true) from _b8_ctx where key='mutual';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b803","role":"authenticated"}',true);
insert into _b8_results select 'outsider cannot read chat',pg_temp.denied(format('select public.chat_messages(%L)',value->'match'->>'id')) from _b8_ctx where key='mutual';
insert into _b8_results select 'outsider cannot send',pg_temp.denied(format('select public.chat_send(%L,%L)',value->'match'->>'id','hi')) from _b8_ctx where key='mutual';
insert into _b8_results select 'outsider cannot unmatch',pg_temp.denied(format('select public.matching_unmatch(%L)',value->'match'->>'id')) from _b8_ctx where key='mutual';
insert into _b8_results select 'outsider RLS hides match',not exists(select 1 from public.matches);
insert into _b8_results select 'outsider RLS hides messages',not exists(select 1 from public.messages);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b808","role":"authenticated"}',true);
insert into _b8_results values('tester role cannot bypass age',pg_temp.denied('select public.matching_candidates()'));
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b809","role":"authenticated"}',true);
insert into _b8_results select 'normal user cannot discover fixtures',jsonb_array_length(public.matching_candidates())=0;
insert into _b8_results values('normal user cannot simulate',pg_temp.denied($q$select public.sim_social('like')$q$));
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated"}',true);
select public.set_anthem('{"title":"Test track","artist":"Test artist"}');
reset role;
insert into _b8_results select 'anthem persisted and identified as simulated',anthem->>'title'='Test track' and (anthem->>'simulated')::boolean from public.profiles where id='00000000-0000-4000-8000-00000000b801';
update public.profiles set discreet=true where id='00000000-0000-4000-8000-00000000b802';
set local role authenticated;
insert into _b8_results select 'existing match survives discreet mode',jsonb_array_length(public.matching_matches())=1;
select public.matching_unmatch((value->'match'->>'id')::uuid) from _b8_ctx where key='mutual';
insert into _b8_results select 'unmatch removes chat access',pg_temp.denied(format('select public.chat_send(%L,%L)',value->'match'->>'id','hi')) from _b8_ctx where key='mutual';
insert into _b8_results select 'unmatch does not refund likes',(public.matching_status()->>'usedToday')::int=1;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b802","role":"authenticated"}',true);
insert into _b8_results select 'unmatch removed for both',jsonb_array_length(public.matching_matches())=0;
reset role;
insert into _b8_results select 'unmatch cascades messages',not exists(select 1 from public.messages where match_id=(select (value->'match'->>'id')::uuid from _b8_ctx where key='mutual'));
update public.profiles set discreet=false,traffic_light='green' where id in('00000000-0000-4000-8000-00000000b802','00000000-0000-4000-8000-00000000b804','00000000-0000-4000-8000-00000000b805');
update private.social_daily_likes set used=5 where user_id='00000000-0000-4000-8000-00000000b801';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated"}',true);
insert into _b8_results select 'free daily quota enforced',public.matching_like('00000000-0000-4000-8000-00000000b803')->>'error'='limit_reached';
reset role;
insert into public.entitlements(user_id,key,source,status,starts_at) values('00000000-0000-4000-8000-00000000b801','unlimited_likes','tester','active',now());
set local role authenticated;
insert into _b8_results select 'unlimited entitlement enforced by server',(public.matching_like('00000000-0000-4000-8000-00000000b803')->>'usedToday')::int=6;
select public.sim_social('like');
insert into _b8_results select 'simulator persists incoming test like',(public.matching_likes_you()->>'count')::int>0;
reset role;
insert into public.entitlements(user_id,key,source,status,starts_at)
values('00000000-0000-4000-8000-00000000b801','see_likes','tester','active',now());
set local role authenticated;
insert into _b8_results select 'see_likes entitlement reveals authorized profiles',jsonb_array_length(public.matching_likes_you()->'profiles')>0;
insert into _b8_ctx values('rematch',public.matching_like('00000000-0000-4000-8000-00000000b802'));
select public.sim_social('message');
insert into _b8_results select 'simulated message persisted',exists(select 1 from jsonb_array_elements(public.chat_summaries()) x where (x->>'unread')::int>0);
reset role;
update public.verification_status set age_verified=false where user_id='00000000-0000-4000-8000-00000000b802';
set local role authenticated;
insert into _b8_results select 'revoked peer verification hides match',jsonb_array_length(public.matching_matches())=0;
insert into _b8_results select 'revoked peer blocks chat access',pg_temp.denied(format('select public.chat_messages(%L)',value->'match'->>'id')) from _b8_ctx where key='rematch';
reset role;
update public.verification_status set age_verified=true where user_id='00000000-0000-4000-8000-00000000b802';
set local role authenticated;
select public.matching_block('00000000-0000-4000-8000-00000000b802');
insert into _b8_results select 'block removes existing match',jsonb_array_length(public.matching_matches())=0;
insert into _b8_results select 'blocked peer cannot read removed chat',pg_temp.denied(format('select public.chat_messages(%L)',value->'match'->>'id')) from _b8_ctx where key='rematch';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b802","role":"authenticated"}',true);
insert into _b8_results select 'blocked match removed from peer',jsonb_array_length(public.matching_matches())=0;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated"}',true);
select public.matching_block('00000000-0000-4000-8000-00000000b803');
insert into _b8_results select 'block hides target',public.matching_person('00000000-0000-4000-8000-00000000b803') is null;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b803","role":"authenticated"}',true);
insert into _b8_results select 'block hides blocker bidirectionally',public.matching_person('00000000-0000-4000-8000-00000000b801') is null;
insert into _b8_results values('blocked reciprocal like rejected',pg_temp.denied($q$select public.matching_like('00000000-0000-4000-8000-00000000b801')$q$));
reset role;
update public.app_settings set value='off' where key='test_tools_enabled';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b801","role":"authenticated"}',true);
insert into _b8_results values('simulator requires flag',pg_temp.denied($q$select public.sim_social('like')$q$));
reset role;
do $$ begin
 raise exception 'MATCHING RESULTS % passed / % failed: %',
 (select count(*) from _b8_results where ok),(select count(*) from _b8_results where not ok),
 coalesce((select string_agg(test,'; ') from _b8_results where not ok),'none failed');
end $$;
