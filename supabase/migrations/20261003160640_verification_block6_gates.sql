-- Photo verification is tied to the main profile photo, even for privileged updates.
create function private.invalidate_main_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.photos[1] is distinct from new.photos[1] then
    update public.verification_status set photo_verified = false where user_id = new.id;
    update public.verification_sessions set state = 'reverification_required',reason = 'photo_changed'
      where user_id = new.id and level = 'photo' and active;
  end if;
  return new;
end $$;
create trigger profiles_invalidate_photo after update of photos on public.profiles
for each row execute function private.invalidate_main_photo();

-- Persist bans by keyed hashes; never copy a phone or raw device identifier.
create function private.persist_ban_hashes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if new.banned and not old.banned then
    select phone into v_phone from auth.users where id = new.id;
    if nullif(v_phone,'') is not null then
      insert into public.ban_identifiers(kind,hmac,reason) values('phone',private.hmac_hex(private.normalize_phone(v_phone)),'account_ban') on conflict(kind,hmac) do update set expires_at = null;
    end if;
    insert into public.ban_identifiers(kind,hmac,reason)
      select 'device',device_hmac,'account_ban' from public.user_devices where user_id = new.id
      on conflict(kind,hmac) do update set expires_at = null;
  end if;
  return new;
end $$;
create trigger profiles_ban_hashes after update of banned on public.profiles for each row execute function private.persist_ban_hashes();

create function private.possible_minor_reverification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.reason = 'possible_minor' and new.target_user_id is not null then
    update public.profiles set suspended = true where id = new.target_user_id;
    update public.verification_status set age_verified = false,reverification_required = true where user_id = new.target_user_id;
    update public.verification_sessions set active = false where user_id = new.target_user_id and level = 'age' and active;
  end if;
  return new;
end $$;
create trigger reports_possible_minor after insert on public.reports for each row execute function private.possible_minor_reverification();

-- Remove the tester bypass: a role grants test-data visibility, never age verification.
create or replace function private.search_public_profiles(p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender,bio text,traffic_light public.traffic_light,is_test boolean)
language sql stable security definer set search_path = '' as $$
  select p.id,p.name,private.age_years(p.birthdate),p.gender,p.bio,p.traffic_light,p.is_test
  from public.profiles p where private.is_age_verified((select auth.uid())) and p.id <> (select auth.uid())
    and p.onboarded_at is not null and not p.banned and not p.suspended and p.traffic_light <> 'red'
    and (not p.is_test or private.sees_test_data())
    and not exists(select 1 from public.blocks b where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = (select auth.uid())))
  order by p.last_active_at desc limit least(greatest(p_limit,1),50)
$$;
drop policy "likes: own sent" on public.likes;
create policy "likes: verified owner" on public.likes for select to authenticated using(from_user = (select auth.uid()) and private.is_age_verified((select auth.uid())));
drop policy "matches: participants" on public.matches;
create policy "matches: verified participants" on public.matches for select to authenticated using((select auth.uid()) in (user_a,user_b) and private.is_age_verified((select auth.uid())));
drop policy "messages: participants" on public.messages;
create policy "messages: verified participants" on public.messages for select to authenticated using(private.in_match(match_id) and private.is_age_verified((select auth.uid())));

revoke execute on function private.verification_snapshot(),private.begin_verification(text,text,boolean),private.simulate_verification_result(text,text),private.request_verification_review(text),private.attach_verification_provider(uuid,uuid),private.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer),private.invalidate_main_photo(),private.persist_ban_hashes(),private.possible_minor_reverification() from public,anon,authenticated;
revoke execute on function public.verification_snapshot(),public.begin_verification(text,text,boolean),public.simulate_verification_result(text,text),public.request_verification_review(text),public.attach_verification_provider(uuid,uuid),public.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function private.verification_snapshot(),public.verification_snapshot(),private.begin_verification(text,text,boolean),public.begin_verification(text,text,boolean),private.simulate_verification_result(text,text),public.simulate_verification_result(text,text),private.request_verification_review(text),public.request_verification_review(text),private.is_age_verified(uuid) to authenticated;
grant execute on function private.attach_verification_provider(uuid,uuid),public.attach_verification_provider(uuid,uuid),private.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer),public.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer) to service_role;
