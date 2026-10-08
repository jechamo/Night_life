-- Roadmap 2026-10 R3 (2/5): helpers and minimal changes to existing functions.
create function private.require_partners() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := private.require_registered();
begin
 if coalesce(private.flag_value('venue_partners_enabled'), 'off') <> 'on' then
  raise exception 'disabled' using errcode = '42501';
 end if;
 return u;
end $$;

create function private.venue_role(p_venue uuid) returns text
language sql stable security definer set search_path = '' as $$
 select role from public.venue_managers where venue_id = p_venue and user_id = (select auth.uid())
$$;

create function private.require_venue_owner(p_venue uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_partners();
begin
 perform private.require_place(p_venue);
 if coalesce(private.venue_role(p_venue), '') <> 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
 return u;
end $$;

create function private.invite_code_hash(p_code text) returns text
language sql stable security definer set search_path = '' as $$
 select private.hmac_hex('venue-invite:' || upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')))
$$;

-- New code XXXX-XXXX-XXXX (48 random bits; redemption is rate limited).
create function private.new_venue_invitation(p_venue uuid, p_account uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare raw text; code text; inv private.venue_invitations;
begin
 raw := upper(encode(extensions.gen_random_bytes(6), 'hex'));
 code := substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
 insert into private.venue_invitations(venue_id, account_id, role, code_hash, expires_at, created_by)
 values (p_venue, p_account, p_role, private.invite_code_hash(code), now() + interval '7 days', auth.uid())
 returning * into inv;
 return jsonb_build_object('id', inv.id, 'code', code, 'expiresAt', inv.expires_at, 'role', p_role);
end $$;

-- Grants one venue the advantages of an active contract.
create function private.contract_grant(p_contract uuid, p_venue uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c private.venue_contracts; acc private.venue_accounts; v_mode text; sp uuid;
begin
 select * into c from private.venue_contracts where id = p_contract and status = 'active';
 if not found or c.ends_on < current_date then return; end if;
 select * into acc from private.venue_accounts where id = c.account_id;
 v_mode := case when acc.is_test then 'test' else 'live' end;
 if c.tier <> 'none' and not exists (select 1 from private.venue_entitlements where contract_id = c.id
   and venue_id = p_venue and key = 'sponsor_' || c.tier and status = 'active') then
  if exists (select 1 from public.sponsorships where venue_id = p_venue and status in ('requested', 'active')
    and starts_on <= c.ends_on and ends_on >= greatest(c.starts_on, current_date)) then
   raise exception 'already_sponsored' using errcode = '23505';
  end if;
  insert into public.sponsorships(venue_id, tier, status, starts_on, ends_on, invoice_ref, requested_by, mode)
  values (p_venue, c.tier, 'active', greatest(c.starts_on, current_date), c.ends_on, left('Contrato ' || c.reference, 40), auth.uid(), v_mode)
  returning id into sp;
  insert into private.venue_entitlements(venue_id, key, source, contract_id, sponsorship_id, starts_on, ends_on, mode)
  values (p_venue, 'sponsor_' || c.tier, 'contract', c.id, sp, greatest(c.starts_on, current_date), c.ends_on, v_mode);
 end if;
 if c.pro then
  insert into private.venue_entitlements(venue_id, key, source, contract_id, starts_on, ends_on, mode)
  values (p_venue, 'pro_stats', 'contract', c.id, greatest(c.starts_on, current_date), c.ends_on, v_mode)
  on conflict (contract_id, venue_id, key) where status = 'active' do nothing;
 end if;
end $$;

-- Ends contract advantages (one venue, or all venues when p_venue is null).
create function private.contract_revoke(p_contract uuid, p_venue uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
 update public.sponsorships set status = 'ended' where id in (select sponsorship_id from private.venue_entitlements
  where contract_id = p_contract and (p_venue is null or venue_id = p_venue) and status = 'active' and sponsorship_id is not null)
  and status in ('requested', 'active');
 update private.venue_entitlements set status = 'ended', ended_at = now()
 where contract_id = p_contract and (p_venue is null or venue_id = p_venue) and status = 'active';
end $$;

-- Daily: contracts and venue advantages past their end date.
create function private.venue_partners_maintenance() returns void
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
 for c in select id from private.venue_contracts where status = 'active' and ends_on < current_date loop
  perform private.contract_revoke(c.id);
  update private.venue_contracts set status = 'ended', ended_at = now() where id = c.id;
 end loop;
 update private.venue_entitlements set status = 'ended', ended_at = now() where status = 'active' and ends_on < current_date;
end $$;

-- Pro also comes from a contract.
create or replace function private.venue_has_pro(p_venue uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.subscriptions where venue_id=p_venue and plan_code='venue_pro_monthly' and status in('active','cancel_at_period_end') and current_period_end>now()
 and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')))
 or exists(select 1 from private.venue_entitlements where venue_id=p_venue and key='pro_stats' and status='active'
 and current_date between starts_on and ends_on and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')))
$$;

create or replace function private.venue_billing_state(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sub jsonb; contract_pro boolean;
begin
 perform private.require_venue_manager(p_venue);
 select jsonb_build_object('id',id,'status',status,'currentPeriodEnd',current_period_end,'canManage',user_id=auth.uid()) into sub from public.subscriptions where venue_id=p_venue and plan_code='venue_pro_monthly' and (mode='live' or private.sees_test_data()) order by started_at desc limit 1;
 select exists(select 1 from private.venue_entitlements where venue_id=p_venue and key='pro_stats' and status='active'
  and current_date between starts_on and ends_on and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'))) into contract_pro;
 return jsonb_build_object('pro',private.venue_has_pro(p_venue),'subscription',sub,
  'proSource',case when contract_pro then 'contract' when private.venue_has_pro(p_venue) then 'stripe' end);
end $$;

-- Swipe cards: nearest sponsored venues first (was alphabetical).
create or replace function private.matching_sponsored_cards(p_place uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid:=private.require_age_verified(); city_name text; origin extensions.geography;
begin
 if not public.feature_enabled('sponsored_cards_enabled') or public.has_entitlement('no_sponsored_cards') then return '[]'; end if;
 perform private.social_limit('sponsored-cards',120);
 select city into city_name from public.profiles where id=u;
 if p_place is not null then perform private.require_place(p_place); select location into origin from public.venues where id=p_place; end if;
 if origin is null then select v.location into origin from public.attendance a join public.venues v on v.id=a.venue_id where a.user_id=u and a.expires_at>now() order by a.created_at desc limit 1; end if;
 -- No precise origin means no ad, rather than advertising an arbitrary distant venue.
 if origin is null then return '[]'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by distance,id),'[]') from (
 select v.id,v.name,min(extensions.st_distance(v.location,origin)) distance from public.sponsorships s join public.venues v on v.id=s.venue_id
 where s.status='active' and current_date between s.starts_on and s.ends_on and lower(v.city)=lower(city_name)
 and v.business_status='OPERATIONAL' and private.venue_open(v.opening_hours) and extensions.st_dwithin(v.location,origin,5000)
 and (not v.is_test or private.sees_test_data()) and (s.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'))
 group by v.id,v.name order by distance,v.id limit 5) cards);
end $$;

-- With partners on, claiming also requires the current «Condiciones para Locales».
create or replace function private.venue_claim(p_venue uuid, p_evidence text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid:=private.require_registered();
begin
 perform private.require_place(p_venue); perform private.case_limit('venue-claim',10);
 if char_length(btrim(p_evidence)) not between 10 and 500 then raise exception 'invalid evidence' using errcode='22023'; end if;
 if coalesce(private.flag_value('venue_partners_enabled'),'off')='on' and not exists(select 1 from public.consent_records
  where user_id=u and kind='legal' and document_slug='venues' and document_version=private.current_document_version('venues')) then
  raise exception 'terms_required' using errcode='22023';
 end if;
 insert into public.venue_claims(venue_id,user_id,evidence) values(p_venue,u,btrim(p_evidence)) on conflict(venue_id,user_id) do nothing;
 if not found then return jsonb_build_object('error','already_claimed'); end if;
 return(select value from jsonb_array_elements(private.managed_venues()) where value->>'placeId'=p_venue::text);
end $$;

revoke all on function private.require_partners(), private.venue_role(uuid), private.require_venue_owner(uuid),
 private.invite_code_hash(text), private.new_venue_invitation(uuid, uuid, text), private.contract_grant(uuid, uuid),
 private.contract_revoke(uuid, uuid), private.venue_partners_maintenance() from public, anon, authenticated;
select cron.schedule('nl_venue_partners_maintenance', '23 3 * * *', 'select private.venue_partners_maintenance()');
