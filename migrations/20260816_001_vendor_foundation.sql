-- Additive marketplace foundation. Existing expiry and community tables are untouched.
create extension if not exists postgis;

alter table public.user_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geo geography(Point, 4326),
  add column if not exists accuracy_m numeric check (accuracy_m is null or accuracy_m >= 0),
  add column if not exists last_location_at timestamptz,
  add column if not exists geohash text;
alter table public.user_locations drop constraint if exists user_locations_latitude_check;
alter table public.user_locations add constraint user_locations_latitude_check check (latitude is null or latitude between -90 and 90);
alter table public.user_locations drop constraint if exists user_locations_longitude_check;
alter table public.user_locations add constraint user_locations_longitude_check check (longitude is null or longitude between -180 and 180);
alter table public.user_locations drop constraint if exists user_locations_coordinate_pair_check;
alter table public.user_locations add constraint user_locations_coordinate_pair_check check ((latitude is null) = (longitude is null));

create or replace function public.sync_location_geography()
returns trigger language plpgsql set search_path = public as $$
begin
  new.geo := case when new.latitude is null then null else
    ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography end;
  return new;
end $$;
drop trigger if exists user_locations_sync_geo on public.user_locations;
create trigger user_locations_sync_geo before insert or update of latitude, longitude
on public.user_locations for each row execute function public.sync_location_geography();
update public.user_locations set latitude = latitude where latitude is not null;
create index if not exists idx_user_locations_geo on public.user_locations using gist (geo);

create table if not exists public.vendor_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text, business_phone text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.vendor_stores (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 200),
  description text, category text, phone text, website_url text, address_text text,
  locality text, city text, state text, country text, postal_code text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  geo geography(Point, 4326),
  source text not null default 'manual' check (source in ('manual','external','imported')),
  external_provider text, external_place_id text,
  provider_data jsonb not null default '{}'::jsonb,
  vendor_overrides jsonb not null default '{}'::jsonb,
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed','claim_pending','claimed')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  is_active boolean not null default true, last_external_sync_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check (source = 'manual' or (external_provider is not null and external_place_id is not null)),
  check (claim_status <> 'claimed' or owner_user_id is not null)
);
drop trigger if exists vendor_stores_sync_geo on public.vendor_stores;
create trigger vendor_stores_sync_geo before insert or update of latitude, longitude
on public.vendor_stores for each row execute function public.sync_location_geography();
create unique index if not exists uq_vendor_store_external on public.vendor_stores(external_provider, external_place_id) where external_place_id is not null;
create index if not exists idx_vendor_stores_geo_active on public.vendor_stores using gist (geo) where is_active and geo is not null;
create index if not exists idx_vendor_stores_owner on public.vendor_stores(owner_user_id);

create table if not exists public.vendor_store_members (
  store_id uuid not null references public.vendor_stores(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  status text not null default 'active' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create table if not exists public.vendor_store_claims (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.vendor_stores(id) on delete cascade,
  claimant_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  verification_method text, evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.users(id) on delete set null, reviewed_at timestamptz, rejection_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_vendor_store_pending_claim on public.vendor_store_claims(store_id, claimant_user_id) where status = 'pending';

create table if not exists public.place_area_cache (
  area_key text primary key, center_lat double precision not null, center_lng double precision not null,
  radius_m integer not null check (radius_m in (5000,10000)), provider text not null,
  fetched_at timestamptz, expires_at timestamptz, result_count integer not null default 0,
  refresh_status text not null default 'idle' check (refresh_status in ('idle','refreshing','failed')),
  refresh_started_at timestamptz, refresh_owner text, last_success_at timestamptz,
  consecutive_failures integer not null default 0, next_retry_at timestamptz, last_error text,
  updated_at timestamptz not null default now()
);

create or replace function public.nearby_vendor_stores(
  search_lat double precision, search_lng double precision, search_radius_m integer,
  result_limit integer default 50, category_filter text default null
) returns table (
  id uuid, name text, description text, category text, phone text, website_url text,
  address_text text, locality text, city text, state text, country text, postal_code text,
  latitude double precision, longitude double precision, claim_status text,
  verification_status text, distance_m double precision
) language sql stable set search_path = public as $$
  select s.id,s.name,s.description,s.category,s.phone,s.website_url,s.address_text,s.locality,s.city,s.state,s.country,s.postal_code,
    s.latitude,s.longitude,s.claim_status,s.verification_status,
    ST_Distance(s.geo,ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography)
  from public.vendor_stores s
  where s.is_active and s.geo is not null
    and (category_filter is null or lower(s.category) = lower(category_filter))
    and ST_DWithin(s.geo,ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography,search_radius_m)
  order by s.geo <-> ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography
  limit least(greatest(result_limit,1),100)
$$;
revoke all on function public.nearby_vendor_stores(double precision,double precision,integer,integer,text) from public,anon,authenticated;
grant execute on function public.nearby_vendor_stores(double precision,double precision,integer,integer,text) to service_role;

alter table public.vendor_profiles enable row level security;
alter table public.vendor_stores enable row level security;
alter table public.vendor_store_members enable row level security;
alter table public.vendor_store_claims enable row level security;
alter table public.place_area_cache enable row level security;
