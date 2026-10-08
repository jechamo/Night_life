-- Roadmap 2026-10 R3 (5/5): venue-facing RPCs (flag on), invitations and team.
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

create function public.venue_invite_preview(p_code text) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_invite_preview(p_code) $$;
create function public.venue_invite_redeem(p_code text, p_accept_terms boolean) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_invite_redeem(p_code, p_accept_terms) $$;
create function public.venue_partner_state(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_partner_state(p_venue) $$;
create function public.venue_team(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_team(p_venue) $$;
create function public.venue_invite_staff(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.venue_invite_staff(p_venue) $$;
create function public.venue_invite_cancel(p_venue uuid, p_invite uuid) returns void language sql security invoker set search_path = '' as $$ select private.venue_invite_cancel(p_venue, p_invite) $$;
create function public.venue_remove_manager(p_venue uuid, p_user uuid) returns void language sql security invoker set search_path = '' as $$ select private.venue_remove_manager(p_venue, p_user) $$;

revoke all on function
 private.venue_invite_preview(text),
 private.venue_invite_redeem(text, boolean),
 private.venue_partner_state(uuid),
 private.venue_team(uuid),
 private.venue_invite_staff(uuid),
 private.venue_invite_cancel(uuid, uuid),
 private.venue_remove_manager(uuid, uuid),
 public.venue_invite_preview(text),
 public.venue_invite_redeem(text, boolean),
 public.venue_partner_state(uuid),
 public.venue_team(uuid),
 public.venue_invite_staff(uuid),
 public.venue_invite_cancel(uuid, uuid),
 public.venue_remove_manager(uuid, uuid)
 from public, anon;
grant execute on function
 private.venue_invite_preview(text),
 private.venue_invite_redeem(text, boolean),
 private.venue_partner_state(uuid),
 private.venue_team(uuid),
 private.venue_invite_staff(uuid),
 private.venue_invite_cancel(uuid, uuid),
 private.venue_remove_manager(uuid, uuid),
 public.venue_invite_preview(text),
 public.venue_invite_redeem(text, boolean),
 public.venue_partner_state(uuid),
 public.venue_team(uuid),
 public.venue_invite_staff(uuid),
 public.venue_invite_cancel(uuid, uuid),
 public.venue_remove_manager(uuid, uuid)
 to authenticated;
notify pgrst, 'reload schema';
