alter table public.community_messages
  add column if not exists media_size_bytes bigint not null default 0;
alter table public.community_messages
  add column if not exists media_mime_type text,
  add column if not exists media_file_name text;
