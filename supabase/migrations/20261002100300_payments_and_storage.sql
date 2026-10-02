-- Block 5 · Payments schema (PRD 4.1, 6.13, ADR 0008) and Storage for profile photos.

-- ── Catalogue (one catalogue for Stripe and the stores) ─────────────────────
create table public.plans (
  code text primary key check (code ~ '^[a-z0-9_]{3,40}$'),
  kind text not null check (kind in ('subscription', 'one_night', 'credits', 'b2b')),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  billing_interval text check (billing_interval in ('month', 'year')),
  entitlements text[] not null default '{}',
  credits jsonb not null default '[]' check (jsonb_typeof(credits) = 'array'),
  stripe_price_id_test text,
  stripe_price_id_live text,
  apple_product_id text,
  google_product_id text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
create policy "plans: active catalogue" on public.plans
  for select to anon, authenticated
  using (active or (select private.is_admin()));

insert into public.plans (code, kind, price_cents, billing_interval, entitlements, credits) values
  ('pass_monthly', 'subscription', 999, 'month',
    array['unlimited_likes', 'undo', 'travel_mode', 'premium_themes', 'no_sponsored_cards'], '[]'),
  ('vip_monthly', 'subscription', 1999, 'month',
    array['unlimited_likes', 'undo', 'travel_mode', 'premium_themes', 'no_sponsored_cards',
          'see_likes', 'priority_likes', 'incognito', 'boost'],
    '[{"kind":"spotlight","amount":1,"perWeek":true},{"kind":"spark","amount":3,"perWeek":true},{"kind":"paid_dm","amount":2,"perWeek":true}]'),
  ('one_night', 'one_night', 299, null,
    array['unlimited_likes', 'undo', 'travel_mode', 'premium_themes', 'no_sponsored_cards'],
    '[{"kind":"spotlight","amount":1}]'),
  ('sparks_5', 'credits', 499, null, '{}', '[{"kind":"spark","amount":5}]'),
  ('spotlight_1', 'credits', 399, null, '{}', '[{"kind":"spotlight","amount":1}]'),
  ('paid_dm_1', 'credits', 199, null, '{}', '[{"kind":"paid_dm","amount":1}]');

-- ── Entitlements: the ONLY source of truth for paid perks (PRD 6.13) ──────────
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key in (
    'unlimited_likes', 'see_likes', 'incognito', 'boost', 'undo', 'premium_themes',
    'travel_mode', 'priority_likes', 'no_sponsored_cards'
  )),
  source text not null check (source in ('admin', 'promo', 'tester', 'stripe', 'apple', 'google')),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.entitlements enable row level security;
create index entitlements_user_idx on public.entitlements (user_id, key);
create index entitlements_granted_by_idx on public.entitlements (granted_by);
create policy "entitlements: own or admin" on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- SQL twin of `useEntitlement()`; premium off ⇒ nobody has paid perks (fail closed).
create function public.has_entitlement(_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.feature_enabled('premium_enabled') and exists (
    select 1 from public.entitlements
    where user_id = (select auth.uid()) and key = _key and status = 'active'
      and starts_at <= now() and (ends_at is null or ends_at > now())
  )
$$;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  provider text not null check (provider in ('stripe', 'apple', 'google')),
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null check (status in ('active', 'cancel_at_period_end', 'withdrawn', 'expired', 'past_due')),
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  withdrawal_requested_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_plan_idx on public.subscriptions (plan_code);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function private.touch_updated_at();
create policy "subscriptions: own or admin" on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Idempotency for webhooks: the provider event id is unique (PRD 6.13). No card data.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe', 'apple', 'google')),
  provider_event_id text not null,
  type text not null check (char_length(type) <= 80),
  user_id uuid references auth.users (id) on delete set null,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table public.payment_events enable row level security;
create index payment_events_user_idx on public.payment_events (user_id);
create policy "payment_events: admin" on public.payment_events
  for select to authenticated using ((select private.is_admin()));

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  plan_code text not null references public.plans (code),
  provider text not null check (provider in ('stripe', 'apple', 'google')),
  provider_invoice_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null check (status in ('paid', 'refunded')),
  issued_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create index invoices_user_idx on public.invoices (user_id);
create index invoices_plan_idx on public.invoices (plan_code);
create policy "invoices: own or admin" on public.invoices
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create table public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  plan_code text not null references public.plans (code),
  days integer not null check (days between 1 and 365),
  max_uses integer not null check (max_uses between 1 and 10000),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
create index promo_codes_plan_idx on public.promo_codes (plan_code);
create index promo_codes_created_by_idx on public.promo_codes (created_by);
create policy "promo_codes: admin" on public.promo_codes
  for select to authenticated using ((select private.is_admin()));

create table public.promo_redemptions (
  code text not null references public.promo_codes (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.promo_redemptions enable row level security;
create index promo_redemptions_user_idx on public.promo_redemptions (user_id);
create policy "promo_redemptions: own or admin" on public.promo_redemptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Credits (Chispas, Foco, Mensaje directo) as an append-only ledger.
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('spark', 'spotlight', 'paid_dm')),
  delta integer not null check (delta <> 0),
  reason text not null check (char_length(reason) <= 80),
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
create index credit_ledger_user_idx on public.credit_ledger (user_id, kind);
create policy "credit_ledger: own or admin" on public.credit_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ── Venue sponsorships and Flash Alerts (PRD 6.11) ───────────────────────────
create table public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  tier text not null check (tier in ('featured', 'featured_plus', 'top')),
  status text not null default 'requested' check (status in ('requested', 'active', 'ended', 'rejected')),
  starts_on date not null,
  ends_on date not null,
  invoice_ref text check (char_length(invoice_ref) <= 40),
  requested_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
alter table public.sponsorships enable row level security;
create index sponsorships_venue_idx on public.sponsorships (venue_id);
create index sponsorships_requested_by_idx on public.sponsorships (requested_by);
create policy "sponsorships: venue manager or admin" on public.sponsorships
  for select to authenticated
  using ((select private.manages_venue(venue_id)) or (select private.is_admin()));

create table public.flash_alerts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  title text not null check (char_length(title) <= 60),
  body text not null check (char_length(body) <= 200),
  contains_alcohol boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.flash_alerts enable row level security;
create index flash_alerts_venue_idx on public.flash_alerts (venue_id);
create policy "flash_alerts: venue manager or admin" on public.flash_alerts
  for select to authenticated
  using ((select private.manages_venue(venue_id)) or (select private.is_admin()));

-- ── Storage: private bucket for profile photos (PRD 6.15 D) ──────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png']);

-- Owner-only, inside their own folder `<user id>/…`. Others get short signed URLs
-- from server functions (Block 8), never direct access.
create policy "profile photos: own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile photos: own upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile photos: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile photos: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
