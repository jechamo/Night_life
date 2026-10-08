-- Roadmap 2026-10 R3: partners and contracts. Additive: claims, Stripe and invoice
-- sponsorships keep working as before. Venue-facing actions need `venue_partners_enabled`
-- (checked server-side); admin actions need the admin role with MFA.
insert into public.app_settings (key, kind, value, allowed_values)
values ('venue_partners_enabled', 'flag', 'off', array['on', 'off'])
on conflict (key) do nothing;

-- Team roles. Existing managers become owners (same powers as today).
alter table public.venue_managers
  add column if not exists role text not null default 'owner' check (role in ('owner', 'staff')),
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

-- Company behind one or more venues (business contact data; admin only).
create table private.venue_accounts (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null check (char_length(legal_name) between 2 and 120),
  tax_id text not null unique check (tax_id ~ '^([ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]|[0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])$'),
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  billing_email text not null check (char_length(billing_email) <= 254 and billing_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  contact_phone text check (char_length(contact_phone) <= 20),
  notes text check (char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'ended')),
  is_test boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.venue_account_venues (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  account_id uuid not null references private.venue_accounts(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now()
);
create index venue_account_venues_account on private.venue_account_venues(account_id);

-- Offline contract: only data and reference (the signed PDF is kept outside the app).
create table private.venue_contracts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references private.venue_accounts(id) on delete cascade,
  reference text not null unique check (char_length(reference) between 3 and 40),
  tier text not null default 'none' check (tier in ('none', 'featured', 'featured_plus', 'top')),
  pro boolean not null default false,
  starts_on date not null,
  ends_on date not null,
  terms_version text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  ended_at timestamptz,
  check (tier <> 'none' or pro),
  check (ends_on >= starts_on and ends_on <= starts_on + 1096)
);
create index venue_contracts_account on private.venue_contracts(account_id);

-- Single record of venue advantages that do not come from Stripe. Sponsorship keys also
-- create a linked `sponsorships` row so map, home, swipe and Flash work unchanged.
create table private.venue_entitlements (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  key text not null check (key in ('sponsor_featured', 'sponsor_featured_plus', 'sponsor_top', 'pro_stats')),
  source text not null check (source in ('contract', 'admin', 'promo')),
  contract_id uuid references private.venue_contracts(id) on delete set null,
  sponsorship_id uuid references public.sponsorships(id) on delete set null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  mode text not null default 'live' check (mode in ('test', 'live')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ends_on >= starts_on)
);
create unique index venue_entitlements_contract_key on private.venue_entitlements(contract_id, venue_id, key) where status = 'active';
create index venue_entitlements_venue on private.venue_entitlements(venue_id, key) where status = 'active';
create index venue_entitlements_sponsorship on private.venue_entitlements(sponsorship_id) where sponsorship_id is not null;

-- One-time invitations. Only an HMAC of the code is stored; the code is shown once.
create table private.venue_invitations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  account_id uuid references private.venue_accounts(id) on delete set null,
  role text not null check (role in ('owner', 'staff')),
  code_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
create index venue_invitations_venue on private.venue_invitations(venue_id);

alter table private.venue_accounts enable row level security;
alter table private.venue_account_venues enable row level security;
alter table private.venue_contracts enable row level security;
alter table private.venue_entitlements enable row level security;
alter table private.venue_invitations enable row level security;
revoke all on private.venue_accounts, private.venue_account_venues, private.venue_contracts,
  private.venue_entitlements, private.venue_invitations from public, anon, authenticated;

-- ── helpers ─────────────────────────────────────────────────────────────────
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

-- ── existing functions: minimal, additive changes ───────────────────────────
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

-- Contract sponsorships do not use the city slots (owner decision 08/10/2026).
create or replace function private.admin_case_action(p_section text, p_id uuid, p_action text, p_note text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare c public.venue_claims; s public.sponsorships; city_name text; n int; ev public.events;
begin
 perform private.require_admin(); perform private.require_registered();
 if p_section in('reports','appeals','bans') then perform private.admin_moderate(p_section,p_id,p_action,p_note); return; end if;
 if p_section='claims' and p_action in('approve','reject') then
  select * into c from public.venue_claims where id=p_id and status='pending' for update;
  if not found or c.user_id=auth.uid() then raise exception 'independent review required' using errcode='42501'; end if;
  if p_action='reject' and char_length(btrim(p_note))<5 then raise exception 'explanation required' using errcode='22023'; end if;
  update public.venue_claims set status=case when p_action='approve' then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;
  if p_action='approve' then
   insert into public.venue_managers(venue_id,user_id) values(c.venue_id,c.user_id) on conflict do nothing;
   insert into public.user_roles(user_id,role,granted_by) values(c.user_id,'venue_manager',auth.uid()) on conflict(user_id,role) do nothing;
  end if;
 elsif p_section='sponsorships' and p_action in('activate','end') then
  select * into s from public.sponsorships where id=p_id for update;
  if not found then raise exception 'not found' using errcode='P0002'; end if;
  select city into city_name from public.venues where id=s.venue_id;
  perform pg_advisory_xact_lock(hashtextextended('sponsor-city:'||lower(city_name),0));
  if p_action='activate' then
   if s.status<>'requested' or char_length(btrim(p_note)) not between 5 and 40 or s.ends_on<current_date then raise exception 'manual invoice required' using errcode='22023'; end if;
   select count(*) into n from public.sponsorships sp join public.venues v on v.id=sp.venue_id
   where lower(v.city)=lower(city_name) and sp.status='active' and sp.starts_on<=s.ends_on and sp.ends_on>=s.starts_on
   and not exists(select 1 from private.venue_entitlements e where e.sponsorship_id=sp.id);
   if n>=private.setting_int('sponsorship_slots',3) then raise exception 'no slots' using errcode='54000'; end if;
  end if;
  update public.sponsorships set status=case when p_action='activate' then 'active' else 'ended' end,
   invoice_ref=case when p_action='activate' then btrim(p_note) else invoice_ref end where id=p_id;
 elsif p_section='events' and p_action in('hide','delete') then
  if char_length(btrim(p_note))<5 then raise exception 'explanation required' using errcode='22023'; end if;
  select * into ev from public.events where id=p_id for update;
  if not found then raise exception 'not found' using errcode='P0002'; end if;
  update public.events set hidden_at=now(),status='removed' where id=p_id;
  if ev.created_by is not null then insert into public.moderation_decisions(user_id,action,reason,explanation,decided_by)
   values(ev.created_by,'content_removed','inappropriate',p_note,auth.uid()); end if;
 elsif p_section='entitlements' and p_action='revoke' then
  if char_length(btrim(p_note))<5 then raise exception 'explanation required' using errcode='22023'; end if;
  update public.entitlements set status='revoked' where id=p_id;
 elsif p_section='dataRequests' and p_action='done' then
  if char_length(btrim(p_note))<5 then raise exception 'response required' using errcode='22023'; end if;
  update public.data_requests set status='done',closed_at=now(),explanation=p_note where id=p_id and status='open' and kind in('rectify','object','restrict');
 elsif p_section='legalDocs' and p_action='publish' then
  update public.legal_documents set status='published' where id=p_id and status in('inactive','draft');
 elsif p_section='escalations' and p_action='done' then
  if char_length(btrim(p_note))<5 then raise exception 'authority action reference required' using errcode='22023'; end if;
  update public.safety_escalations set status='reviewed',explanation=left(explanation||E'\n'||p_note,2000) where id=p_id and status='pending';
 else raise exception 'unsupported action' using errcode='22023'; end if;
 perform private.audit('case.'||p_action,p_section||':'||p_id::text||':'||left(p_note,200));
end $$;

create or replace function private.billing_start_venue_order(p_code text, p_venue uuid, p_from date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare u uuid:=private.require_payment_access(); payment_mode text:=private.flag_value('payments_mode'); plan public.plans; o public.purchase_orders; city_name text; capacity int;
begin
 perform private.require_venue_manager(p_venue);
 if not public.feature_enabled('sponsorship_self_service_enabled') then raise exception 'forbidden' using errcode='42501'; end if;
 perform private.case_limit('checkout',20);
 perform pg_advisory_xact_lock(hashtextextended('billing:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended('venue-billing:'||p_venue::text,0));
 perform private.prepare_venue_checkout(p_venue,p_code);
 select * into plan from public.plans where code=p_code and kind='b2b' and active;
 if not found then raise exception 'invalid plan' using errcode='22023'; end if;
 update public.purchase_orders set status='expired' where venue_id=p_venue and status='pending' and created_at<=now()-interval '24 hours';
 select * into o from public.purchase_orders where user_id=u and venue_id=p_venue and plan_code=p_code and mode=payment_mode and status='pending' and sponsorship_from is not distinct from p_from order by created_at desc limit 1;
 if not found then
  if p_code='venue_pro_monthly' then
   if p_from is not null then raise exception 'invalid dates' using errcode='22023'; end if;
   if exists(select 1 from public.subscriptions where venue_id=p_venue and mode=payment_mode and plan_code=p_code and status in('active','cancel_at_period_end','past_due') and current_period_end>now())
   or exists(select 1 from public.purchase_orders where venue_id=p_venue and mode=payment_mode and plan_code=p_code and status='pending') then raise exception 'already_subscribed' using errcode='23505'; end if;
  else
   if p_from is null or p_from<current_date or p_from>current_date+90 then raise exception 'invalid dates' using errcode='22023'; end if;
   select city into city_name from public.venues where id=p_venue;
   perform pg_advisory_xact_lock(hashtextextended('sponsor-city:'||lower(city_name),0));
   if exists(select 1 from public.sponsorships where venue_id=p_venue and mode=payment_mode and status in('requested','active') and starts_on<=p_from+29 and ends_on>=p_from)
   or exists(select 1 from public.purchase_orders where venue_id=p_venue and mode=payment_mode and status='pending' and plan_code like 'sponsor_%' and sponsorship_from<=p_from+29 and sponsorship_from+29>=p_from and created_at>now()-interval '24 hours') then raise exception 'already_subscribed' using errcode='23505'; end if;
   select max(n)::int into capacity from(select d,
    (select count(*) from public.sponsorships s join public.venues v on v.id=s.venue_id where lower(v.city)=lower(city_name) and s.mode=payment_mode and s.status in('requested','active') and d between s.starts_on and s.ends_on
     and not exists(select 1 from private.venue_entitlements e where e.sponsorship_id=s.id))
    +(select count(*) from public.purchase_orders po join public.venues v on v.id=po.venue_id where lower(v.city)=lower(city_name) and po.mode=payment_mode and po.status='pending' and po.plan_code like 'sponsor_%' and po.created_at>now()-interval '24 hours' and d between po.sponsorship_from and po.sponsorship_from+29) n
    from generate_series(p_from::timestamp,(p_from+29)::timestamp,interval '1 day') d) counts;
   if capacity>=private.setting_int('sponsorship_slots',3) then raise exception 'no_slots' using errcode='54000'; end if;
  end if;
  insert into public.purchase_orders(user_id,plan_code,mode,amount_cents,price_id,venue_id,sponsorship_from)
  values(u,p_code,payment_mode,plan.price_cents,case when payment_mode='test' then plan.stripe_price_id_test else plan.stripe_price_id_live end,p_venue,p_from) returning * into o;
 end if;
 return jsonb_build_object('id',o.id,'createdAt',o.created_at,'userId',u,'code',plan.code,'kind',case when plan.billing_interval is not null then 'subscription' else 'payment' end,
 'mode',payment_mode,'priceId',o.price_id,'amount',o.amount_cents,'sessionId',o.provider_session_id,'interval',plan.billing_interval,'intervalCount',plan.billing_interval_count);
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

-- ── admin RPCs (role admin + MFA) ───────────────────────────────────────────
create function private.admin_partners() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_admin(); perform private.require_registered();
 return (select coalesce(jsonb_agg(jsonb_build_object(
  'id', a.id, 'legalName', a.legal_name, 'taxId', a.tax_id, 'contactName', a.contact_name,
  'billingEmail', a.billing_email, 'contactPhone', a.contact_phone, 'notes', a.notes,
  'status', a.status, 'isTest', a.is_test, 'createdAt', a.created_at,
  'venues', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'city', v.city,
     'managers', (select coalesce(jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', p.name, 'role', m.role, 'since', m.created_at) order by m.created_at), '[]')
       from public.venue_managers m left join public.profiles p on p.id = m.user_id where m.venue_id = v.id),
     'invitations', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'role', i.role, 'expiresAt', i.expires_at,
       'status', case when i.used_at is not null then 'used' when i.revoked_at is not null then 'revoked' when i.expires_at <= now() then 'expired' else 'pending' end) order by i.created_at desc), '[]')
       from private.venue_invitations i where i.venue_id = v.id)) order by v.name), '[]')
     from private.venue_account_venues l join public.venues v on v.id = l.venue_id where l.account_id = a.id),
  'contracts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'reference', c.reference, 'tier', c.tier, 'pro', c.pro,
     'startsOn', c.starts_on, 'endsOn', c.ends_on, 'termsVersion', c.terms_version, 'status', c.status) order by c.created_at desc), '[]')
     from private.venue_contracts c where c.account_id = a.id)
 ) order by a.legal_name), '[]') from private.venue_accounts a);
end $$;

create function private.admin_partner_save(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; tax text := upper(regexp_replace(coalesce(p->>'taxId', ''), '[^A-Za-z0-9]', '', 'g'));
begin
 perform private.require_admin(); perform private.require_registered();
 perform private.case_limit('admin-partner', 120);
 if v_id is null then
  insert into private.venue_accounts(legal_name, tax_id, contact_name, billing_email, contact_phone, notes, is_test, created_by)
  values (btrim(p->>'legalName'), tax, btrim(p->>'contactName'), lower(btrim(p->>'billingEmail')),
   nullif(btrim(coalesce(p->>'contactPhone', '')), ''), nullif(btrim(coalesce(p->>'notes', '')), ''),
   coalesce((p->>'isTest')::boolean, false), auth.uid())
  returning id into v_id;
  perform private.audit('partner.create', v_id::text);
 else
  update private.venue_accounts set legal_name = btrim(p->>'legalName'), tax_id = tax, contact_name = btrim(p->>'contactName'),
   billing_email = lower(btrim(p->>'billingEmail')), contact_phone = nullif(btrim(coalesce(p->>'contactPhone', '')), ''),
   notes = nullif(btrim(coalesce(p->>'notes', '')), ''), status = coalesce(nullif(p->>'status', ''), status), updated_at = now()
  where id = v_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.audit('partner.update', v_id::text);
 end if;
 return v_id;
exception when check_violation or not_null_violation or invalid_text_representation then
 raise exception 'invalid partner' using errcode = '22023';
 when unique_violation then raise exception 'duplicate_tax_id' using errcode = '23505';
end $$;

create function private.admin_partner_link(p_account uuid, p_venue uuid, p_link boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
 perform private.require_admin(); perform private.require_registered(); perform private.require_place(p_venue);
 perform pg_advisory_xact_lock(hashtextextended('venue-partner:' || p_venue::text, 0));
 if p_link then
  if not exists (select 1 from private.venue_accounts where id = p_account and status = 'active') then raise exception 'not found' using errcode = 'P0002'; end if;
  if exists (select 1 from private.venue_account_venues where venue_id = p_venue and account_id <> p_account) then
   raise exception 'linked_elsewhere' using errcode = '23505';
  end if;
  insert into private.venue_account_venues(venue_id, account_id, linked_by) values (p_venue, p_account, auth.uid()) on conflict do nothing;
  for c in select id from private.venue_contracts where account_id = p_account and status = 'active' loop
   perform private.contract_grant(c.id, p_venue);
  end loop;
  perform private.audit('partner.link', p_account::text || ':' || p_venue::text);
 else
  for c in select id from private.venue_contracts where account_id = p_account loop
   perform private.contract_revoke(c.id, p_venue);
  end loop;
  delete from private.venue_account_venues where venue_id = p_venue and account_id = p_account;
  perform private.audit('partner.unlink', p_account::text || ':' || p_venue::text);
 end if;
end $$;

create function private.admin_contract_save(p jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; terms text := private.current_document_version('venues');
begin
 perform private.require_admin(); perform private.require_registered();
 perform private.case_limit('admin-partner', 120);
 if terms is null then raise exception 'terms missing' using errcode = '22023'; end if;
 insert into private.venue_contracts(account_id, reference, tier, pro, starts_on, ends_on, terms_version, created_by)
 values ((p->>'accountId')::uuid, btrim(p->>'reference'), coalesce(nullif(p->>'tier', ''), 'none'), coalesce((p->>'pro')::boolean, false),
  (p->>'startsOn')::date, (p->>'endsOn')::date, terms, auth.uid())
 returning id into v_id;
 perform private.audit('contract.create', v_id::text);
 return v_id;
exception when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or foreign_key_violation then
 raise exception 'invalid contract' using errcode = '22023';
 when unique_violation then raise exception 'duplicate_reference' using errcode = '23505';
end $$;

create function private.admin_contract_action(p_contract uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare c private.venue_contracts; l record;
begin
 perform private.require_admin(); perform private.require_registered();
 select * into c from private.venue_contracts where id = p_contract for update;
 if not found then raise exception 'not found' using errcode = 'P0002'; end if;
 if p_action = 'activate' then
  if c.status <> 'draft' or c.ends_on < current_date then raise exception 'invalid state' using errcode = '22023'; end if;
  if not exists (select 1 from private.venue_accounts where id = c.account_id and status = 'active') then raise exception 'invalid state' using errcode = '22023'; end if;
  update private.venue_contracts set status = 'active', activated_at = now() where id = c.id;
  for l in select venue_id from private.venue_account_venues where account_id = c.account_id loop
   perform private.contract_grant(c.id, l.venue_id);
  end loop;
 elsif p_action = 'end' then
  if c.status = 'ended' then raise exception 'invalid state' using errcode = '22023'; end if;
  perform private.contract_revoke(c.id);
  update private.venue_contracts set status = 'ended', ended_at = now() where id = c.id;
 else raise exception 'unsupported action' using errcode = '22023'; end if;
 perform private.audit('contract.' || p_action, c.id::text || ':' || c.reference);
end $$;

create function private.admin_venue_invite(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
 perform private.require_admin(); perform private.require_registered(); perform private.require_place(p_venue);
 if not exists (select 1 from public.venues where id = p_venue) then raise exception 'not found' using errcode = 'P0002'; end if;
 perform private.case_limit('admin-invite', 60);
 r := private.new_venue_invitation(p_venue, (select account_id from private.venue_account_venues where venue_id = p_venue), 'owner');
 perform private.audit('invite.create', p_venue::text || ':' || (r->>'id'));
 return r;
end $$;

create function private.admin_invite_revoke(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_admin(); perform private.require_registered();
 update private.venue_invitations set revoked_at = now() where id = p_invite and used_at is null and revoked_at is null;
 perform private.audit('invite.revoke', p_invite::text);
end $$;

create function private.admin_remove_manager(p_venue uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_admin(); perform private.require_registered();
 delete from public.venue_managers where venue_id = p_venue and user_id = p_user;
 if not found then raise exception 'not found' using errcode = 'P0002'; end if;
 if not exists (select 1 from public.venue_managers where user_id = p_user) then
  delete from public.user_roles where user_id = p_user and role = 'venue_manager';
 end if;
 perform private.audit('venue.manager_remove', p_venue::text || ':' || p_user::text);
end $$;

-- ── venue-facing RPCs (flag on) ─────────────────────────────────────────────
create function private.venue_invite_preview(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_partners(); inv private.venue_invitations;
begin
 perform private.case_limit('venue-invite', 20);
 select * into inv from private.venue_invitations where code_hash = private.invite_code_hash(p_code);
 if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
  raise exception 'invalid_code' using errcode = '22023';
 end if;
 return (select jsonb_build_object('venueName', v.name, 'city', v.city, 'role', inv.role,
  'accountName', (select legal_name from private.venue_accounts where id = inv.account_id),
  'alreadyManager', exists(select 1 from public.venue_managers where venue_id = inv.venue_id and user_id = u),
  'termsVersion', private.current_document_version('venues'))
  from public.venues v where v.id = inv.venue_id);
end $$;

create function private.venue_invite_redeem(p_code text, p_accept_terms boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_partners(); inv private.venue_invitations; terms text := private.current_document_version('venues');
begin
 perform private.case_limit('venue-invite', 20);
 select * into inv from private.venue_invitations where code_hash = private.invite_code_hash(p_code) for update;
 if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
  raise exception 'invalid_code' using errcode = '22023';
 end if;
 if exists (select 1 from public.venue_managers where venue_id = inv.venue_id and user_id = u) then
  raise exception 'already_manager' using errcode = '23505';
 end if;
 if not coalesce(p_accept_terms, false) or terms is null then raise exception 'terms_required' using errcode = '22023'; end if;
 insert into public.consent_records(user_id, kind, document_slug, document_version, granted, method)
 select u, 'legal', 'venues', terms, true, 'checkbox'
 where not exists (select 1 from public.consent_records where user_id = u and kind = 'legal' and document_slug = 'venues' and document_version = terms);
 update private.venue_invitations set used_by = u, used_at = now() where id = inv.id;
 insert into public.venue_managers(venue_id, user_id, role, invited_by) values (inv.venue_id, u, inv.role, inv.created_by);
 insert into public.user_roles(user_id, role, granted_by) values (u, 'venue_manager', inv.created_by) on conflict (user_id, role) do nothing;
 perform private.audit('invite.redeem', inv.venue_id::text || ':' || inv.id::text);
 return jsonb_build_object('placeId', inv.venue_id, 'role', inv.role);
end $$;

create function private.venue_partner_state(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_partners(); acc private.venue_accounts; ctr private.venue_contracts; benefits jsonb;
begin
 perform private.require_venue_manager(p_venue);
 perform private.place_limit('venue-partner-read', 600);
 select a.* into acc from private.venue_account_venues l join private.venue_accounts a on a.id = l.account_id where l.venue_id = p_venue;
 if acc.id is not null then
  select * into ctr from private.venue_contracts where account_id = acc.id and status = 'active' order by starts_on desc limit 1;
 end if;
 select coalesce(jsonb_agg(b order by b->>'key'), '[]') into benefits from (
  select jsonb_build_object('key', 'sponsor_' || s.tier,
   'source', case when exists(select 1 from private.venue_entitlements e where e.sponsorship_id = s.id) then 'contract'
    when s.purchase_order_id is not null then 'stripe' else 'invoice' end,
   'from', s.starts_on, 'until', s.ends_on) b
  from public.sponsorships s where s.venue_id = p_venue and s.status = 'active' and s.ends_on >= current_date
   and (s.mode = 'live' or private.sees_test_data())
  union all
  select jsonb_build_object('key', 'pro_stats', 'source', 'contract', 'from', e.starts_on, 'until', e.ends_on)
  from private.venue_entitlements e where e.venue_id = p_venue and e.key = 'pro_stats' and e.status = 'active'
   and (e.mode = 'live' or private.sees_test_data())
  union all
  select jsonb_build_object('key', 'pro_stats', 'source', 'stripe', 'from', s.started_at::date, 'until', s.current_period_end::date)
  from public.subscriptions s where s.venue_id = p_venue and s.plan_code = 'venue_pro_monthly'
   and s.status in ('active', 'cancel_at_period_end') and s.current_period_end > now() and (s.mode = 'live' or private.sees_test_data())
 ) x;
 return jsonb_build_object(
  'role', private.venue_role(p_venue),
  'account', case when acc.id is null then null else jsonb_build_object('legalName', acc.legal_name) end,
  'contract', case when ctr.id is null then null else jsonb_build_object('reference', ctr.reference, 'tier', ctr.tier,
   'pro', ctr.pro, 'startsOn', ctr.starts_on, 'endsOn', ctr.ends_on) end,
  'benefits', benefits,
  'termsCurrent', private.current_document_version('venues'),
  'termsAccepted', exists(select 1 from public.consent_records where user_id = u and kind = 'legal' and document_slug = 'venues'
   and document_version = private.current_document_version('venues')));
end $$;

create function private.venue_team(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_venue_owner(p_venue);
begin
 perform private.place_limit('venue-team-read', 600);
 return jsonb_build_object(
  'members', (select coalesce(jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', coalesce(p.name, '—'), 'role', m.role,
    'since', m.created_at, 'me', m.user_id = u) order by m.role, m.created_at), '[]')
   from public.venue_managers m left join public.profiles p on p.id = m.user_id where m.venue_id = p_venue),
  'invitations', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'role', i.role, 'expiresAt', i.expires_at) order by i.created_at desc), '[]')
   from private.venue_invitations i where i.venue_id = p_venue and i.used_at is null and i.revoked_at is null and i.expires_at > now()));
end $$;

create function private.venue_invite_staff(p_venue uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
 perform private.require_venue_owner(p_venue);
 perform private.case_limit('venue-staff-invite', 10);
 perform pg_advisory_xact_lock(hashtextextended('venue-invite:' || p_venue::text, 0));
 if (select count(*) from private.venue_invitations where venue_id = p_venue and used_at is null and revoked_at is null and expires_at > now()) >= 5
  or (select count(*) from public.venue_managers where venue_id = p_venue) >= 10 then
  raise exception 'team_limit' using errcode = '54000';
 end if;
 r := private.new_venue_invitation(p_venue, (select account_id from private.venue_account_venues where venue_id = p_venue), 'staff');
 perform private.audit('invite.staff', p_venue::text || ':' || (r->>'id'));
 return r;
end $$;

create function private.venue_invite_cancel(p_venue uuid, p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform private.require_venue_owner(p_venue);
 update private.venue_invitations set revoked_at = now()
 where id = p_invite and venue_id = p_venue and role = 'staff' and used_at is null and revoked_at is null;
 if not found then raise exception 'not found' using errcode = 'P0002'; end if;
 perform private.audit('invite.revoke', p_invite::text);
end $$;

create function private.venue_remove_manager(p_venue uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_venue_owner(p_venue);
begin
 if p_user = u then raise exception 'forbidden' using errcode = '42501'; end if;
 delete from public.venue_managers where venue_id = p_venue and user_id = p_user and role = 'staff';
 if not found then raise exception 'not found' using errcode = 'P0002'; end if;
 if not exists (select 1 from public.venue_managers where user_id = p_user) then
  delete from public.user_roles where user_id = p_user and role = 'venue_manager';
 end if;
 perform private.audit('venue.manager_remove', p_venue::text || ':' || p_user::text);
end $$;

-- ── wrappers and grants ─────────────────────────────────────────────────────
create function public.admin_partners() returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_partners() $$;
create function public.admin_partner_save(p jsonb) returns uuid language sql security invoker set search_path = '' as $$ select private.admin_partner_save(p) $$;
create function public.admin_partner_link(p_account uuid, p_venue uuid, p_link boolean) returns void language sql security invoker set search_path = '' as $$ select private.admin_partner_link(p_account, p_venue, p_link) $$;
create function public.admin_contract_save(p jsonb) returns uuid language sql security invoker set search_path = '' as $$ select private.admin_contract_save(p) $$;
create function public.admin_contract_action(p_contract uuid, p_action text) returns void language sql security invoker set search_path = '' as $$ select private.admin_contract_action(p_contract, p_action) $$;
create function public.admin_venue_invite(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_venue_invite(p_venue) $$;
create function public.admin_invite_revoke(p_invite uuid) returns void language sql security invoker set search_path = '' as $$ select private.admin_invite_revoke(p_invite) $$;
create function public.admin_remove_manager(p_venue uuid, p_user uuid) returns void language sql security invoker set search_path = '' as $$ select private.admin_remove_manager(p_venue, p_user) $$;
create function public.venue_invite_preview(p_code text) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_invite_preview(p_code) $$;
create function public.venue_invite_redeem(p_code text, p_accept_terms boolean) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_invite_redeem(p_code, p_accept_terms) $$;
create function public.venue_partner_state(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_partner_state(p_venue) $$;
create function public.venue_team(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_team(p_venue) $$;
create function public.venue_invite_staff(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_invite_staff(p_venue) $$;
create function public.venue_invite_cancel(p_venue uuid, p_invite uuid) returns void language sql security invoker set search_path = '' as $$ select private.venue_invite_cancel(p_venue, p_invite) $$;
create function public.venue_remove_manager(p_venue uuid, p_user uuid) returns void language sql security invoker set search_path = '' as $$ select private.venue_remove_manager(p_venue, p_user) $$;

revoke all on function private.require_partners(), private.venue_role(uuid), private.require_venue_owner(uuid),
 private.invite_code_hash(text), private.new_venue_invitation(uuid, uuid, text), private.contract_grant(uuid, uuid),
 private.contract_revoke(uuid, uuid), private.venue_partners_maintenance() from public, anon, authenticated;
revoke all on function
 private.admin_partners(), private.admin_partner_save(jsonb), private.admin_partner_link(uuid, uuid, boolean),
 private.admin_contract_save(jsonb), private.admin_contract_action(uuid, text), private.admin_venue_invite(uuid),
 private.admin_invite_revoke(uuid), private.admin_remove_manager(uuid, uuid), private.venue_invite_preview(text),
 private.venue_invite_redeem(text, boolean), private.venue_partner_state(uuid), private.venue_team(uuid),
 private.venue_invite_staff(uuid), private.venue_invite_cancel(uuid, uuid), private.venue_remove_manager(uuid, uuid),
 public.admin_partners(), public.admin_partner_save(jsonb), public.admin_partner_link(uuid, uuid, boolean),
 public.admin_contract_save(jsonb), public.admin_contract_action(uuid, text), public.admin_venue_invite(uuid),
 public.admin_invite_revoke(uuid), public.admin_remove_manager(uuid, uuid), public.venue_invite_preview(text),
 public.venue_invite_redeem(text, boolean), public.venue_partner_state(uuid), public.venue_team(uuid),
 public.venue_invite_staff(uuid), public.venue_invite_cancel(uuid, uuid), public.venue_remove_manager(uuid, uuid)
 from public, anon;
grant execute on function
 private.admin_partners(), private.admin_partner_save(jsonb), private.admin_partner_link(uuid, uuid, boolean),
 private.admin_contract_save(jsonb), private.admin_contract_action(uuid, text), private.admin_venue_invite(uuid),
 private.admin_invite_revoke(uuid), private.admin_remove_manager(uuid, uuid), private.venue_invite_preview(text),
 private.venue_invite_redeem(text, boolean), private.venue_partner_state(uuid), private.venue_team(uuid),
 private.venue_invite_staff(uuid), private.venue_invite_cancel(uuid, uuid), private.venue_remove_manager(uuid, uuid),
 public.admin_partners(), public.admin_partner_save(jsonb), public.admin_partner_link(uuid, uuid, boolean),
 public.admin_contract_save(jsonb), public.admin_contract_action(uuid, text), public.admin_venue_invite(uuid),
 public.admin_invite_revoke(uuid), public.admin_remove_manager(uuid, uuid), public.venue_invite_preview(text),
 public.venue_invite_redeem(text, boolean), public.venue_partner_state(uuid), public.venue_team(uuid),
 public.venue_invite_staff(uuid), public.venue_invite_cancel(uuid, uuid), public.venue_remove_manager(uuid, uuid)
 to authenticated;

select cron.schedule('nl_venue_partners_maintenance', '23 3 * * *', 'select private.venue_partners_maintenance()');
notify pgrst, 'reload schema';
