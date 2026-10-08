-- Roadmap 2026-10 R3 (1/3): flag, team roles and private partner tables. Additive only.
insert into public.app_settings (key, kind, value, allowed_values)
values ('venue_partners_enabled', 'flag', 'off', array['on', 'off'])
on conflict (key) do nothing;

alter table public.venue_managers
  add column if not exists role text not null default 'owner' check (role in ('owner', 'staff')),
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

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
