create or replace function public.cleanup_vendor_user(deleting_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.vendor_requests where customer_id = deleting_user_id;
  delete from public.vendor_store_claims where claimant_user_id = deleting_user_id;
  delete from public.vendor_store_members where user_id = deleting_user_id;
  delete from public.vendor_profiles where user_id = deleting_user_id;
  update public.vendor_stores
    set owner_user_id = null,
        claim_status = 'unclaimed',
        verification_status = 'unverified',
        is_active = false,
        updated_at = now()
    where owner_user_id = deleting_user_id;
end $$;
revoke all on function public.cleanup_vendor_user(uuid) from public,anon,authenticated;
grant execute on function public.cleanup_vendor_user(uuid) to service_role;
