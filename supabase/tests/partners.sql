-- Roadmap R3 «Partners y contratos»: roles, flag, contracts → advantages, city slots,
-- one-time invitations, venue terms and team rules. One transaction that always ends in an
-- error (= rollback): nothing is left.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
select ('00000000-0000-4000-8000-00000000d3'||lpad(i::text,2,'0'))::uuid,'00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','346009994'||lpad(i::text,2,'0'),now(),now(),now() from generate_series(1,5) i;
-- 01 admin, 02 future owner, 03 future staff, 04 plain user, 05 claimant
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
select ('00000000-0000-4000-8000-00000000d3'||lpad(i::text,2,'0'))::uuid,'Partner test '||i,'1990-01-01','woman',now(),false
from generate_series(1,5) i;
insert into public.user_roles(user_id,role) values ('00000000-0000-4000-8000-00000000d301','admin');
insert into public.venues(id,name,type,address,location,city,is_test)
select ('00000000-0000-4000-8000-0000000d3e0'||i)::uuid,'R3 venue '||i,'club','Test',
 extensions.st_setsrid(extensions.st_makepoint(-3.7,40.4),4326)::extensions.geography,'R3 Test City',false
from generate_series(1,5) i;
update public.app_settings set value='off' where key='venue_partners_enabled';
create temp table _p(test text primary key, ok boolean not null);
create temp table _ctx(key text primary key, value jsonb);
grant all on _p,_ctx to authenticated;
create function pg_temp.denied(q text) returns boolean language plpgsql as $$
begin execute q; return false;
exception when insufficient_privilege or invalid_parameter_value or no_data_found or unique_violation
 or program_limit_exceeded or invalid_authorization_specification then return true; end $$;
create function pg_temp.err(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create function pg_temp.as_user(n int, aal text default 'aal1') returns void language sql as $$
 select set_config('request.jwt.claims', json_build_object('sub',
  '00000000-0000-4000-8000-00000000d3'||lpad(n::text,2,'0'),'role','authenticated','aal',aal)::text, true) $$;

insert into _p values
 ('anon cannot run any partner RPC', not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname in ('public','private') and p.proname in ('admin_partners','admin_partner_save','admin_partner_link',
   'admin_contract_save','admin_contract_action','admin_venue_invite','admin_invite_revoke','admin_remove_manager',
   'venue_invite_preview','venue_invite_redeem','venue_partner_state','venue_team','venue_invite_staff','venue_invite_cancel',
   'venue_remove_manager') and has_function_privilege('anon',p.oid,'execute'))),
 ('partner tables closed to clients', not has_table_privilege('authenticated','private.venue_accounts','select')
   and not has_table_privilege('authenticated','private.venue_invitations','select')
   and not has_table_privilege('authenticated','private.venue_entitlements','select')),
 ('helpers not callable', not has_function_privilege('authenticated','private.contract_grant(uuid,uuid)','execute')
   and not has_function_privilege('authenticated','private.invite_code_hash(text)','execute')),
 ('existing managers kept as owners', not exists(select 1 from public.venue_managers where invited_by is null and role<>'owner'));

-- Admin gate.
set local role authenticated;
select pg_temp.as_user(4);
insert into _p select 'user cannot list partners', pg_temp.denied('select public.admin_partners()');
select pg_temp.as_user(1);
insert into _p select 'admin without MFA cannot list partners', pg_temp.denied('select public.admin_partners()');
select pg_temp.as_user(1,'aal2');
insert into _p select 'invalid tax id rejected',
 pg_temp.err($q$select public.admin_partner_save('{"legalName":"R3 SL","taxId":"123","contactName":"Ana","billingEmail":"a@r3.test"}')$q$) like '%invalid partner%';
insert into _ctx values('acc', to_jsonb(public.admin_partner_save(
 '{"legalName":"R3 Noches SL","taxId":"q-2999999-j","contactName":"Ana R3","billingEmail":"Facturas@R3.test"}')));
insert into _p select 'duplicate tax id rejected',
 pg_temp.err($q$select public.admin_partner_save('{"legalName":"Otra SL","taxId":"Q2999999J","contactName":"Ana","billingEmail":"b@r3.test"}')$q$) like '%duplicate_tax_id%';
select public.admin_partner_link((select (value#>>'{}')::uuid from _ctx where key='acc'),'00000000-0000-4000-8000-0000000d3e01',true);
insert into _p select 'tax id and email normalised', exists(select 1 from jsonb_array_elements(public.admin_partners()) a
 where a->>'taxId'='Q2999999J' and a->>'billingEmail'='facturas@r3.test' and jsonb_array_length(a->'venues')=1);
insert into _ctx select 'contract', to_jsonb(public.admin_contract_save(jsonb_build_object('accountId',(select value#>>'{}' from _ctx where key='acc'),
 'reference','R3-TEST-001','tier','top','pro',true,'startsOn',current_date,'endsOn',current_date+30)));
insert into _p select 'contract needs a sponsorship or Pro',
 pg_temp.err(format($q$select public.admin_contract_save('{"accountId":"%s","reference":"R3-TEST-002","tier":"none","pro":false,"startsOn":"2026-10-01","endsOn":"2026-11-01"}')$q$,
  (select value#>>'{}' from _ctx where key='acc'))) like '%invalid contract%';
reset role;
insert into _p select 'draft grants nothing', not private.venue_has_pro('00000000-0000-4000-8000-0000000d3e01')
 and not exists(select 1 from public.sponsorships where venue_id='00000000-0000-4000-8000-0000000d3e01');
set local role authenticated; select pg_temp.as_user(1,'aal2');
select public.admin_contract_action((select (value#>>'{}')::uuid from _ctx where key='contract'),'activate');
insert into _p select 'activation creates the Top sponsorship', exists(select 1 from public.sponsorships where venue_id='00000000-0000-4000-8000-0000000d3e01'
 and tier='top' and status='active' and invoice_ref='Contrato R3-TEST-001' and mode='live');
reset role;
insert into _p select 'activation grants Pro', private.venue_has_pro('00000000-0000-4000-8000-0000000d3e01');
set local role authenticated; select pg_temp.as_user(1,'aal2');
insert into _p select 'contract sponsorship appears on the map', exists(select 1 from jsonb_array_elements(public.visible_sponsorships()) x
 where x->>'id'='00000000-0000-4000-8000-0000000d3e01' and x->>'tier'='top');

-- City slots: two invoice sponsorships + the contract one; a third invoice one still fits.
reset role;
insert into public.sponsorships(venue_id,tier,status,starts_on,ends_on,invoice_ref) values
 ('00000000-0000-4000-8000-0000000d3e02','featured','active',current_date,current_date+10,'INV-R3-1'),
 ('00000000-0000-4000-8000-0000000d3e03','featured','active',current_date,current_date+10,'INV-R3-2'),
 ('00000000-0000-4000-8000-0000000d3e04','featured','requested',current_date,current_date+10,null),
 ('00000000-0000-4000-8000-0000000d3e05','featured','requested',current_date,current_date+10,null);
update public.app_settings set value='3' where key='sponsorship_slots';
set local role authenticated; select pg_temp.as_user(1,'aal2');
insert into _p select 'contract sponsorship does not use a city slot', pg_temp.err(format(
 $q$select public.admin_case_action('sponsorships','%s','activate','INV-R3-3')$q$,
 (select id from public.sponsorships where venue_id='00000000-0000-4000-8000-0000000d3e04'))) = 'ok';
insert into _p select 'invoice sponsorships still limited to 3 per city', pg_temp.err(format(
 $q$select public.admin_case_action('sponsorships','%s','activate','INV-R3-4')$q$,
 (select id from public.sponsorships where venue_id='00000000-0000-4000-8000-0000000d3e05'))) like '%no slots%';

-- Invitations.
insert into _ctx values('invite', public.admin_venue_invite('00000000-0000-4000-8000-0000000d3e01'));
reset role;
insert into _p select 'only an HMAC of the code is stored', not exists(select 1 from private.venue_invitations
 where code_hash ilike '%'||replace((select value->>'code' from _ctx where key='invite'),'-','')||'%')
 and exists(select 1 from private.venue_invitations where code_hash=private.invite_code_hash((select value->>'code' from _ctx where key='invite')));
set local role authenticated; select pg_temp.as_user(2);
insert into _p select 'flag off: invitations disabled', pg_temp.denied(format($q$select public.venue_invite_preview('%s')$q$,
 (select value->>'code' from _ctx where key='invite')));
reset role; update public.app_settings set value='on' where key='venue_partners_enabled';
set local role authenticated; select pg_temp.as_user(2);
insert into _p select 'wrong code rejected', pg_temp.err($q$select public.venue_invite_preview('0000-0000-0000')$q$) like '%invalid_code%';
insert into _p select 'preview shows venue and company', (select public.venue_invite_preview(lower(value->>'code'))->>'accountName' from _ctx where key='invite')='R3 Noches SL';
insert into _p select 'terms are mandatory', pg_temp.err(format($q$select public.venue_invite_redeem('%s', false)$q$,
 (select value->>'code' from _ctx where key='invite'))) like '%terms_required%';
insert into _ctx select 'redeem', public.venue_invite_redeem(value->>'code', true) from _ctx where key='invite';
insert into _p select 'redeem makes the person owner', (select value->>'role' from _ctx where key='redeem')='owner'
 and exists(select 1 from public.venue_managers where venue_id='00000000-0000-4000-8000-0000000d3e01'
  and user_id='00000000-0000-4000-8000-00000000d302' and role='owner');
reset role;
insert into _p select 'venue terms recorded', exists(select 1 from public.consent_records where user_id='00000000-0000-4000-8000-00000000d302'
 and kind='legal' and document_slug='venues' and document_version=private.current_document_version('venues'));
set local role authenticated; select pg_temp.as_user(2);
insert into _p select 'code works only once', pg_temp.err(format($q$select public.venue_invite_redeem('%s', true)$q$,
 (select value->>'code' from _ctx where key='invite'))) like '%invalid_code%';
insert into _ctx values('state', public.venue_partner_state('00000000-0000-4000-8000-0000000d3e01'));
insert into _p select 'plan shows contract and advantages', value->'contract'->>'reference'='R3-TEST-001'
 and value->'benefits' @> '[{"key":"sponsor_top","source":"contract"},{"key":"pro_stats","source":"contract"}]'
 and (value->>'termsAccepted')::boolean and value->>'role'='owner' from _ctx where key='state';
insert into _p select 'Pro shown as from the contract',
 public.venue_billing_state('00000000-0000-4000-8000-0000000d3e01')->>'proSource'='contract';

-- Team.
insert into _ctx values('staff', public.venue_invite_staff('00000000-0000-4000-8000-0000000d3e01'));
select pg_temp.as_user(3);
select public.venue_invite_redeem((select value->>'code' from _ctx where key='staff'), true);
insert into _p select 'staff cannot see or manage the team',
 pg_temp.denied($q$select public.venue_team('00000000-0000-4000-8000-0000000d3e01')$q$)
 and pg_temp.denied($q$select public.venue_invite_staff('00000000-0000-4000-8000-0000000d3e01')$q$);
insert into _p select 'staff can read the plan', (public.venue_partner_state('00000000-0000-4000-8000-0000000d3e01')->>'role')='staff';
select pg_temp.as_user(4);
insert into _p select 'other users cannot read the plan', pg_temp.denied($q$select public.venue_partner_state('00000000-0000-4000-8000-0000000d3e01')$q$);
select pg_temp.as_user(2);
insert into _p select 'owner sees the team', jsonb_array_length(public.venue_team('00000000-0000-4000-8000-0000000d3e01')->'members')=2;
insert into _p select 'owner cannot remove themselves', pg_temp.denied($q$select public.venue_remove_manager('00000000-0000-4000-8000-0000000d3e01','00000000-0000-4000-8000-00000000d302')$q$);
select public.venue_remove_manager('00000000-0000-4000-8000-0000000d3e01','00000000-0000-4000-8000-00000000d303');
insert into _p select 'owner removes staff and the role goes', not exists(select 1 from public.venue_managers where user_id='00000000-0000-4000-8000-00000000d303')
 and not exists(select 1 from public.user_roles where user_id='00000000-0000-4000-8000-00000000d303' and role='venue_manager');

-- Claims need the venue terms while the flag is on.
select pg_temp.as_user(5);
insert into _p select 'claim needs venue terms', pg_temp.err($q$select public.venue_claim('00000000-0000-4000-8000-0000000d3e05','CIF Q2999999J y factura')$q$) like '%terms_required%';

-- Expired and revoked invitations.
select pg_temp.as_user(1,'aal2');
insert into _ctx values('revoked', public.admin_venue_invite('00000000-0000-4000-8000-0000000d3e02'));
select public.admin_invite_revoke((select (value->>'id')::uuid from _ctx where key='revoked'));
reset role;
update private.venue_invitations set expires_at=now()-interval '1 minute' where venue_id='00000000-0000-4000-8000-0000000d3e01' and used_at is null;
insert into _ctx values('expired', jsonb_build_object('code','AAAA-BBBB-CCCC'));
insert into private.venue_invitations(venue_id,role,code_hash,expires_at) values
 ('00000000-0000-4000-8000-0000000d3e03','owner',private.invite_code_hash('AAAA-BBBB-CCCC'),now()-interval '1 day');
set local role authenticated; select pg_temp.as_user(4);
insert into _p select 'revoked invitation rejected', pg_temp.err(format($q$select public.venue_invite_preview('%s')$q$,
 (select value->>'code' from _ctx where key='revoked'))) like '%invalid_code%';
insert into _p select 'expired invitation rejected', pg_temp.err($q$select public.venue_invite_redeem('AAAA-BBBB-CCCC', true)$q$) like '%invalid_code%';

-- Ending the contract removes its advantages.
select pg_temp.as_user(1,'aal2');
select public.admin_contract_action((select (value#>>'{}')::uuid from _ctx where key='contract'),'end');
reset role;
insert into _p select 'ending the contract ends sponsorship and Pro',
 not exists(select 1 from public.sponsorships where venue_id='00000000-0000-4000-8000-0000000d3e01' and status='active')
 and not private.venue_has_pro('00000000-0000-4000-8000-0000000d3e01')
 and not exists(select 1 from private.venue_entitlements where venue_id='00000000-0000-4000-8000-0000000d3e01' and status='active');
insert into _p select 'partner actions audited', (select count(*) from public.admin_audit_log where action in
 ('partner.create','partner.link','contract.create','contract.activate','invite.create','invite.redeem','contract.end'))>=7;

do $$ begin
 raise exception 'PARTNERS RESULTS % passed / % failed: %',
  (select count(*) from _p where ok),(select count(*) from _p where not ok),
  coalesce((select string_agg(test,'; ') from _p where not ok),'none failed');
end $$;
