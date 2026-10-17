-- ============================================================
--  0068: 파트너 프로그램 — 대행 파트너 ↔ 고객 배정 + owns_business 확장
-- ============================================================
-- 파트너(= partner 플랜 계정)가 관리자에게 배정받은 고객 사업장을 '대행' 운영한다.
-- partner_clients로 1 파트너 ↔ N 고객을 연결하고, owns_business에 파트너 분기를 더해
-- 사업장-데이터 RLS 전체에 접근을 전파한다. 추가 전용(비파괴) — SQL 에디터 실행 가능.
-- Requires 0001(businesses/owns_business), 0004(is_admin), 0044(team_members 확장).

create table if not exists public.partner_clients (
  id             uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id  uuid not null references auth.users(id) on delete cascade,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  unique (partner_user_id, client_user_id)
);
create index if not exists partner_clients_partner_idx
  on public.partner_clients (partner_user_id);
create index if not exists partner_clients_client_idx
  on public.partner_clients (client_user_id);

-- RLS: 파트너 본인 배정 조회 + 관리자 전체. 쓰기는 서비스롤/관리자(배정은 앱의 requireAdmin).
alter table public.partner_clients enable row level security;
drop policy if exists partner_clients_self on public.partner_clients;
create policy partner_clients_self on public.partner_clients
  for select using (partner_user_id = auth.uid() or public.is_admin());
drop policy if exists partner_clients_admin on public.partner_clients;
create policy partner_clients_admin on public.partner_clients
  for all using (public.is_admin())
  with check (public.is_admin());

-- owns_business 확장: 소유자 OR 활성 직원(0044) OR 배정된 대행 파트너.
-- (0044 로직을 그대로 포함해 재생성 — 축소 금지. 사업장-데이터 RLS 전체에 전파됨.)
create or replace function public.owns_business(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = bid
      and (
        b.user_id = auth.uid()
        or exists (
          select 1 from public.team_members tm
          where tm.owner_user_id = b.user_id
            and tm.member_user_id = auth.uid()
            and tm.status = 'active'
        )
        or exists (
          select 1 from public.partner_clients pc
          where pc.partner_user_id = auth.uid()
            and pc.client_user_id = b.user_id
        )
      )
  );
$$;
