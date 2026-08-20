-- ============================================================
--  STORYUP — Phase 2: Publishing prep (connections + schedules)
--  Idempotent. Run in Supabase SQL editor. Requires 0001 (owns_business).
-- ============================================================

create table if not exists public.blog_connections (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  channel       text not null check (channel in ('blogger','tistory','naver')),
  account_label text,
  connected     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (business_id, channel)
);
create index if not exists bc_business_idx on public.blog_connections (business_id);

create table if not exists public.publish_schedules (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  blog_post_id uuid references public.blog_posts (id) on delete cascade,
  channel      text not null check (channel in ('blogger','tistory','naver')),
  scheduled_at timestamptz not null,
  status       text not null default 'scheduled'
                 check (status in ('scheduled','exported','canceled')),
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists ps_business_idx on public.publish_schedules (business_id);

alter table public.blog_connections  enable row level security;
alter table public.publish_schedules enable row level security;

drop policy if exists blog_connections_owner on public.blog_connections;
create policy blog_connections_owner on public.blog_connections
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists publish_schedules_owner on public.publish_schedules;
create policy publish_schedules_owner on public.publish_schedules
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));
