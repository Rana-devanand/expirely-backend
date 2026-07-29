-- Community marketplace tables. Run this in the Supabase SQL editor.
create table if not exists public.community_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'USD',
  quantity integer not null default 1 check (quantity > 0),
  condition text not null default 'new' check (condition in ('new','like_new','good','fair')),
  location text,
  image_urls text[] not null default '{}',
  status text not null default 'active' check (status in ('active','reserved','sold','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.community_listings(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id, buyer_id, seller_id)
);

alter table public.community_conversations
  add column if not exists last_message_text text,
  add column if not exists last_message_type text,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_sender_id uuid references public.users(id),
  add column if not exists buyer_unread_count integer not null default 0,
  add column if not exists seller_unread_count integer not null default 0;

create table if not exists public.community_conversation_settings (
  conversation_id uuid primary key
    references public.community_conversations(id) on delete cascade,
  auto_delete_mode text check (
    auto_delete_mode in ('one_hour', 'twenty_four_hours', 'custom')
  ),
  auto_delete_duration_seconds integer check (
    auto_delete_duration_seconds between 3600 and 31536000
  ),
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (auto_delete_mode is null and auto_delete_duration_seconds is null)
    or
    (auto_delete_mode is not null and auto_delete_duration_seconds is not null)
  )
);

create index if not exists community_conversation_settings_auto_delete_idx
  on public.community_conversation_settings(auto_delete_duration_seconds)
  where auto_delete_duration_seconds is not null;

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text,
  message_type text not null default 'text' check (message_type in ('text','offer','system','media')),
  media_url text,
  reply_to_message_id uuid references public.community_messages(id) on delete set null,
  offer_amount numeric(12,2),
  offer_status text check (offer_status in ('pending','accepted','rejected','countered')),
  created_at timestamptz not null default now(),
  check (body is not null or offer_amount is not null or media_url is not null)
);

create index if not exists community_messages_conversation_created_idx
  on public.community_messages(conversation_id, created_at);

alter table public.community_messages add column if not exists media_url text;
alter table public.community_messages
  add column if not exists reply_to_message_id uuid
  references public.community_messages(id) on delete set null;
alter table public.community_messages
  drop constraint if exists community_messages_message_type_check;
alter table public.community_messages
  add constraint community_messages_message_type_check
  check (message_type in ('text','offer','system','media'));
alter table public.community_messages
  drop constraint if exists community_messages_check;
alter table public.community_messages
  add constraint community_messages_check
  check (body is not null or offer_amount is not null or media_url is not null);

create or replace function public.cleanup_expired_community_messages(
  batch_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with expired as (
    select message.id
    from public.community_messages message
    join public.community_conversation_settings setting
      on setting.conversation_id = message.conversation_id
    where setting.auto_delete_duration_seconds is not null
      and message.created_at
        < now() - make_interval(secs => setting.auto_delete_duration_seconds)
    order by message.created_at
    limit greatest(1, least(batch_size, 2000))
    for update of message skip locked
  )
  delete from public.community_messages message
  using expired
  where message.id = expired.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create table if not exists public.community_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.community_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid not null references public.community_listings(id) on delete cascade,
  reported_user_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending'
    check (status in ('pending','reviewing','resolved','dismissed')),
  admin_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(reporter_id, listing_id)
);

create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.community_listings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(listing_id, user_id)
);

alter table public.community_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists seen_at timestamptz,
  add column if not exists client_message_id text;

create unique index if not exists community_messages_sender_client_id_idx
  on public.community_messages(sender_id, client_message_id)
  where client_message_id is not null;

create table if not exists public.community_message_queue (
  id uuid primary key default gen_random_uuid(),
  sequence_id bigint generated always as identity unique,
  sender_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null
    references public.community_conversations(id) on delete cascade,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  message_id uuid references public.community_messages(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(sender_id, idempotency_key)
);

alter table public.community_message_queue
  add column if not exists sequence_id bigint generated always as identity;
create unique index if not exists community_message_queue_sequence_idx
  on public.community_message_queue(sequence_id);

create index if not exists community_message_queue_claim_idx
  on public.community_message_queue(status, available_at, created_at)
  where status in ('pending', 'processing');
create index if not exists community_message_queue_sender_fifo_idx
  on public.community_message_queue(sender_id, sequence_id);

create or replace function public.claim_community_message_jobs(
  worker_id text,
  batch_size integer default 20
)
returns setof public.community_message_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_message_queue
  set status = 'pending',
      locked_at = null,
      locked_by = null,
      available_at = now(),
      updated_at = now()
  where status = 'processing'
    and locked_at < now() - interval '5 minutes';

  return query
  with claimable as (
    select queue.id
    from public.community_message_queue queue
    where queue.status = 'pending'
      and queue.available_at <= now()
      and not exists (
        select 1
        from public.community_message_queue earlier
        where earlier.sender_id = queue.sender_id
          and earlier.status in ('pending', 'processing')
          and earlier.sequence_id < queue.sequence_id
      )
    order by queue.sequence_id
    limit greatest(1, least(batch_size, 100))
    for update skip locked
  )
  update public.community_message_queue queue
  set status = 'processing',
      attempt_count = queue.attempt_count + 1,
      locked_at = now(),
      locked_by = worker_id,
      updated_at = now()
  from claimable
  where queue.id = claimable.id
  returning queue.*;
end;
$$;

create or replace function public.fail_community_message_job(
  job_id uuid,
  worker_id text,
  error_message text
)
returns public.community_message_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.community_message_queue;
begin
  update public.community_message_queue queue
  set status = case
        when queue.attempt_count >= queue.max_attempts then 'failed'
        else 'pending'
      end,
      available_at = case
        when queue.attempt_count >= queue.max_attempts then queue.available_at
        else now() + make_interval(
          secs => least(300, (power(2, queue.attempt_count) * 2)::integer)
        )
      end,
      locked_at = null,
      locked_by = null,
      last_error = left(error_message, 1000),
      updated_at = now()
  where queue.id = job_id
    and queue.status = 'processing'
    and queue.locked_by = worker_id
  returning queue.* into result;
  return result;
end;
$$;

create or replace function public.retry_community_message_job(
  job_id uuid,
  requesting_user_id uuid
)
returns public.community_message_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.community_message_queue;
begin
  update public.community_message_queue queue
  set status = 'pending',
      attempt_count = 0,
      available_at = now(),
      locked_at = null,
      locked_by = null,
      last_error = null,
      updated_at = now()
  where queue.id = job_id
    and queue.sender_id = requesting_user_id
    and queue.status = 'failed'
  returning queue.* into result;
  return result;
end;
$$;

revoke all on function public.claim_community_message_jobs(text, integer)
  from public, anon, authenticated;
revoke all on function public.fail_community_message_job(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.retry_community_message_job(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_community_message_jobs(text, integer)
  to service_role;
grant execute on function public.fail_community_message_job(uuid, text, text)
  to service_role;
grant execute on function public.retry_community_message_job(uuid, uuid)
  to service_role;

create index if not exists community_listings_status_created_idx
  on public.community_listings(status, created_at desc);
create index if not exists community_messages_conversation_created_idx
  on public.community_messages(conversation_id, created_at);
create index if not exists community_conversations_buyer_updated_idx
  on public.community_conversations(buyer_id, updated_at desc);
create index if not exists community_conversations_seller_updated_idx
  on public.community_conversations(seller_id, updated_at desc);
create index if not exists community_messages_unseen_idx
  on public.community_messages(conversation_id, sender_id, seen_at);
create index if not exists community_follows_follower_idx
  on public.community_follows(follower_id, following_id);
create index if not exists community_blocks_blocker_idx
  on public.community_blocks(blocker_id, blocked_id);
create index if not exists community_reports_status_created_idx
  on public.community_reports(status, created_at desc);
create index if not exists community_likes_listing_idx
  on public.community_likes(listing_id);
create index if not exists community_likes_user_idx
  on public.community_likes(user_id, created_at desc);

-- Populate previews for conversations created before these columns existed.
with latest as (
  select distinct on (m.conversation_id)
    m.conversation_id, m.body, m.message_type, m.created_at, m.sender_id
  from public.community_messages m
  order by m.conversation_id, m.created_at desc
)
update public.community_conversations c
set last_message_text = latest.body,
    last_message_type = latest.message_type,
    last_message_at = latest.created_at,
    last_message_sender_id = latest.sender_id,
    updated_at = greatest(c.updated_at, latest.created_at)
from latest
where latest.conversation_id = c.id
  and c.last_message_at is null;

-- Final cleanup implementation also repairs denormalized inbox metadata for
-- conversations touched by each batch.
create or replace function public.cleanup_expired_community_messages(
  batch_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
  affected_conversations uuid[];
begin
  with expired as (
    select message.id
    from public.community_messages message
    join public.community_conversation_settings setting
      on setting.conversation_id = message.conversation_id
    where setting.auto_delete_duration_seconds is not null
      and message.created_at
        < now() - make_interval(secs => setting.auto_delete_duration_seconds)
    order by message.created_at
    limit greatest(1, least(batch_size, 2000))
    for update of message skip locked
  ),
  deleted_queue as (
    delete from public.community_message_queue queue
    using expired
    where queue.message_id = expired.id
    returning queue.id
  ),
  deleted as (
    delete from public.community_messages message
    using expired
    where message.id = expired.id
    returning message.conversation_id
  )
  select count(*)::integer, array_agg(distinct conversation_id)
    into deleted_count, affected_conversations
  from deleted;

  if affected_conversations is not null then
    update public.community_conversations conversation
    set buyer_unread_count = (
          select count(*)::integer
          from public.community_messages message
          where message.conversation_id = conversation.id
            and message.sender_id = conversation.seller_id
            and message.seen_at is null
        ),
        seller_unread_count = (
          select count(*)::integer
          from public.community_messages message
          where message.conversation_id = conversation.id
            and message.sender_id = conversation.buyer_id
            and message.seen_at is null
        ),
        last_message_text = case
          when exists (
            select 1 from public.community_messages message
            where message.conversation_id = conversation.id
          ) then conversation.last_message_text
          else null
        end,
        last_message_type = case
          when exists (
            select 1 from public.community_messages message
            where message.conversation_id = conversation.id
          ) then conversation.last_message_type
          else null
        end,
        last_message_at = case
          when exists (
            select 1 from public.community_messages message
            where message.conversation_id = conversation.id
          ) then conversation.last_message_at
          else null
        end,
        last_message_sender_id = case
          when exists (
            select 1 from public.community_messages message
            where message.conversation_id = conversation.id
          ) then conversation.last_message_sender_id
          else null
        end
    where conversation.id = any(affected_conversations);
  end if;

  return deleted_count;
end;
$$;

create or replace function public.clear_community_chat(
  target_conversation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.community_message_queue
  where conversation_id = target_conversation_id;

  delete from public.community_messages
  where conversation_id = target_conversation_id;
  get diagnostics deleted_count = row_count;

  update public.community_conversations
  set last_message_text = null,
      last_message_type = null,
      last_message_at = null,
      last_message_sender_id = null,
      buyer_unread_count = 0,
      seller_unread_count = 0,
      updated_at = now()
  where id = target_conversation_id;

  return deleted_count;
end;
$$;

revoke all on function public.clear_community_chat(uuid)
  from public, anon, authenticated;
grant execute on function public.clear_community_chat(uuid)
  to service_role;

alter table public.community_listings enable row level security;
alter table public.community_conversations enable row level security;
alter table public.community_conversation_settings enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_message_queue enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_likes enable row level security;

-- The backend uses the Supabase service role and enforces ownership/participants.
