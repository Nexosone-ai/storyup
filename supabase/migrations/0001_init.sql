-- ============================================================
--  STORYUP — initial schema, RLS, triggers
--  Run in Supabase SQL editor (or via `supabase db push`).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
--  profiles
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  name       text,
  email      text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  businesses
-- ============================================================
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  category        text not null,
  description     text,
  founder_story   text,
  target_customer text,
  strengths       text,
  tone            text,
  slug            text not null unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists businesses_user_id_idx on public.businesses (user_id);
create or replace trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

-- ============================================================
--  brand_profiles
-- ============================================================
create table if not exists public.brand_profiles (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  brand_name        text,
  headline          text,
  slogan            text,
  short_description text,
  brand_story       text,
  mission           text,
  target_customer   text,
  key_strengths     text[] not null default '{}',
  brand_keywords    text[] not null default '{}',
  tone              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists brand_profiles_business_id_idx
  on public.brand_profiles (business_id);
create or replace trigger brand_profiles_updated_at before update on public.brand_profiles
  for each row execute function public.set_updated_at();

-- ============================================================
--  websites
-- ============================================================
create table if not exists public.websites (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  slug         text not null unique,
  content      jsonb not null default '{}'::jsonb,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists websites_business_id_idx
  on public.websites (business_id);
create or replace trigger websites_updated_at before update on public.websites
  for each row execute function public.set_updated_at();

-- ============================================================
--  blog_posts
-- ============================================================
create table if not exists public.blog_posts (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  title           text not null,
  slug            text not null,
  summary         text,
  content         text,
  keywords        text[] not null default '{}',
  seo_title       text,
  seo_description text,
  social_caption  text,
  status          text not null default 'draft' check (status in ('draft','published')),
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (business_id, slug)
);
create index if not exists blog_posts_business_id_idx
  on public.blog_posts (business_id);
create or replace trigger blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ============================================================
--  marketing_contents
-- ============================================================
create table if not exists public.marketing_contents (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  blog_post_id uuid references public.blog_posts (id) on delete set null,
  platform     text not null,
  content      text not null,
  created_at   timestamptz not null default now()
);
create index if not exists marketing_contents_business_id_idx
  on public.marketing_contents (business_id);

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.brand_profiles    enable row level security;
alter table public.websites          enable row level security;
alter table public.blog_posts        enable row level security;
alter table public.marketing_contents enable row level security;

-- Helper: does the current user own this business?
create or replace function public.owns_business(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.businesses b
    where b.id = bid and b.user_id = auth.uid()
  );
$$;

-- ---- profiles ----
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (user_id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid());

-- ---- businesses ----
drop policy if exists businesses_all_own on public.businesses;
create policy businesses_all_own on public.businesses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- brand_profiles ----
drop policy if exists brand_profiles_all_own on public.brand_profiles;
create policy brand_profiles_all_own on public.brand_profiles
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- ---- websites: owner full access + public read of published ----
drop policy if exists websites_owner_all on public.websites;
create policy websites_owner_all on public.websites
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
drop policy if exists websites_public_read on public.websites;
create policy websites_public_read on public.websites
  for select using (status = 'published');

-- ---- blog_posts: owner full access + public read of published ----
drop policy if exists blog_posts_owner_all on public.blog_posts;
create policy blog_posts_owner_all on public.blog_posts
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
drop policy if exists blog_posts_public_read on public.blog_posts;
create policy blog_posts_public_read on public.blog_posts
  for select using (status = 'published');

-- ---- marketing_contents ----
drop policy if exists marketing_contents_all_own on public.marketing_contents;
create policy marketing_contents_all_own on public.marketing_contents
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- Public site pages read businesses/brand rows for published websites.
-- Allow public read of a business row only when it has a published website.
drop policy if exists businesses_public_read_published on public.businesses;
create policy businesses_public_read_published on public.businesses
  for select using (
    exists (
      select 1 from public.websites w
      where w.business_id = businesses.id and w.status = 'published'
    )
  );
