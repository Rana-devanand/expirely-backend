alter table public.community_messages add column if not exists edited_at timestamptz;
alter table public.community_messages add column if not exists deleted_at timestamptz;
