import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('.tmp', { recursive: true })
const ids = ['00000000-0000-4000-8000-00000000e801', '00000000-0000-4000-8000-00000000e802']
const emails = ['block8-realtime-a@nightlife.test', 'block8-realtime-b@nightlife.test']
const password = randomBytes(28).toString('hex')
writeFileSync('.tmp/block8-live-credentials.json', JSON.stringify({ ids, emails, password }))
const rows = ids
  .map(
    (id, i) =>
      `('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${emails[i]}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','','','','', '{"provider":"email","providers":["email"]}','{"is_test":true}',now(),now())`,
  )
  .join(',')
const sql = `begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,phone_change,phone_change_token,reauthentication_token,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ${rows};
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
select id::text,id,jsonb_build_object('sub',id,'email',email,'email_verified',true),'email',now(),now() from auth.users where id in('${ids[0]}','${ids[1]}');
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test,city) values
('${ids[0]}','Block8 realtime tester A','1996-01-01','man',now(),true,'Madrid'),
('${ids[1]}','Block8 realtime tester B','1996-01-01','woman',now(),true,'Madrid');
insert into public.user_roles(user_id,role) select id,'tester' from public.profiles where id in('${ids[0]}','${ids[1]}');
insert into public.verification_status(user_id,age_verified,age_mode) select id,true,'sandbox' from public.profiles where id in('${ids[0]}','${ids[1]}');
insert into public.user_preferences(user_id,interested_in,age_min,age_max) select id,array['women','men','non_binary'],18,60 from public.profiles where id in('${ids[0]}','${ids[1]}');
insert into public.consent_records(user_id,kind,consent_key,granted,method) select p.id,'consent',k,true,'signature' from public.profiles p cross join unnest(array['orientation','precise_location']) k where id in('${ids[0]}','${ids[1]}');
insert into public.venues(id,name,type,address,location,city,is_test) values('00000000-0000-4000-8000-0000000ee801','Block8 realtime venue','club','Test address',extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'Madrid',true);
commit;`
writeFileSync('.tmp/block8-live-setup.sql', sql)
writeFileSync(
  '.tmp/block8-live-cleanup.sql',
  `begin;
delete from public.venues where id='00000000-0000-4000-8000-0000000ee801' and is_test and name='Block8 realtime venue';
delete from auth.users where id in('${ids[0]}','${ids[1]}') and email in('${emails[0]}','${emails[1]}') and raw_user_meta_data->>'is_test'='true';
commit;
select count(*) as profiles,count(*) filter(where is_test) as fixtures from public.profiles;`,
)
console.log('Prepared 2 temporary is_test accounts; credentials kept in ignored local files.')
