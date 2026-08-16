-- A non-partial unique index lets PostgREST use ON CONFLICT for provider upserts;
-- PostgreSQL still permits multiple manual rows because NULL values are distinct.
drop index if exists public.uq_vendor_store_external;
create unique index uq_vendor_store_external on public.vendor_stores(external_provider,external_place_id);

create or replace function public.claim_vendor_area_refresh(
  requested_area_key text, requested_center_lat double precision,
  requested_center_lng double precision, requested_radius_m integer,
  requested_provider text, requested_owner text
) returns boolean language plpgsql security definer set search_path = public as $$
declare acquired boolean := false;
begin
  insert into public.place_area_cache(
    area_key,center_lat,center_lng,radius_m,provider,refresh_status,refresh_started_at,refresh_owner,updated_at
  ) values (
    requested_area_key,requested_center_lat,requested_center_lng,requested_radius_m,
    requested_provider,'refreshing',now(),requested_owner,now()
  )
  on conflict (area_key) do update set
    refresh_status='refreshing', refresh_started_at=now(), refresh_owner=requested_owner,
    center_lat=requested_center_lat, center_lng=requested_center_lng, updated_at=now()
  where (place_area_cache.expires_at is null or place_area_cache.expires_at <= now())
    and (place_area_cache.next_retry_at is null or place_area_cache.next_retry_at <= now())
    and (place_area_cache.refresh_status <> 'refreshing'
      or place_area_cache.refresh_started_at < now() - interval '5 minutes')
  returning true into acquired;
  return coalesce(acquired,false);
end $$;
revoke all on function public.claim_vendor_area_refresh(text,double precision,double precision,integer,text,text) from public,anon,authenticated;
grant execute on function public.claim_vendor_area_refresh(text,double precision,double precision,integer,text,text) to service_role;
