-- Run this migration in the Supabase SQL editor before deploying the auth code.
create table if not exists public.auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_token_hash text not null unique,
  device_id text,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists auth_sessions_user_id_idx on public.auth_sessions(user_id);
create index if not exists auth_sessions_active_idx
  on public.auth_sessions(id, refresh_token_hash) where revoked_at is null;
alter table public.auth_sessions enable row level security;
revoke all on table public.auth_sessions from anon, authenticated;
