-- Roadmap 2026-10 R3 (4/5): admin RPCs (role admin + MFA), audited and rate limited.
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

create function public.admin_partners() returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_partners() $$;
create function public.admin_partner_save(p jsonb) returns uuid language sql security invoker set search_path = '' as $$ select private.admin_partner_save(p) $$;
create function public.admin_partner_link(p_account uuid, p_venue uuid, p_link boolean) returns void language sql security invoker set search_path = '' as $$ select private.admin_partner_link(p_account, p_venue, p_link) $$;
create function public.admin_contract_save(p jsonb) returns uuid language sql security invoker set search_path = '' as $$ select private.admin_contract_save(p) $$;
create function public.admin_contract_action(p_contract uuid, p_action text) returns void language sql security invoker set search_path = '' as $$ select private.admin_contract_action(p_contract, p_action) $$;
create function public.admin_venue_invite(p_venue uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_venue_invite(p_venue) $$;
create function public.admin_invite_revoke(p_invite uuid) returns void language sql security invoker set search_path = '' as $$ select private.admin_invite_revoke(p_invite) $$;
create function public.admin_remove_manager(p_venue uuid, p_user uuid) returns void language sql security invoker set search_path = '' as $$ select private.admin_remove_manager(p_venue, p_user) $$;

revoke all on function
 private.admin_partners(),
 private.admin_partner_save(jsonb),
 private.admin_partner_link(uuid, uuid, boolean),
 private.admin_contract_save(jsonb),
 private.admin_contract_action(uuid, text),
 private.admin_venue_invite(uuid),
 private.admin_invite_revoke(uuid),
 private.admin_remove_manager(uuid, uuid),
 public.admin_partners(),
 public.admin_partner_save(jsonb),
 public.admin_partner_link(uuid, uuid, boolean),
 public.admin_contract_save(jsonb),
 public.admin_contract_action(uuid, text),
 public.admin_venue_invite(uuid),
 public.admin_invite_revoke(uuid),
 public.admin_remove_manager(uuid, uuid)
 from public, anon;
grant execute on function
 private.admin_partners(),
 private.admin_partner_save(jsonb),
 private.admin_partner_link(uuid, uuid, boolean),
 private.admin_contract_save(jsonb),
 private.admin_contract_action(uuid, text),
 private.admin_venue_invite(uuid),
 private.admin_invite_revoke(uuid),
 private.admin_remove_manager(uuid, uuid),
 public.admin_partners(),
 public.admin_partner_save(jsonb),
 public.admin_partner_link(uuid, uuid, boolean),
 public.admin_contract_save(jsonb),
 public.admin_contract_action(uuid, text),
 public.admin_venue_invite(uuid),
 public.admin_invite_revoke(uuid),
 public.admin_remove_manager(uuid, uuid)
 to authenticated;
