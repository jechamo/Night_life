-- Signed-document outbox: same leasing and retry guarantees as billing notices.
alter table public.email_outbox drop constraint email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check check(status in('pending','sending','sent','failed','simulated'));
alter table public.email_outbox add column next_attempt_at timestamptz not null default now(),add column lease_until timestamptz,add column lease_token uuid;
create function private.claim_signed_email(p_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with candidates as(select id from public.email_outbox where (p_user is null or user_id=p_user) and attempts<10 and ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now())) order by created_at limit 10 for update skip locked),updated as(
 update public.email_outbox e set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid() from candidates c where e.id=c.id returning e.*)
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('language',p.language,'isTest',p.is_test)),'[]') into result from updated e join public.profiles p on p.id=e.user_id;
 return result;
end $$;
create function private.finish_signed_email(p_id uuid,p_lease uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in('sent','simulated','retry') then raise exception 'invalid result' using errcode='22023'; end if;
 update public.email_outbox set status=case when p_status='retry' then case when attempts>=10 then 'failed' else 'pending' end else p_status end, sent_at=case when p_status in('sent','simulated') then now() end,lease_until=null,lease_token=null,next_attempt_at=now()+make_interval(secs=>least(86400,power(2,attempts)::int*60)),last_error=case when p_status='retry' then 'delivery' end where id=p_id and status='sending' and lease_token=p_lease;
end $$;
create function public.claim_signed_email(p_user uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_signed_email(p_user) $$;
create function public.finish_signed_email(p_id uuid,p_lease uuid,p_status text) returns void language sql security invoker set search_path='' as $$ select private.finish_signed_email(p_id,p_lease,p_status) $$;
revoke all on function public.claim_signed_email(uuid),private.claim_signed_email(uuid),public.finish_signed_email(uuid,uuid,text),private.finish_signed_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_signed_email(uuid),private.claim_signed_email(uuid),public.finish_signed_email(uuid,uuid,text),private.finish_signed_email(uuid,uuid,text) to service_role;
create or replace function private.claim_billing_work(p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; purge jsonb; cleanup jsonb;
begin
 if p_key is null or p_key is distinct from (select decrypted_secret from vault.decrypted_secrets where name='billing_worker_key') then raise exception 'forbidden' using errcode='42501'; end if;
 with candidates as (
 select id from public.billing_notices where (status='pending' and next_attempt_at<=now() or status='sending' and lease_until<now()) and attempts<10
 order by created_at limit 20 for update skip locked), updated as (
 update public.billing_notices b set status='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid()
 from candidates c where b.id=c.id returning b.*)
 select coalesce(jsonb_agg(to_jsonb(u)||jsonb_build_object('language',p.language,'isTest',p.is_test)),'[]') into result
 from updated u join public.profiles p on p.id=u.user_id;
 select coalesce(jsonb_agg(id),'[]') into purge from (select id from public.profiles
 where last_active_at<=now()-interval '24 months' and inactivity_warned_at<=now()-interval '30 days' limit 10) q;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into cleanup from (
 select * from private.provider_erasure_queue where next_attempt_at<=now() and attempts<10 limit 10) q;
 return jsonb_build_object('notices',result,'purge',purge,'cleanup',cleanup,'documents',private.claim_signed_email());
end $$;
