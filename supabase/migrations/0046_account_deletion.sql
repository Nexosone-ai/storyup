-- 0046: 회원탈퇴(계정 삭제) 지원.
--
-- 1) 결제·무통장입금 기록은 전자상거래법상 보존 의무(거래 기록 5년)가 있어
--    사용자 삭제 후에도 남겨야 한다. auth.users로의 CASCADE FK를 제거하고
--    user_id는 식별자 값으로만 유지한다(분리 보관). 나머지 사용자 데이터는
--    기존 CASCADE 그대로 auth.users 삭제 시 함께 지워진다.
alter table public.payments
  drop constraint if exists payments_user_id_fkey;
alter table public.bank_transfer_requests
  drop constraint if exists bank_transfer_requests_user_id_fkey;

-- 2) 삭제 계정 대장 — 보존된 결제 기록의 소비자 식별용 최소 정보.
--    RLS 정책을 두지 않아 anon/authenticated는 접근 불가(service_role 전용).
create table if not exists public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  name text,
  reason text,
  had_payments boolean not null default false,
  deleted_at timestamptz not null default now()
);
create index if not exists account_deletions_user_id_idx
  on public.account_deletions (user_id);
alter table public.account_deletions enable row level security;
