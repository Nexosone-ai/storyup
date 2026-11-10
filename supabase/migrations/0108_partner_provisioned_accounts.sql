-- ============================================================
--  0108: 파트너 직접 생성 계정(Lite) — 별도계약 파트너용 (2026-11-10)
--  - 요금제 'lite' 추가(랜딩 1 · 블로그 10/월 · 카드뉴스 6/월 · 쇼츠 3/월). B2C 미판매, 파트너가 계정을 직접 생성.
--  - 계정당 30일 이용권 = 118패킷(₩11,800, VAT 별도) — partner_credit_prices 'LITE_ACCOUNT_30D' 로 관리자 조정 가능.
--  - 권한 플래그 partner_account_provisioning (별도계약 파트너). 서브파트너는 상위의 플래그를 상속(코드).
--  - 생성 계정 대장 partner_provisioned_accounts (연장 이력·만료).
--  Idempotent. 초기 대상: todoplus9@naver.com (사용자 지시).
-- ============================================================

-- 1) subscriptions.plan 에 'lite' 허용
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'basic', 'pro', 'partner', 'lite'));

-- 2) 패킷 단가 — 계정 1개 30일 = 118패킷 (1패킷 = ₩100, VAT 별도)
insert into public.partner_credit_prices (action, label, credits, active, updated_at)
values ('LITE_ACCOUNT_30D', '파트너 생성 계정(Lite) 30일 이용권', 118, true, now())
on conflict do nothing;

-- 3) 별도계약 파트너 플래그
create table if not exists public.partner_account_provisioning (
  partner_user_id uuid primary key references auth.users (id) on delete cascade,
  enabled         boolean not null default true,
  note            text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.partner_account_provisioning enable row level security;
drop policy if exists pap_select on public.partner_account_provisioning;
create policy pap_select on public.partner_account_provisioning
  for select to authenticated using (partner_user_id = auth.uid() or public.is_admin());
-- 쓰기는 service role(관리자 액션) 전용.

-- 4) 생성 계정 대장
create table if not exists public.partner_provisioned_accounts (
  id               uuid primary key default gen_random_uuid(),
  partner_user_id  uuid not null references auth.users (id) on delete cascade,
  client_user_id   uuid not null unique references auth.users (id) on delete cascade,
  email            text not null,
  display_name     text,
  periods          integer not null default 1,     -- 결제(차감)된 30일 이용권 수
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists ppa_partner_idx on public.partner_provisioned_accounts (partner_user_id, created_at desc);
alter table public.partner_provisioned_accounts enable row level security;
drop policy if exists ppa_select on public.partner_provisioned_accounts;
create policy ppa_select on public.partner_provisioned_accounts
  for select to authenticated using (partner_user_id = auth.uid() or client_user_id = auth.uid() or public.is_admin());
-- 쓰기는 service role 전용.

-- 5) 초기 대상 파트너
insert into public.partner_account_provisioning (partner_user_id, enabled, note)
select user_id, true, '별도계약 — 계정 직접 생성(2026-11-10)'
from public.profiles where email = 'todoplus9@naver.com'
on conflict (partner_user_id) do nothing;
