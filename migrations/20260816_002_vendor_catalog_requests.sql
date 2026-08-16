create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(), name text not null, normalized_name text not null,
  category text, unit text, barcode text, image_url text, is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_catalog_products_name on public.catalog_products(normalized_name);
create unique index if not exists uq_catalog_products_barcode on public.catalog_products(barcode) where barcode is not null;
create table if not exists public.vendor_inventory (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.vendor_stores(id) on delete cascade,
  catalog_product_id uuid not null references public.catalog_products(id),
  price numeric(12,2) check (price is null or price >= 0), currency text not null default 'INR',
  quantity numeric check (quantity is null or quantity >= 0), unit text,
  availability_status text not null default 'available' check (availability_status in ('available','low_stock','out_of_stock','unknown')),
  is_active boolean not null default true, updated_by uuid references public.users(id) on delete set null,
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(store_id,catalog_product_id)
);
create index if not exists idx_vendor_inventory_store on public.vendor_inventory(store_id);
create index if not exists idx_vendor_inventory_product on public.vendor_inventory(catalog_product_id);
create table if not exists public.vendor_requests (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.users(id),
  store_id uuid not null references public.vendor_stores(id),
  status text not null default 'pending' check (status in ('pending','accepted','partially_available','rejected','ready','completed','cancelled')),
  customer_note text, vendor_note text, requested_for timestamptz, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_vendor_requests_customer on public.vendor_requests(customer_id,created_at desc);
create index if not exists idx_vendor_requests_store on public.vendor_requests(store_id,created_at desc);
create table if not exists public.vendor_request_items (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.vendor_requests(id) on delete cascade,
  catalog_product_id uuid references public.catalog_products(id), item_name text not null,
  requested_quantity numeric check (requested_quantity is null or requested_quantity > 0), unit text,
  quoted_price numeric(12,2) check (quoted_price is null or quoted_price >= 0),
  availability_status text check (availability_status in ('available','partial','unavailable','unknown')),
  created_at timestamptz not null default now()
);
create table if not exists public.vendor_request_status_history (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.vendor_requests(id) on delete cascade,
  from_status text, to_status text not null, actor_user_id uuid references public.users(id) on delete set null,
  idempotency_key text not null unique, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.notifications add column if not exists entity_type text;
alter table public.notifications add column if not exists entity_id uuid;
alter table public.notifications add column if not exists action text;
alter table public.notifications add column if not exists dedupe_key text;
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
create unique index if not exists uq_notifications_dedupe on public.notifications(user_id,dedupe_key) where dedupe_key is not null;
alter table public.catalog_products enable row level security;
alter table public.vendor_inventory enable row level security;
alter table public.vendor_requests enable row level security;
alter table public.vendor_request_items enable row level security;
alter table public.vendor_request_status_history enable row level security;
