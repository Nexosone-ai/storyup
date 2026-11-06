-- ============================================================
--  0103: 파트너 주도 고객 등록 — 파트너가 고객(가맹점) 이메일을 등록하면 바로 대행
-- ============================================================
-- 기존(0081)은 고객이 파트너를 초대·파트너가 수락하는 방향이었다. 이제 파트너가 고객
-- 이메일을 등록하면 즉시 partner_clients 링크가 생기고(가입 사용자), 아직 가입 전이면
-- 여기 '초대'로 보관했다가 그 이메일로 가입·로그인하는 시점(또는 파트너 홈 재방문)에
-- 자동 연결된다. 고객은 '담당 파트너' 화면에서 언제든 접근을 해제할 수 있다.
-- 추가 전용(비파괴). Requires 0001(set_updated_at), 0004(is_admin), 0068(partner_clients).
-- 운영 반영은 별도 승인 후 SQL 에디터에서 실행.

create table if not exists public.partner_client_invites (
  id               uuid primary key default gen_random_uuid(),
  partner_user_id  uuid not null references auth.users(id) on delete cascade,
  client_email     text not null,
  status           text not null default 'pending'
                     check (status in ('pending','linked','cancelled')),
  client_user_id   uuid references auth.users(id) on delete set null,
  linked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- 한 고객(이메일)은 한 파트너만 담당 — 대기 중 초대는 이메일당 1건.
create unique index if not exists partner_client_invites_pending_email_uq
  on public.partner_client_invites (lower(client_email)) where status = 'pending';
create index if not exists partner_client_invites_partner_idx
  on public.partner_client_invites (partner_user_id, status, created_at desc);

drop trigger if exists partner_client_invites_set_updated_at on public.partner_client_invites;
create trigger partner_client_invites_set_updated_at before update on public.partner_client_invites
  for each row execute function public.set_updated_at();

alter table public.partner_client_invites enable row level security;
-- 파트너 본인 조회 + 관리자 전체. 쓰기는 서비스롤(앱 액션이 가드).
drop policy if exists pci_read on public.partner_client_invites;
create policy pci_read on public.partner_client_invites
  for select to authenticated
  using (partner_user_id = auth.uid() or public.is_admin());
drop policy if exists pci_admin on public.partner_client_invites;
create policy pci_admin on public.partner_client_invites
  for all using (public.is_admin()) with check (public.is_admin());
