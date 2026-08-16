-- DESTRUCTIVE: manual emergency/staging rollback only. Take a snapshot first.
drop function if exists public.cleanup_vendor_user(uuid);
drop function if exists public.nearby_vendor_stores(double precision,double precision,integer,integer,text);
drop table if exists public.vendor_request_status_history;
drop table if exists public.vendor_request_items;
drop table if exists public.vendor_requests;
drop table if exists public.vendor_inventory;
drop table if exists public.catalog_products;
drop table if exists public.place_area_cache;
drop table if exists public.vendor_store_claims;
drop table if exists public.vendor_store_members;
drop table if exists public.vendor_stores;
drop table if exists public.vendor_profiles;
drop trigger if exists user_locations_sync_geo on public.user_locations;
drop function if exists public.sync_location_geography();
drop index if exists public.idx_user_locations_geo;
alter table public.user_locations drop column if exists geohash;
alter table public.user_locations drop column if exists last_location_at;
alter table public.user_locations drop column if exists accuracy_m;
alter table public.user_locations drop column if exists geo;
alter table public.user_locations drop column if exists longitude;
alter table public.user_locations drop column if exists latitude;
drop index if exists public.uq_notifications_dedupe;
alter table public.notifications drop column if exists data;
alter table public.notifications drop column if exists dedupe_key;
alter table public.notifications drop column if exists action;
alter table public.notifications drop column if exists entity_id;
alter table public.notifications drop column if exists entity_type;
-- PostGIS is deliberately retained because other database objects may use it.
