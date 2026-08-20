-- ============================================================
--  STORYUP — Phase 3a: Points ledger + withdrawals + admin
--  Idempotent. Run in Supabase SQL editor. Requires 0001.
-- ============================================================

-- Admin flag on profiles.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

-- Point ledger. Balance = sum(amount). Only the server (service role) writes.
create table if not exists public.point_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  amount     integer not null,           -- +credit / -debit
  reason     text not null,
  ref_type   text,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index if not exists pt_user_idx on public.point_transactions (user_id, created_at desc);

create table if not exists public.withdrawal_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  amount       integer not null check (amount > 0),
  account_info text not null,
  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  decided_by   uuid,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists wr_user_idx on public.withdrawal_requests (user_id, created_at desc);
create index if not exists wr_status_idx on public.withdrawal_requests (status);

alter table public.point_transactions  enable row level security;
alter table public.withdrawal_requests enable row level security;

-- point_transactions: read own or admin; NO client writes (service role only).
drop policy if exists pt_select on public.point_transactions;
create policy pt_select on public.point_transactions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- withdrawal_requests: read own/admin; user creates own; admin decides.
drop policy if exists wr_select on public.withdrawal_requests;
create policy wr_select on public.withdrawal_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists wr_insert on public.withdrawal_requests;
create policy wr_insert on public.withdrawal_requests
  for insert to authenticated with check (user_id = auth.uid() and amount > 0);
drop policy if exists wr_update on public.withdrawal_requests;
create policy wr_update on public.withdrawal_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Grant admin to the owner accounts (safe no-ops if absent).
update public.profiles set is_admin = true where email = 'cto@nexosoneai.com';
update public.profiles set is_admin = true where email = 'demo@storyup.app';
