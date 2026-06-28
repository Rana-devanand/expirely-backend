-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  username text,
  password text,
  google_id text UNIQUE,
  avatar_url text,
  auth_provider text DEFAULT 'local'::text,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'blocked'::text, 'pending'::text])),
  is_verified boolean DEFAULT false,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  role text DEFAULT 'USER'::text CHECK (role = ANY (ARRAY['ADMIN'::text, 'USER'::text])),
  access_token text,
  refresh_token text,
  fcm_token text,
  reset_code text,
  reset_expiry timestamp with time zone,
  daily_reminder_enabled boolean DEFAULT false,
  daily_reminder_time text,
  daily_reminder_timezone text DEFAULT 'UTC'::text,
  last_daily_reminder_sent_at timestamp with time zone,
  opt_out boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text NOT NULL,
  category text,
  expiry_date date NOT NULL,
  quantity integer DEFAULT 1,
  unit text,
  image_url text,
  is_consumed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  barcode text,
  days_left integer,
  status text CHECK (status = ANY (ARRAY['good'::text, 'warning'::text, 'expired'::text])),
  color text,
  progress integer,
  notes text,
  ingredients text,
  remaining_qty numeric,
  last_used_at timestamp with time zone,
  storage_location text CHECK (storage_location = ANY (ARRAY['fridge'::text, 'freezer'::text, 'pantry'::text, 'medicine_box'::text, 'other'::text])),
  household_id uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT products_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  name text NOT NULL,
  color text,
  icon text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info'::text CHECK (type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])),
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.testers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  username text NOT NULL,
  email text NOT NULL UNIQUE,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT testers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.system_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_logs_pkey PRIMARY KEY (id),
  CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.shopping_list (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  quantity integer DEFAULT 1,
  is_checked boolean DEFAULT false,
  source_product_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shopping_list_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_list_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT shopping_list_source_product_id_fkey FOREIGN KEY (source_product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_usage_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['USED_FULLY'::text, 'USED_PARTIALLY'::text, 'WASTED'::text])),
  quantity numeric DEFAULT 1,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_usage_events_pkey PRIMARY KEY (id),
  CONSTRAINT product_usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT product_usage_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.recurring_products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  default_qty integer DEFAULT 1,
  default_shelf_life_days integer NOT NULL,
  image_url text,
  last_added_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recurring_products_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.households (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  join_code text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT households_pkey PRIMARY KEY (id),
  CONSTRAINT households_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id)
);
CREATE TABLE public.household_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'MEMBER'::text CHECK (role = ANY (ARRAY['OWNER'::text, 'MEMBER'::text])),
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT household_members_pkey PRIMARY KEY (id),
  CONSTRAINT household_members_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id),
  CONSTRAINT household_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.user_locations (
  user_id uuid NOT NULL,
  country text NOT NULL,
  locality text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_locations_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);