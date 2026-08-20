-- ============================================================
--  STORYUP — Phase 3b: Supporters + collaboration projects
--  Idempotent. Requires 0001 (owns_business, set_updated_at).
-- ============================================================

create table if not exists public.supporter_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  role          text not null check (role in ('designer','editor','musician')),
  display_name  text not null,
  bio           text,
  skills        text[] not null default '{}',
  portfolio_url text,
  contact       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sp_role_idx on public.supporter_profiles (role);
drop trigger if exists supporter_profiles_updated_at on public.supporter_profiles;
create trigger supporter_profiles_updated_at before update on public.supporter_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.collaboration_projects (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  supporter_user_id uuid not null references auth.users (id) on delete cascade,
  business_name     text not null default '',
  supporter_name    text not null default '',
  title             text not null,
  description       text,
  budget_points     integer,
  status            text not null default 'requested'
                      check (status in ('requested','accepted','declined','completed')),
  created_at        timestamptz not null default now()
);
create index if not exists cp_business_idx on public.collaboration_projects (business_id);
create index if not exists cp_supporter_idx on public.collaboration_projects (supporter_user_id);

alter table public.supporter_profiles     enable row level security;
alter table public.collaboration_projects enable row level security;

-- supporter_profiles: any signed-in user browses; owner manages own.
drop policy if exists sp_read on public.supporter_profiles;
create policy sp_read on public.supporter_profiles for select to authenticated using (true);
drop policy if exists sp_insert on public.supporter_profiles;
create policy sp_insert on public.supporter_profiles for insert to authenticated with check (user_id = auth.uid());
drop policy if exists sp_update on public.supporter_profiles;
create policy sp_update on public.supporter_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sp_delete on public.supporter_profiles;
create policy sp_delete on public.supporter_profiles for delete to authenticated using (user_id = auth.uid());

-- collaboration_projects: business owner + the supporter can see; owner requests; both update.
drop policy if exists cp_read on public.collaboration_projects;
create policy cp_read on public.collaboration_projects
  for select to authenticated
  using (public.owns_business(business_id) or supporter_user_id = auth.uid());
drop policy if exists cp_insert on public.collaboration_projects;
create policy cp_insert on public.collaboration_projects
  for insert to authenticated with check (public.owns_business(business_id));
drop policy if exists cp_update on public.collaboration_projects;
create policy cp_update on public.collaboration_projects
  for update to authenticated
  using (public.owns_business(business_id) or supporter_user_id = auth.uid())
  with check (public.owns_business(business_id) or supporter_user_id = auth.uid());
