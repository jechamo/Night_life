-- RLS / privilege tests by role (PRD 3.4 "Tests de RLS por rol", 6.15 API1/API3/API5).
-- Runs inside ONE transaction that always ends in an error (= rollback): no data is left.
-- Any failed expectation raises an exception with the test name.
begin;

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, phone, phone_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '34600111901', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '34600111902', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test+rls@nightlife.test', null, null, now(), now()),
  ('00000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '34600111904', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '34600111905', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000000f', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '34600111906', now(), now(), now());

-- a = verified user, b = another real user, c = TEST profile, d = tester, e = admin,
-- f = fresh account without profile (onboarding tests)
insert into public.profiles (id, name, birthdate, gender, onboarded_at, is_test) values
  ('00000000-0000-4000-8000-00000000000a', 'Ana', '1995-05-01', 'woman', now(), false),
  ('00000000-0000-4000-8000-00000000000b', 'Bea', '1996-06-01', 'woman', now(), false),
  ('00000000-0000-4000-8000-00000000000c', 'Test', '1997-07-01', 'man', now(), true),
  ('00000000-0000-4000-8000-00000000000d', 'Tess', '1990-01-01', 'other', now(), false),
  ('00000000-0000-4000-8000-00000000000e', 'Adm', '1988-01-01', 'man', now(), false);
insert into public.verification_status (user_id, phone_verified, age_verified, age_mode) values
  ('00000000-0000-4000-8000-00000000000a', true, true, 'live'),
  ('00000000-0000-4000-8000-00000000000b', true, false, null),
  ('00000000-0000-4000-8000-00000000000c', true, true, 'sandbox'),
  ('00000000-0000-4000-8000-00000000000d', true, true, 'live');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-00000000000a', 'user'),
  ('00000000-0000-4000-8000-00000000000b', 'user'),
  ('00000000-0000-4000-8000-00000000000c', 'tester'),
  ('00000000-0000-4000-8000-00000000000d', 'tester'),
  ('00000000-0000-4000-8000-00000000000e', 'admin');
insert into public.consent_records (user_id, kind, consent_key, granted, method) values
  ('00000000-0000-4000-8000-00000000000b', 'consent', 'marketing', true, 'toggle');
-- Block 8 public discovery requires reciprocal consent, preferences and age for BOTH.
update public.app_settings set value='sandbox' where key='verification_mode';
insert into public.user_preferences(user_id,interested_in,age_min,age_max)
select id,array['women','men','non_binary'],18,60 from public.profiles where id in
 ('00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000c','00000000-0000-4000-8000-00000000000d');
insert into public.consent_records(user_id,kind,consent_key,granted,method)
select id,'consent','orientation',true,'signature' from public.profiles where id in
 ('00000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-00000000000c','00000000-0000-4000-8000-00000000000d');
insert into public.emergency_contacts (user_id, name, phone) values
  ('00000000-0000-4000-8000-00000000000b', 'Mamá', '+34600000001');

create temp table _results (test text primary key, ok boolean not null) on commit drop;
grant all on _results to anon, authenticated;

-- Evidence is append-only even for the database owner.
do $$
begin
  begin
    update public.consent_records set granted = false;
    insert into _results values ('consent_records immutable', false);
  exception when insufficient_privilege then
    insert into _results values ('consent_records immutable', true);
  end;
end $$;

-- ── anon ─────────────────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into _results select 'anon reads flags', count(*) = 19 from public.app_settings where kind = 'flag';
insert into _results select 'anon reads published legal docs', count(*) > 0 from public.legal_documents;
insert into _results select 'anon cannot see inactive premium terms', count(*) = 0 from public.legal_documents where slug = 'premium';
do $$
begin
  begin
    perform 1 from public.profiles;
    insert into _results values ('anon cannot read profiles', false);
  exception when insufficient_privilege then
    insert into _results values ('anon cannot read profiles', true);
  end;
  begin
    perform public.complete_onboarding('{}'::jsonb);
    insert into _results values ('anon cannot complete onboarding', false);
  exception when insufficient_privilege then
    insert into _results values ('anon cannot complete onboarding', true);
  end;
end $$;
reset role;

-- ── user A (verified) ────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}', true);
insert into _results select 'user sees only own profile', count(*) = 1 and bool_and(id = '00000000-0000-4000-8000-00000000000a') from public.profiles;
insert into _results select 'IDOR: cannot read other consents', count(*) = 0 from public.consent_records where user_id = '00000000-0000-4000-8000-00000000000b';
insert into _results select 'IDOR: cannot read other SOS contacts', count(*) = 0 from public.emergency_contacts where user_id = '00000000-0000-4000-8000-00000000000b';
insert into _results select 'user sees only own roles', count(*) = 1 from public.user_roles;
insert into _results select 'public profiles exclude test and unverified data', count(*) filter (where is_test) = 0 and count(*) filter (where name = 'Bea') = 0 and count(*) filter (where name = 'Tess') = 1 from public.search_public_profiles(50);
insert into _results select 'audit hidden from users', count(*) = 0 from public.admin_audit_log;
do $$
begin
  begin
    update public.profiles set banned = false where id = '00000000-0000-4000-8000-00000000000a';
    insert into _results values ('user cannot update profile columns directly', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot update profile columns directly', true);
  end;
  begin
    insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000000a', 'admin');
    insert into _results values ('user cannot grant roles', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot grant roles', true);
  end;
  begin
    insert into public.entitlements (user_id, key, source) values ('00000000-0000-4000-8000-00000000000a', 'see_likes', 'admin');
    insert into _results values ('user cannot grant entitlements', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot grant entitlements', true);
  end;
  begin
    insert into public.emergency_contacts (user_id, name, phone) values ('00000000-0000-4000-8000-00000000000b', 'X', '+34600000002');
    insert into _results values ('cannot write SOS contacts for others', false);
  exception when insufficient_privilege then
    insert into _results values ('cannot write SOS contacts for others', true);
  end;
  begin
    perform public.admin_set_flag('premium_enabled', 'off');
    insert into _results values ('user cannot change flags', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot change flags', true);
  end;
  begin
    perform public.admin_set_flag('email_login_enabled', 'on');
    insert into _results values ('user cannot turn on email sign-in', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot turn on email sign-in', true);
  end;
  begin
    perform public.admin_set_flag('live_status_enabled', 'on');
    insert into _results values ('user cannot turn on live status', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot turn on live status', true);
  end;
  begin
    perform public.admin_set_flag('venue_showcase_enabled', 'on');
    insert into _results values ('user cannot turn on the venue showcase', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot turn on the venue showcase', true);
  end;
  begin
    perform public.admin_set_flag('venue_bookings_enabled', 'on');
    insert into _results values ('user cannot turn on bookings', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot turn on bookings', true);
  end;
  begin
    perform public.purge_test_data();
    insert into _results values ('user cannot purge test data', false);
  exception when insufficient_privilege then
    insert into _results values ('user cannot purge test data', true);
  end;
end $$;
select public.save_emergency_contacts('[{"name":"Papá","phone":"+34600000003"}]');
insert into _results select 'user writes own SOS contacts', count(*) = 1 from public.emergency_contacts;
reset role;

-- ── user B (not age-verified): no public profiles at all ─────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated","aal":"aal1"}', true);
insert into _results select 'unverified user sees no profiles', count(*) = 0 from public.search_public_profiles(50);
reset role;

-- ── tester ───────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated","aal":"aal1"}', true);
insert into _results select 'tester sees test profiles', count(*) filter (where is_test) = 1 from public.search_public_profiles(50);
reset role;

-- ── admin without / with MFA ─────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated","aal":"aal1"}', true);
do $$
begin
  begin
    perform public.admin_set_flag('premium_enabled', 'off');
    insert into _results values ('admin needs MFA (aal2)', false);
  exception when insufficient_privilege then
    insert into _results values ('admin needs MFA (aal2)', true);
  end;
end $$;
insert into _results select 'admin aal1 cannot read others profiles', count(*) = 1 from public.profiles;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000e","role":"authenticated","aal":"aal2"}', true);
select public.admin_set_flag('premium_enabled', 'off');
insert into _results select 'admin with MFA changes flags', value = 'off' from public.app_settings where key = 'premium_enabled';
insert into _results select 'flag change is audited', count(*) = 1 from public.admin_audit_log where action = 'flag.update' and created_at >= now();
select public.admin_set_flag('email_login_enabled', 'on');
insert into _results select 'admin with MFA turns on email sign-in', value = 'on' from public.app_settings where key = 'email_login_enabled';
do $$
begin
  begin
    perform public.admin_set_flag('premium_enabled', 'maybe');
    insert into _results values ('invalid flag values rejected', false);
  exception when invalid_parameter_value then
    insert into _results values ('invalid flag values rejected', true);
  end;
end $$;
reset role;

-- ── onboarding validation (fresh account f) ──────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000f","role":"authenticated","aal":"aal1"}', true);
do $$
declare
  v_signed jsonb := '[{"slug":"terms","version":"1.0"},{"slug":"community","version":"1.0"},{"slug":"privacy","version":"1.0"}]';
  v_photos jsonb := '["00000000-0000-4000-8000-00000000000f/11111111-1111-4111-8111-111111111111.webp","00000000-0000-4000-8000-00000000000f/22222222-2222-4222-8222-222222222222.webp"]';
begin
  begin
    perform public.complete_onboarding(jsonb_build_object('birthdate', to_char(current_date - interval '17 years', 'YYYY-MM-DD'),
      'name', 'Kid', 'gender', 'man', 'photos', v_photos, 'signed', v_signed));
    insert into _results values ('minors rejected on the server', false);
  exception when invalid_parameter_value then
    insert into _results values ('minors rejected on the server', true);
  end;
  begin
    perform public.complete_onboarding(jsonb_build_object('birthdate', '1990-01-01',
      'name', 'Fer', 'gender', 'man', 'photos', v_photos, 'signed', '[]'::jsonb));
    insert into _results values ('legal signature required', false);
  exception when invalid_parameter_value then
    insert into _results values ('legal signature required', true);
  end;
  begin
    perform public.complete_onboarding(jsonb_build_object('birthdate', '1990-01-01',
      'name', 'Fer', 'gender', 'man', 'signed', v_signed,
      'photos', '["00000000-0000-4000-8000-00000000000a/11111111-1111-4111-8111-111111111111.webp","x"]'::jsonb));
    insert into _results values ('photos must be in own folder', false);
  exception when invalid_parameter_value then
    insert into _results values ('photos must be in own folder', true);
  end;
  perform public.complete_onboarding(jsonb_build_object('birthdate', '1990-01-01',
    'name', 'Fer', 'gender', 'man', 'photos', v_photos, 'signed', v_signed,
    'consents', '{"orientation":false,"marketing":true}'::jsonb,
    'preferences', '{"interestedIn":["women"],"ageMin":20,"ageMax":40}'::jsonb));
  insert into _results select 'valid onboarding creates profile', count(*) = 1 from public.profiles where onboarded_at is not null;
  insert into _results select 'signature evidence recorded', count(*) = 3 from public.consent_records where kind = 'legal';
  insert into _results select 'every consent recorded explicitly', count(*) = 4 from public.consent_records where kind = 'consent';
  insert into _results select 'no preferences without orientation consent', count(*) = 0 from public.user_preferences;
end $$;
reset role;

-- Report by aborting: the error carries the results AND guarantees a rollback, so the
-- script never commits fixtures even when run by a tool that auto-commits.
do $$
begin
  raise exception 'RLS RESULTS % passed / % failed: %',
    (select count(*) from _results where ok),
    (select count(*) from _results where not ok),
    coalesce((select string_agg(test, '; ') from _results where not ok), 'none failed');
end $$;
