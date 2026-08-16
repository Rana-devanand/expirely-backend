alter table public.products add column if not exists is_store_published boolean not null default false;
create index if not exists idx_products_store_published on public.products(user_id,created_at desc) where is_store_published=true and is_consumed=false;
