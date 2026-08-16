create table if not exists public.vendor_store_pins (
  user_id uuid not null references public.users(id) on delete cascade,
  store_id uuid not null references public.vendor_stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,store_id)
);
create index if not exists idx_vendor_store_pins_user on public.vendor_store_pins(user_id,created_at desc);
alter table public.vendor_store_pins enable row level security;
