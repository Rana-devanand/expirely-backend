alter table public.community_conversations alter column listing_id drop not null;
alter table public.community_conversations add column if not exists store_id uuid references public.vendor_stores(id);
alter table public.community_conversations add column if not exists context_type text not null default 'community_listing';
alter table public.community_conversations drop constraint if exists community_conversations_context_type_check;
alter table public.community_conversations add constraint community_conversations_context_type_check check (context_type in ('community_listing','vendor_store'));
alter table public.community_conversations drop constraint if exists community_conversations_context_reference_check;
alter table public.community_conversations add constraint community_conversations_context_reference_check check ((context_type='community_listing' and listing_id is not null and store_id is null) or (context_type='vendor_store' and store_id is not null and listing_id is null));
alter table public.community_conversations drop constraint if exists community_conversations_listing_id_buyer_id_seller_id_key;
create unique index if not exists uq_community_listing_conversation on public.community_conversations(listing_id,buyer_id,seller_id) where context_type='community_listing';
create unique index if not exists uq_vendor_store_conversation on public.community_conversations(store_id,buyer_id,seller_id) where context_type='vendor_store';
create index if not exists idx_community_conversations_store on public.community_conversations(store_id) where store_id is not null;

drop function if exists public.nearby_vendor_stores(double precision,double precision,integer,integer,text);
create function public.nearby_vendor_stores(search_lat double precision,search_lng double precision,search_radius_m integer,result_limit integer default 100,category_filter text default null)
returns table (id uuid,name text,description text,category text,phone text,email text,website_url text,opening_hours text,brand text,raw_categories text[],data_source text,address_text text,locality text,city text,state text,country text,postal_code text,latitude double precision,longitude double precision,claim_status text,verification_status text,can_chat boolean,distance_m double precision)
language sql stable set search_path=public as $$
select s.id,s.name,s.description,s.category,s.phone,s.email,s.website_url,s.opening_hours,s.brand,s.raw_categories,s.data_source,s.address_text,s.locality,s.city,s.state,s.country,s.postal_code,s.latitude,s.longitude,s.claim_status,s.verification_status,(s.claim_status='claimed' and s.owner_user_id is not null),ST_Distance(s.geo,ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography)
from public.vendor_stores s where s.is_active and s.geo is not null and (category_filter is null or lower(s.category)=lower(category_filter)) and ST_DWithin(s.geo,ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography,search_radius_m)
order by s.geo <-> ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography limit least(greatest(result_limit,1),200) $$;
revoke all on function public.nearby_vendor_stores(double precision,double precision,integer,integer,text) from public,anon,authenticated;
grant execute on function public.nearby_vendor_stores(double precision,double precision,integer,integer,text) to service_role;
