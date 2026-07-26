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

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.community_conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text,
  message_type text not null default 'text' check (message_type in ('text','offer','system','media')),
  media_url text,
  offer_amount numeric(12,2),
  offer_status text check (offer_status in ('pending','accepted','rejected','countered')),
  created_at timestamptz not null default now(),
  check (body is not null or offer_amount is not null or media_url is not null)
);

alter table public.community_messages add column if not exists media_url text;
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
  add column if not exists seen_at timestamptz;

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

alter table public.community_listings enable row level security;
alter table public.community_conversations enable row level security;
alter table public.community_messages enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_blocks enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_likes enable row level security;

-- The backend uses the Supabase service role and enforces ownership/participants.
