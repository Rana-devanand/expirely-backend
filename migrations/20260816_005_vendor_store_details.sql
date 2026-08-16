alter table public.vendor_stores add column if not exists email text;
alter table public.vendor_stores add column if not exists opening_hours text;
alter table public.vendor_stores add column if not exists brand text;
alter table public.vendor_stores add column if not exists raw_categories text[] not null default '{}';
alter table public.vendor_stores add column if not exists data_source text;

drop function if exists public.nearby_vendor_stores(double precision,double precision,integer,integer,text);
create function public.nearby_vendor_stores(
  search_lat double precision, search_lng double precision, search_radius_m integer,
  result_limit integer default 100, category_filter text default null
) returns table (
  id uuid, name text, description text, category text, phone text, email text,
  website_url text, opening_hours text, brand text, raw_categories text[], data_source text,
  address_text text, locality text, city text, state text, country text, postal_code text,
  latitude double precision, longitude double precision, claim_status text,
  verification_status text, distance_m double precision
) language sql stable set search_path = public as $$
  select s.id,s.name,s.description,s.category,s.phone,s.email,s.website_url,
    s.opening_hours,s.brand,s.raw_categories,s.data_source,s.address_text,s.locality,
    s.city,s.state,s.country,s.postal_code,s.latitude,s.longitude,s.claim_status,s.verification_status,
    ST_Distance(s.geo,ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography)
  from public.vendor_stores s
  where s.is_active and s.geo is not null
    and (category_filter is null or lower(s.category) = lower(category_filter))
    and ST_DWithin(s.geo,ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography,search_radius_m)
  order by s.geo <-> ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography
  limit least(greatest(result_limit,1),200)
$$;
revoke all on function public.nearby_vendor_stores(double precision,double precision,integer,integer,text) from public,anon,authenticated;
grant execute on function public.nearby_vendor_stores(double precision,double precision,integer,integer,text) to service_role;
