-- Block 5 · Server functions for sign-up, legal evidence, consents, profile, admin and
-- test data. Every function: SECURITY DEFINER, empty search_path, explicit checks.

-- ── HMAC key generated inside Vault (never in the repo, PRD 6.15 A04) ─────────
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ban_hmac_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'ban_hmac_key',
      'HMAC-SHA256 key for phone/device/IP identifiers'
    );
  end if;
end
$$;

create function private.hmac_hex(_value text)
returns text
language sql stable security definer set search_path = ''
as $$
  select encode(
    extensions.hmac(
      _value,
      (select decrypted_secret from vault.decrypted_secrets where name = 'ban_hmac_key'),
      'sha256'
    ),
    'hex'
  )
$$;

create function private.normalize_phone(_phone text)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(coalesce(_phone, ''), '[^0-9+]', '', 'g')
$$;

create function private.age_years(_birthdate date)
returns integer
language sql stable set search_path = ''
as $$
  select extract(year from age(current_date, _birthdate))::integer
$$;

create function private.latest_consent(_user uuid, _key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select granted from public.consent_records
    where user_id = _user and kind = 'consent' and consent_key = _key
    order by created_at desc, id desc
    limit 1
  ), false)
$$;

-- ── Pre-sign-up check: bans (phone/device HMAC) and anti-abuse limits ─────────
-- Callable before having an account. Answers are deliberately coarse (no detail on
-- why), so it cannot be used to learn anything about a number (PRD 5.2.4, API6).
create function public.check_signup(p_phone text, p_device_id text default null)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_phone text := private.normalize_phone(p_phone);
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text := coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    split_part(v_headers ->> 'x-forwarded-for', ',', 1),
    'unknown'
  );
  v_ip_hmac text;
  v_phone_hmac text;
  v_device_hmac text;
begin
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return 'invalid_phone';
  end if;
  if p_device_id is not null and char_length(p_device_id) > 128 then
    return 'invalid_phone';
  end if;

  v_ip_hmac := private.hmac_hex('ip:' || btrim(v_ip));
  v_phone_hmac := private.hmac_hex('phone:' || v_phone);

  delete from public.signup_attempts where created_at < now() - interval '1 day';
  if (select count(*) from public.signup_attempts
      where subject_hmac = v_ip_hmac and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.signup_attempts
         where subject_hmac = v_phone_hmac and created_at > now() - interval '1 hour') >= 5 then
    return 'rate_limited';
  end if;
  insert into public.signup_attempts (subject_hmac) values (v_ip_hmac), (v_phone_hmac);

  if p_device_id is not null then
    v_device_hmac := private.hmac_hex('device:' || p_device_id);
  end if;
  if exists (
    select 1 from public.ban_identifiers
    where (expires_at is null or expires_at > now())
      and ((kind = 'phone' and hmac = v_phone_hmac)
           or (kind = 'device' and hmac = v_device_hmac))
  ) then
    return 'blocked';
  end if;
  return 'ok';
end
$$;

-- ── Complete onboarding in ONE transaction (PRD 5.2, 6.1) ─────────────────────
-- The server re-validates everything the client sent: age ≥ 18, the three sign-up
-- documents signed at their CURRENT version, photos inside the user's own folder,
-- preferences only with the art. 9 orientation consent.
create function public.complete_onboarding(p jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_birth date;
  v_age integer;
  v_signed jsonb := coalesce(p -> 'signed', '[]'::jsonb);
  v_consents jsonb := coalesce(p -> 'consents', '{}'::jsonb);
  v_required text[] := array['terms', 'community', 'privacy'];
  v_photos text[];
  v_slug text;
  v_version text;
  v_key text;
  v_orientation boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and onboarded_at is not null) then
    raise exception 'already onboarded' using errcode = '23505';
  end if;

  begin
    v_birth := (p ->> 'birthdate')::date;
  exception when others then
    raise exception 'invalid birthdate' using errcode = '22023';
  end;
  v_age := private.age_years(v_birth);
  if v_birth is null or v_age < 18 or v_age > 110 then
    raise exception 'not eligible' using errcode = '22023';
  end if;

  foreach v_slug in array v_required loop
    v_version := private.current_document_version(v_slug);
    if v_version is null or not exists (
      select 1 from jsonb_array_elements(v_signed) s
      where s ->> 'slug' = v_slug and s ->> 'version' = v_version
    ) then
      raise exception 'legal documents not signed' using errcode = '22023';
    end if;
  end loop;

  select coalesce(array_agg(x), '{}') into v_photos
  from jsonb_array_elements_text(coalesce(p -> 'photos', '[]'::jsonb)) x;
  if cardinality(v_photos) not between 2 and 5 or exists (
    select 1 from unnest(v_photos) ph
    where ph !~ ('^' || v_uid::text || '/[0-9a-f-]{36}\.(webp|jpe?g|png)$')
  ) then
    raise exception 'invalid photos' using errcode = '22023';
  end if;

  insert into public.profiles (id, name, birthdate, gender, bio, photos, theme_id, city, language, onboarded_at)
  values (
    v_uid,
    btrim(p ->> 'name'),
    v_birth,
    (p ->> 'gender')::public.gender,
    coalesce(p ->> 'bio', ''),
    v_photos,
    coalesce(p ->> 'themeId', 'neon-noir'),
    nullif(btrim(p ->> 'city'), ''),
    coalesce(p ->> 'language', 'es'),
    now()
  )
  on conflict (id) do update set
    name = excluded.name, birthdate = excluded.birthdate, gender = excluded.gender,
    bio = excluded.bio, photos = excluded.photos, theme_id = excluded.theme_id,
    city = excluded.city, language = excluded.language, onboarded_at = excluded.onboarded_at;

  insert into public.verification_status (user_id, phone_verified)
  select v_uid, u.phone_confirmed_at is not null from auth.users u where u.id = v_uid
  on conflict (user_id) do update set phone_verified = excluded.phone_verified;

  insert into public.user_roles (user_id, role) values (v_uid, 'user') on conflict do nothing;

  -- Signature evidence: one immutable record per document and version.
  insert into public.consent_records (user_id, kind, document_slug, document_version, granted, method)
  select v_uid, 'legal', v_slug_row, private.current_document_version(v_slug_row), true, 'checkbox'
  from unnest(v_required) as v_slug_row;

  -- Every consent is recorded explicitly, granted or not (nothing pre-ticked).
  foreach v_key in array array['orientation', 'precise_location', 'marketing', 'analytics'] loop
    insert into public.consent_records (user_id, kind, consent_key, granted, method)
    values (
      v_uid, 'consent', v_key,
      coalesce((v_consents ->> v_key)::boolean, false),
      case when v_key = 'orientation' then 'signature' else 'toggle' end
    );
  end loop;

  v_orientation := coalesce((v_consents ->> 'orientation')::boolean, false);
  if v_orientation and jsonb_typeof(p -> 'preferences') = 'object' then
    insert into public.user_preferences (user_id, interested_in, age_min, age_max)
    values (
      v_uid,
      array(select jsonb_array_elements_text(p -> 'preferences' -> 'interestedIn')),
      (p -> 'preferences' ->> 'ageMin')::integer,
      (p -> 'preferences' ->> 'ageMax')::integer
    )
    on conflict (user_id) do update set
      interested_in = excluded.interested_in, age_min = excluded.age_min, age_max = excluded.age_max;
  end if;

  if nullif(p ->> 'deviceId', '') is not null then
    insert into public.user_devices (user_id, device_hmac)
    values (v_uid, private.hmac_hex('device:' || left(p ->> 'deviceId', 128)))
    on conflict do nothing;
  end if;

  -- The signed PDF goes by email once the address is confirmed (outbox, PRD 6.1).
  if nullif(btrim(p ->> 'email'), '') is not null then
    insert into public.email_outbox (user_id, template) values (v_uid, 'signed_documents');
  end if;
end
$$;

-- Re-acceptance of new versions (PRD 6.1): only current versions can be signed.
create function public.sign_documents(p_slugs text[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_slug text;
  v_version text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  foreach v_slug in array coalesce(p_slugs, '{}') loop
    v_version := private.current_document_version(v_slug);
    if v_version is null then
      raise exception 'unknown document' using errcode = '22023';
    end if;
    insert into public.consent_records (user_id, kind, document_slug, document_version, granted, method)
    values (v_uid, 'legal', v_slug, v_version, true, 'checkbox');
  end loop;
end
$$;

-- Consents: append a record only for what changed; revoking orientation deletes the
-- preferences it protected (PRD 6.12 A "hasta revocación").
create function public.save_consents(p_choices jsonb, p_city text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_key text;
  v_new boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  foreach v_key in array array['orientation', 'precise_location', 'marketing', 'analytics'] loop
    if p_choices ? v_key then
      v_new := (p_choices ->> v_key)::boolean;
      if v_new is distinct from private.latest_consent(v_uid, v_key) then
        insert into public.consent_records (user_id, kind, consent_key, granted, method)
        values (v_uid, 'consent', v_key, v_new,
                case when v_key = 'orientation' and v_new then 'signature' else 'toggle' end);
      end if;
    end if;
  end loop;
  if not private.latest_consent(v_uid, 'orientation') then
    delete from public.user_preferences where user_id = v_uid;
  end if;
  update public.profiles set city = nullif(btrim(p_city), '') where id = v_uid;
end
$$;

-- Owner edits a whitelist of fields only (PRD 6.15 API3: no mass assignment).
create function public.update_my_profile(p jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.profiles set
    bio = coalesce(p ->> 'bio', bio),
    traffic_light = coalesce((p ->> 'trafficLight')::public.traffic_light, traffic_light),
    discreet = coalesce((p ->> 'discreet')::boolean, discreet),
    theme_id = coalesce(p ->> 'themeId', theme_id),
    language = coalesce(p ->> 'language', language),
    last_active_at = now()
  where id = v_uid;

  if p ? 'interestedIn' or p ? 'ageMin' or p ? 'ageMax' then
    if not private.latest_consent(v_uid, 'orientation') then
      raise exception 'orientation consent required' using errcode = '42501';
    end if;
    update public.user_preferences set
      interested_in = coalesce(array(select jsonb_array_elements_text(p -> 'interestedIn')), interested_in),
      age_min = coalesce((p ->> 'ageMin')::integer, age_min),
      age_max = coalesce((p ->> 'ageMax')::integer, age_max)
    where user_id = v_uid;
  end if;
end
$$;

-- Profiles other people may see: safe columns only, rules in one place (PRD 4.2,
-- 6.15 API3). Test profiles only for testers/admins; blocks hide both ways.
create function public.search_public_profiles(p_limit integer default 20)
returns table (
  id uuid,
  name text,
  age integer,
  gender public.gender,
  bio text,
  traffic_light public.traffic_light,
  is_test boolean
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.name, private.age_years(p.birthdate), p.gender, p.bio, p.traffic_light, p.is_test
  from public.profiles p
  where (select auth.uid()) is not null
    and (private.is_age_verified((select auth.uid())) or private.sees_test_data())
    and p.id <> (select auth.uid())
    and p.onboarded_at is not null
    and not p.banned and not p.suspended
    and p.traffic_light <> 'red'
    and (not p.is_test or private.sees_test_data())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
    )
  order by p.last_active_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ── Admin (role admin + aal2, audited) ─────────────────────────────────────────
create function private.require_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admin with MFA required' using errcode = '42501';
  end if;
end
$$;

create function public.admin_set_flag(p_key text, p_value text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old text;
begin
  perform private.require_admin();
  select value into v_old from public.app_settings
  where key = p_key and kind = 'flag' and p_value = any (allowed_values);
  if not found then
    raise exception 'invalid flag value' using errcode = '22023';
  end if;
  update public.app_settings
  set value = p_value, updated_at = now(), updated_by = (select auth.uid())
  where key = p_key;
  perform private.audit('flag.update', format('%s: %s → %s', p_key, v_old, p_value));
end
$$;

create function public.admin_set_setting(p_key text, p_value integer)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old text;
begin
  perform private.require_admin();
  select value into v_old from public.app_settings
  where key = p_key and kind = 'setting' and p_value between min_value and max_value;
  if not found then
    raise exception 'invalid setting value' using errcode = '22023';
  end if;
  update public.app_settings
  set value = p_value::text, updated_at = now(), updated_by = (select auth.uid())
  where key = p_key;
  perform private.audit('setting.update', format('%s: %s → %s', p_key, v_old, p_value));
end
$$;

-- Users list for role management. Phones are masked; access is audited (PRD 6.15 D).
create function public.admin_list_users(p_query text default '', p_limit integer default 50)
returns table (
  id uuid,
  name text,
  phone_hint text,
  roles text[],
  is_test boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.audit('users.list', left(coalesce(p_query, ''), 40));
  return query
  select u.id,
         coalesce(p.name, '—'),
         case when u.phone is null then '—' else '••• ' || right(u.phone, 3) end,
         coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = u.id), '{}'),
         coalesce(p.is_test, false),
         u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where coalesce(p_query, '') = ''
     or p.name ilike '%' || p_query || '%'
     or right(coalesce(u.phone, ''), 4) = right(regexp_replace(p_query, '\D', '', 'g'), 4)
  order by u.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end
$$;

create function public.admin_set_role(p_user uuid, p_role public.app_role, p_granted boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_user = (select auth.uid()) and p_role = 'admin' and not p_granted then
    raise exception 'cannot remove your own admin role' using errcode = '42501';
  end if;
  if p_granted then
    insert into public.user_roles (user_id, role, granted_by)
    values (p_user, p_role, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;
  perform private.audit(case when p_granted then 'role.grant' else 'role.revoke' end,
                        format('%s · %s', p_user, p_role));
end
$$;

create function public.admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles where onboarded_at is not null and not is_test),
    'testUsers', (select count(*) from public.profiles where is_test),
    'ageVerifiedPercent', coalesce((
      select round(100.0 * count(*) filter (where v.age_verified) / nullif(count(*), 0))
      from public.verification_status v join public.profiles p on p.id = v.user_id
      where not p.is_test), 0),
    'matchesToday', (select count(*) from public.matches where created_at > now() - interval '1 day'),
    'pendingReports', (select count(*) from public.reports where status = 'open'),
    'pendingClaims', (select count(*) from public.venue_claims where status = 'pending'),
    'openDataRequests', (select count(*) from public.data_requests where status = 'open')
  );
end
$$;
