-- Block 10: repeat the ban check in the authoritative onboarding transaction.
-- Auth stores phone digits without +; retain compatibility with historical HMACs.
create function private.signup_blocked(p_phone text,p_device text default null)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.ban_identifiers where (expires_at is null or expires_at>now()) and (
  (kind='phone' and nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'') is not null and hmac=any(array[
    private.hmac_hex('phone:+'||regexp_replace(p_phone,'[^0-9]','','g')),
    private.hmac_hex('phone:'||regexp_replace(p_phone,'[^0-9]','','g')),
    private.hmac_hex('+'||regexp_replace(p_phone,'[^0-9]','','g')),
    private.hmac_hex(regexp_replace(p_phone,'[^0-9]','','g'))]))
  or (kind='device' and nullif(p_device,'') is not null and hmac=private.hmac_hex('device:'||p_device))
 ))
$$;
create function private.require_signup_eligible(p_device text) returns void
language plpgsql security definer set search_path='' as $$
declare u auth.users;
begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or nullif(u.phone,'') is null or u.phone_confirmed_at is null then
  raise exception 'verified phone required' using errcode='42501';
 end if;
 if char_length(coalesce(p_device,''))>128 then raise exception 'invalid device' using errcode='22023'; end if;
 if private.signup_blocked(u.phone,p_device) then raise exception 'not eligible' using errcode='42501'; end if;
end $$;
revoke all on function private.signup_blocked(text,text),private.require_signup_eligible(text) from public,anon,authenticated;

create or replace function private.check_signup(p_phone text, p_device_id text default null)
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

  perform pg_advisory_xact_lock(hashtextextended('signup-ip:' || v_ip_hmac, 0));
  perform pg_advisory_xact_lock(hashtextextended('signup-phone:' || v_phone_hmac, 0));
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
  if private.signup_blocked(v_phone, p_device_id) then
    return 'blocked';
  end if;
  return 'ok';
end
$$;

create or replace function private.complete_onboarding(p jsonb)
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

  perform private.require_signup_eligible(p ->> 'deviceId');

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

create or replace function private.persist_ban_hashes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if new.banned and not old.banned then
    select phone into v_phone from auth.users where id = new.id;
    if nullif(v_phone,'') is not null then
      insert into public.ban_identifiers(kind,hmac,reason) values('phone',private.hmac_hex('phone:' || private.normalize_phone(v_phone)),'account_ban') on conflict(kind,hmac) do update set expires_at = null;
    end if;
    insert into public.ban_identifiers(kind,hmac,reason)
      select 'device',device_hmac,'account_ban' from public.user_devices where user_id = new.id
      on conflict(kind,hmac) do update set expires_at = null;
  end if;
  return new;
end $$;

-- Shared SMTP allowance, reserved before PDF generation/SMTP, including failures.
create table private.document_delivery_limits(subject text primary key,window_start timestamptz not null,used int not null check(used between 1 and 50));
alter table private.document_delivery_limits enable row level security;
revoke all on private.document_delivery_limits from public,anon,authenticated;
create function private.reserve_document_email(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_subject text; cap int; usage int; current_window timestamptz;
begin
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and nullif(email,'') is not null) then return false; end if;
 foreach v_subject in array array['global',p_user::text] loop
  cap:=case when v_subject='global' then 50 else 3 end;
  current_window:=case when v_subject='global' then date_trunc('day',now()) else date_trunc('hour',now()) end;
  perform pg_advisory_xact_lock(hashtextextended('document-email:'||v_subject,0));
  select used into usage from private.document_delivery_limits d where d.subject=v_subject and window_start=current_window;
  if coalesce(usage,0)>=cap then return false; end if;
 end loop;
 foreach v_subject in array array['global',p_user::text] loop
  current_window:=case when v_subject='global' then date_trunc('day',now()) else date_trunc('hour',now()) end;
  insert into private.document_delivery_limits values(v_subject,current_window,1)
  on conflict(subject) do update set window_start=excluded.window_start,used=case when document_delivery_limits.window_start=excluded.window_start then document_delivery_limits.used+1 else 1 end;
 end loop;
 delete from private.document_delivery_limits where window_start<now()-interval '2 days';
 return true;
end $$;
create function public.reserve_document_email(p_user uuid) returns boolean
language sql security invoker set search_path='' as $$ select private.reserve_document_email(p_user) $$;
revoke all on function public.reserve_document_email(uuid),private.reserve_document_email(uuid) from public,anon,authenticated;
grant execute on function public.reserve_document_email(uuid),private.reserve_document_email(uuid) to service_role;

-- Admission controls shared by admin RPCs and administrator RLS.
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role('admin') and (select auth.jwt()->>'aal')='aal2'
 and exists(select 1 from public.profiles where id=auth.uid() and onboarded_at is not null and not banned and not suspended)
$$;

-- Bound each UID to ten flat images (five profile images plus five replacements).
-- Serialize admissions before counting, rather than relying on a racy client check.
create function private.allow_profile_photo_upload(p_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or p_name !~ ('^'||uid::text||'/[0-9a-f-]{36}\.(webp|jpe?g|png)$') then return false; end if;
 if exists(select 1 from public.profiles where id=uid and (banned or suspended)) then return false; end if;
 perform private.require_signup_eligible(null);
 perform pg_advisory_xact_lock(hashtextextended('photo-upload:'||uid::text,0));
 return (select count(*) from storage.objects where bucket_id='profile-photos' and name like uid::text||'/%')<10;
end $$;
revoke all on function private.allow_profile_photo_upload(text) from public,anon;
grant execute on function private.allow_profile_photo_upload(text) to authenticated;
alter policy "profile photos: own upload" on storage.objects with check(bucket_id='profile-photos' and private.allow_profile_photo_upload(name));
-- UPDATE cannot move a legacy nested object or overwrite a banned account's image.
alter policy "profile photos: own update" on storage.objects using(false) with check(false);

-- Bounded, idempotent legal signing: immutable evidence is not an append API.
create or replace function private.sign_documents(p_slugs text[])
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
  if coalesce(cardinality(p_slugs),0) not between 1 and 8 then raise exception 'invalid documents' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('legal-sign:'||v_uid::text,0));
  foreach v_slug in array coalesce(p_slugs, '{}') loop
    v_version := private.current_document_version(v_slug);
    if v_version is null then
      raise exception 'unknown document' using errcode = '22023';
    end if;
    insert into public.consent_records (user_id, kind, document_slug, document_version, granted, method)
    select v_uid, 'legal', v_slug, v_version, true, 'checkbox'
    where not exists(select 1 from public.consent_records where user_id=v_uid and kind='legal' and document_slug=v_slug and document_version=v_version);
  end loop;
end
$$;

-- Link historical trigger hashes to their existing decisions so lifting a ban
-- expires every format for that decision; do not drop retained deleted-account bans.
insert into private.ban_links(ban_id,identifier_id)
select b.id,i.id from public.bans b join auth.users u on u.id=b.user_id
join public.ban_identifiers i on i.kind='phone' and i.reason='account_ban'
 and i.hmac=any(array[private.hmac_hex(private.normalize_phone(u.phone)),private.hmac_hex('+'||regexp_replace(u.phone,'[^0-9]','','g'))])
where nullif(u.phone,'') is not null on conflict do nothing;
