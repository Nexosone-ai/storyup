-- ============================================================
--  STORYUP — Phase 3c: Premium template marketplace
--  Idempotent. Requires 0001 (set_updated_at) + 0004 (points).
-- ============================================================

create table if not exists public.premium_templates (
  id              uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users (id) on delete cascade,
  creator_name    text not null default '',
  title           text not null,
  description     text,
  template_key    text not null default 'classic'
                    check (template_key in ('classic','split','minimal')),
  preview_image   text,
  price_points    integer not null check (price_points >= 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pt_creator_idx on public.premium_templates (creator_user_id);
create index if not exists pt_active_idx on public.premium_templates (active);
drop trigger if exists premium_templates_updated_at on public.premium_templates;
create trigger premium_templates_updated_at before update on public.premium_templates
  for each row execute function public.set_updated_at();

create table if not exists public.template_purchases (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.premium_templates (id) on delete cascade,
  buyer_user_id   uuid not null references auth.users (id) on delete cascade,
  creator_user_id uuid not null references auth.users (id) on delete cascade,
  price_points    integer not null,
  creator_earning integer not null,
  platform_fee    integer not null,
  created_at      timestamptz not null default now(),
  unique (template_id, buyer_user_id)
);
create index if not exists tp_buyer_idx on public.template_purchases (buyer_user_id);
create index if not exists tp_creator_idx on public.template_purchases (creator_user_id);

alter table public.premium_templates enable row level security;
alter table public.template_purchases enable row level security;

-- templates: browse active (or own); creator manages own.
drop policy if exists pt_read on public.premium_templates;
create policy pt_read on public.premium_templates
  for select to authenticated using (active or creator_user_id = auth.uid());
drop policy if exists pt_insert on public.premium_templates;
create policy pt_insert on public.premium_templates
  for insert to authenticated with check (creator_user_id = auth.uid());
drop policy if exists pt_update on public.premium_templates;
create policy pt_update on public.premium_templates
  for update to authenticated using (creator_user_id = auth.uid()) with check (creator_user_id = auth.uid());
drop policy if exists pt_delete on public.premium_templates;
create policy pt_delete on public.premium_templates
  for delete to authenticated using (creator_user_id = auth.uid());

-- purchases: buyer + creator read; writes are server-only (service role).
drop policy if exists tp_read on public.template_purchases;
create policy tp_read on public.template_purchases
  for select to authenticated
  using (buyer_user_id = auth.uid() or creator_user_id = auth.uid());
