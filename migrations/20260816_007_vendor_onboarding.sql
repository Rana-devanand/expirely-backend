alter table public.users add column if not exists account_intent text not null default 'personal';
alter table public.users drop constraint if exists users_account_intent_check;
alter table public.users add constraint users_account_intent_check check (account_intent in ('personal','vendor'));
alter table public.vendor_profiles add column if not exists onboarding_status text not null default 'started';
alter table public.vendor_profiles drop constraint if exists vendor_profiles_onboarding_status_check;
alter table public.vendor_profiles add constraint vendor_profiles_onboarding_status_check check (onboarding_status in ('started','completed'));

create or replace function public.complete_vendor_onboarding(
  onboarding_user_id uuid, onboarding_display_name text, onboarding_phone text,
  onboarding_store_name text, onboarding_category text, onboarding_address text,
  onboarding_locality text, onboarding_city text, onboarding_state text,
  onboarding_country text, onboarding_postal_code text,
  onboarding_latitude double precision, onboarding_longitude double precision
) returns public.vendor_stores language plpgsql security definer set search_path=public as $$
declare result public.vendor_stores;
begin
  perform pg_advisory_xact_lock(hashtext(onboarding_user_id::text));
  insert into public.vendor_profiles(user_id,display_name,business_phone,onboarding_status,updated_at)
  values(onboarding_user_id,onboarding_display_name,onboarding_phone,'completed',now())
  on conflict(user_id) do update set display_name=excluded.display_name,business_phone=excluded.business_phone,onboarding_status='completed',updated_at=now();
  select * into result from public.vendor_stores where owner_user_id=onboarding_user_id and source='manual' order by created_at limit 1;
  if result.id is null then
    insert into public.vendor_stores(owner_user_id,name,category,phone,address_text,locality,city,state,country,postal_code,latitude,longitude,source,claim_status,verification_status,is_active)
    values(onboarding_user_id,onboarding_store_name,onboarding_category,onboarding_phone,onboarding_address,onboarding_locality,onboarding_city,onboarding_state,onboarding_country,onboarding_postal_code,onboarding_latitude,onboarding_longitude,'manual','claimed','unverified',true)
    returning * into result;
    insert into public.vendor_store_members(store_id,user_id,role,status) values(result.id,onboarding_user_id,'owner','active') on conflict(store_id,user_id) do update set role='owner',status='active',updated_at=now();
  end if;
  update public.users set account_intent='vendor',updated_at=now() where id=onboarding_user_id;
  return result;
end $$;
revoke all on function public.complete_vendor_onboarding(uuid,text,text,text,text,text,text,text,text,text,text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.complete_vendor_onboarding(uuid,text,text,text,text,text,text,text,text,text,text,double precision,double precision) to service_role;
