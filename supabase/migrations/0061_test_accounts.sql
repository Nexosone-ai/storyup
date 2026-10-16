-- ============================================================
--  0061: 영업용 테스트 계정 관리
-- ============================================================
-- 관리자가 영업자에게 줄 테스트 계정(아이디·비번 지정, Pro, 사용 기간)을 만들고
-- 관리할 수 있도록 메타데이터를 보관한다. 실제 계정은 auth.users에, Pro/만료는
-- subscriptions에 기록되며(만료 시 getPlanId가 자동으로 free 처리), 이 테이블은
-- 관리자 목록/연장/삭제를 위한 인덱스 용도다. 쓰기는 서버(서비스롤) 전용.

create table if not exists public.test_accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  email      text,
  label      text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists test_accounts_created_idx
  on public.test_accounts (created_at desc);

alter table public.test_accounts enable row level security;
