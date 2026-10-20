-- 0081: 계정 공유(파트너 위임 접근).
-- 계정 소유자가 파트너를 '이메일'로 초대 → 파트너가 수락하면 partner_clients 링크가
-- 생성되어(owns_business가 이미 인정) 해당 소유자의 사업장에서 작업할 수 있다.
-- team_members(직원·단일소유자·좌석제한)와 달리, 파트너는 여러 고객을 대행할 수 있다.

create table if not exists public.account_shares (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid not null references auth.users(id) on delete cascade,
  partner_email   text not null,
  partner_user_id uuid references auth.users(id) on delete set null,
  status          text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (owner_user_id, partner_email)
);

alter table public.account_shares enable row level security;

-- 소유자: 본인이 만든 공유행 전체 접근. 파트너: 수락 후(partner_user_id=본인) 조회.
-- (수락 전 pending 초대는 이메일 매칭이 필요하므로 서버가 admin으로 조회한다.)
drop policy if exists acs_select on public.account_shares;
create policy acs_select on public.account_shares
  for select using (
    owner_user_id = auth.uid() or partner_user_id = auth.uid() or public.is_admin()
  );

drop policy if exists acs_owner_write on public.account_shares;
create policy acs_owner_write on public.account_shares
  for all using (owner_user_id = auth.uid() or public.is_admin())
  with check (owner_user_id = auth.uid() or public.is_admin());

create index if not exists account_shares_owner_idx on public.account_shares (owner_user_id);
create index if not exists account_shares_partner_idx on public.account_shares (partner_user_id);
create index if not exists account_shares_email_idx on public.account_shares (lower(partner_email));
