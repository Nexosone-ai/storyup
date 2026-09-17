-- ============================================================
--  0029: 계좌이체 결제 신청 (PG 정식 오픈 전 수동 승인 경로)
-- ============================================================
-- PortOne 카드결제가 정식 오픈되기 전까지, 사용자가 계좌이체로 구독을 신청하면
-- 관리자가 입금을 확인한 뒤 수동으로 구독을 활성화한다.
-- - 사용자는 본인 신청만 생성/조회한다(RLS).
-- - 승인·거절은 서버 액션(service role)에서만 수행 → 별도 update/delete 정책 없음.
-- - 승인 시 subscriptions를 plan/active/current_period_end=+1개월로 설정한다.
--   빌링키가 없으므로 만기 시 크론(runBillingCycle)이 자동으로 expired 처리 →
--   다음 달에 다시 입금·신청해야 한다(수동 월 결제).

create table if not exists public.bank_transfer_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  plan           text not null check (plan in ('basic', 'pro')),
  amount         integer not null check (amount > 0),  -- 신청 시점 서버 금액 스냅샷
  depositor_name text not null,                        -- 입금자명 (관리자가 입금내역과 대조)
  status         text not null default 'PENDING'
                   check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  admin_note     text,                                 -- 거절 사유 등 관리자 메모
  reviewed_by    uuid references auth.users (id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists bank_transfer_requests_status_idx
  on public.bank_transfer_requests (status, created_at desc);
create index if not exists bank_transfer_requests_user_idx
  on public.bank_transfer_requests (user_id, created_at desc);

create or replace trigger bank_transfer_requests_updated_at
  before update on public.bank_transfer_requests
  for each row execute function public.set_updated_at();

alter table public.bank_transfer_requests enable row level security;

-- 사용자는 본인 신청만 조회한다.
drop policy if exists btr_select_own on public.bank_transfer_requests;
create policy btr_select_own on public.bank_transfer_requests
  for select using (auth.uid() = user_id);

-- 사용자는 본인 명의로만 신청을 생성한다.
drop policy if exists btr_insert_own on public.bank_transfer_requests;
create policy btr_insert_own on public.bank_transfer_requests
  for insert with check (auth.uid() = user_id);
